package main

import (
	"bufio"
	"dsp-platform/internal/database"
	"dsp-platform/internal/filesync"
	"dsp-platform/internal/logger"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
)

// Configuration loaded from environment
var (
	MasterHost   string
	MasterPort   string
	AgentName    string
	SyncEnabled  bool
	SyncInterval time.Duration
	SyncQuery    string
	DBConfig     database.Config
)

// AgentMessage represents the message protocol
type AgentMessage struct {
	Type      string                 `json:"type"`
	AgentName string                 `json:"agent_name"`
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

var heartbeatCount int

func init() {
	// Robust .env loading: Try loading from executable directory
	ex, err := os.Executable()
	if err == nil {
		exPath := filepath.Dir(ex)
		envPath := filepath.Join(exPath, ".env")
		godotenv.Load(envPath)
	}
	// Fallback to default load (current directory)
	godotenv.Load()

	// Load configuration from environment
	MasterHost = getEnv("MASTER_HOST", "localhost")
	MasterPort = getEnv("MASTER_PORT", "447")
	AgentName = getEnv("AGENT_NAME", "tenant-1")

	// Sync configuration
	SyncEnabled = getEnv("SYNC_ENABLED", "false") == "true"
	syncIntervalSec, _ := strconv.Atoi(getEnv("SYNC_INTERVAL", "30"))
	SyncInterval = time.Duration(syncIntervalSec) * time.Second
	SyncQuery = getEnv("SYNC_QUERY", "SELECT 1")

	// Database configuration
	DBConfig = database.Config{
		Driver:   getEnv("DB_DRIVER", "postgres"),
		Host:     getEnv("DB_HOST", "localhost"),
		Port:     getEnv("DB_PORT", "5432"),
		User:     getEnv("DB_USER", "postgres"),
		Password: getEnv("DB_PASSWORD", ""),
		DBName:   getEnv("DB_NAME", "postgres"),
		SSLMode:  getEnv("DB_SSLMODE", "disable"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// applyDBConfigFromMaster updates DBConfig from master's CONFIG_RESPONSE
func applyDBConfigFromMaster(config map[string]interface{}) {
	if driver, ok := config["driver"].(string); ok && driver != "" {
		DBConfig.Driver = driver
	}
	if host, ok := config["host"].(string); ok && host != "" {
		DBConfig.Host = host
	}
	if port, ok := config["port"].(string); ok && port != "" {
		DBConfig.Port = port
	}
	if user, ok := config["user"].(string); ok && user != "" {
		DBConfig.User = user
	}
	if password, ok := config["password"].(string); ok && password != "" {
		DBConfig.Password = password
	}
	if dbName, ok := config["db_name"].(string); ok && dbName != "" {
		DBConfig.DBName = dbName
	}
	if sslmode, ok := config["sslmode"].(string); ok && sslmode != "" {
		DBConfig.SSLMode = sslmode
	}

	logger.Logger.Info().
		Str("host", DBConfig.Host).
		Str("port", DBConfig.Port).
		Str("user", DBConfig.User).
		Str("db", DBConfig.DBName).
		Msg("Applied database config from Master")
}

func main() {
	// Check for service commands first
	if len(os.Args) > 1 {
		cmd := os.Args[1]
		switch cmd {
		case "-install", "install":
			fmt.Println("Installing DSP Agent service...")
			if err := runServiceMode("install"); err != nil {
				fmt.Printf("Failed to install: %v\n", err)
				os.Exit(1)
			}
			fmt.Println("Service installed successfully!")
			fmt.Println("Use 'dsp-agent -start' to start the service")
			return
		case "-uninstall", "uninstall":
			fmt.Println("Uninstalling DSP Agent service...")
			if err := runServiceMode("uninstall"); err != nil {
				fmt.Printf("Failed to uninstall: %v\n", err)
				os.Exit(1)
			}
			fmt.Println("Service uninstalled successfully!")
			return
		case "-start", "start":
			fmt.Println("Starting DSP Agent service...")
			if err := runServiceMode("start"); err != nil {
				fmt.Printf("Failed to start: %v\n", err)
				os.Exit(1)
			}
			fmt.Println("Service started!")
			return
		case "-stop", "stop":
			fmt.Println("Stopping DSP Agent service...")
			if err := runServiceMode("stop"); err != nil {
				fmt.Printf("Failed to stop: %v\n", err)
				os.Exit(1)
			}
			fmt.Println("Service stopped!")
			return
		case "-status", "status":
			if err := runServiceMode("status"); err != nil {
				fmt.Printf("Failed to get status: %v\n", err)
				os.Exit(1)
			}
			return
		case "-service":
			// Run as service (called by Windows Service Manager)
			if err := RunAsService(); err != nil {
				fmt.Printf("Service error: %v\n", err)
				os.Exit(1)
			}
			return
		case "-help", "help", "-h":
			printHelp()
			return
		}
	}

	// Run in foreground mode (normal execution)
	runAgent()
}

func printHelp() {
	fmt.Println("DSP Platform Agent")
	fmt.Println("")
	fmt.Println("Usage:")
	fmt.Println("  dsp-agent              Run agent in foreground")
	fmt.Println("  dsp-agent -install     Install as Windows service")
	fmt.Println("  dsp-agent -uninstall   Remove Windows service")
	fmt.Println("  dsp-agent -start       Start the service")
	fmt.Println("  dsp-agent -stop        Stop the service")
	fmt.Println("  dsp-agent -status      Check service status")
	fmt.Println("  dsp-agent -help        Show this help")
}

// runAgent is the main agent loop (called directly or by service)
func runAgent() {
	// Initialize logger
	if err := logger.Init(logger.DefaultConfig()); err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}

	logger.Logger.Info().
		Str("agent_name", AgentName).
		Str("master", MasterHost+":"+MasterPort).
		Bool("sync_enabled", SyncEnabled).
		Msg("Starting Tenant Agent")

	// Test database connection if sync enabled
	if SyncEnabled {
		logger.Logger.Info().Msg("Testing database connection...")
		if err := database.TestConnection(DBConfig); err != nil {
			logger.Logger.Error().Err(err).Msg("Database connection test failed")
			logger.Logger.Warn().Msg("Continuing without database sync")
			SyncEnabled = false
		} else {
			logger.Logger.Info().Msg("Database connection successful")
		}
	}

	// Connect to Master server
	conn, err := connectToMaster()
	if err != nil {
		logger.Logger.Fatal().Err(err).Msg("Failed to connect to master")
	}
	defer conn.Close()

	// Register with Master
	if err := registerAgent(conn); err != nil {
		logger.Logger.Fatal().Err(err).Msg("Failed to register")
	}

	// Setup signal handling
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Heartbeat ticker only - jobs are now triggered by Master scheduler
	heartbeatTicker := time.NewTicker(5 * time.Second)
	defer heartbeatTicker.Stop()

	// Listen for responses from Master in goroutine
	go listenForResponses(conn)

	logger.Logger.Info().Msg("Agent ready - waiting for commands from Master")

	// Main loop - simplified, only heartbeat and signal handling
	for {
		select {
		case <-heartbeatTicker.C:
			if err := sendHeartbeat(conn); err != nil {
				logger.Logger.Error().Err(err).Msg("Failed to send heartbeat")

				// Try to reconnect
				conn, err = reconnect()
				if err != nil {
					logger.Logger.Fatal().Err(err).Msg("Failed to reconnect")
				}
			}

		case <-quit:
			logger.Logger.Info().Msg("Shutting down agent...")
			sendMessage(conn, AgentMessage{
				Type:      "HEARTBEAT",
				AgentName: AgentName,
				Status:    "offline",
				Timestamp: time.Now(),
			})
			return
		}
	}
}

func connectToMaster() (net.Conn, error) {
	address := MasterHost + ":" + MasterPort
	logger.Logger.Info().Str("address", address).Msg("Connecting to Master server")

	conn, err := net.Dial("tcp", address)
	if err != nil {
		logger.Logger.Error().Err(err).Str("address", address).Msg("Connection failed")
		return nil, err
	}

	logger.Logger.Info().Msg("Successfully connected to Master server")
	return conn, nil
}

func registerAgent(conn net.Conn) error {
	logger.Logger.Info().Str("agent", AgentName).Msg("Registering agent with Master")

	msg := AgentMessage{
		Type:      "REGISTER",
		AgentName: AgentName,
		Status:    "online",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"version":      "1.0.0",
			"sync_enabled": SyncEnabled,
		},
	}

	return sendMessage(conn, msg)
}

func sendHeartbeat(conn net.Conn) error {
	heartbeatCount++

	// Log every 10th heartbeat to reduce noise
	if heartbeatCount%10 == 0 {
		logger.Logger.Debug().Int("count", heartbeatCount).Msg("Sending heartbeat to Master")
	}

	// Get system metrics (simplified)
	msg := AgentMessage{
		Type:      "HEARTBEAT",
		AgentName: AgentName,
		Status:    "online",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"cpu_usage":    25.5, // Placeholder
			"memory_usage": 1024, // Placeholder (MB)
		},
	}

	return sendMessage(conn, msg)
}

func sendMessage(conn net.Conn, msg AgentMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	data = append(data, '\n')
	_, err = conn.Write(data)
	return err
}

// Global connection for sending responses
var masterConn net.Conn

func listenForResponses(conn net.Conn) {
	masterConn = conn
	scanner := bufio.NewScanner(conn)
	// Increase buffer for large messages
	buf := make([]byte, 0, 64*1024)
	scanner.Buffer(buf, 10*1024*1024)

	for scanner.Scan() {
		var msg AgentMessage
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			logger.Logger.Error().Err(err).Msg("Failed to parse response")
			continue
		}

		logger.Logger.Info().
			Str("type", msg.Type).
			Interface("data", msg.Data).
			Msg("Received message from Master")

		// Handle different message types
		switch msg.Type {
		case "REGISTER_ACK":
			logger.Logger.Info().Msg("Registration acknowledged by Master")

		case "CONFIG_RESPONSE":
			// Apply database config from master if provided
			if dbConfig, ok := msg.Data["db_config"].(map[string]interface{}); ok && len(dbConfig) > 0 {
				applyDBConfigFromMaster(dbConfig)
			}

		case "RUN_JOB":
			// Handle immediate job execution command from master
			go executeRunJobCommand(conn, msg)

		case "TEST_CONNECTION":
			// Handle test connection command from master
			go executeTestConnection(conn, msg)

		case "COMMAND":
			// Handle other commands from master
			logger.Logger.Info().Msg("Received command from Master")
		default:
			logger.Logger.Warn().Str("type", msg.Type).Msg("Unknown message type")
		}
	}

	if err := scanner.Err(); err != nil {
		logger.Logger.Error().Err(err).Msg("Error reading from Master")
	}
}

// executeRunJobCommand handles RUN_JOB command from master
func executeRunJobCommand(conn net.Conn, msg AgentMessage) {
	logger.Logger.Info().Msg("Executing RUN_JOB command from Master")

	// Extract job details
	jobID := uint(0)
	if id, ok := msg.Data["job_id"].(float64); ok {
		jobID = uint(id)
	}

	logID := uint(0)
	if id, ok := msg.Data["log_id"].(float64); ok {
		logID = uint(id)
	}

	// Get job name and target table
	jobName := ""
	if n, ok := msg.Data["name"].(string); ok {
		jobName = n
	}

	// Get source type (database, ftp, sftp)
	sourceType := "database" // default
	if st, ok := msg.Data["source_type"].(string); ok && st != "" {
		sourceType = st
	}

	logger.Logger.Info().
		Uint("job_id", jobID).
		Uint("log_id", logID).
		Str("job", jobName).
		Str("source_type", sourceType).
		Msg("Processing RUN_JOB command")

	// Route based on source type
	switch sourceType {
	case "ftp", "sftp":
		executeFileSyncJob(conn, msg, jobID, logID, jobName, sourceType)
	default:
		executeDatabaseSyncJob(conn, msg, jobID, logID, jobName)
	}
}

// executeDatabaseSyncJob handles database-based sync jobs
func executeDatabaseSyncJob(conn net.Conn, msg AgentMessage, jobID, logID uint, jobName string) {
	// Get query
	query := ""
	if q, ok := msg.Data["query"].(string); ok {
		query = q
	}
	if query == "" {
		if schema, ok := msg.Data["schema"].(map[string]interface{}); ok {
			if q, ok := schema["sql_command"].(string); ok {
				query = q
			}
		}
	}

	// Use db_config from Master (Network settings) if provided
	dbCfg := DBConfig
	if dbConfigMap, ok := msg.Data["db_config"].(map[string]interface{}); ok {
		if driver, ok := dbConfigMap["driver"].(string); ok && driver != "" {
			dbCfg.Driver = driver
		}
		if host, ok := dbConfigMap["host"].(string); ok && host != "" {
			dbCfg.Host = host
		}
		if port, ok := dbConfigMap["port"].(string); ok && port != "" {
			dbCfg.Port = port
		}
		if user, ok := dbConfigMap["user"].(string); ok && user != "" {
			dbCfg.User = user
		}
		if password, ok := dbConfigMap["password"].(string); ok && password != "" {
			dbCfg.Password = password
		}
		if dbName, ok := dbConfigMap["db_name"].(string); ok && dbName != "" {
			dbCfg.DBName = dbName
		}
		if sslMode, ok := dbConfigMap["sslmode"].(string); ok && sslMode != "" {
			dbCfg.SSLMode = sslMode
		}
		logger.Logger.Info().
			Str("host", dbCfg.Host).
			Str("db_name", dbCfg.DBName).
			Msg("Using DB config from Master")
	}

	// Connect to database and execute query
	dbConn, err := database.Connect(dbCfg)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to connect to database")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}
	defer dbConn.Close()

	// Batch configuration
	batchSize := 5000
	totalRecords := 0

	// Define callback function for partial batches
	processBatch := func(batch []map[string]interface{}) error {
		count := len(batch)
		totalRecords += count

		logger.Logger.Info().
			Str("job", jobName).
			Int("batch_size", count).
			Int("total_so_far", totalRecords).
			Msg("Sending partial batch")

		sendDataResponse(conn, jobID, logID, batch, count, "", true)
		return nil
	}

	// Execute the query with batching
	logger.Logger.Info().Str("job", jobName).Msg("Starting batch query execution")
	err = dbConn.ExecuteQueryWithBatch(query, batchSize, processBatch)

	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to execute batch query")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}

	logger.Logger.Info().
		Str("job", jobName).
		Int("total_records", totalRecords).
		Msg("Query execution completed")

	// Send final completion response
	sendDataResponse(conn, jobID, logID, nil, 0, "", false)
}

// executeFileSyncJob handles FTP/SFTP file sync jobs
func executeFileSyncJob(conn net.Conn, msg AgentMessage, jobID, logID uint, jobName, sourceType string) {
	// Get FTP config
	ftpConfig := filesync.FTPConfig{}
	privateKey := ""
	if cfg, ok := msg.Data["ftp_config"].(map[string]interface{}); ok {
		if host, ok := cfg["host"].(string); ok {
			ftpConfig.Host = host
		}
		if port, ok := cfg["port"].(string); ok {
			ftpConfig.Port = port
		}
		if user, ok := cfg["user"].(string); ok {
			ftpConfig.User = user
		}
		if password, ok := cfg["password"].(string); ok {
			ftpConfig.Password = password
		}
		if key, ok := cfg["private_key"].(string); ok {
			privateKey = key
		}
		if path, ok := cfg["path"].(string); ok {
			ftpConfig.Path = path
		}
		if passive, ok := cfg["passive"].(bool); ok {
			ftpConfig.Passive = passive
		}
	}

	// Get file config
	fileFormat := "csv"
	filePattern := ""
	hasHeader := true
	delimiter := ","

	if cfg, ok := msg.Data["file_config"].(map[string]interface{}); ok {
		if format, ok := cfg["format"].(string); ok && format != "" {
			fileFormat = format
		}
		if pattern, ok := cfg["pattern"].(string); ok {
			filePattern = pattern
		}
		if hdr, ok := cfg["has_header"].(bool); ok {
			hasHeader = hdr
		}
		if delim, ok := cfg["delimiter"].(string); ok && delim != "" {
			delimiter = delim
		}
	}

	logger.Logger.Info().
		Str("host", ftpConfig.Host).
		Str("path", ftpConfig.Path).
		Str("pattern", filePattern).
		Str("format", fileFormat).
		Msg("Starting file sync job")

	// Read file from FTP/SFTP
	var fileData []byte
	var fileName string
	var err error

	if sourceType == "sftp" {
		sftpConfig := filesync.SFTPConfig{
			Host:       ftpConfig.Host,
			Port:       ftpConfig.Port,
			User:       ftpConfig.User,
			Password:   ftpConfig.Password,
			PrivateKey: privateKey,
			Path:       ftpConfig.Path,
		}
		if sftpConfig.Port == "" || sftpConfig.Port == "21" {
			sftpConfig.Port = "22" // Default SFTP port
		}

		client, err := filesync.NewSFTPClient(sftpConfig)
		if err != nil {
			logger.Logger.Error().Err(err).Msg("Failed to connect to SFTP server")
			sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
			return
		}
		defer client.Close()

		fileData, fileName, err = client.FindAndReadFile(ftpConfig.Path, filePattern)
		if err != nil {
			logger.Logger.Error().Err(err).Msg("Failed to read file from SFTP")
			sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
			return
		}
	} else {
		// FTP
		if ftpConfig.Port == "" {
			ftpConfig.Port = "21"
		}

		client, err := filesync.NewFTPClient(ftpConfig)
		if err != nil {
			logger.Logger.Error().Err(err).Msg("Failed to connect to FTP server")
			sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
			return
		}
		defer client.Close()

		fileData, fileName, err = client.FindAndReadFile(ftpConfig.Path, filePattern)
		if err != nil {
			logger.Logger.Error().Err(err).Msg("Failed to read file from FTP")
			sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
			return
		}
	}

	logger.Logger.Info().
		Str("file", fileName).
		Int("size_bytes", len(fileData)).
		Msg("File downloaded, parsing...")

	// Parse file
	records, err := filesync.ParseFile(fileData, fileFormat, hasHeader, delimiter)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to parse file")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}

	logger.Logger.Info().
		Str("job", jobName).
		Int("total_records", len(records)).
		Msg("File parsed successfully")

	// Send records in batches
	batchSize := 5000
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}
		batch := records[i:end]
		isPartial := end < len(records)

		sendDataResponse(conn, jobID, logID, batch, len(batch), "", isPartial)
	}

	// Send final completion if we sent data
	if len(records) > 0 && len(records)%batchSize == 0 {
		sendDataResponse(conn, jobID, logID, nil, 0, "", false)
	} else if len(records) == 0 {
		sendDataResponse(conn, jobID, logID, nil, 0, "", false)
	}
}

// sendDataResponse sends data back to master after job execution
func sendDataResponse(conn net.Conn, jobID, logID uint, records []map[string]interface{}, recordCount int, errorMsg string, isPartial bool) {
	status := "completed"
	if errorMsg != "" {
		status = "failed"
	} else if isPartial {
		status = "running"
	}

	// Convert records to interface slice for JSON
	var recordsInterface []interface{}
	for _, r := range records {
		recordsInterface = append(recordsInterface, r)
	}

	response := AgentMessage{
		Type:      "DATA_RESPONSE",
		AgentName: AgentName,
		Status:    status,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"job_id":       jobID,
			"log_id":       logID,
			"status":       status,
			"record_count": recordCount,
			"records":      recordsInterface,
			"error":        errorMsg,
			"partial":      isPartial,
		},
	}

	if err := sendMessage(conn, response); err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to send data response")
	} else {
		logger.Logger.Info().
			Uint("job_id", jobID).
			Int("records", recordCount).
			Str("status", status).
			Bool("partial", isPartial).
			Msg("Data response sent to Master")
	}
}

func reconnect() (net.Conn, error) {
	logger.Logger.Warn().Msg("Attempting to reconnect to Master server")

	maxRetries := 5
	for i := 0; i < maxRetries; i++ {
		logger.Logger.Info().Int("attempt", i+1).Msg("Reconnection attempt")

		conn, err := connectToMaster()
		if err == nil {
			if err := registerAgent(conn); err == nil {
				logger.Logger.Info().Msg("Reconnection successful")
				return conn, nil
			}
		}

		time.Sleep(time.Duration(i+1) * time.Second)
	}

	return nil, fmt.Errorf("failed to reconnect after %d attempts", maxRetries)
}

// executeTestConnection handles TEST_CONNECTION command from master
func executeTestConnection(conn net.Conn, msg AgentMessage) {
	logger.Logger.Info().Msg("Executing TEST_CONNECTION command from Master")

	startTime := time.Now()

	// Check source type (database, ftp, sftp)
	sourceType := "database"
	if st, ok := msg.Data["source_type"].(string); ok && st != "" {
		sourceType = st
	}

	logger.Logger.Info().Str("source_type", sourceType).Msg("Testing connection")

	response := AgentMessage{
		Type:      "TEST_CONNECTION_RESULT",
		AgentName: AgentName,
		Timestamp: time.Now(),
		Data:      make(map[string]interface{}),
	}

	// Route based on source type
	switch sourceType {
	case "ftp", "sftp":
		testFTPConnection(msg, sourceType, &response, startTime)
	default:
		testDatabaseConnection(msg, &response, startTime)
	}

	// Send response to master
	data, err := json.Marshal(response)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to marshal test result")
		return
	}
	data = append(data, '\n')

	if _, err := conn.Write(data); err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to send test result to Master")
	}
}

// testDatabaseConnection tests database connection
func testDatabaseConnection(msg AgentMessage, response *AgentMessage, startTime time.Time) {
	// Extract DB config from message
	var testConfig database.Config
	if dbConfig, ok := msg.Data["db_config"].(map[string]interface{}); ok {
		if v, ok := dbConfig["driver"].(string); ok {
			testConfig.Driver = v
		}
		if v, ok := dbConfig["host"].(string); ok {
			testConfig.Host = v
		}
		if v, ok := dbConfig["port"].(string); ok {
			testConfig.Port = v
		}
		if v, ok := dbConfig["user"].(string); ok {
			testConfig.User = v
		}
		if v, ok := dbConfig["password"].(string); ok {
			testConfig.Password = v
		}
		if v, ok := dbConfig["db_name"].(string); ok {
			testConfig.DBName = v
		}
		if v, ok := dbConfig["sslmode"].(string); ok {
			testConfig.SSLMode = v
		}
	}

	// Use current config if not provided
	if testConfig.Host == "" {
		testConfig = DBConfig
	}

	// Set defaults
	if testConfig.Driver == "" {
		testConfig.Driver = "postgres"
	}
	if testConfig.Port == "" {
		testConfig.Port = "5432"
	}
	if testConfig.SSLMode == "" {
		testConfig.SSLMode = "disable"
	}

	// Try to connect
	dbConn, err := database.Connect(testConfig)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		logger.Logger.Error().Err(err).Msg("Test database connection failed")
		response.Data["success"] = false
		response.Data["error"] = fmt.Sprintf("Database connection failed: %v", err)
		response.Data["duration"] = duration
	} else {
		defer dbConn.Close()

		// Get database version
		var version string
		rows, err := dbConn.ExecuteQuery("SELECT version()")
		if err == nil && len(rows) > 0 {
			if v, ok := rows[0]["version"]; ok {
				version = fmt.Sprintf("%v", v)
			}
		}

		logger.Logger.Info().
			Str("host", testConfig.Host).
			Int64("duration_ms", duration).
			Msg("Test database connection successful")

		response.Data["success"] = true
		response.Data["message"] = "Database connection successful"
		response.Data["duration"] = duration
		response.Data["version"] = version
		response.Data["host"] = testConfig.Host
		response.Data["port"] = testConfig.Port
		response.Data["database"] = testConfig.DBName
	}
}

// testFTPConnection tests FTP/SFTP connection
func testFTPConnection(msg AgentMessage, sourceType string, response *AgentMessage, startTime time.Time) {
	// Extract FTP config
	ftpConfig := filesync.FTPConfig{}
	privateKey := ""
	if cfg, ok := msg.Data["ftp_config"].(map[string]interface{}); ok {
		if host, ok := cfg["host"].(string); ok {
			ftpConfig.Host = host
		}
		if port, ok := cfg["port"].(string); ok {
			ftpConfig.Port = port
		}
		if user, ok := cfg["user"].(string); ok {
			ftpConfig.User = user
		}
		if password, ok := cfg["password"].(string); ok {
			ftpConfig.Password = password
		}
		if key, ok := cfg["private_key"].(string); ok {
			privateKey = key
		}
		if path, ok := cfg["path"].(string); ok {
			ftpConfig.Path = path
		}
		if passive, ok := cfg["passive"].(bool); ok {
			ftpConfig.Passive = passive
		}
	}

	duration := time.Since(startTime).Milliseconds()

	if ftpConfig.Host == "" {
		logger.Logger.Error().Msg("FTP/SFTP host is not configured")
		response.Data["success"] = false
		response.Data["error"] = fmt.Sprintf("%s host is not configured", strings.ToUpper(sourceType))
		response.Data["duration"] = duration
		return
	}

	if sourceType == "sftp" {
		// Test SFTP connection
		sftpConfig := filesync.SFTPConfig{
			Host:       ftpConfig.Host,
			Port:       ftpConfig.Port,
			User:       ftpConfig.User,
			Password:   ftpConfig.Password,
			PrivateKey: privateKey,
			Path:       ftpConfig.Path,
		}
		if sftpConfig.Port == "" || sftpConfig.Port == "21" {
			sftpConfig.Port = "22" // Default SFTP port
		}

		client, err := filesync.NewSFTPClient(sftpConfig)
		duration = time.Since(startTime).Milliseconds()

		if err != nil {
			logger.Logger.Error().Err(err).Msg("Test SFTP connection failed")
			response.Data["success"] = false
			response.Data["error"] = fmt.Sprintf("SFTP connection failed: %v", err)
			response.Data["duration"] = duration
		} else {
			defer client.Close()

			// Try to list directory to verify connection
			_, listErr := client.ListFiles(sftpConfig.Path, "")
			duration = time.Since(startTime).Milliseconds()

			if listErr != nil {
				logger.Logger.Error().Err(listErr).Msg("Test SFTP list directory failed")
				response.Data["success"] = false
				response.Data["error"] = fmt.Sprintf("SFTP connected but failed to list directory: %v", listErr)
				response.Data["duration"] = duration
			} else {
				logger.Logger.Info().
					Str("host", ftpConfig.Host).
					Int64("duration_ms", duration).
					Msg("Test SFTP connection successful")

				response.Data["success"] = true
				response.Data["message"] = "SFTP connection successful"
				response.Data["duration"] = duration
				response.Data["host"] = ftpConfig.Host
				response.Data["port"] = sftpConfig.Port
				response.Data["path"] = ftpConfig.Path
			}
		}
	} else {
		// Test FTP connection
		if ftpConfig.Port == "" {
			ftpConfig.Port = "21"
		}

		client, err := filesync.NewFTPClient(ftpConfig)
		duration = time.Since(startTime).Milliseconds()

		if err != nil {
			logger.Logger.Error().Err(err).Msg("Test FTP connection failed")
			response.Data["success"] = false
			response.Data["error"] = fmt.Sprintf("FTP connection failed: %v", err)
			response.Data["duration"] = duration
		} else {
			defer client.Close()

			// Try to list directory to verify connection
			_, listErr := client.ListFiles(ftpConfig.Path, "")
			duration = time.Since(startTime).Milliseconds()

			if listErr != nil {
				logger.Logger.Error().Err(listErr).Msg("Test FTP list directory failed")
				response.Data["success"] = false
				response.Data["error"] = fmt.Sprintf("FTP connected but failed to list directory: %v", listErr)
				response.Data["duration"] = duration
			} else {
				logger.Logger.Info().
					Str("host", ftpConfig.Host).
					Int64("duration_ms", duration).
					Msg("Test FTP connection successful")

				response.Data["success"] = true
				response.Data["message"] = "FTP connection successful"
				response.Data["duration"] = duration
				response.Data["host"] = ftpConfig.Host
				response.Data["port"] = ftpConfig.Port
				response.Data["path"] = ftpConfig.Path
			}
		}
	}
}
