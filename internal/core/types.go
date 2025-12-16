package core

import "time"

// Schema represents a SQL query or file configuration to be executed/synced
type Schema struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"not null"`
	SQLCommand  string    `json:"sql_command" gorm:"type:text"` // For database source
	TargetTable string    `json:"target_table" gorm:"not null"`
	Description string    `json:"description" gorm:"type:text"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	CreatedBy   uint      `json:"created_by" gorm:"index"` // Owner user ID
	UpdatedBy   uint      `json:"updated_by"`              // Last modifier user ID

	// File Sync Configuration (for FTP/SFTP sources)
	SourceType      string `json:"source_type" gorm:"default:'query'"` // query, file
	FileFormat      string `json:"file_format"`                        // csv, xlsx, json
	FilePattern     string `json:"file_pattern"`                       // e.g., "data.csv" or "*.csv"
	UniqueKeyColumn string `json:"unique_key_column"`                  // Column for upsert logic
	HasHeader       bool   `json:"has_header" gorm:"default:true"`     // CSV/Excel has header row
	Delimiter       string `json:"delimiter" gorm:"default:','"`       // CSV delimiter
}

// Network represents a data source (Tenant Agent) or data target
type Network struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"not null;unique"`
	AgentName string    `json:"agent_name"` // Name of agent to route commands (if empty, uses Name)
	IPAddress string    `json:"ip_address" gorm:"not null"`
	Status    string    `json:"status" gorm:"default:'offline'"` // online/offline
	Type      string    `json:"type" gorm:"default:'source'"`    // source/target
	LastSeen  time.Time `json:"last_seen"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	CreatedBy uint      `json:"created_by" gorm:"index"` // Owner user ID
	UpdatedBy uint      `json:"updated_by"`              // Last modifier user ID

	// Source Type: database, ftp, sftp, api
	SourceType string `json:"source_type" gorm:"default:'database'"`

	// Source Database Configuration (for agent to use when SourceType=database)
	DBDriver   string `json:"db_driver" gorm:"default:'postgres'"`
	DBHost     string `json:"db_host"`
	DBPort     string `json:"db_port" gorm:"default:'5432'"`
	DBUser     string `json:"db_user"`
	DBPassword string `json:"db_password"`
	DBName     string `json:"db_name"`
	DBSSLMode  string `json:"db_sslmode" gorm:"default:'disable'"`

	// FTP/SFTP Configuration (for agent to use when SourceType=ftp or sftp)
	FTPHost       string `json:"ftp_host"`
	FTPPort       string `json:"ftp_port" gorm:"default:'21'"`
	FTPUser       string `json:"ftp_user"`
	FTPPassword   string `json:"ftp_password"`
	FTPPrivateKey string `json:"ftp_private_key" gorm:"type:text"` // SSH private key (PEM format)
	FTPPath       string `json:"ftp_path"`                         // Remote directory path
	FTPPassive    bool   `json:"ftp_passive" gorm:"default:true"`  // Use passive mode

	// API Configuration (for agent to use when SourceType=api)
	APIURL       string `json:"api_url"`                         // API endpoint URL
	APIMethod    string `json:"api_method" gorm:"default:'GET'"` // GET, POST
	APIHeaders   string `json:"api_headers" gorm:"type:text"`    // JSON string of headers {"key": "value"}
	APIAuthType  string `json:"api_auth_type"`                   // none, bearer, basic, api_key
	APIAuthKey   string `json:"api_auth_key"`                    // Header name for API key (e.g., X-API-Key)
	APIAuthValue string `json:"api_auth_value"`                  // Token/key value
	APIBody      string `json:"api_body" gorm:"type:text"`       // Request body for POST

	// MongoDB Configuration (for agent to use when SourceType=mongodb)
	MongoHost       string `json:"mongo_host"`
	MongoPort       string `json:"mongo_port" gorm:"default:'27017'"`
	MongoUser       string `json:"mongo_user"`
	MongoPassword   string `json:"mongo_password"`
	MongoDatabase   string `json:"mongo_database"`
	MongoCollection string `json:"mongo_collection"`
	MongoAuthDB     string `json:"mongo_auth_db" gorm:"default:'admin'"` // Auth database

	// Redis Configuration (for agent to use when SourceType=redis)
	RedisHost     string `json:"redis_host"`
	RedisPort     string `json:"redis_port" gorm:"default:'6379'"`
	RedisPassword string `json:"redis_password"`
	RedisDB       int    `json:"redis_db" gorm:"default:0"` // Database number (0-15)
	RedisPattern  string `json:"redis_pattern"`             // Key pattern to scan (e.g., "user:*")
}

// Job represents a data synchronization job linking a Schema to a Network
type Job struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"not null"`
	SchemaID  uint      `json:"schema_id" gorm:"not null"`
	NetworkID uint      `json:"network_id" gorm:"not null"`
	Status    string    `json:"status" gorm:"default:'pending'"` // pending/running/completed/failed
	Schedule  string    `json:"schedule"`                        // cron expression or interval
	Enabled   bool      `json:"enabled" gorm:"default:true"`     // enable/disable scheduler
	LastRun   time.Time `json:"last_run"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	CreatedBy uint      `json:"created_by" gorm:"index"` // Owner user ID
	UpdatedBy uint      `json:"updated_by"`              // Last modifier user ID

	// Relations
	Schema  Schema  `json:"schema" gorm:"foreignKey:SchemaID"`
	Network Network `json:"network" gorm:"foreignKey:NetworkID"`
}

// User represents an authenticated user for the web console
type User struct {
	ID                 uint      `json:"id" gorm:"primaryKey"`
	Username           string    `json:"username" gorm:"not null;unique"`
	Password           string    `json:"-" gorm:"not null"`           // Never expose in JSON
	Role               string    `json:"role" gorm:"default:'admin'"` // admin OR viewer
	MustChangePassword bool      `json:"must_change_password" gorm:"default:false"`
	CreatedAt          time.Time `json:"created_at"`
}

// AuditLog represents a system activity log
type AuditLog struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	UserID    uint      `json:"user_id" gorm:"index"`
	Username  string    `json:"username"`
	Action    string    `json:"action" gorm:"index"` // CREATE, UPDATE, DELETE, LOGIN
	Entity    string    `json:"entity" gorm:"index"` // JOB, SCHEMA, NETWORK
	EntityID  string    `json:"entity_id"`
	IPAddress string    `json:"ip_address"`
	UserAgent string    `json:"user_agent"`
	Details   string    `json:"details" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at" gorm:"index"`
}

// AgentMessage represents the message protocol between Master and Tenant Agents
type AgentMessage struct {
	Type      string                 `json:"type"` // REGISTER, HEARTBEAT, DATA_PUSH, CONFIG_PULL
	AgentName string                 `json:"agent_name"`
	Status    string                 `json:"status"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data,omitempty"`
}

// LoginRequest represents the login payload
type LoginRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponse represents the login response with JWT token
type LoginResponse struct {
	Token              string `json:"token"`
	Username           string `json:"username"`
	Role               string `json:"role"`
	MustChangePassword bool   `json:"must_change_password"`
}

// JobRunRequest represents the payload to run a job
type JobRunRequest struct {
	JobID uint `json:"job_id" binding:"required"`
}

// JobLog represents a job execution log entry
type JobLog struct {
	ID           uint      `json:"id" gorm:"primaryKey"`
	JobID        uint      `json:"job_id" gorm:"not null;index"`
	Status       string    `json:"status"` // running/completed/failed
	StartedAt    time.Time `json:"started_at"`
	CompletedAt  time.Time `json:"completed_at"`
	Duration     int64     `json:"duration"` // in milliseconds
	RecordCount  int       `json:"record_count"`
	ErrorMessage string    `json:"error_message,omitempty"`
	SampleData   string    `json:"sample_data,omitempty" gorm:"type:text"` // JSON string of sample records
	CreatedAt    time.Time `json:"created_at"`

	// Relations
	Job Job `json:"job,omitempty" gorm:"foreignKey:JobID"`
}

// Settings represents global application settings
type Settings struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Key       string    `json:"key" gorm:"uniqueIndex;not null"`
	Value     string    `json:"value" gorm:"type:text"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// TargetDBConfig represents target database configuration for sync
type TargetDBConfig struct {
	Driver   string `json:"driver"`
	Host     string `json:"host"`
	Port     string `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	DBName   string `json:"db_name"`
	SSLMode  string `json:"sslmode"`
}

// AgentToken represents authentication token for agent registration
type AgentToken struct {
	ID          uint       `json:"id" gorm:"primaryKey"`
	AgentName   string     `json:"agent_name" gorm:"not null;uniqueIndex"` // Agent this token is for
	Token       string     `json:"token" gorm:"not null;uniqueIndex"`      // The actual token (hashed)
	TokenPrefix string     `json:"token_prefix"`                           // First 8 chars for display
	Description string     `json:"description"`                            // Optional description
	CreatedAt   time.Time  `json:"created_at"`
	ExpiresAt   *time.Time `json:"expires_at"`   // Optional expiry
	LastUsedAt  *time.Time `json:"last_used_at"` // Last successful auth
	Revoked     bool       `json:"revoked" gorm:"default:false"`
	CreatedBy   string     `json:"created_by"` // Who created the token
}

// IsValid checks if token is valid (not expired, not revoked)
func (t *AgentToken) IsValid() bool {
	if t.Revoked {
		return false
	}
	if t.ExpiresAt != nil && time.Now().After(*t.ExpiresAt) {
		return false
	}
	return true
}

// License represents the software license activation status
type License struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	MachineID      string    `json:"machine_id" gorm:"uniqueIndex"`
	ActivationCode string    `json:"activation_code"`
	ActivatedAt    time.Time `json:"activated_at"`
	ExpiresAt      time.Time `json:"expires_at"`
	Status         string    `json:"status" gorm:"default:'inactive'"` // inactive, active, expired
	ActivatedBy    string    `json:"activated_by"`                     // Username who activated
}

// IsActive checks if license is currently active
func (l *License) IsActive() bool {
	if l.Status != "active" {
		return false
	}
	if time.Now().After(l.ExpiresAt) {
		return false
	}
	return true
}

// DaysRemaining returns remaining days until license expiry
func (l *License) DaysRemaining() int {
	duration := time.Until(l.ExpiresAt)
	days := int(duration.Hours() / 24)
	if days < 0 {
		return 0
	}
	return days
}

// LicenseResponse is the API response for license status
type LicenseResponse struct {
	IsActive      bool      `json:"is_active"`
	MachineID     string    `json:"machine_id"`
	ExpiresAt     time.Time `json:"expires_at,omitempty"`
	DaysRemaining int       `json:"days_remaining"`
	Status        string    `json:"status"`
	Message       string    `json:"message,omitempty"`
}
