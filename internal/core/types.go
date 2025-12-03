package core

import "time"

// Schema represents a SQL query configuration to be executed on data sources
type Schema struct {
	ID          uint      `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name" gorm:"not null"`
	SQLCommand  string    `json:"sql_command" gorm:"type:text;not null"`
	TargetTable string    `json:"target_table" gorm:"not null"`
	Description string    `json:"description" gorm:"type:text"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Network represents a data source (Tenant Agent) or data target
type Network struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"not null;unique"`
	IPAddress string    `json:"ip_address" gorm:"not null"`
	Status    string    `json:"status" gorm:"default:'offline'"` // online/offline
	Type      string    `json:"type" gorm:"default:'source'"`    // source/target
	LastSeen  time.Time `json:"last_seen"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Job represents a data synchronization job linking a Schema to a Network
type Job struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"not null"`
	SchemaID  uint      `json:"schema_id" gorm:"not null"`
	NetworkID uint      `json:"network_id" gorm:"not null"`
	Status    string    `json:"status" gorm:"default:'pending'"` // pending/running/completed/failed
	Schedule  string    `json:"schedule"`                        // cron expression or interval
	LastRun   time.Time `json:"last_run"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	Schema  Schema  `json:"schema" gorm:"foreignKey:SchemaID"`
	Network Network `json:"network" gorm:"foreignKey:NetworkID"`
}

// User represents an authenticated user for the web console
type User struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Username  string    `json:"username" gorm:"not null;unique"`
	Password  string    `json:"-" gorm:"not null"` // Never expose in JSON
	CreatedAt time.Time `json:"created_at"`
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
	Token    string `json:"token"`
	Username string `json:"username"`
}

// JobRunRequest represents the payload to run a job
type JobRunRequest struct {
	JobID uint `json:"job_id" binding:"required"`
}
