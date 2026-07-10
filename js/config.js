// ---------------------------------------------------------------------------
// Site configuration
// ---------------------------------------------------------------------------
// To connect your Google Sheet:
//   1. In Google Sheets, use column headers exactly like:
//        title | latitude | longitude | date | description | source | url
//      (only `latitude` and `longitude` are strictly required)
//   2. File > Share > Publish to web > choose the sheet > "Comma-separated
//      values (.csv)" > Publish.
//   3. Paste the published CSV link below.
//
// The map reads the sheet live on every page load, so editing the sheet
// updates the map with no code changes and no rebuild.
// ---------------------------------------------------------------------------

window.SITE_CONFIG = {
  // Published Google Sheet CSV URL. Leave as-is to see the sample fallback.
  sheetCsvUrl: "PASTE_YOUR_PUBLISHED_CSV_URL_HERE",

  // Initial map view [latitude, longitude] and zoom.
  mapCenter: [50.0, 9.0],
  mapZoom: 5,
};
