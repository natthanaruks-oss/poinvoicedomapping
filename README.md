# PO–Invoice–DO Mapping

Static web application for validating and mapping item descriptions across Purchase Orders, Invoices, and Delivery Orders.

## Application structure

- `index.html` — application logic, with a built-in fallback supplier/item mapping master
- `styles.css` — application styling
- `vendor/` — local React, ReactDOM, Babel, and SheetJS libraries
- `supplier_item_master.xlsx` — the live Supplier Master data file. The app fetches this file by
  this exact name on every page load and uses it instead of the built-in fallback when present.
  **Replace this file whenever IT/procurement updates the real Supplier Master spreadsheet** — no
  code change or redeploy of `index.html` needed, just overwrite this file with the new one
  (columns: `Supplier Name`, `Supplier Item Code`, `Supplier Item Name`, `Supplier Item UOM` — the
  last one is optional and may be entirely absent from the file for now). Only takes effect when
  served over http(s) (see below) — a plain `file://` open falls back to the built-in copy in
  `index.html` instead.

No server, database, package installation, or build process is required.

## Run locally

Opening `index.html` directly may work, but a local HTTP server is recommended.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Deploy with Cloudflare Pages (Git integration)

1. Push this folder to a GitHub repository.
2. In Cloudflare Dashboard, select **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Select the GitHub repository.
4. Use these build settings:
   - Framework preset: `None`
   - Build command: leave blank
   - Build output directory: `/`
5. Deploy.

## Deploy with Cloudflare Direct Upload

Upload the contents of this repository or upload the prepared ZIP through Cloudflare Pages Direct Upload.

## Data and security notice

The supplier/item mapping master lives in `supplier_item_master.xlsx` (fetched live on each page load) with a built-in fallback copy embedded in `index.html` for when that file isn't reachable. Anyone who can access the deployed site can download `supplier_item_master.xlsx` directly or inspect the embedded fallback data in the browser source.

For internal use, protect the Cloudflare Pages site with Cloudflare Access and restrict access to approved users or company email domains.

Do not commit source Excel workbooks, internal notes, `.claude` configuration, credentials, or confidential business files. The included `.gitignore` blocks common source-data formats by default.
