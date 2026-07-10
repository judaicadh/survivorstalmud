// ---------------------------------------------------------------------------
// Map: CARTO basemap (Leaflet) + provenance journeys loaded from a Google Sheet.
//
// Each ROW in the sheet is one STOP in a book's life. Rows that share a
// `book_id` are grouped into a single journey and connected in order, so the
// map shows how a copy moved and changed hands over time.
//
// Recommended columns (only latitude/longitude are strictly required):
//   book_id   – groups stops of the same physical copy (e.g. "copy-1")
//   sequence  – order of this stop within the journey (1, 2, 3 …)
//   date      – when the book was here / changed hands
//   location  – place name
//   latitude, longitude
//   owner     – who held it at this stop
//   event     – what happened (printed, gifted, sold, donated, inherited …)
//   description, source, url
// ---------------------------------------------------------------------------

(function () {
  const cfg = window.SITE_CONFIG || {};
  const statusEl = document.getElementById("map-status");

  const map = L.map("map").setView(cfg.mapCenter || [50, 9], cfg.mapZoom || 5);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 19,
    }
  ).addTo(map);

  // Colors for distinct journeys (title-page palette).
  const COLORS = ["#b3211a", "#1f6f6b", "#8a5a12", "#2b4a7e", "#6b2d6b", "#3f6d2a"];

  const setStatus = (msg) => {
    if (statusEl) statusEl.textContent = msg;
  };

  function pick(row, names) {
    const keys = Object.keys(row);
    for (const name of names) {
      const k = keys.find((key) => key.trim().toLowerCase() === name);
      if (k && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Numbered pin so the order of a journey is legible on the map.
  function stopIcon(color, label) {
    return L.divIcon({
      className: "stop-pin",
      html:
        '<span class="stop-dot" style="background:' + color + '">' +
        escapeHtml(String(label)) + "</span>",
      iconSize: [26, 26],
      iconAnchor: [13, 13],
      popupAnchor: [0, -14],
    });
  }

  function stopPopup(stop) {
    let html = "";
    const place = stop.location || stop.title;
    if (place) html += "<h3>" + escapeHtml(place) + "</h3>";
    const line2 = [stop.date, stop.event].filter(Boolean).join(" · ");
    if (line2) html += '<div class="meta">' + escapeHtml(line2) + "</div>";
    if (stop.owner) html += "<p><strong>Held by:</strong> " + escapeHtml(stop.owner) + "</p>";
    if (stop.description) html += "<p>" + escapeHtml(stop.description) + "</p>";
    if (stop.source) html += '<div class="meta">Source: ' + escapeHtml(stop.source) + "</div>";
    if (stop.url)
      html += '<div class="meta"><a href="' + encodeURI(stop.url) +
        '" target="_blank" rel="noopener">More &rarr;</a></div>';
    return html;
  }

  function render(rows) {
    // Build journeys keyed by book_id. Rows without a book_id become their
    // own single-stop journey.
    const journeys = new Map();
    let anon = 0;

    rows.forEach((row) => {
      const lat = parseFloat(pick(row, ["latitude", "lat"]));
      const lng = parseFloat(pick(row, ["longitude", "lng", "lon", "long"]));
      if (isNaN(lat) || isNaN(lng)) return;

      const bookId = pick(row, ["book_id", "book", "copy_id", "copy"]) ||
        "__single_" + anon++;

      const stop = {
        lat, lng,
        bookId,
        sequence: parseFloat(pick(row, ["sequence", "order", "step"])),
        date: pick(row, ["date", "year"]),
        location: pick(row, ["location", "place", "title", "name"]),
        title: pick(row, ["title", "name"]),
        owner: pick(row, ["owner", "holder"]),
        event: pick(row, ["event", "action"]),
        description: pick(row, ["description", "notes", "note"]),
        source: pick(row, ["source"]),
        url: pick(row, ["url", "link"]),
      };

      if (!journeys.has(bookId)) journeys.set(bookId, []);
      journeys.get(bookId).push(stop);
    });

    if (journeys.size === 0) {
      setStatus("No valid coordinates found in the sheet.");
      return;
    }

    const all = L.featureGroup().addTo(map);
    const legend = [];
    let colorIdx = 0;
    let stopCount = 0;

    journeys.forEach((stops, bookId) => {
      // Order the stops: by sequence when present, otherwise by date, else input order.
      stops.forEach((s, i) => (s._i = i));
      stops.sort((a, b) => {
        if (!isNaN(a.sequence) && !isNaN(b.sequence)) return a.sequence - b.sequence;
        if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
        return a._i - b._i;
      });

      const color = COLORS[colorIdx++ % COLORS.length];
      const isJourney = stops.length > 1;

      // Draw the movement path.
      if (isJourney) {
        L.polyline(stops.map((s) => [s.lat, s.lng]), {
          color,
          weight: 2.5,
          opacity: 0.85,
          dashArray: "1 8",
          lineCap: "round",
        }).addTo(all);

        const label = stops[0].title || stops[0].location || "";
        legend.push({ color, label });
      }

      stops.forEach((s, idx) => {
        const label = isJourney ? idx + 1 : "•";
        L.marker([s.lat, s.lng], { icon: stopIcon(color, label) })
          .addTo(all)
          .bindPopup(stopPopup(s));
        stopCount++;
      });
    });

    map.fitBounds(all.getBounds().pad(0.25));

    const journeyCount = [...journeys.values()].filter((s) => s.length > 1).length;
    setStatus(
      stopCount + " stop" + (stopCount === 1 ? "" : "s") +
      (journeyCount ? " · " + journeyCount + " book" + (journeyCount === 1 ? "" : "s") + " traced" : "")
    );

    if (legend.length > 1) addLegend(legend);
  }

  function addLegend(items) {
    const ctrl = L.control({ position: "bottomleft" });
    ctrl.onAdd = function () {
      const div = L.DomUtil.create("div", "map-legend");
      div.innerHTML =
        "<strong>Books traced</strong>" +
        items
          .map(
            (it) =>
              '<span class="row"><i style="background:' + it.color + '"></i>' +
              escapeHtml(it.label || "Untitled") + "</span>"
          )
          .join("");
      return div;
    };
    ctrl.addTo(map);
  }

  // Sample provenance until a real published-sheet URL is set: one copy printed
  // in Heidelberg, held in a DP camp, then carried to the US and donated.
  const SAMPLE = [
    { book_id: "copy-1", sequence: 1, date: "1948", location: "Heidelberg", latitude: 49.3988, longitude: 8.6724, owner: "US Army / Rabbinate", event: "printed", title: "Copy 1", description: "One of the sets printed under US Army sponsorship." },
    { book_id: "copy-1", sequence: 2, date: "1949", location: "Munich (DP camp)", latitude: 48.1351, longitude: 11.582, owner: "DP camp study house", event: "held in camp", title: "Copy 1" },
    { book_id: "copy-1", sequence: 3, date: "1950", location: "New York", latitude: 40.7128, longitude: -74.006, owner: "Emigrating survivor", event: "carried abroad", title: "Copy 1" },
    { book_id: "copy-1", sequence: 4, date: "1958", location: "Philadelphia", latitude: 39.9526, longitude: -75.1652, owner: "Congregation library", event: "donated", title: "Copy 1", description: "Given to a synagogue library by the family." },
    { book_id: "copy-2", sequence: 1, date: "1948", location: "Heidelberg", latitude: 49.3988, longitude: 8.6724, owner: "US Army / Rabbinate", event: "printed", title: "Copy 2" },
    { book_id: "copy-2", sequence: 2, date: "1951", location: "Jerusalem", latitude: 31.7683, longitude: 35.2137, owner: "National library", event: "brought to Israel", title: "Copy 2" },
  ];

  const url = cfg.sheetCsvUrl;
  if (!url || url.indexOf("PASTE_YOUR") === 0) {
    setStatus("Showing sample data — add your Google Sheet URL in js/config.js");
    render(SAMPLE);
    return;
  }

  setStatus("Loading from Google Sheet…");
  Papa.parse(url, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: (results) => render(results.data),
    error: (err) => {
      console.error(err);
      setStatus("Could not load the sheet — showing sample data.");
      render(SAMPLE);
    },
  });
})();
