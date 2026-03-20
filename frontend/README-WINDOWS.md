# Wave Browser Frontend - Windows Development Setup

This guide covers setting up the frontend for standalone development on Windows.

## Prerequisites

1. **Node.js 18+** - Download from [nodejs.org](https://nodejs.org/)
2. **VS Code** - Download from [code.visualstudio.com](https://code.visualstudio.com/)
3. **Git** (optional) - For version control

## Quick Start

### 1. Open Frontend Directory

If accessing via shared drive (e.g., `\\linux-server\u\avidan\workspaces\wave_browser\frontend`):

```powershell
# Map network drive (optional, for easier access)
net use Z: \\linux-server\u\avidan\workspaces\wave_browser

# Or open directly in VS Code
code "\\linux-server\u\avidan\workspaces\wave_browser\frontend"
```

### 2. Install Dependencies

Open terminal in VS Code (Ctrl+`) and run:

```powershell
npm install
```

### 3. Initialize MSW (Mock Service Worker)

First time only - generates the service worker file:

```powershell
npm run msw:init
```

This creates `public/mockServiceWorker.js`.

### 4. Start Development Server with Mocks

```powershell
npm run dev:mock:win
```

Or in PowerShell:
```powershell
$env:VITE_USE_MOCKS="true"; npm run dev
```

Open http://localhost:5173 in your browser.

### 5. Run E2E Tests

Install Playwright browsers (first time only):
```powershell
npx playwright install
```

Run tests:
```powershell
npm run test:e2e
```

Run tests with UI:
```powershell
npm run test:e2e:ui
```

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server (requires backend) |
| `npm run dev:mock:win` | Start dev server with mock API (Windows) |
| `npm run build` | Build for production |
| `npm run lint` | Run ESLint |
| `npm run test:e2e` | Run Playwright E2E tests |
| `npm run test:e2e:ui` | Run Playwright with interactive UI |
| `npm run test:e2e:headed` | Run tests in visible browser |
| `npm run test:e2e:debug` | Debug tests with Playwright Inspector |

---

## Project Structure

```
frontend/
├── CONTEXT.md           # Full API documentation and architecture
├── README-WINDOWS.md    # This file
├── e2e/                 # Playwright E2E tests
│   ├── session.spec.ts  # Session dialog tests
│   └── hierarchy.spec.ts # Hierarchy panel tests
├── mocks/               # MSW mock server
│   ├── browser.ts       # Browser worker setup
│   ├── data.ts          # Mock data fixtures
│   ├── handlers.ts      # API mock handlers
│   └── index.ts         # Mock initialization
├── public/              # Static assets
│   └── mockServiceWorker.js  # MSW worker (generated)
├── src/
│   ├── api/             # API client
│   ├── components/      # React components
│   ├── store/           # Zustand state
│   └── utils/           # Utilities
├── package.json
├── playwright.config.ts # Playwright config
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Mock Server

The frontend uses [MSW (Mock Service Worker)](https://mswjs.io/) to mock the backend API for standalone development.

### How It Works

1. When `VITE_USE_MOCKS=true`, the app registers a service worker
2. The service worker intercepts all `/api/*` requests
3. Mock handlers in `mocks/handlers.ts` return fake data
4. The app behaves as if connected to a real backend

### Mock Data

Mock data is defined in `mocks/data.ts` and includes:

- **Session**: A mock session with design loaded
- **Hierarchy**: 3-level module hierarchy (tb_counter → dut → u_counter)
- **Signals**: Various signal types (clk, rst_n, count, etc.)
- **Waveforms**: Generated clock, reset, and counter waveforms

### Customizing Mocks

Edit `mocks/data.ts` to add or modify mock data:

```typescript
// Add a new signal
export const customSignals: SignalInfo[] = [
  {
    name: 'my_signal',
    path: 'tb.my_signal',
    width: 4,
    // ...
  },
];
```

Edit `mocks/handlers.ts` to modify API behavior:

```typescript
// Add delay to simulate slow network
http.get('/api/sessions', async () => {
  await delay(1000);  // 1 second delay
  return HttpResponse.json({ sessions });
});
```

---

## Connecting to Real Backend

When ready to test with the real backend on Linux:

### Option 1: Update vite.config.ts

```typescript
// vite.config.ts
proxy: {
  '/api': {
    target: 'http://LINUX_IP:8000',  // Replace with actual IP
    changeOrigin: true,
  }
}
```

Then run without mocks:
```powershell
npm run dev
```

### Option 2: Use Environment Variable

Create `.env.local`:
```
VITE_API_URL=http://LINUX_IP:8000
```

---

## Troubleshooting

### "npm is not recognized"
Ensure Node.js is installed and added to PATH. Restart VS Code after installing.

### MSW not intercepting requests
1. Check that `public/mockServiceWorker.js` exists
2. Run `npm run msw:init` if missing
3. Clear browser cache and service workers

### Network drive slow
Consider copying the frontend folder locally:
```powershell
xcopy "\\linux-server\...\frontend" "C:\Projects\wave-browser-frontend" /E /I
```

### Playwright tests fail
1. Install browsers: `npx playwright install`
2. Ensure dev server is not already running on port 5173
3. Check error screenshots in `playwright-report/`

---

## VS Code Recommended Extensions

- ESLint
- Tailwind CSS IntelliSense
- Playwright Test for VSCode
- TypeScript Vue Plugin (or Volar)

---

## Next Steps

1. Read [CONTEXT.md](./CONTEXT.md) for full API documentation
2. Explore `src/components/` to understand the UI structure
3. Run E2E tests to see current functionality
4. Implement new features using mock data
