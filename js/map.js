// ---------------------------------------------------------------------------
// Map: CARTO basemap (Leaflet) + points loaded live from a Google Sheet CSV.
// ---------------------------------------------------------------------------

(function () {
  const cfg = window.SITE_CONFIG || {};
  const statusEl = document.getElementById("map-status");

  const map = L.map("map").setView(cfg.mapCenter || [50, 9], cfg.mapZoom || 5);

  // CARTO Positron (light) baselayer.
  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  ).addTo(map);

  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg;
  };

  // Case-insensitive lookup so "Latitude", "LAT", etc. all work.
  function pick(row, names) {
    const keys = Object.keys(row);
    for (const name of names) {
      const k = keys.find((key) => key.trim().toLowerCase() === name);
      if (k && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  }

  function addMarkers(rows) {
    const group = L.featureGroup();
    let count = 0;

    rows.forEach((row) => {
      const lat = parseFloat(pick(row, ["latitude", "lat"]));
      const lng = parseFloat(pick(row, ["longitude", "lng", "lon", "long"]));
      if (isNaN(lat) || isNaN(lng)) return;

      const title = pick(row, ["title", "name", "place"]) || "Untitled";
      const date = pick(row, ["date", "year"]);
      const desc = pick(row, ["description", "notes", "note"]);
      const source = pick(row, ["source"]);
      const url = pick(row, ["url", "link"]);

      let html = `<h3>${escapeHtml(title)}</h3>`;
      if (date) html += `<div class="meta">${escapeHtml(date)}</div>`;
      if (desc) html += `<p>${escapeHtml(desc)}</p>`;
      if (source) html += `<div class="meta">Source: ${escapeHtml(source)}</div>`;
      if (url)
        html += `<div class="meta"><a href="${encodeURI(url)}" target="_blank" rel="noopener">More &rarr;</a></div>`;

      L.marker([lat, lng]).addTo(group).bindPopup(html);
      count++;
    });

    group.addTo(map);
    if (count > 0) {
      map.fitBounds(group.getBounds().pad(0.2));
      setStatus(`${count} location${count === 1 ? "" : "s"} mapped`);
    } else {
      setStatus("No valid coordinates found in the sheet.");
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  // Sample points shown until you paste a real published-sheet URL.
  const SAMPLE = [
    { title: "Heidelberg (US Army printing)", latitude: 49.3988, longitude: 8.6724, date: "1948", description: "US Army-sponsored printing of the Talmud for survivors in the American occupation zone." },
    { title: "Munich", latitude: 48.1351, longitude: 11.582, date: "1948-1950", description: "Center of the She'erit Hapletah (surviving remnant) publishing effort." },
  ];

  const url = cfg.sheetCsvUrl;
  if (!url || url.indexOf("PASTE_YOUR") === 0) {
    setStatus("Showing sample data — add your Google Sheet URL in js/config.js");
    addMarkers(SAMPLE);
    return;
  }

  setStatus("Loading from Google Sheet…");
  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => addMarkers(results.data),
    error: (err) => {
      console.error(err);
      setStatus("Could not load the sheet — showing sample data.");
      addMarkers(SAMPLE);
    },
  });
})();
