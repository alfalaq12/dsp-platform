# DSP Agent - Database Sync Setup Guide

## Quick Setup

### 1. Create .env File

Copy the example and configure:

```powershell
cd C:\Users\BINTANG\dsp-platform\cmd\agent
copy .env.example .env
notepad .env
```

### 2. Configure Database Connection

Edit `.env`:

```bash
# Database Configuration
DB_DRIVER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=your_database
DB_SSLMODE=disable

# Sync Settings
SYNC_ENABLED=true
SYNC_INTERVAL=30  # seconds
SYNC_QUERY=SELECT * FROM users LIMIT 10

# Master Server
MASTER_HOST=202.10.42.65
MASTER_PORT=8447
AGENT_NAME=laptop-bintang
```

### 3. Build Agent

```powershell
cd C:\Users\BINTANG\dsp-platform
go build -o dsp-agent.exe cmd/agent/main.go
```

### 4. Test Database Connection

```powershell
# Set env temporarily to test
$env:SYNC_ENABLED="true"
$env:DB_DRIVER="postgres"
$env:DB_HOST="localhost"
$env:DB_PORT="5432"
$env:DB_USER="postgres"
$env:DB_PASSWORD="your_password"
$env:DB_NAME="your_database"

# Run agent
.\dsp-agent.exe
```

### Expected Output

```
{"level":"info","message":"Starting Tenant Agent","agent_name":"laptop-bintang","sync_enabled":true}
{"level":"info","message":"Testing database connection..."}
{"level":"info","message":"Database connection successful"}
{"level":"info","message":"Connecting to Master server","address":"202.10.42.65:8447"}
{"level":"info","message":"Successfully connected to Master server"}
{"level":"info","message":"Registration acknowledged by Master"}
{"level":"info","message":"Starting data sync"}
{"level":"info","rows":10,"message":"Data fetched successfully"}
{"level":"info","message":"Data sync completed successfully"}
```

## Features

✅ **Auto-configuration** from .env file  
✅ **PostgreSQL/MySQL** support  
✅ **Connection pooling**  
✅ **Periodic sync** (configurable interval)  
✅ **Error handling** with auto-retry  
✅ **Structured logging**

## Troubleshooting

### Database Connection Failed

```
ERROR: Failed to connect to source database
```

**Solutions:**
1. Check PostgreSQL is running
2. Verify credentials in `.env`
3. Check `pg_hba.conf` allows local connections
4. Test with: `psql -U postgres -h localhost`

### Sync Disabled

If database test fails, sync is automatically disabled:
```
WARN: Continuing without database sync
```

Agent will continue with heartbeat only.

---

**Ready to sync!** 🚀
