# Polycopy Scripts Guide

Management scripts for the Polycopy copy trading system.

## Available Scripts

### 🚀 start.sh
Start all Polycopy services with PM2

```bash
# Start in testnet mode (default, safe for testing)
./start.sh

# Start in mainnet mode (⚠️ REAL FUNDS AT RISK)
./start.sh mainnet
```

**What it does:**
- Validates environment (Python, Node.js, PM2)
- Installs all dependencies
- Starts API server (port 8001)
- Starts Web UI (port 3001)
- Runs health checks
- Saves PM2 process list

**Environment variables set:**
- Testnet: `POLYCOPY_NETWORK=testnet`, `POLYCOPY_DRY_RUN=true`
- Mainnet: `POLYCOPY_NETWORK=mainnet`, `POLYCOPY_DRY_RUN=false`

---

### 🛑 stop.sh
Gracefully stop all Polycopy services

```bash
./stop.sh
```

**What it does:**
- Stops active polycopy monitors
- Stops PM2 services (API & Web)
- Displays final statistics
- Saves PM2 state

---

### 🔄 restart.sh
Restart Polycopy services

```bash
./restart.sh
```

**What it does:**
- Restarts API server
- Restarts Web UI
- Preserves environment settings
- Saves PM2 state

---

### 📊 status.sh
Check status of all services

```bash
./status.sh
```

**What it does:**
- Shows PM2 process status
- Checks API health (localhost:8001)
- Checks Web UI health (localhost:3001)
- Displays trading statistics
- Shows system information
- Lists quick action commands

---

### 📝 logs.sh
View application logs

```bash
# View all polycopy logs
./logs.sh

# View API logs only
./logs.sh polycopy-api

# View Web UI logs only
./logs.sh polycopy-app
```

**What it does:**
- Displays last 100 log lines
- Follows logs in real-time (Ctrl+C to exit)

---

### ✅ test.sh
Validate installation and setup

```bash
./test.sh
```

**What it does:**
- Checks Python installation
- Checks Node.js installation
- Checks PM2 installation
- Validates directory structure
- Checks required files
- Tests polycopy module import
- Verifies script permissions

---

## Directory Structure

```
polycopy/
├── app/                    # Next.js frontend
│   ├── app/               # Next.js app directory
│   ├── components/        # React components
│   ├── package.json       # Node dependencies
│   └── ...
├── server/                # FastAPI backend
│   ├── api.py            # Main API server
│   ├── requirements.txt  # Python dependencies
│   └── logs/             # Server logs
├── polycopy/             # Python module
│   ├── __init__.py
│   ├── mod.py            # Main module
│   ├── api.py            # Polymarket API client
│   ├── traders.py        # Trader analysis
│   ├── search.py         # Trader search
│   └── ...
├── logs/                 # PM2 logs
├── pids/                 # Process IDs
├── requirements.txt      # Root Python dependencies
├── ecosystem.config.js   # PM2 configuration
└── *.sh                  # Management scripts
```

---

## PM2 Configuration (ecosystem.config.js)

The `ecosystem.config.js` file defines two services:

### polycopy-api
- **Command:** `uvicorn api:app --host 0.0.0.0 --port 8001 --reload`
- **Directory:** `./server`
- **Interpreter:** Python 3
- **Logs:** `./logs/api-{error,out}.log`

### polycopy-app
- **Command:** `npm run dev`
- **Directory:** `./app`
- **Port:** 3001
- **Logs:** `./logs/app-{error,out}.log`

---

## Common PM2 Commands

```bash
# List all processes
pm2 list

# Monitor processes (interactive)
pm2 monit

# View logs
pm2 logs polycopy        # All polycopy logs
pm2 logs polycopy-api    # API only
pm2 logs polycopy-app    # Web UI only

# Restart services
pm2 restart polycopy-api
pm2 restart polycopy-app
pm2 restart all

# Stop services
pm2 stop polycopy-api
pm2 stop polycopy-app
pm2 stop all

# Delete processes
pm2 delete polycopy-api
pm2 delete polycopy-app

# Save process list
pm2 save

# Resurrect saved processes
pm2 resurrect

# Show process details
pm2 describe polycopy-api
```

---

## Troubleshooting

### API won't start
```bash
# Check logs
./logs.sh polycopy-api

# Check if port is in use
lsof -i :8001

# Restart API
pm2 restart polycopy-api

# Or full restart
./stop.sh && ./start.sh
```

### Web UI won't start
```bash
# Check logs
./logs.sh polycopy-app

# Check if port is in use
lsof -i :3001

# Reinstall dependencies
cd app && npm install && cd ..

# Restart
pm2 restart polycopy-app
```

### Module import errors
```bash
# Reinstall Python dependencies
pip3 install -r requirements.txt
pip3 install -r server/requirements.txt

# Verify module
python3 -c "from polycopy.mod import Mod; print('OK')"
```

### PM2 process stuck
```bash
# Force stop
pm2 delete all --force

# Clean up
pm2 kill

# Restart
./start.sh
```

---

## Environment Variables

### Required for Trading (Mainnet)
- `POLYCOPY_NETWORK=mainnet` - Use mainnet
- `POLYCOPY_DRY_RUN=false` - Execute real trades
- Private key configured via mod framework (`m.key()`)

### Optional
- `POLYCOPY_WALLET_ADDRESS` - Your wallet address
- `POLYCOPY_API_KEY` - Polymarket API key (if available)
- `PYTHONUNBUFFERED=1` - Unbuffered Python output (always set)

---

## Quick Reference

| Task | Command |
|------|---------|
| Start services | `./start.sh` |
| Stop services | `./stop.sh` |
| Restart services | `./restart.sh` |
| Check status | `./status.sh` |
| View logs | `./logs.sh` |
| Test installation | `./test.sh` |
| Monitor live | `pm2 monit` |
| Access Web UI | http://localhost:3001 |
| Access API | http://localhost:8001 |
| API Docs | http://localhost:8001/docs |

---

## Script Maintenance

All scripts are located in the root polycopy directory and should be executable:

```bash
# Make all scripts executable
chmod +x *.sh

# Check script syntax
bash -n script.sh

# Run test suite
./test.sh
```

---

## Notes

- 🟢 **Testnet mode** is the default and safe for testing
- 🔴 **Mainnet mode** requires explicit confirmation and uses real funds
- All scripts use PM2 for process management
- Logs are stored in `./logs/` directory
- PM2 state is automatically saved on start/stop
- Services auto-restart on crashes (configured in ecosystem.config.js)
