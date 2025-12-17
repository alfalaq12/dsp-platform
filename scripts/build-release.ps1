# DSP Platform Release Build Script
# Generates binaries for Windows, Linux (x64 & ARM64)

param(
    [string]$Version = "1.0.0",
    [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"

# Configuration
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$OutputDir = "$ProjectRoot\releases\v$Version"
$FrontendDir = "$ProjectRoot\frontend"
$MasterCmd = "$ProjectRoot\cmd\master"
$AgentCmd = "$ProjectRoot\cmd\agent"

# Platforms to build
$Platforms = @(
    @{GOOS = "windows"; GOARCH = "amd64"; Ext = ".exe"; Name = "windows-amd64" },
    @{GOOS = "linux"; GOARCH = "amd64"; Ext = ""; Name = "linux-amd64" },
    @{GOOS = "linux"; GOARCH = "arm64"; Ext = ""; Name = "linux-arm64" }
)

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DSP Platform Release Builder v$Version" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Create output directory
if (Test-Path $OutputDir) {
    Remove-Item -Recurse -Force $OutputDir
}
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

# Step 1: Build Frontend
if (-not $SkipFrontend) {
    Write-Host "[1/4] Building Frontend..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    try {
        npm install --silent
        npm run build
        Write-Host "  ✓ Frontend built successfully" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "[1/4] Skipping Frontend build" -ForegroundColor DarkGray
}

# Step 2: Build Master binaries
Write-Host "[2/4] Building Master Server binaries..." -ForegroundColor Yellow
foreach ($platform in $Platforms) {
    $env:GOOS = $platform.GOOS
    $env:GOARCH = $platform.GOARCH
    $env:CGO_ENABLED = "0"
    
    $outputName = "dsp-master-$($platform.Name)$($platform.Ext)"
    $outputPath = "$OutputDir\master\$outputName"
    
    Write-Host "  Building $outputName..."
    
    go build -ldflags="-s -w -X main.Version=$Version" -o $outputPath $MasterCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓ $outputName" -ForegroundColor Green
    }
    else {
        Write-Host "    ✗ Failed to build $outputName" -ForegroundColor Red
        exit 1
    }
}

# Step 3: Build Agent binaries
Write-Host "[3/4] Building Agent binaries..." -ForegroundColor Yellow
foreach ($platform in $Platforms) {
    $env:GOOS = $platform.GOOS
    $env:GOARCH = $platform.GOARCH
    $env:CGO_ENABLED = "0"
    
    $outputName = "dsp-agent-$($platform.Name)$($platform.Ext)"
    $outputPath = "$OutputDir\agent\$outputName"
    
    Write-Host "  Building $outputName..."
    
    go build -ldflags="-s -w -X main.Version=$Version" -o $outputPath $AgentCmd
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "    ✓ $outputName" -ForegroundColor Green
    }
    else {
        Write-Host "    ✗ Failed to build $outputName" -ForegroundColor Red
        exit 1
    }
}

# Reset environment
Remove-Item Env:GOOS -ErrorAction SilentlyContinue
Remove-Item Env:GOARCH -ErrorAction SilentlyContinue
Remove-Item Env:CGO_ENABLED -ErrorAction SilentlyContinue

# Step 4: Copy supporting files
Write-Host "[4/4] Copying supporting files..." -ForegroundColor Yellow

# Copy frontend dist to master folder
if (Test-Path "$FrontendDir\dist") {
    Copy-Item -Recurse "$FrontendDir\dist" "$OutputDir\master\frontend"
    Write-Host "  ✓ Frontend dist copied" -ForegroundColor Green
}

# Create .env templates
$MasterEnv = @"
# DSP Master Server Configuration
# ================================

# Server Ports
PORT=8080
TCP_PORT=8447

# Security (CHANGE THIS!)
JWT_SECRET=change-this-to-a-secure-random-string

# TLS/SSL (optional, for production)
TLS_ENABLED=false
TLS_CERT_PATH=./certs/server.crt
TLS_KEY_PATH=./certs/server.key

# Note: Database settings are configured via Web Console -> Settings
"@

$AgentEnv = @"
# DSP Agent Configuration
# =======================

# Master Server Connection (REQUIRED)
MASTER_HOST=your-master-server-ip
MASTER_PORT=8447

# Agent Identity (from Master Dashboard -> Agent Tokens)
AGENT_NAME=tenant-name
AGENT_TOKEN=paste-token-from-dashboard

# TLS/SSL (match Master TLS settings)
TLS_ENABLED=false
TLS_SKIP_VERIFY=false
TLS_CA_PATH=./certs/ca.crt

# Note: Database settings are pushed from Master (Network config)
"@

Set-Content -Path "$OutputDir\master\.env.example" -Value $MasterEnv
Set-Content -Path "$OutputDir\agent\.env.example" -Value $AgentEnv
Write-Host "  ✓ .env templates created" -ForegroundColor Green

# Create install scripts
$MasterInstallBat = @"
@echo off
echo ====================================
echo   DSP Master Server Installer
echo ====================================
echo.

REM Copy binary
copy dsp-master-windows-amd64.exe dsp-master.exe

REM Copy config if not exists
if not exist .env (
    copy .env.example .env
    echo Created .env from template. Please edit before running!
) else (
    echo .env already exists, skipping...
)

echo.
echo Installation complete!
echo.
echo Next steps:
echo   1. Edit .env with your database settings
echo   2. Run: dsp-master.exe
echo.
pause
"@

$AgentInstallBat = @"
@echo off
echo ====================================
echo   DSP Agent Installer
echo ====================================
echo.

REM Copy binary
copy dsp-agent-windows-amd64.exe dsp-agent.exe

REM Copy config if not exists
if not exist .env (
    copy .env.example .env
    echo Created .env from template. Please edit before running!
) else (
    echo .env already exists, skipping...
)

echo.
echo Installation complete!
echo.
echo Next steps:
echo   1. Edit .env with Master server address and token
echo   2. Run: dsp-agent.exe
echo   3. Or install as service: dsp-agent.exe -install
echo.
pause
"@

$MasterInstallSh = @"
#!/bin/bash
echo "===================================="
echo "  DSP Master Server Installer"
echo "===================================="
echo

# Detect architecture
ARCH=`$(uname -m)
case `$ARCH in
    x86_64) BINARY="dsp-master-linux-amd64" ;;
    aarch64) BINARY="dsp-master-linux-arm64" ;;
    *) echo "Unsupported architecture: `$ARCH"; exit 1 ;;
esac

# Copy binary
cp `$BINARY dsp-master
chmod +x dsp-master

# Copy config
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from template. Please edit before running!"
fi

echo
echo "Installation complete!"
echo
echo "Next steps:"
echo "  1. Edit .env with your database settings"
echo "  2. Run: ./dsp-master"
echo "  3. Or create systemd service for production"
"@

$AgentInstallSh = @"
#!/bin/bash
echo "===================================="
echo "  DSP Agent Installer"
echo "===================================="
echo

# Detect architecture
ARCH=`$(uname -m)
case `$ARCH in
    x86_64) BINARY="dsp-agent-linux-amd64" ;;
    aarch64) BINARY="dsp-agent-linux-arm64" ;;
    *) echo "Unsupported architecture: `$ARCH"; exit 1 ;;
esac

# Copy binary
cp `$BINARY dsp-agent
chmod +x dsp-agent

# Copy config
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from template. Please edit before running!"
fi

echo
echo "Installation complete!"
echo
echo "Next steps:"
echo "  1. Edit .env with Master server address"
echo "  2. Run: ./dsp-agent"
echo "  3. Or create systemd service for production"
"@

Set-Content -Path "$OutputDir\master\install.bat" -Value $MasterInstallBat
Set-Content -Path "$OutputDir\agent\install.bat" -Value $AgentInstallBat
Set-Content -Path "$OutputDir\master\install.sh" -Value $MasterInstallSh -NoNewline
Set-Content -Path "$OutputDir\agent\install.sh" -Value $AgentInstallSh -NoNewline
Write-Host "  ✓ Install scripts created" -ForegroundColor Green

# Create VERSION file
Set-Content -Path "$OutputDir\VERSION.txt" -Value "DSP Platform v$Version`nBuild Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  ✓ VERSION.txt created" -ForegroundColor Green

# Create ZIP packages
Write-Host ""
Write-Host "Creating ZIP packages..." -ForegroundColor Yellow

Compress-Archive -Path "$OutputDir\master\*" -DestinationPath "$OutputDir\dsp-master-v$Version.zip" -Force
Compress-Archive -Path "$OutputDir\agent\*" -DestinationPath "$OutputDir\dsp-agent-v$Version.zip" -Force
Write-Host "  ✓ dsp-master-v$Version.zip" -ForegroundColor Green
Write-Host "  ✓ dsp-agent-v$Version.zip" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Output directory: $OutputDir"
Write-Host ""
Write-Host "Files created:"
Get-ChildItem -Recurse $OutputDir | Where-Object { -not $_.PSIsContainer } | ForEach-Object {
    $relativePath = $_.FullName.Replace("$OutputDir\", "")
    $size = "{0:N2} MB" -f ($_.Length / 1MB)
    Write-Host "  $relativePath ($size)"
}
Write-Host ""
