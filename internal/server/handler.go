package server

import (
	"dsp-platform/internal/auth"
	"dsp-platform/internal/core"
	"dsp-platform/internal/database"
	"fmt"
	"log"
	"net/http"
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

	// Mock authentication - in production, check against database with hashed password
	var user core.User
	if err := h.db.Where("username = ?", req.Username).First(&user).Error; err != nil {
		// If user doesn't exist, create a default admin for demo purposes
		if err == gorm.ErrRecordNotFound && req.Username == "admin" && req.Password == "admin" {
			hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("admin"), bcrypt.DefaultCost)
			user = core.User{Username: "admin", Password: string(hashedPassword), Role: "admin"}
			if err := h.db.Create(&user).Error; err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create default admin"})
				return
			}
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

	// Set HttpOnly Cookie for security
	c.SetCookie("auth_token", token, 3600*24, "/", "", false, true)

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
		Token:    token, // Keep returning token for API clients if needed, though cookie is primary
		Username: user.Username,
		Role:     user.Role,
	})
}

// Logout clears the auth cookie
func (h *Handler) Logout(c *gin.Context) {
	// Set cookie with max age -1 to delete it
	c.SetCookie("auth_token", "", -1, "/", "", false, true)
	c.JSON(http.StatusOK, gin.H{"message": "Logged out successfully"})
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

// TestNetworkConnection sends test command to agent to test source DB
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

	// Send TEST_CONNECTION command to agent
	command := core.AgentMessage{
		Type:      "TEST_CONNECTION",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"network_id": network.ID,
			"db_config": map[string]interface{}{
				"driver":   network.DBDriver,
				"host":     network.DBHost,
				"port":     network.DBPort,
				"user":     network.DBUser,
				"password": network.DBPassword,
				"db_name":  network.DBName,
				"sslmode":  network.DBSSLMode,
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
