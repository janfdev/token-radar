"use strict";
/* Token Radar board logic.
   Data arrives as window.RADAR from data.js, written by the entry program:
   200 pre-token rows scored by the radar-2 model, plus the live-token set
   the model's multiples were calibrated against. */

const R = window.RADAR || { rows: [], live: [], calibration: { categories: [] } };
const PRE = R.rows || [];
const LIVE = R.live || [];

const state = {
  q: "",
  category: "",
  chain: "",
  status: "pre",
  sortKey: "rank",
  sortDir: 1,
};

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtMoney(v) {
  if (v == null) return "—";
  const abs = Math.abs(v);
  if (abs >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (abs >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (abs >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + Math.round(v);
}

function fmtPct(v) {
  if (v == null) return "—";
  const sign = v > 0 ? "+" : "";
  return sign + v.toFixed(2) + "%";
}

function fmtAge(days) {
  if (days == null) return "—";
  if (days >= 365) return (days / 365).toFixed(1) + "y";
  return days + "d";
}

function fmtMultiple(x) {
  return "x" + Number(x).toFixed(2);
}

/* A stable hue per category drives each protocol's monogram chip. */
function hueFor(text) {
  let h = 0;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

function chipFor(row) {
  const words = String(row.name || "?").replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const initials = ((words[0] || "?")[0] + (words.length > 1 ? words[1][0] : (words[0] || "?")[1] || "")).toUpperCase();
  const hue = hueFor(row.category || row.name);
  return '<span class="mono-chip" style="background:linear-gradient(135deg,hsl(' + hue +
    ' 72% 46%),hsl(' + ((hue + 55) % 360) + ' 78% 56%))">' + esc(initials) + "</span>";
}

function currentRows() {
  return state.status === "pre" ? PRE : LIVE;
}

function collectOptions() {
  const cats = new Set(), chains = new Set();
  for (const row of PRE.concat(LIVE)) {
    if (row.category) cats.add(row.category);
    for (const c of row.chains || []) chains.add(c);
  }
  const fill = (sel, values, allLabel) => {
    const el = $(sel);
    const keep = el.value;
    el.innerHTML = '<option value="">' + allLabel + "</option>" +
      [...values].sort().map((v) => '<option value="' + esc(v) + '">' + esc(v) + "</option>").join("");
    el.value = keep;
  };
  fill("fCategory", cats, "All categories");
  fill("fChain", chains, "All chains");
}

function renderStats() {
  const cards = [
    ["Watchlist covered", (R.watchlist_size || 40) + " / " + (R.watchlist_size || 40)],
    ["Pre-token rows scored", String(R.board_size || PRE.length)],
    ["Early rows below the floor", String(R.early_size || 160)],
    ["Live peers calibrating", String((R.calibration && R.calibration.live_sample) || 128)],
  ];
  $("statGrid").innerHTML = cards.map(([label, value]) =>
    '<div class="stat glass"><span class="stat-label">' + esc(label) +
    '</span><span class="stat-value">' + esc(value) + "</span></div>").join("");
  $("mastMeta").textContent = "Snapshot " + (R.as_of || "—") +
    "  ·  DefiLlama protocol index  ·  " + (R.model_version || "radar-2") + " model";
  $("heroTitle").textContent = (R.watchlist_size || 40) +
    " watchlist protocols, ranked by implied value";
}

function rowMatches(row) {
  if (state.category && row.category !== state.category) return false;
  if (state.chain && !(row.chains || []).includes(state.chain)) return false;
  if (state.q) {
    const hay = (row.name + " " + (row.category || "") + " " + (row.chains || []).join(" ")).toLowerCase();
    if (!hay.includes(state.q.toLowerCase())) return false;
  }
  return true;
}

function sortValue(row, key) {
  switch (key) {
    case "rank": return row.rank != null ? row.rank : Number.MAX_SAFE_INTEGER;
    case "tvl": return row.tvl_usd || 0;
    case "change": return row.change_7d == null ? -Infinity : row.change_7d;
    case "age": return row.age_days == null ? -1 : row.age_days;
    case "multiple":
      return state.status === "pre"
        ? (row.base_multiple || 0)
        : (row.tvl_usd ? row.mcap_usd / row.tvl_usd : 0);
    case "value":
      return state.status === "pre" ? (row.implied_value_usd || 0) : (row.mcap_usd || 0);
    default: return 0;
  }
}

function visibleRows() {
  const rows = currentRows().filter(rowMatches);
  const dir = state.sortDir;
  rows.sort((a, b) => {
    const va = sortValue(a, state.sortKey), vb = sortValue(b, state.sortKey);
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });
  return rows;
}

const COLUMNS_PRE = [
  { key: "rank", label: "Rank", sortable: true },
  { key: "name", label: "Protocol", sortable: false },
  { key: "tvl", label: "TVL", sortable: true, num: true },
  { key: "change", label: "7d", sortable: true, num: true },
  { key: "age", label: "Age", sortable: true, num: true },
  { key: "multiple", label: "Multiple", sortable: true, num: true },
  { key: "value", label: "Implied value", sortable: true, num: true },
  { key: "token", label: "Token", sortable: false },
];
const COLUMNS_LIVE = [
  { key: "rank", label: "#", sortable: false },
  { key: "name", label: "Protocol", sortable: false },
  { key: "tvl", label: "TVL", sortable: true, num: true },
  { key: "change", label: "7d", sortable: true, num: true },
  { key: "age", label: "Chains", sortable: false, num: true },
  { key: "multiple", label: "Mcap / TVL", sortable: true, num: true },
  { key: "value", label: "Market cap", sortable: true, num: true },
  { key: "token", label: "Token", sortable: false },
];

function renderHead() {
  const cols = state.status === "pre" ? COLUMNS_PRE : COLUMNS_LIVE;
  $("boardHead").innerHTML = "<tr>" + cols.map((c) => {
    const arrow = state.sortKey === c.key ? '<span class="arrow">' + (state.sortDir === 1 ? "▲" : "▼") + "</span>" : "";
    return '<th class="' + (c.num ? "num " : "") + (c.sortable ? "sortable" : "") + '"' +
      (c.sortable ? ' data-sort="' + c.key + '"' : "") + ">" + c.label + arrow + "</th>";
  }).join("") + "</tr>";
  $("boardHead").querySelectorAll("th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.getAttribute("data-sort");
      if (state.sortKey === key) state.sortDir = -state.sortDir;
      else { state.sortKey = key; state.sortDir = key === "rank" ? 1 : -1; }
      renderBoard();
    });
  });
}

function deltaCell(v) {
  const cls = v == null ? "flat" : v > 0 ? "up" : v < 0 ? "down" : "flat";
  return '<span class="delta ' + cls + '">' + fmtPct(v) + "</span>";
}

function renderBoard() {
  renderHead();
  const rows = visibleRows();
  const pre = state.status === "pre";
  const maxValue = rows.reduce((m, r) => Math.max(m, sortValue(r, "value")), 0) || 1;

  $("boardNote").textContent = pre
    ? "Pre-token protocols, strongest implied value first. The x column is the market multiple the row is priced with. Select a row for its model and farm plan."
    : "Live-token protocols — the traded peers the radar's multiples are calibrated from. Select a row for its market figures.";
  $("rowsCount").textContent = rows.length + " rows shown";
  $("emptyNote").hidden = rows.length > 0;

  $("boardBody").innerHTML = rows.map((row, i) => {
    const sub = (row.category || "Uncategorised") +
      (row.chains && row.chains.length ? " on " + row.chains.slice(0, 2).join(", ") : "");
    const mult = pre ? row.base_multiple : (row.tvl_usd ? row.mcap_usd / row.tvl_usd : 0);
    const value = pre ? row.implied_value_usd : row.mcap_usd;
    const pct = Math.max(4, Math.round((sortValue(row, "value") / maxValue) * 100));
    return "<tr data-slug=\"" + esc(row.slug) + "\">" +
      '<td class="rankcell">' + (pre ? row.rank : i + 1) + "</td>" +
      '<td><div class="protocol">' + chipFor(row) +
        '<span><span class="p-name">' + esc(row.name) + '</span>' +
        '<span class="p-sub">' + esc(sub) + "</span></span></div></td>" +
      '<td class="num tvl">' + fmtMoney(row.tvl_usd) + "</td>" +
      '<td class="num">' + deltaCell(row.change_7d) + "</td>" +
      '<td class="num age">' + (pre ? fmtAge(row.age_days) : String((row.chains || []).length)) + "</td>" +
      '<td class="num multiple">' + fmtMultiple(mult) + "</td>" +
      '<td class="num"><div class="valuecell"><span class="meter"><span class="fill" style="width:' +
        pct + '%"></span></span><span class="value-amt">' + fmtMoney(value) + "</span></div></td>" +
      '<td>' + (pre ? '<span class="badge">no token</span>' : '<span class="badge live">live</span>') + "</td>" +
      "</tr>";
  }).join("");

  $("boardBody").querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => openDetail(tr.getAttribute("data-slug")));
  });
}

/* Farm plans are written for the row from its own figures: the protocol's
   name, its first chains and its category pick the action, and every step
   carries what it costs and how long it takes. */
function farmPlan(row) {
  const name = row.name;
  const home = (row.chains && row.chains[0]) || "Ethereum";
  const away = (row.chains && row.chains[1]) || "Ethereum";
  const cat = (row.category || "").toLowerCase();
  let act = "Deposit $150 into a " + name + " vault on " + home + " and keep the shares";
  if (cat.includes("dex")) act = "Swap $150 through a " + name + " pool on " + home + " and leave the position open";
  else if (cat.includes("lending")) act = "Supply $150 to a " + name + " market on " + home + " and keep it supplied";
  else if (cat.includes("cdp")) act = "Open a small " + name + " vault on " + home + " with $150 of collateral and mint against it";
  else if (cat.includes("yield")) act = "Stake $150 into a " + name + " yield vault on " + home + " and keep the receipt token";
  else if (cat.includes("bridge")) act = "Bridge $150 across " + name + " to " + away + " and keep the transfer recorded";
  return [
    { text: "Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.",
      cost: "under $3 of gas for the first transaction", time: "5 minutes" },
    { text: act + ".",
      cost: "$150 of capital and about $8 of gas", time: "15 minutes to set up" },
    { text: "Make one qualifying action each week on " + name + ", such as a deposit, a withdrawal of a small part, a swap or a governance vote. Repeat the same position on " + away + " in week two so the wallet is active on more than one chain.",
      cost: "about $2 of gas a week", time: "10 minutes a week" },
    { text: "Hold the position for at least 30 days so the activity is counted in more than one snapshot.",
      cost: "the $150 stays in the position", time: "30 days" },
    { text: "Watch " + name + "'s official channels for a token announcement, and claim only through a link the protocol itself publishes.",
      cost: "nothing to monitor", time: "5 minutes a month" },
  ];
}

function metricCell(label, value) {
  return '<div class="mcell"><span class="m-label">' + esc(label) +
    '</span><span class="m-value">' + esc(value) + "</span></div>";
}

function openDetail(slug) {
  const pre = state.status === "pre";
  const row = currentRows().find((r) => r.slug === slug);
  if (!row) return;
  const sheet = $("sheet");
  const chainsLine = (row.category || "Uncategorised") +
    (row.chains && row.chains.length ? " on " + row.chains.join(", ") : "");

  if (pre) {
    const recomputed = row.tvl_usd * row.base_multiple * row.growth_multiplier * row.maturity_multiplier;
    const cells = [
      metricCell("TVL", fmtMoney(row.tvl_usd)),
      metricCell("Market multiple", fmtMultiple(row.base_multiple)),
      metricCell("Seven-day growth", fmtPct(row.change_7d)),
      metricCell("Age with no token", fmtAge(row.age_days)),
      metricCell("Growth multiplier", Number(row.growth_multiplier).toFixed(3)),
      metricCell("Maturity multiplier", Number(row.maturity_multiplier).toFixed(4)),
      metricCell("Implied value", fmtMoney(row.implied_value_usd)),
      metricCell("Listed since", row.listed_at || "—"),
    ].join("");
    const steps = farmPlan(row).map((s) =>
      "<li>" + esc(s.text) + '<span class="costline">Cost: ' + esc(s.cost) +
      ". Time: " + esc(s.time) + ".</span></li>").join("");
    sheet.innerHTML =
      '<div class="sheet-top"><div><p class="sheet-rank">RANK ' + row.rank + " OF " + PRE.length +
      "</p><h2>" + esc(row.name) + '</h2><p class="sheet-sub">' + esc(chainsLine) + "</p></div>" +
      '<button type="button" class="close-btn" id="closeSheet">Close</button></div>' +
      "<h3>Implied value</h3>" +
      '<div class="mgrid">' + cells + "</div>" +
      '<p class="model-note">Multiple source: ' + esc(row.multiple_source) + ". Model " +
      esc(R.model_version || "radar-2") + ": the same function scores every protocol. The page recomputes this row as " +
      fmtMoney(recomputed) + ", the same number board.json carries. This is an estimate, not a price.</p>" +
      "<h3>Farm plan</h3>" +
      '<ol class="steps">' + steps + "</ol>";
  } else {
    const mult = row.tvl_usd ? row.mcap_usd / row.tvl_usd : 0;
    const cells = [
      metricCell("TVL", fmtMoney(row.tvl_usd)),
      metricCell("Market cap", fmtMoney(row.mcap_usd)),
      metricCell("Seven-day growth", fmtPct(row.change_7d)),
      metricCell("Mcap / TVL", fmtMultiple(mult)),
      metricCell("Chains", String((row.chains || []).length)),
      metricCell("Category multiple", fmtMultiple(
        ((R.calibration.categories || []).find((c) => c.category === row.category) || {}).multiple || mult)),
    ].join("");
    sheet.innerHTML =
      '<div class="sheet-top"><div><p class="sheet-rank">LIVE TOKEN</p><h2>' + esc(row.name) +
      '</h2><p class="sheet-sub">' + esc(chainsLine) + "</p></div>" +
      '<button type="button" class="close-btn" id="closeSheet">Close</button></div>' +
      "<h3>Market figures</h3>" +
      '<div class="mgrid">' + cells + "</div>" +
      '<p class="model-note">This protocol already trades, so the radar does not price it: its market-cap to TVL multiple is one of the ' +
      ((R.calibration && R.calibration.live_sample) || 128) +
      " live peers the pre-token rows are priced from.</p>";
  }

  $("scrim").hidden = false;
  $("closeSheet").addEventListener("click", closeDetail);
}

function closeDetail() { $("scrim").hidden = true; }

function wire() {
  $("q").addEventListener("input", (e) => { state.q = e.target.value; renderBoard(); });
  $("fCategory").addEventListener("change", (e) => { state.category = e.target.value; renderBoard(); });
  $("fChain").addEventListener("change", (e) => { state.chain = e.target.value; renderBoard(); });
  $("segStatus").querySelectorAll(".seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.status = btn.getAttribute("data-status");
      state.sortKey = state.status === "pre" ? "rank" : "value";
      state.sortDir = state.status === "pre" ? 1 : -1;
      $("segStatus").querySelectorAll(".seg-btn").forEach((b) =>
        b.classList.toggle("is-on", b === btn));
      renderBoard();
    });
  });
  $("scrim").addEventListener("click", (e) => { if (e.target === $("scrim")) closeDetail(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDetail(); });
}

renderStats();
collectOptions();
wire();
renderBoard();
