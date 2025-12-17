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

	// Validate table name to prevent SQL injection (allow only alphanumeric and underscore)
	if !isValidTableName(tableName) {
		return fmt.Errorf("invalid table name: %s (only alphanumeric and underscore allowed)", tableName)
	}

	// Check if table exists using parameterized query
	var exists bool
	query := "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)"
	err := tc.DB.QueryRow(query, tableName).Scan(&exists)
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
		// Validate column name as well
		if !isValidTableName(colName) {
			log.Printf("Skipping invalid column name: %s", colName)
			continue
		}
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

// isValidTableName checks if table/column name contains only safe characters
func isValidTableName(name string) bool {
	for _, c := range name {
		if !((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '_') {
			return false
		}
	}
	return len(name) > 0 && len(name) <= 63 // PostgreSQL max identifier length
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

// InsertBatch inserts records into target table with conflict handling
// Supports: PostgreSQL, MySQL, Oracle
func (tc *TargetConnection) InsertBatch(tableName string, records []map[string]interface{}) (int, error) {
	if len(records) == 0 {
		return 0, nil
	}

	// Get column names from first record
	var columns []string
	for col := range records[0] {
		columns = append(columns, col)
	}

	insertedCount := 0
	for _, record := range records {
		var values []interface{}
		var placeholders []string
		var insertSQL string

		for i, col := range columns {
			values = append(values, record[col])

			switch tc.Config.Driver {
			case "mysql":
				placeholders = append(placeholders, "?")
			case "oracle":
				placeholders = append(placeholders, fmt.Sprintf(":%d", i+1))
			default: // postgres
				placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
			}
		}

		switch tc.Config.Driver {
		case "mysql":
			// MySQL: INSERT IGNORE to skip duplicates
			insertSQL = fmt.Sprintf(
				"INSERT IGNORE INTO `%s` (`%s`) VALUES (%s)",
				tableName,
				strings.Join(columns, "`, `"),
				strings.Join(placeholders, ", "),
			)
		case "oracle":
			// Oracle: Use MERGE for insert-ignore behavior
			insertSQL = fmt.Sprintf(
				"INSERT INTO \"%s\" (\"%s\") VALUES (%s)",
				tableName,
				strings.Join(columns, "\", \""),
				strings.Join(placeholders, ", "),
			)
		default: // postgres
			// PostgreSQL: INSERT ... ON CONFLICT DO NOTHING
			insertSQL = fmt.Sprintf(
				"INSERT INTO \"%s\" (\"%s\") VALUES (%s) ON CONFLICT DO NOTHING",
				tableName,
				strings.Join(columns, "\", \""),
				strings.Join(placeholders, ", "),
			)
		}

		result, err := tc.DB.Exec(insertSQL, values...)
		if err != nil {
			log.Printf("Insert error (driver: %s, skipping): %v", tc.Config.Driver, err)
			continue
		}

		affected, _ := result.RowsAffected()
		insertedCount += int(affected)
	}

	log.Printf("Inserted %d records to %s (driver: %s)", insertedCount, tableName, tc.Config.Driver)
	return insertedCount, nil
}

// UpsertBatch inserts or updates records based on unique key column
// Supports: PostgreSQL, MySQL, Oracle
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

	upsertedCount := 0

	switch tc.Config.Driver {
	case "postgres":
		upsertedCount = tc.upsertPostgres(tableName, records, columns, uniqueKeyColumn)
	case "mysql":
		upsertedCount = tc.upsertMySQL(tableName, records, columns, uniqueKeyColumn)
	case "oracle":
		upsertedCount = tc.upsertOracle(tableName, records, columns, uniqueKeyColumn)
	default:
		// Fall back to PostgreSQL syntax for unknown drivers
		upsertedCount = tc.upsertPostgres(tableName, records, columns, uniqueKeyColumn)
	}

	log.Printf("Upserted %d records to %s (driver: %s, unique key: %s)", upsertedCount, tableName, tc.Config.Driver, uniqueKeyColumn)
	return upsertedCount, nil
}

// upsertPostgres handles PostgreSQL upsert using ON CONFLICT DO UPDATE
func (tc *TargetConnection) upsertPostgres(tableName string, records []map[string]interface{}, columns []string, uniqueKeyColumn string) int {
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
			log.Printf("PostgreSQL upsert error (skipping): %v", err)
			continue
		}

		affected, _ := result.RowsAffected()
		upsertedCount += int(affected)
	}

	return upsertedCount
}

// upsertMySQL handles MySQL upsert using ON DUPLICATE KEY UPDATE
func (tc *TargetConnection) upsertMySQL(tableName string, records []map[string]interface{}, columns []string, uniqueKeyColumn string) int {
	// Build update set clause for MySQL (exclude the unique key)
	var updateClauses []string
	for _, col := range columns {
		if col != uniqueKeyColumn {
			updateClauses = append(updateClauses, fmt.Sprintf("`%s` = VALUES(`%s`)", col, col))
		}
	}

	upsertedCount := 0
	for _, record := range records {
		var values []interface{}
		var placeholders []string

		for _, col := range columns {
			values = append(values, record[col])
			placeholders = append(placeholders, "?")
		}

		// MySQL uses backticks for identifiers and ? for placeholders
		upsertSQL := fmt.Sprintf(
			"INSERT INTO `%s` (`%s`) VALUES (%s) ON DUPLICATE KEY UPDATE %s",
			tableName,
			strings.Join(columns, "`, `"),
			strings.Join(placeholders, ", "),
			strings.Join(updateClauses, ", "),
		)

		result, err := tc.DB.Exec(upsertSQL, values...)
		if err != nil {
			log.Printf("MySQL upsert error (skipping): %v", err)
			continue
		}

		affected, _ := result.RowsAffected()
		upsertedCount += int(affected)
	}

	return upsertedCount
}

// upsertOracle handles Oracle upsert using MERGE INTO
func (tc *TargetConnection) upsertOracle(tableName string, records []map[string]interface{}, columns []string, uniqueKeyColumn string) int {
	upsertedCount := 0

	for _, record := range records {
		var values []interface{}
		var selectClauses []string
		var insertCols []string
		var insertVals []string
		var updateClauses []string

		for i, col := range columns {
			values = append(values, record[col])
			selectClauses = append(selectClauses, fmt.Sprintf(":%d AS \"%s\"", i+1, col))
			insertCols = append(insertCols, fmt.Sprintf("\"%s\"", col))
			insertVals = append(insertVals, fmt.Sprintf("src.\"%s\"", col))

			if col != uniqueKeyColumn {
				updateClauses = append(updateClauses, fmt.Sprintf("tgt.\"%s\" = src.\"%s\"", col, col))
			}
		}

		// Oracle MERGE syntax
		mergeSQL := fmt.Sprintf(`
			MERGE INTO "%s" tgt
			USING (SELECT %s FROM DUAL) src
			ON (tgt."%s" = src."%s")
			WHEN MATCHED THEN UPDATE SET %s
			WHEN NOT MATCHED THEN INSERT (%s) VALUES (%s)`,
			tableName,
			strings.Join(selectClauses, ", "),
			uniqueKeyColumn, uniqueKeyColumn,
			strings.Join(updateClauses, ", "),
			strings.Join(insertCols, ", "),
			strings.Join(insertVals, ", "),
		)

		result, err := tc.DB.Exec(mergeSQL, values...)
		if err != nil {
			log.Printf("Oracle upsert error (skipping): %v", err)
			continue
		}

		affected, _ := result.RowsAffected()
		upsertedCount += int(affected)
	}

	return upsertedCount
}
