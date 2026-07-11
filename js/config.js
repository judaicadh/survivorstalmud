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
  // LIVE copies archive (published Google Sheet CSV). One row per copy:
  // current holder, location, coordinates, and catalog metadata. Editing the
  // sheet updates the map on the next load — no code change needed.
  copiesCsvUrl:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vR30JgaqrE-R1eZxPEh8YKIcuuKBO8_CotQqJpwERr1HvejryWwRaPOpis7l6clEwNsaj6jDIysmV9m/pub?output=csv",

  // Intermediate historical owners between the Heidelberg origin and the
  // current location, keyed by copy_id (local file). Optional enrichment —
  // copies without a chain simply show Heidelberg → current.
  chainsCsvUrl: "data/chains.csv",

  // Every copy begins here: the Carl Winter press in Heidelberg, 1948.
  origin: {
    name: "Heidelberg", latitude: 49.3988, longitude: 8.6724,
    date: "1948", owner: "Carl Winter Press", event: "printed",
  },

  // Initial map view [latitude, longitude] and zoom.
  mapCenter: [40.0, -20.0],
  mapZoom: 3,
};
