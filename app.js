const API = 'https://api.ergoplatform.com/api/v1';
const REFRESH_INTERVAL = 60;

let chart = null;
let windowSize = 50;
let countdown = REFRESH_INTERVAL;
let countdownTimer = null;
let refreshTimer = null;

const POOL_NAMES = {
  '88dhgzEuTXaTHm7Dr4sGKinGKsW3AFKCb3bfHhsnHTJA': 'WoolyPooly',
  '2Z4YBkDsDvQj8BX7xiySFewjitqp2ge9c99jfes2whbtKitZTxdBYqbrVZUvZvKv6XmsxBo1WSEGB1bGkwmdbxR1A': 'LEAF Pool',
  '9gpNMh3TGDYTMDTEMNqcNaJKnMH4oNE89JFGrAQjsBkBx5oJN85': 'Kryptoman',
  '9fFVXToMLiKcK8nBKRBnLW3z3KYEkEaqcVKp71Y6cZkjdyRdRN6': 'GetBlok',
};

function shortAddr(addr) {
  if (!addr) return 'Unknown';
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function minerLabel(miner) {
  if (!miner) return 'Unknown';
  if (miner.name && miner.name.trim()) return miner.name.trim();
  const addr = miner.address || '';
  return POOL_NAMES[addr] || shortAddr(addr);
}

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return diff + 's ago';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  return Math.floor(diff / 3600) + 'h ago';
}

async function fetchBlocks(limit) {
  const url = `${API}/blocks?limit=${Math.min(limit, 100)}&offset=0`;
  const batches = [];

  // Fetch in batches of 100
  for (let offset = 0; offset < limit; offset += 100) {
    const batchSize = Math.min(100, limit - offset);
    const res = await fetch(`${API}/blocks?limit=${batchSize}&offset=${offset}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    const data = await res.json();
    const items = data.items || data;
    if (!items.length) break;
    batches.push(...items);
    if (items.length < batchSize) break;
  }

  return batches;
}

function buildLeaderboard(blocks) {
  const counts = {};
  const minerInfo = {};

  blocks.forEach(b => {
    const miner = b.miner || {};
    const addr = miner.address || 'unknown';
    counts[addr] = (counts[addr] || 0) + 1;
    if (!minerInfo[addr]) minerInfo[addr] = miner;
  });

  const sorted = Object.entries(counts)
    .map(([addr, count]) => ({ addr, count, miner: minerInfo[addr] }))
    .sort((a, b) => b.count - a.count);

  return sorted;
}

function calcAvgBlockTime(blocks) {
  if (blocks.length < 2) return null;
  const sorted = [...blocks].sort((a, b) => b.timestamp - a.timestamp);
  const spans = [];
  for (let i = 0; i < Math.min(sorted.length - 1, 20); i++) {
    spans.push(sorted[i].timestamp - sorted[i + 1].timestamp);
  }
  const avg = spans.reduce((s, v) => s + v, 0) / spans.length;
  return avg / 1000; // seconds
}

function renderChart(leaderboard, total) {
  const top = leaderboard.slice(0, 15);
  const labels = top.map(e => minerLabel(e.miner));
  const values = top.map(e => e.count);

  const colors = top.map((_, i) => {
    const hue = (i * 23 + 30) % 360;
    return `hsl(${hue}, 80%, 55%)`;
  });

  const ctx = document.getElementById('leaderboard-chart').getContext('2d');

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Blocks mined',
        data: values,
        backgroundColor: colors,
        borderColor: colors.map(c => c.replace('55%', '70%')),
        borderWidth: 1,
        borderRadius: 6,
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.raw} blocks (${pct}%)`;
            }
          },
          backgroundColor: '#111520',
          borderColor: '#1e2640',
          borderWidth: 1,
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30,38,64,0.8)' },
          ticks: { color: '#64748b', font: { size: 11 } },
        },
        y: {
          grid: { display: false },
          ticks: {
            color: '#e2e8f0',
            font: { size: 12, weight: '600' },
            maxTicksLimit: 15,
          }
        }
      }
    }
  });
}

function renderTable(leaderboard, total) {
  const tbody = document.getElementById('rankings-body');
  tbody.innerHTML = '';

  leaderboard.slice(0, 20).forEach((entry, i) => {
    const rank = i + 1;
    const pct = ((entry.count / total) * 100).toFixed(1);
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="rank ${rankClass}">${medal}</td>
      <td>
        <div class="miner-name">${minerLabel(entry.miner)}</div>
        <div class="miner-address">${shortAddr(entry.addr)}</div>
      </td>
      <td class="blocks-count">${entry.count}</td>
      <td class="share-pct">${pct}%</td>
      <td class="progress-wrap">
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width:${pct}%"></div>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRecentBlocks(blocks) {
  const feed = document.getElementById('blocks-feed');
  feed.innerHTML = '';

  const recent = [...blocks].sort((a, b) => b.timestamp - a.timestamp).slice(0, 15);

  recent.forEach(b => {
    const miner = b.miner || {};
    const card = document.createElement('div');
    card.className = 'block-card';
    card.innerHTML = `
      <span class="block-height">#${(b.height || '').toLocaleString()}</span>
      <span class="block-miner">${minerLabel(miner)}</span>
      <span class="block-time">${b.timestamp ? timeAgo(b.timestamp) : '—'}</span>
    `;
    feed.appendChild(card);
  });
}

function renderStats(leaderboard, total, avgTime) {
  document.getElementById('blocks-analyzed').textContent = total.toLocaleString();
  document.getElementById('unique-miners').textContent = leaderboard.length;

  if (leaderboard.length > 0) {
    const topPct = ((leaderboard[0].count / total) * 100).toFixed(1);
    document.getElementById('top-dominance').textContent = topPct + '%';
  }

  if (avgTime !== null) {
    const secs = Math.round(avgTime);
    document.getElementById('avg-block-time').textContent = secs >= 60
      ? `${Math.floor(secs / 60)}m ${secs % 60}s`
      : `${secs}s`;
  }

  const now = new Date();
  document.getElementById('last-updated').textContent =
    'Updated ' + now.toLocaleTimeString();
}

async function load() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('main-content').classList.add('hidden');

  try {
    const blocks = await fetchBlocks(windowSize);
    const leaderboard = buildLeaderboard(blocks);
    const total = blocks.length;
    const avgTime = calcAvgBlockTime(blocks);

    renderStats(leaderboard, total, avgTime);
    renderChart(leaderboard, total);
    renderTable(leaderboard, total);
    renderRecentBlocks(blocks);

    document.getElementById('loading').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
  } catch (err) {
    document.getElementById('loading').innerHTML =
      `<p style="color:#ff5252">Failed to load: ${err.message}</p>
       <button onclick="load()" style="margin-top:12px;padding:8px 20px;background:#f8a000;border:none;border-radius:8px;color:#000;font-weight:700;cursor:pointer">Retry</button>`;
  }
}

function startCountdown() {
  clearInterval(countdownTimer);
  countdown = REFRESH_INTERVAL;
  document.getElementById('countdown').textContent = countdown;

  countdownTimer = setInterval(() => {
    countdown--;
    document.getElementById('countdown').textContent = Math.max(0, countdown);
    if (countdown <= 0) {
      clearInterval(countdownTimer);
      load().then(() => startCountdown());
    }
  }, 1000);
}

// Window selector
document.querySelectorAll('.window-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.window-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    windowSize = parseInt(btn.dataset.window);
    clearInterval(countdownTimer);
    load().then(() => startCountdown());
  });
});

// Manual refresh
document.getElementById('refresh-btn').addEventListener('click', () => {
  clearInterval(countdownTimer);
  load().then(() => startCountdown());
});

// Boot
load().then(() => startCountdown());
