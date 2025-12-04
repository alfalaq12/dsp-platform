# Quick Start Guide - VPS Master + Windows Agent

Panduan cepat untuk deploy DSP Platform dengan Master Server di VPS Linux dan Agent di Windows Laptop.

## 🎯 Setup Overview

```
┌─────────────────────────────────┐
│    VPS Linux (Public IP)        │
│   ┌─────────────────────┐       │
│   │  Master Server      │       │
│   │  Port 8080 (HTTP)   │◄──────┼─── Web Browser (Dashboard)
│   │  Port 447  (Agent)  │       │
│   └─────────────────────┘       │
└─────────────────────────────────┘
              ▲
              │ Port 447
              │ Heartbeat + Data Sync
              │
┌─────────────────────────────────┐
│   Windows Laptop (Home/Office)  │
│   ┌─────────────────────┐       │
│   │   Agent Service     │       │
│   │   Connect to VPS    │       │
│   └─────────────────────┘       │
└─────────────────────────────────┘
```

---

## Part 1: Deploy Master Server di VPS Linux

### Prerequisites
- Ubuntu 20.04+ atau Debian 11+
- Root atau sudo access
- Go 1.21+ installed

### Step 1: Install Go (jika belum ada)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Go
wget https://go.dev/dl/go1.21.5.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.21.5.linux-amd64.tar.gz

# Add to PATH
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Verify
go version
```

### Step 2: Clone Repository

```bash
cd ~
git clone https://github.com/alfalaq12/dsp-platform.git
cd dsp-platform
```

### Step 3: Build Master Server

```bash
# Build binaries
./build.sh

# Verify binary created
ls -lh bin/linux/dsp-master
```

### Step 4: Install Master Server

```bash
cd deployment/linux
sudo ./install.sh
```

**Saat ditanya:** "Do you want to install the Agent on this server too? (y/n)"
- Ketik: **`n`** (kita hanya install master di VPS)

### Step 5: Configure Firewall

```bash
# Allow HTTP API (Web Console)
sudo ufw allow 8080/tcp

# Allow Agent connections
sudo ufw allow 447/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

### Step 6: Start Master Server

```bash
# Enable service to start on boot
sudo systemctl enable dsp-master

# Start service
sudo systemctl start dsp-master

# Check status
sudo systemctl status dsp-master
```

**Expected output:**
```
● dsp-master.service - DSP Platform Master Server
     Loaded: loaded (/etc/systemd/system/dsp-master.service; enabled)
     Active: active (running) since ...
```

### Step 7: Verify Master Server

```bash
# Check if HTTP API is running
curl http://localhost:8080/health

# Should return: {"status":"ok"}

# Get your VPS public IP
curl ifconfig.me

# Save this IP - you'll need it for Windows Agent!
```

### Step 8: View Logs

```bash
# Real-time logs
sudo journalctl -u dsp-master -f

# Or view log file
sudo tail -f /opt/dsp-platform/logs/master.log
```

**Expected logs:**
```
{"level":"info","message":"Starting DSP Platform Master Server","web_port":"441","agent_port":"447"}
{"level":"info","message":"Database initialized and migrated successfully"}
{"level":"info","message":"Starting HTTP server","port":"441"}
{"level":"info","message":"Starting agent listener","port":"447"}
```

✅ **Master Server siap!** Catat IP VPS kamu.

---

## Part 2: Deploy Agent di Windows Laptop

### Prerequisites
- Windows 10/11 atau Windows Server 2016+
- Go 1.21+ installed (download dari https://go.dev/dl/)
- Administrator access

### Step 1: Clone Repository

```powershell
# Open PowerShell
cd C:\Users\BINTANG
git clone https://github.com/alfalaq12/dsp-platform.git
cd dsp-platform
```

### Step 2: Edit Agent Configuration

**IMPORTANT:** Ganti alamat Master Server ke IP VPS kamu!

Edit file `cmd/agent/main.go`:

```powershell
notepad cmd\agent\main.go
```

Cari baris ini:
```go
const (
	MasterHost = "localhost"    // ← GANTI INI
	MasterPort = "447"
	AgentName  = "tenant-1"     // ← GANTI INI juga (optional)
)
```

Ganti jadi:
```go
const (
	MasterHost = "123.45.67.89"  // ← IP VPS kamu
	MasterPort = "447"
	AgentName  = "laptop-windows-bintang"  // ← Nama agent kamu
)
```

Save file (Ctrl+S)!

### Step 3: Build Agent

```powershell
# Build binary
go build -o dsp-agent.exe cmd/agent/main.go

# Verify binary created
ls dsp-agent.exe
```

### Step 4: Test Connection (Optional but Recommended)

```powershell
# Test if VPS port 447 accessible
Test-NetConnection -ComputerName 123.45.67.89 -Port 447
```

**Expected:** `TcpTestSucceeded : True`

Kalau **False**, cek:
1. Firewall VPS (ufw allow 447/tcp)
2. Cloud provider security group (kalau pakai AWS/GCP/Azure)

### Step 5: Test Run Agent

```powershell
# Run agent temporarily untuk test
.\dsp-agent.exe
```

**Expected logs:**
```
{"level":"info","message":"Starting Tenant Agent","agent_name":"laptop-windows-bintang","master":"123.45.67.89:447"}
{"level":"info","message":"Connecting to Master server","address":"123.45.67.89:447"}
{"level":"info","message":"Successfully connected to Master server"}
{"level":"info","message":"Registering agent with Master"}
```

Kalau muncul log di atas, **SUCCESS!** 🎉

Press **Ctrl+C** untuk stop.

### Step 6: Install Agent as Windows Service

#### Option A: Simple Background Run (Easy)

Buat file `start-agent.bat`:

```batch
@echo off
cd C:\Users\BINTANG\test-dsp\dsp-platform
start /B dsp-agent.exe > agent.log 2>&1
```

Run saat startup:
1. Press **Win+R**
2. Ketik: `shell:startup`
3. Copy `start-agent.bat` ke folder startup

#### Option B: Windows Service with NSSM (Recommended)

```powershell
# Download NSSM
# https://nssm.cc/download
# Extract ke C:\Program Files\nssm\

# Install as service
cd "C:\Program Files\nssm"
.\nssm.exe install DSPAgent "C:\Users\BINTANG\test-dsp\dsp-platform\dsp-agent.exe"

# Set working directory
.\nssm.exe set DSPAgent AppDirectory "C:\Users\BINTANG\test-dsp\dsp-platform"

# Set to auto-start
.\nssm.exe set DSPAgent Start SERVICE_AUTO_START

# Set log files
.\nssm.exe set DSPAgent AppStdout "C:\Users\BINTANG\test-dsp\dsp-platform\logs\agent.log"
.\nssm.exe set DSPAgent AppStderr "C:\Users\BINTANG\test-dsp\dsp-platform\logs\agent-error.log"

# Start service
Start-Service DSPAgent

# Check status
Get-Service DSPAgent
```

### Step 7: Verify Agent

```powershell
# View logs
Get-Content "C:\Users\BINTANG\test-dsp\dsp-platform\logs\agent.log" -Tail 50 -Wait
```

**Di VPS**, cek master server logs:
```bash
sudo journalctl -u dsp-master -f
```

Harusnya ada log seperti:
```
{"level":"info","message":"Agent connected","agent":"laptop-windows-bintang"}
{"level":"info","message":"Agent registered","agent":"laptop-windows-bintang"}
```

✅ **Agent berhasil connect ke Master!**

---

## Part 3: Access Web Dashboard

Buka browser di laptop atau device manapun:

```
http://VPS_IP_KAMU:8080
```

**Default Credentials:**
- Username: `admin`
- Password: `admin`

⚠️ **GANTI PASSWORD INI di production!**

---

## 🔧 Troubleshooting

### Agent tidak bisa connect ke Master

**1. Cek Master Server running:**
```bash
# Di VPS
sudo systemctl status dsp-master
sudo netstat -tulpn | grep 447
```

**2. Cek Firewall VPS:**
```bash
sudo ufw status
# Harus ada: 447/tcp ALLOW
```

**3. Test connection dari Windows:**
```powershell
Test-NetConnection -ComputerName VPS_IP -Port 447
```

**4. Cek Cloud Provider Security Group** (AWS/GCP/Azure)
- Pastikan port 447 TCP dibuka untuk inbound traffic

### Master Server error

```bash
# View detailed logs
sudo journalctl -u dsp-master -n 100

# Check if port already in use
sudo netstat -tulpn | grep -E ':(8080|447)'

# Restart service
sudo systemctl restart dsp-master
```

### Agent logs "connection refused"

**Solusi:**
1. Pastikan IP VPS benar di `cmd/agent/main.go`
2. Rebuild agent setelah edit: `go build -o dsp-agent.exe cmd/agent/main.go`
3. Restart agent service

---

## 📊 Monitoring

### View Master Logs (VPS)
```bash
sudo journalctl -u dsp-master -f
sudo tail -f /opt/dsp-platform/logs/master.log
```

### View Agent Logs (Windows)
```powershell
Get-Content "C:\Users\BINTANG\test-dsp\dsp-platform\logs\agent.log" -Tail 50 -Wait
```

### Check Status
```bash
# VPS
sudo systemctl status dsp-master

# Windows
Get-Service DSPAgent
```

---

## 🚀 Next Steps

1. **Change default password** di web dashboard
2. **Configure database connection** (optional - default SQLite)
3. **Setup SSL/TLS** untuk HTTPS (recommended untuk production)
4. **Add more agents** dari server/laptop lain
5. **Setup monitoring** dengan Grafana/Prometheus

---

## 📚 Documentation

- Full deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md)
- Logging guide: [LOGGING.md](LOGGING.md)
- Main README: [README.md](README.md)

---

## 💡 Tips

1. **Gunakan screen/tmux** di VPS untuk run commands
2. **Enable SSH key auth** untuk security
3. **Setup auto-updates** untuk security patches
4. **Regular backup** database dan logs
5. **Monitor disk space** untuk log files

---

## ✅ Checklist

### VPS Master Server
- [ ] Go installed
- [ ] Repository cloned
- [ ] Master binary built
- [ ] Master service installed
- [ ] Firewall configured (8080, 447)
- [ ] Service started and enabled
- [ ] Health check passed
- [ ] Logs verified

### Windows Agent
- [ ] Go installed
- [ ] Repository cloned
- [ ] Agent config edited (MasterHost)
- [ ] Agent binary built
- [ ] Connection tested
- [ ] Service installed
- [ ] Agent connected to master
- [ ] Logs verified

### Final
- [ ] Web dashboard accessible
- [ ] Default password changed
- [ ] Agent showing in dashboard

---

**Need help?** Check [DEPLOYMENT.md](DEPLOYMENT.md) atau review logs! 🎉
