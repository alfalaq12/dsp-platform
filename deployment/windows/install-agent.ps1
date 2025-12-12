# Windows Agent Installation Script for DSP Platform
# Full install:    .\install-agent.ps1
# Quick update:    .\install-agent.ps1 -Update
# Run as Administrator

param(
    [switch]$Update  # Quick update mode - just copy binary and restart service
)

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "[-] Please run this script as Administrator" -ForegroundColor Red
    exit 1
}

$InstallDir = "C:\Program Files\DSP-Agent"

# Quick Update Mode
if ($Update) {
    Write-Host "[+] Quick Update Mode - Updating DSP Agent..." -ForegroundColor Cyan
    
    $SourceBin = "..\..\bin\windows\dsp-agent.exe"
    if (-not (Test-Path $SourceBin)) {
        # Try building first
        Write-Host "[*] Binary not found, attempting to build..." -ForegroundColor Yellow
        Push-Location "..\..\"
        go build -o bin\windows\dsp-agent.exe .\cmd\agent
        Pop-Location
    }
    
    if (Test-Path $SourceBin) {
        Write-Host "[*] Stopping service..." -ForegroundColor Yellow
        Stop-Service -Name DSPAgent -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        
        Write-Host "[*] Copying new binary..." -ForegroundColor Yellow
        Copy-Item $SourceBin -Destination $InstallDir -Force
        
        Write-Host "[*] Starting service..." -ForegroundColor Yellow
        Start-Service -Name DSPAgent
        
        Write-Host "[+] Update complete!" -ForegroundColor Green
        Get-Service DSPAgent | Format-Table Status, Name, DisplayName
    }
    else {
        Write-Host "[-] Failed to build/find dsp-agent.exe" -ForegroundColor Red
        exit 1
    }
    exit 0
}

# Full Installation Mode
Write-Host "[+] Installing DSP Agent..." -ForegroundColor Cyan

# Configuration Prompts
$MasterHost = Read-Host "[?] Enter Master Server IP Address (linux server IP)"
if ([string]::IsNullOrWhiteSpace($MasterHost)) {
    Write-Host "[-] Master Host is required." -ForegroundColor Red
    exit 1
}

$AgentName = Read-Host "[?] Enter Agent Name (e.g., windows-agent-1)"
if ([string]::IsNullOrWhiteSpace($AgentName)) {
    $AgentName = "windows-agent-1"
}
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path "$InstallDir\logs" | Out-Null

# Copy executable
Write-Host "[+] Copying dsp-agent.exe..." -ForegroundColor Yellow
$SourceBin = "..\..\bin\windows\dsp-agent.exe"

if (-not (Test-Path $SourceBin)) {
    Write-Host "[-] dsp-agent.exe not found at $SourceBin" -ForegroundColor Red
    Write-Host "    Please run '.\build.ps1' first." -ForegroundColor Gray
    exit 1
}

Copy-Item $SourceBin -Destination $InstallDir

# Create .env file (WITHOUT BOM - critical for Go parsing)
Write-Host "[+] Configuring .env file..." -ForegroundColor Yellow
$EnvContent = @"
MASTER_HOST=$MasterHost
MASTER_PORT=447
AGENT_NAME=$AgentName
SYNC_ENABLED=false
DB_DRIVER=postgres
DB_HOST=localhost
DB_PORT=5432
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding $False
[System.IO.File]::WriteAllText("$InstallDir\.env", $EnvContent, $utf8NoBom)

# Install NSSM (Non-Sucking Service Manager) for service wrapper
Write-Host "[+] Checking for NSSM..." -ForegroundColor Yellow
$nssmPath = "$env:ProgramFiles\nssm\nssm.exe"

if (-not (Test-Path $nssmPath)) {
    Write-Host "[!] NSSM not found. We will install service globally." -ForegroundColor Yellow
    Write-Host "    Please download NSSM from https://nssm.cc/download for better service management." -ForegroundColor White
    
    Write-Host "[-] NSSM is highly recommended for Agent installation to ensure configuration loading." -ForegroundColor Red
    Write-Host "    Please install NSSM to 'C:\Program Files\nssm\nssm.exe' and retry."
    exit 1
}

# Create Agent Service using NSSM
Write-Host "[*] Creating DSP Agent service..." -ForegroundColor Yellow
& $nssmPath stop DSPAgent
& $nssmPath remove DSPAgent confirm
& $nssmPath install DSPAgent "$InstallDir\dsp-agent.exe"
& $nssmPath set DSPAgent DisplayName "DSP Platform Tenant Agent"
& $nssmPath set DSPAgent Description "Data Synchronization Platform - Agent ($AgentName)"
& $nssmPath set DSPAgent AppDirectory $InstallDir
& $nssmPath set DSPAgent Start SERVICE_AUTO_START
& $nssmPath set DSPAgent AppStdout "$InstallDir\logs\agent-output.log"
& $nssmPath set DSPAgent AppStderr "$InstallDir\logs\agent-error.log"

Write-Host "[+] DSP Agent service installed!" -ForegroundColor Green
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Master IP:  $MasterHost"
Write-Host "   Agent Name: $AgentName"
Write-Host "   Location:   $InstallDir"
Write-Host ""
Write-Host "To Start the Agent:" -ForegroundColor Yellow
Write-Host "   Start-Service DSPAgent" -ForegroundColor Cyan
