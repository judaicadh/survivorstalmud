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
  // Data source. Points at the local provenance file built from the survey.
  // To edit provenance live from a Google Sheet instead, publish it to CSV
  // (File > Share > Publish to web > CSV) and paste that URL here.
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/e/2PACX-1vR30JgaqrE-R1eZxPEh8YKIcuuKBO8_CotQqJpwERr1HvejryWwRaPOpis7l6clEwNsaj6jDIysmV9m/pub?output=csv",

  // Initial map view [latitude, longitude] and zoom.
  mapCenter: [40.0, -20.0],
  mapZoom: 3,
};
