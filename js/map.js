// ---------------------------------------------------------------------------
// Map: CARTO basemap + provenance of the Survivors' Talmud, at scale.
//
// Each ROW in the Google Sheet is one STOP in a copy's life. Design:
//   • One pin PER PLACE (stops at the same coordinates collapse into a single
//     pin). Its popup lists the copies and successive owners tied to that place.
//   • Nearby pins CLUSTER, so hundreds of copies stay legible.
//   • Search / pick a copy to TRACE it — its dotted path is drawn and a panel
//     lists its successive owners in order. Paths are only drawn for that copy.
//
// Columns (only latitude/longitude are strictly required):
//   book_id  sequence  date  location  latitude  longitude  owner  event
//   description  source  url
// ---------------------------------------------------------------------------

(function () {
  const cfg = window.SITE_CONFIG || {};
  const statusEl = document.getElementById("map-status");
  const panelEl = document.getElementById("copy-panel");
  const searchEl = document.getElementById("copy-search");
  const listEl = document.getElementById("copy-list");
  const clearEl = document.getElementById("copy-clear");

  const FOCUS_COLOR = "#b3211a";

  const map = L.map("map").setView(cfg.mapCenter || [40, 0], cfg.mapZoom || 3);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  ).addTo(map);

  const clusters = L.markerClusterGroup({
    maxClusterRadius: 45,
    showCoverageOnHover: false,
  }).addTo(map);

  let focusLayer = null; // polyline for the currently traced copy

  const setStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  function pick(row, names) {
    const keys = Object.keys(row);
    for (const name of names) {
      const k = keys.find((key) => key.trim().toLowerCase() === name);
      if (k && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function placeIcon(count) {
    const size = Math.min(46, 24 + Math.round(Math.log2(count + 1) * 5));
    return L.divIcon({
      className: "place-pin",
      html:
        '<span class="place-dot" style="width:' + size + "px;height:" + size +
        'px">' + count + "</span>",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -size / 2],
    });
  }

  // ----- state built from the sheet -----
  const places = new Map();  // coordKey -> { lat, lng, name, entries[] }
  const copies = new Map();  // bookId   -> ordered stops[]
  let allBounds = null;      // bounds of every place, for (re)fitting

  // The map lives below the fold, so its container often has no size when
  // Leaflet initializes. Recalculate size and refit the first time it is
  // actually visible (and on window resize) so markers land in view.
  function refitToPlaces() {
    map.invalidateSize();
    if (allBounds && allBounds.length && !focusLayer)
      map.fitBounds(allBounds, { padding: [40, 40] });
  }
  const mapEl = document.getElementById("map");
  if (mapEl && "IntersectionObserver" in window) {
    const vis = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) refitToPlaces();
    }, { threshold: 0.05 });
    vis.observe(mapEl);
  }
  window.addEventListener("resize", () => map.invalidateSize());

  function coordKey(lat, lng) {
    return lat.toFixed(4) + "," + lng.toFixed(4);
  }

  function build(rows) {
    let anon = 0;
    rows.forEach((row) => {
      const lat = parseFloat(pick(row, ["latitude", "lat"]));
      const lng = parseFloat(pick(row, ["longitude", "lng", "lon", "long"]));
      if (isNaN(lat) || isNaN(lng)) return;

      const bookId = pick(row, ["book_id", "book", "copy_id", "copy"]) ||
        "__single_" + anon++;
      const stop = {
        lat, lng, bookId,
        sequence: parseFloat(pick(row, ["sequence", "order", "step"])),
        date: pick(row, ["date", "year"]),
        location: pick(row, ["location", "place", "title", "name"]) || "Unknown place",
        owner: pick(row, ["owner", "holder"]),
        event: pick(row, ["event", "action"]),
        description: pick(row, ["description", "notes", "note"]),
        source: pick(row, ["source"]),
        url: pick(row, ["url", "link"]),
      };

      const key = coordKey(lat, lng);
      if (!places.has(key))
        places.set(key, { lat, lng, name: stop.location, entries: [] });
      places.get(key).entries.push(stop);

      if (!copies.has(bookId)) copies.set(bookId, []);
      copies.get(bookId).push(stop);
    });

    // Order each copy's stops.
    copies.forEach((stops) => {
      stops.forEach((s, i) => (s._i = i));
      stops.sort((a, b) => {
        if (!isNaN(a.sequence) && !isNaN(b.sequence)) return a.sequence - b.sequence;
        if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a._i - b._i;
      });
    });
  }

  // Popup for a place: which copies are tied to it, and their owners here.
  function placePopup(place) {
    const realCopies = new Set(
      place.entries.filter((e) => e.bookId.indexOf("__single_") !== 0).map((e) => e.bookId)
    );
    let html = "<h3>" + escapeHtml(place.name) + "</h3>";
    html += '<div class="meta">' + place.entries.length + " record" +
      (place.entries.length === 1 ? "" : "s") +
      (realCopies.size ? " · " + realCopies.size + " cop" + (realCopies.size === 1 ? "y" : "ies") : "") +
      "</div>";
    html += '<div class="place-list">';
    place.entries.slice(0, 60).forEach((e) => {
      const bits = [e.date, e.event].filter(Boolean).join(" · ");
      html += '<div class="place-row">';
      if (e.bookId.indexOf("__single_") !== 0)
        html += '<a href="#" class="copy-link" data-copy="' + escapeHtml(e.bookId) + '">' +
          escapeHtml(e.bookId) + "</a> ";
      if (bits) html += '<span class="meta">' + escapeHtml(bits) + "</span>";
      if (e.owner) html += "<br><strong>" + escapeHtml(e.owner) + "</strong>";
      html += "</div>";
    });
    if (place.entries.length > 60)
      html += '<div class="meta">…and ' + (place.entries.length - 60) + " more</div>";
    html += "</div>";
    return html;
  }

  function render() {
    if (places.size === 0) { setStatus("No valid coordinates found."); return; }

    const bounds = [];
    places.forEach((place) => {
      const copyCount = new Set(place.entries.map((e) => e.bookId)).size;
      const m = L.marker([place.lat, place.lng], { icon: placeIcon(copyCount) })
        .bindPopup(placePopup(place), { maxHeight: 300, minWidth: 220 });
      clusters.addLayer(m);
      bounds.push([place.lat, place.lng]);
    });
    allBounds = bounds;
    if (bounds.length) {
      map.fitBounds(bounds, { padding: [40, 40] });
      // Container may still be unsized at first paint; refit next frame.
      requestAnimationFrame(refitToPlaces);
    }

    // Populate the copy search list (skip anonymous singletons).
    const ids = [...copies.keys()].filter((id) => id.indexOf("__single_") !== 0).sort();
    if (listEl)
      listEl.innerHTML = ids.map((id) => '<option value="' + escapeHtml(id) + '">').join("");

    setStatus(
      places.size + " place" + (places.size === 1 ? "" : "s") + " · " +
      ids.length + " cop" + (ids.length === 1 ? "y" : "ies") + " traced"
    );
  }

  // ----- tracing a single copy -----
  window.focusCopy = function (bookId) {
    const stops = copies.get(bookId);
    if (!stops) return;
    clearFocus(true);

    if (stops.length > 1) {
      focusLayer = L.polyline(stops.map((s) => [s.lat, s.lng]), {
        color: FOCUS_COLOR, weight: 3, opacity: 0.9,
        dashArray: "1 8", lineCap: "round",
      }).addTo(map);
      map.fitBounds(focusLayer.getBounds().pad(0.3));
    } else {
      map.setView([stops[0].lat, stops[0].lng], 6);
    }

    // Chronology panel — successive owners, in order.
    const places_n = new Set(stops.map((s) => coordKey(s.lat, s.lng))).size;
    let html = '<button class="panel-close" id="panel-close" aria-label="Close">&times;</button>';
    html += "<h3>" + escapeHtml(bookId) + "</h3>";
    html += '<div class="meta">' + stops.length + " record" + (stops.length === 1 ? "" : "s") +
      " · " + places_n + " place" + (places_n === 1 ? "" : "s") + "</div>";
    html += '<ol class="chron">';
    stops.forEach((s) => {
      html += "<li>";
      html += '<span class="chron-date">' + (escapeHtml(s.date) || "—") + "</span>";
      html += '<span class="chron-place">' + escapeHtml(s.location) + "</span>";
      const line = [s.event, s.owner].filter(Boolean).map(escapeHtml).join(" — ");
      if (line) html += '<div class="chron-owner">' + line + "</div>";
      if (s.description) html += '<div class="chron-desc">' + escapeHtml(s.description) + "</div>";
      if (s.source) html += '<div class="meta">Source: ' + escapeHtml(s.source) + "</div>";
      html += "</li>";
    });
    html += "</ol>";
    panelEl.innerHTML = html;
    panelEl.hidden = false;
    document.getElementById("panel-close").addEventListener("click", () => clearFocus());

    if (searchEl) searchEl.value = bookId;
    map.closePopup();
  };

  function clearFocus(keepPanel) {
    if (focusLayer) { map.removeLayer(focusLayer); focusLayer = null; }
    if (!keepPanel) {
      panelEl.hidden = true;
      panelEl.innerHTML = "";
      if (searchEl) searchEl.value = "";
    }
  }

  // Copy-link clicks inside place popups.
  document.addEventListener("click", (e) => {
    const link = e.target.closest ? e.target.closest(".copy-link") : null;
    if (link) { e.preventDefault(); window.focusCopy(link.dataset.copy); }
  });
  if (searchEl)
    searchEl.addEventListener("change", () => {
      const v = searchEl.value.trim();
      if (copies.has(v)) window.focusCopy(v);
      else if (!v) clearFocus();
    });
  if (clearEl) clearEl.addEventListener("click", () => clearFocus());

  // ----- sample provenance until a real sheet URL is set -----
  const SAMPLE = [
    { book_id: "copy-1", sequence: 1, date: "1948", location: "Heidelberg", latitude: 49.3988, longitude: 8.6724, owner: "US Army / Rabbinate", event: "printed" },
    { book_id: "copy-1", sequence: 2, date: "1949", location: "Munich (DP camp)", latitude: 48.1351, longitude: 11.582, owner: "DP camp study house", event: "held in camp" },
    { book_id: "copy-1", sequence: 3, date: "1950", location: "New York", latitude: 40.7128, longitude: -74.006, owner: "Emigrating survivor", event: "carried abroad" },
    { book_id: "copy-1", sequence: 4, date: "1958", location: "Philadelphia", latitude: 39.9526, longitude: -75.1652, owner: "Rosenbach family", event: "donated" },
    { book_id: "copy-1", sequence: 5, date: "1979", location: "Philadelphia", latitude: 39.9526, longitude: -75.1652, owner: "University library", event: "acquired", description: "Same city, new owner — one pin, successive owners." },
    { book_id: "copy-2", sequence: 1, date: "1948", location: "Heidelberg", latitude: 49.3988, longitude: 8.6724, owner: "US Army / Rabbinate", event: "printed" },
    { book_id: "copy-2", sequence: 2, date: "1951", location: "Jerusalem", latitude: 31.7683, longitude: 35.2137, owner: "National library", event: "brought to Israel" },
    { book_id: "copy-3", sequence: 1, date: "1948", location: "Heidelberg", latitude: 49.3988, longitude: 8.6724, owner: "US Army / Rabbinate", event: "printed" },
    { book_id: "copy-3", sequence: 2, date: "1949", location: "Frankfurt", latitude: 50.1109, longitude: 8.6821, owner: "Rabbinical seminary", event: "gifted" },
    { book_id: "copy-3", sequence: 3, date: "1952", location: "London", latitude: 51.5074, longitude: -0.1278, owner: "Congregation", event: "carried abroad" },
  ];

  function run(rows) { build(rows); render(); }

  const url = cfg.sheetCsvUrl;
  if (!url || url.indexOf("PASTE_YOUR") === 0) {
    setStatus("Showing sample data — add your Google Sheet URL in js/config.js");
    run(SAMPLE);
    return;
  }

  setStatus("Loading from Google Sheet…");
  Papa.parse(url, {
    download: true, header: true, skipEmptyLines: true,
    complete: (results) => run(results.data),
    error: (err) => {
      console.error(err);
      setStatus("Could not load the sheet — showing sample data.");
      run(SAMPLE);
    },
  });
})();
