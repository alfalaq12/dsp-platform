package main

import (
	"dsp-platform/internal/auth"
	"dsp-platform/internal/core"
	"dsp-platform/internal/logger"
	"dsp-platform/internal/security"
	"dsp-platform/internal/server"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/gorm"

	sqlite "github.com/glebarez/sqlite" // Pure Go SQLite driver for GORM
)

const (
	WebPort   = "441"
	AgentPort = "447"
)

func init() {
	// Robust .env loading: Try loading from executable directory first
	ex, err := os.Executable()
	if err == nil {
		exPath := filepath.Dir(ex)
		envPath := filepath.Join(exPath, ".env")
		godotenv.Load(envPath)
	}
	// Fallback to default load (current directory)
	godotenv.Load()
}

func main() {
	// Initialize logger
	if err := logger.Init(logger.DefaultConfig()); err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}

	// Load TLS configuration
	tlsConfig := security.LoadTLSConfigFromEnv()

	// Log startup with TLS status
	logger.Logger.Info().
		Str("web_port", WebPort).
		Str("agent_port", AgentPort).
		Bool("tls_enabled", tlsConfig.Enabled).
		Msg("Starting DSP Platform Master Server")

	// Auto-generate certificates if TLS enabled but certs don't exist
	if tlsConfig.Enabled {
		if _, err := os.Stat(tlsConfig.CertPath); os.IsNotExist(err) {
			logger.Logger.Info().Msg("TLS certificates not found, generating self-signed certificates...")
			if err := security.GenerateSelfSignedCert("./certs", []string{"localhost", "127.0.0.1"}); err != nil {
				logger.Logger.Error().Err(err).Msg("Failed to auto-generate certificates")
				logger.Logger.Warn().Msg("Falling back to non-TLS mode")
				tlsConfig.Enabled = false
			} else {
				logger.Logger.Info().Msg("✅ Self-signed certificates generated successfully")
			}
		}
	}

	// Initialize database
	db, err := initDatabase()
	if err != nil {
		logger.Logger.Fatal().Err(err).Msg("Failed to initialize database")
	}

	// Create handler
	handler := server.NewHandler(db)

	// Start agent listener in goroutine (with TLS if enabled)
	var agentListener *server.AgentListener
	if tlsConfig.Enabled {
		agentListener = server.NewAgentListenerWithTLS(handler, AgentPort, tlsConfig)
	} else {
		agentListener = server.NewAgentListener(handler, AgentPort)
	}
	go func() {
		logger.Logger.Info().Str("port", AgentPort).Bool("tls", tlsConfig.Enabled).Msg("Starting agent listener")
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

	// Setup HTTP/HTTPS server
	router := setupRouter(handler)

	// Graceful shutdown - Start web server
	go func() {
		if tlsConfig.Enabled {
			logger.Logger.Info().
				Str("port", WebPort).
				Str("protocol", "HTTPS").
				Msg("🔒 Starting HTTPS server")
			if err := router.RunTLS(":"+WebPort, tlsConfig.CertPath, tlsConfig.KeyPath); err != nil {
				logger.Logger.Fatal().Err(err).Msg("Failed to start HTTPS server")
			}
		} else {
			logger.Logger.Info().
				Str("port", WebPort).
				Str("protocol", "HTTP").
				Msg("⚠️ Starting HTTP server (NO TLS - INSECURE!)")
			if err := router.Run(":" + WebPort); err != nil {
				logger.Logger.Fatal().Err(err).Msg("Failed to start HTTP server")
			}
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
		&core.AuditLog{},
		&core.Settings{},
	); err != nil {
		logger.Logger.Error().Err(err).Msg("Database migration failed")
		return nil, err
	}

	// Migrate existing preset schedules to cron expressions
	migratePresetSchedulesToCron(db)

	logger.Logger.Info().Msg("Database initialized and migrated successfully")
	return db, nil
}

// migratePresetSchedulesToCron converts old preset schedules to cron expressions
func migratePresetSchedulesToCron(db *gorm.DB) {
	presetMap := map[string]string{
		"1min":   "*/1 * * * *",
		"5min":   "*/5 * * * *",
		"10min":  "*/10 * * * *",
		"15min":  "*/15 * * * *",
		"30min":  "*/30 * * * *",
		"1hour":  "0 * * * *",
		"3hour":  "0 */3 * * *",
		"6hour":  "0 */6 * * *",
		"12hour": "0 */12 * * *",
		"daily":  "0 0 * * *",
		"weekly": "0 0 * * 0",
	}

	for preset, cronExpr := range presetMap {
		result := db.Model(&core.Job{}).Where("schedule = ?", preset).Update("schedule", cronExpr)
		if result.RowsAffected > 0 {
			logger.Logger.Info().
				Str("preset", preset).
				Str("cron", cronExpr).
				Int64("count", result.RowsAffected).
				Msg("Migrated preset schedules to cron")
		}
	}
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
		api.POST("/schemas", auth.RequireRole("admin"), handler.CreateSchema)
		api.PUT("/schemas/:id", auth.RequireRole("admin"), handler.UpdateSchema)
		api.DELETE("/schemas/:id", auth.RequireRole("admin"), handler.DeleteSchema)

		// Network routes
		api.GET("/networks", handler.GetNetworks)
		api.POST("/networks", auth.RequireRole("admin"), handler.CreateNetwork)
		api.PUT("/networks/:id", auth.RequireRole("admin"), handler.UpdateNetwork)
		api.DELETE("/networks/:id", auth.RequireRole("admin"), handler.DeleteNetwork)

		// Job routes
		api.GET("/jobs", handler.GetJobs)
		api.POST("/jobs", auth.RequireRole("admin"), handler.CreateJob)
		api.GET("/jobs/:id", handler.GetJob)
		api.GET("/jobs/:id/logs", handler.GetJobLogs)
		api.GET("/notifications", handler.GetRecentJobLogs)
		api.PUT("/jobs/:id", auth.RequireRole("admin"), handler.UpdateJob)
		api.DELETE("/jobs/:id", auth.RequireRole("admin"), handler.DeleteJob)
		api.POST("/jobs/:id/run", auth.RequireRole("admin"), handler.RunJob)
		api.POST("/jobs/:id/toggle", auth.RequireRole("admin"), handler.ToggleJob)

		// Agent config endpoint
		api.GET("/jobs/agent/:name", handler.GetAgentJobs)

		// Settings routes
		api.GET("/settings", handler.GetSettings)
		api.POST("/settings", auth.RequireRole("admin"), handler.UpdateSetting)
		api.GET("/settings/target-db", handler.GetTargetDBConfig)
		api.POST("/settings/target-db", auth.RequireRole("admin"), handler.UpdateTargetDBConfig)
		api.POST("/settings/target-db/test", auth.RequireRole("admin"), handler.TestTargetDBConnection)

		// Network test connection
		api.POST("/networks/:id/test", auth.RequireRole("admin"), handler.TestNetworkConnection)

		// Audit Logs (Viewable by admin only usually, or maybe all? Let's restrict to admin for now based on Sidebar)
		api.GET("/audit-logs", auth.RequireRole("admin"), handler.GetAuditLogs)

		// User Management
		api.GET("/users", auth.RequireRole("admin"), handler.GetUsers) // Only admin can list users
		api.POST("/users", auth.RequireRole("admin"), handler.CreateUser)
		api.PUT("/users/:id", auth.RequireRole("admin"), handler.UpdateUser)
		api.DELETE("/users/:id", auth.RequireRole("admin"), handler.DeleteUser)
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
