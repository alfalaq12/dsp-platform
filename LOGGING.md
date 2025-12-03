# DSP Platform - Logging Guide

Production-grade logging system for DSP Platform with structured output, log rotation, and comprehensive error tracking.

## Features

✅ **Structured Logging** - JSON format for easy parsing  
✅ **Log Levels** - DEBUG, INFO, WARN, ERROR, FATAL  
✅ **Log Rotation** - Automatic rotation by size and age  
✅ **Dual Output** - File + Console (dev mode)  
✅ **Heartbeat Throttling** - Reduces log noise from periodic operations  
✅ **Error Context** - Stack traces and contextual information

---

## Log Locations

### Linux (Production)
- Master Server: `/opt/dsp-platform/logs/master.log`
- Agent: `/opt/dsp-agent/logs/agent.log`
- Systemd Journal: `journalctl -u dsp-master` or `journalctl -u dsp-agent`

### Windows (Production)
- Master Server: `C:\Program Files\DSP-Platform\logs\master-output.log`
- Agent: `C:\Program Files\DSP-Platform\logs\agent-output.log`
- NSSM also creates `*-error.log` files for stderr

### Development
- Default: `./logs/dsp-platform.log` (in project root)
- Configurable via `LOG_FILE` environment variable

---

## Configuration

### Environment Variables

```bash
# Log level (debug, info, warn, error)
LOG_LEVEL=info

# Log file path
LOG_FILE=./logs/dsp-platform.log

# Log rotation settings
LOG_MAX_SIZE=100        # Maximum size in MB before rotation
LOG_MAX_BACKUPS=5       # Number of old log files to keep
LOG_MAX_AGE=30          # Max days to keep old logs
LOG_COMPRESS=true       # Compress rotated logs
```

### Via .env File

```bash
cp .env.example .env
# Edit .env file with your preferred settings
```

### Via Systemd (Linux)

Edit `/etc/systemd/system/dsp-master.service`:

```ini
[Service]
Environment="LOG_LEVEL=info"
Environment="LOG_FILE=/opt/dsp-platform/logs/master.log"
```

Then reload and restart:
```bash
sudo systemctl daemon-reload
sudo systemctl restart dsp-master
```

---

## Viewing Logs

### Linux - File Logs

```bash
# Tail log file (real-time)
sudo tail -f /opt/dsp-platform/logs/master.log

# View last 100 lines
sudo tail -n 100 /opt/dsp-platform/logs/master.log

# Search for errors
sudo grep "ERROR" /opt/dsp-platform/logs/master.log

# Parse JSON logs with jq
sudo tail -f /opt/dsp-platform/logs/master.log | jq .
```

### Linux - Systemd Journal

```bash
# Real-time logs
sudo journalctl -u dsp-master -f

# Today's logs
sudo journalctl -u dsp-master --since today

# Last hour only
sudo journalctl -u dsp-master --since "1 hour ago"

# Error level only
sudo journalctl -u dsp-master -p err

# Custom time range
sudo journalctl -u dsp-master --since "2025-12-04 00:00:00" --until "2025-12-04 12:00:00"
```

### Windows

```powershell
# Tail logs (real-time)
Get-Content "C:\Program Files\DSP-Platform\logs\master-output.log" -Tail 100 -Wait

# View last 50 lines
Get-Content "C:\Program Files\DSP-Platform\logs\master-output.log" -Tail 50

# Search for errors
Select-String -Path "C:\Program Files\DSP-Platform\logs\*.log" -Pattern "ERROR"

# View Event Viewer
Get-EventLog -LogName Application -Source "DSP*" -Newest 50
```

---

## Log Levels

### DEBUG
Detailed debugging information. **Not recommended for production** as it generates high log volume.

```bash
LOG_LEVEL=debug
```

Example logs:
- Every heartbeat from agents (throttled to every 10th)
- Detailed request/response payloads
- Internal function calls

### INFO (Default)
General informational messages about app state and operations.

Example logs:
- Server startup/shutdown
- Agent connections/disconnections
- Database migrations
- HTTP requests
- Job executions

### WARN
Warning messages for potentially problematic situations that aren't errors.

Example logs:
- Failed to parse agent message (not critical)
- Reconnection attempts
- Unknown message types

### ERROR
Error events that might still allow the app to continue.

Example logs:
- Database connection errors
- HTTP request failures
- Agent communication errors
- Job execution failures

### FATAL
Severe errors that cause the application to abort.

Example logs:
- Failed to initialize logger
- Failed to start HTTP server
- Failed to connect to database
- Failed reconnections after max retries

---

## Log Rotation

Logs automatically rotate when they reach the configured size.

### Configuration

```bash
LOG_MAX_SIZE=100        # Rotate when log reaches 100MB
LOG_MAX_BACKUPS=5       # Keep 5 old log files
LOG_MAX_AGE=30          # Delete logs older than 30 days
LOG_COMPRESS=true       # Compress old logs with gzip
```

### Rotated File Naming

```
master.log              # Current log
master.log.1            # Previous log
master.log.2.gz         # Older compressed log
master.log.3.gz
```

### Manual Rotation (if needed)

```bash
# Linux
sudo systemctl stop dsp-master
sudo mv /opt/dsp-platform/logs/master.log /opt/dsp-platform/logs/master.log.backup
sudo systemctl start dsp-master

# Windows
Stop-Service DSPMaster
Rename-Item "C:\Program Files\DSP-Platform\logs\master-output.log" "master-output.log.backup"
Start-Service DSPMaster
```

---

## Troubleshooting with Logs

### Agent won't connect to Master

```bash
# Check agent logs for connection errors
sudo journalctl -u dsp-agent | grep "Connection failed"

# Check if master is listening
sudo netstat -tulpn | grep 447

# Check firewall
sudo ufw status
```

### High CPU/Memory Usage

```bash
# Check for excessive heartbeat logging
sudo grep "heartbeat" /opt/dsp-platform/logs/master.log | wc -l

# Increase log level to reduce I/O
# Edit service and set LOG_LEVEL=warn
```

### Missing Logs

```bash
# Check log directory permissions
ls -la /opt/dsp-platform/logs/

# Should be owned by dsp:dsp
sudo chown -R dsp:dsp /opt/dsp-platform/logs/

# Check disk space
df -h
```

### Parse JSON Logs for Analysis

```bash
# Count errors in last hour
journalctl -u dsp-master --since "1 hour ago" -o json | \
  jq -r 'select(.level == "error")' | wc -l

# List all unique error messages
cat /opt/dsp-platform/logs/master.log | \
  jq -r 'select(.level == "error") | .message' | sort | uniq

# Extract agent connection events
cat /opt/dsp-platform/logs/master.log | \
  jq -r 'select(.message | contains("agent")) | {time, level, message}'
```

---

## Log Format Examples

### Startup
```json
{
  "level": "info",
  "web_port": "441",
  "agent_port": "447",
  "time": "2025-12-04T01:30:00+07:00",
  "caller": "main.go:28",
  "message": "Starting DSP Platform Master Server"
}
```

### Database Operations
```json
{
  "level": "info",
  "database": "dsp.db",
  "time": "2025-12-04T01:30:01+07:00",
  "caller": "main.go:76",
  "message": "Initializing database"
}
```

### Errors
```json
{
  "level": "error",
  "error": "connection refused",
  "address": "192.168.1.100:447",
  "time": "2025-12-04T01:30:15+07:00",
  "caller": "main.go:93",
  "message": "Connection failed"
}
```

### Agent Heartbeat (every 10th logged)
```json
{
  "level": "debug",
  "count": 50,
  "time": "2025-12-04T01:35:00+07:00",
  "caller": "main.go:133",
  "message": "Sending heartbeat to Master"
}
```

---

## Best Practices

1. **Use INFO for production** - Balance between visibility and performance
2. **Enable DEBUG only for troubleshooting** - High log volume
3. **Monitor log file sizes** - Ensure rotation is working
4. **Set up log aggregation** - Use ELK stack, Grafana Loki, or similar for production
5. **Regular log review** - Check for warning/error patterns
6. **Secure log files** - Proper permissions (640 or 600)
7. **Backup important logs** - Before major changes or deployments

---

## Integration with Monitoring Tools

### Promtail + Grafana Loki

```yaml
# promtail-config.yml
scrape_configs:
  - job_name: dsp-platform
    static_configs:
      - targets:
          - localhost
        labels:
          job: dsp-master
          __path__: /opt/dsp-platform/logs/*.log
```

### Filebeat + Elasticsearch

```yaml
# filebeat.yml
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /opt/dsp-platform/logs/*.log
    json.keys_under_root: true
    json.add_error_key: true
```

### CloudWatch (AWS)

```bash
# Install CloudWatch agent and configure
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/config.json \
  -s
```

---

## Support

For issues related to logging:
1. Check this guide first
2. Review [DEPLOYMENT.md](DEPLOYMENT.md) for service configuration
3. Check [README.md](README.md) for general troubleshooting
