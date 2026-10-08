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

// CARTO platform API key. It ships in client-side source (visible in the
// page), so it is protected by the domain restriction set on it in CARTO.
const CARTO_API_KEY = "cb1_26sc_5_c09560796d59c3aaa7e9b0d9";

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

  // Basemap tiles. `url` keeps the {z}/{x}/{y} placeholders; if you have an
  // authenticated CARTO tile URL from your dashboard, paste it here. When
  // `apiKey` is set it is appended as CARTO's ?api_key= parameter.
  // NOTE: this key ships in client-side code (it is visible in page source);
  // it is protected by the domain restriction set on it in CARTO.
  basemap: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    apiKey: CARTO_API_KEY,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },

  // Initial map view [latitude, longitude] and zoom.
  mapCenter: [40.0, -20.0],
  mapZoom: 3,
};
