package main

import (
	"bufio"
	"dsp-platform/internal/database"
	"dsp-platform/internal/logger"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/signal"
	"strconv"
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

// JobConfig represents a job configuration from master
type JobConfig struct {
	JobID       uint   `json:"job_id"`
	Name        string `json:"name"`
	Schedule    string `json:"schedule"`
	Query       string `json:"query"`
	TargetTable string `json:"target_table"`
	NextRun     time.Time
}

var heartbeatCount int
var activeJobs []JobConfig
var configReceived bool

func init() {
	// Load .env file (optional)
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

func main() {
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

	// Request job configuration
	if err := pullJobConfig(conn); err != nil {
		logger.Logger.Warn().Err(err).Msg("Failed to pull job config, will use legacy sync")
	}

	// Wait a bit for config response
	time.Sleep(2 * time.Second)

	// Setup signal handling
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	// Setup tickers
	heartbeatTicker := time.NewTicker(5 * time.Second)
	defer heartbeatTicker.Stop()

	// Job execution ticker (check every 10 seconds)
	jobTicker := time.NewTicker(10 * time.Second)
	defer jobTicker.Stop()

	var syncTicker *time.Ticker
	if SyncEnabled && len(activeJobs) == 0 {
		// Use legacy sync only if no jobs configured
		syncTicker = time.NewTicker(SyncInterval)
		defer syncTicker.Stop()
		logger.Logger.Info().Msg("Using legacy .env sync configuration")
	}

	// Listen for responses from Master in goroutine
	go listenForResponses(conn)

	// Main loop
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

		case <-jobTicker.C:
			if len(activeJobs) > 0 {
				executeJobs(conn)
			}

		case <-func() <-chan time.Time {
			if syncTicker != nil {
				return syncTicker.C
			}
			return make(chan time.Time) // never triggers
		}():
			if SyncEnabled && len(activeJobs) == 0 {
				// Legacy sync
				if err := syncData(conn); err != nil {
					logger.Logger.Error().Err(err).Msg("Data sync failed")
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

func syncData(conn net.Conn) error {
	logger.Logger.Info().Msg("Starting data sync")

	// Connect to source database
	dbConn, err := database.Connect(DBConfig)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to connect to source database")
		return err
	}
	defer dbConn.Close()

	// Execute query
	data, err := dbConn.ExecuteQuery(SyncQuery)
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to execute sync query")
		return err
	}

	logger.Logger.Info().Int("rows", len(data)).Msg("Data fetched successfully")

	// Send data to master
	msg := AgentMessage{
		Type:      "DATA_SYNC",
		AgentName: AgentName,
		Status:    "success",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"query":        SyncQuery,
			"record_count": len(data),
			"records":      data,
		},
	}

	if err := sendMessage(conn, msg); err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to send sync data")
		return err
	}

	logger.Logger.Info().Msg("Data sync completed successfully")
	return nil
}

func pullJobConfig(conn net.Conn) error {
	logger.Logger.Info().Msg("Requesting job configuration from Master")

	msg := AgentMessage{
		Type:      "CONFIG_PULL",
		AgentName: AgentName,
		Timestamp: time.Now(),
	}

	return sendMessage(conn, msg)
}

func executeJobs(conn net.Conn) {
	for i := range activeJobs {
		job := &activeJobs[i]

		if time.Now().After(job.NextRun) || time.Now().Equal(job.NextRun) {
			logger.Logger.Info().
				Str("job", job.Name).
				Str("schedule", job.Schedule).
				Msg("Executing scheduled job")

			if err := executeJob(conn, job); err != nil {
				logger.Logger.Error().
					Err(err).
					Str("job", job.Name).
					Msg("Job execution failed")
			}

			// Update next run time
			job.NextRun = calculateNextRun(job.Schedule)
			logger.Logger.Debug().
				Str("job", job.Name).
				Time("next_run", job.NextRun).
				Msg("Scheduled next run")
		}
	}
}

func executeJob(conn net.Conn, job *JobConfig) error {
	// Connect to DB
	dbConn, err := database.Connect(DBConfig)
	if err != nil {
		return fmt.Errorf("database connection failed: %w", err)
	}
	defer dbConn.Close()

	// Execute job query
	data, err := dbConn.ExecuteQuery(job.Query)
	if err != nil {
		return fmt.Errorf("query execution failed: %w", err)
	}

	logger.Logger.Info().
		Str("job", job.Name).
		Int("rows", len(data)).
		Msg("Data fetched successfully")

	// Send to master
	msg := AgentMessage{
		Type:      "DATA_SYNC",
		AgentName: AgentName,
		Status:    "success",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"job_id":       job.JobID,
			"job_name":     job.Name,
			"target_table": job.TargetTable,
			"query":        job.Query,
			"record_count": len(data),
			"records":      data,
		},
	}

	if err := sendMessage(conn, msg); err != nil {
		return fmt.Errorf("failed to send sync data: %w", err)
	}

	logger.Logger.Info().Str("job", job.Name).Msg("Job completed successfully")
	return nil
}

func parseJobs(data []interface{}) []JobConfig {
	var jobs []JobConfig
	for _, item := range data {
		jobMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		job := JobConfig{
			JobID:       uint(jobMap["job_id"].(float64)),
			Name:        jobMap["name"].(string),
			Schedule:    jobMap["schedule"].(string),
			Query:       jobMap["query"].(string),
			TargetTable: jobMap["target_table"].(string),
		}

		// Calculate next run based on schedule
		job.NextRun = calculateNextRun(job.Schedule)

		logger.Logger.Info().
			Str("job", job.Name).
			Str("schedule", job.Schedule).
			Time("next_run", job.NextRun).
			Msg("Job loaded")

		jobs = append(jobs, job)
	}
	return jobs
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

func listenForResponses(conn net.Conn) {
	scanner := bufio.NewScanner(conn)
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
			if jobs, ok := msg.Data["jobs"].([]interface{}); ok {
				activeJobs = parseJobs(jobs)
				logger.Logger.Info().
					Int("job_count", len(activeJobs)).
					Msg("Job configuration loaded from Master")
			}

		case "COMMAND":
			// Handle commands from master (future feature)
			logger.Logger.Info().Msg("Received command from Master")
		default:
			logger.Logger.Warn().Str("type", msg.Type).Msg("Unknown message type")
		}
	}

	if err := scanner.Err(); err != nil {
		logger.Logger.Error().Err(err).Msg("Error reading from Master")
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
