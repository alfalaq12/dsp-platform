# TLS Setup Guide - Linux Deployment

Panduan lengkap untuk setup TLS encryption pada DSP Platform di Linux.

---

## 🖥️ MASTER SERVER (Linux)

### Step 1: Login ke Server Master
```bash
ssh root@202.10.42.65
cd /opt/dsp-platform
```

### Step 2: Pastikan binary sudah ter-update
```bash
ls -la
# Harus ada: dsp-master, frontend/, dsp.db
```

### Step 3: Generate Certificates dengan OpenSSL
```bash
# Buat folder certs
mkdir -p /opt/dsp-platform/certs
cd /opt/dsp-platform/certs

# Generate CA Key
openssl ecparam -genkey -name prime256v1 -out ca.key

# Generate CA Certificate
openssl req -x509 -new -nodes -key ca.key -sha256 -days 3650 \
  -out ca.crt -subj "/C=ID/O=DSP Platform/CN=DSP Platform CA"

# Generate Server Key
openssl ecparam -genkey -name prime256v1 -out server.key

# Generate Server CSR
openssl req -new -key server.key -out server.csr \
  -subj "/C=ID/O=DSP Platform/CN=DSP Platform Server"

# Create config for SAN (Subject Alternative Names)
cat > san.cnf << 'EOF'
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req

[req_distinguished_name]

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = 202.10.42.65
EOF

# Generate Server Certificate (signed by CA)
openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out server.crt -days 365 -sha256 \
  -extfile san.cnf -extensions v3_req

# Cleanup
rm server.csr san.cnf ca.srl

# Set permissions
chmod 600 *.key
chmod 644 *.crt

# Verify files
ls -la
# Harus ada: ca.crt, ca.key, server.crt, server.key
```

### Step 4: Buat file .env
```bash
cd /opt/dsp-platform

cat > .env << 'EOF'
# TLS Configuration
TLS_ENABLED=true
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key
EOF

# Verify
cat .env
```

### Step 5: Restart Master Service
```bash
sudo systemctl restart dsp-master
```

### Step 6: Cek Log
```bash
sudo journalctl -u dsp-master -n 50 --no-pager
```

**Expected output:**
```
Starting DSP Platform Master Server
tls_enabled=true
🔒 Starting HTTPS server
🔒 Agent TLS listener started on port 447
```

### Step 7: Test HTTPS
```bash
# Dari server itu sendiri
curl -k https://localhost:441/health

# Harusnya response: {"status":"ok"}
```

### Step 8: Copy CA Certificate untuk Agent
```bash
# Copy ca.crt ke semua server agent
scp /opt/dsp-platform/certs/ca.crt root@AGENT_SERVER_IP:/opt/dsp-agent/certs/
```

---

## 📱 AGENT SERVER (Linux)

### Step 1: Login ke Server Agent
```bash
ssh root@AGENT_SERVER_IP
cd /opt/dsp-agent
```

### Step 2: Buat folder certs dan copy CA
```bash
mkdir -p /opt/dsp-agent/certs

# Jika CA sudah di-copy dari master, verify:
ls -la /opt/dsp-agent/certs/
# Harus ada: ca.crt

# Jika belum, copy manual dari master:
# scp root@202.10.42.65:/opt/dsp-platform/certs/ca.crt /opt/dsp-agent/certs/
```

### Step 3: Buat/Update file .env
```bash
cat > /opt/dsp-agent/.env << 'EOF'
# Master Server
MASTER_HOST=202.10.42.65
MASTER_PORT=447

# Agent Identity
AGENT_NAME=tenant-1

# TLS Configuration
TLS_ENABLED=true
TLS_CA_PATH=./certs/ca.crt
TLS_SKIP_VERIFY=false
EOF

# Verify
cat .env
```

### Step 4: Restart Agent Service
```bash
sudo systemctl restart dsp-agent
```

### Step 5: Cek Log
```bash
sudo journalctl -u dsp-agent -n 50 --no-pager
```

**Expected output:**
```
🔒 Connecting to Master server with TLS
Loaded CA certificate for verification
🔒 Successfully connected to Master server via TLS
```

---

## 🔍 TROUBLESHOOTING

### Problem: HTTPS tidak bisa diakses
```bash
# Cek service running
sudo systemctl status dsp-master

# Cek port listening
sudo netstat -tlnp | grep 441

# Cek log error
sudo journalctl -u dsp-master -n 100 | grep -i error
```

### Problem: Certificate error
```bash
# Verify certificate valid
openssl x509 -in /opt/dsp-platform/certs/server.crt -text -noout

# Check certificate has correct IP in SAN
openssl x509 -in /opt/dsp-platform/certs/server.crt -text -noout | grep -A1 "Subject Alternative Name"
```

### Problem: Agent tidak bisa connect
```bash
# Test TLS connection dari agent ke master
openssl s_client -connect 202.10.42.65:447 -CAfile /opt/dsp-agent/certs/ca.crt

# Cek agent log
sudo journalctl -u dsp-agent -n 50
```

### Problem: "certificate signed by unknown authority"
Agent tidak punya CA certificate yang benar. Pastikan:
1. `ca.crt` sudah di-copy ke agent
2. Path di `.env` sudah benar: `TLS_CA_PATH=./certs/ca.crt`

---

## ✅ VERIFICATION CHECKLIST

### Master Server
- [ ] File `/opt/dsp-platform/certs/server.crt` exists
- [ ] File `/opt/dsp-platform/certs/server.key` exists  
- [ ] File `/opt/dsp-platform/.env` contains `TLS_ENABLED=true`
- [ ] `curl -k https://localhost:441/health` returns `{"status":"ok"}`
- [ ] Log shows "🔒 Starting HTTPS server"

### Agent Server
- [ ] File `/opt/dsp-agent/certs/ca.crt` exists (copied from master)
- [ ] File `/opt/dsp-agent/.env` contains `TLS_ENABLED=true`
- [ ] Log shows "🔒 Successfully connected to Master server via TLS"
