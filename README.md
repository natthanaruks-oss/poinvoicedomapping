# PO–Invoice–DO Mapping

Static web application for validating and mapping item descriptions across Purchase Orders, Invoices, and Delivery Orders.

## Application structure

- `index.html` — application logic and embedded supplier/item mapping master
- `styles.css` — application styling
- `vendor/` — local React, ReactDOM, Babel, and SheetJS libraries

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

The supplier/item mapping master is embedded in `index.html` so the application can work entirely in the browser. Anyone who can access the deployed site can inspect this embedded data in the browser source.

For internal use, protect the Cloudflare Pages site with Cloudflare Access and restrict access to approved users or company email domains.

Do not commit source Excel workbooks, internal notes, `.claude` configuration, credentials, or confidential business files. The included `.gitignore` blocks common source-data formats by default.
