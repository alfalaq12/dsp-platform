# Windows Service Installation Script for DSP Platform
# Run as Administrator: .\install-service.ps1

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "❌ Please run this script as Administrator" -ForegroundColor Red
    exit 1
}

Write-Host "🚀 Installing DSP Platform as Windows Service..." -ForegroundColor Cyan

# Install directory
$InstallDir = "C:\Program Files\DSP-Platform"
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# Copy executables
Write-Host "📦 Copying executables..." -ForegroundColor Yellow
Copy-Item "..\..\bin\windows\dsp-master.exe" -Destination $InstallDir
Copy-Item "..\..\bin\windows\dsp-agent.exe" -Destination $InstallDir

# Create data directory
New-Item -ItemType Directory -Force -Path "$InstallDir\data" | Out-Null

# Install NSSM (Non-Sucking Service Manager) for service wrapper
Write-Host "📦 Checking for NSSM (service wrapper)..." -ForegroundColor Yellow

$nssmPath = "$env:ProgramFiles\nssm\nssm.exe"
if (-not (Test-Path $nssmPath)) {
    Write-Host "⚠️  NSSM not found. Please install NSSM first:" -ForegroundColor Yellow
    Write-Host "   1. Download from: https://nssm.cc/download" -ForegroundColor White
    Write-Host "   2. Extract to: C:\Program Files\nssm\" -ForegroundColor White
    Write-Host "   3. Run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "Alternative: Use sc.exe to create service manually (see README)" -ForegroundColor Cyan
    
    # Create manual service creation script
    $manualScript = @"
# Manual service creation (without NSSM)
sc.exe create DSPMaster binPath= "$InstallDir\dsp-master.exe" start= auto
sc.exe description DSPMaster "DSP Platform Master Server for Data Synchronization"
sc.exe start DSPMaster

# To create Agent service:
# sc.exe create DSPAgent binPath= "$InstallDir\dsp-agent.exe" start= auto
# sc.exe description DSPAgent "DSP Platform Tenant Agent"
# sc.exe start DSPAgent
"@
    $manualScript | Out-File -FilePath "$InstallDir\manual-install.txt" -Encoding UTF8
    Write-Host "📄 Manual installation commands saved to: $InstallDir\manual-install.txt" -ForegroundColor Green
    exit 0
}

# Create Master Server service using NSSM
Write-Host "🔧 Creating Master Server service..." -ForegroundColor Yellow
& $nssmPath install DSPMaster "$InstallDir\dsp-master.exe"
& $nssmPath set DSPMaster DisplayName "DSP Platform Master Server"
& $nssmPath set DSPMaster Description "Data Synchronization Platform - Master Server"
& $nssmPath set DSPMaster AppDirectory $InstallDir
& $nssmPath set DSPMaster Start SERVICE_AUTO_START
& $nssmPath set DSPMaster AppStdout "$InstallDir\logs\master-output.log"
& $nssmPath set DSPMaster AppStderr "$InstallDir\logs\master-error.log"

Write-Host "✅ Master Server service created" -ForegroundColor Green

# Optional: Install Agent
$installAgent = Read-Host "📦 Do you want to install the Agent service too? (Y/N)"
if ($installAgent -eq 'Y' -or $installAgent -eq 'y') {
    Write-Host "🔧 Creating Agent service..." -ForegroundColor Yellow
    & $nssmPath install DSPAgent "$InstallDir\dsp-agent.exe"
    & $nssmPath set DSPAgent DisplayName "DSP Platform Tenant Agent"
    & $nssmPath set DSPAgent Description "Data Synchronization Platform - Tenant Agent"
    & $nssmPath set DSPAgent AppDirectory $InstallDir
    & $nssmPath set DSPAgent Start SERVICE_AUTO_START
    & $nssmPath set DSPAgent AppStdout "$InstallDir\logs\agent-output.log"
    & $nssmPath set DSPAgent AppStderr "$InstallDir\logs\agent-error.log"
    Write-Host "✅ Agent service created" -ForegroundColor Green
}

Write-Host ""
Write-Host "✨ Installation complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Installed to: $InstallDir" -ForegroundColor Cyan
Write-Host ""
Write-Host "🎯 Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure environment variables (optional):" -ForegroundColor White
Write-Host "   Computer > Properties > Advanced > Environment Variables" -ForegroundColor Gray
Write-Host "2. Start the service:" -ForegroundColor White
Write-Host "   Start-Service DSPMaster" -ForegroundColor Cyan
Write-Host "3. Check status:" -ForegroundColor White
Write-Host "   Get-Service DSPMaster" -ForegroundColor Cyan
Write-Host "4. View logs in: $InstallDir\logs\" -ForegroundColor White
Write-Host ""
Write-Host "🔧 Service Management:" -ForegroundColor Yellow
Write-Host "   Start:   Start-Service DSPMaster" -ForegroundColor White
Write-Host "   Stop:    Stop-Service DSPMaster" -ForegroundColor White
Write-Host "   Restart: Restart-Service DSPMaster" -ForegroundColor White
Write-Host "   Remove:  sc.exe delete DSPMaster" -ForegroundColor White
