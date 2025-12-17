#!/bin/bash
# DSP Platform Release Build Script
# Generates binaries for Windows, Linux (x64 & ARM64)

set -e

VERSION="${1:-1.0.0}"
SKIP_FRONTEND="${2:-false}"

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_DIR="$PROJECT_ROOT/releases/v$VERSION"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
MASTER_CMD="$PROJECT_ROOT/cmd/master"
AGENT_CMD="$PROJECT_ROOT/cmd/agent"

echo "============================================"
echo "  DSP Platform Release Builder v$VERSION"
echo "============================================"
echo ""

# Create output directory
rm -rf "$OUTPUT_DIR"
mkdir -p "$OUTPUT_DIR/master" "$OUTPUT_DIR/agent"

# Step 1: Build Frontend
if [ "$SKIP_FRONTEND" != "true" ]; then
    echo "[1/4] Building Frontend..."
    cd "$FRONTEND_DIR"
    npm install --silent
    npm run build
    echo "  ✓ Frontend built successfully"
    cd "$PROJECT_ROOT"
else
    echo "[1/4] Skipping Frontend build"
fi

# Step 2: Build Master binaries
echo "[2/4] Building Master Server binaries..."

PLATFORMS=(
    "windows:amd64:.exe"
    "linux:amd64:"
    "linux:arm64:"
)

for platform in "${PLATFORMS[@]}"; do
    IFS=':' read -r GOOS GOARCH EXT <<< "$platform"
    OUTPUT_NAME="dsp-master-${GOOS}-${GOARCH}${EXT}"
    
    echo "  Building $OUTPUT_NAME..."
    
    CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH go build \
        -ldflags="-s -w -X main.Version=$VERSION" \
        -o "$OUTPUT_DIR/master/$OUTPUT_NAME" \
        "$MASTER_CMD"
    
    echo "    ✓ $OUTPUT_NAME"
done

# Step 3: Build Agent binaries
echo "[3/4] Building Agent binaries..."

for platform in "${PLATFORMS[@]}"; do
    IFS=':' read -r GOOS GOARCH EXT <<< "$platform"
    OUTPUT_NAME="dsp-agent-${GOOS}-${GOARCH}${EXT}"
    
    echo "  Building $OUTPUT_NAME..."
    
    CGO_ENABLED=0 GOOS=$GOOS GOARCH=$GOARCH go build \
        -ldflags="-s -w -X main.Version=$VERSION" \
        -o "$OUTPUT_DIR/agent/$OUTPUT_NAME" \
        "$AGENT_CMD"
    
    echo "    ✓ $OUTPUT_NAME"
done

# Step 4: Copy supporting files
echo "[4/4] Copying supporting files..."

# Copy frontend dist
if [ -d "$FRONTEND_DIR/dist" ]; then
    cp -r "$FRONTEND_DIR/dist" "$OUTPUT_DIR/master/frontend"
    echo "  ✓ Frontend dist copied"
fi

# Create .env templates
cat > "$OUTPUT_DIR/master/.env.example" << 'EOF'
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
EOF

cat > "$OUTPUT_DIR/agent/.env.example" << 'EOF'
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
EOF

echo "  ✓ .env templates created"

# Create install scripts
cat > "$OUTPUT_DIR/master/install.sh" << 'EOF'
#!/bin/bash
ARCH=$(uname -m)
case $ARCH in
    x86_64) BINARY="dsp-master-linux-amd64" ;;
    aarch64) BINARY="dsp-master-linux-arm64" ;;
    *) echo "Unsupported: $ARCH"; exit 1 ;;
esac
cp $BINARY dsp-master && chmod +x dsp-master
[ ! -f .env ] && cp .env.example .env
echo "Done! Edit .env and run: ./dsp-master"
EOF

cat > "$OUTPUT_DIR/agent/install.sh" << 'EOF'
#!/bin/bash
ARCH=$(uname -m)
case $ARCH in
    x86_64) BINARY="dsp-agent-linux-amd64" ;;
    aarch64) BINARY="dsp-agent-linux-arm64" ;;
    *) echo "Unsupported: $ARCH"; exit 1 ;;
esac
cp $BINARY dsp-agent && chmod +x dsp-agent
[ ! -f .env ] && cp .env.example .env
echo "Done! Edit .env and run: ./dsp-agent"
EOF

chmod +x "$OUTPUT_DIR/master/install.sh" "$OUTPUT_DIR/agent/install.sh"
echo "  ✓ Install scripts created"

# Create VERSION file
echo "DSP Platform v$VERSION" > "$OUTPUT_DIR/VERSION.txt"
echo "Build Date: $(date '+%Y-%m-%d %H:%M:%S')" >> "$OUTPUT_DIR/VERSION.txt"
echo "  ✓ VERSION.txt created"

# Create ZIP packages
echo ""
echo "Creating ZIP packages..."
cd "$OUTPUT_DIR"
zip -rq "dsp-master-v$VERSION.zip" master/
zip -rq "dsp-agent-v$VERSION.zip" agent/
echo "  ✓ dsp-master-v$VERSION.zip"
echo "  ✓ dsp-agent-v$VERSION.zip"

# Summary
echo ""
echo "============================================"
echo "  Build Complete!"
echo "============================================"
echo ""
echo "Output: $OUTPUT_DIR"
echo ""
ls -lh "$OUTPUT_DIR"/*.zip
