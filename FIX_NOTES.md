# Production Fix

## Issue
The first import worked, but refreshing or reopening the same tab could show a blank page.

## Changes
- Removed transaction-row persistence from `sessionStorage`.
- Clears legacy `imv_validation_state` left by older deployments.
- Added a React error recovery screen instead of a white page.
- Disabled caching for `/`, `index.html`, and `supplier_item_master.xlsx`.

## Expected behavior
- Opening or refreshing the site always starts with an empty transaction list.
- Users must re-import the OCR/validation workbook after a refresh.
- Supplier Master continues to load from `supplier_item_master.xlsx`.
