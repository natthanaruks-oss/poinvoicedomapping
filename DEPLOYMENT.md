# Deployment Guide

## A. Upload to GitHub using the website

1. Create a new repository named `Po-invoice-Do-Mapping`.
2. Extract the deployment ZIP.
3. Upload all extracted files and folders to the repository root.
4. Confirm that `index.html` is visible at the repository root, not inside another nested folder.
5. Commit the files to the default branch.

## B. Upload to GitHub using Git

Run the following commands from the extracted project folder:

```bash
git init
git add .
git commit -m "Initial deployment of PO-Invoice-DO Mapping"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/Po-invoice-Do-Mapping.git
git push -u origin main
```

Replace `YOUR-USERNAME` with the GitHub account name.

## C. Deploy from GitHub to Cloudflare Pages

Use these project settings:

- Production branch: `main`
- Framework preset: `None`
- Build command: leave blank
- Build output directory: `/`
- Root directory: leave blank
- Environment variables: none required

After deployment, open the Cloudflare Pages URL and test:

1. The main table loads.
2. An Excel file can be imported.
3. Supplier and item mapping selections work.
4. The validated Excel file can be exported.

## D. Cloudflare Direct Upload

The deployment ZIP places `index.html` at the ZIP root and can be used as a static deployment package. No build command or dependency installation is required.

## E. Internal-access control

The mapping master is embedded in the browser application. For internal company use, configure Cloudflare Access so only approved users can open the site.
