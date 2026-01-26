#!/bin/bash
# DSP Platform - One-Click Build Script (Bash)
# Usage: ./install.sh
# This will build everything: Frontend + Master + Agent for Linux & Windows

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;37m'
NC='\033[0m' # No Color

# Options
SKIP_FRONTEND=false
LINUX_ONLY=false
WINDOWS_ONLY=false

show_help() {
    echo ""
    echo -e "${CYAN}DSP Platform - Build Script${NC}"
    echo "============================="
    echo ""
    echo "Usage: ./install.sh [options]"
    echo ""
    echo "Options:"
    echo "  --skip-frontend    Skip frontend build (use existing)"
    echo "  --linux-only       Build only Linux binaries"
    echo "  --windows-only     Build only Windows binaries"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./install.sh                   # Build everything"
    echo "  ./install.sh --linux-only      # Build Linux only"
    echo "  ./install.sh --skip-frontend   # Skip frontend rebuild"
    echo ""
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-frontend) SKIP_FRONTEND=true; shift ;;
        --linux-only) LINUX_ONLY=true; shift ;;
        --windows-only) WINDOWS_ONLY=true; shift ;;
        --help) show_help; exit 0 ;;
        *) echo "Unknown option: $1"; show_help; exit 1 ;;
    esac
done

check_prerequisites() {
    echo ""
    echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
    
    # Check Go
    if ! command -v go &> /dev/null; then
        echo -e "${RED}❌ Go is not installed. Please install Go 1.21+ from https://go.dev${NC}"
        exit 1
    fi
    echo -e "  ${GREEN}✅ Go: $(go version)${NC}"
    
    # Check Node.js (optional for frontend)
    if [ "$SKIP_FRONTEND" = false ]; then
        if ! command -v npm &> /dev/null; then
            echo -e "  ${YELLOW}⚠️  npm not found. Frontend build will be skipped.${NC}"
            SKIP_FRONTEND=true
        else
            echo -e "  ${GREEN}✅ Node.js: $(node --version)${NC}"
        fi
    fi
    
    echo ""
}

build_frontend() {
    if [ "$SKIP_FRONTEND" = true ]; then
        echo -e "${YELLOW}⏭️  Skipping frontend build...${NC}"
        return
    fi
    
    echo -e "${CYAN}🎨 Building Frontend...${NC}"
    cd frontend
    echo -e "   ${GRAY}Installing dependencies...${NC}"
    npm install > /dev/null 2>&1
    echo -e "   ${GRAY}Building production bundle...${NC}"
    npm run build > /dev/null 2>&1
    cd ..
    echo -e "  ${GREEN}✅ Frontend built successfully${NC}"
}

build_binaries() {
    echo -e "${CYAN}📦 Building binaries...${NC}"
    
    mkdir -p bin/linux bin/windows
    
    # Build Linux
    if [ "$WINDOWS_ONLY" = false ]; then
        echo -e "   ${GRAY}Building Linux Master...${NC}"
        GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/linux/dsp-master ./cmd/master
        
        echo -e "   ${GRAY}Building Linux Agent...${NC}"
        GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/linux/dsp-agent ./cmd/agent
        
        chmod +x bin/linux/dsp-master bin/linux/dsp-agent
        echo -e "  ${GREEN}✅ Linux binaries built${NC}"
    fi
    
    # Build Windows
    if [ "$LINUX_ONLY" = false ]; then
        echo -e "   ${GRAY}Building Windows Master...${NC}"
        GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/windows/dsp-master.exe ./cmd/master
        
        echo -e "   ${GRAY}Building Windows Agent...${NC}"
        GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/windows/dsp-agent.exe ./cmd/agent
        
        echo -e "  ${GREEN}✅ Windows binaries built${NC}"
    fi
}

copy_assets() {
    echo -e "${CYAN}📁 Copying assets...${NC}"
    
    for platform in linux windows; do
        if [ "$WINDOWS_ONLY" = true ] && [ "$platform" = "linux" ]; then continue; fi
        if [ "$LINUX_ONLY" = true ] && [ "$platform" = "windows" ]; then continue; fi
        
        # Copy frontend
        if [ -d "frontend/dist" ]; then
            mkdir -p "bin/$platform/frontend"
            cp -r frontend/dist "bin/$platform/frontend/"
        fi
        
        # Copy .env.example
        if [ -f ".env.example" ]; then
            cp .env.example "bin/$platform/"
        fi
        
        # Copy certs if exist
        if [ -d "certs" ]; then
            mkdir -p "bin/$platform/certs"
            cp -r certs/* "bin/$platform/certs/" 2>/dev/null || true
        fi
    done
    
    echo -e "  ${GREEN}✅ Assets copied${NC}"
}

show_summary() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "  ${GREEN}✅ BUILD COMPLETE!${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${YELLOW}📦 Output:${NC}"
    
    if [ "$WINDOWS_ONLY" = false ] && [ -d "bin/linux" ]; then
        echo "   Linux:   bin/linux/"
        ls -lh bin/linux/*.* 2>/dev/null | awk '{print "            - " $9 " (" $5 ")"}'
    fi
    
    if [ "$LINUX_ONLY" = false ] && [ -d "bin/windows" ]; then
        echo "   Windows: bin/windows/"
        ls -lh bin/windows/*.* 2>/dev/null | awk '{print "            - " $9 " (" $5 ")"}'
    fi
    
    echo ""
    echo -e "${YELLOW}🚀 Quick Start:${NC}"
    echo "   1. Copy .env.example to .env and edit JWT_SECRET"
    echo "   2. Run: ./bin/linux/dsp-master"
    echo "   3. Open: http://localhost:441"
    echo "   4. Login: admin / admin"
    echo ""
}

# Main
echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       DSP Platform - One-Click Build                   ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════╝${NC}"

check_prerequisites
build_frontend
build_binaries
copy_assets
show_summary
