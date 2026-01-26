# DSP Platform - Centralized Data Synchronization Platform

Platform sinkronisasi data terpusat dengan arsitektur Master-Agent untuk kebutuhan enterprise dan pemerintahan Indonesia.

## 🏗️ Architecture

```
                            ┌─────────────────────────────────────────────────────┐
                            │                   MASTER SERVER                     │
                            │  ┌─────────────────────────────────────────────────┐│
                            │  │              Gin HTTP API :441                  ││
                            │  │           (REST + JWT Authentication)           ││
                            │  └─────────────────────────────────────────────────┘│
                            │         │                              │            │
                            │  ┌──────▼──────┐              ┌────────▼────────┐   │
                            │  │ Web Console │              │  Agent Listener │   │
                            │  │ React+Vite  │              │    TCP :447     │   │
                            │  │   :441      │              │   (TLS Ready)   │   │
                            │  └─────────────┘              └─────────────────┘   │
                            │                        │                            │
                            │  ┌─────────────────────▼───────────────────────────┐│
                            │  │            Embedded SQLite (dsp.db)             ││
                            │  │   Users │ Schemas │ Networks │ Jobs │ Logs      ││
                            │  └─────────────────────────────────────────────────┘│
                            └─────────────────────────────────────────────────────┘
                                       │                              │
                                       │ HTTPS                        │ TCP/TLS
                                       ▼                              ▼
                            ┌──────────────────┐          ┌───────────────────────┐
                            │  Web Dashboard   │          │     Tenant Agents     │
                            │ (Admin Console)  │          │  ┌─────────────────┐  │
                            └──────────────────┘          │  │ PostgreSQL      │  │
                                                          │  │ MySQL │ Oracle  │  │
                                                          │  │ MongoDB │ Redis │  │
                                                          │  │ MinIO │ FTP     │  │
                                                          │  └─────────────────┘  │
                                                          └───────────────────────┘
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
| **Settings** | Backup & restore configuration |

## 🐳 Docker (Recommended)

**Satu command untuk run Master Server:**

```bash
# Clone dan jalankan
git clone https://github.com/alfalaq12/dsp-platform.git
cd dsp-platform

# Start Master Server saja
docker compose up -d

# Lihat logs
docker compose logs -f
```

🌐 Akses Dashboard: `http://localhost:441`  
🔐 **Login**: `admin` / `admin`

**Docker Commands:**
```bash
# Master saja (default)
docker compose up -d

# Master + Agent (local testing)
docker compose --profile all up -d

# Agent saja (connect ke external Master)
# Edit .env dulu: MASTER_HOST=192.168.1.100
docker compose --profile agent up -d

# Stop semua
docker compose down
```

---

## 🚀 Manual Build (Tanpa Docker)

```bash
# Clone repo
git clone https://github.com/alfalaq12/dsp-platform.git
cd dsp-platform

# Linux/Mac - Satu command untuk build semua:
./install.sh

# Windows PowerShell - Satu command untuk build semua:
.\install.ps1
```

**Itu saja!** Script akan otomatis:
- ✅ Build Frontend (React)
- ✅ Build Master & Agent untuk Linux
- ✅ Build Master & Agent untuk Windows
- ✅ Copy semua assets yang diperlukan

Output ada di folder `bin/linux/` dan `bin/windows/`.

### Options (Opsional)

```bash
# Linux/Mac
./install.sh --linux-only       # Build Linux saja
./install.sh --skip-frontend    # Skip frontend (pakai existing)

# Windows PowerShell  
.\install.ps1 -LinuxOnly        # Build Linux saja
.\install.ps1 -SkipFrontend     # Skip frontend (pakai existing)
```

### Jalankan Master Server

```bash
# 1. Copy dan edit config
cp .env.example .env
# Edit JWT_SECRET di file .env!

# 2. Jalankan
./bin/linux/dsp-master         # Linux
.\bin\windows\dsp-master.exe   # Windows
```

🌐 Akses Dashboard: `http://localhost:441`  
🔐 **Login Default**: `admin` / `admin`

### Jalankan Agent (di Server Tenant)

```bash
# 1. Copy dan edit config
cp .env.example .env

# 2. Edit .env:
#    MASTER_HOST=192.168.1.100
#    MASTER_PORT=447
#    AGENT_NAME=kantor-a
#    AGENT_TOKEN=<copy dari dashboard>

# 3. Jalankan
./bin/linux/dsp-agent          # Linux
.\bin\windows\dsp-agent.exe    # Windows
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

## ⚙️ Configuration

Semua config ada di satu file `.env.example`. Copy ke `.env` dan edit sesuai kebutuhan:

```bash
cp .env.example .env
```

### Master Server
```bash
JWT_SECRET=YourSuperSecretJWTKey    # WAJIB GANTI!
HTTP_PORT=441                        # Web Console port
TCP_PORT=447                         # Agent connection port
TLS_ENABLED=false                    # Set true untuk HTTPS
```

### Agent (Tenant)
```bash
MASTER_HOST=192.168.1.100            # IP Master Server
MASTER_PORT=447                      # TCP port Master
AGENT_NAME=kantor-cabang-a           # Nama agent
AGENT_TOKEN=paste-dari-dashboard     # Token dari dashboard Master
TLS_ENABLED=false                    # Samakan dengan Master
```

### TLS/HTTPS (Optional)
```bash
TLS_ENABLED=true
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
TLS_CA_PATH=./certs/ca.crt
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
