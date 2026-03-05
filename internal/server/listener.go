package server

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"crypto/tls"
	"dsp-platform/internal/core"
	"dsp-platform/internal/crypto"
	"dsp-platform/internal/database"
	"dsp-platform/internal/security"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"strings"
	"sync"
	"time"
)

// AgentConnection represents an active agent connection
type AgentConnection struct {
	Conn      net.Conn
	AgentName string
	Connected time.Time
}

// PendingRequest represents a pending command waiting for response
type PendingRequest struct {
	ResponseChan chan map[string]interface{}
	CreatedAt    time.Time
}

// cachedTargetConn wraps a target DB connection with metadata for cache management
type cachedTargetConn struct {
	conn     *database.TargetConnection
	lastUsed time.Time
}

// insertWork represents a unit of insert work for the worker pool
type insertWork struct {
	tableName        string
	records          []interface{}
	uniqueKeyColumn  string
	checkpointColumn string
	networkID        uint
	jobID            uint
	logID            float64
	isPartial        bool
	status           string
	recordCount      int
	sampleData       string
	errorMsg         string
	agentName        string
	clientAddr       string
}

// workerPoolSize is the number of concurrent insert workers
const workerPoolSize = 16

// AgentListener handles TCP connections from Tenant Agents on port 447
type AgentListener struct {
	handler         *Handler
	port            string
	connections     map[string]*AgentConnection
	pendingRequests map[uint]*PendingRequest // Map request_id to pending request
	mu              sync.RWMutex
	pendingMu       sync.RWMutex
	tlsConfig       *tls.Config
	encryptor       *crypto.Encryptor

	// Performance: Target DB connection cache (keyed by networkID)
	targetDBCache map[uint]*cachedTargetConn
	targetDBMu    sync.RWMutex

	// Performance: EnsureTable cache (skip redundant information_schema queries)
	ensuredTables map[string]bool
	ensuredMu     sync.RWMutex

	// Performance: Worker pool for parallel batch inserts
	insertWorkChan chan insertWork

	// Abort tracking: skip insert work for aborted jobs
	abortedJobs map[uint]bool
	abortedMu   sync.RWMutex
}

// NewAgentListener creates a new agent listener
func NewAgentListener(handler *Handler, port string) *AgentListener {
	// Initialize encryptor
	encryptConfig := crypto.LoadConfigFromEnv()
	enc, _ := crypto.NewEncryptor(encryptConfig)
	if enc.IsEnabled() {
		log.Printf("🔐 Payload encryption enabled for agent listener")
	}

	al := &AgentListener{
		handler:         handler,
		port:            port,
		connections:     make(map[string]*AgentConnection),
		pendingRequests: make(map[uint]*PendingRequest),
		encryptor:       enc,
		targetDBCache:   make(map[uint]*cachedTargetConn),
		ensuredTables:   make(map[string]bool),
		insertWorkChan:  make(chan insertWork, 256),
		abortedJobs:     make(map[uint]bool),
	}
	// Set reference in handler for bidirectional communication
	handler.agentListener = al

	// Start background cleanup for stale target DB connections
	go al.cleanupStaleTargetConns()

	// Start insert worker pool
	for i := 0; i < workerPoolSize; i++ {
		go al.insertWorker(i)
	}
	log.Printf("⚡ Started %d parallel insert workers", workerPoolSize)

	return al
}

// NewAgentListenerWithTLS creates a new agent listener with TLS support
func NewAgentListenerWithTLS(handler *Handler, port string, tlsConfig security.TLSConfig) *AgentListener {
	// Initialize encryptor
	encryptConfig := crypto.LoadConfigFromEnv()
	enc, _ := crypto.NewEncryptor(encryptConfig)
	if enc.IsEnabled() {
		log.Printf("🔐 Payload encryption enabled for agent listener")
	}

	al := &AgentListener{
		handler:         handler,
		port:            port,
		connections:     make(map[string]*AgentConnection),
		pendingRequests: make(map[uint]*PendingRequest),
		encryptor:       enc,
		targetDBCache:   make(map[uint]*cachedTargetConn),
		ensuredTables:   make(map[string]bool),
		insertWorkChan:  make(chan insertWork, 32),
	}

	// Load TLS config if enabled
	if tlsConfig.Enabled {
		cfg, err := security.LoadServerTLSConfig(tlsConfig.CertPath, tlsConfig.KeyPath)
		if err != nil {
			log.Printf("⚠️ Failed to load TLS config for agent listener: %v", err)
			log.Printf("⚠️ Agent listener will run WITHOUT TLS encryption!")
		} else {
			al.tlsConfig = cfg
			log.Printf("🔒 TLS enabled for agent listener")
		}
	}

	// Set reference in handler for bidirectional communication
	handler.agentListener = al

	// Start background cleanup for stale target DB connections
	go al.cleanupStaleTargetConns()

	// Start insert worker pool
	for i := 0; i < workerPoolSize; i++ {
		go al.insertWorker(i)
	}
	log.Printf("⚡ Started %d parallel insert workers", workerPoolSize)

	return al
}

// Start begins listening for agent connections
func (al *AgentListener) Start() error {
	address := fmt.Sprintf(":%s", al.port)
	var listener net.Listener
	var err error

	// Use TLS if configured
	if al.tlsConfig != nil {
		listener, err = tls.Listen("tcp", address, al.tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to start TLS agent listener: %w", err)
		}
		log.Printf("🔒 Agent TLS listener started on port %s", al.port)
	} else {
		listener, err = net.Listen("tcp", address)
		if err != nil {
			return fmt.Errorf("failed to start agent listener: %w", err)
		}
		log.Printf("⚠️ Agent listener started on port %s (NO TLS - INSECURE!)", al.port)
	}
	defer listener.Close()

	for {
		conn, err := listener.Accept()
		if err != nil {
			log.Printf("Failed to accept connection: %v", err)
			continue
		}

		// Handle each connection in a separate goroutine
		go al.handleConnection(conn)
	}
}

// handleConnection processes a single agent connection
func (al *AgentListener) handleConnection(conn net.Conn) {
	clientAddr := conn.RemoteAddr().String()
	log.Printf("New agent connection from %s", clientAddr)

	var agentName string

	scanner := bufio.NewScanner(conn)
	// Increase buffer size for large data
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 10*1024*1024) // 10MB max

	for scanner.Scan() {
		rawData := scanner.Text()

		// Decrypt data if encrypted
		var dataStr string
		if crypto.IsEncrypted(rawData) {
			if al.encryptor == nil || !al.encryptor.IsEnabled() {
				log.Printf("Received encrypted message but encryption not configured")
				continue
			}
			decrypted, err := al.encryptor.Decrypt(rawData)
			if err != nil {
				log.Printf("Failed to decrypt agent message: %v", err)
				continue
			}
			dataStr = string(decrypted)
		} else {
			dataStr = rawData
		}

		// Decompress gzip-compressed payloads (GZ: prefix)
		var data []byte
		if strings.HasPrefix(dataStr, "GZ:") {
			decompressed, err := decompressGzip(dataStr[3:])
			if err != nil {
				log.Printf("Failed to decompress gzip message: %v", err)
				continue
			}
			data = decompressed
		} else {
			data = []byte(dataStr)
		}

		var msg core.AgentMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("Failed to parse agent message: %v", err)
			continue
		}

		// Store agent name for cleanup
		if msg.AgentName != "" {
			agentName = msg.AgentName
		}

		al.processMessage(msg, clientAddr, conn)
	}

	if err := scanner.Err(); err != nil {
		log.Printf("Connection error from %s: %v", clientAddr, err)
	}

	// Cleanup on disconnect
	if agentName != "" {
		al.removeConnection(agentName)
	}

	log.Printf("Agent disconnected: %s", clientAddr)
	conn.Close()
}

// storeConnection saves an agent connection for later use
func (al *AgentListener) storeConnection(agentName string, conn net.Conn) {
	al.mu.Lock()
	defer al.mu.Unlock()

	al.connections[agentName] = &AgentConnection{
		Conn:      conn,
		AgentName: agentName,
		Connected: time.Now(),
	}
	log.Printf("Stored connection for agent: %s (total: %d)", agentName, len(al.connections))
}

// removeConnection removes an agent connection
func (al *AgentListener) removeConnection(agentName string) {
	al.mu.Lock()
	defer al.mu.Unlock()

	delete(al.connections, agentName)
	log.Printf("Removed connection for agent: %s", agentName)
}

// GetConnection returns an agent's connection if available
func (al *AgentListener) GetConnection(agentName string) net.Conn {
	al.mu.RLock()
	defer al.mu.RUnlock()

	if ac, ok := al.connections[agentName]; ok {
		return ac.Conn
	}
	return nil
}

// GetConnectedAgents returns list of connected agent names
func (al *AgentListener) GetConnectedAgents() []string {
	al.mu.RLock()
	defer al.mu.RUnlock()

	agents := make([]string, 0, len(al.connections))
	for name := range al.connections {
		agents = append(agents, name)
	}
	return agents
}

// SendCommandToAgent sends a command to a specific agent
func (al *AgentListener) SendCommandToAgent(agentName string, msg core.AgentMessage) error {
	conn := al.GetConnection(agentName)
	if conn == nil {
		return fmt.Errorf("agent %s is not connected", agentName)
	}

	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal command: %w", err)
	}

	data = append(data, '\n')
	if _, err := conn.Write(data); err != nil {
		al.removeConnection(agentName)
		return fmt.Errorf("failed to send command: %w", err)
	}

	log.Printf("Sent command %s to agent %s", msg.Type, agentName)
	return nil
}

// processMessage handles different types of agent messages
func (al *AgentListener) processMessage(msg core.AgentMessage, clientAddr string, conn net.Conn) {
	log.Printf("Received message from %s: Type=%s, Agent=%s, Status=%s",
		clientAddr, msg.Type, msg.AgentName, msg.Status)

	switch msg.Type {
	case "REGISTER":
		al.handleRegister(msg, clientAddr, conn)
	case "HEARTBEAT":
		al.handleHeartbeat(msg, clientAddr)
	case "DATA_PUSH":
		al.handleDataPush(msg, clientAddr)
	case "DATA_SYNC":
		al.handleDataSync(msg, clientAddr)
	case "DATA_RESPONSE":
		al.handleDataResponse(msg, clientAddr)
	case "CONFIG_PULL":
		al.handleConfigPull(msg, conn)
	case "EXEC_COMMAND_RESULT":
		al.handleExecCommandResult(msg, clientAddr)
	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

// handleRegister processes agent registration
func (al *AgentListener) handleRegister(msg core.AgentMessage, clientAddr string, conn net.Conn) {
	al.handler.UpdateAgentStatus(msg.AgentName, "online", clientAddr)

	// Store connection for later use (bidirectional communication)
	al.storeConnection(msg.AgentName, conn)

	// Auto-create Network if not exists (so agent appears in Network Management)
	al.autoCreateNetwork(msg.AgentName, clientAddr)

	// Send acknowledgment
	response := core.AgentMessage{
		Type:      "REGISTER_ACK",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"status":  "success",
			"message": "Agent registered successfully",
		},
	}

	al.sendResponse(conn, response)
}

// autoCreateNetwork creates a placeholder Network entry when agent first registers
func (al *AgentListener) autoCreateNetwork(agentName, clientAddr string) {
	// Check if Network already exists with this agent name
	var existingNetwork core.Network
	err := al.handler.db.Where("name = ? OR agent_name = ?", agentName, agentName).First(&existingNetwork).Error

	if err == nil {
		// Network already exists, update IP and status
		existingNetwork.IPAddress = clientAddr
		existingNetwork.Status = "online"
		existingNetwork.LastSeen = time.Now()
		al.handler.db.Save(&existingNetwork)
		log.Printf("Updated existing Network '%s' with IP: %s", agentName, clientAddr)
		return
	}

	// Create new placeholder Network
	network := core.Network{
		Name:       agentName,
		AgentName:  agentName,
		IPAddress:  clientAddr,
		Status:     "online",
		Type:       "source",
		SourceType: "database", // Default source type
		LastSeen:   time.Now(),
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
		// Database config fields are empty - user will fill them in
		DBDriver:  "postgres",
		DBPort:    "5432",
		DBSSLMode: "disable",
		// Target config defaults
		TargetSourceType: "database",
		TargetDBDriver:   "postgres",
		TargetDBPort:     "5432",
		TargetDBSSLMode:  "disable",
	}

	if err := al.handler.db.Create(&network).Error; err != nil {
		log.Printf("Failed to auto-create Network for agent %s: %v", agentName, err)
		return
	}

	log.Printf("✅ Auto-created Network '%s' for newly registered agent (IP: %s)", agentName, clientAddr)
}

// handleHeartbeat processes heartbeat messages
func (al *AgentListener) handleHeartbeat(msg core.AgentMessage, clientAddr string) {
	al.handler.UpdateAgentStatus(msg.AgentName, msg.Status, clientAddr)
}

// handleDataSync processes database sync data from agents
func (al *AgentListener) handleDataSync(msg core.AgentMessage, clientAddr string) {
	log.Printf("DATA_SYNC received from %s", msg.AgentName)

	// Extract sync metadata
	if msg.Data != nil {
		if recordCount, ok := msg.Data["record_count"].(float64); ok {
			log.Printf("Sync metadata: %d records from query: %v",
				int(recordCount), msg.Data["query"])
		}

		// Log sample of synced records
		if records, ok := msg.Data["records"].([]interface{}); ok {
			log.Printf("Synced %d records from %s", len(records), msg.AgentName)

			// Log first few records as sample
			sampleSize := 3
			if len(records) < sampleSize {
				sampleSize = len(records)
			}

			for i := 0; i < sampleSize; i++ {
				log.Printf("Record %d: %v", i+1, records[i])
			}
		}
	}

	al.handler.UpdateAgentStatus(msg.AgentName, "online", clientAddr)
}

// handleDataResponse processes data responses from run job commands
// Dispatches insert work to the worker pool for parallel processing
func (al *AgentListener) handleDataResponse(msg core.AgentMessage, clientAddr string) {
	log.Printf("DATA_RESPONSE received from %s", msg.AgentName)

	if msg.Data == nil {
		log.Printf("No data in response")
		return
	}

	// Extract job info
	jobID := uint(0)
	if id, ok := msg.Data["job_id"].(float64); ok {
		jobID = uint(id)
	}

	// Check if this is a partial batch
	isPartial := false
	if p, ok := msg.Data["partial"].(bool); ok {
		isPartial = p
	}

	recordCount := 0
	if count, ok := msg.Data["record_count"].(float64); ok {
		recordCount = int(count)
	}

	status := "completed"
	if s, ok := msg.Data["status"].(string); ok {
		status = s
	}

	errorMsg := ""
	if e, ok := msg.Data["error"].(string); ok && e != "" {
		errorMsg = e
		status = "failed"
	}

	// Get sample data
	sampleData := ""
	if records, ok := msg.Data["records"].([]interface{}); ok && len(records) > 0 {
		// Take first 5 records as sample
		sampleSize := 5
		if len(records) < sampleSize {
			sampleSize = len(records)
		}
		sample := records[:sampleSize]
		sampleJSON, _ := json.Marshal(sample)
		sampleData = string(sampleJSON)
	}

	// Get target table and unique key from job's schema
	targetTable := ""
	uniqueKeyColumn := ""
	checkpointColumn := ""
	var networkID uint
	if jobID > 0 {
		var job core.Job
		if err := al.handler.db.Preload("Schema").Preload("Network").First(&job, jobID).Error; err == nil {
			targetTable = job.Schema.TargetTable
			uniqueKeyColumn = job.Schema.UniqueKeyColumn
			checkpointColumn = job.CheckpointColumn
			networkID = job.NetworkID
		}
	}

	// Get log_id for worker
	logID := float64(0)
	if lid, ok := msg.Data["log_id"].(float64); ok {
		logID = lid
	}

	// Dispatch insert work to worker pool (async, non-blocking)
	if records, ok := msg.Data["records"].([]interface{}); ok && len(records) > 0 && targetTable != "" {
		work := insertWork{
			tableName:        targetTable,
			records:          records,
			uniqueKeyColumn:  uniqueKeyColumn,
			checkpointColumn: checkpointColumn,
			networkID:        networkID,
			jobID:            jobID,
			logID:            logID,
			isPartial:        isPartial,
			status:           status,
			recordCount:      recordCount,
			sampleData:       sampleData,
			errorMsg:         errorMsg,
			agentName:        msg.AgentName,
			clientAddr:       clientAddr,
		}

		select {
		case al.insertWorkChan <- work:
			log.Printf("⚡ Dispatched batch (%d records) to worker pool for job %d", recordCount, jobID)
		default:
			// Channel full — fallback to synchronous insert to avoid data loss
			log.Printf("⚠️ Worker pool full, executing insert synchronously for job %d", jobID)
			al.executeInsertWork(work)
		}
	} else {
		// No records to insert — just update job log/status inline (cheap operation)
		al.updateJobLog(logID, isPartial, status, recordCount, 0, sampleData, errorMsg)
		al.updateJobStatus(jobID, isPartial, status)
	}

	al.handler.UpdateAgentStatus(msg.AgentName, "online", clientAddr)
}

// insertWorker is a goroutine that processes insert work from the channel
func (al *AgentListener) insertWorker(workerID int) {
	log.Printf("Insert worker %d started", workerID)
	for work := range al.insertWorkChan {
		al.executeInsertWork(work)
	}
}

// executeInsertWork performs the actual insert and updates job log/status
func (al *AgentListener) executeInsertWork(work insertWork) {
	// Check if job was aborted — skip insert work entirely
	if al.isJobAborted(work.jobID) {
		log.Printf("⏭️ Skipping insert for aborted job %d (%d records)", work.jobID, work.recordCount)
		al.updateJobLog(work.logID, work.isPartial, "failed", work.recordCount, 0, work.sampleData, "Aborted by user")
		return
	}

	// Extract maximum checkpoint value if applicable
	var maxCheckpoint string
	if work.checkpointColumn != "" && len(work.records) > 0 {
		for _, r := range work.records {
			if rec, ok := r.(map[string]interface{}); ok {
				if val, exists := rec[work.checkpointColumn]; exists && val != nil {
					strVal := fmt.Sprintf("%v", val)
					if maxCheckpoint == "" || strVal > maxCheckpoint {
						maxCheckpoint = strVal
					}
				}
			}
		}
	}

	// Insert/Upsert data into target database
	insertedCount := al.upsertToTargetDBWithNetwork(work.tableName, work.records, work.uniqueKeyColumn, work.networkID)
	if work.uniqueKeyColumn != "" {
		log.Printf("Upserted %d records into target table '%s' (key: %s)", insertedCount, work.tableName, work.uniqueKeyColumn)
	} else {
		log.Printf("Inserted %d records into target table '%s'", insertedCount, work.tableName)
	}

	// Reset sequence ONLY at end of job (not per-batch) to avoid unnecessary overhead
	if !work.isPartial {
		al.resetSequenceForTable(work.tableName, work.uniqueKeyColumn, work.networkID)
	}

	// Update job log and status
	al.updateJobLog(work.logID, work.isPartial, work.status, work.recordCount, insertedCount, work.sampleData, work.errorMsg)
	al.updateJobStatus(work.jobID, work.isPartial, work.status, maxCheckpoint)

	log.Printf("Job %d response: status=%s, batch_records=%d, inserted=%d, partial=%v",
		work.jobID, work.status, work.recordCount, insertedCount, work.isPartial)
}

// updateJobLog updates the job log record with batch results
func (al *AgentListener) updateJobLog(logID float64, isPartial bool, status string, recordCount, insertedCount int, sampleData, errorMsg string) {
	if logID == 0 {
		return
	}
	var jobLog core.JobLog
	if err := al.handler.db.First(&jobLog, uint(logID)).Error; err == nil {
		// Prevent partial batches from overwriting a 'completed' or 'failed' status
		// This happens due to network race conditions where the final data pulse (partial=false)
		// is processed before the worker pool finishes processing the last data batch.
		if isPartial {
			if jobLog.Status != "completed" && jobLog.Status != "failed" {
				jobLog.Status = "running"
			}
		} else {
			jobLog.Status = status
			jobLog.CompletedAt = time.Now()
			jobLog.Duration = time.Since(jobLog.StartedAt).Milliseconds()
		}

		jobLog.RecordCount += recordCount

		if sampleData != "" {
			jobLog.SampleData = sampleData
		}
		if errorMsg != "" {
			jobLog.ErrorMessage = errorMsg
			jobLog.Status = "failed" // Ensure status is marked failed on error even for partial
		}

		al.handler.db.Save(&jobLog)
		log.Printf("Updated job log %d: status=%s, total_records=%d, batch_inserted=%d, partial=%v",
			uint(logID), jobLog.Status, jobLog.RecordCount, insertedCount, isPartial)
	}
}

// updateJobStatus updates the job status
func (al *AgentListener) updateJobStatus(jobID uint, isPartial bool, status string, newCheckpoint ...string) {
	if jobID == 0 {
		return
	}
	var job core.Job
	if err := al.handler.db.First(&job, jobID).Error; err == nil {
		if isPartial {
			// Protect against race conditions overriding final statuses
			if job.Status != "completed" && job.Status != "failed" {
				job.Status = "running"
			}
		} else {
			job.Status = status
		}

		// Update checkpoint if applicable and it's not empty, and if it's greater than current
		if len(newCheckpoint) > 0 && newCheckpoint[0] != "" {
			if job.LastCheckpoint == "" || newCheckpoint[0] > job.LastCheckpoint {
				job.LastCheckpoint = newCheckpoint[0]
				log.Printf("Updated job %d checkpoint to %s", jobID, job.LastCheckpoint)
			}
		}

		al.handler.db.Save(&job)
	}
}

// insertToTargetDB connects to target database and inserts records
func (al *AgentListener) insertToTargetDB(tableName string, records []interface{}) int {
	return al.upsertToTargetDB(tableName, records, "")
}

// upsertToTargetDBWithNetwork connects to target database using Network config and inserts or updates records
// Uses connection cache and EnsureTable cache for performance
func (al *AgentListener) upsertToTargetDBWithNetwork(tableName string, records []interface{}, uniqueKeyColumn string, networkID uint) int {
	// Try to load target database config from Network first
	config := al.loadTargetDBConfigFromNetwork(networkID)

	// Fall back to global settings if Network config is not available
	if config.Host == "" {
		config = al.loadTargetDBConfig()
	}

	// Check if target DB is configured
	if config.Password == "" && config.Host == "" {
		log.Printf("Target database not configured, skipping insert")
		return 0
	}

	// Use cached connection or create new one
	targetConn, err := al.getOrCreateTargetConn(networkID, config)
	if err != nil {
		log.Printf("Failed to get target database connection: %v", err)
		return 0
	}
	// NOTE: Don't close here — connection is cached and reused across batches

	// Convert records to map format
	var recordMaps []map[string]interface{}
	for _, r := range records {
		if rec, ok := r.(map[string]interface{}); ok {
			recordMaps = append(recordMaps, rec)
		}
	}

	if len(recordMaps) == 0 {
		log.Printf("No valid records to insert")
		return 0
	}

	// Ensure table exists (cached — only checks once per table)
	if !al.isTableEnsured(tableName) {
		if err := targetConn.EnsureTable(tableName, recordMaps[0]); err != nil {
			log.Printf("Failed to ensure table: %v", err)
			return 0
		}
		al.markTableEnsured(tableName)
	}

	// Upsert or Insert records based on unique key
	var count int
	if uniqueKeyColumn != "" {
		log.Printf("Upserting with unique key column: %s", uniqueKeyColumn)
		count, err = targetConn.UpsertBatch(tableName, recordMaps, uniqueKeyColumn)
	} else {
		count, err = targetConn.InsertBatch(tableName, recordMaps)
	}
	if err != nil {
		log.Printf("Batch operation error: %v", err)
		// Connection might be stale — evict from cache so next batch reconnects
		al.evictTargetConn(networkID)
	}

	// NOTE: ResetSequence is now called at end-of-job in executeInsertWork(),
	// not per-batch, to avoid 14,000+ unnecessary sequence reset queries on large syncs.

	return count
}

// getOrCreateTargetConn returns a cached target DB connection or creates a new one
// NOTE: No Ping() on cached connections — they are verified lazily on error
func (al *AgentListener) getOrCreateTargetConn(networkID uint, config database.TargetConfig) (*database.TargetConnection, error) {
	al.targetDBMu.RLock()
	if cached, ok := al.targetDBCache[networkID]; ok {
		cached.lastUsed = time.Now()
		al.targetDBMu.RUnlock()
		return cached.conn, nil
	}
	al.targetDBMu.RUnlock()

	// Create new connection
	log.Printf("Connecting to target DB: %s@%s:%s/%s (driver: %s)",
		config.User, config.Host, config.Port, config.DBName, config.Driver)

	targetConn, err := database.ConnectTarget(config)
	if err != nil {
		return nil, err
	}

	// Cache the connection
	al.targetDBMu.Lock()
	al.targetDBCache[networkID] = &cachedTargetConn{
		conn:     targetConn,
		lastUsed: time.Now(),
	}
	al.targetDBMu.Unlock()

	log.Printf("⚡ Cached target DB connection for network %d", networkID)
	return targetConn, nil
}

// evictTargetConn removes and closes a cached target DB connection
func (al *AgentListener) evictTargetConn(networkID uint) {
	al.targetDBMu.Lock()
	defer al.targetDBMu.Unlock()

	if cached, ok := al.targetDBCache[networkID]; ok {
		cached.conn.Close()
		delete(al.targetDBCache, networkID)
	}
}

// isTableEnsured checks if a table has already been verified to exist
func (al *AgentListener) isTableEnsured(tableName string) bool {
	al.ensuredMu.RLock()
	defer al.ensuredMu.RUnlock()
	return al.ensuredTables[tableName]
}

// markTableEnsured marks a table as verified
func (al *AgentListener) markTableEnsured(tableName string) {
	al.ensuredMu.Lock()
	defer al.ensuredMu.Unlock()
	al.ensuredTables[tableName] = true
}

// resetSequenceForTable resets the sequence for a table after job completion
// Called only once at end-of-job instead of per-batch to avoid massive overhead
func (al *AgentListener) resetSequenceForTable(tableName string, uniqueKeyColumn string, networkID uint) {
	config := al.loadTargetDBConfigFromNetwork(networkID)
	if config.Host == "" {
		config = al.loadTargetDBConfig()
	}
	if config.Password == "" && config.Host == "" {
		return
	}

	targetConn, err := al.getOrCreateTargetConn(networkID, config)
	if err != nil {
		log.Printf("Warning: Failed to get connection for sequence reset: %v", err)
		return
	}

	primaryKeyCol := uniqueKeyColumn
	if primaryKeyCol == "" {
		primaryKeyCol = "id"
	}
	if err := targetConn.ResetSequence(tableName, primaryKeyCol); err != nil {
		log.Printf("Warning: Failed to reset sequence for %s: %v", tableName, err)
	} else {
		log.Printf("✅ Reset sequence for table %s (end-of-job)", tableName)
	}
}

// cleanupStaleTargetConns periodically closes target DB connections unused for 10 minutes
func (al *AgentListener) cleanupStaleTargetConns() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		al.targetDBMu.Lock()
		now := time.Now()
		for networkID, cached := range al.targetDBCache {
			if now.Sub(cached.lastUsed) > 10*time.Minute {
				log.Printf("Closing stale target DB connection for network %d (idle %.0f min)",
					networkID, now.Sub(cached.lastUsed).Minutes())
				cached.conn.Close()
				delete(al.targetDBCache, networkID)
			}
		}
		al.targetDBMu.Unlock()
	}
}

// MarkJobAborted marks a job as aborted so worker pool skips remaining batches
func (al *AgentListener) MarkJobAborted(jobID uint) {
	al.abortedMu.Lock()
	defer al.abortedMu.Unlock()
	al.abortedJobs[jobID] = true
	log.Printf("🛑 Marked job %d as aborted in worker pool", jobID)
}

// isJobAborted checks if a job has been aborted
func (al *AgentListener) isJobAborted(jobID uint) bool {
	al.abortedMu.RLock()
	defer al.abortedMu.RUnlock()
	return al.abortedJobs[jobID]
}

// ClearJobAborted removes abort tracking for a job (called when job starts fresh)
func (al *AgentListener) ClearJobAborted(jobID uint) {
	al.abortedMu.Lock()
	defer al.abortedMu.Unlock()
	delete(al.abortedJobs, jobID)
}

// decompressGzip decodes base64 and decompresses gzip data
func decompressGzip(base64Data string) ([]byte, error) {
	compressed, err := base64.StdEncoding.DecodeString(base64Data)
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64: %w", err)
	}

	reader, err := gzip.NewReader(bytes.NewReader(compressed))
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip reader: %w", err)
	}
	defer reader.Close()

	decompressed, err := io.ReadAll(reader)
	if err != nil {
		return nil, fmt.Errorf("failed to decompress: %w", err)
	}

	log.Printf("⚡ Decompressed message: %d bytes → %d bytes", len(compressed), len(decompressed))
	return decompressed, nil
}

// loadTargetDBConfigFromNetwork loads target database config from Network
func (al *AgentListener) loadTargetDBConfigFromNetwork(networkID uint) database.TargetConfig {
	config := database.TargetConfig{
		Driver:  "postgres",
		Port:    "5432",
		SSLMode: "disable",
	}

	if networkID == 0 {
		return config
	}

	var network core.Network
	if err := al.handler.db.First(&network, networkID).Error; err != nil {
		log.Printf("Failed to load network %d for target DB config: %v", networkID, err)
		return config
	}

	// Use target DB config from Network if available
	if network.TargetDBHost != "" {
		config.Driver = network.TargetDBDriver
		config.Host = network.TargetDBHost
		config.Port = network.TargetDBPort
		config.User = network.TargetDBUser
		config.Password = network.TargetDBPassword
		config.DBName = network.TargetDBName
		config.SSLMode = network.TargetDBSSLMode

		// Set defaults if not specified
		if config.Driver == "" {
			config.Driver = "postgres"
		}
		if config.Port == "" {
			config.Port = "5432"
		}
		if config.SSLMode == "" {
			config.SSLMode = "disable"
		}

		log.Printf("Using Network target DB config: %s@%s:%s/%s", config.User, config.Host, config.Port, config.DBName)
	}

	return config
}

// upsertToTargetDB connects to target database and inserts or updates records
// Delegates to upsertToTargetDBWithNetwork with networkID=0 to benefit from connection caching
func (al *AgentListener) upsertToTargetDB(tableName string, records []interface{}, uniqueKeyColumn string) int {
	return al.upsertToTargetDBWithNetwork(tableName, records, uniqueKeyColumn, 0)
}

// loadTargetDBConfig loads target database config from Settings table
func (al *AgentListener) loadTargetDBConfig() database.TargetConfig {
	config := database.TargetConfig{
		Driver:  "postgres",
		Port:    "5432",
		SSLMode: "disable",
	}

	keys := []string{"target_db_driver", "target_db_host", "target_db_port", "target_db_user", "target_db_password", "target_db_name", "target_db_sslmode"}
	var settings []core.Settings
	al.handler.db.Where("key IN ?", keys).Find(&settings)

	for _, s := range settings {
		switch s.Key {
		case "target_db_driver":
			if s.Value != "" {
				config.Driver = s.Value
			}
		case "target_db_host":
			config.Host = s.Value
		case "target_db_port":
			if s.Value != "" {
				config.Port = s.Value
			}
		case "target_db_user":
			config.User = s.Value
		case "target_db_password":
			config.Password = s.Value
		case "target_db_name":
			config.DBName = s.Value
		case "target_db_sslmode":
			if s.Value != "" {
				config.SSLMode = s.Value
			}
		}
	}

	return config
}

// handleDataPush processes data pushed from agents
func (al *AgentListener) handleDataPush(msg core.AgentMessage, clientAddr string) {
	log.Printf("Data received from %s: %v", msg.AgentName, msg.Data)

	// In production, you would process and store this data
	// For now, we just log it
	al.handler.UpdateAgentStatus(msg.AgentName, "online", clientAddr)
}

// handleConfigPull sends configuration to requesting agents
func (al *AgentListener) handleConfigPull(msg core.AgentMessage, conn net.Conn) {
	log.Printf("Agent %s requesting configuration", msg.AgentName)

	// Query jobs for this agent
	var jobs []core.Job
	err := al.handler.db.Preload("Schema").Preload("Network").
		Joins("JOIN networks ON jobs.network_id = networks.id").
		Where("networks.name = ?", msg.AgentName).
		Find(&jobs).Error

	if err != nil {
		log.Printf("Error fetching jobs for agent %s: %v", msg.AgentName, err)
	}

	// Build job configs
	var jobConfigs []map[string]interface{}
	for _, job := range jobs {
		jobConfigs = append(jobConfigs, map[string]interface{}{
			"job_id":       job.ID,
			"name":         job.Name,
			"schedule":     job.Schedule,
			"query":        job.Schema.SQLCommand,
			"target_table": job.Schema.TargetTable,
		})
	}

	// Get database config for this agent's network
	var network core.Network
	dbConfig := map[string]interface{}{}
	if err := al.handler.db.Where("name = ?", msg.AgentName).First(&network).Error; err == nil {
		if network.DBHost != "" {
			dbConfig = map[string]interface{}{
				"driver":   network.DBDriver,
				"host":     network.DBHost,
				"port":     network.DBPort,
				"user":     network.DBUser,
				"password": network.DBPassword,
				"db_name":  network.DBName,
				"sslmode":  network.DBSSLMode,
			}
			log.Printf("Sending DB config to agent %s: %s@%s:%s/%s",
				msg.AgentName, network.DBUser, network.DBHost, network.DBPort, network.DBName)
		}
	}

	log.Printf("Sending %d jobs to agent %s", len(jobConfigs), msg.AgentName)

	response := core.AgentMessage{
		Type:      "CONFIG_RESPONSE",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"jobs":      jobConfigs,
			"db_config": dbConfig, // Source database config for agent
		},
	}

	al.sendResponse(conn, response)
}

// sendResponse sends a JSON response to the agent
func (al *AgentListener) sendResponse(conn net.Conn, msg core.AgentMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal response: %v", err)
		return
	}

	data = append(data, '\n')
	if _, err := conn.Write(data); err != nil {
		log.Printf("Failed to send response: %v", err)
	}
}

// SendCommandAndWait sends a command to an agent and waits for the response
func (al *AgentListener) SendCommandAndWait(agentName string, msg core.AgentMessage, timeout time.Duration) (map[string]interface{}, error) {
	conn := al.GetConnection(agentName)
	if conn == nil {
		return nil, fmt.Errorf("agent %s is not connected", agentName)
	}

	// Get request_id from message data
	requestID := uint(0)
	if id, ok := msg.Data["request_id"].(uint); ok {
		requestID = id
	}

	// Create response channel
	responseChan := make(chan map[string]interface{}, 1)

	// Register pending request
	al.pendingMu.Lock()
	al.pendingRequests[requestID] = &PendingRequest{
		ResponseChan: responseChan,
		CreatedAt:    time.Now(),
	}
	al.pendingMu.Unlock()

	// Cleanup after we're done
	defer func() {
		al.pendingMu.Lock()
		delete(al.pendingRequests, requestID)
		al.pendingMu.Unlock()
	}()

	// Send command
	data, err := json.Marshal(msg)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal command: %w", err)
	}

	data = append(data, '\n')
	if _, err := conn.Write(data); err != nil {
		al.removeConnection(agentName)
		return nil, fmt.Errorf("failed to send command: %w", err)
	}

	log.Printf("Sent EXEC_COMMAND to agent %s (request_id: %d)", agentName, requestID)

	// Wait for response with timeout
	select {
	case result := <-responseChan:
		return result, nil
	case <-time.After(timeout):
		return nil, fmt.Errorf("command timed out after %v", timeout)
	}
}

// handleExecCommandResult processes command execution results from agents
func (al *AgentListener) handleExecCommandResult(msg core.AgentMessage, clientAddr string) {
	log.Printf("EXEC_COMMAND_RESULT received from %s", msg.AgentName)

	if msg.Data == nil {
		log.Printf("No data in exec result")
		return
	}

	// Get request_id to find the pending request
	requestID := uint(0)
	if id, ok := msg.Data["request_id"].(float64); ok {
		requestID = uint(id)
	}

	// Find and notify the waiting goroutine
	al.pendingMu.RLock()
	pending, exists := al.pendingRequests[requestID]
	al.pendingMu.RUnlock()

	if exists && pending != nil {
		// Send result to channel (non-blocking)
		select {
		case pending.ResponseChan <- msg.Data:
			log.Printf("Delivered exec result for request %d", requestID)
		default:
			log.Printf("Failed to deliver exec result for request %d (channel full)", requestID)
		}
	} else {
		log.Printf("No pending request found for request_id %d", requestID)
	}

	al.handler.UpdateAgentStatus(msg.AgentName, "online", clientAddr)
}
