// ===========================
// RupeeTracker — app.js
// ===========================

const STORAGE_KEY = 'rupeetracker_v1';

const CATEGORIES = {
  food:         { label: 'Food & Drinks',   emoji: '🍱', color: '#f7b731' },
  transport:    { label: 'Transport',        emoji: '🚌', color: '#5ccee0' },
  education:    { label: 'Education',        emoji: '📚', color: '#a78bfa' },
  entertainment:{ label: 'Entertainment',    emoji: '🎮', color: '#f97316' },
  health:       { label: 'Health',           emoji: '💊', color: '#5ce07a' },
  salary:       { label: 'Salary/Income',    emoji: '💰', color: '#5ce07a' },
  others:       { label: 'Others',           emoji: '📌', color: '#8888a0' },
};

// ---- State ----
let transactions = loadFromStorage();
let filterMonth = '';

// ---- DOM refs ----
const form         = document.getElementById('tx-form');
const listEl       = document.getElementById('tx-list');
const incomeEl     = document.getElementById('total-income');
const expenseEl    = document.getElementById('total-expense');
const balanceEl    = document.getElementById('balance');
const monthFilter  = document.getElementById('month-filter');
const chartEl      = document.getElementById('category-chart');
const themeBtn     = document.getElementById('theme-toggle');

// ---- Init ----
renderAll();
setDefaultMonth();

// ---- Theme toggle ----
const savedTheme = localStorage.getItem('rt_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
themeBtn.textContent = savedTheme === 'dark' ? '☀️ Light' : '🌙 Dark';

themeBtn.addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('rt_theme', next);
  themeBtn.textContent = next === 'dark' ? '☀️ Light' : '🌙 Dark';
});

// ---- Add transaction ----
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const desc     = document.getElementById('desc').value.trim();
  const amount   = parseFloat(document.getElementById('amount').value);
  const category = document.getElementById('category').value;
  const date     = document.getElementById('date').value;
  const type     = document.querySelector('input[name="type"]:checked').value;

  if (!desc || isNaN(amount) || amount <= 0 || !date) return;

  const tx = {
    id: Date.now(),
    desc, amount, category, date, type,
  };

  transactions.unshift(tx);
  saveToStorage();
  renderAll();
  form.reset();
  setDefaultMonth();
});

// ---- Month filter ----
monthFilter.addEventListener('change', () => {
  filterMonth = monthFilter.value;
  renderAll();
});

// ---- Render everything ----
function renderAll() {
  const filtered = filterMonth
    ? transactions.filter(tx => tx.date.startsWith(filterMonth))
    : transactions;

  renderSummary(filtered);
  renderList(filtered);
  renderChart(filtered);
}

function renderSummary(txs) {
  const income  = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  incomeEl.textContent  = '₹' + fmt(income);
  expenseEl.textContent = '₹' + fmt(expense);
  balanceEl.textContent = '₹' + fmt(balance);
}

function renderList(txs) {
  if (!txs.length) {
    listEl.innerHTML = `
      <div class="empty-state">
        <div class="emoji">💸</div>
        <p>No transactions yet. Add one above!</p>
      </div>`;
    return;
  }

  listEl.innerHTML = txs.map(tx => {
    const cat = CATEGORIES[tx.category] || CATEGORIES.others;
    return `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-icon" style="background:${cat.color}22">${cat.emoji}</div>
          <div>
            <div class="tx-name">${escHtml(tx.desc)}</div>
            <div class="tx-meta">${cat.label} · ${formatDate(tx.date)}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center">
          <span class="tx-amount ${tx.type}">
            ${tx.type === 'income' ? '+' : '−'}₹${fmt(tx.amount)}
          </span>
          <button class="delete-btn" onclick="deleteTx(${tx.id})" title="Delete">✕</button>
        </div>
      </div>`;
  }).join('');
}

function renderChart(txs) {
  const totals = {};
  txs.filter(t => t.type === 'expense').forEach(t => {
    totals[t.category] = (totals[t.category] || 0) + t.amount;
  });

  const totalExp = Object.values(totals).reduce((a, b) => a + b, 0);

  if (!totalExp) {
    chartEl.innerHTML = '<div style="color:var(--muted);font-size:0.88rem;padding:8px 0">No expenses to show.</div>';
    return;
  }

  chartEl.innerHTML = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => {
      const c = CATEGORIES[cat] || CATEGORIES.others;
      const pct = Math.round((amt / totalExp) * 100);
      return `
        <div class="bar-label-row">
          <span>${c.emoji} ${c.label}</span>
          <span>₹${fmt(amt)} (${pct}%)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%;background:${c.color}"></div>
        </div>`;
    }).join('');
}

// ---- Delete ----
function deleteTx(id) {
  transactions = transactions.filter(t => t.id !== id);
  saveToStorage();
  renderAll();
}

// ---- Export CSV ----
function exportCSV() {
  const rows = [['Date', 'Description', 'Category', 'Type', 'Amount (₹)']];
  transactions.forEach(t => {
    rows.push([t.date, t.desc, CATEGORIES[t.category]?.label || t.category, t.type, t.amount]);
  });
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'rupeetracker_export.csv';
  a.click();
}

// ---- Helpers ----
function fmt(n) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function setDefaultMonth() {
  const now = new Date();
  const val = now.toISOString().slice(0, 7);
  monthFilter.value = val;
  filterMonth = val;
  document.getElementById('date').value = now.toISOString().slice(0, 10);
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function loadFromStorage() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
