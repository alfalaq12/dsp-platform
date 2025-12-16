# DSP Platform - Build & Package Script for Windows
# Run this script to create deployment ZIPs for flashdisk deployment

Write-Host "🚀 DSP Platform Build & Package Script" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build Frontend
Write-Host "📦 Step 1: Building Frontend..." -ForegroundColor Yellow
Set-Location frontend
npm install
npm run build
Set-Location ..
Write-Host "✅ Frontend built" -ForegroundColor Green
Write-Host ""

# Step 2: Build Binaries
Write-Host "📦 Step 2: Building Binaries..." -ForegroundColor Yellow

# Linux Master
Write-Host "  → Building Linux Master..."
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -ldflags="-s -w" -o bin/linux/dsp-master ./cmd/master

# Linux Agent
Write-Host "  → Building Linux Agent..."
go build -ldflags="-s -w" -o bin/linux/dsp-agent ./cmd/agent

# Windows Master
Write-Host "  → Building Windows Master..."
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -ldflags="-s -w" -o bin/windows/dsp-master.exe ./cmd/master

# Windows Agent
Write-Host "  → Building Windows Agent..."
go build -ldflags="-s -w" -o bin/windows/dsp-agent.exe ./cmd/agent

# Reset GOOS
$env:GOOS = ""
$env:GOARCH = ""

Write-Host "✅ All binaries built" -ForegroundColor Green
Write-Host ""

# Step 3: Package
Write-Host "📦 Step 3: Packaging deployments..." -ForegroundColor Yellow

# Create directories
New-Item -ItemType Directory -Force -Path bin/linux/master/frontend/dist, bin/linux/master/certs, bin/linux/master/deployment/linux | Out-Null
New-Item -ItemType Directory -Force -Path bin/linux/agent/certs, bin/linux/agent/deployment/linux | Out-Null
New-Item -ItemType Directory -Force -Path bin/windows/master/frontend/dist, bin/windows/master/certs | Out-Null
New-Item -ItemType Directory -Force -Path bin/windows/agent/certs | Out-Null
New-Item -ItemType Directory -Force -Path dist | Out-Null

# Linux Master
Copy-Item bin/linux/dsp-master -Destination bin/linux/master/ -Force
Copy-Item -Recurse frontend/dist/* -Destination bin/linux/master/frontend/dist/ -Force
if (Test-Path certs) { Copy-Item certs/* -Destination bin/linux/master/certs/ -Force }
if (Test-Path .env.tls.example) { Copy-Item .env.tls.example -Destination bin/linux/master/.env.example -Force }
if (Test-Path deployment/linux/dsp-master.service) { Copy-Item deployment/linux/dsp-master.service -Destination bin/linux/master/deployment/linux/ -Force }
if (Test-Path deployment/linux/install-master.sh) { Copy-Item deployment/linux/install-master.sh -Destination bin/linux/master/deployment/linux/ -Force }

# Linux Agent
Copy-Item bin/linux/dsp-agent -Destination bin/linux/agent/ -Force
if (Test-Path certs/ca.crt) { Copy-Item certs/ca.crt -Destination bin/linux/agent/certs/ -Force }
if (Test-Path .env.tls.example) { Copy-Item .env.tls.example -Destination bin/linux/agent/.env.example -Force }
if (Test-Path deployment/linux/dsp-agent.service) { Copy-Item deployment/linux/dsp-agent.service -Destination bin/linux/agent/deployment/linux/ -Force }
if (Test-Path deployment/linux/install-agent.sh) { Copy-Item deployment/linux/install-agent.sh -Destination bin/linux/agent/deployment/linux/ -Force }

# Windows Master
Copy-Item bin/windows/dsp-master.exe -Destination bin/windows/master/ -Force
Copy-Item -Recurse frontend/dist/* -Destination bin/windows/master/frontend/dist/ -Force
if (Test-Path certs) { Copy-Item certs/* -Destination bin/windows/master/certs/ -Force }
if (Test-Path .env.tls.example) { Copy-Item .env.tls.example -Destination bin/windows/master/.env.example -Force }

# Windows Agent
Copy-Item bin/windows/dsp-agent.exe -Destination bin/windows/agent/ -Force
if (Test-Path certs/ca.crt) { Copy-Item certs/ca.crt -Destination bin/windows/agent/certs/ -Force }
if (Test-Path .env.tls.example) { Copy-Item .env.tls.example -Destination bin/windows/agent/.env.example -Force }

Write-Host "✅ All packages prepared" -ForegroundColor Green
Write-Host ""

# Step 4: Create ZIPs
Write-Host "📦 Step 4: Creating ZIP files..." -ForegroundColor Yellow

Compress-Archive -Path bin/linux/master/* -DestinationPath dist/dsp-master-linux-amd64.zip -Force
Write-Host "  ✅ dist/dsp-master-linux-amd64.zip" -ForegroundColor Green

Compress-Archive -Path bin/linux/agent/* -DestinationPath dist/dsp-agent-linux-amd64.zip -Force
Write-Host "  ✅ dist/dsp-agent-linux-amd64.zip" -ForegroundColor Green

Compress-Archive -Path bin/windows/master/* -DestinationPath dist/dsp-master-windows-amd64.zip -Force
Write-Host "  ✅ dist/dsp-master-windows-amd64.zip" -ForegroundColor Green

Compress-Archive -Path bin/windows/agent/* -DestinationPath dist/dsp-agent-windows-amd64.zip -Force
Write-Host "  ✅ dist/dsp-agent-windows-amd64.zip" -ForegroundColor Green

Write-Host ""
Write-Host "✅ ========================================" -ForegroundColor Green
Write-Host "✅  ZIP PACKAGES READY FOR DEPLOYMENT!" -ForegroundColor Green
Write-Host "✅ ========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Files in dist/:" -ForegroundColor Cyan
Get-ChildItem dist/*.zip | Format-Table Name, @{Name = "Size"; Expression = { "{0:N2} MB" -f ($_.Length / 1MB) } }
Write-Host ""
Write-Host "💾 Copy dist/ folder to flashdisk for tenant deployment" -ForegroundColor Yellow
