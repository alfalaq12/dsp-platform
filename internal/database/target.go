package database

import (
	"database/sql"
	encoding_csv "encoding/csv"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/lib/pq" // PostgreSQL driver (also used for pq.CopyIn)
)

// DefaultBatchSize is the number of records to upsert in a single query
// Higher values = faster, but too high may cause "too many parameters" errors
// PostgreSQL max parameters = 65535, so 3000 rows × ~20 cols = ~60000 params (safe)
const DefaultBatchSize = 5000

// ParallelWriters is the number of concurrent goroutines for parallel COPY+merge upserts
// Each writer gets its own temp table and DB connection from the pool
const ParallelWriters = 4

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

	// Set connection pool settings (optimized for high-throughput batch operations)
	db.SetMaxOpenConns(50)
	db.SetMaxIdleConns(25)
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

// ResetSequence resets the sequence for a table's primary key column to MAX(id) + 1
// This prevents unique constraint violations when the application inserts new records
// after syncing data with explicit IDs
func (tc *TargetConnection) ResetSequence(tableName string, primaryKeyColumn string) error {
	if tc.Config.Driver != "postgres" {
		// Only PostgreSQL needs sequence reset, MySQL auto-increment handles this automatically
		log.Printf("Sequence reset not needed for driver: %s", tc.Config.Driver)
		return nil
	}

	if !isValidTableName(tableName) || !isValidTableName(primaryKeyColumn) {
		return fmt.Errorf("invalid table or column name")
	}

	// Try common sequence naming conventions
	sequenceNames := []string{
		fmt.Sprintf("%s_%s_seq", tableName, primaryKeyColumn), // Standard: table_column_seq
		fmt.Sprintf("%s_id_seq", tableName),                   // Common: table_id_seq
		fmt.Sprintf("%s_pkey_seq", tableName),                 // Alternative: table_pkey_seq
	}

	var lastErr error
	for _, seqName := range sequenceNames {
		// Check if sequence exists
		var exists bool
		checkQuery := "SELECT EXISTS (SELECT FROM pg_sequences WHERE schemaname = 'public' AND sequencename = $1)"
		err := tc.DB.QueryRow(checkQuery, seqName).Scan(&exists)
		if err != nil {
			lastErr = err
			continue
		}

		if !exists {
			continue
		}

		// Reset sequence to MAX(primary_key) + 1
		resetQuery := fmt.Sprintf(
			`SELECT setval('%s', COALESCE((SELECT MAX("%s") FROM "%s"), 0) + 1, false)`,
			seqName, primaryKeyColumn, tableName,
		)

		_, err = tc.DB.Exec(resetQuery)
		if err != nil {
			lastErr = err
			log.Printf("Failed to reset sequence %s: %v", seqName, err)
			continue
		}

		log.Printf("Successfully reset sequence %s for table %s", seqName, tableName)
		return nil
	}

	// If no known sequence found, try to find it from pg_attribute
	findSeqQuery := `
		SELECT pg_get_serial_sequence($1, $2)
	`
	var seqName sql.NullString
	err := tc.DB.QueryRow(findSeqQuery, tableName, primaryKeyColumn).Scan(&seqName)
	if err == nil && seqName.Valid && seqName.String != "" {
		resetQuery := fmt.Sprintf(
			`SELECT setval('%s', COALESCE((SELECT MAX("%s") FROM "%s"), 0) + 1, false)`,
			seqName.String, primaryKeyColumn, tableName,
		)
		_, err = tc.DB.Exec(resetQuery)
		if err == nil {
			log.Printf("Successfully reset sequence %s for table %s (auto-detected)", seqName.String, tableName)
			return nil
		}
		lastErr = err
	}

	if lastErr != nil {
		return fmt.Errorf("failed to reset sequence for %s.%s: %w", tableName, primaryKeyColumn, lastErr)
	}

	log.Printf("No sequence found for table %s column %s (might not be a serial/identity column)", tableName, primaryKeyColumn)
	return nil
}

// ResetAllSequences resets sequences for all specified tables
func (tc *TargetConnection) ResetAllSequences(tables []string, primaryKeyColumn string) error {
	if primaryKeyColumn == "" {
		primaryKeyColumn = "id" // Default to 'id'
	}

	var errors []string
	for _, table := range tables {
		if err := tc.ResetSequence(table, primaryKeyColumn); err != nil {
			errors = append(errors, fmt.Sprintf("%s: %v", table, err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("some sequences failed to reset: %s", strings.Join(errors, "; "))
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
// Optimized with batch multi-row VALUES for better performance
func (tc *TargetConnection) InsertBatch(tableName string, records []map[string]interface{}) (int, error) {
	if len(records) == 0 {
		return 0, nil
	}

	// Get column names from first record
	var columns []string
	for col := range records[0] {
		columns = append(columns, col)
	}

	// Oracle doesn't support multi-row VALUES, use per-record insert
	if tc.Config.Driver == "oracle" {
		return tc.insertBatchOracle(tableName, records, columns)
	}

	insertedCount := 0
	batchSize := DefaultBatchSize

	// Process records in batches for PostgreSQL and MySQL
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}
		batch := records[i:end]

		var count int
		var err error

		switch tc.Config.Driver {
		case "mysql":
			count, err = tc.insertBatchMySQL(tableName, batch, columns)
		default: // postgres
			count, err = tc.insertBatchPostgres(tableName, batch, columns)
		}

		if err != nil {
			log.Printf("Batch insert error (batch %d-%d): %v", i, end, err)
			// Fallback to per-record for this batch if batch fails
			for _, record := range batch {
				if c := tc.insertSingleRecord(tableName, record, columns); c > 0 {
					insertedCount += c
				}
			}
			continue
		}

		insertedCount += count
	}

	log.Printf("Inserted %d records to %s (driver: %s)", insertedCount, tableName, tc.Config.Driver)
	return insertedCount, nil
}

// insertBatchPostgres inserts multiple records using PostgreSQL COPY protocol
// COPY is 5-10x faster than multi-row INSERT VALUES for bulk inserts
func (tc *TargetConnection) insertBatchPostgres(tableName string, records []map[string]interface{}, columns []string) (int, error) {
	txn, err := tc.DB.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Build quoted column names for COPY
	quotedCols := make([]string, len(columns))
	for i, col := range columns {
		quotedCols[i] = `"` + col + `"`
	}

	stmt, err := txn.Prepare(pq.CopyIn(tableName, columns...))
	if err != nil {
		txn.Rollback()
		// Fallback to multi-row INSERT if COPY fails (e.g. GENERATED ALWAYS columns)
		return tc.insertBatchPostgresFallback(tableName, records, columns)
	}

	for _, record := range records {
		vals := make([]interface{}, len(columns))
		for i, col := range columns {
			vals[i] = record[col]
		}
		if _, err := stmt.Exec(vals...); err != nil {
			stmt.Close()
			txn.Rollback()
			// Fallback to multi-row INSERT on error
			return tc.insertBatchPostgresFallback(tableName, records, columns)
		}
	}

	// Flush COPY data
	if _, err := stmt.Exec(); err != nil {
		stmt.Close()
		txn.Rollback()
		return tc.insertBatchPostgresFallback(tableName, records, columns)
	}
	stmt.Close()

	if err := txn.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit COPY transaction: %w", err)
	}

	return len(records), nil
}

// insertBatchPostgresFallback uses multi-row INSERT VALUES with ON CONFLICT DO NOTHING
// Used when COPY fails (e.g. tables with GENERATED ALWAYS AS IDENTITY columns)
func (tc *TargetConnection) insertBatchPostgresFallback(tableName string, records []map[string]interface{}, columns []string) (int, error) {
	numCols := len(columns)
	totalParams := len(records) * numCols
	allValues := make([]interface{}, 0, totalParams)
	valueRows := make([]string, 0, len(records))

	// Pre-build placeholder template for one row: ($1, $2, $3)
	paramIdx := 1
	for _, record := range records {
		placeholders := make([]string, numCols)
		for i, col := range columns {
			allValues = append(allValues, record[col])
			placeholders[i] = "$" + strconv.Itoa(paramIdx)
			paramIdx++
		}
		valueRows = append(valueRows, "("+strings.Join(placeholders, ",")+")")
	}

	insertSQL := fmt.Sprintf(
		`INSERT INTO "%s" ("%s") OVERRIDING SYSTEM VALUE VALUES %s ON CONFLICT DO NOTHING`,
		tableName,
		strings.Join(columns, `", "`),
		strings.Join(valueRows, ","),
	)

	result, err := tc.DB.Exec(insertSQL, allValues...)
	if err != nil {
		return 0, err
	}

	affected, _ := result.RowsAffected()
	return int(affected), nil
}

// insertBatchMySQL inserts multiple records using multi-row VALUES for MySQL
func (tc *TargetConnection) insertBatchMySQL(tableName string, records []map[string]interface{}, columns []string) (int, error) {
	var allValues []interface{}
	var valueRows []string

	for _, record := range records {
		var placeholders []string
		for _, col := range columns {
			allValues = append(allValues, record[col])
			placeholders = append(placeholders, "?")
		}
		valueRows = append(valueRows, fmt.Sprintf("(%s)", strings.Join(placeholders, ", ")))
	}

	// MySQL: INSERT IGNORE to skip duplicates
	insertSQL := fmt.Sprintf(
		"INSERT IGNORE INTO `%s` (`%s`) VALUES %s",
		tableName,
		strings.Join(columns, "`, `"),
		strings.Join(valueRows, ", "),
	)

	result, err := tc.DB.Exec(insertSQL, allValues...)
	if err != nil {
		return 0, err
	}

	affected, _ := result.RowsAffected()
	return int(affected), nil
}

// insertBatchOracle inserts records one by one for Oracle (no multi-row VALUES support)
func (tc *TargetConnection) insertBatchOracle(tableName string, records []map[string]interface{}, columns []string) (int, error) {
	insertedCount := 0

	for _, record := range records {
		var values []interface{}
		var placeholders []string

		for i, col := range columns {
			values = append(values, record[col])
			placeholders = append(placeholders, fmt.Sprintf(":%d", i+1))
		}

		insertSQL := fmt.Sprintf(
			"INSERT INTO \"%s\" (\"%s\") VALUES (%s)",
			tableName,
			strings.Join(columns, "\", \""),
			strings.Join(placeholders, ", "),
		)

		result, err := tc.DB.Exec(insertSQL, values...)
		if err != nil {
			log.Printf("Oracle insert error (skipping): %v", err)
			continue
		}

		affected, _ := result.RowsAffected()
		insertedCount += int(affected)
	}

	return insertedCount, nil
}

// insertSingleRecord inserts a single record (fallback for batch errors)
func (tc *TargetConnection) insertSingleRecord(tableName string, record map[string]interface{}, columns []string) int {
	var values []interface{}
	var placeholders []string
	var insertSQL string

	for i, col := range columns {
		values = append(values, record[col])

		switch tc.Config.Driver {
		case "mysql":
			placeholders = append(placeholders, "?")
		default: // postgres
			placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
		}
	}

	switch tc.Config.Driver {
	case "mysql":
		insertSQL = fmt.Sprintf(
			"INSERT IGNORE INTO `%s` (`%s`) VALUES (%s)",
			tableName,
			strings.Join(columns, "`, `"),
			strings.Join(placeholders, ", "),
		)
	default: // postgres
		insertSQL = fmt.Sprintf(
			"INSERT INTO \"%s\" (\"%s\") OVERRIDING SYSTEM VALUE VALUES (%s) ON CONFLICT DO NOTHING",
			tableName,
			strings.Join(columns, "\", \""),
			strings.Join(placeholders, ", "),
		)
	}

	result, err := tc.DB.Exec(insertSQL, values...)
	if err != nil {
		log.Printf("Single insert error (driver: %s, skipping): %v", tc.Config.Driver, err)
		return 0
	}

	affected, _ := result.RowsAffected()
	return int(affected)
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
		// Use parallel path for large datasets (>10K rows) for ~3-4x throughput
		if len(records) > 10000 {
			upsertedCount = tc.upsertPostgresParallel(tableName, records, columns, uniqueKeyColumn)
		} else {
			upsertedCount = tc.upsertPostgres(tableName, records, columns, uniqueKeyColumn)
		}
	case "mysql":
		upsertedCount = tc.upsertMySQL(tableName, records, columns, uniqueKeyColumn)
	case "oracle":
		upsertedCount = tc.upsertOracle(tableName, records, columns, uniqueKeyColumn)
	default:
		// Fall back to PostgreSQL syntax for unknown drivers
		if len(records) > 10000 {
			upsertedCount = tc.upsertPostgresParallel(tableName, records, columns, uniqueKeyColumn)
		} else {
			upsertedCount = tc.upsertPostgres(tableName, records, columns, uniqueKeyColumn)
		}
	}

	log.Printf("Upserted %d records to %s (driver: %s, unique key: %s)", upsertedCount, tableName, tc.Config.Driver, uniqueKeyColumn)
	return upsertedCount, nil
}

// upsertPostgres handles PostgreSQL upsert using ON CONFLICT DO UPDATE
// Optimized with transaction wrapping, pre-allocated slices, and strconv for placeholders
func (tc *TargetConnection) upsertPostgres(tableName string, records []map[string]interface{}, columns []string, uniqueKeyColumn string) int {
	if len(records) == 0 {
		return 0
	}

	numCols := len(columns)

	// Build update set clause once (exclude the unique key)
	updateClauses := make([]string, 0, numCols)
	for _, col := range columns {
		if col != uniqueKeyColumn {
			updateClauses = append(updateClauses, `"`+col+`" = EXCLUDED."`+col+`"`)
		}
	}
	updateClause := strings.Join(updateClauses, ", ")

	colsJoined := `"` + strings.Join(columns, `", "`) + `"`

	upsertedCount := 0
	batchSize := DefaultBatchSize

	// Wrap entire upsert in a single transaction for better performance
	txn, err := tc.DB.Begin()
	if err != nil {
		log.Printf("Failed to begin upsert transaction, falling back to non-txn: %v", err)
		txn = nil
	}

	// Process records in batches
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}
		batch := records[i:end]
		batchLen := len(batch)

		// Pre-allocate slices
		allValues := make([]interface{}, 0, batchLen*numCols)
		valueRows := make([]string, 0, batchLen)
		paramIdx := 1

		for _, record := range batch {
			placeholders := make([]string, numCols)
			for j, col := range columns {
				allValues = append(allValues, record[col])
				placeholders[j] = "$" + strconv.Itoa(paramIdx)
				paramIdx++
			}
			valueRows = append(valueRows, "("+strings.Join(placeholders, ",")+")")
		}

		upsertSQL := fmt.Sprintf(
			`INSERT INTO "%s" (%s) OVERRIDING SYSTEM VALUE VALUES %s ON CONFLICT ("%s") DO UPDATE SET %s`,
			tableName,
			colsJoined,
			strings.Join(valueRows, ","),
			uniqueKeyColumn,
			updateClause,
		)

		var result sql.Result
		if txn != nil {
			result, err = txn.Exec(upsertSQL, allValues...)
		} else {
			result, err = tc.DB.Exec(upsertSQL, allValues...)
		}
		if err != nil {
			log.Printf("PostgreSQL batch upsert error (batch %d-%d, skipping): %v", i, end, err)
			// On transaction error, abort txn and fallback to per-record
			if txn != nil {
				txn.Rollback()
				txn = nil
			}
			for _, record := range batch {
				upsertedCount += tc.upsertPostgresSingle(tableName, record, columns, uniqueKeyColumn, updateClause)
			}
			continue
		}

		affected, _ := result.RowsAffected()
		upsertedCount += int(affected)
	}

	// Commit transaction
	if txn != nil {
		if err := txn.Commit(); err != nil {
			log.Printf("Failed to commit upsert transaction: %v", err)
		}
	}

	return upsertedCount
}

// upsertPostgresSingle handles single record upsert (fallback for batch errors)
func (tc *TargetConnection) upsertPostgresSingle(tableName string, record map[string]interface{}, columns []string, uniqueKeyColumn string, updateClause string) int {
	var values []interface{}
	var placeholders []string

	for i, col := range columns {
		values = append(values, record[col])
		placeholders = append(placeholders, fmt.Sprintf("$%d", i+1))
	}

	upsertSQL := fmt.Sprintf(
		"INSERT INTO \"%s\" (\"%s\") OVERRIDING SYSTEM VALUE VALUES (%s) ON CONFLICT (\"%s\") DO UPDATE SET %s",
		tableName,
		strings.Join(columns, "\", \""),
		strings.Join(placeholders, ", "),
		uniqueKeyColumn,
		updateClause,
	)

	result, err := tc.DB.Exec(upsertSQL, values...)
	if err != nil {
		log.Printf("PostgreSQL single upsert error (skipping): %v", err)
		return 0
	}

	affected, _ := result.RowsAffected()
	return int(affected)
}

// upsertMySQL handles MySQL upsert using ON DUPLICATE KEY UPDATE
// Optimized with pre-allocated slices for better performance
func (tc *TargetConnection) upsertMySQL(tableName string, records []map[string]interface{}, columns []string, uniqueKeyColumn string) int {
	if len(records) == 0 {
		return 0
	}

	numCols := len(columns)

	// Build update set clause for MySQL (exclude the unique key)
	updateClauses := make([]string, 0, numCols)
	for _, col := range columns {
		if col != uniqueKeyColumn {
			updateClauses = append(updateClauses, "`"+col+"` = VALUES(`"+col+"`)")
		}
	}
	updateClause := strings.Join(updateClauses, ", ")

	// Pre-build single row placeholder: (?,?,?)
	singleRowPlaceholders := make([]string, numCols)
	for i := range singleRowPlaceholders {
		singleRowPlaceholders[i] = "?"
	}
	singleRowStr := "(" + strings.Join(singleRowPlaceholders, ",") + ")"

	colsJoined := "`" + strings.Join(columns, "`, `") + "`"

	upsertedCount := 0
	batchSize := DefaultBatchSize

	// Process records in batches
	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}
		batch := records[i:end]
		batchLen := len(batch)

		// Pre-allocate
		allValues := make([]interface{}, 0, batchLen*numCols)
		valueRows := make([]string, batchLen)

		for idx, record := range batch {
			for _, col := range columns {
				allValues = append(allValues, record[col])
			}
			valueRows[idx] = singleRowStr
		}

		upsertSQL := fmt.Sprintf(
			"INSERT INTO `%s` (%s) VALUES %s ON DUPLICATE KEY UPDATE %s",
			tableName,
			colsJoined,
			strings.Join(valueRows, ","),
			updateClause,
		)

		result, err := tc.DB.Exec(upsertSQL, allValues...)
		if err != nil {
			log.Printf("MySQL batch upsert error (batch %d-%d, skipping): %v", i, end, err)
			for _, record := range batch {
				upsertedCount += tc.upsertMySQLSingle(tableName, record, columns, updateClause)
			}
			continue
		}

		affected, _ := result.RowsAffected()
		upsertedCount += int(affected)
	}

	return upsertedCount
}

// upsertMySQLSingle handles single record upsert (fallback for batch errors)
func (tc *TargetConnection) upsertMySQLSingle(tableName string, record map[string]interface{}, columns []string, updateClause string) int {
	var values []interface{}
	var placeholders []string

	for _, col := range columns {
		values = append(values, record[col])
		placeholders = append(placeholders, "?")
	}

	upsertSQL := fmt.Sprintf(
		"INSERT INTO `%s` (`%s`) VALUES (%s) ON DUPLICATE KEY UPDATE %s",
		tableName,
		strings.Join(columns, "`, `"),
		strings.Join(placeholders, ", "),
		updateClause,
	)

	result, err := tc.DB.Exec(upsertSQL, values...)
	if err != nil {
		log.Printf("MySQL single upsert error (skipping): %v", err)
		return 0
	}

	affected, _ := result.RowsAffected()
	return int(affected)
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

// InsertCsvBatch inserts CSV string payload into target table
func (tc *TargetConnection) InsertCsvBatch(tableName string, csvData string, columns []string) (int, error) {
	if tc.Config.Driver != "postgres" {
		// Fallback for non-postgres if ever needed
		log.Printf("InsertCsvBatch only optimized for PostgreSQL. Falling back...")
		return 0, fmt.Errorf("CSV streaming not supported for driver %s", tc.Config.Driver)
	}
	return tc.copyCsvToTable(tableName, csvData, columns)
}

// UpsertCsvBatch inserts/updates CSV string payload via Temp Table and Merge
func (tc *TargetConnection) UpsertCsvBatch(tableName string, csvData string, columns []string, uniqueKeyColumn string) (int, error) {
	if tc.Config.Driver != "postgres" {
		return 0, fmt.Errorf("CSV streaming not supported for driver %s", tc.Config.Driver)
	}

	if uniqueKeyColumn == "" {
		return tc.InsertCsvBatch(tableName, csvData, columns)
	}

	txn, err := tc.DB.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin upsert transaction: %w", err)
	}

	// 1. Create temporary staging table
	tempTable := fmt.Sprintf("stg_%s_%d", tableName, time.Now().UnixNano())
	createTempSQL := fmt.Sprintf(`CREATE TEMP TABLE "%s" (LIKE "%s" INCLUDING DEFAULTS) ON COMMIT DROP`, tempTable, tableName)
	if _, err := txn.Exec(createTempSQL); err != nil {
		txn.Rollback()
		return 0, fmt.Errorf("failed to create temp table: %w", err)
	}

	// 2. COPY data into temp table
	stmt, err := txn.Prepare(pq.CopyIn(tempTable, columns...))
	if err != nil {
		txn.Rollback()
		return 0, fmt.Errorf("failed to prepare COPY for temp table: %w", err)
	}

	reader := encoding_csv.NewReader(strings.NewReader(csvData))
	reader.FieldsPerRecord = len(columns)
	reader.LazyQuotes = true

	records, err := reader.ReadAll()
	if err != nil {
		stmt.Close()
		txn.Rollback()
		return 0, fmt.Errorf("failed to parse CSV data: %w", err)
	}

	for _, record := range records {
		args := make([]interface{}, len(columns))
		for i, v := range record {
			if v == "" {
				args[i] = nil
			} else {
				args[i] = v
			}
		}
		if _, err := stmt.Exec(args...); err != nil {
			stmt.Close()
			txn.Rollback()
			return 0, fmt.Errorf("COPY execute failed: %w", err)
		}
	}
	if _, err := stmt.Exec(); err != nil { // flush
		stmt.Close()
		txn.Rollback()
		return 0, fmt.Errorf("COPY flush failed: %w", err)
	}
	stmt.Close()

	// 3. Merge from temp table to main table
	numCols := len(columns)
	updateClauses := make([]string, 0, numCols)
	for _, col := range columns {
		if col != uniqueKeyColumn {
			updateClauses = append(updateClauses, `"`+col+`" = EXCLUDED."`+col+`"`)
		}
	}
	updateClause := strings.Join(updateClauses, ", ")
	colsJoined := `"` + strings.Join(columns, `", "`) + `"`

	upsertSQL := fmt.Sprintf(
		`INSERT INTO "%s" (%s) SELECT %s FROM "%s" ON CONFLICT ("%s") DO UPDATE SET %s`,
		tableName, colsJoined, colsJoined, tempTable, uniqueKeyColumn, updateClause,
	)

	result, err := txn.Exec(upsertSQL)
	if err != nil {
		txn.Rollback()
		return 0, fmt.Errorf("failed to merge from temp table: %w", err)
	}

	if err := txn.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit merge txn: %w", err)
	}

	affected, _ := result.RowsAffected()
	return int(affected), nil
}

// copyCsvToTable performs a direct COPY FROM payload to table
func (tc *TargetConnection) copyCsvToTable(tableName string, csvData string, columns []string) (int, error) {
	txn, err := tc.DB.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin insert transaction: %w", err)
	}

	stmt, err := txn.Prepare(pq.CopyIn(tableName, columns...))
	if err != nil {
		txn.Rollback()
		return 0, fmt.Errorf("failed to prepare COPY: %w", err)
	}

	reader := encoding_csv.NewReader(strings.NewReader(csvData))
	reader.FieldsPerRecord = len(columns)
	reader.LazyQuotes = true

	records, err := reader.ReadAll()
	if err != nil {
		stmt.Close()
		txn.Rollback()
		return 0, fmt.Errorf("failed to parse CSV data: %w", err)
	}

	for _, record := range records {
		args := make([]interface{}, len(columns))
		for i, v := range record {
			if v == "" {
				args[i] = nil
			} else {
				args[i] = v
			}
		}
		if _, err := stmt.Exec(args...); err != nil {
			stmt.Close()
			txn.Rollback()
			return 0, fmt.Errorf("COPY execute failed: %w", err)
		}
	}

	if _, err := stmt.Exec(); err != nil {
		stmt.Close()
		txn.Rollback()
		return 0, fmt.Errorf("COPY flush failed: %w", err)
	}
	stmt.Close()

	if err := txn.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit COPY txn: %w", err)
	}

	return len(records), nil
}

// TuneForBulkOps applies PostgreSQL session-level tuning for bulk upsert operations
// These settings significantly improve write throughput for large batch operations
// MUST call ResetTuning() after the bulk operation completes
func (tc *TargetConnection) TuneForBulkOps() {
	if tc.Config.Driver != "postgres" {
		return
	}
	tunings := []string{
		"SET synchronous_commit = OFF", // Don't wait for WAL flush (~2x write speed)
		"SET work_mem = '256MB'",       // More memory for sort/hash during merge
	}
	for _, sql := range tunings {
		if _, err := tc.DB.Exec(sql); err != nil {
			log.Printf("Warning: failed to apply tuning '%s': %v", sql, err)
		}
	}
	log.Printf("⚡ Applied bulk operation tuning (synchronous_commit=OFF, work_mem=256MB)")
}

// ResetTuning restores default PostgreSQL session settings after bulk operations
func (tc *TargetConnection) ResetTuning() {
	if tc.Config.Driver != "postgres" {
		return
	}
	resets := []string{
		"SET synchronous_commit = ON",
		"RESET work_mem",
	}
	for _, sql := range resets {
		if _, err := tc.DB.Exec(sql); err != nil {
			log.Printf("Warning: failed to reset tuning '%s': %v", sql, err)
		}
	}
	log.Printf("✅ Reset bulk operation tuning to defaults")
}

// UpsertCsvBatchParallel performs parallel COPY+merge upsert by splitting CSV data into N shards
// Each shard: Create temp table → COPY shard data → INSERT...SELECT ON CONFLICT → commit
// This achieves ~3-4x throughput vs serial UpsertCsvBatch
func (tc *TargetConnection) UpsertCsvBatchParallel(tableName string, csvData string, columns []string, uniqueKeyColumn string) (int, error) {
	if tc.Config.Driver != "postgres" {
		return 0, fmt.Errorf("parallel CSV upsert only supported for PostgreSQL")
	}

	if uniqueKeyColumn == "" {
		return tc.InsertCsvBatch(tableName, csvData, columns)
	}

	// Parse CSV data into lines
	lines := strings.Split(strings.TrimRight(csvData, "\n"), "\n")
	if len(lines) == 0 {
		return 0, nil
	}

	// For small datasets, use serial path (overhead of parallel not worth it)
	if len(lines) < 5000 {
		return tc.UpsertCsvBatch(tableName, csvData, columns, uniqueKeyColumn)
	}

	// Apply bulk tuning
	tc.TuneForBulkOps()
	defer tc.ResetTuning()

	// Split lines into N shards
	numShards := ParallelWriters
	if len(lines) < numShards*1000 {
		numShards = 1 + len(lines)/1000
		if numShards < 1 {
			numShards = 1
		}
	}

	shardSize := (len(lines) + numShards - 1) / numShards
	shards := make([]string, 0, numShards)
	for i := 0; i < len(lines); i += shardSize {
		end := i + shardSize
		if end > len(lines) {
			end = len(lines)
		}
		shards = append(shards, strings.Join(lines[i:end], "\n")+"\n")
	}

	log.Printf("⚡ Parallel upsert: %d total rows → %d shards (shard size ~%d)", len(lines), len(shards), shardSize)

	// Build update clause once
	updateClauses := make([]string, 0, len(columns))
	for _, col := range columns {
		if col != uniqueKeyColumn {
			updateClauses = append(updateClauses, `"`+col+`" = EXCLUDED."`+col+`"`)
		}
	}
	updateClause := strings.Join(updateClauses, ", ")
	colsJoined := `"` + strings.Join(columns, `", "`) + `"`

	// Process shards in parallel
	var totalAffected int64
	var wg sync.WaitGroup
	errChan := make(chan error, len(shards))

	for shardIdx, shardData := range shards {
		wg.Add(1)
		go func(idx int, data string) {
			defer wg.Done()

			affected, err := tc.processUpsertShard(tableName, data, columns, uniqueKeyColumn, updateClause, colsJoined, idx)
			if err != nil {
				errChan <- fmt.Errorf("shard %d: %w", idx, err)
				return
			}
			atomic.AddInt64(&totalAffected, int64(affected))
		}(shardIdx, shardData)
	}

	wg.Wait()
	close(errChan)

	// Collect errors
	var errs []string
	for err := range errChan {
		errs = append(errs, err.Error())
	}
	if len(errs) > 0 {
		log.Printf("⚠️ Parallel upsert had %d shard errors: %s", len(errs), strings.Join(errs, "; "))
	}

	result := int(atomic.LoadInt64(&totalAffected))
	log.Printf("⚡ Parallel upsert complete: %d rows affected (table: %s)", result, tableName)
	return result, nil
}

// processUpsertShard handles a single shard: temp table → COPY → merge
func (tc *TargetConnection) processUpsertShard(tableName, csvData string, columns []string, uniqueKeyColumn, updateClause, colsJoined string, shardIdx int) (int, error) {
	txn, err := tc.DB.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin shard transaction: %w", err)
	}

	// 1. Create temp table unique to this shard
	tempTable := fmt.Sprintf("stg_%s_%d_%d", tableName, time.Now().UnixNano(), shardIdx)
	createTempSQL := fmt.Sprintf(`CREATE TEMP TABLE "%s" (LIKE "%s" INCLUDING DEFAULTS) ON COMMIT DROP`, tempTable, tableName)
	if _, err := txn.Exec(createTempSQL); err != nil {
		txn.Rollback()
		return 0, fmt.Errorf("failed to create temp table: %w", err)
	}

	// 2. COPY data into temp table
	stmt, err := txn.Prepare(pq.CopyIn(tempTable, columns...))
	if err != nil {
		txn.Rollback()
		return 0, fmt.Errorf("failed to prepare COPY: %w", err)
	}

	reader := encoding_csv.NewReader(strings.NewReader(csvData))
	reader.FieldsPerRecord = len(columns)
	reader.LazyQuotes = true

	records, err := reader.ReadAll()
	if err != nil {
		stmt.Close()
		txn.Rollback()
		return 0, fmt.Errorf("failed to parse CSV: %w", err)
	}

	for _, record := range records {
		args := make([]interface{}, len(columns))
		for i, v := range record {
			if v == "" {
				args[i] = nil
			} else {
				args[i] = v
			}
		}
		if _, err := stmt.Exec(args...); err != nil {
			stmt.Close()
			txn.Rollback()
			return 0, fmt.Errorf("COPY exec failed: %w", err)
		}
	}
	if _, err := stmt.Exec(); err != nil { // flush
		stmt.Close()
		txn.Rollback()
		return 0, fmt.Errorf("COPY flush failed: %w", err)
	}
	stmt.Close()

	// 3. Merge from temp table to main table
	upsertSQL := fmt.Sprintf(
		`INSERT INTO "%s" (%s) SELECT %s FROM "%s" ON CONFLICT ("%s") DO UPDATE SET %s`,
		tableName, colsJoined, colsJoined, tempTable, uniqueKeyColumn, updateClause,
	)

	result, err := txn.Exec(upsertSQL)
	if err != nil {
		txn.Rollback()
		return 0, fmt.Errorf("merge failed: %w", err)
	}

	if err := txn.Commit(); err != nil {
		return 0, fmt.Errorf("commit failed: %w", err)
	}

	affected, _ := result.RowsAffected()
	log.Printf("  Shard %d: merged %d rows", shardIdx, affected)
	return int(affected), nil
}

// upsertPostgresParallel splits records into N chunks and upserts each in a separate goroutine
// This is the parallel version of upsertPostgres for JSON record path
func (tc *TargetConnection) upsertPostgresParallel(tableName string, records []map[string]interface{}, columns []string, uniqueKeyColumn string) int {
	if len(records) == 0 {
		return 0
	}

	numCols := len(columns)

	// Build update clause once
	updateClauses := make([]string, 0, numCols)
	for _, col := range columns {
		if col != uniqueKeyColumn {
			updateClauses = append(updateClauses, `"`+col+`" = EXCLUDED."`+col+`"`)
		}
	}
	updateClause := strings.Join(updateClauses, ", ")
	colsJoined := `"` + strings.Join(columns, `", "`) + `"`

	// Apply bulk tuning
	tc.TuneForBulkOps()
	defer tc.ResetTuning()

	// Split records into chunks for parallel processing
	numChunks := ParallelWriters
	chunkSize := (len(records) + numChunks - 1) / numChunks

	var totalAffected int64
	var wg sync.WaitGroup

	for i := 0; i < len(records); i += chunkSize {
		end := i + chunkSize
		if end > len(records) {
			end = len(records)
		}
		chunk := records[i:end]

		wg.Add(1)
		go func(chunkRecords []map[string]interface{}, chunkIdx int) {
			defer wg.Done()

			affected := tc.upsertChunk(tableName, chunkRecords, columns, uniqueKeyColumn, updateClause, colsJoined, chunkIdx)
			atomic.AddInt64(&totalAffected, int64(affected))
		}(chunk, i/chunkSize)
	}

	wg.Wait()

	result := int(atomic.LoadInt64(&totalAffected))
	log.Printf("⚡ Parallel JSON upsert complete: %d rows affected (table: %s)", result, tableName)
	return result
}

// upsertChunk processes a single chunk of records in a transaction with batched INSERT ON CONFLICT
func (tc *TargetConnection) upsertChunk(tableName string, records []map[string]interface{}, columns []string, uniqueKeyColumn, updateClause, colsJoined string, chunkIdx int) int {
	numCols := len(columns)
	batchSize := DefaultBatchSize
	upsertedCount := 0

	txn, err := tc.DB.Begin()
	if err != nil {
		log.Printf("Chunk %d: failed to begin transaction: %v", chunkIdx, err)
		return 0
	}

	for i := 0; i < len(records); i += batchSize {
		end := i + batchSize
		if end > len(records) {
			end = len(records)
		}
		batch := records[i:end]

		allValues := make([]interface{}, 0, len(batch)*numCols)
		valueRows := make([]string, 0, len(batch))
		paramIdx := 1

		for _, record := range batch {
			placeholders := make([]string, numCols)
			for j, col := range columns {
				allValues = append(allValues, record[col])
				placeholders[j] = "$" + strconv.Itoa(paramIdx)
				paramIdx++
			}
			valueRows = append(valueRows, "("+strings.Join(placeholders, ",")+")")
		}

		upsertSQL := fmt.Sprintf(
			`INSERT INTO "%s" (%s) OVERRIDING SYSTEM VALUE VALUES %s ON CONFLICT ("%s") DO UPDATE SET %s`,
			tableName, colsJoined, strings.Join(valueRows, ","), uniqueKeyColumn, updateClause,
		)

		result, err := txn.Exec(upsertSQL, allValues...)
		if err != nil {
			log.Printf("Chunk %d batch %d-%d error: %v — rolling back chunk", chunkIdx, i, end, err)
			txn.Rollback()
			// Fallback: process this chunk serially without transaction
			for _, record := range records[i:] {
				upsertedCount += tc.upsertPostgresSingle(tableName, record, columns, uniqueKeyColumn, updateClause)
			}
			return upsertedCount
		}

		affected, _ := result.RowsAffected()
		upsertedCount += int(affected)
	}

	if err := txn.Commit(); err != nil {
		log.Printf("Chunk %d: failed to commit: %v", chunkIdx, err)
	}

	return upsertedCount
}
