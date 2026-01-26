# DSP Platform - One-Click Build Script (PowerShell)
# Usage: .\install.ps1
# This will build everything: Frontend + Master + Agent for Linux & Windows

param(
    [switch]$SkipFrontend,
    [switch]$LinuxOnly,
    [switch]$WindowsOnly,
    [switch]$Help
)

$ErrorActionPreference = "Stop"

function Show-Help {
    Write-Host ""
    Write-Host "DSP Platform - Build Script" -ForegroundColor Cyan
    Write-Host "=============================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\install.ps1 [options]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -SkipFrontend    Skip frontend build (use existing)"
    Write-Host "  -LinuxOnly       Build only Linux binaries"
    Write-Host "  -WindowsOnly     Build only Windows binaries"
    Write-Host "  -Help            Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\install.ps1                 # Build everything"
    Write-Host "  .\install.ps1 -LinuxOnly      # Build Linux only"
    Write-Host "  .\install.ps1 -SkipFrontend   # Skip frontend rebuild"
    Write-Host ""
}

function Test-Prerequisites {
    Write-Host ""
    Write-Host "🔍 Checking prerequisites..." -ForegroundColor Yellow
    
    # Check Go
    if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
        Write-Host "❌ Go is not installed. Please install Go 1.21+ from https://go.dev" -ForegroundColor Red
        exit 1
    }
    $goVersion = go version
    Write-Host "  ✅ Go: $goVersion" -ForegroundColor Green
    
    # Check Node.js (optional for frontend)
    if (-not $SkipFrontend) {
        if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
            Write-Host "  ⚠️  npm not found. Frontend build will be skipped." -ForegroundColor Yellow
            $script:SkipFrontend = $true
        }
        else {
            $nodeVersion = node --version
            Write-Host "  ✅ Node.js: $nodeVersion" -ForegroundColor Green
        }
    }
    
    Write-Host ""
}

function Invoke-FrontendBuild {
    if ($SkipFrontend) {
        Write-Host "⏭️  Skipping frontend build..." -ForegroundColor Yellow
        return
    }
    
    Write-Host "🎨 Building Frontend..." -ForegroundColor Cyan
    Push-Location frontend
    try {
        Write-Host "   Installing dependencies..." -ForegroundColor Gray
        npm install 2>&1 | Out-Null
        Write-Host "   Building production bundle..." -ForegroundColor Gray
        npm run build 2>&1 | Out-Null
        Write-Host "  ✅ Frontend built successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "  ❌ Frontend build failed: $_" -ForegroundColor Red
        exit 1
    }
    finally {
        Pop-Location
    }
}

function Invoke-BinaryBuild {
    Write-Host "📦 Building binaries..." -ForegroundColor Cyan
    
    # Create output directories
    New-Item -ItemType Directory -Force -Path "bin\linux" | Out-Null
    New-Item -ItemType Directory -Force -Path "bin\windows" | Out-Null
    
    $buildTargets = @()
    
    if (-not $WindowsOnly) {
        $buildTargets += @(
            @{ OS = "linux"; Arch = "amd64"; Ext = ""; Name = "Linux" }
        )
    }
    
    if (-not $LinuxOnly) {
        $buildTargets += @(
            @{ OS = "windows"; Arch = "amd64"; Ext = ".exe"; Name = "Windows" }
        )
    }
    
    foreach ($target in $buildTargets) {
        $env:GOOS = $target.OS
        $env:GOARCH = $target.Arch
        
        # Build Master
        Write-Host "   Building $($target.Name) Master..." -ForegroundColor Gray
        go build -ldflags="-s -w" -o "bin\$($target.OS)\dsp-master$($target.Ext)" ./cmd/master
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ $($target.Name) Master build failed" -ForegroundColor Red
            exit 1
        }
        
        # Build Agent
        Write-Host "   Building $($target.Name) Agent..." -ForegroundColor Gray
        go build -ldflags="-s -w" -o "bin\$($target.OS)\dsp-agent$($target.Ext)" ./cmd/agent
        if ($LASTEXITCODE -ne 0) {
            Write-Host "  ❌ $($target.Name) Agent build failed" -ForegroundColor Red
            exit 1
        }
        
        Write-Host "  ✅ $($target.Name) binaries built" -ForegroundColor Green
    }
    
    # Reset environment
    $env:GOOS = ""
    $env:GOARCH = ""
}

function Copy-Assets {
    Write-Host "📁 Copying assets..." -ForegroundColor Cyan
    
    $platforms = @()
    if (-not $WindowsOnly) { $platforms += "linux" }
    if (-not $LinuxOnly) { $platforms += "windows" }
    
    foreach ($platform in $platforms) {
        # Copy frontend
        if (Test-Path "frontend\dist") {
            New-Item -ItemType Directory -Force -Path "bin\$platform\frontend" | Out-Null
            Copy-Item -Recurse -Force "frontend\dist" "bin\$platform\frontend\"
        }
        
        # Copy .env.example
        if (Test-Path ".env.example") {
            Copy-Item -Force ".env.example" "bin\$platform\"
        }
        
        # Copy certs if exist
        if (Test-Path "certs") {
            New-Item -ItemType Directory -Force -Path "bin\$platform\certs" | Out-Null
            Copy-Item -Recurse -Force "certs\*" "bin\$platform\certs\" 2>$null
        }
    }
    
    Write-Host "  ✅ Assets copied" -ForegroundColor Green
}

function Show-Summary {
    Write-Host ""
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  ✅ BUILD COMPLETE!" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📦 Output:" -ForegroundColor Yellow
    
    if (-not $WindowsOnly -and (Test-Path "bin\linux")) {
        Write-Host "   Linux:   bin\linux\" -ForegroundColor White
        Get-ChildItem "bin\linux\*" -File | ForEach-Object {
            $size = [math]::Round($_.Length / 1MB, 1)
            Write-Host "            - $($_.Name) (${size} MB)" -ForegroundColor Gray
        }
    }
    
    if (-not $LinuxOnly -and (Test-Path "bin\windows")) {
        Write-Host "   Windows: bin\windows\" -ForegroundColor White
        Get-ChildItem "bin\windows\*" -File | ForEach-Object {
            $size = [math]::Round($_.Length / 1MB, 1)
            Write-Host "            - $($_.Name) (${size} MB)" -ForegroundColor Gray
        }
    }
    
    Write-Host ""
    Write-Host "🚀 Quick Start:" -ForegroundColor Yellow
    Write-Host "   1. Copy .env.example to .env and edit JWT_SECRET"
    Write-Host "   2. Run: .\bin\windows\dsp-master.exe"
    Write-Host "   3. Open: http://localhost:441"
    Write-Host "   4. Login: admin / admin"
    Write-Host ""
}

# Main
if ($Help) {
    Show-Help
    exit 0
}

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       DSP Platform - One-Click Build                   ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════╝" -ForegroundColor Cyan

Test-Prerequisites
Invoke-FrontendBuild
Invoke-BinaryBuild
Copy-Assets
Show-Summary
