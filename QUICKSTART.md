# DSP Platform - Quick Start Guide

Panduan cepat untuk menjalankan DSP Platform.

## 🎯 Prerequisites

- **Go 1.21+** (untuk build dari source)
- **Node.js 18+** (untuk build frontend)
- **Target Database** (PostgreSQL/MySQL/Oracle untuk menyimpan hasil sync)

## ⚡ 5-Minute Setup

### 1. Build atau Download Binary

```bash
# Clone repo
git clone https://github.com/YOUR-REPO/dsp-platform.git
cd dsp-platform

# Build (Windows)
.\scripts\build-release.ps1 -Version "1.0.0"

# Build (Linux/Mac)
chmod +x scripts/build-release.sh
./scripts/build-release.sh 1.0.0
```

Hasil build ada di `releases/v1.0.0/`

### 2. Setup Master Server

```bash
cd releases/v1.0.0
unzip dsp-master-v1.0.0.zip -d master
cd master

# Jalankan installer
./install.sh      # Linux
install.bat       # Windows

# Edit .env
nano .env
# Ubah JWT_SECRET ke random string yang aman!

# Jalankan
./dsp-master      # Linux
dsp-master.exe    # Windows
```

Akses: **http://localhost:8080**

### 3. Login & Setup Target Database

1. Login dengan `admin` / `admin`
2. **Ubah password** (wajib pada login pertama)
3. Ke **Settings** → Configure Target Database
4. Test koneksi

### 4. Generate Agent Token

1. Ke menu **Agent Tokens**
2. Klik **Generate Token**
3. Isi nama agent (contoh: `kantor-cabang-a`)
4. Copy token yang muncul

### 5. Setup Agent di Server Tenant

```bash
# Di server tenant
unzip dsp-agent-v1.0.0.zip -d agent
cd agent
./install.sh

# Edit .env
nano .env
```

Isi `.env`:
```bash
MASTER_HOST=192.168.1.100    # IP Master Server
MASTER_PORT=8447
AGENT_NAME=kantor-cabang-a
AGENT_TOKEN=eyJhbGciOiJIUzI1NiIs...  # Token dari dashboard
```

Jalankan:
```bash
./dsp-agent
```

### 6. Create Sync Job

1. Kembali ke Master Dashboard
2. **Network** → Add source database/FTP/API
3. **Schema** → Define SQL query dan target table
4. **Jobs** → Create job dengan schedule

## ✅ Verification Checklist

- [ ] Master server running di port 8080
- [ ] Agent connected (cek Dashboard)
- [ ] Target database connected (Settings → Test)
- [ ] Network source configured
- [ ] Schema created
- [ ] Job created dan bisa di-run manual

## 🔧 Common Commands

```bash
# Check agent connection status
curl http://localhost:8080/api/agents/connected

# Run job manually (dari Terminal Console)
# Login → Terminal → pilih agent → ketik command

# View logs
tail -f logs/dsp-master.log
```

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Agent tidak connect | Cek firewall port 8447, cek MASTER_HOST |
| Login gagal | Pastikan cookies enabled, cek JWT_SECRET |
| Sync failed | Cek Network source credentials |
| Target DB error | Pastikan target table otomatis dibuat |

## 📚 Next Steps

- [README.md](README.md) - Dokumentasi lengkap
- Konfigurasi TLS untuk production
- Setup sebagai Systemd/Windows Service

---

**Butuh bantuan?** bintangal.falag@gmail.com