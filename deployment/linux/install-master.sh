#!/bin/bash
# Installation script for DSP Platform Master Server on Linux
# Run with sudo: sudo ./install-master.sh

set -e

echo "🚀 Installing DSP Platform Master Server on Linux..."

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
mkdir -p /opt/dsp-platform/frontend
cp ../../bin/linux/dsp-master /opt/dsp-platform/
cp -r ../../bin/linux/frontend/dist /opt/dsp-platform/frontend/
chown -R root:root /opt/dsp-platform
chmod +x /opt/dsp-platform/dsp-master

# Install systemd service
cp dsp-master.service /etc/systemd/system/
systemctl daemon-reload
echo "✅ Master Server installed"

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
echo ""
echo "📝 Quick update after git pull:"
echo "   make update-master-linux"
