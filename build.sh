#!/bin/bash
# Build script for DSP Platform - Cross-platform compilation

echo "🔨 Building DSP Platform for multiple platforms..."

# Create build directories
mkdir -p bin/linux
mkdir -p bin/windows


# Build Frontend
echo "🎨 Building Frontend..."
if command -v npm >/dev/null 2>&1; then
    cd frontend
    echo "   Running npm install..."
    npm install
    echo "   Running npm run build..."
    npm run build
    cd ..
    
    # Copy frontend assets
    echo "   Copying frontend assets..."
    mkdir -p bin/linux/frontend
    mkdir -p bin/windows/frontend
    cp -r frontend/dist bin/linux/frontend/
    cp -r frontend/dist bin/windows/frontend/
    echo "✅ Frontend built and copied"
else
    echo "⚠️  npm not found. Skipping frontend build."
    echo "   The Web Console UI will not be updated."
fi

# Build Master Server
echo "📦 Building Master Server..."
# Linux
GOOS=linux GOARCH=amd64 go build -o bin/linux/dsp-master ./cmd/master
echo "✅ Linux Master Server: bin/linux/dsp-master"

# Windows
GOOS=windows GOARCH=amd64 go build -o bin/windows/dsp-master.exe ./cmd/master
echo "✅ Windows Master Server: bin/windows/dsp-master.exe"

# Build Agent
echo "📦 Building Tenant Agent..."
# Linux
GOOS=linux GOARCH=amd64 go build -o bin/linux/dsp-agent ./cmd/agent
echo "✅ Linux Agent: bin/linux/dsp-agent"

# Windows
GOOS=windows GOARCH=amd64 go build -o bin/windows/dsp-agent.exe ./cmd/agent
echo "✅ Windows Agent: bin/windows/dsp-agent.exe"

# Set executable permissions for Linux binaries
chmod +x bin/linux/dsp-master bin/linux/dsp-agent

echo ""
echo "✨ Build complete! Binaries available in:"
echo "   - Linux: ./bin/linux/"
echo "   - Windows: ./bin/windows/"
echo ""
echo "📋 File sizes:"
ls -lh bin/linux/ bin/windows/
