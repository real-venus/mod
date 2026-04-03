# Arweave Storage App

A Next.js web interface for interacting with the Arweave permanent storage network.

## Features

- **Upload Data**: Store JSON or text data permanently on Arweave
- **Retrieve Data**: Fetch data using transaction IDs
- **Wallet Management**: Check wallet balance
- **Price Calculator**: Estimate storage costs

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or use the start script
../scripts/start.sh
```

The app will be available at `http://localhost:8850`

## Configuration

The app connects to the Arweave API backend. Set the `ARWEAVE_API` environment variable to point to your backend:

```bash
export ARWEAVE_API=http://localhost:8000/arweave
```

Default: `http://localhost:8000/arweave`

## Architecture

```
app/
├── src/
│   └── app/
│       ├── api/
│       │   └── arweave/
│       │       └── route.ts      # API proxy to Python backend
│       ├── globals.css           # Styles with Arweave-specific classes
│       ├── layout.tsx            # Root layout
│       └── page.tsx              # Main interface
├── package.json                  # Dependencies
└── next.config.js                # Next.js config
```

## Usage

### Upload Data

1. Navigate to the **Upload** tab
2. Enter JSON or plain text content
3. Optionally add tags as JSON
4. Click "Upload to Arweave"
5. Transaction ID will be displayed on success

### Retrieve Data

1. Navigate to the **Retrieve** tab
2. Enter a transaction ID
3. Click "Retrieve Data"
4. Content will be displayed

### Wallet Info

1. Navigate to the **Wallet** tab
2. Click "Get Balance" to see your AR balance
3. Enter a data size to calculate storage cost

## API Backend Required

This frontend requires the Arweave Python backend to be running. The backend provides:

- `/arweave/add` - Upload data
- `/arweave/get` - Retrieve data
- `/arweave/cat` - Get raw bytes
- `/arweave/balance` - Get wallet balance
- `/arweave/price` - Calculate storage price

Start the backend with:
```bash
cd ../../core
m.serve('api')
```

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Arweave** - Permanent storage network

## Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## Environment Variables

- `ARWEAVE_API` - Arweave backend API URL (default: `http://localhost:8000/arweave`)

## Notes

- Data stored on Arweave is permanent and cannot be deleted
- Storage costs are paid in AR tokens
- Transaction IDs can be used to retrieve data from any Arweave gateway
