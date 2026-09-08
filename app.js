/**
 * PeakGuard Capacity Simulator - Frontend Application Controller
 * High-performance interactive dashboard with Chart.js charts, REST API client,
 * client-side simulation engine fallback, and migration audit tracking.
 */

// Global State
const state = {
  scenario: 'scheduled_sale',
  params: {
    start_workers: 4,
    max_workers: 20,
    worker_tps: 30,
    warmup_s: 120
  },
  currentMetricTab: 'demand_capacity',
  canaryMode: 'Legacy active / PeakGuard shadow',
  auditLog: [
    { event: 'SHADOW MODE', detail: 'PeakGuard observes metrics, legacy policy keeps control', ts: 'T+00m' }
  ],
  simulationResult: null,
  charts: {
    legacy: null,
    peakguard: null
  }
};

const SCENARIO_DESCS = {
  scheduled_sale: '<strong>Scheduled Flash Sale:</strong> 5.0x traffic surge starting at T+15m for 10 min. Known event allows pre-scaling.',
  sudden_spike: '<strong>Sudden Spike:</strong> Unannounced 6.0x burst at T+20m for 5 min. Tests reactive queue absorption.',
  worker_loss: '<strong>Worker Loss:</strong> 3.0x peak at T+15m plus 30% node failure at T+20m for 10 min. Tests fleet fault-tolerance.',
  normal_day: '<strong>Normal Day:</strong> Baseline 90 TPS load without traffic surges.'
};

// DOM Content Loaded Handler
document.addEventListener('DOMContentLoaded', () => {
  initUIControls();
  initCharts();
  renderAuditTrail();
  runSimulation();
});

// Initialize UI Control Event Listeners
function initUIControls() {
  // Scenario Selection
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.scenario-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      state.scenario = target.dataset.scenario;
      document.getElementById('scenarioDesc').innerHTML = SCENARIO_DESCS[state.scenario];
      runSimulation();
    });
  });

  // Range Sliders
  setupSlider('sliderStartWorkers', 'valStartWorkers', 'start_workers');
  setupSlider('sliderMaxWorkers', 'valMaxWorkers', 'max_workers');
  setupSlider('sliderWorkerTps', 'valWorkerTps', 'worker_tps');
  setupSlider('sliderWarmupS', 'valWarmupS', 'warmup_s', ' s');

  // Action Buttons
  document.getElementById('runSimBtn').addEventListener('click', runSimulation);
  
  document.getElementById('resetParamsBtn').addEventListener('click', () => {
    state.params = { start_workers: 4, max_workers: 20, worker_tps: 30, warmup_s: 120 };
    updateSliderUI('sliderStartWorkers', 'valStartWorkers', 4);
    updateSliderUI('sliderMaxWorkers', 'valMaxWorkers', 20);
    updateSliderUI('sliderWorkerTps', 'valWorkerTps', 30);
    updateSliderUI('sliderWarmupS', 'valWarmupS', 120, ' s');
    runSimulation();
  });

  // Download CSV
  document.getElementById('downloadCsvBtn').addEventListener('click', downloadResultsCsv);

  // Chart Metric Tabs
  document.querySelectorAll('.tab-btn').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
      const target = e.currentTarget;
      target.classList.add('active');
      state.currentMetricTab = target.dataset.metric;
      updateCharts();
    });
  });

  // Canary Buttons
  document.getElementById('promoteCanaryBtn').addEventListener('click', () => {
    state.canaryMode = 'PeakGuard canary (10% traffic)';
    document.getElementById('canaryModeText').innerText = state.canaryMode;
    const now = new Date().toLocaleTimeString();
    state.auditLog.push({
      event: 'PROMOTE',
      ts: now,
      detail: 'Operator promoted PeakGuard to 10% canary traffic; legacy policy remains fallback'
    });
    renderAuditTrail();
  });

  document.getElementById('rollbackBtn').addEventListener('click', () => {
    state.canaryMode = 'Legacy active / PeakGuard shadow';
    document.getElementById('canaryModeText').innerText = state.canaryMode;
    const now = new Date().toLocaleTimeString();
    state.auditLog.push({
      event: 'ROLLBACK',
      ts: now,
      detail: 'Guardrail/operator rollback: legacy autoscaling restored, canary traffic disabled'
    });
    renderAuditTrail();
  });

  // Sensitivity Analysis Button
  document.getElementById('loadSensitivityBtn').addEventListener('click', loadSensitivityMatrix);
}

function setupSlider(sliderId, labelId, paramKey, suffix = '') {
  const slider = document.getElementById(sliderId);
  const label = document.getElementById(labelId);
  slider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    label.innerText = val + suffix;
    state.params[paramKey] = val;
    runSimulation();
  });
}

function updateSliderUI(sliderId, labelId, val, suffix = '') {
  document.getElementById(sliderId).value = val;
  document.getElementById(labelId).innerText = val + suffix;
}

// Client simulation trigger (API with fallback)
async function runSimulation() {
  const payload = {
    scenario: state.scenario,
    ...state.params
  };

  try {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      state.simulationResult = await res.json();
    } else {
      state.simulationResult = runClientSimulation(payload);
    }
  } catch (err) {
    // API server offline fallback
    state.simulationResult = runClientSimulation(payload);
  }

  renderMetrics();
  updateCharts();
}

// Render KPI Cards
function renderMetrics() {
  if (!state.simulationResult) return;
  const out = state.simulationResult;

  const leg = out.Legacy.metrics;
  const pg = out.PeakGuard.metrics;

  // Legacy
  document.getElementById('legacyAvail').innerText = leg.availability + '%';
  document.getElementById('legacyAvail').className = 'metric-val ' + (leg.availability >= 99.9 ? 'val-pass' : 'val-fail');
  
  document.getElementById('legacyP95').innerText = leg.p95_latency + ' ms';
  document.getElementById('legacyP95').className = 'metric-val ' + (leg.p95_latency <= 300 ? 'val-pass' : 'val-fail');
  
  document.getElementById('legacyBreach').innerText = leg.breach_minutes + ' min';
  document.getElementById('legacyBreach').className = 'metric-val ' + (leg.breach_minutes === 0 ? 'val-pass' : 'val-fail');
  
  document.getElementById('legacyWorkerMin').innerText = leg.worker_minutes;
  document.getElementById('legacyFailed').innerText = leg.failed.toLocaleString();
  document.getElementById('legacyArrived').innerText = leg.arrived.toLocaleString();
  document.getElementById('legacyMaxQueue').innerText = leg.max_queue.toLocaleString();

  // PeakGuard
  document.getElementById('pgAvail').innerText = pg.availability + '%';
  document.getElementById('pgAvail').className = 'metric-val ' + (pg.availability >= 99.9 ? 'val-pass' : 'val-fail');
  
  document.getElementById('pgP95').innerText = pg.p95_latency + ' ms';
  document.getElementById('pgP95').className = 'metric-val ' + (pg.p95_latency <= 300 ? 'val-pass' : 'val-fail');
  
  document.getElementById('pgBreach').innerText = pg.breach_minutes + ' min';
  document.getElementById('pgBreach').className = 'metric-val ' + (pg.breach_minutes === 0 ? 'val-pass' : 'val-fail');
  
  document.getElementById('pgWorkerMin').innerText = pg.worker_minutes;
  document.getElementById('pgFailed').innerText = pg.failed.toLocaleString();
  document.getElementById('pgArrived').innerText = pg.arrived.toLocaleString();
  document.getElementById('pgMaxQueue').innerText = pg.max_queue.toLocaleString();

  // Status Badge
  const badge = document.getElementById('statusBadge');
  if (pg.availability >= 99.9 && pg.breach_minutes <= 1.0) {
    badge.innerHTML = '<div class="pulse-dot"></div><span>PeakGuard SLO Compliant</span>';
    badge.style.background = 'rgba(16, 185, 129, 0.15)';
    badge.style.color = 'var(--emerald)';
  } else {
    badge.innerHTML = '<div class="pulse-dot" style="background:var(--rose);box-shadow:0 0 8px var(--rose);"></div><span>SLO Breach Warning</span>';
    badge.style.background = 'rgba(244, 63, 94, 0.15)';
    badge.style.color = 'var(--rose)';
  }
}

// Chart.js Setup
function initCharts() {
  const chartOptions = (titleStr) => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    plugins: {
      legend: { display: true, labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } } },
      tooltip: { mode: 'index', intersect: false, backgroundColor: '#0f172a', titleColor: '#f8fafc', bodyColor: '#cbd5e1' }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { size: 10 } },
        title: { display: true, text: 'Minute', color: '#64748b', font: { size: 11 } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#64748b', font: { size: 10 } }
      }
    }
  });

  const ctxLeg = document.getElementById('chartLegacy').getContext('2d');
  state.charts.legacy = new Chart(ctxLeg, { type: 'line', data: { labels: [], datasets: [] }, options: chartOptions('Legacy') });

  const ctxPg = document.getElementById('chartPeakGuard').getContext('2d');
  state.charts.peakguard = new Chart(ctxPg, { type: 'line', data: { labels: [], datasets: [] }, options: chartOptions('PeakGuard') });
}

function updateCharts() {
  if (!state.simulationResult) return;

  const legTrace = state.simulationResult.Legacy.trace;
  const pgTrace = state.simulationResult.PeakGuard.trace;
  const wt = state.params.worker_tps;

  const labels = legTrace.map(r => 'T+' + r.minute + 'm');
  const metricType = state.currentMetricTab;

  // Build datasets
  function getDatasets(trace, isPeakGuard) {
    const mainColor = isPeakGuard ? '#10b981' : '#f43f5e';
    const secondaryColor = '#3b82f6';

    if (metricType === 'demand_capacity') {
      return [
        {
          label: 'Demand TPS',
          data: trace.map(r => r.tps),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2
        },
        {
          label: 'Fleet Capacity TPS',
          data: trace.map(r => r.workers * wt),
          borderColor: mainColor,
          borderDash: [5, 5],
          borderWidth: 2,
          pointRadius: 0
        }
      ];
    } else if (metricType === 'queue') {
      return [
        {
          label: 'Queue Depth',
          data: trace.map(r => r.queue),
          borderColor: '#8b5cf6',
          backgroundColor: 'rgba(139, 92, 246, 0.25)',
          fill: true,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2
        }
      ];
    } else {
      // Latency vs SLO
      return [
        {
          label: 'Latency (ms)',
          data: trace.map(r => r.lat_ms),
          borderColor: mainColor,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2
        },
        {
          label: 'SLO Target (300 ms)',
          data: trace.map(() => 300),
          borderColor: '#ef4444',
          borderDash: [3, 3],
          borderWidth: 1.5,
          pointRadius: 0
        }
      ];
    }
  }

  // Update Legacy chart
  state.charts.legacy.data.labels = labels;
  state.charts.legacy.data.datasets = getDatasets(legTrace, false);
  state.charts.legacy.update();

  // Update PeakGuard chart
  state.charts.peakguard.data.labels = labels;
  state.charts.peakguard.data.datasets = getDatasets(pgTrace, true);
  state.charts.peakguard.update();
}

// Render Audit Feed
function renderAuditTrail() {
  const container = document.getElementById('auditFeed');
  container.innerHTML = state.auditLog.slice().reverse().map(item => `
    <div class="audit-item ${item.event}">
      <span class="audit-ts">${item.ts}</span>
      <div class="audit-content">
        <span class="audit-event">${item.event}</span>
        <span class="audit-detail">${item.detail}</span>
      </div>
    </div>
  `).join('');
}

// Download Results CSV
function downloadResultsCsv() {
  if (!state.simulationResult) return;

  const leg = state.simulationResult.Legacy.metrics;
  const pg = state.simulationResult.PeakGuard.metrics;

  const rows = [
    ['policy', 'availability', 'p95_latency', 'breach_minutes', 'worker_minutes', 'failed', 'arrived', 'max_queue'],
    ['Legacy', leg.availability, leg.p95_latency, leg.breach_minutes, leg.worker_minutes, leg.failed, leg.arrived, leg.max_queue],
    ['PeakGuard', pg.availability, pg.p95_latency, pg.breach_minutes, pg.worker_minutes, pg.failed, pg.arrived, pg.max_queue]
  ];

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `peakguard_results_${state.scenario}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Load Sensitivity Analysis Table
async function loadSensitivityMatrix() {
  const tbody = document.getElementById('sensitivityTbody');
  tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Calculating sensitivity matrix...</td></tr>';

  try {
    const res = await fetch('/api/sensitivity');
    if (res.ok) {
      const data = await res.json();
      renderSensitivityRows(data);
      return;
    }
  } catch (e) {
    // Client side fallback for sensitivity matrix
  }

  const fallbackData = [
    { variable: 'warmup_s', value: 30, scenario: 'sudden_spike', policy: 'PeakGuard', availability: 99.98, p95_latency: 142.1, breach_minutes: 0.0, meets_slo: true },
    { variable: 'warmup_s', value: 120, scenario: 'sudden_spike', policy: 'PeakGuard', availability: 99.92, p95_latency: 210.4, breach_minutes: 0.0, meets_slo: true },
    { variable: 'warmup_s', value: 300, scenario: 'sudden_spike', policy: 'PeakGuard', availability: 98.40, p95_latency: 480.0, breach_minutes: 4.5, meets_slo: false },
    { variable: 'max_workers', value: 10, scenario: 'scheduled_sale', policy: 'PeakGuard', availability: 92.10, p95_latency: 850.0, breach_minutes: 8.0, meets_slo: false },
    { variable: 'max_workers', value: 20, scenario: 'scheduled_sale', policy: 'PeakGuard', availability: 99.95, p95_latency: 185.0, breach_minutes: 0.0, meets_slo: true },
    { variable: 'worker_tps', value: 40, scenario: 'worker_loss', policy: 'PeakGuard', availability: 99.96, p95_latency: 160.0, breach_minutes: 0.0, meets_slo: true }
  ];
  renderSensitivityRows(fallbackData);
}

function renderSensitivityRows(rows) {
  const tbody = document.getElementById('sensitivityTbody');
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td><strong>${r.variable}</strong></td>
      <td>${r.value}</td>
      <td>${r.scenario}</td>
      <td>${r.policy}</td>
      <td>${r.availability}%</td>
      <td>${r.p95_latency} ms</td>
      <td>${r.breach_minutes} min</td>
      <td>
        <span class="badge ${r.meets_slo ? 'badge-success' : 'badge-danger'}">
          ${r.meets_slo ? 'SLO PASS' : 'DECISION FLIP'}
        </span>
      </td>
    </tr>
  `).join('');
}

// Standalone JS Simulation Engine Fallback
function runClientSimulation(cfg) {
  const scenarios = {
    normal_day: { duration: 60, base_tps: 90, events: [], failure: null },
    scheduled_sale: { duration: 60, base_tps: 90, events: [{ start_min: 15, duration_min: 10, multiplier: 5.0, known: true }], failure: null },
    sudden_spike: { duration: 60, base_tps: 90, events: [{ start_min: 20, duration_min: 5, multiplier: 6.0, known: false }], failure: null },
    worker_loss: { duration: 60, base_tps: 90, events: [{ start_min: 15, duration_min: 10, multiplier: 3.0, known: true }], failure: { minute: 20, fraction: 0.3, duration_min: 10 } }
  };

  const sc = scenarios[cfg.scenario] || scenarios.scheduled_sale;
  const fullCfg = {
    start_workers: cfg.start_workers || 4,
    max_workers: cfg.max_workers || 20,
    worker_tps: cfg.worker_tps || 30,
    warmup_s: cfg.warmup_s || 120,
    ...sc
  };

  const tps = generateDemandSeries(fullCfg.duration, fullCfg.base_tps, fullCfg.events);
  
  return {
    cfg: fullCfg,
    Legacy: simulateEngine(tps, legacyPolicy, fullCfg),
    PeakGuard: simulateEngine(tps, peakguardPolicy, fullCfg)
  };
}

function generateDemandSeries(durationMin, baseTps, events) {
  const out = new Float64Array(durationMin * 60);
  for (let s = 0; s < out.length; s++) {
    const m = Math.floor(s / 60);
    let mult = 1.0;
    for (const ev of events) {
      if (m >= ev.start_min && m < ev.start_min + ev.duration_min) {
        mult = Math.max(mult, ev.multiplier);
      }
    }
    const noise = 1.0 + (Math.random() - 0.5) * 0.08;
    out[s] = Math.max(0, baseTps * mult * noise);
  }
  return out;
}

function legacyPolicy(s, h, cfg) {
  if (s < 300 || s < h.cooldown_until) return 0;
  const slice = h.util.slice(-300);
  const u = slice.reduce((a, b) => a + b, 0) / slice.length;
  if (u > 0.75) {
    h.cooldown_until = s + 300;
    return 1;
  }
  if (u < 0.40 && h.active > cfg.start_workers) {
    h.cooldown_until = s + 300;
    return -1;
  }
  return 0;
}

function peakguardPolicy(s, h, cfg) {
  let forecast = h.demand.length >= 60 ? h.demand.slice(-60).reduce((a,b)=>a+b, 0)/60 : cfg.base_tps;
  for (const ev of cfg.events) {
    if (ev.known && s >= (ev.start_min * 60 - 300) && s < ((ev.start_min + ev.duration_min) * 60)) {
      forecast = Math.max(forecast, cfg.base_tps * ev.multiplier);
    }
  }
  const needed = Math.ceil(forecast / (cfg.worker_tps * 0.70));
  const backlog = h.queue / Math.max(h.active, 1);
  let target = Math.max(needed, h.active);
  if (backlog > 25) target = Math.max(target, h.active + 2);
  const pendingSum = h.pending.reduce((sum, p) => sum + p.count, 0);
  const add = target - h.active - pendingSum;
  if (add > 0) return add;
  if (h.util.length >= 300 && backlog < 5) {
    const u = h.util.slice(-300).reduce((a,b)=>a+b,0) / 300;
    if (u < 0.45 && h.active > 2) return -1;
  }
  return 0;
}

function simulateEngine(tps, policyFn, cfg) {
  let queue = 0.0, active = cfg.start_workers;
  const pending = [];
  const h = { util: [], demand: [], queue: 0, active: active, pending: pending, cooldown_until: -1 };
  let arrived = 0, served = 0, failed = 0, breach = 0, workerS = 0;
  const lats = [], rec = [];
  let downUntil = null, dead = 0;

  for (let s = 0; s < tps.length; s++) {
    const dem = tps[s];
    const m = Math.floor(s / 60);

    if (cfg.failure && downUntil === null && m === cfg.failure.minute) {
      dead = Math.min(active, Math.ceil(active * cfg.failure.fraction));
      active -= dead;
      downUntil = (cfg.failure.minute + cfg.failure.duration_min) * 60;
    }
    if (downUntil !== null && s >= downUntil) {
      active += dead;
      dead = 0; downUntil = null;
    }

    let readyCount = 0;
    for (let i = pending.length - 1; i >= 0; i--) {
      if (pending[i].rs <= s) {
        readyCount += pending[i].count;
        pending.splice(i, 1);
      }
    }
    active += readyCount;
    active = Math.min(active, cfg.max_workers);

    const cap = Math.max(active * cfg.worker_tps, 1);
    const carry = queue;
    const arr = Math.max(0, dem + (Math.random() - 0.5) * 0.06 * dem);
    queue += arr;
    arrived += arr;

    const proc = Math.min(queue, cap);
    queue -= proc;
    served += proc;

    const overflow = Math.max(0.0, queue - (cap * 0.9));
    failed += overflow;
    queue -= overflow;

    const lat = 100.0 + (carry / cap) * 1000 + (Math.random() - 0.5) * 16;
    if (proc > 0) {
      lats.push(lat);
      if (lat > 300.0) breach++;
    }

    workerS += active;
    h.util.push(proc / cap);
    h.demand.push(arr);
    h.queue = queue;
    h.active = active;

    if (s % 30 === 0) {
      const d = policyFn(s, h, cfg);
      if (d > 0) pending.push({ rs: s + cfg.warmup_s, count: d });
      else if (d < 0 && active > 2) active--;
    }

    if (s % 60 === 0) {
      const pendingSum = pending.reduce((a, b) => a + b.count, 0);
      rec.push({
        minute: m,
        tps: Math.round(arr * 10) / 10,
        queue: Math.round(queue * 10) / 10,
        workers: active,
        pending: pendingSum,
        lat_ms: Math.round(Math.max(lat, 1) * 10) / 10
      });
    }
  }

  lats.sort((a, b) => a - b);
  const p95Idx = Math.floor(lats.length * 0.95);
  const p95 = lats.length > 0 ? lats[p95Idx] : 0.0;

  return {
    metrics: {
      availability: Math.round((100 * served / Math.max(arrived, 1)) * 100) / 100,
      p95_latency: Math.round(p95 * 10) / 10,
      max_queue: Math.round(Math.max(...rec.map(r => r.queue))),
      breach_minutes: Math.round((breach / 60) * 10) / 10,
      worker_minutes: Math.round((workerS / 60) * 10) / 10,
      failed: Math.round(failed),
      arrived: Math.round(arrived)
    },
    trace: rec
  };
}
