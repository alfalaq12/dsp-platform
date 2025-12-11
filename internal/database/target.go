package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
)

// TargetConfig holds target database connection configuration
type TargetConfig struct {
	Driver   string
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// TargetConnection wraps target database connection
type TargetConnection struct {
	DB     *sql.DB
	Config TargetConfig
}

// LoadTargetConfigFromEnv loads target database config from environment
func LoadTargetConfigFromEnv() TargetConfig {
	return TargetConfig{
		Driver:   getEnvOrDefault("TARGET_DB_DRIVER", "postgres"),
		Host:     getEnvOrDefault("TARGET_DB_HOST", "localhost"),
		Port:     getEnvOrDefault("TARGET_DB_PORT", "5432"),
		User:     getEnvOrDefault("TARGET_DB_USER", "postgres"),
		Password: getEnvOrDefault("TARGET_DB_PASSWORD", ""),
		DBName:   getEnvOrDefault("TARGET_DB_NAME", "dsp_sync"),
		SSLMode:  getEnvOrDefault("TARGET_DB_SSLMODE", "disable"),
	}
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// ConnectTarget establishes connection to target database
func ConnectTarget(config TargetConfig) (*TargetConnection, error) {
	var connStr string

	switch config.Driver {
	case "postgres":
		connStr = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			config.Host, config.Port, config.User,
			config.Password, config.DBName, config.SSLMode,
		)
	case "mysql":
		connStr = fmt.Sprintf(
			"%s:%s@tcp(%s:%s)/%s",
			config.User, config.Password, config.Host, config.Port, config.DBName,
		)
	default:
		return nil, fmt.Errorf("unsupported driver: %s", config.Driver)
	}

	db, err := sql.Open(config.Driver, connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open target database: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(time.Hour)

	// Test connection
	if err = db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping target database: %w", err)
	}

	log.Printf("Connected to target database: %s@%s:%s/%s", config.User, config.Host, config.Port, config.DBName)

	return &TargetConnection{
		DB:     db,
		Config: config,
	}, nil
}

// Close closes target database connection
func (tc *TargetConnection) Close() error {
	if tc.DB != nil {
		return tc.DB.Close()
	}
	return nil
}

// EnsureTable creates target table if not exists based on data structure
func (tc *TargetConnection) EnsureTable(tableName string, sampleRecord map[string]interface{}) error {
	if tableName == "" {
		return fmt.Errorf("table name is empty")
	}

	// Check if table exists
	var exists bool
	query := fmt.Sprintf("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '%s')", tableName)
	err := tc.DB.QueryRow(query).Scan(&exists)
	if err != nil {
		return fmt.Errorf("failed to check table existence: %w", err)
	}

	if exists {
		log.Printf("Table %s already exists", tableName)
		return nil
	}

	// Build CREATE TABLE statement from sample record
	var columns []string
	for colName, value := range sampleRecord {
		colType := inferPostgresType(value)
		columns = append(columns, fmt.Sprintf("\"%s\" %s", colName, colType))
	}

	createSQL := fmt.Sprintf("CREATE TABLE IF NOT EXISTS \"%s\" (%s)", tableName, strings.Join(columns, ", "))
	log.Printf("Creating table: %s", createSQL)

	_, err = tc.DB.Exec(createSQL)
	if err != nil {
		return fmt.Errorf("failed to create table: %w", err)
	}

	log.Printf("Table %s created successfully", tableName)
	return nil
}

// inferPostgresType infers PostgreSQL column type from Go value
func inferPostgresType(value interface{}) string {
	switch value.(type) {
	case int, int32, int64, float64:
		if _, ok := value.(float64); ok {
			// Check if it's actually an integer
			f := value.(float64)
			if f == float64(int64(f)) {
				return "BIGINT"
			}
			return "DOUBLE PRECISION"
		}
		return "BIGINT"
	case bool:
		return "BOOLEAN"
	case nil:
		return "TEXT"
	default:
		return "TEXT"
	}
}

// InsertBatch inserts records into target table with conflict handling (skip on conflict)
func (tc *TargetConnection) InsertBatch(tableName string, records []map[string]interface{}) (int, error) {
	if len(records) == 0 {
		return 0, nil
	}

	// Get column names from first record
	var columns []string
	for col := range records[0] {
		columns = append(columns, col)
	}

	// Build insert statement
	insertedCount := 0
	for _, record := range records {
		var values []interface{}
		var placeholders []string

		for i, col := range columns {
			values = append(values, record[col])
			placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
		}

		// PostgreSQL: INSERT ... ON CONFLICT DO NOTHING (skip duplicates)
		insertSQL := fmt.Sprintf(
			"INSERT INTO \"%s\" (\"%s\") VALUES (%s) ON CONFLICT DO NOTHING",
			tableName,
			strings.Join(columns, "\", \""),
			strings.Join(placeholders, ", "),
		)

		result, err := tc.DB.Exec(insertSQL, values...)
		if err != nil {
			log.Printf("Insert error (skipping): %v", err)
			continue
		}

		affected, _ := result.RowsAffected()
		insertedCount += int(affected)
	}

	return insertedCount, nil
}

// UpsertBatch inserts or updates records based on unique key column
func (tc *TargetConnection) UpsertBatch(tableName string, records []map[string]interface{}, uniqueKeyColumn string) (int, error) {
	if len(records) == 0 {
		return 0, nil
	}

	// If no unique key specified, fall back to regular insert
	if uniqueKeyColumn == "" {
		return tc.InsertBatch(tableName, records)
	}

	// Get column names from first record
	var columns []string
	for col := range records[0] {
		columns = append(columns, col)
	}

	// Build update set clause (exclude the unique key)
	var updateClauses []string
	for _, col := range columns {
		if col != uniqueKeyColumn {
			updateClauses = append(updateClauses, fmt.Sprintf("\"%s\" = EXCLUDED.\"%s\"", col, col))
		}
	}

	upsertedCount := 0
	for _, record := range records {
		var values []interface{}
		var placeholders []string

		for i, col := range columns {
			values = append(values, record[col])
			placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
		}

		// PostgreSQL: INSERT ... ON CONFLICT DO UPDATE
		upsertSQL := fmt.Sprintf(
			"INSERT INTO \"%s\" (\"%s\") VALUES (%s) ON CONFLICT (\"%s\") DO UPDATE SET %s",
			tableName,
			strings.Join(columns, "\", \""),
			strings.Join(placeholders, ", "),
			uniqueKeyColumn,
			strings.Join(updateClauses, ", "),
		)

		result, err := tc.DB.Exec(upsertSQL, values...)
		if err != nil {
			log.Printf("Upsert error (skipping): %v - SQL: %s", err, upsertSQL)
			continue
		}

		affected, _ := result.RowsAffected()
		upsertedCount += int(affected)
	}

	log.Printf("Upserted %d records to %s (unique key: %s)", upsertedCount, tableName, uniqueKeyColumn)
	return upsertedCount, nil
}
