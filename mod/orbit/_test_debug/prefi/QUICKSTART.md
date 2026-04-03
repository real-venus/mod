# 🎯 PreFi Quick Start Guide

PreFi is a decentralized prediction market platform with a **Rust backend** and **Next.js frontend**.

## 🚀 Quick Start

### Prerequisites

- **Rust** (install from [rustup.rs](https://rustup.rs))
- **Node.js** v18+ and npm
- **Git**

### Start the Full Stack

```bash
# From the prefi directory
./scripts/start.sh
```

That's it! The script will:
1. Build the Rust backend (first time only)
2. Install Node dependencies (first time only)
3. Start backend on **http://localhost:8830**
4. Start frontend on **http://localhost:8831**

Open your browser to **http://localhost:8831** to use PreFi.

---

## 📁 Project Structure

```
prefi/
├── server/           # Rust backend
│   ├── src/
│   │   ├── main.rs   # Entry point
│   │   ├── api.rs    # HTTP routes
│   │   ├── auth.rs   # MetaMask authentication
│   │   ├── markets.rs # Market management
│   │   └── db.rs     # SQLite database
│   └── Cargo.toml
│
├── app/              # Next.js frontend
│   ├── src/
│   │   ├── app/      # Pages
│   │   ├── components/ # React components
│   │   └── lib/
│   │       └── api.ts # API client
│   └── package.json
│
├── scripts/
│   └── start.sh      # Launch script
│
└── contracts/        # Solidity contracts (optional)
```

---

## 🛠️ Development

### Backend Only

```bash
cd server
cargo build --release
cargo run 8830
```

### Frontend Only

```bash
cd app
npm install
npm run dev
```

### Force Rebuild

```bash
./scripts/start.sh --build
```

### Production Mode

```bash
./scripts/start.sh --prod
```

---

## 🔌 API Endpoints

### Health Check
```
GET /health
```

### Authentication
```
POST /auth/challenge    # Get message to sign
POST /auth/verify       # Verify signature
```

### Markets
```
GET  /markets           # List all markets
POST /markets           # Create market (auth required)
GET  /markets/:id       # Get market details
POST /markets/:id/resolve # Resolve market (auth required)
```

### Positions
```
POST /positions         # Create position (auth required)
GET  /positions/user/:address # Get user positions
```

---

## 🎨 Frontend Features

- **MetaMask Authentication**: Secure wallet-based login
- **Market Creation**: Create prediction markets
- **Position Tracking**: Track your bets and positions
- **Real-time Updates**: Live market data
- **Responsive Design**: Works on mobile and desktop

---

## 🗄️ Database

PreFi uses SQLite for data persistence. The database is created at:

```
~/.mod/prefi/prefi.db
```

No setup required—it's created automatically on first run.

---

## 🔒 Security

- **MetaMask Signatures**: Authentication via Ethereum signatures
- **HMAC Tokens**: Secure bearer tokens for API requests
- **No Private Keys**: Server never handles private keys
- **Non-custodial**: Users always control their assets

---

## 🐛 Troubleshooting

### Port Already in Use

Kill existing processes:
```bash
lsof -ti:8830 | xargs kill -9  # Backend
lsof -ti:8831 | xargs kill -9  # Frontend
```

Or the start script will do this automatically!

### Rust Build Fails

Make sure you have the latest Rust:
```bash
rustup update
```

### Frontend Errors

Clear and reinstall:
```bash
cd app
rm -rf node_modules package-lock.json
npm install
```

---

## 📊 Tech Stack

- **Backend**: Rust, Axum, SQLite, Tokio
- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Auth**: MetaMask, Ethereum signatures, HMAC
- **Database**: SQLite (rusqlite)
- **API**: RESTful HTTP + JSON

---

## 🎯 Next Steps

1. **Configure WalletConnect**: Add your project ID to `app/.env.local`
2. **Deploy Contracts**: Deploy PreFi contracts to Base
3. **Update Config**: Add contract addresses to frontend
4. **Production Deploy**: Deploy backend and frontend

---

## 🚦 Script Options

```bash
./scripts/start.sh [OPTIONS]

Options:
  --build   Force rebuild Rust server
  --dev     Next.js dev mode (default)
  --prod    Build and run Next.js production
  --help    Show help message
```

---

## 💡 Tips

- Use `--build` flag after pulling updates
- Backend runs on port **8830**, frontend on **8831**
- Press `Ctrl+C` to stop all services
- Database persists at `~/.mod/prefi/prefi.db`
- Logs show in terminal in real-time

---

## 📝 License

MIT License - See LICENSE file for details

---

**Built with ❤️ using Rust + Next.js**
