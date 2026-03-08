package main

import (
	"bufio"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/tls"
	"crypto/x509"
	"dsp-platform/internal/crypto"
	"dsp-platform/internal/database"
	"dsp-platform/internal/filesync"
	"dsp-platform/internal/logger"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/dop251/goja"
	"github.com/joho/godotenv"
)

// Configuration loaded from environment
var (
	MasterHost   string
	MasterPort   string
	AgentName    string
	AgentToken   string // Authentication token for registering with master
	SyncEnabled  bool
	SyncInterval time.Duration
	SyncQuery    string
	DBConfig     database.Config

	// TLS Configuration
	TLSEnabled    bool
	TLSCAPath     string
	TLSSkipVerify bool

	// Encryption
	encryptor *crypto.Encryptor
)

// AgentMessage represents the message protocol
type AgentMessage struct {
	Type      string                 `json:"type"`
	AgentName string                 `json:"agent_name"`
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

var (
	heartbeatCount int
	connMu         sync.Mutex
)

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
	AgentToken = getEnv("AGENT_TOKEN", "") // Auth token from Master dashboard

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

	// TLS configuration
	TLSEnabled = getEnv("TLS_ENABLED", "false") == "true"
	TLSCAPath = getEnv("TLS_CA_PATH", "./certs/ca.crt")
	TLSSkipVerify = getEnv("TLS_SKIP_VERIFY", "false") == "true"

	// Initialize encryption
	encryptConfig := crypto.LoadConfigFromEnv()
	var encErr error
	encryptor, encErr = crypto.NewEncryptor(encryptConfig)
	if encErr != nil {
		panic("Failed to initialize encryption: " + encErr.Error())
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
		logger.Logger.Warn().Err(err).Msg("Failed initial connection to master, entering reconnect loop...")
		conn, err = reconnect()
		if err != nil {
			// This shouldn't be reached as reconnect() now loops indefinitely,
			// but kept for safety.
			logger.Logger.Fatal().Err(err).Msg("Failed to connect to master")
		}
	} else {
		// Register with Master only if initial connection succeeded
		// (reconnect() handles registration on loop)
		if err := registerAgent(conn); err != nil {
			logger.Logger.Fatal().Err(err).Msg("Failed to register")
		}
	}
	defer conn.Close()

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

				// CRITICAL FIX: listenForResponses goroutine from old connection is dead.
				// We must start a new one for this new connection!
				go listenForResponses(conn)
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

	// Create custom dialer with TCP Keep-Alive
	dialer := &net.Dialer{
		Timeout:   10 * time.Second,
		KeepAlive: 5 * time.Second,
	}

	if TLSEnabled {
		logger.Logger.Info().
			Str("address", address).
			Bool("tls", true).
			Bool("skip_verify", TLSSkipVerify).
			Msg("🔒 Connecting to Master server with TLS")

		// Create TLS config
		tlsConfig := &tls.Config{
			MinVersion: tls.VersionTLS12,
		}

		if TLSSkipVerify {
			tlsConfig.InsecureSkipVerify = true
			logger.Logger.Warn().Msg("⚠️ TLS certificate verification disabled (INSECURE!)")
		} else if TLSCAPath != "" {
			// Load CA certificate
			caCert, err := os.ReadFile(TLSCAPath)
			if err != nil {
				logger.Logger.Error().Err(err).Str("path", TLSCAPath).Msg("Failed to read CA certificate")
				return nil, fmt.Errorf("failed to read CA certificate: %w", err)
			}

			caCertPool := x509.NewCertPool()
			if !caCertPool.AppendCertsFromPEM(caCert) {
				return nil, fmt.Errorf("failed to parse CA certificate")
			}

			tlsConfig.RootCAs = caCertPool
			logger.Logger.Info().Str("ca_path", TLSCAPath).Msg("Loaded CA certificate for verification")
		}

		conn, err := tls.DialWithDialer(dialer, "tcp", address, tlsConfig)
		if err != nil {
			logger.Logger.Error().Err(err).Str("address", address).Msg("TLS connection failed")
			return nil, err
		}

		logger.Logger.Info().Msg("🔒 Successfully connected to Master server via TLS")
		return conn, nil
	}

	// Non-TLS connection (fallback)
	logger.Logger.Info().Str("address", address).Msg("⚠️ Connecting to Master server (NO TLS - INSECURE!)")

	conn, err := dialer.Dial("tcp", address)
	if err != nil {
		logger.Logger.Error().Err(err).Str("address", address).Msg("Connection failed")
		return nil, err
	}

	logger.Logger.Info().Msg("Successfully connected to Master server (without TLS)")
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
			"token":        AgentToken, // Auth token for validation
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

	// Compress large payloads (> 1KB) with gzip for wire efficiency
	var payload string
	if len(data) > 1024 {
		compressed, err := compressGzip(data)
		if err == nil && len(compressed) < len(data) {
			// Use GZ: prefix for compressed payloads (base64 to stay line-safe)
			payload = "GZ:" + base64.StdEncoding.EncodeToString(compressed)
			logger.Logger.Debug().
				Int("original", len(data)).
				Int("compressed", len(compressed)).
				Float64("ratio", float64(len(compressed))/float64(len(data))*100).
				Msg("Compressed message payload")
		} else {
			payload = string(data)
		}
	} else {
		payload = string(data)
	}

	// Encrypt data payload if encryption is enabled
	if encryptor != nil && encryptor.IsEnabled() {
		payload, err = encryptor.EncryptString(payload)
		if err != nil {
			logger.Logger.Error().Err(err).Msg("Failed to encrypt message")
			return err
		}
	}

	// Protect connection write with mutex to prevent corrupted messages from concurrent writers
	connMu.Lock()
	defer connMu.Unlock()

	_, err = conn.Write([]byte(payload + "\n"))
	return err
}

// compressGzip compresses data using gzip
func compressGzip(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	gzWriter, err := gzip.NewWriterLevel(&buf, gzip.BestSpeed)
	if err != nil {
		return nil, err
	}
	_, err = gzWriter.Write(data)
	if err != nil {
		gzWriter.Close()
		return nil, err
	}
	if err := gzWriter.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
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

		case "EXEC_COMMAND":
			// Handle remote command execution from master terminal console
			go executeRemoteCommand(conn, msg)

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
	// Get source type (database, ftp, sftp, api)
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
	case "api":
		executeAPISyncJob(conn, msg, jobID, logID, jobName)
	case "mongodb":
		executeMongoDBSyncJob(conn, msg, jobID, logID, jobName)
	case "redis":
		executeRedisSyncJob(conn, msg, jobID, logID, jobName)
	case "minio":
		executeMinIOSyncJob(conn, msg, jobID, logID, jobName)
	case "minio_mirror":
		executeMinIOMirrorJob(conn, msg, jobID, logID, jobName)
	case "javascript":
		executeJavaScriptJob(conn, msg, jobID, logID, jobName)
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
	batchSize := 25000 // Sweet spot: blazingly fast but safe enough payload size
	totalRecords := 0

	// Define callback function for partial batches
	processCsvBatch := func(csvData string, columns []string) error {
		// Rough estimate of rows by newline count
		count := strings.Count(csvData, "\n")
		totalRecords += count

		logger.Logger.Info().
			Str("job", jobName).
			Int("batch_size", count).
			Int("total_so_far", totalRecords).
			Msg("Sending partial CSV batch")

		sendCsvDataResponse(conn, jobID, logID, csvData, columns, count, "", true)
		return nil
	}

	// Execute the query with batching
	logger.Logger.Info().Str("job", jobName).Msg("Starting high-performance CSV batch query execution")
	err = dbConn.ExecuteQueryWithCsvBatch(query, batchSize, processCsvBatch)

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

// executeJavaScriptJob handles execution of arbitrary JavaScript schemas (for Data Integration)
func executeJavaScriptJob(conn net.Conn, msg AgentMessage, jobID, logID uint, jobName string) {
	logger.Logger.Info().
		Uint("job_id", jobID).
		Str("job", jobName).
		Msg("Starting JavaScript Execution Job")

	// Get script from query or schema.sql_command
	script := ""
	if q, ok := msg.Data["query"].(string); ok && q != "" {
		script = q
	}
	if script == "" {
		if schema, ok := msg.Data["schema"].(map[string]interface{}); ok {
			if q, ok := schema["sql_command"].(string); ok {
				script = q
			}
		}
	}

	if script == "" {
		errMsg := "No JavaScript code provided in schema"
		logger.Logger.Error().Msg(errMsg)
		sendDataResponse(conn, jobID, logID, nil, 0, errMsg, false)
		return
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
	}

	// Create Goja interpreter
	vm := goja.New()

	// Define $GT global context object
	gtObj := vm.NewObject()

	// $GT.query(sql, args...) -> execute SQL and return array of objects
	gtObj.Set("query", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			panic(vm.ToValue("query() requires at least 1 argument: sql string"))
		}

		sqlStr := call.Arguments[0].String()

		var args []interface{}
		for i := 1; i < len(call.Arguments); i++ {
			args = append(args, call.Arguments[i].Export())
		}

		dbConn, err := database.Connect(dbCfg)
		if err != nil {
			panic(vm.ToValue(fmt.Sprintf("DB Connect Error: %v", err)))
		}
		defer dbConn.Close()

		results, err := dbConn.ExecuteQuery(sqlStr, args...)
		if err != nil {
			panic(vm.ToValue(fmt.Sprintf("DB Query Error: %v", err)))
		}

		return vm.ToValue(results)
	})

	responseSent := false

	// $GT.response(data, statusCode?) -> send JSON batch back to Master
	gtObj.Set("response", func(call goja.FunctionCall) goja.Value {
		if len(call.Arguments) < 1 {
			panic(vm.ToValue("response() requires at least 1 object or array of objects"))
		}

		dataExport := call.Arguments[0].Export()
		var records []map[string]interface{}

		// Ensure it's a slice of maps or a single map
		if slice, ok := dataExport.([]interface{}); ok {
			for _, item := range slice {
				if m, ok := item.(map[string]interface{}); ok {
					records = append(records, m)
				}
			}
		} else if sliceMap, ok := dataExport.([]map[string]interface{}); ok {
			records = sliceMap
		} else if m, ok := dataExport.(map[string]interface{}); ok {
			records = append(records, m)
		} else {
			panic(vm.ToValue("response() data must be an array of objects or an object natively"))
		}

		sendDataResponse(conn, jobID, logID, records, len(records), "", false)
		responseSent = true
		return goja.Undefined()
	})

	// Inject $GT global
	vm.Set("$GT", gtObj)

	// Execute Script
	logger.Logger.Info().Str("job", jobName).Msg("Running JS evaluation via Goja runtime")
	_, err := vm.RunString(script)

	if err != nil {
		logger.Logger.Error().Err(err).Msg("JavaScript Execution Failed")
		// Extract JS error cleanly
		errMsg := "JavaScript Runtime Error"
		if jsErr, ok := err.(*goja.Exception); ok {
			errMsg = jsErr.String()
		} else {
			errMsg = err.Error()
		}
		if !responseSent {
			sendDataResponse(conn, jobID, logID, nil, 0, errMsg, false)
		}
		return
	}

	logger.Logger.Info().Str("job", jobName).Msg("JS evaluation completed")

	if !responseSent {
		sendDataResponse(conn, jobID, logID, nil, 0, "Warning: script completed but $GT.response() was never called", false)
	}
}

// executeMongoDBSyncJob handles MongoDB-based sync jobs
func executeMongoDBSyncJob(conn net.Conn, msg AgentMessage, jobID, logID uint, jobName string) {
	logger.Logger.Info().
		Uint("job_id", jobID).
		Str("job", jobName).
		Msg("Starting MongoDB sync job")

	// Extract MongoDB config from message
	mongoConfig := database.MongoConfig{}
	if cfg, ok := msg.Data["mongo_config"].(map[string]interface{}); ok {
		if host, ok := cfg["host"].(string); ok {
			mongoConfig.Host = host
		}
		if port, ok := cfg["port"].(string); ok {
			mongoConfig.Port = port
		}
		if user, ok := cfg["user"].(string); ok {
			mongoConfig.User = user
		}
		if password, ok := cfg["password"].(string); ok {
			mongoConfig.Password = password
		}
		if dbName, ok := cfg["database"].(string); ok {
			mongoConfig.Database = dbName
		}
		if collection, ok := cfg["collection"].(string); ok {
			mongoConfig.Collection = collection
		}
		if authDB, ok := cfg["auth_db"].(string); ok {
			mongoConfig.AuthDB = authDB
		}
	}

	// Get query filter (JSON format) from schema
	queryFilter := "{}"
	if q, ok := msg.Data["query"].(string); ok && q != "" {
		queryFilter = q
	}

	// Default port if not specified
	if mongoConfig.Port == "" {
		mongoConfig.Port = "27017"
	}
	if mongoConfig.AuthDB == "" {
		mongoConfig.AuthDB = "admin"
	}

	logger.Logger.Debug().
		Str("host", mongoConfig.Host).
		Str("port", mongoConfig.Port).
		Str("database", mongoConfig.Database).
		Str("collection", mongoConfig.Collection).
		Str("filter", queryFilter).
		Msg("MongoDB config received")

	// Validate config
	if mongoConfig.Host == "" || mongoConfig.Database == "" || mongoConfig.Collection == "" {
		errMsg := "MongoDB config missing required fields (host, database, or collection)"
		logger.Logger.Error().Msg(errMsg)
		sendDataResponse(conn, jobID, logID, nil, 0, errMsg, false)
		return
	}

	// Connect to MongoDB
	mongoConn, err := database.MongoConnect(mongoConfig)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to connect to MongoDB")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}
	defer mongoConn.Close()

	// Parse the query filter as JSON
	var filter map[string]interface{}
	if err := json.Unmarshal([]byte(queryFilter), &filter); err != nil {
		// If parsing fails, use empty filter (get all documents)
		filter = make(map[string]interface{})
	}

	// Convert to bson.M
	bsonFilter := make(map[string]interface{})
	for k, v := range filter {
		bsonFilter[k] = v
	}

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
			Msg("Sending MongoDB batch")

		sendDataResponse(conn, jobID, logID, batch, count, "", true)
		return nil
	}

	// Execute MongoDB find query with streaming batch processing
	logger.Logger.Info().Str("job", jobName).Msg("Starting MongoDB streaming query")
	err = mongoConn.ExecuteFindWithBatch(mongoConfig.Collection, bsonFilter, batchSize, processBatch)

	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to execute MongoDB find")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}

	logger.Logger.Info().
		Str("job", jobName).
		Int("total_records", totalRecords).
		Msg("MongoDB streaming query completed")

	// Send final completion response
	sendDataResponse(conn, jobID, logID, nil, 0, "", false)
}

// executeRedisSyncJob handles Redis-based sync jobs
func executeRedisSyncJob(conn net.Conn, msg AgentMessage, jobID, logID uint, jobName string) {
	logger.Logger.Info().
		Uint("job_id", jobID).
		Str("job", jobName).
		Msg("Starting Redis sync job")

	// Extract Redis config from message
	redisConfig := database.RedisConfig{}
	if cfg, ok := msg.Data["redis_config"].(map[string]interface{}); ok {
		if host, ok := cfg["host"].(string); ok {
			redisConfig.Host = host
		}
		if port, ok := cfg["port"].(string); ok {
			redisConfig.Port = port
		}
		if password, ok := cfg["password"].(string); ok {
			redisConfig.Password = password
		}
		if db, ok := cfg["db"].(float64); ok {
			redisConfig.DB = int(db)
		}
		if pattern, ok := cfg["pattern"].(string); ok {
			redisConfig.Pattern = pattern
		}
	}

	// Default port if not specified
	if redisConfig.Port == "" {
		redisConfig.Port = "6379"
	}

	// Use query as pattern if redis pattern is empty
	if redisConfig.Pattern == "" {
		if q, ok := msg.Data["query"].(string); ok && q != "" {
			redisConfig.Pattern = q
		} else {
			redisConfig.Pattern = "*" // Default: get all keys
		}
	}

	logger.Logger.Debug().
		Str("host", redisConfig.Host).
		Str("port", redisConfig.Port).
		Int("db", redisConfig.DB).
		Str("pattern", redisConfig.Pattern).
		Msg("Redis config received")

	// Validate config
	if redisConfig.Host == "" {
		errMsg := "Redis config missing required field: host"
		logger.Logger.Error().Msg(errMsg)
		sendDataResponse(conn, jobID, logID, nil, 0, errMsg, false)
		return
	}

	// Connect to Redis
	redisConn, err := database.RedisConnect(redisConfig)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to connect to Redis")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}
	defer redisConn.Close()

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
			Msg("Sending Redis batch")

		sendDataResponse(conn, jobID, logID, batch, count, "", true)
		return nil
	}

	// Scan keys with streaming batch processing
	logger.Logger.Info().Str("job", jobName).Str("pattern", redisConfig.Pattern).Msg("Starting Redis streaming scan")
	err = redisConn.ScanKeysWithBatch(redisConfig.Pattern, batchSize, processBatch)

	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to scan Redis keys")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}

	logger.Logger.Info().
		Str("job", jobName).
		Int("total_records", totalRecords).
		Msg("Redis streaming scan completed")

	// Send final completion response
	sendDataResponse(conn, jobID, logID, nil, 0, "", false)
}

// executeMinIOSyncJob handles MinIO/S3 based sync jobs
func executeMinIOSyncJob(conn net.Conn, msg AgentMessage, jobID, logID uint, jobName string) {
	logger.Logger.Info().
		Uint("job_id", jobID).
		Str("job", jobName).
		Msg("Starting MinIO sync job")

	// Extract MinIO config from message
	minioConfig := filesync.MinIOConfig{}
	if cfg, ok := msg.Data["minio_config"].(map[string]interface{}); ok {
		if endpoint, ok := cfg["endpoint"].(string); ok {
			minioConfig.Endpoint = endpoint
		}
		if accessKey, ok := cfg["access_key"].(string); ok {
			minioConfig.AccessKeyID = accessKey
		}
		if secretKey, ok := cfg["secret_key"].(string); ok {
			minioConfig.SecretAccessKey = secretKey
		}
		if bucket, ok := cfg["bucket"].(string); ok {
			minioConfig.BucketName = bucket
		}
		if objectPath, ok := cfg["object_path"].(string); ok {
			minioConfig.ObjectPath = objectPath
		}
		if useSSL, ok := cfg["use_ssl"].(bool); ok {
			minioConfig.UseSSL = useSSL
		}
		if region, ok := cfg["region"].(string); ok {
			minioConfig.Region = region
		}
	}

	// Get file config for parsing
	fileFormat := "csv" // default
	filePattern := "*"
	hasHeader := true
	var delimiter rune = ','

	if fileCfg, ok := msg.Data["file_config"].(map[string]interface{}); ok {
		if format, ok := fileCfg["format"].(string); ok && format != "" {
			fileFormat = format
		}
		if pattern, ok := fileCfg["pattern"].(string); ok && pattern != "" {
			filePattern = pattern
		}
		if hdr, ok := fileCfg["has_header"].(bool); ok {
			hasHeader = hdr
		}
		if delim, ok := fileCfg["delimiter"].(string); ok && len(delim) > 0 {
			delimiter = rune(delim[0])
		}
	}

	// Override pattern from object_path if provided
	if minioConfig.ObjectPath != "" {
		filePattern = minioConfig.ObjectPath
	}

	logger.Logger.Debug().
		Str("endpoint", minioConfig.Endpoint).
		Str("bucket", minioConfig.BucketName).
		Str("pattern", filePattern).
		Str("format", fileFormat).
		Bool("use_ssl", minioConfig.UseSSL).
		Msg("MinIO config received")

	// Validate config
	if minioConfig.Endpoint == "" || minioConfig.BucketName == "" {
		errMsg := "MinIO config missing required fields (endpoint or bucket)"
		logger.Logger.Error().Msg(errMsg)
		sendDataResponse(conn, jobID, logID, nil, 0, errMsg, false)
		return
	}

	// Connect to MinIO
	client, err := filesync.NewMinIOClient(minioConfig)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to connect to MinIO")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}
	defer client.Close()

	logger.Logger.Info().
		Str("job", jobName).
		Str("pattern", filePattern).
		Msg("Finding and reading object from MinIO")

	// Read the object
	data, objectName, err := client.FindAndReadObject("", filePattern)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to read object from MinIO")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}

	logger.Logger.Info().
		Int("data_size", len(data)).
		Str("object", objectName).
		Str("format", fileFormat).
		Msg("Object read successfully, parsing content")

	// Parse data based on format
	var records []map[string]interface{}

	switch fileFormat {
	case "csv":
		// Parse CSV
		records, err = filesync.ParseCSV(data, hasHeader, delimiter)
	case "json":
		// Parse JSON
		records, err = filesync.ParseAPIResponse(data)
	case "excel":
		// For Excel, we need actual Excel parsing (not implemented in filesync yet)
		errMsg := "Excel parsing from MinIO not yet implemented"
		logger.Logger.Warn().Msg(errMsg)
		sendDataResponse(conn, jobID, logID, nil, 0, errMsg, false)
		return
	default:
		// Try JSON first, then CSV
		records, err = filesync.ParseAPIResponse(data)
		if err != nil {
			records, err = filesync.ParseCSV(data, hasHeader, ',')
		}
	}

	if err != nil {
		logger.Logger.Error().Err(err).Str("format", fileFormat).Msg("Failed to parse object content")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}

	logger.Logger.Info().
		Str("job", jobName).
		Int("total_records", len(records)).
		Msg("MinIO object parsed successfully")

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

	// Send final completion if needed
	if len(records) == 0 || len(records)%batchSize == 0 {
		sendDataResponse(conn, jobID, logID, nil, 0, "", false)
	}
}

// executeMinIOMirrorJob handles MinIO to MinIO object-level sync (like mc mirror)
func executeMinIOMirrorJob(conn net.Conn, msg AgentMessage, jobID, logID uint, jobName string) {
	logger.Logger.Info().
		Uint("job_id", jobID).
		Str("job", jobName).
		Msg("Starting MinIO mirror job")

	// Extract source MinIO config
	sourceConfig := filesync.MinIOConfig{}
	if cfg, ok := msg.Data["minio_config"].(map[string]interface{}); ok {
		if endpoint, ok := cfg["endpoint"].(string); ok {
			sourceConfig.Endpoint = endpoint
		}
		if accessKey, ok := cfg["access_key"].(string); ok {
			sourceConfig.AccessKeyID = accessKey
		}
		if secretKey, ok := cfg["secret_key"].(string); ok {
			sourceConfig.SecretAccessKey = secretKey
		}
		if bucket, ok := cfg["bucket"].(string); ok {
			sourceConfig.BucketName = bucket
		}
		if objectPath, ok := cfg["object_path"].(string); ok {
			sourceConfig.ObjectPath = objectPath
		}
		if useSSL, ok := cfg["use_ssl"].(bool); ok {
			sourceConfig.UseSSL = useSSL
		}
		if region, ok := cfg["region"].(string); ok {
			sourceConfig.Region = region
		}
	}

	// Extract target MinIO config
	targetConfig := filesync.MinIOConfig{}
	if cfg, ok := msg.Data["target_minio_config"].(map[string]interface{}); ok {
		if endpoint, ok := cfg["endpoint"].(string); ok {
			targetConfig.Endpoint = endpoint
		}
		if accessKey, ok := cfg["access_key"].(string); ok {
			targetConfig.AccessKeyID = accessKey
		}
		if secretKey, ok := cfg["secret_key"].(string); ok {
			targetConfig.SecretAccessKey = secretKey
		}
		if bucket, ok := cfg["bucket"].(string); ok {
			targetConfig.BucketName = bucket
		}
		if objectPath, ok := cfg["object_path"].(string); ok {
			targetConfig.ObjectPath = objectPath
		}
		if useSSL, ok := cfg["use_ssl"].(bool); ok {
			targetConfig.UseSSL = useSSL
		}
		if region, ok := cfg["region"].(string); ok {
			targetConfig.Region = region
		}
	}

	// Extract mirror options
	mirrorOpts := filesync.MirrorOptions{
		Incremental: true, // Default: incremental sync
	}
	if fileCfg, ok := msg.Data["file_config"].(map[string]interface{}); ok {
		if pattern, ok := fileCfg["pattern"].(string); ok {
			mirrorOpts.Pattern = pattern
		}
		if prefix, ok := fileCfg["prefix"].(string); ok {
			mirrorOpts.Prefix = prefix
		}
	}
	if sourceConfig.ObjectPath != "" {
		mirrorOpts.Prefix = sourceConfig.ObjectPath
	}

	// Check for watch mode
	watchMode := false
	if wm, ok := msg.Data["watch_mode"].(bool); ok {
		watchMode = wm
	}

	logger.Logger.Debug().
		Str("source_endpoint", sourceConfig.Endpoint).
		Str("source_bucket", sourceConfig.BucketName).
		Str("target_endpoint", targetConfig.Endpoint).
		Str("target_bucket", targetConfig.BucketName).
		Str("prefix", mirrorOpts.Prefix).
		Bool("incremental", mirrorOpts.Incremental).
		Bool("watch_mode", watchMode).
		Msg("MinIO mirror config")

	// Validate configs
	if sourceConfig.Endpoint == "" || sourceConfig.BucketName == "" {
		errMsg := "Source MinIO config missing required fields (endpoint or bucket)"
		logger.Logger.Error().Msg(errMsg)
		sendMirrorResponse(conn, jobID, logID, nil, errMsg, false)
		return
	}
	if targetConfig.Endpoint == "" || targetConfig.BucketName == "" {
		errMsg := "Target MinIO config missing required fields (endpoint or bucket)"
		logger.Logger.Error().Msg(errMsg)
		sendMirrorResponse(conn, jobID, logID, nil, errMsg, false)
		return
	}

	// Connect to source MinIO
	sourceClient, err := filesync.NewMinIOClient(sourceConfig)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to connect to source MinIO")
		sendMirrorResponse(conn, jobID, logID, nil, err.Error(), false)
		return
	}
	defer sourceClient.Close()

	// Connect to target MinIO
	targetClient, err := filesync.NewMinIOClient(targetConfig)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to connect to target MinIO")
		sendMirrorResponse(conn, jobID, logID, nil, err.Error(), false)
		return
	}
	defer targetClient.Close()

	logger.Logger.Info().
		Str("job", jobName).
		Msg("Connected to source and target MinIO, starting mirror")

	if watchMode {
		// Watch mode: continuous sync
		stopChan := make(chan struct{})

		// Send initial running status
		sendMirrorResponse(conn, jobID, logID, &filesync.MirrorStats{}, "", true)

		// Start watch in separate goroutine (will run until stopped)
		go func() {
			err := sourceClient.WatchAndMirror(targetClient, mirrorOpts, stopChan, func(event, objectKey string) {
				logger.Logger.Info().
					Str("event", event).
					Str("object", objectKey).
					Msg("Mirror watch event")
			})
			if err != nil {
				logger.Logger.Error().Err(err).Msg("Watch mirror failed")
			}
		}()

		// For now, run for job duration (scheduled job will complete when done)
		// In production, this would be managed by agent lifecycle
		logger.Logger.Info().Msg("Watch mode started, running continuous sync")
	} else {
		// One-time mirror
		stats, err := sourceClient.MirrorTo(targetClient, mirrorOpts, func(copied, skipped int64, currentObject string) {
			logger.Logger.Debug().
				Int64("copied", copied).
				Int64("skipped", skipped).
				Str("current", currentObject).
				Msg("Mirror progress")
		})

		if err != nil {
			logger.Logger.Error().Err(err).Msg("Mirror operation failed")
			sendMirrorResponse(conn, jobID, logID, nil, err.Error(), false)
			return
		}

		logger.Logger.Info().
			Str("job", jobName).
			Int64("objects_copied", stats.ObjectsCopied).
			Int64("objects_skipped", stats.ObjectsSkipped).
			Int64("bytes_copied", stats.BytesCopied).
			Int("errors", len(stats.Errors)).
			Msg("MinIO mirror completed")

		sendMirrorResponse(conn, jobID, logID, stats, "", false)
	}
}

// sendMirrorResponse sends mirror job response back to master
func sendMirrorResponse(conn net.Conn, jobID, logID uint, stats *filesync.MirrorStats, errorMsg string, isPartial bool) {
	status := "completed"
	if errorMsg != "" {
		status = "failed"
	} else if isPartial {
		status = "running"
	}

	data := map[string]interface{}{
		"job_id":  jobID,
		"log_id":  logID,
		"status":  status,
		"partial": isPartial,
		"type":    "mirror",
	}

	if stats != nil {
		data["objects_copied"] = stats.ObjectsCopied
		data["objects_skipped"] = stats.ObjectsSkipped
		data["bytes_copied"] = stats.BytesCopied
		data["record_count"] = int(stats.ObjectsCopied) // For compatibility with JobLog
		if len(stats.Errors) > 0 {
			data["mirror_errors"] = stats.Errors
		}
	}

	if errorMsg != "" {
		data["error"] = errorMsg
	}

	response := AgentMessage{
		Type:      "DATA_RESPONSE",
		AgentName: AgentName,
		Status:    status,
		Timestamp: time.Now(),
		Data:      data,
	}

	respBytes, _ := json.Marshal(response)
	respBytes = append(respBytes, '\n')

	connMu.Lock()
	conn.Write(respBytes)
	connMu.Unlock()
}

// executeAPISyncJob handles REST API based sync jobs
func executeAPISyncJob(conn net.Conn, msg AgentMessage, jobID, logID uint, jobName string) {
	logger.Logger.Info().
		Uint("job_id", jobID).
		Str("job", jobName).
		Msg("Starting API sync job")

	// Extract API config from message
	apiConfig := filesync.APIConfig{}
	if cfg, ok := msg.Data["api_config"].(map[string]interface{}); ok {
		if url, ok := cfg["url"].(string); ok {
			apiConfig.URL = url
		}
		if method, ok := cfg["method"].(string); ok {
			apiConfig.Method = method
		}
		if authType, ok := cfg["auth_type"].(string); ok {
			apiConfig.AuthType = authType
		}
		if authKey, ok := cfg["auth_key"].(string); ok {
			apiConfig.AuthKey = authKey
		}
		if authValue, ok := cfg["auth_value"].(string); ok {
			apiConfig.AuthValue = authValue
		}
		if body, ok := cfg["body"].(string); ok {
			apiConfig.Body = body
		}
		// Parse headers JSON string
		if headersStr, ok := cfg["headers"].(string); ok && headersStr != "" {
			var headers map[string]string
			if err := json.Unmarshal([]byte(headersStr), &headers); err == nil {
				apiConfig.Headers = headers
			}
		}
	}

	// Validate URL
	if apiConfig.URL == "" {
		err := fmt.Errorf("API URL is not configured")
		logger.Logger.Error().Msg(err.Error())
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}

	logger.Logger.Info().
		Str("url", apiConfig.URL).
		Str("method", apiConfig.Method).
		Str("auth_type", apiConfig.AuthType).
		Bool("has_body", apiConfig.Body != "").
		Msg("Fetching data from API")

	// Create API client and fetch data
	client := filesync.NewAPIClient()
	data, err := client.FetchAPI(apiConfig)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to fetch API data")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}

	logger.Logger.Info().
		Int("response_size", len(data)).
		Msg("API response received, parsing JSON")

	// Parse JSON response
	records, err := filesync.ParseAPIResponse(data)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to parse API response")
		sendDataResponse(conn, jobID, logID, nil, 0, err.Error(), false)
		return
	}

	logger.Logger.Info().
		Str("job", jobName).
		Int("total_records", len(records)).
		Msg("API data parsed successfully")

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

	// Send final completion if needed
	if len(records) == 0 {
		sendDataResponse(conn, jobID, logID, nil, 0, "", false)
	} else if len(records)%batchSize == 0 {
		sendDataResponse(conn, jobID, logID, nil, 0, "", false)
	}
}

// executeFileSyncJob handles FTP/SFTP file sync jobs
func executeFileSyncJob(conn net.Conn, msg AgentMessage, jobID, logID uint, jobName, sourceType string) {
	// Get FTP config
	ftpConfig := filesync.FTPConfig{}
	privateKey := ""

	// Debug: Log raw ftp_config
	logger.Logger.Debug().Interface("ftp_config_raw", msg.Data["ftp_config"]).Msg("Received ftp_config")

	if cfg, ok := msg.Data["ftp_config"].(map[string]interface{}); ok {
		if host, ok := cfg["host"].(string); ok {
			ftpConfig.Host = host
		}
		// Port can be string or float64 (from JSON)
		if port, ok := cfg["port"].(string); ok {
			ftpConfig.Port = port
		} else if portNum, ok := cfg["port"].(float64); ok {
			ftpConfig.Port = fmt.Sprintf("%.0f", portNum)
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

		// Debug log extracted values
		logger.Logger.Info().
			Str("host", ftpConfig.Host).
			Str("port", ftpConfig.Port).
			Str("user", ftpConfig.User).
			Bool("has_password", ftpConfig.Password != "").
			Int("password_len", len(ftpConfig.Password)).
			Bool("has_private_key", privateKey != "").
			Int("private_key_len", len(privateKey)).
			Msg("Extracted FTP config values")
	} else {
		logger.Logger.Error().Msg("ftp_config is not a valid map or is missing!")
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
		Bool("has_private_key", privateKey != "").
		Bool("has_password", ftpConfig.Password != "").
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

// sendCsvDataResponse sends data back to master in raw CSV format
func sendCsvDataResponse(conn net.Conn, jobID, logID uint, csvRecords string, columns []string, recordCount int, errorMsg string, isPartial bool) {
	status := "completed"
	if errorMsg != "" {
		status = "failed"
	} else if isPartial {
		status = "running"
	}

	// Make columns an interface slice for msgpack/json
	var columnsInterface []interface{}
	for _, c := range columns {
		columnsInterface = append(columnsInterface, c)
	}

	response := AgentMessage{
		Type:      "DATA_RESPONSE", // Keep same type for retro-compat, but different payload
		AgentName: AgentName,
		Status:    status,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"job_id":       jobID,
			"log_id":       logID,
			"status":       status,
			"record_count": recordCount,
			"csv_records":  csvRecords,
			"csv_columns":  columnsInterface,
			"error":        errorMsg,
			"partial":      isPartial,
		},
	}

	if err := sendMessage(conn, response); err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to send CSV data response")
	} else {
		logger.Logger.Info().
			Uint("job_id", jobID).
			Int("records", recordCount).
			Str("status", status).
			Bool("partial", isPartial).
			Msg("CSV Data response sent to Master")
	}
}

func reconnect() (net.Conn, error) {
	logger.Logger.Warn().Msg("Connection lost. Attempting to reconnect to Master server...")

	attempt := 1
	for {
		logger.Logger.Info().Int("attempt", attempt).Msg("Reconnection attempt")

		conn, err := connectToMaster()
		if err == nil {
			if err := registerAgent(conn); err == nil {
				logger.Logger.Info().Msg("Reconnection successful")
				return conn, nil
			} else {
				logger.Logger.Error().Err(err).Msg("Connected but failed to register")
				conn.Close()
			}
		} else {
			logger.Logger.Error().Err(err).Msg("Failed to connect to master")
		}

		// Backoff algorithm (max 30 seconds pause to prevent spamming)
		sleepDuration := time.Duration(attempt*2) * time.Second
		if sleepDuration > 30*time.Second {
			sleepDuration = 30 * time.Second
		}

		logger.Logger.Info().Stringer("wait", sleepDuration).Msg("Waiting before next reconnect attempt...")
		time.Sleep(sleepDuration)
		attempt++
	}
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
	case "minio":
		testMinIOConnection(msg, &response, startTime)
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

	connMu.Lock()
	_, err = conn.Write(data)
	connMu.Unlock()

	if err != nil {
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

// testMinIOConnection tests MinIO/S3 connection
func testMinIOConnection(msg AgentMessage, response *AgentMessage, startTime time.Time) {
	// Extract MinIO config
	minioConfig := filesync.MinIOConfig{}
	if cfg, ok := msg.Data["minio_config"].(map[string]interface{}); ok {
		if endpoint, ok := cfg["endpoint"].(string); ok {
			minioConfig.Endpoint = endpoint
		}
		if accessKey, ok := cfg["access_key"].(string); ok {
			minioConfig.AccessKeyID = accessKey
		}
		if secretKey, ok := cfg["secret_key"].(string); ok {
			minioConfig.SecretAccessKey = secretKey
		}
		if bucket, ok := cfg["bucket"].(string); ok {
			minioConfig.BucketName = bucket
		}
		if objectPath, ok := cfg["object_path"].(string); ok {
			minioConfig.ObjectPath = objectPath
		}
		if useSSL, ok := cfg["use_ssl"].(bool); ok {
			minioConfig.UseSSL = useSSL
		}
		if region, ok := cfg["region"].(string); ok {
			minioConfig.Region = region
		}
	}

	logger.Logger.Debug().
		Str("endpoint", minioConfig.Endpoint).
		Str("bucket", minioConfig.BucketName).
		Bool("use_ssl", minioConfig.UseSSL).
		Msg("Testing MinIO connection")

	// Validate config
	if minioConfig.Endpoint == "" || minioConfig.BucketName == "" {
		errMsg := "MinIO config missing required fields (endpoint or bucket)"
		logger.Logger.Error().Msg(errMsg)
		response.Data["success"] = false
		response.Data["error"] = errMsg
		response.Data["duration"] = time.Since(startTime).Milliseconds()
		return
	}

	// Try to connect
	client, err := filesync.NewMinIOClient(minioConfig)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		logger.Logger.Error().Err(err).Msg("Test MinIO connection failed")
		response.Data["success"] = false
		response.Data["error"] = fmt.Sprintf("MinIO connection failed: %v", err)
		response.Data["duration"] = duration
		return
	}
	defer client.Close()

	// Test bucket access
	if err := client.TestConnection(); err != nil {
		duration = time.Since(startTime).Milliseconds()
		logger.Logger.Error().Err(err).Msg("Test MinIO bucket access failed")
		response.Data["success"] = false
		response.Data["error"] = fmt.Sprintf("MinIO connected but bucket check failed: %v", err)
		response.Data["duration"] = duration
		return
	}

	duration = time.Since(startTime).Milliseconds()
	logger.Logger.Info().
		Str("endpoint", minioConfig.Endpoint).
		Str("bucket", minioConfig.BucketName).
		Int64("duration_ms", duration).
		Msg("Test MinIO connection successful")

	response.Data["success"] = true
	response.Data["message"] = "MinIO connection successful"
	response.Data["duration"] = duration
	response.Data["endpoint"] = minioConfig.Endpoint
	response.Data["bucket"] = minioConfig.BucketName
}

// executeRemoteCommand handles EXEC_COMMAND from master terminal console
func executeRemoteCommand(conn net.Conn, msg AgentMessage) {
	logger.Logger.Info().Msg("Executing remote command from Master Terminal Console")

	startTime := time.Now()

	// Extract command and timeout from message
	command := ""
	if cmd, ok := msg.Data["command"].(string); ok {
		command = cmd
	}

	timeout := 30 // Default timeout in seconds
	if t, ok := msg.Data["timeout"].(float64); ok {
		timeout = int(t)
	}

	requestID := uint(0)
	if id, ok := msg.Data["request_id"].(float64); ok {
		requestID = uint(id)
	}

	logger.Logger.Info().
		Str("command", command).
		Int("timeout", timeout).
		Uint("request_id", requestID).
		Msg("Executing command")

	// Prepare response
	response := AgentMessage{
		Type:      "EXEC_COMMAND_RESULT",
		AgentName: AgentName,
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"request_id": requestID,
		},
	}

	if command == "" {
		response.Data["success"] = false
		response.Data["error"] = "Command is empty"
		response.Data["exit_code"] = -1
		sendMessage(conn, response)
		return
	}

	// Execute command based on OS
	var cmd *exec.Cmd
	if isWindows() {
		// Windows: use cmd.exe /c
		cmd = exec.Command("cmd", "/c", command)
	} else {
		// Unix/Linux: use sh -c
		cmd = exec.Command("sh", "-c", command)
	}

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
	defer cancel()

	// Capture stdout and stderr together
	var output strings.Builder
	cmd.Stdout = &output
	cmd.Stderr = &output

	// Start command
	err := cmd.Start()
	if err != nil {
		duration := time.Since(startTime).Milliseconds()
		response.Data["success"] = false
		response.Data["error"] = fmt.Sprintf("Failed to start command: %v", err)
		response.Data["exit_code"] = -1
		response.Data["duration"] = duration
		sendMessage(conn, response)
		return
	}

	// Wait for command with timeout
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	var exitCode int
	var errorMsg string

	select {
	case <-ctx.Done():
		// Timeout - kill the process
		cmd.Process.Kill()
		exitCode = -1
		errorMsg = fmt.Sprintf("Command timed out after %d seconds", timeout)
		logger.Logger.Warn().Str("command", command).Int("timeout", timeout).Msg("Command timed out")
	case err := <-done:
		if err != nil {
			// Get exit code if available
			if exitErr, ok := err.(*exec.ExitError); ok {
				exitCode = exitErr.ExitCode()
			} else {
				exitCode = -1
			}
			errorMsg = err.Error()
		} else {
			exitCode = 0
		}
	}

	duration := time.Since(startTime).Milliseconds()

	// Prepare response
	response.Data["success"] = exitCode == 0
	response.Data["output"] = output.String()
	response.Data["exit_code"] = exitCode
	response.Data["duration"] = duration
	if errorMsg != "" {
		response.Data["error"] = errorMsg
	}

	logger.Logger.Info().
		Str("command", command).
		Int("exit_code", exitCode).
		Int64("duration_ms", duration).
		Int("output_len", len(output.String())).
		Msg("Command execution completed")

	// Send response back to master
	if err := sendMessage(conn, response); err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to send command result to Master")
	}
}

// isWindows checks if running on Windows
func isWindows() bool {
	return strings.Contains(strings.ToLower(os.Getenv("OS")), "windows") ||
		strings.Contains(strings.ToLower(os.Getenv("GOOS")), "windows")
}
