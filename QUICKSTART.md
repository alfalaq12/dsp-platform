# Quick Start Guide - DSP Platform

Panduan cepat untuk mencoba DSP Platform (Master + Agent) dalam 5 menit.

## 🎯 Setup Sederhana

Karena Master Server sudah **embedded database (SQLite)**, kamu **TIDAK PERLU** install Postgres/MySQL untuk server Master. Tinggal download & run!

```
┌─────────────────────────────────┐
│     Server / Laptop Master      │
│   ┌─────────────────────────┐   │
│   │    DSP Master Binary    │   │
│   │   (Termasuk Web GUI)    │◄──┼─── Buka Browser: http://localhost:441
│   └────────────┬────────────┘   │
└────────────────┼────────────────┘
                 │ TCP :447
┌────────────────▼────────────────┐
│      Laptop / Cabang Agent      │
│   ┌─────────────────────────┐   │
│   │    DSP Agent Binary     │   │
│   └─────────────────────────┘   │
└─────────────────────────────────┘
```

---

## 🚀 Langkah 1: Build Aplikasi

### Windows
```powershell
# Clone repo
git clone https://github.com/alfalaq12/dsp-platform.git
cd dsp-platform

# Build (Master & Agent)
.\build.ps1
```

### Linux
```bash
./build.sh
```

---

## 🖥️ Langkah 2: Jalankan Master Server

Jalankan file hasil build:

### Windows
```powershell
.\bin\windows\dsp-master.exe
```

### Linux
```bash
./bin/linux/dsp-master
```

Tunggu sampai muncul log:
`Starting HTTP server port=441`

Buka browser: **http://localhost:441**
Login: `admin` / `admin`

---

## 🤖 Langkah 3: Jalankan Agent (Optional)

Kalau mau coba simulasi Agent connect ke Master di komputer yang sama.

1. Buka terminal baru.
2. Edit config agent (jika perlu) di `cmd/agent/main.go`, tapi defaultnya `localhost:447` jadi harusnya langsung jalan.
3. Jalankan Agent:

### Windows
```powershell
.\bin\windows\dsp-agent.exe
```

Di Dashboard Master, masuk menu **Networks**, kamu bakal lihat agent baru muncul dengan status **Online**.

---

## 🎉 Selesai!

Sekarang kamu bisa:
1. Bikin **Schema** (Query SQL).
2. Bikin **Job** sync data.
3. Assign Job ke Agent.

Untuk panduan production deployment (Service, Background Process, Backup), baca [DEPLOYMENT.md](deployment/DEPLOYMENT.md).
