"use strict";

/* Token Radar v2. Reads window.RADAR from the data file the program writes
   beside this page, and draws every chart from those figures alone. */

const R = window.RADAR;
const ROWS = R.rows;
const LIVE = R.live;
const FLOOR = R.floor_usd;
const CAL = R.calibration;

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtUSD(v) {
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + Math.round(v);
}
function fmtPct(v) {
  if (v === null || v === undefined) return "not reported";
  return (v > 0 ? "+" : "") + v.toFixed(2).replace("-", "−") + "%";
}
function fmtMult(v) { return "x" + v.toFixed(2); }
function fmtAge(days, listed) {
  if (!listed) return "not recorded";
  if (days >= 365) return (days / 365).toFixed(1) + "y";
  if (days >= 30) return Math.round(days / 30.4) + " mo";
  return days + " d";
}
const isWatch = (r) => r.tvl_usd >= FLOOR;
const bySlug = new Map(ROWS.map((r) => [r.slug, r]));

/* Masthead, ledger and method facts, all from the data file. */

$("mastLine").textContent =
  "Snapshot " + R.as_of + " · DefiLlama protocol index · Model " + R.model_version +
  " · Watchlist floor " + fmtUSD(FLOOR);
$("footLine").textContent = "Source: " + R.source + ".";

const totalImplied = ROWS.reduce((s, r) => s + r.implied_value_usd, 0);
const ledgerFacts = [
  ["Protocols scored", String(R.board_size)],
  ["On the watchlist", String(R.watchlist_size)],
  ["Early, below the floor", String(R.early_size)],
  ["Live peers in the calibration", String(CAL.live_sample)],
  ["Total implied value", fmtUSD(totalImplied)],
];
$("ledger").innerHTML = ledgerFacts
  .map(([k, v]) => "<div><dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd></div>")
  .join("");

$("methodFact").textContent =
  "The global median multiple is " + fmtMult(CAL.global_multiple) + ", from " + CAL.live_sample +
  " live-token protocols. " + CAL.categories.length + " categories carry a median of their own; " +
  "the rest price off the global figure.";

/* Chart 1: the radar plot. Implied value against TVL, both log scales.
   It answers where the value collects relative to protocol size: points on
   the dashed line are priced exactly at the global median multiple. */

function drawPlot(selected) {
  const W = 660, H = 250, L = 54, Rt = 12, T = 10, B = 30;
  const iw = W - L - Rt, ih = H - T - B;
  const x0 = 6.6, x1 = 9.6, y0 = 5.4, y1 = 8.8;
  const px = (v) => L + ((Math.log10(v) - x0) / (x1 - x0)) * iw;
  const py = (v) => T + ih - ((Math.log10(v) - y0) / (y1 - y0)) * ih;
  let s = '<svg class="svgbox" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">';
  for (const g of [1e7, 1e8, 1e9]) {
    s += '<line class="gridline" x1="' + px(g) + '" y1="' + T + '" x2="' + px(g) + '" y2="' + (T + ih) + '"/>' +
      '<text class="tick" x="' + px(g) + '" y="' + (H - 8) + '" text-anchor="middle">' + fmtUSD(g) + "</text>";
  }
  for (const g of [1e6, 1e7, 1e8]) {
    s += '<line class="gridline" x1="' + L + '" y1="' + py(g) + '" x2="' + (L + iw) + '" y2="' + py(g) + '"/>' +
      '<text class="tick" x="' + (L - 6) + '" y="' + (py(g) + 4) + '" text-anchor="end">' + fmtUSD(g) + "</text>";
  }
  s += '<line class="axisline" x1="' + L + '" y1="' + (T + ih) + '" x2="' + (L + iw) + '" y2="' + (T + ih) + '"/>';
  const d1 = { x: Math.pow(10, x0), y: CAL.global_multiple * Math.pow(10, x0) };
  const d2y = Math.pow(10, y1);
  const d2 = { x: d2y / CAL.global_multiple, y: d2y };
  s += '<line class="refline" x1="' + px(d1.x) + '" y1="' + py(d1.y) + '" x2="' + px(d2.x) + '" y2="' + py(d2.y) + '"/>';
  s += '<line class="gridline" stroke-dasharray="3 4" x1="' + px(FLOOR) + '" y1="' + T + '" x2="' + px(FLOOR) + '" y2="' + (T + ih) + '"/>' +
    '<text class="tick" x="' + (px(FLOOR) + 5) + '" y="' + (T + 10) + '">floor ' + fmtUSD(FLOOR) + "</text>";
  for (const r of ROWS) if (!isWatch(r)) s += dot(r, false);
  for (const r of ROWS) if (isWatch(r)) s += dot(r, true);
  if (selected && bySlug.has(selected)) {
    const r = bySlug.get(selected);
    s += '<circle cx="' + px(r.tvl_usd) + '" cy="' + py(r.implied_value_usd) + '" r="8" fill="none" stroke="#1D2733" stroke-width="1.6"/>';
  }
  s += "</svg>";
  $("plot").innerHTML = s;

  function dot(r, watch) {
    return '<circle class="pt" data-slug="' + esc(r.slug) + '" tabindex="0" role="button" aria-label="' +
      esc(r.name) + '" cx="' + px(r.tvl_usd).toFixed(1) + '" cy="' + py(r.implied_value_usd).toFixed(1) +
      '" r="' + (watch ? 4.2 : 3.1) + '" fill="' + (watch ? "#BC3F10" : "#7E8896") + '"><title>' +
      esc(r.name) + " · TVL " + fmtUSD(r.tvl_usd) + " · implied " + fmtUSD(r.implied_value_usd) + "</title></circle>";
  }
}

/* Chart 2: category bars. Total implied value per category, so the reader
   sees which corner of the market the pre-token value sits in. */

function categoryTotals() {
  const m = new Map();
  for (const r of ROWS) {
    const e = m.get(r.category) || { total: 0, n: 0 };
    e.total += r.implied_value_usd;
    e.n += 1;
    m.set(r.category, e);
  }
  return [...m.entries()]
    .map(([name, e]) => ({ name, total: e.total, n: e.n }))
    .sort((a, b) => b.total - a.total);
}

function drawCatBars(activeCat) {
  const all = categoryTotals();
  const top = all.slice(0, 8);
  const rest = all.slice(8);
  const restTotal = rest.reduce((s, c) => s + c.total, 0);
  const restN = rest.reduce((s, c) => s + c.n, 0);
  const max = top[0].total;
  let h = "";
  top.forEach((c, i) => {
    h += '<button type="button" class="barrow' + (i === 0 ? " barrow-top" : "") +
      (activeCat === c.name ? " is-on" : "") + '" data-cat="' + esc(c.name) + '">' +
      '<span class="barrow-name">' + esc(c.name) + " · " + c.n + "</span>" +
      '<span class="barrow-track"><span class="barrow-fill" style="display:block;width:' +
      Math.max(1.5, (c.total / max) * 100).toFixed(1) + '%"></span></span>' +
      '<span class="barrow-val">' + fmtUSD(c.total) + "</span></button>";
  });
  h += '<div class="barrow" aria-hidden="true"><span class="barrow-name">All other categories · ' + restN + "</span>" +
    '<span class="barrow-track"><span class="barrow-fill" style="display:block;width:' +
    Math.max(1.5, (restTotal / max) * 100).toFixed(1) + '%;background:#7E8896"></span></span>' +
    '<span class="barrow-val">' + fmtUSD(restTotal) + "</span></div>";
  $("catbars").innerHTML = h;
}

/* Chart 3: seven-day histogram. How the whole board moved, so a single
   row's growth figure can be read against the field. */

function drawHist() {
  const edges = [-Infinity, -50, -25, -10, 0, 10, 25, 50, 100, Infinity];
  const labels = ["under −50%", "−50 to −25", "−25 to −10", "−10 to 0", "0 to +10", "+10 to +25", "+25 to +50", "+50 to +100", "over +100%"];
  const counts = new Array(9).fill(0);
  for (const r of ROWS) {
    if (r.change_7d === null) continue;
    for (let i = 0; i < 9; i++) {
      if (r.change_7d >= edges[i] && r.change_7d < edges[i + 1]) { counts[i] += 1; break; }
    }
  }
  const W = 400, H = 132, B = 20, T = 14;
  const ih = H - B - T, bw = W / 9, max = Math.max(...counts);
  let s = '<svg class="svgbox" viewBox="0 0 ' + W + " " + H + '" aria-hidden="true">';
  counts.forEach((c, i) => {
    const bh = Math.max(1, (c / max) * ih);
    const x = i * bw + 3, w = bw - 6, y = T + ih - bh;
    const fill = edges[i + 1] <= 0 ? "#B3372C" : "#177245";
    s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + bh.toFixed(1) + '" fill="' + fill + '"><title>' +
      esc(labels[i]) + ": " + c + " protocols</title></rect>";
    s += '<text class="tick" x="' + (i * bw + bw / 2) + '" y="' + (y - 3) + '" text-anchor="middle">' + c + "</text>";
  });
  ["−50%", "−25", "−10", "0", "+10", "+25", "+50", "+100%"].forEach((t, i) => {
    s += '<text class="tick" x="' + ((i + 1) * bw) + '" y="' + (H - 5) + '" text-anchor="middle">' + t + "</text>";
  });
  s += '<line class="axisline" x1="0" y1="' + (T + ih) + '" x2="' + W + '" y2="' + (T + ih) + '"/>';
  s += "</svg>";
  $("hist").innerHTML = s;
}

/* The board: filterable, sortable, every row opening its file. */

const state = { mode: "pre", q: "", cat: "", chain: "", key: "rank", dir: 1 };

const PRE_COLS = [
  { key: "rank", label: "Rank", num: true },
  { key: "name", label: "Protocol", num: false },
  { key: "tvl_usd", label: "TVL", num: true },
  { key: "change_7d", label: "7d change", num: true },
  { key: "age_days", label: "Age", num: true },
  { key: "base_multiple", label: "Multiple", num: true },
  { key: "implied_value_usd", label: "Implied value", num: true },
];
const LIVE_COLS = [
  { key: "name", label: "Protocol", num: false },
  { key: "tvl_usd", label: "TVL", num: true },
  { key: "mcap_usd", label: "Market cap", num: true },
  { key: "ratio", label: "Mcap / TVL", num: true },
  { key: "change_7d", label: "7d change", num: true },
];

function modeRows() { return state.mode === "pre" ? ROWS : LIVE; }
function modeCols() { return state.mode === "pre" ? PRE_COLS : LIVE_COLS; }

function fillSelect(sel, values, allLabel, keep) {
  const cur = keep ? sel.value : "";
  sel.innerHTML = '<option value="">' + esc(allLabel) + "</option>" +
    values.map((v) => '<option value="' + esc(v) + '"' + (v === cur ? " selected" : "") + ">" + esc(v) + "</option>").join("");
}

function rebuildFilters() {
  const rows = modeRows();
  const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
  const chains = [...new Set(rows.flatMap((r) => r.chains))].sort();
  fillSelect($("fCat"), cats, "All categories", true);
  fillSelect($("fChain"), chains, "All chains", true);
  state.cat = $("fCat").value;
  state.chain = $("fChain").value;
}

function visibleRows() {
  const q = state.q.trim().toLowerCase();
  let out = modeRows().filter((r) => {
    if (state.cat && r.category !== state.cat) return false;
    if (state.chain && !r.chains.includes(state.chain)) return false;
    if (q && !(r.name.toLowerCase().includes(q) || (r.category || "").toLowerCase().includes(q) ||
      r.chains.some((c) => c.toLowerCase().includes(q)))) return false;
    return true;
  });
  const k = state.key, d = state.dir;
  const val = (r) => (k === "ratio" ? r.mcap_usd / r.tvl_usd : r[k]);
  out.sort((a, b) => {
    const va = val(a), vb = val(b);
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === "string") return d * va.localeCompare(vb);
    return d * (va - vb);
  });
  return out;
}

function deltaCell(v) {
  if (v === null || v === undefined) return '<span style="color:var(--ink-2)">not reported</span>';
  const cls = v > 0 ? "delta-pos" : v < 0 ? "delta-neg" : "";
  return '<span class="' + cls + '">' + fmtPct(v) + "</span>";
}

function chainLine(r) {
  const shown = r.chains.slice(0, 2).join(", ");
  return esc(r.category || "Uncategorised") + " on " + esc(shown) +
    (r.chains.length > 2 ? " +" + (r.chains.length - 2) + " more" : "");
}

function drawBoard() {
  const cols = modeCols();
  $("thead").innerHTML = "<tr>" + cols.map((c) => {
    const sorted = state.key === c.key;
    return '<th class="' + (c.num ? "num" : "") + '"' +
      (sorted ? ' aria-sort="' + (state.dir === 1 ? "ascending" : "descending") + '"' : "") +
      '><button type="button" class="th-btn" data-key="' + c.key + '">' + esc(c.label) +
      (sorted ? (state.dir === 1 ? " ↑" : " ↓") : "") + "</button></th>";
  }).join("") + "</tr>";

  const rows = visibleRows();
  $("tbody").innerHTML = rows.map((r) => {
    if (state.mode === "live") {
      return '<tr data-slug="' + esc(r.slug) + '"><td class="proto"><span class="pname">' + esc(r.name) +
        '</span><span class="pmeta">' + chainLine(r) + '</span></td><td class="num">' + fmtUSD(r.tvl_usd) +
        '</td><td class="num">' + fmtUSD(r.mcap_usd) + '</td><td class="num">' + fmtMult(r.mcap_usd / r.tvl_usd) +
        '</td><td class="num">' + deltaCell(r.change_7d) + "</td></tr>";
    }
    return '<tr data-slug="' + esc(r.slug) + '"><td class="rank">' + r.rank + '</td><td class="proto">' +
      (isWatch(r) ? '<span class="mark" title="Watchlist"></span>' : "") +
      '<span class="pname">' + esc(r.name) + '</span><span class="pmeta">' + chainLine(r) + '</span></td>' +
      '<td class="num">' + fmtUSD(r.tvl_usd) + '</td><td class="num">' + deltaCell(r.change_7d) +
      '</td><td class="num">' + fmtAge(r.age_days, r.listed_at) + '</td><td class="num">' + fmtMult(r.base_multiple) +
      '</td><td class="num"><strong>' + fmtUSD(r.implied_value_usd) + "</strong></td></tr>";
  }).join("");

  $("empty").hidden = rows.length > 0;
  const total = modeRows().length;
  $("count").textContent = rows.length === total ? total + " rows shown" : rows.length + " of " + total + " rows shown";
  $("tblnote").textContent = state.mode === "pre"
    ? "Ranked by implied value, strongest first. The multiple is the peer multiple each row is priced with; the square marks a watchlist protocol, at or above the $50M floor with no token recorded."
    : "Protocols whose token already trades. The radar never ranks them and gives them no farm plan: they are the peers whose market-cap-to-TVL ratios set the multiples the board is priced with.";
  $("board").setAttribute("aria-busy", "false");
}

/* The detail sheet: the model worked through for one protocol, a chart of
   its multiple against its peers, where it sits on the board, and its plan. */

function farmAction(cat) {
  const g = (re) => re.test(cat || "");
  if (g(/Dexs/)) return ["make several swaps and add $150 of liquidity to one of its busiest pairs", "Cost: $150 of capital, about $6 of gas and fees. Time: 15 minutes."];
  if (g(/Lending|CDP|Collateral|Borrow/)) return ["supply $150 as collateral, borrow a small amount against it, and repay the borrow inside the week", "Cost: $150 of capital, about $5 of gas. Time: 15 minutes."];
  if (g(/Staking|Restaking|Restaked/)) return ["stake $150 and hold the receipt token in the same wallet", "Cost: $150 of capital, about $4 of gas. Time: 10 minutes."];
  if (g(/Bridge/)) return ["bridge $150 to a second chain, then bridge part of it back the following week", "Cost: about $7 of bridge and gas fees. Time: 20 minutes."];
  if (g(/Yield|Aggregator|Farm|Liquidity|Allocator|Curator/)) return ["deposit $150 into one of its vaults and keep the shares untouched", "Cost: $150 of capital, about $8 of gas. Time: 15 minutes to set up."];
  if (g(/RWA/)) return ["finish its onboarding and invest close to the smallest amount it accepts, around $150", "Cost: about $150 of capital. Time: 30 minutes, with verification."];
  return ["use its core product once with about $150, the way a real user would", "Cost: about $150 of capital and $5 of gas. Time: 15 minutes."];
}

function farmPlan(r) {
  const [act, actCost] = farmAction(r.category);
  const steps = [
    ["Open a fresh wallet for " + r.name + " alone and keep its seed phrase offline; fund it with the gas token of " + r.chains[0] + ".",
      "Cost: under $3 of gas for the first transaction. Time: 5 minutes."],
    ["On " + r.name + ", " + act + ".", actCost],
    r.chains.length > 1
      ? ["Repeat the same position on " + r.chains[1] + " a week later, so the wallet shows activity on more than one chain.",
        "Cost: about $2 of gas. Time: 10 minutes."]
      : ["Repeat the core action a week later at a different size, so the history is not a single visit.",
        "Cost: about $2 of gas. Time: 10 minutes."],
    ["Make one qualifying action a week for at least four weeks: a deposit, a small withdrawal, a swap or a governance vote, whichever the protocol counts.",
      "Cost: about $2 of gas a week. Time: 10 minutes a week."],
    ["Hold the position for at least 30 days so it stands in more than one snapshot, follow the protocol's official channels for a token announcement, and keep a note of every transaction hash.",
      "Cost: the capital stays in the position. Time: 30 days."],
  ];
  return '<ol class="plan">' + steps.map(([t, c]) =>
    "<li>" + esc(t) + '<span class="cost">' + esc(c) + "</span></li>").join("") + "</ol>";
}

function cmpChart(pairs) {
  const max = Math.max(...pairs.map((p) => p.v)) * 1.12;
  return pairs.map((p) =>
    '<div class="cmp-row"><span>' + esc(p.label) + '</span><span class="cmp-track">' +
    '<span class="cmp-fill' + (p.me ? " me" : "") + '" style="display:block;width:' +
    Math.max(1.5, (p.v / max) * 100).toFixed(1) + '%"></span></span>' +
    '<span class="cmp-val">' + fmtMult(p.v) + "</span></div>").join("");
}

function positionStrip(r) {
  const vals = ROWS.map((x) => Math.log10(x.implied_value_usd));
  const lo = Math.min(...vals), hi = Math.max(...vals), bins = 30, counts = new Array(bins).fill(0);
  for (const v of vals) counts[Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins))] += 1;
  const max = Math.max(...counts), W = 620, bw = W / bins;
  const mx = ((Math.log10(r.implied_value_usd) - lo) / (hi - lo)) * W;
  let bars = "";
  counts.forEach((c, i) => {
    const bh = Math.max(1, (c / max) * 22);
    bars += '<span class="strip-bin" style="left:' + (i * bw).toFixed(1) + "px;height:" + bh.toFixed(1) + 'px"></span>';
  });
  const above = Math.round(((ROWS.length - r.rank) / (ROWS.length - 1)) * 100);
  return '<div class="strip" style="width:' + W + 'px">' + bars +
    '<span class="strip-marker" style="left:' + mx.toFixed(1) + 'px"></span></div>' +
    '<p class="strip-cap">Distribution of implied value across all 200 rows; the marker is this protocol. ' +
    "Its implied value stands above " + above + "% of the board.</p>";
}

function openSheet(r) {
  const live = !("implied_value_usd" in r);
  let h = '<div class="sheet-top"><div><p class="sheet-rank">' +
    (live ? "Pricing peer · token already trades" : "Rank " + r.rank + " of " + ROWS.length + (isWatch(r) ? " · Watchlist" : " · Early, below the floor")) +
    '</p><div class="sheet-name" id="sheetName">' + esc(r.name) + '</div>' +
    '<p class="sheet-sub">' + esc(r.category || "Uncategorised") + " on " + esc(r.chains.join(", ")) + "</p></div>" +
    '<button type="button" class="sheet-close" id="sheetClose">Close</button></div>';

  if (live) {
    const ratio = r.mcap_usd / r.tvl_usd;
    h += '<dl class="spec">' +
      spec("TVL", fmtUSD(r.tvl_usd)) + spec("Market cap", fmtUSD(r.mcap_usd)) +
      spec("Mcap / TVL", fmtMult(ratio)) + spec("Seven-day change", fmtPct(r.change_7d)) + "</dl>" +
      "<h3>Against the calibration</h3>" + cmpChart([
        { label: "This protocol", v: ratio, me: true },
        { label: "Global median, " + CAL.live_sample + " peers", v: CAL.global_multiple },
      ]) +
      "<p>This protocol is not ranked and carries no farm plan: its token already trades, so the radar uses it only to price the protocols that have none.</p>";
  } else {
    const recomputed = r.tvl_usd * r.base_multiple * r.growth_multiplier * r.maturity_multiplier;
    h += '<dl class="spec">' +
      spec("TVL", fmtUSD(r.tvl_usd)) +
      spec("Market multiple", fmtMult(r.base_multiple), r.multiple_source) +
      spec("Seven-day growth", fmtPct(r.change_7d)) +
      spec("Age with no token", fmtAge(r.age_days, r.listed_at), r.listed_at ? "listed since " + r.listed_at : "") +
      spec("Growth multiplier", r.growth_multiplier.toFixed(3)) +
      spec("Maturity multiplier", r.maturity_multiplier.toFixed(4)) +
      spec("Implied value", fmtUSD(r.implied_value_usd)) +
      spec("Chains", String(r.chains.length), r.chains.slice(0, 3).join(", ") + (r.chains.length > 3 ? "…" : "")) +
      "</dl>";
    const pairs = [{ label: "This protocol", v: r.base_multiple, me: true }];
    const catCal = CAL.categories.find((c) => c.category === r.category);
    if (catCal) pairs.push({ label: r.category + " median, " + catCal.sample + " live peers", v: catCal.multiple });
    pairs.push({ label: "Global median, " + CAL.live_sample + " live peers", v: CAL.global_multiple });
    h += "<h3>Priced against its peers</h3>" + cmpChart(pairs) +
      '<p class="strip-cap">Multiple source: ' + esc(r.multiple_source) + ". Worked through: " +
      fmtUSD(r.tvl_usd) + " × " + r.base_multiple.toFixed(4) + " × " + r.growth_multiplier.toFixed(3) +
      " × " + r.maturity_multiplier.toFixed(4) + " = " + fmtUSD(recomputed) +
      ", the implied value the board carries for this row.</p>" +
      "<h3>Where it sits on the board</h3>" + positionStrip(r) +
      "<h3>Farm plan</h3>" + farmPlan(r);
  }
  $("sheetInner").innerHTML = h;
  $("sheetClose").addEventListener("click", () => $("sheet").close());
  const dlg = $("sheet");
  if (!dlg.open) dlg.showModal();
  drawPlot(live ? null : r.slug);

  function spec(k, v, small) {
    return "<div><dt>" + esc(k) + "</dt><dd>" + esc(v) + (small ? "<small>" + esc(small) + "</small>" : "") + "</dd></div>";
  }
}

/* Wiring: controls, table, charts, deep links. */

function setMode(mode) {
  state.mode = mode;
  state.key = mode === "pre" ? "rank" : "name";
  state.dir = 1;
  $("segPre").classList.toggle("is-on", mode === "pre");
  $("segLive").classList.toggle("is-on", mode === "live");
  $("segPre").setAttribute("aria-pressed", String(mode === "pre"));
  $("segLive").setAttribute("aria-pressed", String(mode === "live"));
  rebuildFilters();
  drawBoard();
}

$("q").addEventListener("input", (e) => { state.q = e.target.value; drawBoard(); });
$("fCat").addEventListener("change", (e) => { state.cat = e.target.value; drawCatBars(state.cat); drawBoard(); });
$("fChain").addEventListener("change", (e) => { state.chain = e.target.value; drawBoard(); });
$("segPre").addEventListener("click", () => setMode("pre"));
$("segLive").addEventListener("click", () => setMode("live"));
$("clearFilters").addEventListener("click", () => {
  state.q = ""; state.cat = ""; state.chain = "";
  $("q").value = ""; $("fCat").value = ""; $("fChain").value = "";
  drawCatBars(""); drawBoard();
});

$("thead").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-key]");
  if (!btn) return;
  const k = btn.getAttribute("data-key");
  if (state.key === k) state.dir *= -1;
  else { state.key = k; state.dir = k === "name" ? 1 : -1; }
  if (k === "rank") state.dir = 1;
  drawBoard();
});

$("tbody").addEventListener("click", (e) => {
  const tr = e.target.closest("[data-slug]");
  if (!tr) return;
  const slug = tr.getAttribute("data-slug");
  const r = state.mode === "pre" ? bySlug.get(slug) : LIVE.find((x) => x.slug === slug);
  if (r) openSheet(r);
});

$("catbars").addEventListener("click", (e) => {
  const bar = e.target.closest("[data-cat]");
  if (!bar) return;
  const cat = bar.getAttribute("data-cat");
  if (state.mode !== "pre") setMode("pre");
  state.cat = state.cat === cat ? "" : cat;
  $("fCat").value = state.cat;
  drawCatBars(state.cat);
  drawBoard();
  document.querySelector(".boardsec").scrollIntoView({ block: "start" });
});

function openFromPlot(slug) {
  const r = bySlug.get(slug);
  if (r) openSheet(r);
}
$("plot").addEventListener("click", (e) => {
  const pt = e.target.closest("[data-slug]");
  if (pt) openFromPlot(pt.getAttribute("data-slug"));
});
$("plot").addEventListener("keydown", (e) => {
  if (e.key !== "Enter" && e.key !== " ") return;
  const pt = e.target.closest("[data-slug]");
  if (pt) { e.preventDefault(); openFromPlot(pt.getAttribute("data-slug")); }
});

$("sheet").addEventListener("click", (e) => { if (e.target === $("sheet")) $("sheet").close(); });
$("sheet").addEventListener("close", () => drawPlot(null));

function applyHash() {
  const h = new URLSearchParams(location.hash.replace(/^#/, ""));
  const cat = h.get("cat");
  if (cat) {
    state.cat = cat;
    $("fCat").value = cat;
    drawCatBars(cat);
    drawBoard();
    document.querySelector(".boardsec").scrollIntoView({ block: "start" });
  }
  const slug = h.get("row");
  if (slug) {
    const r = bySlug.get(slug) || LIVE.find((x) => x.slug === slug);
    if (r) openSheet(r);
  }
}

drawPlot(null);
drawCatBars("");
drawHist();
rebuildFilters();
drawBoard();
applyHash();
