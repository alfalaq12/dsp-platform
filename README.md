# DSP Platform - Centralized Data Synchronization Platform

Platform sinkronisasi data terpusat dengan arsitektur Master-Tenant untuk kebutuhan enterprise dan pemerintahan Indonesia.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Master Server                           │
│  ┌────────────────────┐        ┌────────────────────────┐  │
│  │    Web Console     │        │    Agent Listener      │  │
│  │   (React + Vite)   │        │      TCP :447          │  │
│  │    Served :5173    │        │                        │  │
│  └─────────┬──────────┘        └────────────┬───────────┘  │
│            │                                 │              │
│  ┌─────────▼───────────────────────────────▼───────────┐   │
│  │              Gin HTTP API :441                       │   │
│  │          (REST + JWT Authentication)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│            │                                                │
│  ┌─────────▼─────────────────────────────────────────────┐ │
│  │              SQLite Database (dsp.db)                 │ │
│  │         Users | Schemas | Networks | Jobs             │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
               ▲                           ▲
               │ HTTP Request              │ TCP Connection
               │                           │
    ┌──────────┴──────────┐     ┌──────────┴──────────┐
    │    Web Dashboard    │     │   Tenant Agents     │
    │   (Admin Console)   │     │  (Multiple Sites)   │
    └─────────────────────┘     └─────────────────────┘
```

## 📂 Project Structure

```
dsp-platform/
├── cmd/
│   ├── master/                 # Master Server
│   │   └── main.go             # HTTP :441 + TCP :447
│   └── agent/                  # Tenant Agent
│       ├── main.go             # Agent dengan database sync
│       ├── scheduler.go        # Job scheduler
│       ├── .env.example        # Environment template
│       └── SETUP.md            # Setup guide
├── internal/
│   ├── auth/
│   │   └── middleware.go       # JWT authentication
│   ├── core/
│   │   └── types.go            # Data structures
│   ├── database/
│   │   └── connection.go       # Database connector
│   ├── logger/
│   │   └── logger.go           # Structured logging (zerolog)
│   └── server/
│       ├── handler.go          # HTTP API handlers
│       └── listener.go         # TCP agent listener
├── frontend/                   # React + Vite Dashboard
│   ├── src/
│   │   ├── components/         # Reusable components
│   │   │   └── Layout/         # Sidebar, Header
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx   # Overview & stats
│   │   │   ├── Schema.jsx      # SQL query management
│   │   │   ├── Network.jsx     # Agent/source tracking
│   │   │   ├── Jobs.jsx        # Sync job management
│   │   │   └── Login.jsx       # Authentication
│   │   ├── services/
│   │   │   └── api.js          # Axios API client
│   │   └── hooks/
│   │       └── useAuth.js      # Auth hook
│   └── package.json
├── deployment/                 # Deployment scripts
│   ├── DEPLOYMENT.md           # Full deployment guide
│   ├── linux/
│   │   ├── install.sh          # Linux installer
│   │   ├── dsp-master.service  # Systemd master service
│   │   └── dsp-agent.service   # Systemd agent service
│   └── windows/
│       └── install-service.ps1 # Windows service installer
├── bin/                        # Build output directory
├── logs/                       # Application logs
├── build.sh                    # Linux/macOS build script
├── build.ps1                   # Windows build script
├── Makefile                    # Development commands
├── QUICKSTART.md               # Quick start guide
├── LOGGING.md                  # Logging documentation
└── go.mod
```

## ✨ Features

### Master Server
- **REST API** (Port 441)
  - JWT-based authentication
  - Schema management (SQL query definitions)
  - Network management (agent/source tracking)
  - Job management (sync job definitions)
  - Agent job configuration endpoint
  
- **Agent Listener** (Port 447)
  - TCP-based agent connections
  - Real-time heartbeat monitoring
  - Configuration push to agents
  - Data sync reception

- **Web Dashboard** (React + Vite)
  - Modern, responsive UI dengan TailwindCSS
  - Real-time agent status monitoring
  - Schema, Network, dan Job management
  - Dark mode support (coming soon)

### Tenant Agent
- Auto-connect ke Master server dengan reconnection
- Dynamic job configuration dari web console
- Multi-database support (PostgreSQL, MySQL, SQL Server)
- Scheduled job execution dengan cron-like scheduling
- Structured logging dengan file rotation
- Windows & Linux service support

## 🚀 Quick Start

### Prerequisites
- Go 1.21+
- Node.js 18+ (untuk frontend)
- Git

### 1. Clone & Install Dependencies

```bash
cd dsp-platform

# Backend dependencies
go mod tidy

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Start Master Server

```bash
# Development mode
go run cmd/master/main.go
```

Server akan start di:
- HTTP API: `http://localhost:441`
- Agent Listener: `tcp://localhost:447`

### 3. Start Frontend Dashboard

```bash
cd frontend
npm run dev
```

Dashboard tersedia di `http://localhost:5173`

### 4. Start Tenant Agent (Optional)

Buka terminal baru:

```bash
# Copy dan edit environment
cd cmd/agent
cp .env.example .env
# Edit .env sesuai konfigurasi database

# Run agent
go run .
```

Agent akan:
- Connect ke Master di `localhost:447`
- Register dan kirim heartbeat setiap 5 detik
- Pull job configuration dari Master
- Execute scheduled sync jobs

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | User login, returns JWT token |

### Schemas (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemas` | List all schemas |
| POST | `/api/schemas` | Create schema |
| PUT | `/api/schemas/:id` | Update schema |
| DELETE | `/api/schemas/:id` | Delete schema |

### Networks (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/networks` | List all networks |
| POST | `/api/networks` | Create network |
| PUT | `/api/networks/:id` | Update network |
| DELETE | `/api/networks/:id` | Delete network |

### Jobs (Protected)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/jobs` | List all jobs |
| POST | `/api/jobs` | Create job |
| PUT | `/api/jobs/:id` | Update job |
| DELETE | `/api/jobs/:id` | Delete job |
| POST | `/api/jobs/:id/run` | Run job manually |
| GET | `/api/jobs/agent/:name` | Get jobs for specific agent |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health status |

## 🔧 Agent Protocol

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
    "sync_enabled": true
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
    "memory_usage": 1024
  }
}
```

### Config Pull Request
```json
{
  "type": "CONFIG_PULL",
  "agent_name": "tenant-1",
  "timestamp": "2025-12-03T20:50:30Z"
}
```

### Data Sync
```json
{
  "type": "DATA_SYNC",
  "agent_name": "tenant-1",
  "status": "success",
  "timestamp": "2025-12-03T20:50:35Z",
  "data": {
    "job_id": 1,
    "job_name": "User Data Sync",
    "target_table": "sync_users",
    "record_count": 150,
    "records": [...]
  }
}
```

## 🛠️ Build for Production

### Linux/macOS
```bash
chmod +x build.sh
./build.sh
```

### Windows
```powershell
.\build.ps1
```

Output:
- `bin/linux/dsp-master` & `bin/linux/dsp-agent`
- `bin/windows/dsp-master.exe` & `bin/windows/dsp-agent.exe`

## 📦 Deployment

Lihat [deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md) untuk panduan lengkap deployment di:
- **Linux** sebagai systemd service
- **Windows** sebagai Windows Service (via NSSM)
- **Docker** dengan docker-compose

## 🗄️ Database

SQLite database (`dsp.db`) dibuat otomatis dengan tabel:
- `users` - User authentication
- `schemas` - SQL query definitions
- `networks` - Agent/source tracking
- `jobs` - Sync job definitions

## 🔑 Default Credentials

| Username | Password |
|----------|----------|
| admin | admin |

> ⚠️ **PENTING:** Ganti password default sebelum production deployment!

## 📋 Makefile Commands

```bash
make dev         # Run master server (development)
make agent       # Run agent (development)
make build       # Build all binaries
make frontend    # Run frontend dev server
make clean       # Clean build artifacts
make test        # Run tests
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICKSTART.md](QUICKSTART.md) | Quick start guide |
| [LOGGING.md](LOGGING.md) | Logging system documentation |
| [deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md) | Production deployment guide |
| [cmd/agent/SETUP.md](cmd/agent/SETUP.md) | Agent setup guide |

## 🔒 Security Recommendations

- [ ] Change default admin password
- [ ] Use strong JWT secret (set `JWT_SECRET` env)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall rules (ports 441, 447)
- [ ] Run services with dedicated user (not root/Administrator)
- [ ] Enable database encryption for production
- [ ] Set up regular backup strategy

## 📈 Roadmap

- [x] Master Server dengan HTTP API
- [x] Tenant Agent dengan auto-reconnect
- [x] Web Dashboard (React + Vite + TailwindCSS)
- [x] JWT Authentication
- [x] Dynamic job configuration dari web console
- [x] Multi-database support (PostgreSQL, MySQL, SQL Server)
- [x] Linux & Windows service deployment
- [x] Structured logging dengan file rotation
- [x] Responsive dashboard UI
- [ ] Real-time WebSocket updates
- [ ] Dark mode toggle
- [ ] PostgreSQL support untuk Master database
- [ ] Job history & audit log
- [ ] Agent health metrics dashboard
- [ ] TLS encryption untuk agent connections
- [ ] Multi-user dengan role-based access

## 📞 Support

Untuk bantuan deployment di lingkungan pemerintahan Indonesia:
- Dokumentasi: README.md & QUICKSTART.md
- Deployment Guide: deployment/DEPLOYMENT.md
- Contact: support@dsp-platform.id

## 📄 License

MIT License - lihat file LICENSE untuk detail.
