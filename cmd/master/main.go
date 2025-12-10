package main

import (
	"dsp-platform/internal/auth"
	"dsp-platform/internal/core"
	"dsp-platform/internal/logger"
	"dsp-platform/internal/server"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	sqlite "github.com/glebarez/sqlite" // Pure Go SQLite driver for GORM
)

const (
	WebPort   = "441"
	AgentPort = "447"
)

func main() {
	// Initialize logger
	if err := logger.Init(logger.DefaultConfig()); err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}

	logger.Logger.Info().
		Str("web_port", WebPort).
		Str("agent_port", AgentPort).
		Msg("Starting DSP Platform Master Server")

	// Initialize database
	db, err := initDatabase()
	if err != nil {
		logger.Logger.Fatal().Err(err).Msg("Failed to initialize database")
	}

	// Create handler
	handler := server.NewHandler(db)

	// Start agent listener in goroutine
	agentListener := server.NewAgentListener(handler, AgentPort)
	go func() {
		logger.Logger.Info().Str("port", AgentPort).Msg("Starting agent listener")
		if err := agentListener.Start(); err != nil {
			logger.Logger.Fatal().Err(err).Msg("Agent listener error")
		}
	}()

	// Start scheduler in goroutine
	scheduler := server.NewScheduler(db, agentListener)
	go func() {
		logger.Logger.Info().Msg("Starting job scheduler")
		scheduler.Start()
	}()

	// Setup HTTP server
	router := setupRouter(handler)

	// Graceful shutdown
	go func() {
		logger.Logger.Info().Str("port", WebPort).Msg("Starting HTTP server")
		if err := router.Run(":" + WebPort); err != nil {
			logger.Logger.Fatal().Err(err).Msg("Failed to start HTTP server")
		}
	}()

	// Wait for interrupt signal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Logger.Info().Msg("Received shutdown signal, gracefully shutting down...")
}

// initDatabase initializes the SQLite database and runs migrations
func initDatabase() (*gorm.DB, error) {
	// Using pure Go SQLite driver (glebarez/sqlite wraps modernc.org/sqlite)
	// No CGO required - works on Windows without gcc
	logger.Logger.Info().Str("database", "dsp.db").Msg("Initializing database")

	db, err := gorm.Open(sqlite.Open("dsp.db"), &gorm.Config{})
	if err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to open database")
		return nil, err
	}

	// Auto-migrate database schema
	logger.Logger.Info().Msg("Running database migrations")
	if err := db.AutoMigrate(
		&core.User{},
		&core.Schema{},
		&core.Network{},
		&core.Job{},
		&core.JobLog{},
		&core.Settings{},
	); err != nil {
		logger.Logger.Error().Err(err).Msg("Database migration failed")
		return nil, err
	}

	logger.Logger.Info().Msg("Database initialized and migrated successfully")
	return db, nil
}

// setupRouter configures the Gin router with all routes
func setupRouter(handler *server.Handler) *gin.Engine {
	router := gin.Default()

	// CORS middleware for development
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Public routes
	router.POST("/api/login", handler.Login)
	router.POST("/api/logout", handler.Logout)

	// Protected routes (require authentication)
	api := router.Group("/api")
	api.Use(auth.AuthMiddleware())
	{
		// Schema routes
		api.GET("/schemas", handler.GetSchemas)
		api.POST("/schemas", handler.CreateSchema)
		api.PUT("/schemas/:id", handler.UpdateSchema)
		api.DELETE("/schemas/:id", handler.DeleteSchema)

		// Network routes
		api.GET("/networks", handler.GetNetworks)
		api.POST("/networks", handler.CreateNetwork)
		api.PUT("/networks/:id", handler.UpdateNetwork)
		api.DELETE("/networks/:id", handler.DeleteNetwork)

		// Job routes
		api.GET("/jobs", handler.GetJobs)
		api.POST("/jobs", handler.CreateJob)
		api.GET("/jobs/:id", handler.GetJob)
		api.GET("/jobs/:id/logs", handler.GetJobLogs)
		api.PUT("/jobs/:id", handler.UpdateJob)
		api.DELETE("/jobs/:id", handler.DeleteJob)
		api.POST("/jobs/:id/run", handler.RunJob)
		api.POST("/jobs/:id/toggle", handler.ToggleJob)

		// Agent config endpoint
		api.GET("/jobs/agent/:name", handler.GetAgentJobs)

		// Settings routes
		api.GET("/settings", handler.GetSettings)
		api.POST("/settings", handler.UpdateSetting)
		api.GET("/settings/target-db", handler.GetTargetDBConfig)
		api.POST("/settings/target-db", handler.UpdateTargetDBConfig)
		api.POST("/settings/target-db/test", handler.TestTargetDBConnection)

		// Network test connection
		api.POST("/networks/:id/test", handler.TestNetworkConnection)
	}

	// Health check
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// Serve static files from frontend/dist for production
	// Check if dist folder exists
	distPath := "frontend/dist"
	if _, err := os.Stat(distPath); err == nil {
		logger.Logger.Info().Str("path", distPath).Msg("Serving frontend static files")

		// Serve static assets (JS, CSS, images)
		router.Static("/assets", distPath+"/assets")

		// Serve index.html for all non-API routes (SPA support)
		router.NoRoute(func(c *gin.Context) {
			// Don't serve index.html for API routes
			if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
				c.JSON(404, gin.H{"error": "API endpoint not found"})
				return
			}
			c.File(distPath + "/index.html")
		})
	} else {
		logger.Logger.Warn().Msg("Frontend dist folder not found. Run 'npm run build' in frontend directory.")
	}

	return router
}
