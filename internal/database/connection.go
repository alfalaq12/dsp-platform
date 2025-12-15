package database

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/denisenkom/go-mssqldb" // Microsoft SQL Server driver
	_ "github.com/lib/pq"                // PostgreSQL driver
	_ "github.com/sijms/go-ora/v2"       // Oracle driver (pure Go, no CGO required)
)

// Config holds database connection configuration
type Config struct {
	Driver   string // postgres, mysql, sqlserver, oracle
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string // for PostgreSQL: disable, require, verify-full
}

// Connection wraps database connection
type Connection struct {
	DB     *sql.DB
	Config Config
}

// Connect establishes database connection
func Connect(config Config) (*Connection, error) {
	var connStr string
	var driverName string

	switch config.Driver {
	case "postgres":
		driverName = "postgres"
		connStr = fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			config.Host, config.Port, config.User,
			config.Password, config.DBName, config.SSLMode,
		)
	case "mysql":
		driverName = "mysql"
		// MySQL connection string: user:password@tcp(host:port)/dbname
		connStr = fmt.Sprintf(
			"%s:%s@tcp(%s:%s)/%s",
			config.User, config.Password, config.Host, config.Port, config.DBName,
		)
	case "sqlserver", "mssql":
		driverName = "sqlserver"
		// SQL Server connection string
		connStr = fmt.Sprintf(
			"sqlserver://%s:%s@%s:%s?database=%s",
			config.User, config.Password, config.Host, config.Port, config.DBName,
		)
	case "oracle":
		driverName = "oracle"
		// Oracle connection string for go-ora: oracle://user:password@host:port/service_name
		connStr = fmt.Sprintf(
			"oracle://%s:%s@%s:%s/%s",
			config.User, config.Password, config.Host, config.Port, config.DBName,
		)
	default:
		return nil, fmt.Errorf("unsupported driver: %s", config.Driver)
	}

	db, err := sql.Open(driverName, connStr)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Set connection pool settings
	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(time.Hour)

	// Test connection
	if err = db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &Connection{
		DB:     db,
		Config: config,
	}, nil
}

// Close closes database connection
func (c *Connection) Close() error {
	if c.DB != nil {
		return c.DB.Close()
	}
	return nil
}

// ExecuteQuery executes SQL query and returns results as map
func (c *Connection) ExecuteQuery(query string, args ...interface{}) ([]map[string]interface{}, error) {
	rows, err := c.DB.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query execution failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("failed to get columns: %w", err)
	}

	var results []map[string]interface{}

	for rows.Next() {
		// Create slice for values
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))

		for i := range values {
			valuePtrs[i] = &values[i]
		}

		// Scan row
		if err := rows.Scan(valuePtrs...); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}

		// Build map
		row := make(map[string]interface{})
		for i, col := range columns {
			var v interface{}
			val := values[i]

			// Convert []byte to string
			if b, ok := val.([]byte); ok {
				v = string(b)
			} else {
				v = val
			}

			row[col] = v
		}

		results = append(results, row)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("row iteration error: %w", err)
	}

	return results, nil
}

// ExecuteQueryWithBatch executes SQL query and processes results in batches
// This prevents high memory usage for large datasets
func (c *Connection) ExecuteQueryWithBatch(query string, batchSize int, callback func([]map[string]interface{}) error) error {
	rows, err := c.DB.Query(query)
	if err != nil {
		return fmt.Errorf("query execution failed: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return fmt.Errorf("failed to get columns: %w", err)
	}

	var batch []map[string]interface{}

	for rows.Next() {
		// Create slice for values
		values := make([]interface{}, len(columns))
		valuePtrs := make([]interface{}, len(columns))

		for i := range values {
			valuePtrs[i] = &values[i]
		}

		// Scan row
		if err := rows.Scan(valuePtrs...); err != nil {
			return fmt.Errorf("failed to scan row: %w", err)
		}

		// Build map
		row := make(map[string]interface{})
		for i, col := range columns {
			var v interface{}
			val := values[i]

			// Convert []byte to string
			if b, ok := val.([]byte); ok {
				v = string(b)
			} else {
				v = val
			}

			row[col] = v
		}

		batch = append(batch, row)

		// If batch is full, process it
		if len(batch) >= batchSize {
			if err := callback(batch); err != nil {
				return err
			}
			// Reset batch
			batch = make([]map[string]interface{}, 0, batchSize)
		}
	}

	// Process remaining records
	if len(batch) > 0 {
		if err := callback(batch); err != nil {
			return err
		}
	}

	if err = rows.Err(); err != nil {
		return fmt.Errorf("row iteration error: %w", err)
	}

	return nil
}

// TestConnection tests database connectivity
func TestConnection(config Config) error {
	conn, err := Connect(config)
	if err != nil {
		return err
	}
	defer conn.Close()

	return nil
}
