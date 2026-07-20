# Australia Post 4-State Barcode Generator

A browser-based generator for Australia Post 4-State Customer Barcodes. Enter an eight-digit Delivery Point Identifier (DPID) to generate a 37-, 52-, or 67-bar barcode in real time and save it as a high-resolution PNG.

Everything runs locally in the browser. The application does not require a server, database, account, or cloud service.

## Features

- Accepts eight-digit numeric DPIDs
- Supports FCC 11, 59, and 62 barcode formats
- Generates 37-, 52-, and 67-bar customer barcodes
- Supports Numeric, Character, and direct `0–3` bar-state customer information encoding
- Calculates check bars using GF(64) Reed-Solomon error correction
- Draws the H, A, D, and T bar states on a high-resolution canvas
- Exports PNG files with 6 mm horizontal and 2 mm vertical quiet zones
- Explains the encoded fields, Reed-Solomon process, and print dimensions
- Provides Australian English, Simplified Chinese, and Japanese interfaces
- Uses Australian English by default and remembers the selected language locally

## Requirements

- Node.js 22.13 or later
- npm

## Local development

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

## Build and preview

Create and preview the static production build:

```bash
npm run build
npm run preview
```

The production files are written to `dist/` and can be hosted by any static file server.

## Tests

Run the complete build and test suite:

```bash
npm test
```

The tests include verified reference samples. For example, DPID `39549554` must encode to:

```text
1301011030121130121211331210131132213
```

## Important usage note

This tool does not confirm whether a DPID exists. Valid DPIDs for production mail should be obtained from the Australia Post Postal Address File using AMAS-certified address-matching software.

The generated image contains correctly encoded barcode data, but the final mailpiece must still comply with all applicable Australia Post requirements for barcode dimensions, contrast, placement, paper, and print quality.
