// ---------------------------------------------------------------------------
// Copies index: one card per copy of the Survivors' Talmud, each linking to
// its own page (copy.html?id=…). Reads the same published sheet as the map.
// ---------------------------------------------------------------------------

(function () {
  const cfg = window.SITE_CONFIG || {};
  const listEl = document.getElementById("copies-list");
  const countEl = document.getElementById("copies-count");
  const filterEl = document.getElementById("copies-filter");

  const SHEET_COL = {
    id: 1, holder: 2, location: 3, lat: 4, lng: 5, callNumber: 6,
    catalogUrl: 7, pubYear: 8, pubPlace: 9, volumes: 10, condition: 11,
    binding: 12, markings: 13, provenance: 14, sharePublicly: 15,
    contributor: 16, correspondence: 17,
  };

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }
  function shortPlace(name) {
    if (!name) return name;
    let parts = name.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1 && /^\d/.test(parts[0])) parts.shift();
    parts = parts.map((p) => p.replace(/\s+\d{4,6}(-\d{3,4})?$/, "").trim());
    return parts.filter(Boolean).join(", ") || name;
  }
  const cell = (row, idx) => (row[idx] || "").toString().trim();

  let copies = [];

  function cardHtml(c) {
    let h = '<li class="copy-card" data-search="' +
      escapeHtml((c.holder + " " + c.place + " " + c.id).toLowerCase()) + '">';
    h += '<a href="copy.html?id=' + encodeURIComponent(c.id) + '">';
    h += '<span class="copy-card-name">' + escapeHtml(c.holder || c.id) + "</span>";
    if (c.place)
      h += '<span class="copy-card-place">' + escapeHtml(c.place) + "</span>";
    h += '<span class="copy-card-foot">';
    h += '<span class="copy-card-id">' + escapeHtml(c.id) + "</span>";
    if (c.hasCorr)
      h += '<span class="copy-card-badge" title="Related correspondence">&#9993; document</span>';
    h += "</span>";
    h += "</a></li>";
    return h;
  }

  function paint(items) {
    if (!items.length) {
      listEl.innerHTML = '<li class="copies-loading">No copies match your filter.</li>';
      return;
    }
    listEl.innerHTML = items.map(cardHtml).join("");
  }

  function applyFilter() {
    const q = (filterEl.value || "").trim().toLowerCase();
    const items = q
      ? copies.filter((c) => (c.holder + " " + c.place + " " + c.id).toLowerCase().indexOf(q) !== -1)
      : copies;
    paint(items);
    if (countEl)
      countEl.textContent = q
        ? items.length + " of " + copies.length + " copies"
        : copies.length + " copies";
  }

  const copiesUrl = cfg.copiesCsvUrl;
  if (!copiesUrl) {
    listEl.innerHTML = '<li class="copies-loading">The copies data source is not configured.</li>';
    return;
  }

  Papa.parse(copiesUrl, {
    download: true, header: false,
    complete: (r) => {
      (r.data || []).forEach((row, i) => {
        if (i === 0 || !Array.isArray(row)) return;
        const id = cell(row, SHEET_COL.id);
        if (!id) return;
        copies.push({
          id,
          holder: cell(row, SHEET_COL.holder),
          place: shortPlace(cell(row, SHEET_COL.location)),
          hasCorr: !!cell(row, SHEET_COL.correspondence),
        });
      });
      copies.sort((a, b) =>
        (a.holder || a.id).localeCompare(b.holder || b.id, undefined, { sensitivity: "base" }));
      applyFilter();
    },
    error: () => {
      listEl.innerHTML = '<li class="copies-loading">The copies sheet could not be loaded.</li>';
    },
  });

  if (filterEl) filterEl.addEventListener("input", applyFilter);
})();
