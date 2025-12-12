# DSP Platform - Deployment Guide

Panduan lengkap untuk deploy DSP Platform di Linux dan Windows untuk keperluan enterprise/pemerintahan.

## Arsitektur Deployment

DSP Platform menggunakan **Single Binary + Embedded SQLite**.
-   Tidak perlu install PostgreSQL/MySQL server untuk Master.
-   Database disimpan di file `dsp.db` di folder yang sama dengan binary.
-   **CRITICAL**: File `dsp.db` harus di-backup secara berkala.

---

## 📦 Build Binaries

### Dari Linux/macOS:
```bash
make build
# atau
chmod +x build.sh && ./build.sh
```

### Dari Windows:
```powershell
.\build.ps1
```

Hasil build:
- `bin/linux/` (dsp-master, dsp-agent)
- `bin/windows/` (dsp-master.exe, dsp-agent.exe)

---

## 🐧 Linux Deployment

### Master Server

#### First Installation
```bash
# 1. Build
make build-linux

# 2. Install
make install-master-linux
# atau manual:
cd deployment/linux && sudo ./install-master.sh

# 3. Configure (optional)
sudo nano /etc/systemd/system/dsp-master.service
# Set: Environment="JWT_SECRET=GantiDenganRahasiaSuperKuat123!"

# 4. Start
sudo systemctl enable dsp-master
sudo systemctl start dsp-master
```

#### Quick Update (after git pull)
```bash
git pull
make update-master-linux
```

---

### Agent (Linux)

#### First Installation
```bash
# 1. (Jika ada source code) Build binary
make build-linux

# 2. Copy binary ke Agent machine
scp bin/linux/dsp-agent user@agent-server:/tmp/

# 3. Di Agent machine, install
cd /tmp
sudo ./install-agent.sh
# Atau jika punya source code:
make install-agent-linux

# 4. Configure
sudo nano /opt/dsp-agent/.env
# Set Master IP, DB connection, etc.

# 5. Start
sudo systemctl enable dsp-agent
sudo systemctl start dsp-agent
```

#### Quick Update (after git pull)
```bash
git pull
make update-agent-linux

# Atau manual:
go build -o dsp-agent ./cmd/agent
sudo cp dsp-agent /opt/dsp-agent/
sudo systemctl restart dsp-agent
```

---

## 🪟 Windows Deployment

### Agent (Windows)

#### First Installation
```powershell
# Run as Administrator
cd deployment\windows

# Interactive install (akan prompt Master IP, Agent Name)
.\install-agent.ps1
```

#### Quick Update
```powershell
# Run as Administrator
cd deployment\windows

# Quick update - no prompts, just copy binary and restart
.\install-agent.ps1 -Update
```

### Master (Windows)
```powershell
cd deployment\windows
.\install-service.ps1
Start-Service DSPMaster
```

---

## 🛡️ Backup Strategy (PENTING)

### Linux Cron Job
```bash
# Crontab entry - backup setiap jam 2 malam
0 2 * * * cp /opt/dsp-platform/dsp.db /backup/dsp-platform/dsp_$(date +\%Y\%m\%d).db
```

### Windows Task Scheduler
Gunakan Task Scheduler untuk copy `dsp.db` ke lokasi backup.

---

## 📋 Makefile Commands Reference

| Command | Description |
|---------|-------------|
| `make build` | Build all (Linux + Windows + Frontend) |
| `make build-linux` | Build Linux binaries only |
| `make install-master-linux` | Install Master sebagai systemd service |
| `make install-agent-linux` | Install Agent sebagai systemd service |
| `make update-master-linux` | Quick update: build + copy + restart Master |
| `make update-agent-linux` | Quick update: build + copy + restart Agent |
| `make help` | Show all available commands |

---

## 🔒 Security Checklist

- [ ] **Ganti Password Admin**: Login pertama kali dengan default `admin` / `admin`, lalu ganti password.
- [ ] **Firewall**: Buka port 441 (Web/API) dan 447 (Agent).
- [ ] **HTTPS**: Gunakan Nginx/Caddy sebagai Reverse Proxy untuk handle SSL/HTTPS di depan port 441.
- [ ] **JWT Secret**: Set environment variable `JWT_SECRET` dengan nilai yang kuat.

