# Deployment Guide

## GitHub

```bash
git init
git add .
git commit -m "Deploy browser-only OCR item recheck app"
git branch -M main
git remote add origin https://github.com/<account>/<repository>.git
git push -u origin main
```

## Cloudflare Pages — Git integration

1. Open **Cloudflare Dashboard**.
2. Select **Workers & Pages**.
3. Create a **Pages** project and connect the GitHub repository.
4. Configure:
   - Framework preset: `None`
   - Build command: blank
   - Build output directory: `/`
   - Root directory: blank
   - Production branch: `main`
5. Deploy.

## Cloudflare Pages — Direct Upload

Upload this ZIP, or upload all files with `index.html` at the package root.

## Data and security controls

- No business data is included in the deployed source.
- No imported data is sent to Cloudflare.
- Browser storage APIs are not used.
- The Content Security Policy blocks all network connections from application code with `connect-src 'none'`.
- Google Fonts and other third-party runtime resources are not used.
- Refreshing or closing the page clears the working data.

Cloudflare Access can still be enabled to restrict who may open the tool, even though the tool itself does not store or transmit imported data.

## Post-deployment checks

1. Open the deployed URL and confirm the page starts empty.
2. Import a test Excel file containing `Item Description (OCR)` and `Matched Item Name`.
3. Edit an OCR field and a matched item name.
4. Confirm a row and export the workbook.
5. Verify `Review Status`, `Review Note`, `Reviewed At`, and `Changed Fields`.
6. Refresh the web page and confirm imported records disappear.
7. In browser developer tools, verify no network request occurs during import, edit, or export.
