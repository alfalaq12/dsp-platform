# Build script for DSP Platform - PowerShell version for Windows
# Run this on Windows: .\build.ps1

Write-Host "🔨 Building DSP Platform for multiple platforms..." -ForegroundColor Cyan

# Create build directories
New-Item -ItemType Directory -Force -Path "bin\linux" | Out-Null
New-Item -ItemType Directory -Force -Path "bin\windows" | Out-Null


# Build Frontend
Write-Host "🎨 Building Frontend..." -ForegroundColor Cyan
if (Get-Command npm -ErrorAction SilentlyContinue) {
    Push-Location frontend
    Write-Host "   Running npm install..." -ForegroundColor Gray
    npm install | Out-Null
    Write-Host "   Running npm run build..." -ForegroundColor Gray
    npm run build | Out-Null
    Pop-Location
    
    # Copy frontend assets
    Write-Host "   Copying frontend assets..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path "bin\linux\frontend" | Out-Null
    New-Item -ItemType Directory -Force -Path "bin\windows\frontend" | Out-Null
    
    Copy-Item -Recurse -Force -Path "frontend\dist" -Destination "bin\linux\frontend\"
    Copy-Item -Recurse -Force -Path "frontend\dist" -Destination "bin\windows\frontend\"
    Write-Host "✅ Frontend built and copied" -ForegroundColor Green
}
else {
    Write-Host "⚠️  npm not found. Skipping frontend build." -ForegroundColor Yellow
    Write-Host "   The Web Console UI will not be updated." -ForegroundColor Yellow
}

# Build Master Server
Write-Host "📦 Building Master Server..." -ForegroundColor Yellow

# Linux
$env:GOOS = "linux"
$env:GOARCH = "amd64"
go build -o bin/linux/dsp-master ./cmd/master
Write-Host "✅ Linux Master Server: bin/linux/dsp-master" -ForegroundColor Green

# Windows
$env:GOOS = "windows"
$env:GOARCH = "amd64"
go build -o bin/windows/dsp-master.exe ./cmd/master
Write-Host "✅ Windows Master Server: bin/windows/dsp-master.exe" -ForegroundColor Green

# Build Agent
Write-Host "📦 Building Tenant Agent..." -ForegroundColor Yellow

# Linux
$env:GOOS = "linux"
$env:GOARCH = "amd64"
Write-Host "   Target: Linux (amd64)" -ForegroundColor Gray
go build -v -o bin/linux/dsp-agent ./cmd/agent
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Linux Agent build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Linux Agent: bin/linux/dsp-agent" -ForegroundColor Green

# Windows
$env:GOOS = "windows"
$env:GOARCH = "amd64"
Write-Host "   Target: Windows (amd64)" -ForegroundColor Gray
go build -v -o bin/windows/dsp-agent.exe ./cmd/agent
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Windows Agent build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Windows Agent: bin/windows/dsp-agent.exe" -ForegroundColor Green

Write-Host ""
Write-Host "✨ Build complete! Binaries available in:" -ForegroundColor Cyan
Write-Host "   - Linux: ./bin/linux/" -ForegroundColor White
Write-Host "   - Windows: ./bin/windows/" -ForegroundColor White
Write-Host ""
Write-Host "📋 File sizes:" -ForegroundColor Cyan
Get-ChildItem -Path "bin\linux\", "bin\windows\" -File | Format-Table Name, Length, DirectoryName -AutoSize
