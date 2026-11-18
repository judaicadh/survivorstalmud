// ---------------------------------------------------------------------------
// Per-copy detail page.
//
// Reads a copy_id from the URL (copy.html?id=jts-1), loads the same published
// copies sheet + local chains.csv that the map uses, and renders one copy's
// full record: catalog facts, provenance, its journey (Heidelberg → owners →
// current holder) as a timeline and a small map, and — connected from the
// sheet's `correspondence` column — the related letter / document.
// ---------------------------------------------------------------------------

(function () {
  const cfg = window.SITE_CONFIG || {};
  const rootEl = document.getElementById("copy-root");

  // Column order of the published copies sheet (read positionally, matching
  // js/map.js). `correspondence` is the scanned letter / document for a copy.
  const SHEET_COL = {
    id: 1, holder: 2, location: 3, lat: 4, lng: 5, callNumber: 6,
    catalogUrl: 7, pubYear: 8, pubPlace: 9, volumes: 10, condition: 11,
    binding: 12, markings: 13, provenance: 14, sharePublicly: 15,
    contributor: 16, correspondence: 17,
  };

  const copyId = (new URLSearchParams(location.search).get("id") || "").trim();

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // "1545 West University Ave, Gainesville, FL 32611" -> "Gainesville, FL"
  function shortPlace(name) {
    if (!name) return name;
    let parts = name.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1 && /^\d/.test(parts[0])) parts.shift();
    parts = parts.map((p) => p.replace(/\s+\d{4,6}(-\d{3,4})?$/, "").trim());
    return parts.filter(Boolean).join(", ") || name;
  }

  function cell(row, idx) {
    return (row[idx] || "").toString().trim();
  }

  function render(meta, stops) {
    const title = meta.holder || copyId;
    document.title = title + " — Survivors' Talmud";

    let html = "";
    html += '<p class="copy-id-tag">' + escapeHtml(copyId) + "</p>";
    html += "<h1>" + escapeHtml(title) + "</h1>";
    if (meta.location)
      html += "<p class=\"copy-subtitle\">" + escapeHtml(shortPlace(meta.location)) + "</p>";

    // ----- catalog facts -----
    const facts = [
      ["Current location", meta.location && shortPlace(meta.location)],
      ["Call number", meta.callNumber],
      ["Published", [meta.pubYear, meta.pubPlace].filter(Boolean).join(", ")],
      ["Volumes held", meta.volumes],
      ["Condition", meta.condition],
      ["Original binding", meta.binding],
      ["Markings", meta.markings],
      ["Contributor", meta.contributor],
    ].filter((f) => f[1]);

    if (facts.length) {
      html += '<dl class="copy-facts">';
      facts.forEach((f) => {
        html += "<div><dt>" + escapeHtml(f[0]) + "</dt><dd>" +
          escapeHtml(f[1]) + "</dd></div>";
      });
      html += "</dl>";
    }

    if (meta.provenance) {
      html += "<h2>Provenance</h2>";
      html += "<p>" + escapeHtml(meta.provenance) + "</p>";
    }

    // ----- correspondence: the related letter / document -----
    if (meta.correspondence) {
      let host = "";
      try { host = new URL(meta.correspondence).hostname.replace(/^www\./, ""); }
      catch (e) { host = ""; }
      html += "<h2>Related correspondence</h2>";
      html += '<p class="copy-corr-note">A letter or archival document connected ' +
        "to this copy.</p>";
      html += '<a class="copy-corr-card" href="' + escapeHtml(meta.correspondence) +
        '" target="_blank" rel="noopener">';
      html += '<span class="copy-corr-icon" aria-hidden="true">&#9993;</span>';
      html += '<span class="copy-corr-text">';
      html += '<span class="copy-corr-title">View the letter</span>';
      if (host) html += '<span class="copy-corr-host">' + escapeHtml(host) + "</span>";
      html += "</span>";
      html += '<span class="copy-corr-go" aria-hidden="true">&rarr;</span>';
      html += "</a>";
    }

    // ----- journey timeline -----
    if (stops.length) {
      const placesN = new Set(stops.map((s) => s.lat.toFixed(4) + "," + s.lng.toFixed(4))).size;
      html += "<h2>Journey</h2>";
      html += '<p class="copy-journey-meta">' + stops.length + " record" +
        (stops.length === 1 ? "" : "s") + " · " + placesN + " place" +
        (placesN === 1 ? "" : "s") + "</p>";
      html += '<div id="copy-map" class="copy-map"></div>';
      html += '<ol class="chron copy-chron">';
      stops.forEach((s) => {
        html += "<li>";
        html += '<span class="chron-date">' + (escapeHtml(s.date) || "&mdash;") + "</span>";
        html += '<span class="chron-place">' + escapeHtml(shortPlace(s.location)) + "</span>";
        const line = [s.event, s.owner].filter(Boolean).map(escapeHtml).join(" — ");
        if (line) html += '<div class="chron-owner">' + line + "</div>";
        if (s.description) html += '<div class="chron-desc">' + escapeHtml(s.description) + "</div>";
        if (s.source) html += '<div class="meta">Source: ' + escapeHtml(s.source) + "</div>";
        html += "</li>";
      });
      html += "</ol>";
    }

    if (meta.catalogUrl)
      html += '<p class="copy-catalog"><a href="' + escapeHtml(meta.catalogUrl) +
        '" target="_blank" rel="noopener">View in library catalog &rarr;</a></p>';

    rootEl.innerHTML = html;

    // Draw the journey map once the container exists in the DOM.
    if (stops.length) drawMap(stops);
  }

  function drawMap(stops) {
    const el = document.getElementById("copy-map");
    if (!el || typeof L === "undefined") return;
    const basemap = cfg.basemap || {};
    let tileUrl = basemap.url ||
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
    if (basemap.apiKey)
      tileUrl += (tileUrl.indexOf("?") === -1 ? "?" : "&") +
        "key=" + encodeURIComponent(basemap.apiKey);

    const latlngs = stops.map((s) => [s.lat, s.lng]);
    const map = L.map(el, { scrollWheelZoom: false });
    L.tileLayer(tileUrl, {
      attribution: basemap.attribution ||
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd", maxZoom: 19,
    }).addTo(map);

    if (latlngs.length > 1)
      L.polyline(latlngs, {
        color: "#b3211a", weight: 3, opacity: 0.9,
        dashArray: "1 8", lineCap: "round",
      }).addTo(map);
    latlngs.forEach((ll) =>
      L.circleMarker(ll, {
        radius: 6, color: "#fff", weight: 2,
        fillColor: "#b3211a", fillOpacity: 1,
      }).addTo(map));

    if (latlngs.length > 1) map.fitBounds(L.latLngBounds(latlngs).pad(0.3));
    else map.setView(latlngs[0], 6);
    setTimeout(() => map.invalidateSize(), 60);
  }

  function showError(msg) {
    rootEl.innerHTML = '<h1>Copy not found</h1><p class="copy-subtitle">' +
      escapeHtml(msg) + '</p><p><a href="copies.html">&larr; Browse all copies</a></p>';
  }

  if (!copyId) {
    showError("No copy was specified. Choose one from the list of copies.");
    return;
  }

  // Build the ordered journey for this copy: Heidelberg origin → intermediate
  // owners from chains.csv → the current holder's location.
  function buildStops(meta, chainRows) {
    const o = cfg.origin || {};
    const stops = [];
    stops.push({
      date: o.date || "1948", location: o.name || "Heidelberg",
      lat: o.latitude, lng: o.longitude,
      owner: o.owner || "Carl Winter Press", event: o.event || "printed",
    });
    (chainRows || [])
      .filter((m) => (m.copy_id || "").trim() === copyId)
      .sort((a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0))
      .forEach((m) => {
        const lat = parseFloat(m.latitude), lng = parseFloat(m.longitude);
        if (isNaN(lat) || isNaN(lng)) return;
        stops.push({
          date: (m.date || "").trim(), location: (m.location || "").trim(),
          lat, lng, owner: (m.owner || "").trim(), event: (m.event || "").trim(),
          description: (m.description || "").trim(),
        });
      });
    if (meta.hasCoords)
      stops.push({
        date: "", location: meta.location || meta.holder,
        lat: meta.lat, lng: meta.lng, owner: meta.holder, event: "held today",
        description: meta.provenance, source: meta.callNumber,
      });
    return stops;
  }

  const copiesUrl = cfg.copiesCsvUrl;
  if (!copiesUrl) { showError("The copies data source is not configured."); return; }

  let meta = null, chainRows = null, parsed = false;
  function tryRender() {
    if (meta === null || chainRows === null || parsed) return;
    parsed = true;
    if (!meta) { showError("No copy with id “" + copyId + "” was found."); return; }
    render(meta, buildStops(meta, chainRows));
  }

  Papa.parse(copiesUrl, {
    download: true, header: false,
    complete: (r) => {
      let found = false;
      (r.data || []).forEach((row, i) => {
        if (i === 0 || !Array.isArray(row) || found) return;
        if (cell(row, SHEET_COL.id) !== copyId) return;
        found = true;
        const lat = parseFloat(row[SHEET_COL.lat]);
        const lng = parseFloat(row[SHEET_COL.lng]);
        meta = {
          holder: cell(row, SHEET_COL.holder),
          location: cell(row, SHEET_COL.location),
          lat, lng, hasCoords: !isNaN(lat) && !isNaN(lng),
          callNumber: cell(row, SHEET_COL.callNumber),
          catalogUrl: cell(row, SHEET_COL.catalogUrl),
          pubYear: cell(row, SHEET_COL.pubYear),
          pubPlace: cell(row, SHEET_COL.pubPlace),
          volumes: cell(row, SHEET_COL.volumes),
          condition: cell(row, SHEET_COL.condition),
          binding: cell(row, SHEET_COL.binding),
          markings: cell(row, SHEET_COL.markings),
          provenance: cell(row, SHEET_COL.provenance),
          contributor: cell(row, SHEET_COL.contributor),
          correspondence: cell(row, SHEET_COL.correspondence),
        };
      });
      if (!found) meta = false;    // distinguish "not found" from "not loaded yet"
      tryRender();
    },
    error: () => showError("The copies sheet could not be loaded."),
  });

  Papa.parse(cfg.chainsCsvUrl || "data/chains.csv", {
    download: true, header: true, skipEmptyLines: true,
    complete: (r) => { chainRows = r.data || []; tryRender(); },
    error: () => { chainRows = []; tryRender(); },
  });
})();
