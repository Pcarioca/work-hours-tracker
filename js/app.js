import { supabaseClient } from './supabaseClient.js';
import { addDays, formatDate, getMonday, isWeekday, parseLocalDate, weekdayName } from './dateUtils.js';
import { initEasterEggs, initSparkles, initWeatherEffects } from './fx.js';

const DEFAULT_TARGET = 4;
const weatherStatus = document.getElementById('weatherStatus');
const fxLayer = document.getElementById('fxLayer');
const secretHint = document.getElementById('secretHint');
const siteTitle = document.querySelector('h1');
const logo = document.querySelector('.logo');
const demoBtn = document.getElementById('demoBtn');
const demoNotice = document.getElementById('demoNotice');

// DOM references
const themeBtn = document.getElementById('themeBtn');
const excludeCurrentWeek = document.getElementById('excludeCurrentWeek');
const bankBadge = document.getElementById('bankBadge');
const bankScope = document.getElementById('bankScope');
const targetInput = document.getElementById('targetInput');
const targetLabel = document.getElementById('targetLabel');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const weekProgressFill = document.getElementById('weekProgressFill');
const weekProgressLabel = document.getElementById('weekProgressLabel');
const currentStreakStat = document.getElementById('currentStreakStat');
const bestStreakStat = document.getElementById('bestStreakStat');
const totalHoursStat = document.getElementById('totalHoursStat');
const avgDayStat = document.getElementById('avgDayStat');
const bestDayStat = document.getElementById('bestDayStat');
const fillTargetBtn = document.getElementById('fillTargetBtn');
const clearWeekBtn = document.getElementById('clearWeekBtn');

const loginArea = document.getElementById('loginArea');
const passwordInput = document.getElementById('passwordInput');
const unlockBtn = document.getElementById('unlockBtn');
const lockArea = document.getElementById('lockArea');
const lockBtn = document.getElementById('lockBtn');

const weekGrid = document.getElementById('weekGrid');
const currentTitle = document.getElementById('currentTitle');
const saveBtn = document.getElementById('saveBtn');
const weekHoursEl = document.getElementById('weekHours');
const weekDeltaEl = document.getElementById('weekDelta');

const startTimeEl = document.getElementById('startTime');
const endTimeEl = document.getElementById('endTime');
const addSessionBtn = document.getElementById('addSessionBtn');
const timerBtn = document.getElementById('timerBtn');
const timerStatus = document.getElementById('timerStatus');
const timerSaveBtn = document.getElementById('timerSaveBtn');

const monthPicker = document.getElementById('monthPicker');
const monthBody = document.getElementById('monthBody');
const saveMonthBtn = document.getElementById('saveMonthBtn');

const historyBody = document.getElementById('historyBody');

// State
let canEdit = false;
let allDays = {};
let dirtyDates = new Set();
let timerStart = null;
let timerInterval = null;
let dataReady = false;
let demoMode = false;
let demoSaveNotified = false;

// Hour helpers to keep displays human-friendly (no decimals on screen)
const MINUTES_PER_HOUR = 60;
function toMinutes(hours) {
  const n = Number(hours);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * MINUTES_PER_HOUR);
}

function formatHours(value) {
  const minutes = Math.abs(toMinutes(value));
  const h = Math.floor(minutes / MINUTES_PER_HOUR);
  const m = minutes % MINUTES_PER_HOUR;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatSignedHours(value, { includePlus = true } = {}) {
  if (!value) return '0h';
  const sign = value < 0 ? '-' : includePlus ? '+' : '';
  return `${sign}${formatHours(Math.abs(value))}`;
}

function getDailyTarget() {
  return Number(localStorage.getItem('wh_daily_target')) || DEFAULT_TARGET;
}

function setDailyTarget(value) {
  const val = Math.max(0, Number(value) || DEFAULT_TARGET);
  localStorage.setItem('wh_daily_target', String(val));
  targetInput.value = val;
  targetLabel.textContent = `${formatHours(val)} per day`;
  rebuildAllSummaries();
}

targetInput.addEventListener('change', () => setDailyTarget(targetInput.value));
setDailyTarget(getDailyTarget());

// Theme toggle
const storedTheme = localStorage.getItem('wh_theme');
if (storedTheme) {
  document.documentElement.setAttribute('data-theme', storedTheme);
}

themeBtn.onclick = () => {
  const root = document.documentElement;
  const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  root.setAttribute('data-theme', next);
  localStorage.setItem('wh_theme', next);
};

/* ---------------------------- Demo mode ---------------------------- */
// Create a lively mock dataset so the site can be previewed safely without touching
// production data (handy for GitHub Pages or quick demos).
function buildDemoDataset() {
  const sample = {};
  const today = new Date();
  const startMonday = getMonday(addDays(today, -14));
  const baseTarget = getDailyTarget();
  const weeklyPatterns = [
    [baseTarget + 0.5, baseTarget + 1, baseTarget - 0.5, baseTarget + 1.5, baseTarget - 0.25],
    [baseTarget + 1.25, baseTarget + 0.75, baseTarget - 0.25, baseTarget - 0.5, baseTarget + 1],
    [baseTarget - 0.5, baseTarget, baseTarget - 0.25, baseTarget + 0.75, baseTarget - 0.25],
  ];

  weeklyPatterns.forEach((week, idx) => {
    const base = addDays(startMonday, idx * 7);
    week.forEach((hours, dayIdx) => {
      sample[formatDate(addDays(base, dayIdx))] = Math.max(0, Math.round(hours * 4) / 4);
    });
  });

  return sample;
}

function enableDemoMode(reason = 'Demo mode: changes stay on this page only.') {
  demoMode = true;
  dataReady = true;
  canEdit = true;
  allDays = buildDemoDataset();
  dirtyDates = new Set();
  saveBtn.disabled = true;
  saveMonthBtn.disabled = true;
  if (demoNotice) {
    demoNotice.style.display = 'block';
    demoNotice.textContent = reason;
  }
  loginArea.style.display = 'none';
  lockArea.style.display = 'none';
  renderAfterDataLoad();
  updateEditability();
}

/* ----------------------- AUTH (server-side) ----------------------- */
async function tryUnlock() {
  const pwd = passwordInput.value || '';
  if (!pwd) {
    alert('Enter password.');
    return;
  }

  const { data, error } = await supabaseClient.rpc('verify_edit_password', { p_password: pwd });
  if (error) {
    console.error('verify_edit_password error:', error);
    alert('Auth error: ' + error.message);
    return;
  }

  if (data === true) {
    canEdit = true;
    localStorage.setItem('wh_edit_unlocked', '1');
    loginArea.style.display = 'none';
    lockArea.style.display = 'flex';
    updateEditability();
  } else {
    alert('Wrong password.');
  }
}

function lockEditing() {
  canEdit = false;
  localStorage.removeItem('wh_edit_unlocked');
  loginArea.style.display = 'flex';
  lockArea.style.display = 'none';
  updateEditability();
}

unlockBtn.onclick = tryUnlock;
lockBtn.onclick = lockEditing;

if (localStorage.getItem('wh_edit_unlocked') === '1') {
  canEdit = true;
  loginArea.style.display = 'none';
  lockArea.style.display = 'flex';
}

function updateEditability() {
  const alwaysAllowed = new Set([
    'themeBtn',
    'excludeCurrentWeek',
    'monthPicker',
    'unlockBtn',
    'passwordInput',
    'targetInput',
    'exportCsvBtn',
  ]);
  document.querySelectorAll('input,button').forEach((el) => {
    const id = el.id || '';
    if (alwaysAllowed.has(id)) return;

    if (!canEdit) {
      if (el.tagName === 'INPUT' || el.tagName === 'BUTTON') {
        el.disabled = true;
      }
    } else {
      el.disabled = false;
    }
  });

  if (!canEdit) {
    timerSaveBtn.disabled = true;
  }
}

function renderAfterDataLoad() {
  buildCurrentWeek();
  if (!monthPicker.value) {
    monthPicker.value = formatMonthValue(new Date());
  }
  refreshMonthView();
  buildHistory();
  updateInsights();
  updateEditability();
}

/* ---------------------------- Build current week ---------------------------- */
function buildCurrentWeek() {
  const today = new Date();
  const mon = getMonday(today);
  const fri = addDays(mon, 4);
  currentTitle.textContent = `This week (${mon.toLocaleDateString()} – ${fri.toLocaleDateString()})`;

  weekGrid.innerHTML = '';
  const names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  for (let i = 0; i < 5; i++) {
    const d = addDays(mon, i);
    const ds = formatDate(d);
    const hours = allDays[ds] ?? '';

    const div = document.createElement('div');
    div.className = 'day-card';
    div.innerHTML = `
      <label>${names[i]} <span class="muted">(${ds})</span></label>
      <input ${canEdit ? '' : 'disabled'} data-date="${ds}" type="number" step="0.25" min="0" value="${hours}">
      <div class="muted" style="margin-top:.25rem">
        Δ: <span id="delta-${ds}">${fmtDelta((Number(hours) || 0) - getDailyTarget())}</span>
      </div>
    `;
    const input = div.querySelector('input');
    input.oninput = () => handleHoursInputChange(ds, input.value);
    weekGrid.appendChild(div);
  }

  buildCurrentWeekSummary();
}

function handleHoursInputChange(ds, rawValue) {
  const v = rawValue === '' ? null : Number(rawValue);
  if (v === null || Number.isNaN(v)) {
    delete allDays[ds];
  } else {
    allDays[ds] = v;
  }
  dirtyDates.add(ds);
  saveBtn.disabled = false;
  saveMonthBtn.disabled = false;
  updateDeltaDisplays(ds);
  rebuildAllSummaries();
}

function fillMissingWeekdaysWithTarget() {
  if (!canEdit) {
    alert('Unlock editing to use this shortcut.');
    return;
  }
  if (!dataReady) {
    alert('Data is still loading. Please try again in a second.');
    return;
  }
  const today = new Date();
  const mon = getMonday(today);
  const target = getDailyTarget();
  const changed = [];
  for (let i = 0; i < 5; i++) {
    const ds = formatDate(addDays(mon, i));
    if (!Object.prototype.hasOwnProperty.call(allDays, ds)) {
      allDays[ds] = target;
      changed.push(ds);
      dirtyDates.add(ds);
    }
  }
  if (!changed.length) {
    alert('All weekdays already have entries.');
    return;
  }
  saveBtn.disabled = false;
  saveMonthBtn.disabled = false;
  buildCurrentWeek();
  rebuildAllSummaries();
}

function clearCurrentWeek() {
  if (!canEdit) {
    alert('Unlock editing to use this shortcut.');
    return;
  }
  if (!dataReady) {
    alert('Data is still loading. Please try again in a second.');
    return;
  }
  const today = new Date();
  const mon = getMonday(today);
  let cleared = 0;
  for (let i = 0; i < 5; i++) {
    const ds = formatDate(addDays(mon, i));
    if (Object.prototype.hasOwnProperty.call(allDays, ds)) {
      delete allDays[ds];
      dirtyDates.add(ds);
      cleared++;
    }
  }
  if (!cleared) {
    weekGrid.querySelectorAll('input').forEach((input) => (input.value = ''));
    alert('Nothing to clear for this week.');
    return;
  }
  saveBtn.disabled = false;
  saveMonthBtn.disabled = false;
  buildCurrentWeek();
  rebuildAllSummaries();
}

function updateDeltaDisplays(ds) {
  const delta = (Number(allDays[ds]) || 0) - getDailyTarget();
  const weekDelta = document.getElementById(`delta-${ds}`);
  if (weekDelta) {
    weekDelta.textContent = fmtDelta(delta);
  }
  const monthDelta = document.getElementById(`mdelta-${ds}`);
  if (monthDelta) {
    monthDelta.textContent = fmtDelta(delta);
  }
}

function buildCurrentWeekSummary() {
  const today = new Date();
  const mon = getMonday(today);
  let sum = 0;
  let delta = 0;
  const target = getDailyTarget();
  for (let i = 0; i < 5; i++) {
    const ds = formatDate(addDays(mon, i));
    const h = Number(allDays[ds]);
    if (!Number.isNaN(h)) {
      sum += h;
      delta += h - target;
    }
  }
  weekHoursEl.textContent = formatHours(sum);
  weekDeltaEl.textContent = ` (Δ week: ${formatSignedHours(delta)})`;
  updateWeekProgress(sum);
}

function updateWeekProgress(hoursWorked) {
  if (!weekProgressFill || !weekProgressLabel) return;
  const target = getDailyTarget();
  const weeklyGoal = target * 5;
  const pct = weeklyGoal === 0 ? 0 : Math.min(100, Math.round((hoursWorked / weeklyGoal) * 100));
  weekProgressFill.style.width = `${pct}%`;
  weekProgressFill.setAttribute('aria-valuenow', String(pct));
  weekProgressLabel.textContent =
    weeklyGoal === 0
      ? `${formatHours(hoursWorked)} recorded (no target set)`
      : `${formatHours(hoursWorked)} of ${formatHours(weeklyGoal)} (${pct}%)`;
}

/* ---------------------------- Month editor ---------------------------- */
function buildMonth(year, monthIdx) {
  monthBody.innerHTML = '';
  const first = new Date(year, monthIdx, 1);
  const days = new Date(year, monthIdx + 1, 0).getDate();
  for (let d = 1; d <= days; d++) {
    const date = new Date(year, monthIdx, d);
    const ds = formatDate(date);
    const h = allDays[ds] ?? '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${ds}</td>
      <td>${weekdayName(date)}</td>
      <td><input ${canEdit ? '' : 'disabled'} data-date="${ds}" type="number" step="0.25" min="0" value="${h}" style="width:7rem"></td>
      <td class="muted" id="mdelta-${ds}">${fmtDelta((Number(h) || 0) - getDailyTarget())}</td>
    `;
    const input = tr.querySelector('input');
    input.oninput = () => {
      const value = input.value === '' ? null : Number(input.value);
      if (value === null || Number.isNaN(value)) {
        delete allDays[ds];
      } else {
        allDays[ds] = value;
      }
      dirtyDates.add(ds);
      saveMonthBtn.disabled = true;
      clearTimeout(buildMonth._t);
      buildMonth._t = setTimeout(() => (saveMonthBtn.disabled = false), 300);
      updateDeltaDisplays(ds);
      rebuildAllSummaries();
    };
    monthBody.appendChild(tr);
  }
}

function refreshMonthView() {
  if (!monthPicker.value) return;
  const [y, m] = monthPicker.value.split('-').map(Number);
  if (!y || !m) return;
  buildMonth(y, m - 1);
}

monthPicker.onchange = refreshMonthView;

/* ---------------------------- Timer + sessions ---------------------------- */
function tickTimer() {
  if (!timerStart) {
    timerStatus.textContent = '00:00:00';
    return;
  }
  const ms = Date.now() - timerStart;
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  timerStatus.textContent = `${h}:${m}:${sec}`;
}

timerBtn.onclick = () => {
  if (!canEdit || timerStart) return;
  timerStart = Date.now();
  localStorage.setItem('wh_timer_start', String(timerStart));
  timerInterval = setInterval(tickTimer, 500);
  tickTimer();
  timerBtn.textContent = 'Running…';
  timerSaveBtn.disabled = false;
};

timerSaveBtn.onclick = async () => {
  if (!canEdit || !timerStart) return;
  const durH = (Date.now() - timerStart) / (1000 * 60 * 60);
  timerStart = null;
  clearInterval(timerInterval);
  timerInterval = null;
  localStorage.removeItem('wh_timer_start');
  timerBtn.textContent = 'Start timer';
  timerStatus.textContent = '00:00:00';
  timerSaveBtn.disabled = true;

  const ds = formatDate(new Date());
  const prev = Number(allDays[ds]) || 0;
  allDays[ds] = prev + durH;
  dirtyDates.add(ds);
  await saveDates([ds]);
};

const restored = Number(localStorage.getItem('wh_timer_start') || '0');
if (restored > 0) {
  timerStart = restored;
  timerInterval = setInterval(tickTimer, 500);
  tickTimer();
  timerBtn.textContent = 'Running…';
  timerSaveBtn.disabled = false;
}

addSessionBtn.onclick = async () => {
  if (!canEdit) return;
  const s = startTimeEl.value;
  const e = endTimeEl.value;
  if (!s || !e) {
    alert('Pick start and end times.');
    return;
  }
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  let start = new Date();
  start.setHours(sh, sm, 0, 0);
  let end = new Date();
  end.setHours(eh, em, 0, 0);
  if (end <= start) {
    end = new Date(end.getTime() + 24 * 3600 * 1000);
  }
  const durH = (end - start) / (1000 * 60 * 60);
  const ds = formatDate(new Date());
  allDays[ds] = (Number(allDays[ds]) || 0) + durH;
  dirtyDates.add(ds);
  startTimeEl.value = '';
  endTimeEl.value = '';
  await saveDates([ds]);
};

/* ---------------------------- History / bank ---------------------------- */
function fmtDelta(n) {
  return formatSignedHours(n);
}

function buildHistory() {
  const today = new Date();
  const currentMon = getMonday(today);
  const includeCurrent = !excludeCurrentWeek.checked;
  const target = getDailyTarget();

  const keys = Object.keys(allDays).sort();
  const dayRows = [];
  for (const ds of keys) {
    const d = parseLocalDate(ds);
    if (!isWeekday(d)) continue;
    const weekMon = getMonday(d);
    if (!includeCurrent && weekMon.getTime() === currentMon.getTime()) continue;
    const h = Number(allDays[ds]) || 0;
    dayRows.push({ date: ds, weekMon, hours: h, delta: h - target });
  }

  const byWeek = new Map();
  for (const r of dayRows) {
    const key = formatDate(r.weekMon);
    if (!byWeek.has(key)) byWeek.set(key, { mon: r.weekMon, totalH: 0, totalDelta: 0 });
    const w = byWeek.get(key);
    w.totalH += r.hours;
    w.totalDelta += r.delta;
  }
  const weeks = Array.from(byWeek.values()).sort((a, b) => a.mon - b.mon);

  let bank = 0;
  for (const r of dayRows) bank += r.delta;

  bankScope.textContent = includeCurrent ? '(including current week)' : '(excluding current week)';
  bankBadge.className = 'badge ' + (bank < 0 ? 'red' : bank === 0 ? 'yellow' : 'green');
  bankBadge.textContent =
    bank < 0 ? `${formatHours(Math.abs(bank))} in debt` : bank === 0 ? '0h in bank' : `${formatSignedHours(bank)} in bank`;

  historyBody.innerHTML = '';
  if (!weeks.length) {
    historyBody.innerHTML = '<tr><td colspan="4">No past data.</td></tr>';
    return;
  }

  let wkBank = 0;
  for (const w of weeks) {
    wkBank += w.totalDelta;
    const fri = addDays(w.mon, 4);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${w.mon.toLocaleDateString()} – ${fri.toLocaleDateString()}</td>
      <td>${formatHours(w.totalH)}</td>
      <td>${formatSignedHours(w.totalDelta)}</td>
      <td>${formatSignedHours(wkBank)}</td>
    `;
    historyBody.appendChild(tr);
  }
}

function computeStreaks(entries, target) {
  let running = 0;
  let best = 0;
  let latestRunning = 0;
  let prevHitDate = null;
  const dayMs = 24 * 60 * 60 * 1000;

  const isNextBusinessDay = (prev, current) => {
    const diffDays = Math.round((current - prev) / dayMs);
    if (diffDays === 1) return true;
    if (prev.getDay() === 5 && current.getDay() === 1 && diffDays === 3) return true;
    return false;
  };

  entries.forEach((entry, idx) => {
    if (entry.hours >= target) {
      if (prevHitDate && isNextBusinessDay(prevHitDate, entry.date)) {
        running += 1;
      } else {
        running = 1;
      }
      prevHitDate = entry.date;
    } else {
      running = 0;
      prevHitDate = null;
    }
    if (running > best) best = running;
    if (idx === entries.length - 1) {
      latestRunning = running;
    }
  });

  return { currentStreak: latestRunning, bestStreak: best };
}

function updateInsights() {
  if (!currentStreakStat) return;
  const target = getDailyTarget();
  const entries = Object.keys(allDays)
    .map((ds) => ({
      ds,
      hours: Number(allDays[ds]) || 0,
      date: parseLocalDate(ds),
    }))
    .filter((entry) => isWeekday(entry.date))
    .sort((a, b) => a.date - b.date);

  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const recordedDays = new Set(entries.map((entry) => entry.ds)).size;
  const avgDay = recordedDays ? totalHours / recordedDays : 0;
  totalHoursStat.textContent = formatHours(totalHours);
  avgDayStat.textContent = formatHours(avgDay);

  const productiveEntries = entries.filter((entry) => entry.hours > 0);
  if (productiveEntries.length) {
    const bestDay = productiveEntries.reduce((best, entry) =>
      entry.hours > best.hours ? entry : best
    );
    bestDayStat.textContent = `Best day: ${weekdayName(bestDay.date)} ${bestDay.ds} at ${formatHours(
      bestDay.hours
    )}`;
  } else {
    bestDayStat.textContent = 'Best day: —';
  }

  const { currentStreak, bestStreak } = computeStreaks(entries, target);
  currentStreakStat.textContent = formatDays(currentStreak);
  bestStreakStat.textContent = formatDays(bestStreak);
}

function formatDays(count) {
  return `${count} day${count === 1 ? '' : 's'}`;
}

/* ---------------------------- Save/load ---------------------------- */
async function saveDates(dateList) {
  if (!canEdit) {
    alert('Unlock to edit.');
    return;
  }
  if (!dateList.length) return;
  if (demoMode) {
    [...dateList].forEach((ds) => dirtyDates.delete(ds));
    saveBtn.disabled = dirtyDates.size === 0;
    saveMonthBtn.disabled = dirtyDates.size === 0;
    renderAfterDataLoad();
    if (!demoSaveNotified) {
      alert('Demo mode: changes are kept locally so you can explore safely.');
      demoSaveNotified = true;
    }
    return;
  }
  const upserts = [];
  const deletes = [];

  dateList.forEach((ds) => {
    if (!ds) return;
    if (Object.prototype.hasOwnProperty.call(allDays, ds)) {
      const val = Number(allDays[ds]);
      if (!Number.isNaN(val)) {
        upserts.push({ work_date: ds, hours: val });
      }
    } else {
      deletes.push(ds);
    }
  });

  if (!upserts.length && !deletes.length) return;

  if (upserts.length) {
    const { error } = await supabaseClient.from('work_log').upsert(upserts, { onConflict: 'work_date' });
    if (error) {
      console.error('Save error:', error);
      alert('Save error: ' + error.message);
      return;
    }
  }

  if (deletes.length) {
    const { error } = await supabaseClient.from('work_log').delete().in('work_date', deletes);
    if (error) {
      console.error('Delete error:', error);
      alert('Delete error: ' + error.message);
      return;
    }
  }

  [...dateList].forEach((ds) => dirtyDates.delete(ds));
  saveBtn.disabled = dirtyDates.size === 0;
  saveMonthBtn.disabled = dirtyDates.size === 0;
  await loadAll();
}

saveBtn.onclick = async () => {
  await saveDates(Array.from(dirtyDates));
};
saveMonthBtn.onclick = async () => {
  await saveDates(Array.from(dirtyDates));
};
excludeCurrentWeek.onchange = () => buildHistory();

async function loadAll() {
  if (demoMode) {
    renderAfterDataLoad();
    return;
  }
  dataReady = false;
  const { data, error } = await supabaseClient
    .from('work_log')
    .select('work_date, hours')
    .order('work_date', { ascending: true });

  if (error) {
    console.error('Supabase error:', error);
    enableDemoMode('Demo mode: database unreachable, so a safe preview is loaded.');
    return;
  }
  allDays = {};
  data.forEach((r) => (allDays[r.work_date] = Number(r.hours)));

  dirtyDates = new Set();
  saveBtn.disabled = true;
  saveMonthBtn.disabled = true;
  dataReady = true;
  monthPicker.value = monthPicker.value || formatMonthValue(new Date());
  renderAfterDataLoad();
}

function rebuildAllSummaries() {
  buildCurrentWeekSummary();
  buildHistory();
  refreshMonthView();
  updateInsights();
}

exportCsvBtn.onclick = () => {
  const keys = Object.keys(allDays).sort();
  if (!keys.length) {
    alert('No data to export.');
    return;
  }
  const target = getDailyTarget();
  const rows = ['date,hours,delta_vs_target'];
  keys.forEach((ds) => {
    const hours = Number(allDays[ds]) || 0;
    const delta = hours - target;
    rows.push(`${ds},${formatHours(hours)},${formatSignedHours(delta, { includePlus: true })}`);
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'work-hours.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

if (fillTargetBtn) fillTargetBtn.onclick = fillMissingWeekdaysWithTarget;
if (clearWeekBtn) clearWeekBtn.onclick = clearCurrentWeek;

function formatMonthValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// Init
if (demoBtn) {
  demoBtn.onclick = () => enableDemoMode('Demo mode: preview without touching real data.');
}

const urlParams = new URLSearchParams(window.location.search);
const demoRequested = urlParams.get('demo') === '1';

if (demoRequested) {
  enableDemoMode('Demo mode requested via ?demo=1. Enjoy the tour!');
} else {
  loadAll();
}

// Playful extras
const sparkleControl = initSparkles();
initEasterEggs({
  siteTitle,
  logo,
  secretHint,
  onSecretToggle: (enabled) => {
    document.body.classList.toggle('cozy-mode', enabled);
  },
});

if (bankBadge) {
  let bankClicks = 0;
  bankBadge.addEventListener('click', (event) => {
    bankClicks += 1;
    if (bankClicks % 4 === 0) {
      sparkleControl.spawnSparkles(event.clientX || 0, event.clientY || 0, 12);
      bankBadge.classList.add('wiggle');
      setTimeout(() => bankBadge.classList.remove('wiggle'), 600);
    }
  });
}

initWeatherEffects({
  statusEl: weatherStatus,
  layerEl: fxLayer,
  onMood: (mood) => {
    document.body.dataset.weatherMood = mood;
  },
});
