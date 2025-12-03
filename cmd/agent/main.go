package main

import (
	"bufio"
	"dsp-platform/internal/logger"
	"encoding/json"
	"fmt"
	"net"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const (
	MasterHost = "localhost"
	MasterPort = "447"
	AgentName  = "tenant-1"
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

func main() {
	// Initialize logger
	if err := logger.Init(logger.DefaultConfig()); err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}

	logger.Logger.Info().
		Str("agent_name", AgentName).
		Str("master", MasterHost+":"+MasterPort).
		Msg("Starting Tenant Agent")

	// Connect to Master server
	conn, err := connectToMaster()
	if err != nil {
		logger.Logger.Fatal().Err(err).Msg("Failed to connect to master")
	}
	defer conn.Close()

	// Register with Master
	if err := registerAgent(conn); err != nil {
		logger.Logger.Fatal().Err(err).Msg("Failed to register agent")
	}

	// Start heartbeat in goroutine
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	// Listen for responses from Master
	go listenForResponses(conn)

	for {
		select {
		case <-ticker.C:
			if err := sendHeartbeat(conn); err != nil {
				logger.Logger.Error().Err(err).Msg("Failed to send heartbeat, attempting reconnect")
				// Try to reconnect
				conn, err = reconnect()
				if err != nil {
					logger.Logger.Fatal().Err(err).Msg("Failed to reconnect after multiple attempts")
				}
			}
		case <-quit:
			logger.Logger.Info().Msg("Received shutdown signal, closing agent")
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

// connectToMaster establishes connection to the Master server
func connectToMaster() (net.Conn, error) {
	address := fmt.Sprintf("%s:%s", MasterHost, MasterPort)
	logger.Logger.Info().Str("address", address).Msg("Connecting to Master server")

	conn, err := net.Dial("tcp", address)
	if err != nil {
		logger.Logger.Error().Err(err).Str("address", address).Msg("Connection failed")
		return nil, err
	}

	logger.Logger.Info().Msg("Successfully connected to Master server")
	return conn, nil
}

// registerAgent sends registration message to Master
func registerAgent(conn net.Conn) error {
	msg := AgentMessage{
		Type:      "REGISTER",
		AgentName: AgentName,
		Status:    "online",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"version": "1.0.0",
			"os":      "linux",
		},
	}

	logger.Logger.Info().Str("agent", AgentName).Msg("Registering agent with Master")
	return sendMessage(conn, msg)
}

// sendHeartbeat sends periodic heartbeat to Master
func sendHeartbeat(conn net.Conn) error {
	heartbeatCount++

	msg := AgentMessage{
		Type:      "HEARTBEAT",
		AgentName: AgentName,
		Status:    "online",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"cpu_usage":    45.2,
			"memory_usage": 62.8,
		},
	}

	// Log every 10th heartbeat to reduce noise
	if heartbeatCount%10 == 0 {
		logger.Logger.Debug().
			Int("count", heartbeatCount).
			Msg("Sending heartbeat to Master")
	}

	return sendMessage(conn, msg)
}

// sendMessage sends a JSON message to the Master
func sendMessage(conn net.Conn, msg AgentMessage) error {
	data, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	data = append(data, '\n')
	_, err = conn.Write(data)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	return nil
}

// listenForResponses listens for messages from Master
func listenForResponses(conn net.Conn) {
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		data := scanner.Bytes()

		var msg AgentMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			logger.Logger.Warn().Err(err).Msg("Failed to parse response from Master")
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
			logger.Logger.Info().Interface("config", msg.Data).Msg("Configuration received")
		default:
			logger.Logger.Warn().Str("type", msg.Type).Msg("Unknown message type received")
		}
	}

	if err := scanner.Err(); err != nil {
		logger.Logger.Error().Err(err).Msg("Connection error with Master")
	}
}

// reconnect attempts to reconnect to the Master
func reconnect() (net.Conn, error) {
	logger.Logger.Warn().Msg("Attempting to reconnect to Master server")

	for i := 0; i < 5; i++ {
		logger.Logger.Info().Int("attempt", i+1).Msg("Reconnection attempt")

		conn, err := connectToMaster()
		if err == nil {
			logger.Logger.Info().Msg("Reconnection successful")
			registerAgent(conn)
			return conn, nil
		}

		logger.Logger.Warn().
			Err(err).
			Int("attempt", i+1).
			Msg("Reconnection failed, retrying in 5 seconds")
		time.Sleep(5 * time.Second)
	}

	logger.Logger.Error().Msg("Failed to reconnect after 5 attempts")
	return nil, fmt.Errorf("failed to reconnect after 5 attempts")
}
