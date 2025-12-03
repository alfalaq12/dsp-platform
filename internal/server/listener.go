package server

import (
	"bufio"
	"dsp-platform/internal/core"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"time"
)

// AgentListener handles TCP connections from Tenant Agents on port 447
type AgentListener struct {
	handler *Handler
	port    string
}

// NewAgentListener creates a new agent listener
func NewAgentListener(handler *Handler, port string) *AgentListener {
	return &AgentListener{
		handler: handler,
		port:    port,
	}
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
	defer conn.Close()

	clientAddr := conn.RemoteAddr().String()
	log.Printf("New agent connection from %s", clientAddr)

	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		data := scanner.Bytes()

		var msg core.AgentMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			log.Printf("Failed to parse agent message: %v", err)
			continue
		}

		al.processMessage(msg, clientAddr, conn)
	}

	if err := scanner.Err(); err != nil {
		log.Printf("Connection error from %s: %v", clientAddr, err)
	}

	log.Printf("Agent disconnected: %s", clientAddr)
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
	case "CONFIG_PULL":
		al.handleConfigPull(msg, conn)
	default:
		log.Printf("Unknown message type: %s", msg.Type)
	}
}

// handleRegister processes agent registration
func (al *AgentListener) handleRegister(msg core.AgentMessage, clientAddr string, conn net.Conn) {
	al.handler.UpdateAgentStatus(msg.AgentName, "online", clientAddr)

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

// handleDataPush processes data pushed from agents
func (al *AgentListener) handleDataPush(msg core.AgentMessage, clientAddr string) {
	log.Printf("Data received from %s: %v", msg.AgentName, msg.Data)

	// In production, you would process and store this data
	// For now, we just log it
	al.handler.UpdateAgentStatus(msg.AgentName, "online", clientAddr)
}

// handleConfigPull sends configuration to requesting agents
func (al *AgentListener) handleConfigPull(msg core.AgentMessage, conn net.Conn) {
	// In production, fetch actual configuration from database
	response := core.AgentMessage{
		Type:      "CONFIG_RESPONSE",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"sync_interval": 60,
			"schemas":       []string{},
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
