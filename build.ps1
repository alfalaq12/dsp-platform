# Build script for DSP Platform - PowerShell version for Windows
# Run this on Windows: .\build.ps1

Write-Host "🔨 Building DSP Platform for multiple platforms..." -ForegroundColor Cyan

# Create build directories
New-Item -ItemType Directory -Force -Path "bin\linux" | Out-Null
New-Item -ItemType Directory -Force -Path "bin\windows" | Out-Null

# Build Master Server
Write-Host "📦 Building Master Server..." -ForegroundColor Yellow

# Linux
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -o bin/linux/dsp-master cmd/master/main.go
Write-Host "✅ Linux Master Server: bin/linux/dsp-master" -ForegroundColor Green

# Windows
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -o bin/windows/dsp-master.exe cmd/master/main.go
Write-Host "✅ Windows Master Server: bin/windows/dsp-master.exe" -ForegroundColor Green

# Build Agent
Write-Host "📦 Building Tenant Agent..." -ForegroundColor Yellow

# Linux
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -o bin/linux/dsp-agent cmd/agent/main.go
Write-Host "✅ Linux Agent: bin/linux/dsp-agent" -ForegroundColor Green

# Windows
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -o bin/windows/dsp-agent.exe cmd/agent/main.go
Write-Host "✅ Windows Agent: bin/windows/dsp-agent.exe" -ForegroundColor Green

Write-Host ""
Write-Host "✨ Build complete! Binaries available in:" -ForegroundColor Cyan
Write-Host "   - Linux: ./bin/linux/" -ForegroundColor White
Write-Host "   - Windows: ./bin/windows/" -ForegroundColor White
Write-Host ""
Write-Host "📋 File sizes:" -ForegroundColor Cyan
Get-ChildItem -Path "bin\linux\", "bin\windows\" -File | Format-Table Name, Length, DirectoryName -AutoSize
