// ---------------------------------------------------------------------------
// The 1951 recipients list.
//
// Reads the "Full set of Shas" tab of the published workbook (a separate tab
// from the copies sheet) and renders the institutions and individuals the JDC
// letter recorded as receiving a complete set, with location and — where a set
// has since been located — a status note. Live, like the rest of the site.
// ---------------------------------------------------------------------------

(function () {
  const cfg = window.SITE_CONFIG || {};
  const rootEl = document.getElementById("r51-root");
  const countEl = document.getElementById("r51-count");
  const filterEl = document.getElementById("r51-filter");

  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // Read a value from a parsed-with-header row by any of several header spellings.
  function field(row, names) {
    const keys = Object.keys(row);
    for (const name of names) {
      const k = keys.find((key) => key.trim().toLowerCase() === name);
      if (k && String(row[k]).trim() !== "") return String(row[k]).trim();
    }
    return "";
  }

  // Classify the free-text "Still has set?" note into a status, so the list
  // can be scanned at a glance. (The underlying sheet keeps the full wording.)
  function statusClass(note) {
    const s = note.toLowerCase();
    if (!s) return "";
    if (s.indexOf("now at") !== -1 || s.indexOf("on loan") !== -1) return "r51-moved";
    if (s.indexOf("yes") !== -1 || s.indexOf("on spreadsheet") !== -1 ||
        s.indexOf("on spreedsheet") !== -1 || s.indexOf("archive") !== -1) return "r51-kept";
    return "r51-note";
  }

  let recipients = [];

  function rowHtml(r) {
    const cls = statusClass(r.status);
    let h = '<li class="r51-row" data-search="' +
      escapeHtml((r.name + " " + r.place + " " + r.status).toLowerCase()) + '">';
    h += '<span class="r51-name">' + escapeHtml(r.name) + "</span>";
    h += '<span class="r51-place">' + (escapeHtml(r.place) || "&mdash;") + "</span>";
    h += '<span class="r51-status">';
    if (r.status)
      h += '<span class="r51-chip ' + cls + '">' + escapeHtml(r.status) + "</span>";
    const links = [];
    if (r.catalog)
      links.push('<a href="' + escapeHtml(r.catalog) + '" target="_blank" rel="noopener">Catalog &rarr;</a>');
    if (r.jdc)
      links.push('<a href="' + escapeHtml(r.jdc) + '" target="_blank" rel="noopener">JDC letter &rarr;</a>');
    if (links.length) h += '<span class="r51-links">' + links.join("") + "</span>";
    h += "</span>";
    h += "</li>";
    return h;
  }

  function paint(items) {
    if (!items.length) {
      rootEl.innerHTML = '<p class="copies-loading">No recipients match your filter.</p>';
      return;
    }
    let h = '<ol class="r51-list">';
    h += '<li class="r51-head"><span>Recipient</span><span>Location</span>' +
      "<span>Status &amp; sources</span></li>";
    h += items.map(rowHtml).join("");
    h += "</ol>";
    rootEl.innerHTML = h;
  }

  function applyFilter() {
    const q = (filterEl.value || "").trim().toLowerCase();
    const items = q
      ? recipients.filter((r) =>
          (r.name + " " + r.place + " " + r.status).toLowerCase().indexOf(q) !== -1)
      : recipients;
    paint(items);
    if (countEl)
      countEl.textContent = q
        ? items.length + " of " + recipients.length + " recipients"
        : recipients.length + " recipients";
  }

  const url = cfg.recipients1951CsvUrl;
  if (!url) {
    rootEl.innerHTML = '<p class="copies-loading">The 1951 list is not configured.</p>';
    return;
  }

  Papa.parse(url, {
    download: true, header: true, skipEmptyLines: true,
    complete: (res) => {
      (res.data || []).forEach((row) => {
        const name = field(row, ["name"]);
        if (!name) return;
        recipients.push({
          name,
          place: field(row, ["city/state/country", "location", "place"]),
          status: field(row, ["still has set?", "status"]),
          catalog: field(row, ["link to catalog", "catalog_url", "catalog"]),
          jdc: field(row, ["jdc letter link;", "jdc letter link", "jdc"]),
        });
      });
      applyFilter();
    },
    error: () => {
      rootEl.innerHTML = '<p class="copies-loading">The 1951 list could not be loaded.</p>';
    },
  });

  if (filterEl) filterEl.addEventListener("input", applyFilter);
})();
