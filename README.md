# DSP Platform - Centralized Data Synchronization Platform

Platform sinkronisasi data terpusat dengan arsitektur Master-Agent untuk kebutuhan enterprise dan pemerintahan Indonesia.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       Master Server                              │
│  ┌──────────────────┐            ┌───────────────────────────┐  │
│  │   Web Console    │            │      Agent Listener       │  │
│  │  (React + Vite)  │            │        TCP :447           │  │
│  │   Served :441    │            │                           │  │
│  └────────┬─────────┘            └─────────────┬─────────────┘  │
│           │                                     │                │
│  ┌────────▼─────────────────────────────────────▼────────────┐  │
│  │                   Gin HTTP API :441                        │  │
│  │               (REST + JWT Authentication)                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│           │                                                      │
│  ┌────────▼──────────────────────────────────────────────────┐  │
│  │                Embedded SQLite (dsp.db)                    │  │
│  │     Users | Schemas | Networks | Jobs | AuditLogs         │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
               ▲                            ▲
               │ HTTP Request               │ TCP/TLS Connection
               │                            │
    ┌──────────┴──────────┐      ┌──────────┴─────────────────┐
    │    Web Dashboard    │      │       Tenant Agents        │
    │   (Admin Console)   │      │   PostgreSQL | MySQL |     │
    └─────────────────────┘      │   MongoDB | Redis | FTP    │
                                 └────────────────────────────┘
```

## ✨ Features

### Master Server
- **Single Binary**: Tidak butuh install database server terpisah
- **REST API** (Port 441): JWT Auth, Management Schema/Network/Job
- **Agent Listener** (Port 447): Real-time monitoring & config push
- **Web Dashboard**: Modern UI (React/Vite) ter-bundle di binary
- **Target Database**: Push data ke PostgreSQL, MySQL, Oracle
- **UPSERT Support**: Update or Insert otomatis untuk sync berulang

### Tenant Agent
- **Auto-connect**: Reconnection otomatis ke Master
- **Multi-Source Sync**:
  - Database: PostgreSQL, MySQL, SQL Server, Oracle
  - NoSQL: MongoDB, Redis
  - Object Storage: MinIO/S3
  - File: FTP, SFTP (CSV, JSON, Excel)
  - REST API: Fetch dari endpoint external
- **Service Mode**: Windows Service atau Linux Systemd
- **Streaming**: Batch processing untuk data besar

### Web Console Features
| Feature | Description |
|---------|-------------|
| **Dashboard** | Overview sync jobs, agent status, recent logs |
| **Schema** | Define source queries dan target tables |
| **Network** | Configure data sources & targets (DB, FTP, API, MinIO) |
| **Jobs** | Schedule & run sync jobs (cron support) |
| **Terminal Console** | Remote command execution on agents (Admin) |
| **Agent Tokens** | Manage agent authentication tokens |
| **Users** | User management with RBAC (Admin/Viewer) |
| **Audit Logs** | Track all user actions |
| **Settings** | Configure target database |

## 🚀 Quick Start

### 1. Clone & Build

```bash
git clone https://github.com/YOUR-REPO/dsp-platform.git
cd dsp-platform

# Build untuk semua platform
./scripts/build-release.sh 1.0.0
# atau Windows:
.\scripts\build-release.ps1 -Version "1.0.0"
```

### 2. Jalankan Master Server

```bash
# Buat .env dari template
cp .env.example .env
# Edit JWT_SECRET!

# Jalankan
./dsp-master
```

Akses Dashboard: `http://localhost:441` atau `https://localhost:441` (jika TLS enabled)  
**Login Default**: `admin` / `admin` (wajib ganti saat pertama login!)

### 3. Jalankan Agent

```bash
# Di server tenant
cp .env.example .env

# Edit .env:
# MASTER_HOST=192.168.1.100
# MASTER_PORT=447
# AGENT_NAME=kantor-a
# AGENT_TOKEN=<dari dashboard>

./dsp-agent
```

## 📦 Release Packages

Build script otomatis generate ZIP packages:

```
releases/v1.0.0/
├── dsp-master-v1.0.0.zip
│   ├── dsp-master-windows-amd64.exe
│   ├── dsp-master-linux-amd64
│   ├── dsp-master-linux-arm64
│   ├── frontend/          # React build
│   ├── .env.example
│   ├── install.bat
│   └── install.sh
└── dsp-agent-v1.0.0.zip
    ├── dsp-agent-windows-amd64.exe
    ├── dsp-agent-linux-amd64
    ├── dsp-agent-linux-arm64
    ├── .env.example
    ├── install.bat
    └── install.sh
```

## � Configuration

### Master `.env`
```bash
PORT=441
TCP_PORT=447
JWT_SECRET=your-secure-random-string
TLS_ENABLED=false
# Database settings configured via Web Console -> Settings
```

### Agent `.env`
```bash
MASTER_HOST=192.168.1.100
MASTER_PORT=447
AGENT_NAME=tenant-name
AGENT_TOKEN=paste-token-from-dashboard
TLS_ENABLED=false
# Source DB settings pushed from Master (Network config)
```

## 🔒 Security

- **Authentication**: JWT Token dengan HttpOnly Cookies
- **Password Hashing**: Bcrypt
- **TLS Support**: Optional TLS/SSL untuk TCP dan HTTP
- **RBAC**: Role-based access (Admin/Viewer)
- **Audit Log**: Semua aksi user ter-log
- **Session Timeout**: Auto-logout setelah 30 menit idle
- **Terminal Console**: Admin-only dengan command logging

## � Supported Data Sources

| Type | Source | Notes |
|------|--------|-------|
| **Database** | PostgreSQL | Full UPSERT support |
| **Database** | MySQL | ON DUPLICATE KEY UPDATE |
| **Database** | SQL Server | |
| **Database** | Oracle | MERGE INTO support |
| **NoSQL** | MongoDB | Collection sync |
| **NoSQL** | Redis | Key pattern scan |
| **Object Storage** | MinIO/S3 | Bucket sync, MinIO Mirror |
| **File** | FTP | CSV, JSON, Excel |
| **File** | SFTP | SSH key auth supported |
| **API** | REST | GET/POST with auth |

## 🖥️ Production Deployment

### Linux (Systemd)

```bash
# Create service file
sudo nano /etc/systemd/system/dsp-master.service

[Unit]
Description=DSP Master Server
After=network.target

[Service]
Type=simple
User=dsp
WorkingDirectory=/opt/dsp
ExecStart=/opt/dsp/dsp-master
Restart=always

[Install]
WantedBy=multi-user.target

# Enable & start
sudo systemctl enable dsp-master
sudo systemctl start dsp-master
```

### Windows (Service)

```powershell
# Install as service using NSSM
nssm install DSPMaster "C:\dsp\dsp-master.exe"
nssm set DSPMaster AppDirectory "C:\dsp"
nssm start DSPMaster
```

## 📚 Project Structure

```
dsp-platform/
├── cmd/
│   ├── master/          # Master server entry
│   └── agent/           # Agent entry
├── internal/
│   ├── core/            # Models & types
│   ├── auth/            # JWT middleware
│   ├── database/        # DB connections
│   ├── filesync/        # FTP/SFTP/API clients
│   ├── server/          # HTTP handlers & TCP listener
│   └── security/        # TLS utilities
├── frontend/            # React + Vite
│   ├── src/
│   │   ├── pages/       # Dashboard, Jobs, Terminal, etc
│   │   ├── components/  # Reusable UI components
│   │   └── services/    # API client
│   └── dist/            # Production build
├── scripts/
│   ├── build-release.ps1
│   └── build-release.sh
└── README.md
```

## 🆕 Recent Updates

- **MinIO Mirror**: Sync data between MinIO/S3 buckets (source to target)
- **Network 1:1 Pairing**: Configure source AND target dalam satu Network config
- **License Activation**: Software license management system
- **Terminal Console**: Remote command execution from Master to Agent
- **UPSERT Support**: Multi-database UPSERT (PostgreSQL, MySQL, Oracle, MongoDB)
- **Release Build Scripts**: Automated multi-platform packaging
- **Light/Dark Theme**: Full theme support across all pages
- **Session Timeout**: Auto-logout with warning modal

## 📞 Support

Email: bintangal.falag@gmail.com

---

**DSP Platform** - Sinkronisasi data enterprise yang simpel dan powerful 🚀
