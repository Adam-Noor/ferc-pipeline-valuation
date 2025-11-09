# Pipeline Valuation — Minimal Web Explorer

This is a tiny local web app to explore the `ferc6_xblr.sqlite` database.

Quick start (Windows PowerShell):

```powershell
# 1) install dependencies
npm install

# 2) start server
npm start

# 3) open http://localhost:3000 in your browser
```

Notes:
- The app serves `public/` and exposes simple APIs under `/api` to list tables and fetch rows.
- Custom SQL via the UI is intentionally limited and read-only (basic safety checks).
- If the server reports it cannot open the DB, ensure `ferc6_xblr.sqlite` is in the project root.

Next steps (optional):
- Add pagination, column sorting, and export CSV.
- Add a small set of prepared queries per the roadmap PDF.
