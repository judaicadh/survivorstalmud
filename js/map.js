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
  const viewportEl = document.querySelector(".map-viewport");
  const locBtn = document.getElementById("view-locations");
  const jrnBtn = document.getElementById("view-journey");

  let currentCopy = null; // the copy currently traced, if any

  const FOCUS_COLOR = "#b3211a";

  // Switch between "all copies" (every location) and "journey" (one path).
  function setMode(mode) {
    const journey = mode === "journey";
    if (locBtn) {
      locBtn.classList.toggle("active", !journey);
      locBtn.setAttribute("aria-pressed", String(!journey));
    }
    if (jrnBtn) {
      jrnBtn.classList.toggle("active", journey);
      jrnBtn.setAttribute("aria-pressed", String(journey));
    }
    if (viewportEl) viewportEl.classList.toggle("journey-mode", journey);
  }

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
  const places = new Map();   // coordKey -> { lat, lng, name, entries[] }
  const copies = new Map();   // bookId   -> ordered stops[]
  const copyMeta = new Map(); // bookId   -> { holder, callNumber, catalogUrl, … }
  const searchIndex = new Map(); // lower-case label/id -> bookId
  let allBounds = null;       // bounds of every place, for (re)fitting

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
      const meta = copyMeta.get(e.bookId);
      const isCopy = e.bookId.indexOf("__single_") !== 0;
      html += '<div class="place-row">';
      if (e.owner) html += "<strong>" + escapeHtml(e.owner) + "</strong>";
      if (isCopy) html += ' <span class="place-id">' + escapeHtml(e.bookId) + "</span>";
      if (bits) html += '<div class="meta">' + escapeHtml(bits) + "</div>";
      if (isCopy)
        html += '<a href="#" class="copy-link trace-link" data-copy="' + escapeHtml(e.bookId) +
          '">Trace this copy&rsquo;s journey →</a>';
      if (meta && meta.catalogUrl)
        html += '<a class="popup-cat" href="' + escapeHtml(meta.catalogUrl) +
          '" target="_blank" rel="noopener">View in library catalog →</a>';
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

    // Populate the copy search list with human labels ("Library — copy-id"),
    // so it can be found by institution name, not just the cryptic id.
    const ids = [...copies.keys()].filter((id) => id.indexOf("__single_") !== 0).sort();
    searchIndex.clear();
    const options = ids.map((id) => {
      const m = copyMeta.get(id);
      const label = m && m.holder ? m.holder + " — " + id : id;
      searchIndex.set(label.toLowerCase(), id);
      searchIndex.set(id.toLowerCase(), id);
      return '<option value="' + escapeHtml(label) + '"></option>';
    });
    if (listEl) listEl.innerHTML = options.join("");

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
    currentCopy = bookId;
    setMode("journey");

    // Chronology panel — successive owners, in order.
    const places_n = new Set(stops.map((s) => coordKey(s.lat, s.lng))).size;
    const meta = copyMeta.get(bookId);
    let html = '<button class="panel-close" id="panel-close" aria-label="Close">&times;</button>';
    html += "<h3>" + escapeHtml(bookId) + "</h3>";
    if (meta && meta.holder)
      html += '<div class="panel-holder">' + escapeHtml(meta.holder) + "</div>";
    html += '<div class="meta">' + stops.length + " record" + (stops.length === 1 ? "" : "s") +
      " · " + places_n + " place" + (places_n === 1 ? "" : "s") + "</div>";
    if (meta) {
      const bits = [];
      if (meta.volumes) bits.push(escapeHtml(meta.volumes));
      if (meta.condition) bits.push(escapeHtml(meta.condition));
      if (meta.callNumber) bits.push("Call no. " + escapeHtml(meta.callNumber));
      if (bits.length) html += '<div class="panel-facts">' + bits.join(" · ") + "</div>";
      if (meta.catalogUrl)
        html += '<a class="panel-link" href="' + escapeHtml(meta.catalogUrl) +
          '" target="_blank" rel="noopener">View in catalog →</a>';
    }
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

    if (searchEl)
      searchEl.value = meta && meta.holder ? meta.holder + " — " + bookId : bookId;
    map.closePopup();

    // The docked panel just took horizontal space; let the map reflow before
    // fitting the traced path so it stays clear of the panel.
    map.invalidateSize();
    if (stops.length > 1) {
      focusLayer = L.polyline(stops.map((s) => [s.lat, s.lng]), {
        color: FOCUS_COLOR, weight: 3, opacity: 0.9,
        dashArray: "1 8", lineCap: "round",
      }).addTo(map);
      map.fitBounds(focusLayer.getBounds().pad(0.3));
    } else {
      map.setView([stops[0].lat, stops[0].lng], 6);
    }
  };

  function clearFocus(keepPanel) {
    if (focusLayer) { map.removeLayer(focusLayer); focusLayer = null; }
    if (!keepPanel) {
      panelEl.hidden = true;
      panelEl.innerHTML = "";
      if (searchEl) searchEl.value = "";
      currentCopy = null;
      setMode("locations");
      // Panel undocked — let the map reclaim the width and show every copy.
      refitToPlaces();
    }
  }

  // "Journey" with nothing chosen yet: point the eye at the search box.
  function nudgePickCopy() {
    const wrap = document.querySelector(".toolbar-search");
    if (wrap) { wrap.classList.remove("nudge"); void wrap.offsetWidth; wrap.classList.add("nudge"); }
    if (searchEl) searchEl.focus();
  }

  // Copy-link clicks inside place popups.
  document.addEventListener("click", (e) => {
    const link = e.target.closest ? e.target.closest(".copy-link") : null;
    if (link) { e.preventDefault(); window.focusCopy(link.dataset.copy); }
  });
  if (searchEl)
    searchEl.addEventListener("change", () => {
      const v = searchEl.value.trim();
      if (!v) { clearFocus(); return; }
      const id = searchIndex.get(v.toLowerCase()) || (copies.has(v) ? v : null);
      if (id) window.focusCopy(id);
    });
  // View toggle: "All copies" clears any trace; "Journey" re-shows the last one.
  if (locBtn) locBtn.addEventListener("click", () => clearFocus());
  if (jrnBtn)
    jrnBtn.addEventListener("click", () => {
      if (currentCopy) window.focusCopy(currentCopy);
      else nudgePickCopy();
    });

  // ----- load + merge: live copies sheet + local intermediate chains -----
  //
  // The published sheet is one row per copy (current holder + coordinates +
  // catalog metadata) with fixed columns and blank latitude/longitude headers,
  // so it is read positionally. Each copy's journey is synthesized as:
  //   Heidelberg origin  →  intermediate owners (chains.csv)  →  current place.
  const SHEET_COL = {
    id: 1, holder: 2, location: 3, lat: 4, lng: 5, callNumber: 6,
    catalogUrl: 7, pubYear: 8, pubPlace: 9, volumes: 10, condition: 11,
    binding: 12, markings: 13, provenance: 14, sharePublicly: 15, contributor: 16,
  };

  function parseCopies(rows) {
    const list = [];
    rows.forEach((row, i) => {
      if (i === 0 || !Array.isArray(row)) return;      // header row
      const id = (row[SHEET_COL.id] || "").trim();
      if (!id) return;                                 // blank placeholder row
      const lat = parseFloat(row[SHEET_COL.lat]);
      const lng = parseFloat(row[SHEET_COL.lng]);
      const meta = {
        holder: (row[SHEET_COL.holder] || "").trim(),
        location: (row[SHEET_COL.location] || "").trim(),
        lat, lng, hasCoords: !isNaN(lat) && !isNaN(lng),
        callNumber: (row[SHEET_COL.callNumber] || "").trim(),
        catalogUrl: (row[SHEET_COL.catalogUrl] || "").trim(),
        volumes: (row[SHEET_COL.volumes] || "").trim(),
        condition: (row[SHEET_COL.condition] || "").trim(),
        provenance: (row[SHEET_COL.provenance] || "").trim(),
        contributor: (row[SHEET_COL.contributor] || "").trim(),
      };
      copyMeta.set(id, meta);
      list.push({ id, meta });
    });
    return list;
  }

  // Build the flat stop rows the map engine consumes from copies + chains.
  function mergeRows(copyList, chainMap) {
    const o = cfg.origin || {};
    const rows = [];
    copyList.forEach(({ id, meta }) => {
      if (!meta.hasCoords) return;                     // can't be placed yet
      let seq = 1;
      rows.push({
        book_id: id, sequence: seq++, date: o.date || "1948",
        location: o.name || "Heidelberg",
        latitude: o.latitude, longitude: o.longitude,
        owner: o.owner || "Carl Winter Press", event: o.event || "printed",
      });
      (chainMap.get(id) || []).forEach((m) => {
        rows.push({
          book_id: id, sequence: seq++, date: m.date, location: m.location,
          latitude: parseFloat(m.latitude), longitude: parseFloat(m.longitude),
          owner: m.owner, event: m.event, description: m.description,
        });
      });
      rows.push({
        book_id: id, sequence: seq++, date: "",
        location: meta.location || meta.holder,
        latitude: meta.lat, longitude: meta.lng,
        owner: meta.holder, event: "held today",
        description: meta.provenance, source: meta.callNumber,
      });
    });
    return rows;
  }

  function start(copyList, chainRows) {
    const chainMap = new Map();
    (chainRows || []).forEach((m) => {
      const id = (m.copy_id || "").trim();
      if (!id) return;
      if (!chainMap.has(id)) chainMap.set(id, []);
      chainMap.get(id).push(m);
    });
    chainMap.forEach((arr) => arr.sort(
      (a, b) => (parseFloat(a.order) || 0) - (parseFloat(b.order) || 0)));

    build(mergeRows(copyList, chainMap));
    render();
  }

  const copiesUrl = cfg.copiesCsvUrl;
  if (!copiesUrl || copiesUrl.indexOf("PASTE_") === 0) {
    setStatus("Set copiesCsvUrl in js/config.js");
    return;
  }

  setStatus("Loading copies…");
  let copyList = null, chainRows = null;
  const tryStart = () => { if (copyList && chainRows) start(copyList, chainRows); };

  Papa.parse(copiesUrl, {
    download: true, header: false,
    complete: (r) => { copyList = parseCopies(r.data); tryStart(); },
    error: (err) => { console.error(err); setStatus("Could not load the copies sheet."); },
  });
  // Chains are optional enrichment; on failure the map still draws
  // Heidelberg → current for every copy.
  Papa.parse(cfg.chainsCsvUrl || "data/chains.csv", {
    download: true, header: true, skipEmptyLines: true,
    complete: (r) => { chainRows = r.data; tryStart(); },
    error: (err) => { console.error(err); chainRows = []; tryStart(); },
  });
})();
