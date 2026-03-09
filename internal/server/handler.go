package server

import (
	"database/sql"
	"dsp-platform/internal/auth"
	"dsp-platform/internal/backup"
	"dsp-platform/internal/core"
	"dsp-platform/internal/database"
	"dsp-platform/internal/filesync"
	"dsp-platform/internal/license"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	_ "github.com/go-sql-driver/mysql"
	_ "github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Handler manages HTTP request handling
type Handler struct {
	db            *gorm.DB
	agents        map[string]*core.Network // In-memory agent tracking
	agentListener *AgentListener           // Reference to agent listener for commands
	startTime     time.Time                // Server start time for uptime tracking
}

// NewHandler creates a new handler instance
func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		db:        db,
		agents:    make(map[string]*core.Network),
		startTime: time.Now(),
	}
}

// Login handles user authentication
// @Summary User login
// @Description Authenticate user and receive JWT token
// @Tags Auth
// @Accept json
// @Produce json
// @Param request body core.LoginRequest true "Login credentials"
// @Success 200 {object} map[string]interface{} "Login successful with token"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Router /login [post]
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
	schemas := []core.Schema{}
	if err := h.db.Preload("Rules").Order("id DESC").Find(&schemas).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, schemas)
}

// CreateSchema creates a new schema
// @Summary Create a new schema
// @Description Create a new data sync schema
// @Tags Schema
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param schema body core.Schema true "Schema data"
// @Success 201 {object} core.Schema
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /schemas [post]
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

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "CREATE",
			Entity:    "SCHEMA",
			EntityID:  fmt.Sprintf("%d", schema.ID),
			Details:   fmt.Sprintf("Created schema '%s'", schema.Name),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusCreated, schema)
}

// UpdateSchema updates an existing schema
// @Summary Update a schema
// @Description Update an existing data sync schema
// @Tags Schema
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Schema ID"
// @Param schema body core.Schema true "Schema data"
// @Success 200 {object} core.Schema
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /schemas/{id} [put]
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

	// Update Rules (Replace existing with new ones)
	if err := h.db.Model(&schema).Association("Rules").Replace(schema.Rules); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update rules: " + err.Error()})
		return
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "UPDATE",
			Entity:    "SCHEMA",
			EntityID:  id,
			Details:   fmt.Sprintf("Updated schema '%s'", schema.Name),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, schema)
}

// DeleteSchema deletes a schema
// @Summary Delete a schema
// @Description Delete a data sync schema by ID
// @Tags Schema
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Schema ID"
// @Success 200 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /schemas/{id} [delete]
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

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "DELETE",
			Entity:    "SCHEMA",
			EntityID:  id,
			Details:   fmt.Sprintf("Deleted schema '%s'", schema.Name),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Schema deleted successfully"})
}

// GetNetworks returns all networks (agents/sources) - newest first
// @Summary List all networks
// @Description Get all network/agent connections
// @Tags Network
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {array} core.Network
// @Failure 401 {object} map[string]string
// @Router /networks [get]
func (h *Handler) GetNetworks(c *gin.Context) {
	networks := []core.Network{}
	if err := h.db.Preload("Jobs.Schema").Order("id DESC").Find(&networks).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, networks)
}

// CreateNetwork creates a new network entry
// @Summary Create a new network
// @Description Create a new network/agent connection
// @Tags Network
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param network body core.Network true "Network data"
// @Success 201 {object} core.Network
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Router /networks [post]
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

	// Auto-create Job for this network
	newJob := core.Job{
		Name:      network.Name,
		NetworkID: network.ID,
		Enabled:   true,
		Status:    "pending",
		CreatedBy: c.GetUint("user_id"),
		UpdatedBy: c.GetUint("user_id"),
	}
	if err := h.db.Create(&newJob).Error; err == nil {
		log.Printf("✅ Auto-created Job '%s' for NEW Network ID %d", newJob.Name, network.ID)
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "CREATE",
			Entity:    "NETWORK",
			EntityID:  fmt.Sprintf("%d", network.ID),
			Details:   fmt.Sprintf("Created network '%s' (%s)", network.Name, network.SourceType),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusCreated, network)
}

// UpdateNetwork updates an existing network
// @Summary Update a network
// @Description Update an existing network/agent connection
// @Tags Network
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Network ID"
// @Param network body core.Network true "Network data"
// @Success 200 {object} core.Network
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /networks/{id} [put]
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

	// Auto-create Job if it doesn't exist for this network
	var jobCount int64
	h.db.Model(&core.Job{}).Where("network_id = ?", network.ID).Count(&jobCount)
	if jobCount == 0 {
		newJob := core.Job{
			Name:      network.Name,
			NetworkID: network.ID,
			Enabled:   true,
			Status:    "pending",
			CreatedBy: c.GetUint("user_id"),
			UpdatedBy: c.GetUint("user_id"),
		}
		if err := h.db.Create(&newJob).Error; err == nil {
			log.Printf("✅ Auto-created Job '%s' for Network ID %d", newJob.Name, network.ID)

			// Log audit for auto-created job
			go func() {
				h.db.Create(&core.AuditLog{
					Username:  c.GetString("username"),
					UserID:    c.GetUint("user_id"),
					Action:    "CREATE",
					Entity:    "JOB",
					EntityID:  fmt.Sprintf("%d", newJob.ID),
					Details:   fmt.Sprintf("Auto-created job '%s' from network configuration", newJob.Name),
					IPAddress: c.ClientIP(),
					UserAgent: c.Request.UserAgent(),
					CreatedAt: time.Now(),
				})
			}()
		}
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "UPDATE",
			Entity:    "NETWORK",
			EntityID:  id,
			Details:   fmt.Sprintf("Updated network '%s'", network.Name),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

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

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "DELETE",
			Entity:    "NETWORK",
			EntityID:  id,
			Details:   fmt.Sprintf("Deleted network '%s'", network.Name),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

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

	jobs := []core.Job{}
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

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "CREATE",
			Entity:    "JOB",
			EntityID:  fmt.Sprintf("%d", job.ID),
			Details:   fmt.Sprintf("Created job '%s'", job.Name),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

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

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "UPDATE",
			Entity:    "JOB",
			EntityID:  id,
			Details:   fmt.Sprintf("Updated job '%s'", job.Name),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

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

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "DELETE",
			Entity:    "JOB",
			EntityID:  id,
			Details:   fmt.Sprintf("Deleted job '%s'", job.Name),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, gin.H{"message": "Job deleted successfully"})
}

// AbortJob stops a running job by setting its status to failed
func (h *Handler) AbortJob(c *gin.Context) {
	id := c.Param("id")
	var job core.Job

	if err := h.db.First(&job, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Job not found"})
		return
	}

	if job.Status != "running" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Job is not running"})
		return
	}

	// Update job status to failed with abort reason
	job.Status = "failed"
	h.db.Save(&job)

	// Signal worker pool to skip remaining insert batches for this job
	if h.agentListener != nil {
		h.agentListener.MarkJobAborted(job.ID)
	}

	// Update the latest job log
	var jobLog core.JobLog
	if err := h.db.Where("job_id = ? AND status = ?", job.ID, "running").
		Order("started_at DESC").First(&jobLog).Error; err == nil {
		jobLog.Status = "failed"
		jobLog.ErrorMessage = "Aborted by user"
		jobLog.CompletedAt = time.Now()
		h.db.Save(&jobLog)
	}

	// Create audit log
	username, _ := c.Get("username")
	h.db.Create(&core.AuditLog{
		Username: fmt.Sprintf("%v", username),
		Action:   "ABORT",
		Entity:   "JOB",
		Details:  fmt.Sprintf("Aborted job '%s' (ID: %d)", job.Name, job.ID),
	})

	log.Printf("[ABORT] Job %d '%s' aborted by user %v", job.ID, job.Name, username)

	c.JSON(http.StatusOK, gin.H{"message": "Job aborted successfully", "job": job})
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

	// Clear any stale abort flag from previous runs so the worker pool doesn't skip this job's batches
	if h.agentListener != nil {
		h.agentListener.ClearJobAborted(job.ID)
	}

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
	// Determine effective source type
	sourceType := job.Network.SourceType
	// Auto-detect minio_mirror: when source is MinIO and target is also MinIO, use object-level sync
	if sourceType == "minio" && job.Network.TargetSourceType == "minio" {
		sourceType = "minio_mirror"
	}

	// Extract schema values safely (Schema is optional for minio_mirror)
	var targetTable, sqlCommand, fileFormat, filePattern, uniqueKeyColumn, delimiter string
	var hasHeader bool
	if job.Schema != nil {
		targetTable = job.Schema.TargetTable
		sqlCommand = job.Schema.SQLCommand
		fileFormat = job.Schema.FileFormat
		filePattern = job.Schema.FilePattern
		uniqueKeyColumn = job.Schema.UniqueKeyColumn
		hasHeader = job.Schema.HasHeader
		delimiter = job.Schema.Delimiter

		// Handle incremental sync ca_pointer replacement
		if job.Incremental && job.CheckpointColumn != "" && sqlCommand != "" {
			checkpointVal := job.LastCheckpoint
			if checkpointVal == "" {
				checkpointVal = "0"
			}

			// Case-insensitive replacement
			lowerQuery := strings.ToLower(sqlCommand)
			if strings.Contains(lowerQuery, "{{ca_pointer}}") {
				sqlCommand = strings.ReplaceAll(sqlCommand, "{{ca_pointer}}", checkpointVal)
				sqlCommand = strings.ReplaceAll(sqlCommand, "{{CA_POINTER}}", checkpointVal)
				sqlCommand = strings.ReplaceAll(sqlCommand, "{{Ca_Pointer}}", checkpointVal)
			}
		}
	}

	command := core.AgentMessage{
		Type:      "RUN_JOB",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"job_id":       job.ID,
			"log_id":       jobLog.ID,
			"name":         job.Name,
			"target_table": targetTable,
			// Network source type (database, ftp, sftp, minio, minio_mirror)
			"source_type": sourceType,
			// Database config (for source_type=database)
			"query": sqlCommand,
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
				"format":            fileFormat,
				"pattern":           filePattern,
				"has_header":        hasHeader,
				"delimiter":         delimiter,
				"unique_key_column": uniqueKeyColumn,
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
			// MinIO/S3 config (for source_type=minio)
			"minio_config": map[string]interface{}{
				"endpoint":    job.Network.MinIOEndpoint,
				"access_key":  job.Network.MinIOAccessKey,
				"secret_key":  job.Network.MinIOSecretKey,
				"bucket":      job.Network.MinIOBucket,
				"object_path": job.Network.MinIOObjectPath,
				"use_ssl":     job.Network.MinIOUseSSL,
				"region":      job.Network.MinIORegion,
			},
			// ===== TARGET CONFIGURATIONS =====
			"target_source_type": job.Network.TargetSourceType,
			// Target Database config
			"target_db_config": map[string]interface{}{
				"driver":   job.Network.TargetDBDriver,
				"host":     job.Network.TargetDBHost,
				"port":     job.Network.TargetDBPort,
				"user":     job.Network.TargetDBUser,
				"password": job.Network.TargetDBPassword,
				"db_name":  job.Network.TargetDBName,
				"sslmode":  job.Network.TargetDBSSLMode,
			},
			// Target MinIO/S3 config (for target_source_type=minio)
			"target_minio_config": map[string]interface{}{
				"endpoint":      job.Network.TargetMinIOEndpoint,
				"access_key":    job.Network.TargetMinIOAccessKey,
				"secret_key":    job.Network.TargetMinIOSecretKey,
				"bucket":        job.Network.TargetMinIOBucket,
				"object_path":   job.Network.TargetMinIOObjectPath,
				"use_ssl":       job.Network.TargetMinIOUseSSL,
				"region":        job.Network.TargetMinIORegion,
				"export_format": job.Network.TargetMinIOExportFormat,
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

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "TOGGLE",
			Entity:    "JOB",
			EntityID:  id,
			Details:   fmt.Sprintf("Job '%s' %s", job.Name, status),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

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
	logs := []core.JobLog{}
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
	logs := []core.JobLog{}
	if err := h.db.Where("job_id = ?", id).Order("created_at DESC").Limit(50).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logs)
}

// GetRecentJobLogs returns the most recent execution logs across all jobs for notifications
func (h *Handler) GetRecentJobLogs(c *gin.Context) {
	logs := []core.JobLog{}
	// Get last 10 logs with Job details
	if err := h.db.Preload("Job").Order("created_at DESC").Limit(10).Find(&logs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, logs)
}

// UpdateAgentStatus updates agent status from listener
func (h *Handler) UpdateAgentStatus(agentName, status, ipAddress string, data map[string]interface{}) {
	var network core.Network

	// Find or create network entry for this agent
	if err := h.db.Where("name = ? OR agent_name = ?", agentName, agentName).First(&network).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			network = core.Network{
				Name:      agentName,
				AgentName: agentName,
				IPAddress: ipAddress,
				Status:    status,
				Type:      "source",
				LastSeen:  time.Now(),
			}
			h.db.Create(&network)
		}
	}

	// Update common fields
	network.Status = status
	network.LastSeen = time.Now()
	network.IPAddress = ipAddress

	// Update real-time metrics if provided in data
	if val, ok := data["cpu_usage"].(float64); ok {
		network.CPUUsage = val
	}
	if val, ok := data["memory_total"].(float64); ok {
		network.MemoryTotal = uint64(val)
	}
	if val, ok := data["memory_free"].(float64); ok {
		network.MemoryFree = uint64(val)
	}
	if val, ok := data["memory_used"].(float64); ok {
		network.MemoryUsed = uint64(val)
	}
	if val, ok := data["version"].(string); ok {
		network.SoftwareVersion = val
	}

	h.db.Save(&network)
	h.agents[agentName] = &network
	log.Printf("Agent %s status updated: %s (CPU: %.2f%%)", agentName, status, network.CPUUsage)
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

// GetSystemStatus returns real-time system health information
// @Summary Get system status
// @Description Returns health status of server, agent listener, and database
// @Tags System
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Router /system-status [get]
func (h *Handler) GetSystemStatus(c *gin.Context) {
	// --- Server Master ---
	uptime := time.Since(h.startTime)
	uptimeStr := formatUptime(uptime)

	serverStatus := gin.H{
		"name":   "Server Master",
		"status": "Aktif",
		"ok":     true,
		"health": 100,
		"uptime": uptimeStr,
	}

	// --- Agent Listener ---
	agentOk := h.agentListener != nil
	connectedCount := 0
	listenerPort := "-"
	if agentOk {
		connectedCount = len(h.agentListener.GetConnectedAgents())
		listenerPort = h.agentListener.port
	}
	agentHealth := 100
	if !agentOk {
		agentHealth = 0
	}
	agentStatus := gin.H{
		"name":             "Agent Listener",
		"status":           fmt.Sprintf("Port %s", listenerPort),
		"ok":               agentOk,
		"health":           agentHealth,
		"connected_agents": connectedCount,
	}

	// --- Database ---
	dbOk := false
	dbStatusText := "Terputus"
	dbHealth := 0
	dbTables := 0
	sqlDB, err := h.db.DB()
	if err == nil {
		if err := sqlDB.Ping(); err == nil {
			dbOk = true
			dbStatusText = "Terhubung"
			dbHealth = 100

			// Count tables
			var count int64
			h.db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").Scan(&count)
			dbTables = int(count)
		}
	}
	dbStatus := gin.H{
		"name":   "Database",
		"status": dbStatusText,
		"ok":     dbOk,
		"health": dbHealth,
		"tables": dbTables,
	}

	c.JSON(http.StatusOK, gin.H{
		"server":         serverStatus,
		"agent_listener": agentStatus,
		"database":       dbStatus,
	})
}

// GetJobAnalytics returns aggregated job statistics based on time range
// @Summary Get job analytics
// @Description Returns job success/failure counts for a specific range
// @Tags Analytics
// @Produce json
// @Security BearerAuth
// @Param range query string false "Time range (5m, 1h, 24h, 7d, 30d, 3m)"
// @Success 200 {object} []map[string]interface{}
// @Router /analytics/jobs [get]
func (h *Handler) GetJobAnalytics(c *gin.Context) {
	timeRange := c.DefaultQuery("range", "7d")

	type Result struct {
		Date   string `json:"date"`
		Status string `json:"status"`
		Count  int    `json:"count"`
	}

	var results []Result
	var timeFilter string
	var groupBy string
	var timeFormat string // Go format for initialization loop
	var interval time.Duration
	var steps int

	// Determine query parameters based on range
	switch timeRange {
	case "5m":
		timeFilter = "datetime('now', '-5 minutes')"
		groupBy = "strftime('%H:%M', created_at)"
		timeFormat = "15:04"
		interval = time.Minute
		steps = 5
	case "1h":
		timeFilter = "datetime('now', '-1 hour')"
		groupBy = "strftime('%H:%M', created_at)"
		timeFormat = "15:04"
		interval = time.Minute
		steps = 60
	case "24h":
		timeFilter = "datetime('now', '-24 hours')"
		groupBy = "strftime('%Y-%m-%d %H:00', created_at)"
		timeFormat = "2006-01-02 15:00"
		interval = time.Hour
		steps = 24
	case "30d":
		timeFilter = "date('now', '-30 days')"
		groupBy = "date(created_at)"
		timeFormat = "2006-01-02"
		interval = 24 * time.Hour
		steps = 30
	case "3m":
		timeFilter = "date('now', '-90 days')"
		groupBy = "date(created_at)"
		timeFormat = "2006-01-02"
		interval = 24 * time.Hour
		steps = 90
	case "7d":
		fallthrough
	default:
		timeFilter = "date('now', '-7 days')"
		groupBy = "date(created_at)"
		timeFormat = "2006-01-02"
		interval = 24 * time.Hour
		steps = 7
	}

	// SQLite specific date truncation
	err := h.db.Model(&core.JobLog{}).
		Select(fmt.Sprintf("%s as date, status, count(*) as count", groupBy)).
		Where(fmt.Sprintf("created_at >= %s", timeFilter)).
		Group(fmt.Sprintf("%s, status", groupBy)).
		Order(fmt.Sprintf("%s asc", groupBy)).
		Scan(&results).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch analytics data"})
		return
	}

	type DailyStats struct {
		Date    string `json:"date"`
		Success int    `json:"success"`
		Failed  int    `json:"failed"`
		Running int    `json:"running"`
		Total   int    `json:"total"`
	}

	statsMap := make(map[string]*DailyStats)

	// Initialize time buckets with 0 values
	now := time.Now()
	// Round down start time based on interval to match database grouping
	var current time.Time
	if interval >= 24*time.Hour {
		current = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	} else if interval == time.Hour {
		current = time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), 0, 0, 0, now.Location())
	} else {
		current = time.Date(now.Year(), now.Month(), now.Day(), now.Hour(), now.Minute(), 0, 0, now.Location())
	}

	// For 5m and 1h and 24h, we want to show the last N intervals ending at NOW
	// But the loop below goes backwards from 0 to steps.
	for i := steps - 1; i >= 0; i-- {
		dateStr := current.Add(-time.Duration(i) * interval).Format(timeFormat)
		// For 5m/1h, format matches %H:%M. For 24h, %Y-%m-%d %H:00. For others %Y-%m-%d.
		// However, 5m/1h might cross midnight, so %H:%M is ambiguous if not careful,
		// but typically for 1h chart we just show time.
		// If range is 5m or 1h, SQLite strftime('%H:%M') returns just time.
		// Go format "15:04" returns just time.
		// Use just time for map key for 5m/1h to match DB result.
		statsMap[dateStr] = &DailyStats{Date: dateStr}
	}

	for _, r := range results {
		// Ensure entry exists (might be outside range if server time differs slightly, just ignore or add)
		if _, ok := statsMap[r.Date]; !ok {
			// If not pre-filled, we add it if it's within reason, or just add it.
			statsMap[r.Date] = &DailyStats{Date: r.Date}
		}

		switch r.Status {
		case "completed", "success":
			statsMap[r.Date].Success += r.Count
		case "failed", "error":
			statsMap[r.Date].Failed += r.Count
		case "running":
			statsMap[r.Date].Running += r.Count
		}
		statsMap[r.Date].Total += r.Count
	}

	// Convert map to slice sorted by date
	var finalStats []DailyStats
	for i := steps - 1; i >= 0; i-- {
		dateStr := current.Add(-time.Duration(i) * interval).Format(timeFormat)
		if stat, ok := statsMap[dateStr]; ok {
			finalStats = append(finalStats, *stat)
		}
	}

	c.JSON(http.StatusOK, finalStats)
}

// formatUptime formats a duration into a human-readable string
func formatUptime(d time.Duration) string {
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60
	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
	return fmt.Sprintf("%dm", minutes)
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
			"minio_config": map[string]interface{}{
				"endpoint":    network.MinIOEndpoint,
				"access_key":  network.MinIOAccessKey,
				"secret_key":  network.MinIOSecretKey,
				"bucket":      network.MinIOBucket,
				"object_path": network.MinIOObjectPath,
				"use_ssl":     network.MinIOUseSSL,
				"region":      network.MinIORegion,
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

// TestNetworkTargetConnection tests the TARGET database/FTP/API connection directly from master
func (h *Handler) TestNetworkTargetConnection(c *gin.Context) {
	id := c.Param("id")

	var network core.Network
	if err := h.db.First(&network, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "error": "Network not found"})
		return
	}

	// Test based on target source type
	sourceType := network.TargetSourceType
	if sourceType == "" {
		sourceType = "database"
	}

	switch sourceType {
	case "database":
		// Test database connection directly from master
		dbConfig := database.Config{
			Driver:   network.TargetDBDriver,
			Host:     network.TargetDBHost,
			Port:     network.TargetDBPort,
			User:     network.TargetDBUser,
			Password: network.TargetDBPassword,
			DBName:   network.TargetDBName,
			SSLMode:  network.TargetDBSSLMode,
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

		startTime := time.Now()
		conn, err := database.Connect(dbConfig)
		duration := time.Since(startTime).Milliseconds()

		if err != nil {
			log.Printf("Target test connection failed: %v", err)
			c.JSON(http.StatusOK, gin.H{
				"success":  false,
				"error":    err.Error(),
				"duration": duration,
			})
			return
		}
		defer conn.Close()

		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"message":  "Target connection successful",
			"duration": duration,
			"host":     network.TargetDBHost,
			"port":     network.TargetDBPort,
			"database": network.TargetDBName,
		})

	case "ftp", "sftp":
		// For FTP/SFTP target, send command to agent
		if h.agentListener == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"success": false, "error": "Agent listener not available"})
			return
		}

		command := core.AgentMessage{
			Type:      "TEST_CONNECTION",
			Timestamp: time.Now(),
			Data: map[string]interface{}{
				"network_id":  network.ID,
				"source_type": sourceType,
				"ftp_config": map[string]interface{}{
					"host":        network.TargetFTPHost,
					"port":        network.TargetFTPPort,
					"user":        network.TargetFTPUser,
					"password":    network.TargetFTPPassword,
					"private_key": network.TargetFTPPrivateKey,
					"path":        network.TargetFTPPath,
				},
			},
		}

		agentName := network.AgentName
		if agentName == "" {
			agentName = network.Name
		}

		err := h.agentListener.SendCommandToAgent(agentName, command)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"error":   fmt.Sprintf("Agent not connected: %v", err),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Test command sent to agent for target FTP/SFTP",
			"agent":   agentName,
		})

	case "api":
		// For API target, we could do a quick test from master
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "API target configured",
			"url":     network.TargetAPIURL,
		})

	case "minio":
		// Test MinIO connection directly from master
		minioConfig := filesync.MinIOConfig{
			Endpoint:        network.TargetMinIOEndpoint,
			AccessKeyID:     network.TargetMinIOAccessKey,
			SecretAccessKey: network.TargetMinIOSecretKey,
			BucketName:      network.TargetMinIOBucket,
			ObjectPath:      network.TargetMinIOObjectPath,
			UseSSL:          network.TargetMinIOUseSSL,
			Region:          network.TargetMinIORegion,
		}

		startTime := time.Now()
		client, err := filesync.NewMinIOClient(minioConfig)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success":  false,
				"error":    err.Error(),
				"duration": time.Since(startTime).Milliseconds(),
			})
			return
		}
		defer client.Close()

		if err := client.TestConnection(); err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success":  false,
				"error":    err.Error(),
				"duration": time.Since(startTime).Milliseconds(),
			})
			return
		}

		duration := time.Since(startTime).Milliseconds()
		c.JSON(http.StatusOK, gin.H{
			"success":  true,
			"message":  "MinIO connection successful",
			"duration": duration,
			"endpoint": network.TargetMinIOEndpoint,
			"bucket":   network.TargetMinIOBucket,
		})

	default:
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "error": "Unknown target source type"})
	}
}

// ReverseNetwork swaps source and target configurations
func (h *Handler) ReverseNetwork(c *gin.Context) {
	id := c.Param("id")

	var network core.Network
	if err := h.db.First(&network, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Network not found"})
		return
	}

	// Swap source type
	network.SourceType, network.TargetSourceType = network.TargetSourceType, network.SourceType

	// Swap Database config
	network.DBDriver, network.TargetDBDriver = network.TargetDBDriver, network.DBDriver
	network.DBHost, network.TargetDBHost = network.TargetDBHost, network.DBHost
	network.DBPort, network.TargetDBPort = network.TargetDBPort, network.DBPort
	network.DBUser, network.TargetDBUser = network.TargetDBUser, network.DBUser
	network.DBPassword, network.TargetDBPassword = network.TargetDBPassword, network.DBPassword
	network.DBName, network.TargetDBName = network.TargetDBName, network.DBName
	network.DBSSLMode, network.TargetDBSSLMode = network.TargetDBSSLMode, network.DBSSLMode

	// Swap FTP config
	network.FTPHost, network.TargetFTPHost = network.TargetFTPHost, network.FTPHost
	network.FTPPort, network.TargetFTPPort = network.TargetFTPPort, network.FTPPort
	network.FTPUser, network.TargetFTPUser = network.TargetFTPUser, network.FTPUser
	network.FTPPassword, network.TargetFTPPassword = network.TargetFTPPassword, network.FTPPassword
	network.FTPPrivateKey, network.TargetFTPPrivateKey = network.TargetFTPPrivateKey, network.FTPPrivateKey
	network.FTPPath, network.TargetFTPPath = network.TargetFTPPath, network.FTPPath

	// Swap API config
	network.APIURL, network.TargetAPIURL = network.TargetAPIURL, network.APIURL
	network.APIMethod, network.TargetAPIMethod = network.TargetAPIMethod, network.APIMethod
	network.APIHeaders, network.TargetAPIHeaders = network.TargetAPIHeaders, network.APIHeaders
	network.APIAuthType, network.TargetAPIAuthType = network.TargetAPIAuthType, network.APIAuthType
	network.APIAuthKey, network.TargetAPIAuthKey = network.TargetAPIAuthKey, network.APIAuthKey
	network.APIAuthValue, network.TargetAPIAuthValue = network.TargetAPIAuthValue, network.APIAuthValue
	network.APIBody, network.TargetAPIBody = network.TargetAPIBody, network.APIBody

	// Swap MinIO config
	network.MinIOEndpoint, network.TargetMinIOEndpoint = network.TargetMinIOEndpoint, network.MinIOEndpoint
	network.MinIOAccessKey, network.TargetMinIOAccessKey = network.TargetMinIOAccessKey, network.MinIOAccessKey
	network.MinIOSecretKey, network.TargetMinIOSecretKey = network.TargetMinIOSecretKey, network.MinIOSecretKey
	network.MinIOBucket, network.TargetMinIOBucket = network.TargetMinIOBucket, network.MinIOBucket
	network.MinIOObjectPath, network.TargetMinIOObjectPath = network.TargetMinIOObjectPath, network.MinIOObjectPath
	network.MinIOUseSSL, network.TargetMinIOUseSSL = network.TargetMinIOUseSSL, network.MinIOUseSSL
	network.MinIORegion, network.TargetMinIORegion = network.TargetMinIORegion, network.MinIORegion

	// Save the reversed network
	if err := h.db.Save(&network).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save reversed network"})
		return
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "REVERSE",
			Entity:    "NETWORK",
			EntityID:  id,
			Details:   fmt.Sprintf("Reversed source/target for network '%s'", network.Name),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, gin.H{
		"message": "Network source/target reversed successfully",
		"network": network,
	})
}

// GetAuditLogs retrieves audit logs with pagination and filters
func (h *Handler) GetAuditLogs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	action := c.Query("action")
	entity := c.Query("entity")

	offset := (page - 1) * limit

	logs := []core.AuditLog{}
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
	users := []core.User{}
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
	tokens := []core.AgentToken{}
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

// ListDatabaseSchemas lists all available schemas from a database connection
func (h *Handler) ListDatabaseSchemas(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid network ID"})
		return
	}

	var network core.Network
	if err := h.db.First(&network, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Network not found"})
		return
	}

	// Check if this network has database configuration
	if network.DBHost == "" || network.DBDriver == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This network does not have database configuration."})
		return
	}

	var schemas []string
	var dbErr error

	switch network.DBDriver {
	case "postgres", "postgresql":
		schemas, dbErr = h.listPostgresSchemas(&network)
	case "mysql":
		// MySQL uses database as schema, just return the current database
		schemas = []string{network.DBName}
	case "sqlserver", "mssql":
		schemas, dbErr = h.listSQLServerSchemas(&network)
	case "oracle":
		schemas, dbErr = h.listOracleSchemas(&network)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Schema listing not supported for driver: %s", network.DBDriver)})
		return
	}

	if dbErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to list schemas: %v", dbErr)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"schemas":      schemas,
		"total":        len(schemas),
		"network_id":   network.ID,
		"network_name": network.Name,
	})
}

func (h *Handler) listPostgresSchemas(network *core.Network) ([]string, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		network.DBHost, network.DBPort, network.DBUser, network.DBPassword, network.DBName, network.DBSSLMode)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("cannot connect to PostgreSQL: %v", err)
	}

	// Query non-system schemas
	query := `
		SELECT schema_name 
		FROM information_schema.schemata 
		WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
		ORDER BY schema_name
	`

	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var schemas []string
	for rows.Next() {
		var schemaName string
		if err := rows.Scan(&schemaName); err != nil {
			continue
		}
		schemas = append(schemas, schemaName)
	}
	return schemas, nil
}

func (h *Handler) listSQLServerSchemas(_ *core.Network) ([]string, error) {
	return nil, fmt.Errorf("sql server schema listing requires mssql driver - coming soon")
}

func (h *Handler) listOracleSchemas(_ *core.Network) ([]string, error) {
	return nil, fmt.Errorf("oracle schema listing requires Oracle client - coming soon")
}

// DiscoverTables lists all tables from a source database connection
// Accepts optional query param: ?schema=public (defaults to all non-system schemas for postgres)
func (h *Handler) DiscoverTables(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid network ID"})
		return
	}

	var network core.Network
	if err := h.db.First(&network, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Network not found"})
		return
	}

	// Check if this network has database configuration
	if network.DBHost == "" || network.DBDriver == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "This network does not have database configuration. Please configure DB Host and Driver."})
		return
	}

	// Get schema filter from query parameter
	schemaFilter := c.Query("schema")

	// Build connection string based on database driver
	var tables []map[string]interface{}
	var dbErr error

	switch network.DBDriver {
	case "postgres", "postgresql":
		tables, dbErr = h.discoverPostgresTables(&network, schemaFilter)
	case "mysql":
		tables, dbErr = h.discoverMySQLTables(&network)
	case "sqlserver", "mssql":
		tables, dbErr = h.discoverSQLServerTables(&network)
	case "oracle":
		tables, dbErr = h.discoverOracleTables(&network)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Table discovery not supported for driver: %s", network.DBDriver)})
		return
	}

	if dbErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to discover tables: %v", dbErr)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"tables":       tables,
		"total":        len(tables),
		"network_id":   network.ID,
		"network_name": network.Name,
		"db_type":      network.Type,
		"schema":       schemaFilter,
	})
}

func (h *Handler) discoverPostgresTables(network *core.Network, schemaFilter string) ([]map[string]interface{}, error) {
	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		network.DBHost, network.DBPort, network.DBUser, network.DBPassword, network.DBName, network.DBSSLMode)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("cannot connect to PostgreSQL: %v", err)
	}

	// Build WHERE clause based on schema filter
	var whereClause string
	var args []interface{}
	if schemaFilter != "" {
		// Filter by specific schema
		whereClause = "WHERE t.table_schema = $1 AND t.table_type = 'BASE TABLE'"
		args = append(args, schemaFilter)
	} else {
		// Show all non-system schemas
		whereClause = "WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast') AND t.table_type = 'BASE TABLE'"
	}

	query := fmt.Sprintf(`
		SELECT 
			t.table_name,
			t.table_schema,
			COALESCE(pgc.reltuples::bigint, 0) as row_count,
			array_to_string(array_agg(c.column_name ORDER BY c.ordinal_position), ', ') as columns
		FROM information_schema.tables t
		LEFT JOIN pg_class pgc ON pgc.relname = t.table_name AND pgc.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = t.table_schema)
		LEFT JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
		%s
		GROUP BY t.table_name, t.table_schema, pgc.reltuples
		ORDER BY t.table_schema, t.table_name
	`, whereClause)

	var rows *sql.Rows
	if len(args) > 0 {
		rows, err = db.Query(query, args...)
	} else {
		rows, err = db.Query(query)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []map[string]interface{}
	for rows.Next() {
		var tableName, tableSchema, columns string
		var rowCount int64
		if err := rows.Scan(&tableName, &tableSchema, &rowCount, &columns); err != nil {
			continue
		}
		tables = append(tables, map[string]interface{}{
			"table_name": tableName,
			"schema":     tableSchema,
			"row_count":  rowCount,
			"columns":    columns,
		})
	}
	return tables, nil
}

func (h *Handler) discoverMySQLTables(network *core.Network) ([]map[string]interface{}, error) {
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s",
		network.DBUser, network.DBPassword, network.DBHost, network.DBPort, network.DBName)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("cannot connect to MySQL: %v", err)
	}

	query := `
		SELECT 
			t.TABLE_NAME,
			t.TABLE_SCHEMA,
			COALESCE(t.TABLE_ROWS, 0) as row_count,
			IFNULL(GROUP_CONCAT(c.COLUMN_NAME ORDER BY c.ORDINAL_POSITION SEPARATOR ', '), '') as columns
		FROM information_schema.TABLES t
		LEFT JOIN information_schema.COLUMNS c ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
		WHERE t.TABLE_SCHEMA = ?
		  AND t.TABLE_TYPE = 'BASE TABLE'
		GROUP BY t.TABLE_NAME, t.TABLE_SCHEMA, t.TABLE_ROWS
		ORDER BY t.TABLE_NAME
	`

	rows, err := db.Query(query, network.DBName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []map[string]interface{}
	for rows.Next() {
		var tableName, tableSchema, columns string
		var rowCount int64
		if err := rows.Scan(&tableName, &tableSchema, &rowCount, &columns); err != nil {
			continue
		}
		tables = append(tables, map[string]interface{}{
			"table_name": tableName,
			"schema":     tableSchema,
			"row_count":  rowCount,
			"columns":    columns,
		})
	}
	return tables, nil
}

func (h *Handler) discoverSQLServerTables(_ *core.Network) ([]map[string]interface{}, error) {
	// SQL Server requires mssql driver - return placeholder for now
	return nil, fmt.Errorf("sql server discovery requires mssql driver - coming soon")
}

func (h *Handler) discoverOracleTables(_ *core.Network) ([]map[string]interface{}, error) {
	// Oracle requires Oracle client - return placeholder for now
	return nil, fmt.Errorf("oracle discovery requires Oracle client - coming soon")
}

// BulkCreateSchemas creates multiple schemas at once from selected tables
func (h *Handler) BulkCreateSchemas(c *gin.Context) {
	var req struct {
		NetworkID int      `json:"network_id"`
		Tables    []string `json:"tables"`
		Prefix    string   `json:"prefix"`    // Optional prefix for schema names
		DBSchema  string   `json:"db_schema"` // Database schema (e.g., 'apps_paspor', 'public')
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if len(req.Tables) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No tables selected"})
		return
	}

	// Verify network exists
	var network core.Network
	if err := h.db.First(&network, req.NetworkID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Network not found"})
		return
	}

	userID := c.GetUint("user_id")
	createdSchemas := []core.Schema{}
	errors := []string{}

	for _, tableName := range req.Tables {
		schemaName := tableName
		if req.Prefix != "" {
			schemaName = req.Prefix + "_" + tableName
		}

		// Generate SQL based on database type, include schema prefix if provided
		var sqlCommand string
		switch network.Type {
		case "postgresql":
			if req.DBSchema != "" && req.DBSchema != "public" {
				sqlCommand = fmt.Sprintf(`SELECT * FROM "%s"."%s"`, req.DBSchema, tableName)
			} else {
				sqlCommand = fmt.Sprintf(`SELECT * FROM "%s"`, tableName)
			}
		case "mysql":
			sqlCommand = fmt.Sprintf("SELECT * FROM `%s`", tableName)
		case "sqlserver":
			if req.DBSchema != "" && req.DBSchema != "dbo" {
				sqlCommand = fmt.Sprintf("SELECT * FROM [%s].[%s]", req.DBSchema, tableName)
			} else {
				sqlCommand = fmt.Sprintf("SELECT * FROM [%s]", tableName)
			}
		case "oracle":
			if req.DBSchema != "" {
				sqlCommand = fmt.Sprintf(`SELECT * FROM "%s"."%s"`, req.DBSchema, tableName)
			} else {
				sqlCommand = fmt.Sprintf(`SELECT * FROM "%s"`, tableName)
			}
		default:
			if req.DBSchema != "" {
				sqlCommand = fmt.Sprintf("SELECT * FROM %s.%s", req.DBSchema, tableName)
			} else {
				sqlCommand = fmt.Sprintf("SELECT * FROM %s", tableName)
			}
		}

		schema := core.Schema{
			Name:       schemaName,
			SourceType: "query",
			SQLCommand: sqlCommand,
			CreatedBy:  userID,
			UpdatedBy:  userID,
		}

		if err := h.db.Create(&schema).Error; err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", tableName, err))
			continue
		}
		createdSchemas = append(createdSchemas, schema)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"created": len(createdSchemas),
		"schemas": createdSchemas,
		"errors":  errors,
		"message": fmt.Sprintf("Created %d schemas from %d tables", len(createdSchemas), len(req.Tables)),
	})
}

// ExecuteAgentCommand sends a command to an agent for remote execution
// Admin only - for remote terminal console feature
func (h *Handler) ExecuteAgentCommand(c *gin.Context) {
	agentName := c.Param("name")

	var req struct {
		Command string `json:"command" binding:"required"`
		Timeout int    `json:"timeout"` // Timeout in seconds, default 30
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Command is required"})
		return
	}

	// Validate command is not empty
	if req.Command == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Command cannot be empty"})
		return
	}

	// Set default timeout
	if req.Timeout <= 0 {
		req.Timeout = 30
	}
	if req.Timeout > 300 {
		req.Timeout = 300 // Max 5 minutes
	}

	// Get user info for audit
	userID := c.GetUint("user_id")
	username := c.GetString("username")

	// Check if agent is connected
	if h.agentListener == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Agent listener not available"})
		return
	}

	// Create audit log entry
	auditLog := core.AuditLog{
		UserID:    userID,
		Username:  username,
		Action:    "EXEC_COMMAND",
		Entity:    "AGENT",
		EntityID:  "",
		Details:   fmt.Sprintf("Agent: %s, Command: %s", agentName, req.Command),
		IPAddress: c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		CreatedAt: time.Now(),
	}
	h.db.Create(&auditLog)

	// Send command to agent
	command := core.AgentMessage{
		Type:      "EXEC_COMMAND",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"command":    req.Command,
			"timeout":    req.Timeout,
			"request_id": auditLog.ID, // Link response to audit log
		},
	}

	// Send and wait for response
	result, err := h.agentListener.SendCommandAndWait(agentName, command, time.Duration(req.Timeout)*time.Second)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"agent":   agentName,
			"command": req.Command,
		})
		return
	}

	// Return result
	c.JSON(http.StatusOK, gin.H{
		"success":   true,
		"agent":     agentName,
		"command":   req.Command,
		"output":    result["output"],
		"exit_code": result["exit_code"],
		"error":     result["error"],
		"duration":  result["duration"],
	})
}

// GetAgentTerminalHistory returns command execution history for an agent
func (h *Handler) GetAgentTerminalHistory(c *gin.Context) {
	agentName := c.Param("name")

	var logs []core.AuditLog
	h.db.Where("action = ? AND details LIKE ?", "EXEC_COMMAND", fmt.Sprintf("Agent: %s%%", agentName)).
		Order("created_at DESC").
		Limit(100).
		Find(&logs)

	c.JSON(http.StatusOK, logs)
}

// ExecuteQuery sends an SQL query to an agent for remote execution
func (h *Handler) ExecuteQuery(c *gin.Context) {
	agentName := c.Param("name")

	var req struct {
		Query    string                 `json:"query" binding:"required"`
		Timeout  int                    `json:"timeout"` // Timeout in seconds, default 30
		DBConfig map[string]interface{} `json:"db_config"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query is required"})
		return
	}

	// Set default timeout
	if req.Timeout <= 0 {
		req.Timeout = 60 // DB queries might take longer than shell commands
	}

	// Get user info for audit
	userID := c.GetUint("user_id")
	username := c.GetString("username")

	// Check if agent is connected
	if h.agentListener == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Agent listener not available"})
		return
	}

	// Create audit log entry
	auditLog := core.AuditLog{
		UserID:    userID,
		Username:  username,
		Action:    "EXEC_QUERY",
		Entity:    "AGENT",
		EntityID:  "",
		Details:   fmt.Sprintf("Agent: %s, Query: %s", agentName, req.Query),
		IPAddress: c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		CreatedAt: time.Now(),
	}
	h.db.Create(&auditLog)

	// Send command to agent
	command := core.AgentMessage{
		Type:      "RUN_QUERY",
		Timestamp: time.Now(),
		Data: map[string]interface{}{
			"query":      req.Query,
			"timeout":    req.Timeout,
			"db_config":  req.DBConfig,
			"request_id": auditLog.ID,
		},
	}

	// Send and wait for response
	result, err := h.agentListener.SendCommandAndWait(agentName, command, time.Duration(req.Timeout)*time.Second)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   err.Error(),
			"agent":   agentName,
			"query":   req.Query,
			"success": false,
		})
		return
	}

	// Return result
	c.JSON(http.StatusOK, result)
}

// ==================== BACKUP & RESTORE HANDLERS ====================

// CreateBackup creates a new backup of database, config, and certs
func (h *Handler) CreateBackup(c *gin.Context) {
	filename, err := backup.CreateBackup(backup.DefaultBackupDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "CREATE",
			Entity:    "BACKUP",
			EntityID:  filename,
			Details:   fmt.Sprintf("Created backup: %s", filename),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, gin.H{
		"success":  true,
		"message":  "Backup created successfully",
		"filename": filename,
	})
}

// ListBackups returns all available backups
func (h *Handler) ListBackups(c *gin.Context) {
	backups, err := backup.ListBackups(backup.DefaultBackupDir)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"backups": backups,
		"total":   len(backups),
	})
}

// DownloadBackup serves a backup file for download
func (h *Handler) DownloadBackup(c *gin.Context) {
	filename := c.Param("filename")

	path, err := backup.GetBackupPath(backup.DefaultBackupDir, filename)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "DOWNLOAD",
			Entity:    "BACKUP",
			EntityID:  filename,
			Details:   fmt.Sprintf("Downloaded backup: %s", filename),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "application/zip")
	c.File(path)
}

// RestoreBackup uploads and restores a backup file
func (h *Handler) RestoreBackup(c *gin.Context) {
	// Get uploaded file
	file, header, err := c.Request.FormFile("backup")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No backup file provided"})
		return
	}
	defer file.Close()

	// Validate file extension
	if filepath.Ext(header.Filename) != ".zip" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid file format. Please upload a .zip backup file"})
		return
	}

	// Save uploaded file temporarily
	tempPath := filepath.Join(os.TempDir(), "dsp_restore_"+header.Filename)
	dest, err := os.Create(tempPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save uploaded file"})
		return
	}
	defer dest.Close()
	defer os.Remove(tempPath) // Clean up temp file

	if _, err := io.Copy(dest, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save uploaded file"})
		return
	}

	// Close the dest file before restore to release any locks
	dest.Close()

	// Log audit before restore
	h.db.Create(&core.AuditLog{
		Username:  c.GetString("username"),
		UserID:    c.GetUint("user_id"),
		Action:    "RESTORE",
		Entity:    "BACKUP",
		EntityID:  header.Filename,
		Details:   fmt.Sprintf("Restored backup: %s", header.Filename),
		IPAddress: c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
		CreatedAt: time.Now(),
	})

	// Perform restore
	if err := backup.RestoreBackup(tempPath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Restore failed: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":        true,
		"message":        "Backup restored successfully. Please restart the server for changes to take effect.",
		"restart_needed": true,
	})
}

// DeleteBackup deletes a backup file
func (h *Handler) DeleteBackup(c *gin.Context) {
	filename := c.Param("filename")

	if err := backup.DeleteBackup(backup.DefaultBackupDir, filename); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	// Log audit
	go func() {
		h.db.Create(&core.AuditLog{
			Username:  c.GetString("username"),
			UserID:    c.GetUint("user_id"),
			Action:    "DELETE",
			Entity:    "BACKUP",
			EntityID:  filename,
			Details:   fmt.Sprintf("Deleted backup: %s", filename),
			IPAddress: c.ClientIP(),
			UserAgent: c.Request.UserAgent(),
			CreatedAt: time.Now(),
		})
	}()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Backup deleted successfully",
	})
}
