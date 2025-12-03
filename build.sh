#!/bin/bash
# Build script for DSP Platform - Cross-platform compilation

echo "🔨 Building DSP Platform for multiple platforms..."

# Create build directories
mkdir -p bin/linux
mkdir -p bin/windows

# Build Master Server
echo "📦 Building Master Server..."
# Linux
GOOS=linux GOARCH=amd64 go build -o bin/linux/dsp-master cmd/master/main.go
echo "✅ Linux Master Server: bin/linux/dsp-master"

# Windows
GOOS=windows GOARCH=amd64 go build -o bin/windows/dsp-master.exe cmd/master/main.go
echo "✅ Windows Master Server: bin/windows/dsp-master.exe"

# Build Agent
echo "📦 Building Tenant Agent..."
# Linux
GOOS=linux GOARCH=amd64 go build -o bin/linux/dsp-agent cmd/agent/main.go
echo "✅ Linux Agent: bin/linux/dsp-agent"

# Windows
GOOS=windows GOARCH=amd64 go build -o bin/windows/dsp-agent.exe cmd/agent/main.go
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
