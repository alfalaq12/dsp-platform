# DSP Platform - Centralized Data Synchronization Platform

Platform sinkronisasi data terpusat dengan arsitektur Master-Tenant untuk kebutuhan enterprise dan pemerintahan Indonesia.

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Master Server                           │
│  ┌────────────────────┐        ┌────────────────────────┐  │
│  │    Web Console     │        │    Agent Listener      │  │
│  │   (React + Vite)   │        │      TCP :447          │  │
│  │    Served :441     │        │                        │  │
│  └─────────┬──────────┘        └────────────┬───────────┘  │
│            │                                 │              │
│  ┌─────────▼───────────────────────────────▼───────────┐   │
│  │              Gin HTTP API :441                       │   │
│  │          (REST + JWT Authentication)                 │   │
│  └─────────────────────────────────────────────────────┘   │
│            │                                                │
│  ┌─────────▼─────────────────────────────────────────────┐ │
│  │             Embedded SQLite (dsp.db)                  │ │
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

## ✨ Features

### Master Server
- **Single Binary**: Tidak butuh install database server terpisah. Cukup jalankan binary `dsp-master`.
- **REST API** (Port 441): JWT Auth, Management Schema/Network/Job.
- **Agent Listener** (Port 447): Real-time monitoring & config push.
- **Web Dashboard**: Modern UI (React/Vite) sudah ter-bundle di dalam binary.

### Tenant Agent
- **Auto-connect**: Reconnection otomatis ke Master.
- **Multi-Database Sync**: Support sync data DARI/KE **PostgreSQL, MySQL, SQL Server, Oracle**.
- **Service Mode**: Jalan sebagai Windows Service atau Linux Systemd.

## 🚀 Quick Start

### 1. Download & Build
```bash
git clone https://github.com/alfalaq12/dsp-platform.git
cd dsp-platform
./build.sh  # atau .\build.ps1 di Windows
```

### 2. Jalankan Master Server
```bash
./bin/linux/dsp-master
# atau
.\bin\windows\dsp-master.exe
```
Web Dashboard akan aktif di: `http://localhost:441`
*Login Default: `admin` / `admin`*

### 3. Jalankan Tenant Agent
```bash
# Edit config agent (arahkan ke IP master)
# Jalankan agent
./bin/linux/dsp-agent
```

## 📦 Production Deployment

Lihat [deployment/DEPLOYMENT.md](deployment/DEPLOYMENT.md) untuk panduan lengkap deployment:
- **Linux**: Sebagai Systemd Service.
- **Windows**: Sebagai Windows Service.
- **Backup**: Panduan backup file `dsp.db`.

## 🔒 Security

- **Database**: File `dsp.db` aman di server lokal.
- **Auth**: JWT Token dengan HttpOnly Cookies (aman dari XSS).
- **Password**: Bcrypt Hashing.
- **Rekomendasi**: Gunakan Reverse Proxy (Nginx/IIS) untuk HTTPS di production.

## 📚 Documentation
- [DEPLOYMENT.md](deployment/DEPLOYMENT.md) - Panduan Deploy Production
- [QUICKSTART.md](QUICKSTART.md) - Panduan Cepat Coba-coba
- [LOGGING.md](LOGGING.md) - Dokumentasi Log

## 📞 Support
Untuk bantuan deployment: support@dsp-platform.id
