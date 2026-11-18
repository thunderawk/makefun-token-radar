// Token Radar dashboard: renders window.RADAR (written by main.ts into data.js).
// Board tab: sortable, filterable table; click a row for its detail view with the
// model breakdown and the farm plan. Live tab: the tokenized comps. Calibration
// tab: the multiple behind every rank. No network: all data is local.

const D = window.RADAR;
const $ = (id) => document.getElementById(id);
const money = (n) => n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US');
const moneyShort = (n) => {
  if (n == null) return '—';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n);
};
const pct = (n) => n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- header stats ----
$('stats').innerHTML = [
  [D.board_size, 'ranked'],
  [D.watchlist_size, 'watchlist'],
  [D.rows.filter((r) => r.tvl_usd >= D.floor_usd).length, 'above $50M floor'],
  [D.live_size, 'live tokens'],
].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
$('asof').textContent = D.as_of;
$('source').textContent = 'Source: ' + D.source + ' · model ' + D.model_version + ' · global multiple ' + D.global_multiple;

// ---- tabs ----
$('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b === btn));
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.id === 'tab-' + btn.dataset.tab));
});

// ---- filters ----
const cats = [...new Set(D.rows.map((r) => r.category).filter(Boolean))].sort();
const chains = [...new Set(D.rows.flatMap((r) => r.chains))].sort();
for (const c of cats) $('cat').insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`);
for (const c of chains) $('chain').insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`);
const watchSet = new Set(D.watchlist);

let sortKey = 'rank';
let sortDir = 1;
let selected = null;

function filtered() {
  const q = $('q').value.trim().toLowerCase();
  const cat = $('cat').value;
  const chain = $('chain').value;
  const watchOnly = $('watch').checked;
  let rows = D.rows.filter((r) => {
    if (q && !(r.name.toLowerCase().includes(q) || r.slug.includes(q))) return false;
    if (cat && r.category !== cat) return false;
    if (chain && !r.chains.includes(chain)) return false;
    if (watchOnly && !watchSet.has(r.slug)) return false;
    return true;
  });
  const key = sortKey;
  rows = rows.slice().sort((a, b) => {
    const av = a[key] == null ? -Infinity : a[key];
    const bv = b[key] == null ? -Infinity : b[key];
    return (av < bv ? -1 : av > bv ? 1 : a.rank - b.rank) * sortDir;
  });
  return rows;
}

function renderBoard() {
  const rows = filtered();
  $('count').textContent = rows.length + ' of ' + D.rows.length + ' protocols · ranked by implied value · click a row for its farm plan';
  $('board').querySelector('tbody').innerHTML = rows.map((r) => {
    const ch = r.change_7d == null ? '—' : `<span class="${r.change_7d >= 0 ? 'up' : 'down'}">${pct(r.change_7d)}</span>`;
    return `<tr data-slug="${esc(r.slug)}" class="${selected === r.slug ? 'sel' : ''}">
      <td class="rank">${r.rank}</td>
      <td class="name"><b>${esc(r.name)}</b><span>${esc(r.slug)}</span></td>
      <td>${esc(r.category || '—')}</td>
      <td>${r.chains.slice(0, 3).map((c) => `<span class="tag">${esc(c)}</span>`).join('')}${r.chains.length > 3 ? `<span class="tag">+${r.chains.length - 3}</span>` : ''}</td>
      <td class="num">${moneyShort(r.tvl_usd)}</td>
      <td class="num">${ch}</td>
      <td class="num"><b>${moneyShort(r.implied_value_usd)}</b></td>
      <td class="num">×${r.category_multiple}</td>
    </tr>`;
  }).join('');
}

function showDetail(slug) {
  const r = D.rows.find((x) => x.slug === slug);
  if (!r) return;
  selected = slug;
  const age = r.age_days == null ? 'unknown' : r.age_days + ' days';
  const base = r.tvl_usd * r.category_multiple;
  const steps = r.farm_steps.map((s) => {
    const m = s.match(/^(.*?) Cost: (.*?)\. Time: (.*?)\.?$/);
    if (!m) return `<li>${esc(s)}</li>`;
    return `<li>${esc(m[1])} <span class="cost">Cost: ${esc(m[2])}. Time: ${esc(m[3])}.</span></li>`;
  }).join('');
  $('detail').hidden = false;
  $('detail').innerHTML = `
    <h2>#${r.rank} ${esc(r.name)}</h2>
    <p class="meta">${esc(r.slug)} · ${esc(r.category || 'uncategorized')} · ${r.chains.map(esc).join(', ')} · listed ${esc(r.listed_at || 'unknown')} · records no token</p>
    <div class="grid">
      <div class="cell"><span>Implied value</span><b>${money(r.implied_value_usd)}</b><small>rank #${r.rank}</small></div>
      <div class="cell"><span>TVL</span><b>${money(r.tvl_usd)}</b><small>7d ${pct(r.change_7d)}</small></div>
      <div class="cell"><span>Category multiple</span><b>×${r.category_multiple}</b><small>base ${moneyShort(base)}</small></div>
      <div class="cell"><span>Growth × Maturity × Breadth</span><b>×${r.growth_multiplier} × ${r.maturity_multiplier} × ${r.breadth_multiplier}</b><small>age ${age}</small></div>
    </div>
    <h3>How to farm it</h3>
    <ol class="steps">${steps}</ol>`;
  renderBoard();
  $('detail').scrollIntoView({ behavior: 'auto', block: 'start' });
}

$('board').querySelector('tbody').addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (tr) showDetail(tr.dataset.slug);
});
for (const id of ['q', 'cat', 'chain', 'watch']) $(id).addEventListener('input', renderBoard);
$('sort').addEventListener('change', (e) => {
  sortKey = e.target.value;
  sortDir = 1;
  renderBoard();
});
document.querySelectorAll('#board thead th').forEach((th, i) => {
  th.style.cursor = 'pointer';
  th.addEventListener('click', () => {
    const keys = ['rank', null, null, null, 'tvl_usd', 'change_7d', 'implied_value_usd', 'category_multiple'];
    const k = keys[i];
    if (!k) return;
    if (sortKey === k) sortDir *= -1; else { sortKey = k; sortDir = k === 'rank' ? 1 : -1; }
    renderBoard();
  });
});

// ---- live tab ----
$('live').querySelector('tbody').innerHTML = D.live.map((r) => {
  const ratio = r.mcap_usd && r.tvl_usd ? (r.mcap_usd / r.tvl_usd).toFixed(2) + '×' : '—';
  return `<tr><td class="name"><b>${esc(r.name)}</b></td><td>${esc(r.category || '—')}</td>
    <td>${r.chains.slice(0, 2).map((c) => `<span class="tag">${esc(c)}</span>`).join('')}</td>
    <td class="num">${moneyShort(r.tvl_usd)}</td><td class="num">${moneyShort(r.mcap_usd)}</td>
    <td class="num">${ratio}</td><td class="num">${pct(r.change_7d)}</td></tr>`;
}).join('');

// ---- comps tab ----
$('comps').querySelector('tbody').innerHTML = D.comps.map((c) => `<tr>
  <td><b>${esc(c.category)}</b></td><td class="num">${c.comps}</td>
  <td class="num">×${c.median_multiple}</td><td class="num"><b>×${c.multiple_used}</b></td>
  <td class="num">${moneyShort(c.median_tvl_usd)}</td><td class="num">${moneyShort(c.median_mcap_usd)}</td></tr>`).join('');

renderBoard();

// Deep links: #detail=<slug> opens a protocol's detail view;
// #cat=<category> pre-sets the category filter. Both are plain page state.
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.has('detail')) {
  document.body.classList.add('detail-only');
  showDetail(hash.get('detail'));
}
if (hash.has('cat')) {
  $('cat').value = hash.get('cat');
  renderBoard();
}
