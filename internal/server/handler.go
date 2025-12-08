package server

import (
	"dsp-platform/internal/auth"
	"dsp-platform/internal/core"
	"encoding/json"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// Handler manages HTTP request handling
type Handler struct {
	db     *gorm.DB
	agents map[string]*core.Network // In-memory agent tracking
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

// RunJob executes a job manually
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

	// Execute job in goroutine for async processing
	go func(j core.Job, logID uint) {
		startTime := time.Now()
		log.Printf("Executing job %d: %s", j.ID, j.Name)
		log.Printf("Schema: %s", j.Schema.SQLCommand)
		log.Printf("Network: %s (%s)", j.Network.Name, j.Network.IPAddress)

		// Simulate job execution with some sample data
		time.Sleep(time.Duration(2+rand.Intn(3)) * time.Second)

		// Generate sample data for preview
		sampleRecords := []map[string]interface{}{
			{"id": 1, "name": "Sample Record 1", "created_at": time.Now().Add(-24 * time.Hour).Format(time.RFC3339)},
			{"id": 2, "name": "Sample Record 2", "created_at": time.Now().Add(-12 * time.Hour).Format(time.RFC3339)},
			{"id": 3, "name": "Sample Record 3", "created_at": time.Now().Format(time.RFC3339)},
		}
		sampleJSON, _ := json.Marshal(sampleRecords)
		recordCount := 10 + rand.Intn(90) // Random 10-99 records

		// Update job log with completion details
		duration := time.Since(startTime).Milliseconds()
		var jLog core.JobLog
		h.db.First(&jLog, logID)
		jLog.Status = "completed"
		jLog.CompletedAt = time.Now()
		jLog.Duration = duration
		jLog.RecordCount = recordCount
		jLog.SampleData = string(sampleJSON)
		h.db.Save(&jLog)

		// Update job status to completed
		j.Status = "completed"
		h.db.Save(&j)
		log.Printf("Job %d completed in %dms, synced %d records", j.ID, duration, recordCount)
	}(job, jobLog.ID)

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Job %d started", job.ID),
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
