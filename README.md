# DSP Platform - Centralized Data Synchronization Platform

A Master-Tenant architecture system for centralized data synchronization and management.

## Architecture

```
┌─────────────────────────────────────────┐
│         Master Server                   │
│  ┌────────────────┐  ┌───────────────┐ │
│  │  Web Console   │  │ Agent Listener│ │
│  │   Port: 441    │  │  Port: 447    │ │
│  └────────────────┘  └───────────────┘ │
│         Gin HTTP         TCP Server     │
└─────────────────────────────────────────┘
              ▲                ▲
              │                │
              │                │ Heartbeat/Data
              │                │
         Web Dashboard    ┌────┴─────┐
                          │  Tenant  │
                          │  Agent   │
                          └──────────┘
```

## Project Structure

```
dsp-platform/
├── cmd/
│   ├── master/          # Master Server entry point
│   │   └── main.go      # HTTP :441 + TCP :447
│   └── agent/           # Tenant Agent entry point
│       └── main.go      # Connects to Master :447
├── internal/
│   ├── core/
│   │   └── types.go     # Data structures (Schema, Network, Job)
│   ├── auth/
│   │   └── middleware.go # JWT authentication
│   └── server/
│       ├── handler.go   # HTTP API handlers
│       └── listener.go  # TCP agent listener
└── go.mod
```

## Features

### Master Server
- **Web Console API** (Port 441)
  - User authentication (JWT)
  - Schema management (SQL query definitions)
  - Network management (agent/source tracking)
  - Job management (data sync jobs)
  
- **Agent Listener** (Port 447)
  - Accept agent connections (TCP)
  - Process heartbeats
  - Handle data push from agents
  - Send configurations to agents

### Tenant Agent
- Auto-connect to Master server
- Send heartbeat every 5 seconds
- Push system metrics
- Auto-reconnect on disconnection

## Quick Start

### 1. Install Dependencies

```bash
cd dsp-platform
go mod tidy
```

### 2. Start Master Server

```bash
go run cmd/master/main.go
```

The server will start:
- HTTP API on `http://localhost:441`
- Agent Listener on `tcp://localhost:447`

### 3. Start Tenant Agent

In a new terminal:

```bash
go run cmd/agent/main.go
```

The agent will:
- Connect to Master at `localhost:447`
- Send registration message
- Send heartbeat every 5 seconds

## API Endpoints

### Authentication
- `POST /api/login` - User login
  ```json
  {
    "username": "admin",
    "password": "admin"
  }
  ```

### Schemas (Protected)
- `GET /api/schemas` - List all schemas
- `POST /api/schemas` - Create schema
- `PUT /api/schemas/:id` - Update schema
- `DELETE /api/schemas/:id` - Delete schema

### Networks (Protected)
- `GET /api/networks` - List all networks
- `POST /api/networks` - Create network
- `PUT /api/networks/:id` - Update network
- `DELETE /api/networks/:id` - Delete network

### Jobs (Protected)
- `GET /api/jobs` - List all jobs
- `POST /api/jobs` - Create job
- `PUT /api/jobs/:id` - Update job
- `DELETE /api/jobs/:id` - Delete job
- `POST /api/jobs/:id/run` - Execute job manually

## Agent Protocol

Messages are JSON-based, newline-delimited:

### Registration
```json
{
  "type": "REGISTER",
  "agent_name": "tenant-1",
  "status": "online",
  "timestamp": "2025-12-03T20:50:30Z",
  "data": {
    "version": "1.0.0",
    "os": "linux"
  }
}
```

### Heartbeat
```json
{
  "type": "HEARTBEAT",
  "agent_name": "tenant-1",
  "status": "online",
  "timestamp": "2025-12-03T20:50:35Z",
  "data": {
    "cpu_usage": 45.2,
    "memory_usage": 62.8
  }
}
```

## Testing

### Test Login API
```bash
curl -X POST http://localhost:441/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

### Test Schema Creation
```bash
curl -X POST http://localhost:441/api/schemas \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "User Data Sync",
    "sql_command": "SELECT * FROM users WHERE updated_at > ?",
    "target_table": "sync_users"
  }'
```

### Test Agent Connection
```bash
# Start agent
go run cmd/agent/main.go

# Check logs for heartbeat messages
```

## Database

SQLite database (`dsp.db`) is created automatically with these tables:
- `users` - Authentication
- `schemas` - SQL query definitions
- `networks` - Agent/source tracking
- `jobs` - Sync job definitions

## Default Credentials

- **Username:** `admin`
- **Password:** `admin`

> ⚠️ Change these in production!

## Next Steps

1. **Frontend Development:**
   - Create React + Vite dashboard
   - Implement Schema, Network, Jobs pages
   - Add real-time agent status updates

2. **Production Enhancements:**
   - Add password hashing (bcrypt)
   - Implement TLS for agent connections
   - Add job scheduling (cron)
   - Metrics and monitoring
   - PostgreSQL migration

## License

MIT
