package server

import (
	"dsp-platform/internal/auth"
	"dsp-platform/internal/core"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Handler manages HTTP request handling
type Handler struct {
	db            *gorm.DB
	agents        map[string]*core.Network // In-memory agent tracking
	agentListener *AgentListener           // Reference to agent listener for commands
}

// NewHandler creates a new handler instance
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		db:     db,
		agents: make(map[string]*core.Network),
	}
}

// Login handles user authentication
func (h *Handler) Login(c *gin.Context) {
	var req core.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Mock authentication - in production, check against database with hashed password
	var user core.User
	if err := h.db.Where("username = ? AND password = ?", req.Username, req.Password).First(&user).Error; err != nil {
		// If user doesn't exist, create a default admin for demo purposes
		if err == gorm.ErrRecordNotFound && req.Username == "admin" && req.Password == "admin" {
			user = core.User{Username: "admin", Password: "admin"}
			h.db.Create(&user)
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}
	}

	// Generate JWT token
	token, err := auth.GenerateToken(user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, core.LoginResponse{
		Token:    token,
		Username: user.Username,
	})
}

// GetSchemas returns all schemas
func (h *Handler) GetSchemas(c *gin.Context) {
	var schemas []core.Schema
	if err := h.db.Find(&schemas).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas)
}

// CreateSchema creates a new schema
func (h *Handler) CreateSchema(c *gin.Context) {
	var schema core.Schema
	if err := c.ShouldBindJSON(&schema); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Create(&schema).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, schema)
}

// UpdateSchema updates an existing schema
func (h *Handler) UpdateSchema(c *gin.Context) {
	id := c.Param("id")
	var schema core.Schema

	if err := h.db.First(&schema, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Schema not found"})
		return
	}

	if err := c.ShouldBindJSON(&schema); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Save(&schema).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schema)
}

// DeleteSchema deletes a schema
func (h *Handler) DeleteSchema(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Delete(&core.Schema{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Schema deleted successfully"})
}

// GetNetworks returns all networks (agents/sources)
func (h *Handler) GetNetworks(c *gin.Context) {
	var networks []core.Network
	if err := h.db.Find(&networks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, networks)
}

// CreateNetwork creates a new network entry
func (h *Handler) CreateNetwork(c *gin.Context) {
	var network core.Network
	if err := c.ShouldBindJSON(&network); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Create(&network).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, network)
}

// UpdateNetwork updates an existing network
func (h *Handler) UpdateNetwork(c *gin.Context) {
	id := c.Param("id")
	var network core.Network

	if err := h.db.First(&network, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Network not found"})
		return
	}

	if err := c.ShouldBindJSON(&network); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Save(&network).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, network)
}

// DeleteNetwork deletes a network
func (h *Handler) DeleteNetwork(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Delete(&core.Network{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Network deleted successfully"})
}

// GetJobs returns all jobs
func (h *Handler) GetJobs(c *gin.Context) {
	var jobs []core.Job
	if err := h.db.Preload("Schema").Preload("Network").Find(&jobs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, jobs)
}

// CreateJob creates a new job
func (h *Handler) CreateJob(c *gin.Context) {
	var job core.Job
	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Create(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, job)
}

// UpdateJob updates an existing job
func (h *Handler) UpdateJob(c *gin.Context) {
	id := c.Param("id")
	var job core.Job

	if err := h.db.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
		return
	}

	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Save(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, job)
}

// DeleteJob deletes a job
func (h *Handler) DeleteJob(c *gin.Context) {
	id := c.Param("id")
	if err := h.db.Delete(&core.Job{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Job deleted successfully"})
}

// RunJob executes a job by sending command to the connected agent
func (h *Handler) RunJob(c *gin.Context) {
	id := c.Param("id")
	var job core.Job

	if err := h.db.Preload("Schema").Preload("Network").First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
		return
	}

	// Update job status to running
	job.Status = "running"
	job.LastRun = time.Now()
	h.db.Save(&job)

	// Create job log entry
	jobLog := core.JobLog{
		JobID:     job.ID,
		Status:    "running",
		StartedAt: time.Now(),
	}
	h.db.Create(&jobLog)

	// Check if agent is connected
	agentName := job.Network.Name
	if h.agentListener == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Agent listener not initialized"})
		return
	}

	conn := h.agentListener.GetConnection(agentName)
	if conn == nil {
		// Agent not connected - update status and return error
		job.Status = "failed"
		h.db.Save(&job)
		jobLog.Status = "failed"
		jobLog.ErrorMessage = fmt.Sprintf("Agent '%s' is not connected", agentName)
		jobLog.CompletedAt = time.Now()
		h.db.Save(&jobLog)

		c.JSON(http.StatusBadRequest, gin.H{
			"error":  fmt.Sprintf("Agent '%s' is not connected. Make sure the agent is running.", agentName),
			"job":    job,
			"log_id": jobLog.ID,
		})
		return
	}

	// Send RUN_JOB command to agent
	command := core.AgentMessage{
		Type:      "RUN_JOB",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"job_id":       job.ID,
			"log_id":       jobLog.ID,
			"name":         job.Name,
			"query":        job.Schema.SQLCommand,
			"target_table": job.Schema.TargetTable,
		},
	}

	if err := h.agentListener.SendCommandToAgent(agentName, command); err != nil {
		job.Status = "failed"
		h.db.Save(&job)
		jobLog.Status = "failed"
		jobLog.ErrorMessage = fmt.Sprintf("Failed to send command to agent: %v", err)
		jobLog.CompletedAt = time.Now()
		h.db.Save(&jobLog)

		c.JSON(http.StatusInternalServerError, gin.H{
			"error":  fmt.Sprintf("Failed to send command to agent: %v", err),
			"job":    job,
			"log_id": jobLog.ID,
		})
		return
	}

	log.Printf("Sent RUN_JOB command to agent %s for job %d", agentName, job.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Job %d command sent to agent %s", job.ID, agentName),
		"job":     job,
		"log_id":  jobLog.ID,
	})
}

// GetJob returns a single job with its recent logs
func (h *Handler) GetJob(c *gin.Context) {
	id := c.Param("id")
	var job core.Job

	if err := h.db.Preload("Schema").Preload("Network").First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
		return
	}

	// Get recent logs for this job
	var logs []core.JobLog
	h.db.Where("job_id = ?", id).Order("created_at DESC").Limit(10).Find(&logs)

	c.JSON(http.StatusOK, gin.H{
		"job":  job,
		"logs": logs,
	})
}

// GetJobLogs returns execution logs for a specific job
func (h *Handler) GetJobLogs(c *gin.Context) {
	id := c.Param("id")

	var logs []core.JobLog
	if err := h.db.Where("job_id = ?", id).Order("created_at DESC").Limit(50).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, logs)
}

// UpdateAgentStatus updates agent status from listener
func (h *Handler) UpdateAgentStatus(agentName, status, ipAddress string) {
	var network core.Network

	// Find or create network entry for this agent
	if err := h.db.Where("name = ?", agentName).First(&network).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			network = core.Network{
				Name:      agentName,
				IPAddress: ipAddress,
				Status:    status,
				Type:      "source",
				LastSeen:  time.Now(),
			}
			h.db.Create(&network)
		}
	} else {
		network.Status = status
		network.LastSeen = time.Now()
		network.IPAddress = ipAddress
		h.db.Save(&network)
	}

	h.agents[agentName] = &network
	log.Printf("Agent %s status updated: %s", agentName, status)
}

// GetAgentJobs returns jobs assigned to a specific agent
func (h *Handler) GetAgentJobs(c *gin.Context) {
	agentName := c.Param("name")

	var jobs []core.Job
	// Get all jobs for this agent/network with schema and network details
	if err := h.db.Preload("Schema").Preload("Network").
		Joins("JOIN networks ON jobs.network_id = networks.id").
		Where("networks.name = ?", agentName).
		Find(&jobs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Format response with job details
	var response []map[string]interface{}
	for _, job := range jobs {
		response = append(response, map[string]interface{}{
			"job_id":       job.ID,
			"name":         job.Name,
			"schedule":     job.Schedule,
			"query":        job.Schema.SQLCommand,
			"target_table": job.Schema.TargetTable,
			"status":       job.Status,
		})
	}

	log.Printf("Agent %s requested jobs: %d jobs found", agentName, len(response))
	c.JSON(http.StatusOK, response)
}

// GetConnectedAgents returns list of currently connected agents
func (h *Handler) GetConnectedAgents(c *gin.Context) {
	if h.agentListener == nil {
		c.JSON(http.StatusOK, []string{})
		return
	}
	agents := h.agentListener.GetConnectedAgents()
	c.JSON(http.StatusOK, gin.H{"connected_agents": agents})
}
