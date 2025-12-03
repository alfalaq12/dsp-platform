# DSP Platform - Deployment Guide

Panduan lengkap untuk deploy DSP Platform di Linux dan Windows untuk keperluan enterprise/pemerintahan.

## 📦 Build Cross-Platform Binaries

### Dari Linux/macOS:
```bash
chmod +x build.sh
./build.sh
```

### Dari Windows:
```powershell
.\build.ps1
```

Hasil build akan tersimpan di:
- `bin/linux/` - Binary untuk Linux (dsp-master, dsp-agent)
- `bin/windows/` - Executable untuk Windows (dsp-master.exe, dsp-agent.exe)

---

## 🐧 Deployment di Linux (Production Ready)

### Sistem Requirements
- Ubuntu 20.04+ / RHEL 8+ / Debian 11+
- PostgreSQL 12+
- Systemd
- Minimal 2GB RAM, 2 CPU cores

### Installation Steps

1. **Build binary** (jika belum):
```bash
./build.sh
```

2. **Install sebagai service**:
```bash
cd deployment/linux
sudo chmod +x install.sh
sudo ./install.sh
```

3. **Configure environment variables**:
```bash
sudo nano /etc/systemd/system/dsp-master.service
```

Edit bagian `Environment`:
```ini
Environment="DB_HOST=localhost"
Environment="DB_PORT=5432"
Environment="DB_NAME=dsp_platform"
Environment="DB_USER=dsp_user"
Environment="DB_PASSWORD=SecurePassword123!"
Environment="JWT_SECRET=YourSuperSecretJWTKey"
Environment="PORT=8080"
```

4. **Enable dan start service**:
```bash
# Master Server
sudo systemctl enable dsp-master
sudo systemctl start dsp-master

# Check status
sudo systemctl status dsp-master

# View logs
sudo journalctl -u dsp-master -f
```

### Service Management Commands

```bash
# Start
sudo systemctl start dsp-master

# Stop
sudo systemctl stop dsp-master

# Restart
sudo systemctl restart dsp-master

# Check status
sudo systemctl status dsp-master

# View logs (real-time)
sudo journalctl -u dsp-master -f

# View logs (last 100 lines)
sudo journalctl -u dsp-master -n 100
```

### Firewall Configuration

```bash
# Allow HTTP/HTTPS
sudo ufw allow 8080/tcp
sudo ufw allow 443/tcp

# For agent communication (port 447)
sudo ufw allow 447/tcp
```

---

## 🪟 Deployment di Windows (Production Ready)

### Sistem Requirements
- Windows Server 2016+ atau Windows 10/11
- PostgreSQL 12+ (atau SQL Server)
- NSSM (Non-Sucking Service Manager) - untuk service wrapper
- Minimal 2GB RAM, 2 CPU cores

### Installation Steps

#### Option 1: Menggunakan NSSM (Recommended)

1. **Download NSSM**:
   - Download dari: https://nssm.cc/download
   - Extract ke: `C:\Program Files\nssm\`

2. **Build binary**:
```powershell
.\build.ps1
```

3. **Install sebagai Windows Service**:
```powershell
# Run as Administrator
cd deployment\windows
.\install-service.ps1
```

4. **Set environment variables**:
   - Computer → Properties → Advanced System Settings → Environment Variables
   - Add system variables:
     - `DB_HOST=localhost`
     - `DB_PORT=5432`
     - `DB_NAME=dsp_platform`
     - `DB_USER=dsp_user`
     - `DB_PASSWORD=SecurePassword123!`
     - `JWT_SECRET=YourSuperSecretJWTKey`

5. **Start service**:
```powershell
Start-Service DSPMaster
```

#### Option 2: Manual Service Creation (tanpa NSSM)

```powershell
# Run as Administrator
$exePath = "C:\Program Files\DSP-Platform\dsp-master.exe"

sc.exe create DSPMaster binPath= $exePath start= auto
sc.exe description DSPMaster "DSP Platform Master Server for Data Synchronization"
sc.exe start DSPMaster
```

### Service Management Commands

```powershell
# Start
Start-Service DSPMaster

# Stop
Stop-Service DSPMaster

# Restart
Restart-Service DSPMaster

# Check status
Get-Service DSPMaster

# View logs
Get-Content "C:\Program Files\DSP-Platform\logs\master-output.log" -Tail 50 -Wait
```

### Firewall Configuration

```powershell
# Run as Administrator
New-NetFirewallRule -DisplayName "DSP Master HTTP" -Direction Inbound -LocalPort 8080 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "DSP Agent Listener" -Direction Inbound -LocalPort 447 -Protocol TCP -Action Allow
```

### Run as Scheduled Task (Alternative)

Jika tidak mau pakai Windows Service:

```powershell
# Create scheduled task to run at startup
$action = New-ScheduledTaskAction -Execute "C:\Program Files\DSP-Platform\dsp-master.exe"
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "DSP Master Server" -Action $action -Trigger $trigger -Principal $principal
```

---

## 🏢 Production Deployment Checklist

### Security
- [ ] Change default admin password
- [ ] Use strong JWT secret
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall rules
- [ ] Run service with dedicated user (not root/Administrator)
- [ ] Enable database encryption
- [ ] Set up backup strategy

### Monitoring
- [ ] Configure log rotation
- [ ] Set up monitoring dashboard
- [ ] Configure alerts for service failures
- [ ] Monitor disk space and memory usage

### High Availability (Optional)
- [ ] Deploy behind load balancer (nginx/HAProxy)
- [ ] Set up database replication
- [ ] Configure automatic failover
- [ ] Use container orchestration (Docker/Kubernetes)

---

## 🐳 Docker Deployment (Bonus)

Create `docker-compose.yml` for easy deployment:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: dsp_platform
      POSTGRES_USER: dsp_user
      POSTGRES_PASSWORD: SecurePassword123!
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  dsp-master:
    build: .
    ports:
      - "8080:8080"
      - "447:447"
    environment:
      DB_HOST: postgres
      DB_PORT: 5432
      DB_NAME: dsp_platform
      DB_USER: dsp_user
      DB_PASSWORD: SecurePassword123!
      JWT_SECRET: YourSuperSecretJWTKey
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
```

---

## 📊 Monitoring & Logs

### Linux
```bash
# Real-time logs
sudo journalctl -u dsp-master -f

# Today's logs
sudo journalctl -u dsp-master --since today

# Last hour
sudo journalctl -u dsp-master --since "1 hour ago"
```

### Windows
```powershell
# View service logs
Get-Content "C:\Program Files\DSP-Platform\logs\master-output.log" -Tail 100 -Wait

# Event Viewer
Get-EventLog -LogName Application -Source "DSP*" -Newest 50
```

---

## 🆘 Troubleshooting

### Service won't start
1. Check logs for error messages
2. Verify database connection
3. Check port conflicts (8080, 447)
4. Verify file permissions

### Can't connect to service
1. Check firewall rules
2. Verify service is running
3. Check network connectivity
4. Review application logs

---

## 📞 Support

Untuk deployment di lingkungan pemerintahan Indonesia:
- Dokumentasi lengkap: README.md
- Security guidelines: SECURITY.md
- Contact: support@dsp-platform.id
