# DSP Platform - Deployment Guide

Panduan lengkap untuk deploy DSP Platform di Linux dan Windows untuk keperluan enterprise/pemerintahan.

## Arsitektur Deployment

DSP Platform menggunakan **Single Binary + Embedded SQLite**.
-   Tidak perlu install PostgreSQL/MySQL server untuk Master.
-   Database disimpan di file `dsp.db` di folder yang sama dengan binary.
-   **CRITICAL**: File `dsp.db` harus di-backup secara berkala.

## 📦 Build Binaries

### Dari Linux/macOS:
```bash
chmod +x build.sh
./build.sh
```

### Dari Windows:
```powershell
.\build.ps1
```

Hasil build:
- `bin/linux/` (dsp-master, dsp-agent)
- `bin/windows/` (dsp-master.exe, dsp-agent.exe)

---

## 🐧 Deployment di Linux

### Sistem Requirements
- Ubuntu 20.04+ / RHEL 8+
- Systemd
- Minimal 1GB RAM

### Installation Steps

1. **Build binary**:
   ```bash
   ./build.sh
   ```

2. **Install sebagai service**:
   ```bash
   cd deployment/linux
   sudo chmod +x install.sh
   sudo ./install.sh
   ```

3. **Configure Environment** (Optional):
   File config: `/etc/systemd/system/dsp-master.service`
   
   Hanya perlu set `JWT_SECRET`:
   ```ini
   Environment="JWT_SECRET=GantiDenganRahasiaSuperKuat123!"
   ```
   *Note: Database otomatis tersimpan di `/opt/dsp-platform/dsp.db` (atau folder install)*

4. **Start Service**:
   ```bash
   sudo systemctl enable dsp-master
   sudo systemctl start dsp-master
   ```

### 🛡️ Backup Strategy (PENTING)
Buat cron job untuk backup database setiap hari:

```bash
# Crontab entry
0 2 * * * cp /opt/dsp-platform/dsp.db /backup/dsp-platform/dsp_$(date +\%Y\%m\%d).db
```

---

## 🪟 Deployment di Windows

### Installation Steps

1. **Build**:
   ```powershell
   .\build.ps1
   ```

2. **Install Service (via NSSM)**:
   ```powershell
   # Run as Admin
   cd deployment\windows
   .\install-service.ps1
   ```

3. **Set Environment Variable**:
   - Set `JWT_SECRET` via System Environments jika ingin custom secret key.

4. **Start**:
   ```powershell
   Start-Service DSPMaster
   ```

### 🛡️ Backup Strategy
Gunakan Task Scheduler atau Script simpel untuk copy `dsp.db` ke server backup.

---

## 🐳 Docker Deployment

Gunakan `docker-compose.yml` sederhana ini.
**PENTING**: Mount volume untuk `dsp.db` agar data tidak hilang saat restart container.

```yaml
version: '3.8'

services:
  dsp-master:
    build: .
    ports:
      - "441:441"
      - "447:447"
    environment:
      - JWT_SECRET=RahasiaKuat123!
    volumes:
      - ./data:/app/data  # Persist dsp.db
    restart: unless-stopped
```

## 🔒 Security Checklist

- [ ] **Ganti Password Admin**: Login pertama kali dengan default `admin` / `admin`, lalu ganti password.
- [ ] **Firewall**: Buka port 441 (Web/API) dan 447 (Agent).
- [ ] **HTTPS**: Gunakan Nginx/Caddy sebagai Reverse Proxy untuk handle SSL/HTTPS di depan port 441.
