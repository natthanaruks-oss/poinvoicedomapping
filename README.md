# PO–Invoice–DO Mapping — OCR Item Recheck

Static, browser-only web application for rechecking OCR item content and the matched item name before exporting a validated Excel file.

## Data-handling design

The deployed web application contains **no supplier data, item master, invoice data, OCR result, or sample transaction data**.

When a user imports an Excel file:

- the file is read inside the user's browser;
- the content is held in temporary JavaScript memory only;
- no file content is uploaded to Cloudflare or another server;
- no API, database, cookie, `localStorage`, `sessionStorage`, or IndexedDB is used;
- refreshing or closing the page removes the imported content;
- exporting creates a new Excel file on the user's own device.

Cloudflare Pages only serves the static application files.

## Minimum input columns

The application requires these columns, or a supported equivalent header:

- `Item Description (OCR)`
- `Matched Item Name`

Recommended columns:

- `Invoice No`
- `Supplier Name (OCR)`
- `Supplier Item Code (OCR)`
- `Match Type`
- `Confidence (%)`
- `Character Error Rate`
- `document_id`

Unknown columns are preserved and returned in the exported workbook.

## Export columns added

- `Review Status`
- `Review Note`
- `Reviewed At`
- `Changed Fields`

## Application structure

- `index.html` — browser-only application logic; no business data is embedded
- `styles.css` — application styling using system fonts only
- `vendor/` — local React, ReactDOM, and SheetJS libraries
- `_headers` — Cloudflare security headers, including `connect-src 'none'`

No server, database, package installation, environment variable, or build process is required.

## Run locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## Cloudflare Pages settings

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `/`
- Root directory: leave blank
