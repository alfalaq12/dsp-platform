# Windows Agent Installation Script for DSP Platform
# Run as Administrator: .\install-agent.ps1

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ Please run this script as Administrator" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Installing DSP Agent..." -ForegroundColor Cyan

# Configuration Prompts
$MasterHost = Read-Host "📡 Enter Master Server IP Address (linux server IP)"
if ([string]::IsNullOrWhiteSpace($MasterHost)) {
    Write-Host "❌ Master Host is required." -ForegroundColor Red
    exit 1
}

$AgentName = Read-Host "🤖 Enter Agent Name (e.g., windows-agent-1)"
if ([string]::IsNullOrWhiteSpace($AgentName)) {
    $AgentName = "windows-agent-1"
}

# Install directory
$InstallDir = "C:\Program Files\DSP-Agent"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\logs" | Out-Null

# Copy executable
Write-Host "📦 Copying dsp-agent.exe..." -ForegroundColor Yellow
$SourceBin = "..\..\bin\windows\dsp-agent.exe"

if (-not (Test-Path $SourceBin)) {
    Write-Host "❌ dsp-agent.exe not found at $SourceBin" -ForegroundColor Red
    Write-Host "   Please run '.\build.ps1' first." -ForegroundColor Gray
    exit 1
}

Copy-Item $SourceBin -Destination $InstallDir

# Create .env file
Write-Host "📝 Configuring .env file..." -ForegroundColor Yellow
$EnvContent = @"
MASTER_HOST=$MasterHost
MASTER_PORT=447
AGENT_NAME=$AgentName
SYNC_ENABLED=false
DB_DRIVER=postgres
DB_HOST=localhost
DB_PORT=5432
"@

$EnvContent | Out-File -FilePath "$InstallDir\.env" -Encoding UTF8

# Install NSSM (Non-Sucking Service Manager) for service wrapper
Write-Host "📦 Checking for NSSM..." -ForegroundColor Yellow
$nssmPath = "$env:ProgramFiles\nssm\nssm.exe"

if (-not (Test-Path $nssmPath)) {
    Write-Host "⚠️  NSSM not found. We will install service globally." -ForegroundColor Yellow
    Write-Host "   Please download NSSM from https://nssm.cc/download for better service management." -ForegroundColor White
    
    # Fallback using sc.exe
    $ServiceName = "DSPAgent"
    sc.exe stop $ServiceName
    sc.exe delete $ServiceName
    
    # Create service with environment variables passed via command line is tricky with sc.exe
    # So we rely on the .env file being in the AppDirectory (WorkingDirectory)
    
    # Note: sc.exe doesn't easily set working directory.
    # This is why NSSM is preferred.
    
    Write-Host "❌ NSSM is highly recommended for Agent installation to ensure configuration loading." -ForegroundColor Red
    Write-Host "   Please install NSSM to 'C:\Program Files\nssm\nssm.exe' and retry."
    exit 1
}

# Create Agent Service using NSSM
Write-Host "🔧 Creating DSP Agent service..." -ForegroundColor Yellow
& $nssmPath stop DSPAgent
& $nssmPath remove DSPAgent confirm
& $nssmPath install DSPAgent "$InstallDir\dsp-agent.exe"
& $nssmPath set DSPAgent DisplayName "DSP Platform Tenant Agent"
& $nssmPath set DSPAgent Description "Data Synchronization Platform - Agent ($AgentName)"
& $nssmPath set DSPAgent AppDirectory $InstallDir
& $nssmPath set DSPAgent Start SERVICE_AUTO_START
& $nssmPath set DSPAgent AppStdout "$InstallDir\logs\agent-output.log"
& $nssmPath set DSPAgent AppStderr "$InstallDir\logs\agent-error.log"

Write-Host "✅ DSP Agent service installed!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuration:" -ForegroundColor Cyan
Write-Host "   Master IP:  $MasterHost"
Write-Host "   Agent Name: $AgentName"
Write-Host "   Location:   $InstallDir"
Write-Host ""
Write-Host "🎯 To Start the Agent:" -ForegroundColor Yellow
Write-Host "   Start-Service DSPAgent" -ForegroundColor Cyan
