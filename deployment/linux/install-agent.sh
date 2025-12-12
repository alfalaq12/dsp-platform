#!/bin/bash
# Installation script for DSP Platform Agent on Linux
# Run with sudo: sudo ./install-agent.sh
# Or use: make install-agent-linux

set -e

echo "🚀 Installing DSP Platform Agent on Linux..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Create user and group
echo "👤 Creating dsp user and group..."
if ! id -u dsp > /dev/null 2>&1; then
    useradd --system --shell /bin/false --home /opt/dsp-agent dsp
    echo "✅ User 'dsp' created"
else
    echo "ℹ️  User 'dsp' already exists"
fi

# Create directories
echo "📁 Creating directories..."
mkdir -p /opt/dsp-agent/data
mkdir -p /opt/dsp-agent/logs

# Check for binary - can be from bin/linux or copied manually
BINARY_PATH=""
if [ -f "../../bin/linux/dsp-agent" ]; then
    BINARY_PATH="../../bin/linux/dsp-agent"
elif [ -f "./dsp-agent" ]; then
    BINARY_PATH="./dsp-agent"
else
    echo "❌ dsp-agent binary not found!"
    echo "   Please either:"
    echo "   1. Run 'make build-linux' first (if you have the source code)"
    echo "   2. Copy dsp-agent binary to this directory"
    exit 1
fi

# Install Agent
echo "📦 Installing Agent binary..."
cp "$BINARY_PATH" /opt/dsp-agent/
chown -R dsp:dsp /opt/dsp-agent
chmod +x /opt/dsp-agent/dsp-agent

# Create .env file if not exists
if [ ! -f "/opt/dsp-agent/.env" ]; then
    echo "📝 Creating default .env file..."
    read -p "Enter Master Server IP: " MASTER_IP
    read -p "Enter Agent Name [agent-$(hostname)]: " AGENT_NAME
    AGENT_NAME=${AGENT_NAME:-agent-$(hostname)}
    
    cat > /opt/dsp-agent/.env << EOF
MASTER_HOST=${MASTER_IP}
MASTER_PORT=447
AGENT_NAME=${AGENT_NAME}
SYNC_ENABLED=false
DB_DRIVER=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USER=
DB_PASSWORD=
DB_NAME=
EOF
    chown dsp:dsp /opt/dsp-agent/.env
    chmod 600 /opt/dsp-agent/.env
    echo "✅ .env file created"
else
    echo "ℹ️  .env file already exists, skipping..."
fi

# Install systemd service
echo "📦 Installing systemd service..."
cp dsp-agent.service /etc/systemd/system/
systemctl daemon-reload
echo "✅ Agent installed"

echo ""
echo "✨ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure database connection in:"
echo "   /opt/dsp-agent/.env"
echo "2. Enable and start the service:"
echo "   sudo systemctl enable dsp-agent"
echo "   sudo systemctl start dsp-agent"
echo "3. Check status:"
echo "   sudo systemctl status dsp-agent"
echo "4. View logs:"
echo "   sudo journalctl -u dsp-agent -f"
echo ""
echo "📝 Quick update after git pull:"
echo "   make update-agent-linux"
echo "   OR manually:"
echo "   sudo cp dsp-agent /opt/dsp-agent/"
echo "   sudo systemctl restart dsp-agent"
