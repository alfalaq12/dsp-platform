package logger

import (
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"gopkg.in/natefinch/lumberjack.v2"
)

var Logger zerolog.Logger

// LogConfig holds logging configuration
type LogConfig struct {
	Level      string // debug, info, warn, error
	OutputPath string // log file path
	MaxSize    int    // MB
	MaxBackups int    // number of backups
	MaxAge     int    // days
	Compress   bool   // compress old logs
	Console    bool   // also output to console
}

// DefaultConfig returns default logging configuration
func DefaultConfig() *LogConfig {
	return &LogConfig{
		Level:      getEnv("LOG_LEVEL", "info"),
		OutputPath: getEnv("LOG_FILE", "logs/dsp-platform.log"),
		MaxSize:    100, // 100 MB
		MaxBackups: 5,
		MaxAge:     30, // 30 days
		Compress:   true,
		Console:    true,
	}
}

// Init initializes the global logger
func Init(config *LogConfig) error {
	// Create log directory if not exists
	logDir := filepath.Dir(config.OutputPath)
	if err := os.MkdirAll(logDir, 0755); err != nil {
		return err
	}

	// Configure log rotation
	fileWriter := &lumberjack.Logger{
		Filename:   config.OutputPath,
		MaxSize:    config.MaxSize,
		MaxBackups: config.MaxBackups,
		MaxAge:     config.MaxAge,
		Compress:   config.Compress,
	}

	// Set log level
	level, err := zerolog.ParseLevel(config.Level)
	if err != nil {
		level = zerolog.InfoLevel
	}
	zerolog.SetGlobalLevel(level)

	// Configure output
	var writers []io.Writer

	// File output
	writers = append(writers, fileWriter)

	// Console output (pretty format for development)
	if config.Console {
		consoleWriter := zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
			NoColor:    false,
		}
		writers = append(writers, consoleWriter)
	}

	// Multi-writer (file + console)
	multi := io.MultiWriter(writers...)

	// Create logger
	Logger = zerolog.New(multi).
		With().
		Timestamp().
		Caller().
		Logger()

	log.Logger = Logger

	Logger.Info().
		Str("level", config.Level).
		Str("log_file", config.OutputPath).
		Msg("Logger initialized")

	return nil
}

// Info logs an info message
func Info(msg string) *zerolog.Event {
	return Logger.Info()
}

// Debug logs a debug message
func Debug(msg string) *zerolog.Event {
	return Logger.Debug()
}

// Warn logs a warning message
func Warn(msg string) *zerolog.Event {
	return Logger.Warn()
}

// Error logs an error message
func Error(msg string) *zerolog.Event {
	return Logger.Error()
}

// Fatal logs a fatal message and exits
func Fatal(msg string) *zerolog.Event {
	return Logger.Fatal()
}

// getEnv gets environment variable with fallback
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
