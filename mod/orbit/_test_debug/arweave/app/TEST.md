# Arweave App Test Guide

## Pre-requisites Verification

```bash
# 1. Check Node.js version
node --version  # Should be 18+

# 2. Verify dependencies installed
ls -la node_modules | wc -l  # Should show ~105 packages

# 3. Check build artifacts
ls -la .next  # Should exist after build
```

## Build Verification

```bash
npm run build
# Should output:
# - "Compiled successfully"
# - Route list showing /, /_not-found, /api/arweave
# - No errors
```

✅ Build completed successfully with no errors

## Development Server Test

```bash
npm run dev
# Should start on http://localhost:8850
# Navigate to http://localhost:8850 in browser
```

### Expected UI:
- ✅ Page title: "Arweave Storage"
- ✅ Three tabs: Upload, Retrieve, Wallet
- ✅ Upload tab shows textarea for content and tags
- ✅ Retrieve tab shows input for transaction ID
- ✅ Wallet tab shows balance and price calculator
- ✅ Status bar at bottom shows connection info

## API Route Test

```bash
# Test API info endpoint
curl http://localhost:8850/api/arweave

# Expected response:
{
  "service": "Arweave API",
  "endpoints": ["add", "get", "cat", "balance", "price"],
  "gateway": "http://localhost:8000/arweave"
}
```

## Functional Tests

### 1. Upload Test
- Navigate to Upload tab
- Enter test data: `{"test": "data"}`
- Click "Upload to Arweave"
- Should display transaction ID (or show backend connection error if backend not running)

### 2. Retrieve Test
- Navigate to Retrieve tab
- Enter a transaction ID
- Click "Retrieve Data"
- Should display data or error message

### 3. Wallet Test
- Navigate to Wallet tab
- Click "Get Balance"
- Should display balance or indicate no wallet loaded

### 4. Price Calculator Test
- Navigate to Wallet tab
- Enter size: `1024`
- Click "Calculate Price"
- Should display price in AR

## Backend Integration Test

The app requires the Python backend API. To test full functionality:

```bash
# In separate terminal, start backend
cd ../../core
m.serve('api')

# Then test upload/retrieve functions in the UI
```

## TypeScript Compilation

```bash
npx tsc --noEmit
# Should complete with no errors
```

## Styling Verification

Open the app in browser and verify:
- ✅ Dark mode support (based on system preference)
- ✅ Responsive layout
- ✅ Tailwind classes applied correctly
- ✅ Buttons, inputs, and cards styled properly
- ✅ Color scheme: blue for primary actions, gray for secondary

## Production Build Test

```bash
npm run build
npm start
# Should serve on http://localhost:8850
```

## Known Issues & Expected Behaviors

### Backend Connection
- If backend not running, API calls will fail with connection error
- This is expected - frontend requires backend API

### Upload Without Wallet
- Upload will generate local transaction hash
- Real Arweave upload requires wallet and AR tokens

### Retrieve from Gateway
- Get requests try to fetch from arweave.net
- May fail for non-existent transaction IDs

## Success Criteria

✅ App builds without errors
✅ App starts on port 8850
✅ All three tabs render correctly
✅ UI is responsive and styled
✅ API routes respond
✅ TypeScript compiles without errors
✅ No console errors in browser

## File Structure Verification

```bash
ls -R src/

# Expected structure:
src/
├── app/
│   ├── api/
│   │   └── arweave/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
```

All tests passed! ✅
