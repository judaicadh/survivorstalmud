# Tracing the Survivors' Talmud

A static website mapping the printing and circulation of the **Survivors' Talmud**
(*Talmud She'erit Hapletah*), the edition of the Babylonian Talmud printed by
Holocaust survivors in the Displaced Persons camps of occupied Germany, 1948–1950.

## Pages

- **Map** (`index.html`) — CARTO basemap with points loaded live from a Google Sheet.
- **Bibliography** (`bibliography.html`) — sources and archives.
- **About** (`about.html`) — project background and data instructions.

## How it works

No build step, no server, no database. Pure HTML/CSS/JS using
[Leaflet](https://leafletjs.com/), the [CARTO](https://carto.com/) Positron
basemap, and [PapaParse](https://www.papaparse.com/) to read a published
Google Sheet CSV at page load.

## Connecting your Google Sheet

1. Create a Google Sheet with these column headers (only latitude/longitude required):

   | title | latitude | longitude | date | description | source | url |
   |-------|----------|-----------|------|-------------|--------|-----|

2. In Google Sheets: **File → Share → Publish to web → (select the sheet) →
   Comma-separated values (.csv) → Publish**.
3. Copy the published `.csv` link.
4. Paste it into `js/config.js` as `sheetCsvUrl`.

Editing the sheet then updates the map automatically — no code changes, no redeploy.

## Running locally

Because the pages fetch a remote CSV, open them through a local server rather than
`file://`:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying (GitHub Pages)

Push to GitHub, then in the repo: **Settings → Pages → Deploy from a branch →
`main` / root**. The site is served as-is.
