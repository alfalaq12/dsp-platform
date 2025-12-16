package server

import (
	"dsp-platform/internal/auth"
	"dsp-platform/internal/core"
	"dsp-platform/internal/database"
	"dsp-platform/internal/license"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
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

	var user core.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		// Check if auto-create admin is enabled (default: true for backwards compatibility)
		autoCreateAdmin := os.Getenv("AUTO_CREATE_ADMIN") != "false"

		// If user doesn't exist, create a default admin for demo/initial setup
		if err == gorm.ErrRecordNotFound && req.Username == "admin" && req.Password == "admin" && autoCreateAdmin {
			hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
			user = core.User{
				Username:           "admin",
				Password:           string(hashedPassword),
				Role:               "admin",
				MustChangePassword: true, // Force password change on first login
			}
			if err := h.db.Create(&user).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create default admin"})
				return
			}
			log.Println("⚠️  Default admin created with password 'admin'. CHANGE IT IMMEDIATELY!")
			// Fall through to login logic
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
			return
		}
	}

	// Check password
	err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password))
	if err != nil {
		c.JSON(401, gin.H{"error": "Invalid username or password"})
		return
	}

	// Generate JWT
	token, err := auth.GenerateToken(user.ID, user.Username, user.Role)
	if err != nil {
		c.JSON(500, gin.H{"error": "Failed to generate token"})
		return
	}

	// Set HttpOnly Cookie with Secure flag based on environment
	isSecure := os.Getenv("COOKIE_SECURE") == "true" || os.Getenv("TLS_ENABLED") == "true"
	c.SetCookie("auth_token", token, 3600*24, "/", "", isSecure, true)

	// Log successful login
	go func() {
		h.db.Create(&core.AuditLog{
			UserID:    user.ID,
			Username:  user.Username,
			Action:    "LOGIN",
			Entity:    "AUTH",
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(200, core.LoginResponse{
		Token:              token,
		Username:           user.Username,
		Role:               user.Role,
		MustChangePassword: user.MustChangePassword,
	})
}

// Logout clears the auth cookie
func (h *Handler) Logout(c *gin.Context) {
	// Set cookie with max age -1 to delete it
	c.SetCookie("auth_token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
}

// GetSchemas returns all schemas (newest first)
func (h *Handler) GetSchemas(c *gin.Context) {
	var schemas []core.Schema
	if err := h.db.Order("id DESC").Find(&schemas).Error; err != nil {
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

	// Set ownership
	schema.CreatedBy = c.GetUint("user_id")
	schema.UpdatedBy = c.GetUint("user_id")

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

	// Check ownership (admin or creator)
	if !auth.CanModifyResource(c.GetString("role"), c.GetUint("user_id"), schema.CreatedBy) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to modify this schema"})
		return
	}

	originalCreatedBy := schema.CreatedBy // Preserve original creator
	if err := c.ShouldBindJSON(&schema); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	schema.CreatedBy = originalCreatedBy // Restore
	schema.UpdatedBy = c.GetUint("user_id")

	if err := h.db.Save(&schema).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, schema)
}

// DeleteSchema deletes a schema
func (h *Handler) DeleteSchema(c *gin.Context) {
	id := c.Param("id")

	var schema core.Schema
	if err := h.db.First(&schema, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Schema not found"})
		return
	}

	// Check ownership (admin or creator)
	if !auth.CanModifyResource(c.GetString("role"), c.GetUint("user_id"), schema.CreatedBy) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to delete this schema"})
		return
	}

	if err := h.db.Delete(&core.Schema{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Schema deleted successfully"})
}

// GetNetworks returns all networks (agents/sources) - newest first
func (h *Handler) GetNetworks(c *gin.Context) {
	var networks []core.Network
	if err := h.db.Order("id DESC").Find(&networks).Error; err != nil {
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

	// Set ownership
	network.CreatedBy = c.GetUint("user_id")
	network.UpdatedBy = c.GetUint("user_id")

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

	// Check ownership (admin or creator)
	if !auth.CanModifyResource(c.GetString("role"), c.GetUint("user_id"), network.CreatedBy) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to modify this network"})
		return
	}

	originalCreatedBy := network.CreatedBy
	if err := c.ShouldBindJSON(&network); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	network.CreatedBy = originalCreatedBy
	network.UpdatedBy = c.GetUint("user_id")

	if err := h.db.Save(&network).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, network)
}

// DeleteNetwork deletes a network
func (h *Handler) DeleteNetwork(c *gin.Context) {
	id := c.Param("id")

	var network core.Network
	if err := h.db.First(&network, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Network not found"})
		return
	}

	// Check ownership (admin or creator)
	if !auth.CanModifyResource(c.GetString("role"), c.GetUint("user_id"), network.CreatedBy) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to delete this network"})
		return
	}

	if err := h.db.Delete(&core.Network{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Network deleted successfully"})
}

// CloneNetwork duplicates a network with a new name
func (h *Handler) CloneNetwork(c *gin.Context) {
	id := c.Param("id")

	// Get original network
	var original core.Network
	if err := h.db.First(&original, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Network not found"})
		return
	}

	// Get optional new name from request body
	var req struct {
		Name string `json:"name"`
	}
	c.ShouldBindJSON(&req)

	// Create clone (reset ID to 0 so GORM creates new record)
	clone := original
	clone.ID = 0
	clone.Status = "offline"

	// Generate new name if not provided
	if req.Name != "" {
		clone.Name = req.Name
	} else {
		clone.Name = fmt.Sprintf("%s (Copy)", original.Name)
	}

	// Set AgentName to point to original network's agent (for command routing)
	// If original has agent_name set, use that; otherwise use original's name
	if original.AgentName != "" {
		clone.AgentName = original.AgentName
	} else {
		clone.AgentName = original.Name
	}

	// Create the clone
	if err := h.db.Create(&clone).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":  "Network cloned successfully",
		"original": original,
		"clone":    clone,
	})
}

// GetJobs returns paginated jobs
func (h *Handler) GetJobs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "10"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 10
	}

	offset := (page - 1) * pageSize

	var jobs []core.Job
	var total int64

	// Get total count
	if err := h.db.Model(&core.Job{}).Count(&total).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to count jobs"})
		return
	}

	// Get paginated data (newest first)
	if err := h.db.Preload("Schema").Preload("Network").Order("id DESC").Limit(pageSize).Offset(offset).Find(&jobs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data": jobs,
		"meta": gin.H{
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

// CreateJob creates a new job
func (h *Handler) CreateJob(c *gin.Context) {
	var job core.Job
	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set ownership
	job.CreatedBy = c.GetUint("user_id")
	job.UpdatedBy = c.GetUint("user_id")

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

	// Check ownership (admin or creator)
	if !auth.CanModifyResource(c.GetString("role"), c.GetUint("user_id"), job.CreatedBy) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to modify this job"})
		return
	}

	originalCreatedBy := job.CreatedBy
	if err := c.ShouldBindJSON(&job); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	job.CreatedBy = originalCreatedBy
	job.UpdatedBy = c.GetUint("user_id")

	if err := h.db.Save(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, job)
}

// DeleteJob deletes a job
func (h *Handler) DeleteJob(c *gin.Context) {
	id := c.Param("id")

	var job core.Job
	if err := h.db.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
		return
	}

	// Check ownership (admin or creator)
	if !auth.CanModifyResource(c.GetString("role"), c.GetUint("user_id"), job.CreatedBy) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission to delete this job"})
		return
	}

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
	// Use AgentName if set, otherwise use Network Name
	agentName := job.Network.Name
	if job.Network.AgentName != "" {
		agentName = job.Network.AgentName
	}
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

	// Send RUN_JOB command to agent with config from Network and Schema
	command := core.AgentMessage{
		Type:      "RUN_JOB",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"job_id":       job.ID,
			"log_id":       jobLog.ID,
			"name":         job.Name,
			"target_table": job.Schema.TargetTable,
			// Network source type (database, ftp, sftp)
			"source_type": job.Network.SourceType,
			// Database config (for source_type=database)
			"query": job.Schema.SQLCommand,
			"db_config": map[string]interface{}{
				"driver":   job.Network.DBDriver,
				"host":     job.Network.DBHost,
				"port":     job.Network.DBPort,
				"user":     job.Network.DBUser,
				"password": job.Network.DBPassword,
				"db_name":  job.Network.DBName,
				"sslmode":  job.Network.DBSSLMode,
			},
			// FTP/SFTP config (for source_type=ftp or sftp)
			"ftp_config": map[string]interface{}{
				"host":        job.Network.FTPHost,
				"port":        job.Network.FTPPort,
				"user":        job.Network.FTPUser,
				"password":    job.Network.FTPPassword,
				"private_key": job.Network.FTPPrivateKey,
				"path":        job.Network.FTPPath,
				"passive":     job.Network.FTPPassive,
			},
			// File parsing config from Schema
			"file_config": map[string]interface{}{
				"format":            job.Schema.FileFormat,
				"pattern":           job.Schema.FilePattern,
				"has_header":        job.Schema.HasHeader,
				"delimiter":         job.Schema.Delimiter,
				"unique_key_column": job.Schema.UniqueKeyColumn,
			},
			// API config (for source_type=api)
			"api_config": map[string]interface{}{
				"url":        job.Network.APIURL,
				"method":     job.Network.APIMethod,
				"headers":    job.Network.APIHeaders,
				"auth_type":  job.Network.APIAuthType,
				"auth_key":   job.Network.APIAuthKey,
				"auth_value": job.Network.APIAuthValue,
				"body":       job.Network.APIBody,
			},
			// MongoDB config (for source_type=mongodb)
			"mongo_config": map[string]interface{}{
				"host":       job.Network.MongoHost,
				"port":       job.Network.MongoPort,
				"user":       job.Network.MongoUser,
				"password":   job.Network.MongoPassword,
				"database":   job.Network.MongoDatabase,
				"collection": job.Network.MongoCollection,
				"auth_db":    job.Network.MongoAuthDB,
			},
			// Redis config (for source_type=redis)
			"redis_config": map[string]interface{}{
				"host":     job.Network.RedisHost,
				"port":     job.Network.RedisPort,
				"password": job.Network.RedisPassword,
				"db":       job.Network.RedisDB,
				"pattern":  job.Network.RedisPattern,
			},
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

// ToggleJob enables or disables a job's scheduler
func (h *Handler) ToggleJob(c *gin.Context) {
	id := c.Param("id")

	var job core.Job
	if err := h.db.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
		return
	}

	// Toggle the enabled status
	job.Enabled = !job.Enabled
	if err := h.db.Save(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update job"})
		return
	}

	status := "enabled"
	if !job.Enabled {
		status = "paused"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Job %s %s", job.Name, status),
		"job":     job,
		"enabled": job.Enabled,
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

	// Fix stale 'running' logs if the job itself is 'failed'
	// This handles cases where agent disconnected mid-job
	if job.Status == "failed" {
		for i := range logs {
			if logs[i].Status == "running" {
				logs[i].Status = "failed"
				logs[i].ErrorMessage = "Job was marked as failed (possible agent disconnect)"
				logs[i].CompletedAt = time.Now()
				h.db.Save(&logs[i])
			}
		}
	}

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

// GetRecentJobLogs returns the most recent execution logs across all jobs for notifications
func (h *Handler) GetRecentJobLogs(c *gin.Context) {
	var logs []core.JobLog
	// Get last 10 logs with Job details
	if err := h.db.Preload("Job").Order("created_at DESC").Limit(10).Find(&logs).Error; err != nil {
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

// GetSettings returns all settings
func (h *Handler) GetSettings(c *gin.Context) {
	var settings []core.Settings
	if err := h.db.Find(&settings).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Convert to map for easier frontend use
	settingsMap := make(map[string]string)
	for _, s := range settings {
		settingsMap[s.Key] = s.Value
	}

	c.JSON(http.StatusOK, settingsMap)
}

// UpdateSetting updates a single setting
func (h *Handler) UpdateSetting(c *gin.Context) {
	var req struct {
		Key   string `json:"key" binding:"required"`
		Value string `json:"value"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var setting core.Settings
	if err := h.db.Where("key = ?", req.Key).First(&setting).Error; err != nil {
		// Create new setting if not exists
		setting = core.Settings{Key: req.Key, Value: req.Value}
		if err := h.db.Create(&setting).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	} else {
		setting.Value = req.Value
		if err := h.db.Save(&setting).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Setting updated", "key": req.Key})
}

// GetTargetDBConfig returns target database configuration
func (h *Handler) GetTargetDBConfig(c *gin.Context) {
	keys := []string{"target_db_driver", "target_db_host", "target_db_port", "target_db_user", "target_db_password", "target_db_name", "target_db_sslmode"}

	config := make(map[string]string)
	var settings []core.Settings
	h.db.Where("key IN ?", keys).Find(&settings)

	for _, s := range settings {
		config[s.Key] = s.Value
	}

	// Set defaults
	if config["target_db_driver"] == "" {
		config["target_db_driver"] = "postgres"
	}
	if config["target_db_port"] == "" {
		config["target_db_port"] = "5432"
	}
	if config["target_db_sslmode"] == "" {
		config["target_db_sslmode"] = "disable"
	}

	c.JSON(http.StatusOK, config)
}

// UpdateTargetDBConfig updates target database configuration
func (h *Handler) UpdateTargetDBConfig(c *gin.Context) {
	var config struct {
		Driver   string `json:"driver"`
		Host     string `json:"host"`
		Port     string `json:"port"`
		User     string `json:"user"`
		Password string `json:"password"`
		DBName   string `json:"db_name"`
		SSLMode  string `json:"sslmode"`
	}

	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Save each setting
	settings := map[string]string{
		"target_db_driver":   config.Driver,
		"target_db_host":     config.Host,
		"target_db_port":     config.Port,
		"target_db_user":     config.User,
		"target_db_password": config.Password,
		"target_db_name":     config.DBName,
		"target_db_sslmode":  config.SSLMode,
	}

	for key, value := range settings {
		var setting core.Settings
		if err := h.db.Where("key = ?", key).First(&setting).Error; err != nil {
			setting = core.Settings{Key: key, Value: value}
			h.db.Create(&setting)
		} else {
			setting.Value = value
			h.db.Save(&setting)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Target database configuration updated"})
}

// TestTargetDBConnection tests connection to target database
func (h *Handler) TestTargetDBConnection(c *gin.Context) {
	var config struct {
		Driver   string `json:"driver"`
		Host     string `json:"host"`
		Port     string `json:"port"`
		User     string `json:"user"`
		Password string `json:"password"`
		DBName   string `json:"db_name"`
		SSLMode  string `json:"sslmode"`
	}

	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": err.Error()})
		return
	}

	// Create database config
	dbConfig := database.Config{
		Driver:   config.Driver,
		Host:     config.Host,
		Port:     config.Port,
		User:     config.User,
		Password: config.Password,
		DBName:   config.DBName,
		SSLMode:  config.SSLMode,
	}

	if dbConfig.Driver == "" {
		dbConfig.Driver = "postgres"
	}
	if dbConfig.Port == "" {
		dbConfig.Port = "5432"
	}
	if dbConfig.SSLMode == "" {
		dbConfig.SSLMode = "disable"
	}

	// Try to connect
	startTime := time.Now()
	conn, err := database.Connect(dbConfig)
	duration := time.Since(startTime).Milliseconds()

	if err != nil {
		log.Printf("Test connection failed: %v", err)
		c.JSON(http.StatusOK, gin.H{
			"success":  false,
			"error":    err.Error(),
			"duration": duration,
		})
		return
	}
	defer conn.Close()

	// Get database version
	var version string
	rows, err := conn.ExecuteQuery("SELECT version()")
	if err == nil && len(rows) > 0 {
		if v, ok := rows[0]["version"]; ok {
			version = fmt.Sprintf("%v", v)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "Connection successful",
		"duration": duration,
		"version":  version,
		"host":     config.Host,
		"port":     config.Port,
		"database": config.DBName,
	})
}

// TestNetworkConnection sends test command to agent to test source DB or FTP/SFTP
func (h *Handler) TestNetworkConnection(c *gin.Context) {
	id := c.Param("id")

	var network core.Network
	if err := h.db.First(&network, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Network not found"})
		return
	}

	// Check if agent is connected
	if h.agentListener == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": "Agent listener not available"})
		return
	}

	// Send TEST_CONNECTION command to agent with source_type
	command := core.AgentMessage{
		Type:      "TEST_CONNECTION",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"network_id":  network.ID,
			"source_type": network.SourceType,
			"db_config": map[string]interface{}{
				"driver":   network.DBDriver,
				"host":     network.DBHost,
				"port":     network.DBPort,
				"user":     network.DBUser,
				"password": network.DBPassword,
				"db_name":  network.DBName,
				"sslmode":  network.DBSSLMode,
			},
			"ftp_config": map[string]interface{}{
				"host":        network.FTPHost,
				"port":        network.FTPPort,
				"user":        network.FTPUser,
				"password":    network.FTPPassword,
				"private_key": network.FTPPrivateKey,
				"path":        network.FTPPath,
				"passive":     network.FTPPassive,
			},
		},
	}

	err := h.agentListener.SendCommandToAgent(network.Name, command)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"error":   fmt.Sprintf("Agent not connected: %v", err),
		})
		return
	}

	// Note: For now, we just confirm the command was sent
	// In a full implementation, we'd wait for the response
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Test command sent to agent",
		"agent":   network.Name,
	})
}

// GetAuditLogs retrieves audit logs with pagination and filters
func (h *Handler) GetAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	action := c.Query("action")
	entity := c.Query("entity")

	offset := (page - 1) * limit

	var logs []core.AuditLog
	var total int64

	query := h.db.Model(&core.AuditLog{})

	if action != "" {
		query = query.Where("action = ?", action)
	}
	if entity != "" {
		query = query.Where("entity = ?", entity)
	}

	query.Count(&total)

	// Order by latest
	if err := query.Order("created_at desc").Offset(offset).Limit(limit).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch audit logs"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  logs,
		"total": total,
		"page":  page,
		"limit": limit,
	})
}

// GetUsers returns all users
func (h *Handler) GetUsers(c *gin.Context) {
	var users []core.User
	if err := h.db.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

// CreateUser creates a new user
func (h *Handler) CreateUser(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required"`
		Password string `json:"password" binding:"required"`
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user exists
	var existing core.User
	if err := h.db.Where("username = ?", req.Username).First(&existing).Error; err == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Username already exists"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Default role is viewer if not specified
	role := req.Role
	if role == "" {
		role = "viewer"
	}

	user := core.User{
		Username: req.Username,
		Password: string(hashedPassword),
		Role:     role,
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "CREATE",
			Entity:    "USER",
			EntityID:  fmt.Sprintf("%d", user.ID),
			Details:   fmt.Sprintf("Created user '%s' with role '%s'", user.Username, user.Role),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusCreated, user)
}

// UpdateUser updates user details (password/role)
func (h *Handler) UpdateUser(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Password string `json:"password"`
		Role     string `json:"role"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user core.User
	if err := h.db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Prevent demoting the last admin (optional safety, but for now just prevent editing 'admin' username if we allowed username change, but we don't)
	// Actually, just allow updating password for admin.

	updates := make(map[string]interface{})
	if req.Role != "" {
		// specific check: don't allow changing 'admin' user's role to anything else to prevent lockout
		if user.Username == "admin" && req.Role != "admin" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot change role of the main admin user"})
			return
		}
		updates["role"] = req.Role
	}

	if req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
			return
		}
		updates["password"] = string(hashedPassword)
	}

	if len(updates) > 0 {
		if err := h.db.Model(&user).Updates(updates).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "UPDATE",
			Entity:    "USER",
			EntityID:  id,
			Details:   fmt.Sprintf("Updated user '%s'", user.Username),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, user)
}

// DeleteUser deletes a user
func (h *Handler) DeleteUser(c *gin.Context) {
	id := c.Param("id")

	// Prevent deleting yourself (basic check)
	requestingUserID := c.GetUint("user_id")
	targetID, _ := strconv.Atoi(id)
	if uint(targetID) == requestingUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete your own account"})
		return
	}

	var user core.User
	if err := h.db.First(&user, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Prevent deleting the main 'admin' user
	if user.Username == "admin" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot delete the main admin user"})
		return
	}

	if err := h.db.Delete(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "DELETE",
			Entity:    "USER",
			EntityID:  id,
			Details:   fmt.Sprintf("Deleted user '%s'", user.Username),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
}

// ======== Agent Token Management ========

// GetAgentTokens returns all agent tokens
func (h *Handler) GetAgentTokens(c *gin.Context) {
	var tokens []core.AgentToken
	h.db.Order("created_at DESC").Find(&tokens)

	// Hide full token in response
	for i := range tokens {
		tokens[i].Token = "" // Don't expose full token
	}

	c.JSON(http.StatusOK, tokens)
}

// CreateAgentToken creates a new token for an agent
func (h *Handler) CreateAgentToken(c *gin.Context) {
	var input struct {
		AgentName   string `json:"agent_name" binding:"required"`
		Description string `json:"description"`
		ExpiresIn   int    `json:"expires_in"` // Days until expiry, 0 = never
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if token already exists for this agent
	var existing core.AgentToken
	if err := h.db.Where("agent_name = ?", input.AgentName).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Token already exists for this agent. Revoke or delete it first."})
		return
	}

	// Generate secure random token
	rawToken := auth.GenerateSecureToken(32) // 32 bytes = 64 hex chars
	hashedToken := auth.HashToken(rawToken)

	token := core.AgentToken{
		AgentName:   input.AgentName,
		Token:       hashedToken,
		TokenPrefix: rawToken[:8], // First 8 chars for display
		Description: input.Description,
		CreatedAt:   time.Now(),
		CreatedBy:   c.GetString("username"),
	}

	// Set expiry if specified
	if input.ExpiresIn > 0 {
		expiresAt := time.Now().AddDate(0, 0, input.ExpiresIn)
		token.ExpiresAt = &expiresAt
	}

	if err := h.db.Create(&token).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create token"})
		return
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "CREATE",
			Entity:    "AGENT_TOKEN",
			EntityID:  fmt.Sprint(token.ID),
			Details:   fmt.Sprintf("Created token for agent '%s'", input.AgentName),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	// Return raw token ONLY on creation (this is the only time it's visible)
	c.JSON(http.StatusCreated, gin.H{
		"message":     "Token created successfully",
		"token":       rawToken, // Raw token - show only once!
		"agent_name":  input.AgentName,
		"expires_at":  token.ExpiresAt,
		"description": input.Description,
	})
}

// RevokeAgentToken revokes a token (soft delete)
func (h *Handler) RevokeAgentToken(c *gin.Context) {
	id := c.Param("id")

	var token core.AgentToken
	if err := h.db.First(&token, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Token not found"})
		return
	}

	token.Revoked = true
	h.db.Save(&token)

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "REVOKE",
			Entity:    "AGENT_TOKEN",
			EntityID:  id,
			Details:   fmt.Sprintf("Revoked token for agent '%s'", token.AgentName),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Token revoked successfully"})
}

// DeleteAgentToken permanently deletes a token
func (h *Handler) DeleteAgentToken(c *gin.Context) {
	id := c.Param("id")

	var token core.AgentToken
	if err := h.db.First(&token, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Token not found"})
		return
	}

	h.db.Delete(&token)

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "DELETE",
			Entity:    "AGENT_TOKEN",
			EntityID:  id,
			Details:   fmt.Sprintf("Deleted token for agent '%s'", token.AgentName),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Token deleted successfully"})
}

// ValidateAgentToken validates a token (used internally by agent listener)
func (h *Handler) ValidateAgentToken(agentName, rawToken string) bool {
	var token core.AgentToken
	hashedToken := auth.HashToken(rawToken)

	if err := h.db.Where("agent_name = ? AND token = ?", agentName, hashedToken).First(&token).Error; err != nil {
		return false
	}

	if !token.IsValid() {
		return false
	}

	// Update last used timestamp
	now := time.Now()
	token.LastUsedAt = &now
	h.db.Save(&token)

	return true
}

// ==================== LICENSE HANDLERS ====================

// GetMachineID returns the unique machine identifier for this server
func (h *Handler) GetMachineID(c *gin.Context) {
	machineID, err := license.GenerateMachineID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate machine ID"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"machine_id": machineID})
}

// GetLicenseStatus returns the current license status
func (h *Handler) GetLicenseStatus(c *gin.Context) {
	machineID, err := license.GenerateMachineID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate machine ID"})
		return
	}

	var lic core.License
	if err := h.db.First(&lic).Error; err != nil {
		// No license found
		c.JSON(http.StatusOK, core.LicenseResponse{
			IsActive:      false,
			MachineID:     machineID,
			Status:        "inactive",
			DaysRemaining: 0,
			Message:       "No license activated. Please activate to unlock all features.",
		})
		return
	}

	// Check if license is expired
	if time.Now().After(lic.ExpiresAt) {
		lic.Status = "expired"
		h.db.Save(&lic)
	}

	c.JSON(http.StatusOK, core.LicenseResponse{
		IsActive:      lic.IsActive(),
		MachineID:     machineID,
		ExpiresAt:     lic.ExpiresAt,
		DaysRemaining: lic.DaysRemaining(),
		Status:        lic.Status,
		Message:       getLicenseMessage(lic),
	})
}

func getLicenseMessage(lic core.License) string {
	if lic.Status == "expired" {
		return "License has expired. Please renew to continue using all features."
	}
	if lic.DaysRemaining() <= 30 {
		return fmt.Sprintf("License expires in %d days. Please renew soon.", lic.DaysRemaining())
	}
	return "License is active."
}

// ActivateLicense activates the license with provided activation code
func (h *Handler) ActivateLicense(c *gin.Context) {
	var req struct {
		ActivationCode string `json:"activation_code" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Activation code is required"})
		return
	}

	machineID, err := license.GenerateMachineID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate machine ID"})
		return
	}

	// Validate activation code
	isValid, expiryDate, err := license.ValidateActivationCode(machineID, req.ActivationCode)
	if !isValid {
		errMsg := "Invalid activation code"
		if err != nil {
			errMsg = err.Error()
		}
		c.JSON(http.StatusBadRequest, gin.H{"error": errMsg})
		return
	}

	// Get username from context
	username := c.GetString("username")
	if username == "" {
		username = "admin"
	}

	// Save or update license
	var lic core.License
	h.db.First(&lic)

	lic.MachineID = machineID
	lic.ActivationCode = req.ActivationCode
	lic.ActivatedAt = time.Now()
	lic.ExpiresAt = expiryDate
	lic.Status = "active"
	lic.ActivatedBy = username

	if lic.ID == 0 {
		h.db.Create(&lic)
	} else {
		h.db.Save(&lic)
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"message":        "License activated successfully!",
		"expires_at":     expiryDate,
		"days_remaining": license.DaysUntilExpiry(expiryDate),
	})
}
