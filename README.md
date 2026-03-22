# Wave Browser

A web application for browsing RTL design hierarchy and viewing waveforms in your browser.

## Features

- **Hierarchy Browser**: Navigate through RTL design hierarchy (modules, instances, interfaces)
- **Signal Search**: Find signals by name with fuzzy matching
- **Waveform Viewer**: View signal waveforms with zoom, pan, and time cursors
- **Code Browser**: View Verilog source code with syntax highlighting


## Quick Start

### Prerequisites

- Node.js 18+

### Setup

```bash
cd frontend
npm install
```

### Running

```bash
cd frontend
npm run dev
```

### Demo Mode

Visit http://localhost:5173 to see the demo mode with sample hierarchy and waveforms.

## Development

### Running Tests

```bash
cd frontend
npx playwright test
```

### Building for Production

```bash
cd frontend
npm run build
```

