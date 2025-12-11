package server

import (
	"bufio"
	"dsp-platform/internal/core"
	"dsp-platform/internal/database"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"sync"
	"time"
)

// AgentConnection represents an active agent connection
type AgentConnection struct {
	Conn      net.Conn
	AgentName string
	Connected time.Time
}

// AgentListener handles TCP connections from Tenant Agents on port 447
type AgentListener struct {
	handler     *Handler
	port        string
	connections map[string]*AgentConnection
	mu          sync.RWMutex
}

// NewAgentListener creates a new agent listener
func NewAgentListener(handler *Handler, port string) *AgentListener {
	al := &AgentListener{
		handler:     handler,
		port:        port,
		connections: make(map[string]*AgentConnection),
	}
	// Set reference in handler for bidirectional communication
	handler.agentListener = al
	return al
}

// Start begins listening for agent connections
func (al *AgentListener) Start() error {
	listener, err := net.Listen("tcp", fmt.Sprintf(":%s", al.port))
	if err != nil {
		return fmt.Errorf("failed to start agent listener: %w", err)
	}
	defer listener.Close()

	log.Printf("Agent listener started on port %s", al.port)

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
		data := scanner.Bytes()

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
	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

// handleRegister processes agent registration
func (al *AgentListener) handleRegister(msg core.AgentMessage, clientAddr string, conn net.Conn) {
	al.handler.UpdateAgentStatus(msg.AgentName, "online", clientAddr)

	// Store connection for later use (bidirectional communication)
	al.storeConnection(msg.AgentName, conn)

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
	if jobID > 0 {
		var job core.Job
		if err := al.handler.db.Preload("Schema").First(&job, jobID).Error; err == nil {
			targetTable = job.Schema.TargetTable
			uniqueKeyColumn = job.Schema.UniqueKeyColumn
		}
	}

	// Insert/Upsert data into target database
	insertedCount := 0
	if records, ok := msg.Data["records"].([]interface{}); ok && len(records) > 0 && targetTable != "" {
		insertedCount = al.upsertToTargetDB(targetTable, records, uniqueKeyColumn)
		if uniqueKeyColumn != "" {
			log.Printf("Upserted %d records into target table '%s' (key: %s)", insertedCount, targetTable, uniqueKeyColumn)
		} else {
			log.Printf("Inserted %d records into target table '%s'", insertedCount, targetTable)
		}
	}

	// Update job log if we have a log_id
	if logID, ok := msg.Data["log_id"].(float64); ok {
		var jobLog core.JobLog
		if err := al.handler.db.First(&jobLog, uint(logID)).Error; err == nil {
			// Update status
			if isPartial {
				jobLog.Status = "running"
			} else {
				jobLog.Status = status
				jobLog.CompletedAt = time.Now()
				jobLog.Duration = time.Since(jobLog.StartedAt).Milliseconds()
			}

			// Accumulate record count
			// If partial, add the batch count. If final, it might be 0 or the last batch.
			// Assumption: Agent sends batch count in record_count for each message.
			jobLog.RecordCount += recordCount

			// Update other fields
			if sampleData != "" {
				jobLog.SampleData = sampleData
			}
			if errorMsg != "" {
				jobLog.ErrorMessage = errorMsg
			}

			al.handler.db.Save(&jobLog)
			log.Printf("Updated job log %d: status=%s, total_records=%d, batch_inserted=%d, partial=%v",
				uint(logID), jobLog.Status, jobLog.RecordCount, insertedCount, isPartial)
		}
	}

	// Update job status
	if jobID > 0 {
		var job core.Job
		if err := al.handler.db.First(&job, jobID).Error; err == nil {
			if isPartial {
				job.Status = "running"
			} else {
				job.Status = status
			}
			al.handler.db.Save(&job)
		}
	}

	log.Printf("Job %d response: status=%s, batch_records=%d, inserted=%d, partial=%v",
		jobID, status, recordCount, insertedCount, isPartial)
	al.handler.UpdateAgentStatus(msg.AgentName, "online", clientAddr)
}

// insertToTargetDB connects to target database and inserts records
func (al *AgentListener) insertToTargetDB(tableName string, records []interface{}) int {
	return al.upsertToTargetDB(tableName, records, "")
}

// upsertToTargetDB connects to target database and inserts or updates records
func (al *AgentListener) upsertToTargetDB(tableName string, records []interface{}, uniqueKeyColumn string) int {
	// Load target database config from database settings
	config := al.loadTargetDBConfig()

	// Check if target DB is configured
	if config.Password == "" && config.Host == "" {
		log.Printf("Target database not configured, skipping insert")
		return 0
	}

	// Connect to target database
	targetConn, err := database.ConnectTarget(config)
	if err != nil {
		log.Printf("Failed to connect to target database: %v", err)
		return 0
	}
	defer targetConn.Close()

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

	// Ensure table exists
	if err := targetConn.EnsureTable(tableName, recordMaps[0]); err != nil {
		log.Printf("Failed to ensure table: %v", err)
		return 0
	}

	// Upsert or Insert records based on unique key
	var count int
	if uniqueKeyColumn != "" {
		count, err = targetConn.UpsertBatch(tableName, recordMaps, uniqueKeyColumn)
	} else {
		count, err = targetConn.InsertBatch(tableName, recordMaps)
	}
	if err != nil {
		log.Printf("Batch operation error: %v", err)
	}

	return count
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
