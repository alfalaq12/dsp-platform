#!/bin/bash
# Installation script for DSP Platform on Linux
# Run with sudo: sudo ./install.sh

set -e

echo "🚀 Installing DSP Platform on Linux..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root (use sudo)"
    exit 1
fi

# Create user and group
echo "👤 Creating dsp user and group..."
if ! id -u dsp > /dev/null 2>&1; then
    useradd --system --shell /bin/false --home /opt/dsp-platform dsp
    echo "✅ User 'dsp' created"
else
    echo "ℹ️  User 'dsp' already exists"
fi

# Install Master Server
echo "📦 Installing Master Server..."
mkdir -p /opt/dsp-platform/data
mkdir -p /opt/dsp-platform/logs
cp ../../bin/linux/dsp-master /opt/dsp-platform/
chown -R dsp:dsp /opt/dsp-platform
chmod +x /opt/dsp-platform/dsp-master

# Install systemd service
cp dsp-master.service /etc/systemd/system/
systemctl daemon-reload
echo "✅ Master Server installed"

# Optional: Install Agent
read -p "📦 Do you want to install the Agent on this server too? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    mkdir -p /opt/dsp-agent/data
    mkdir -p /opt/dsp-agent/logs
    cp ../../bin/linux/dsp-agent /opt/dsp-agent/
    chown -R dsp:dsp /opt/dsp-agent
    chmod +x /opt/dsp-agent/dsp-agent
    cp dsp-agent.service /etc/systemd/system/
    systemctl daemon-reload
    echo "✅ Agent installed"
fi

echo ""
echo "✨ Installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure environment variables in:"
echo "   /etc/systemd/system/dsp-master.service"
echo "2. Enable and start the service:"
echo "   sudo systemctl enable dsp-master"
echo "   sudo systemctl start dsp-master"
echo "3. Check status:"
echo "   sudo systemctl status dsp-master"
echo "4. View logs:"
echo "   sudo journalctl -u dsp-master -f"
