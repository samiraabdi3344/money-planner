"use strict";

const KEYS = {
  transactions: "money-dashboard-transactions",
  plan: "money-dashboard-plan",
  allocations: "money-dashboard-allocations",
  bills: "money-dashboard-bills",
  budget: "money-dashboard-budget",
  categories: "money-dashboard-categories",
  categoryBudgets: "money-dashboard-category-budgets",
  goals: "money-dashboard-goals",
  subscriptions: "money-dashboard-subscriptions",
  debts: "money-dashboard-debts",
  debtPlan: "money-dashboard-debt-plan",
  layout: "money-dashboard-layout",
  challenges: "money-dashboard-challenges",
  notifyPrefs: "money-dashboard-notify-prefs",
  lastBackup: "money-dashboard-last-backup",
  period: "money-dashboard-period",
  seeded: "money-dashboard-seeded",
  theme: "money-dashboard-theme"
};

const DEFAULT_BUDGET = 1200;
const FACTORS = { month: 1, fortnight: 12 / 26, week: 12 / 52 };
const THEMES = [
  "theme-botanical-light", "theme-botanical-dark",
  "theme-celestial-light", "theme-celestial-dark",
  "theme-ocean-light", "theme-ocean-dark",
  "theme-meadow-light", "theme-meadow-dark",
  "theme-berry-light", "theme-berry-dark"
];
const $ = (id) => document.getElementById(id);
const uid = () => crypto.randomUUID();

function load(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch (error) {
    console.error(`Could not load ${key}:`, error);
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save ${key}:`, error);
    showMessage("backup-message", "Could not save data. Check your browser storage space.");
  }
}
function money(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function pad(value) { return String(value).padStart(2, "0"); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
function addDays(date, count) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + count * 86400000).toISOString().slice(0, 10);
}
function shiftMonth(date, count) {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7)) - 1 + count;
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}
function formatDate(date, options) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
}
function showMessage(id, text) {
  const node = $(id);
  if (node) node.textContent = text;
}
function saveTransactions() { save(KEYS.transactions, transactions); }
function saveBills() { save(KEYS.bills, bills); }
function savePlan() { save(KEYS.allocations, allocations); }
function validAmount(value, allowZero = false) {
  const amount = Number(value);
  return Number.isFinite(amount) && (allowZero ? amount >= 0 : amount > 0) ? amount : null;
}

function cleanTransaction(item) {
  if (!item || !["income", "expense"].includes(item.type) ||
      !validAmount(item.amount) || !validDate(item.date)) return null;
  return {
    id: String(item.id || uid()),
    type: item.type,
    amount: Number(item.amount),
    description: String(item.description || "Untitled"),
    category: String(item.category || "Other"),
    date: item.date,
    notes: String(item.notes || ""),
    ...(item.billId ? { billId: String(item.billId), billDue: item.billDue || item.date } : {})
  };
}
function cleanBill(item) {
  if (!item || !String(item.name || "").trim() ||
      !validAmount(item.amount) || !validDate(item.due)) return null;
  return {
    id: String(item.id || uid()),
    name: String(item.name).trim(),
    amount: Number(item.amount),
    due: item.due,
    recurring: Boolean(item.recurring)
  };
}

let transactions = (Array.isArray(load(KEYS.transactions, []))
  ? load(KEYS.transactions, []).map(cleanTransaction).filter(Boolean) : []);
let bills = (Array.isArray(load(KEYS.bills, null))
  ? load(KEYS.bills, []).map(cleanBill).filter(Boolean) : []);
let allocations = load(KEYS.allocations, null);
let categories = load(KEYS.categories, ["Bills", "Eating out", "Groceries", "Income", "Other", "Transport"]);
let categoryBudgets = load(KEYS.categoryBudgets, []);
let goals = load(KEYS.goals, []);
let subscriptions = load(KEYS.subscriptions, []);
let debts = load(KEYS.debts, []);
let debtPlan = load(KEYS.debtPlan, {});
let chartMode = "bars";
let challenges = load(KEYS.challenges, {});
let layout = load(KEYS.layout, {});
let notifyPrefs = load(KEYS.notifyPrefs, {});
let monthlyBudget = validAmount(load(KEYS.budget, DEFAULT_BUDGET), true) ?? DEFAULT_BUDGET;
let periodType = load(KEYS.period, "month");
if (!FACTORS[periodType]) periodType = "month";
let periodAnchor = today();

if (!Array.isArray(allocations)) {
  const oldPlan = load(KEYS.plan, null);
  allocations = oldPlan && validAmount(oldPlan.amount)
    ? [{ id: uid(), name: String(oldPlan.note || "Savings"), type: "savings", amount: Number(oldPlan.amount) }]
    : [];
  savePlan();
}
if (!Array.isArray(categories)) categories = [];
if (!Array.isArray(categoryBudgets)) categoryBudgets = [];
if (!Array.isArray(goals)) goals = [];
if (!Array.isArray(subscriptions)) subscriptions = [];
for (const key of ["challenges", "layout", "notifyPrefs"]) {
  const value = { challenges, layout, notifyPrefs }[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    if (key === "challenges") challenges = {}; else if (key === "layout") layout = {}; else notifyPrefs = {};
  }
}

if (localStorage.getItem(KEYS.seeded) === null) {
  if (!transactions.length) {
    const month = today().slice(0, 7);
    const day = (n) => `${month}-${pad(Math.min(n, Number(today().slice(8, 10))))}`;
    transactions = [
      { id: uid(), type: "income", amount: 1200, description: "Monthly pay", category: "Income", date: day(1), notes: "" },
      { id: uid(), type: "expense", amount: 42, description: "Groceries", category: "Groceries", date: day(3), notes: "" },
      { id: uid(), type: "expense", amount: 20, description: "Bus pass", category: "Transport", date: day(5), notes: "" },
      { id: uid(), type: "expense", amount: 8, description: "Coffee", category: "Eating out", date: day(5), notes: "" }
    ];
    saveTransactions();
  }
  localStorage.setItem(KEYS.seeded, "1");
}
if (!Array.isArray(load(KEYS.bills, null))) {
  const m = today().slice(0, 7);
  bills = [
    { id: uid(), name: "Rent", amount: 400, due: `${m}-28`, recurring: true },
    { id: uid(), name: "Phone", amount: 45, due: `${m}-20`, recurring: true },
    { id: uid(), name: "Internet", amount: 60, due: `${m}-25`, recurring: true }
  ];
  saveBills();
}

function periodRange(type = periodType, anchor = periodAnchor) {
  if (type === "week") {
    const start = addDays(anchor, -((new Date(`${anchor}T00:00:00Z`).getUTCDay() + 6) % 7));
    return { start, end: addDays(start, 6) };
  }
  if (type === "fortnight") {
    const epoch = "2024-01-01";
    const days = Math.round((Date.parse(`${anchor}T00:00:00Z`) - Date.parse(`${epoch}T00:00:00Z`)) / 86400000);
    const start = addDays(epoch, Math.floor(days / 14) * 14);
    return { start, end: addDays(start, 13) };
  }
  const start = `${anchor.slice(0, 7)}-01`;
  return { start, end: addDays(shiftMonth(anchor, 1), -1) };
}
function stepPeriod(step) {
  periodAnchor = periodType === "month"
    ? shiftMonth(periodAnchor, step)
    : addDays(periodAnchor, step * (periodType === "week" ? 7 : 14));
  render();
}
function rangeTransactions(range = periodRange()) {
  return transactions.filter((item) => item.date >= range.start && item.date <= range.end);
}
function labelPeriod(range) {
  if (periodType === "month") return formatDate(range.start, { month: "long", year: "numeric" });
  return `${formatDate(range.start, { day: "numeric", month: "short" })} – ${formatDate(range.end, { day: "numeric", month: "short", year: "numeric" })}`;
}

function billOccurrences(range) {
  const result = [];
  bills.forEach((bill) => {
    const dueDates = [];
    if (!bill.recurring) {
      dueDates.push(bill.due);
    } else {
      const dueDay = Number(bill.due.slice(8, 10));
      let month = `${range.start.slice(0, 7)}-01`;
      while (month <= range.end) {
        const y = Number(month.slice(0, 4));
        const m = Number(month.slice(5, 7));
        const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const due = `${month.slice(0, 7)}-${pad(Math.min(dueDay, last))}`;
        if (due >= bill.due) dueDates.push(due);
        month = shiftMonth(month, 1);
      }
    }
    dueDates.filter((date) => date >= range.start && date <= range.end).forEach((date) => {
      const payment = transactions.find((item) => item.billId === bill.id && item.billDue === date);
      result.push({ bill, date, paid: Boolean(payment) });
    });
  });
  return result.sort((a, b) => a.date.localeCompare(b.date));
}

function periodTotals() {
  const range = periodRange();
  const items = rangeTransactions(range);
  const factor = FACTORS[periodType];
  const spent = items.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0);
  const income = items.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const reserved = allocations.filter((a) => a.type !== "bill")
    .reduce((sum, a) => sum + Number(a.amount || 0), 0) * factor;
  const unpaidBills = billOccurrences(range).filter((b) => !b.paid)
    .reduce((sum, b) => sum + b.bill.amount, 0);
  const budget = monthlyBudget * factor;
  const remaining = budget - spent;
  return {
    budget, spent, income, remaining, reserved, unpaidBills,
    available: remaining - reserved - unpaidBills
  };
}

/* Dashboard summary, allocations and bills */
function renderSummary() {
  const t = periodTotals();
  const values = {
    "budget-total": t.budget,
    "spent-total": t.spent,
    "remaining-total": t.remaining,
    "available-to-plan": t.available,
    "planned-amount-total": t.reserved,
    "bills-allocated": t.unpaidBills
  };
  Object.entries(values).forEach(([id, value]) => { if ($(id)) $(id).textContent = money(value); });
  if ($("budget-note")) $("budget-note").textContent =
    `Income this period: ${money(t.income)}${periodType === "month" ? "" : ` · Share of ${money(monthlyBudget)}/month`}`;
  if ($("period-type")) $("period-type").value = periodType;
  const r = periodRange();
  if ($("period-label")) $("period-label").textContent = labelPeriod(r);
  renderSafeToSpend(t);
}
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);
}
function renderSafeToSpend(t) {
  const strong = $("safe-daily");
  if (!strong) return;
  const range = periodRange();
  const now = today();
  if (now > range.end) {
    strong.textContent = money(0);
    $("safe-note").textContent = "This period has ended";
    return;
  }
  const first = now > range.start ? now : range.start;
  const days = daysBetween(first, range.end) + 1;
  const spentToday = transactions.filter((x) => x.type === "expense" && x.date === now).reduce((sum, x) => sum + x.amount, 0);
  const pool = t.available + (now >= range.start ? spentToday : 0);
  if (pool <= 0) {
    strong.textContent = money(0);
    $("safe-note").textContent = "Nothing left to assign this period";
    return;
  }
  const allowance = pool / days;
  const left = now >= range.start ? allowance - spentToday : allowance;
  strong.textContent = money(Math.max(0, left));
  $("safe-note").textContent = `${money(allowance)} a day · ${days} day${days === 1 ? "" : "s"} left · ${money(allowance * 7)} a week`;
}
function renderAllocations() {
  const list = $("allocation-list");
  if (list) {
    list.innerHTML = allocations.length ? allocations.map((a) => `
      <li><span>${esc(a.name)} <small>${esc(a.type || "savings")}</small></span>
      <strong>${money(a.amount)}</strong>
      <span class="transaction-actions">
        <button class="mini-btn edit-allocation" data-id="${esc(a.id)}" type="button">Edit</button>
        <button class="mini-btn delete-allocation" data-id="${esc(a.id)}" type="button">Delete</button>
      </span></li>`).join("") : `<li class="empty-state">No plan allocations yet.</li>`;
  }
  const note = $("planned-note-display");
  if (note) note.textContent = allocations.length
    ? allocations.map((a) => a.name).join(", ") : "No allocations yet.";
}
function renderBills() {
  const list = $("upcoming-bills-list");
  if (!list) return;
  const items = billOccurrences(periodRange());
  list.innerHTML = items.length ? items.map(({ bill, date, paid }) => `
    <li class="${paid ? "is-paid" : ""}">
      <span class="bill-name">${esc(bill.name)}<time datetime="${date}">${formatDate(date, { day: "numeric", month: "short" })}${bill.recurring ? " · monthly" : ""}</time></span>
      <strong>${money(bill.amount)}</strong>
      <span class="bill-actions">
        <button class="mini-btn pay-bill" data-id="${esc(bill.id)}" data-date="${date}" type="button">${paid ? "Undo" : "Mark paid"}</button>
        <button class="mini-btn edit-bill" data-id="${esc(bill.id)}" type="button">Edit</button>
        <button class="mini-btn delete-bill" data-id="${esc(bill.id)}" type="button">Delete</button>
      </span>
    </li>`).join("") : `<li class="empty-state">No bills due in this period.</li>`;
}

/* Transactions and expandable daily spending */
function row(item, withMeta = false) {
  const meta = withMeta ? `<small class="transaction-meta">${formatDate(item.date, { day: "numeric", month: "short", year: "numeric" })} · ${esc(item.category)}</small>` : "";
  return `<li><div class="transaction-info"><span>${esc(item.description)}${meta}</span>
    <strong>${item.type === "expense" ? "-" : "+"}${money(item.amount)}</strong></div>
    <span class="transaction-actions">
      <button class="mini-btn edit-transaction" data-id="${esc(item.id)}" type="button">Edit</button>
      <button class="mini-btn delete-transaction" data-id="${esc(item.id)}" type="button">Delete</button>
    </span></li>`;
}
function renderTransactions() {
  const recent = $("recent-transactions-list");
  if (recent) {
    const items = rangeTransactions().slice().reverse().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    recent.innerHTML = items.length ? items.map((item) => row(item)).join("")
      : `<li class="empty-state">No transactions in this period.</li>`;
  }

  const container = $("spending-by-date-list");
  if (container) {    const groups = {};
    rangeTransactions().filter((t) => t.type === "expense").forEach((t) => {
      groups[t.date] = (groups[t.date] || 0) + t.amount;
    });
    const dates = Object.keys(groups).sort().reverse().slice(0, 5);
    container.innerHTML = dates.length ? dates.map((date, index) => `
      <details class="details-spending" ${index === 0 ? "open" : ""}>
        <summary><span>${formatDate(date, { day: "numeric", month: "short" })}</span><strong>${money(groups[date])}</strong></summary>
        <ul class="mini-list">${rangeTransactions().filter((t) => t.type === "expense" && t.date === date)
          .map((t) => `<li>${esc(t.description)} <span>${money(t.amount)}</span></li>`).join("")}</ul>
      </details>`).join("") : `<p class="empty-state">No spending in this period.</p>`;
  }
}
$("spending-by-date-list")?.addEventListener("toggle", (event) => {
  if (event.target.open) event.currentTarget.querySelectorAll("details").forEach((d) => {
    if (d !== event.target) d.open = false;
  });
}, true);

/* Category creation, limits, progress and warnings */
function rememberCategory(name) {
  const clean = String(name || "").trim();
  if (clean && !categories.some((c) => c.toLowerCase() === clean.toLowerCase())) {
    categories.push(clean);
    categories.sort((a, b) => a.localeCompare(b));
    save(KEYS.categories, categories);
  }
  renderCategoryOptions();
}
function renderCategoryOptions() {
  const datalist = $("category-options");
  if (datalist) datalist.innerHTML = categories.map((c) => `<option value="${esc(c)}"></option>`).join("");
  const select = $("history-category");
  if (select) {
    const selected = select.value || "all";
    select.innerHTML = `<option value="all">All categories</option>`
      + categories.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
    select.value = categories.includes(selected) ? selected : "all";
  }
}
function renderCategoryBudgets() {
  const container = $("category-budget-list");
  if (!container) return;
  const range = periodRange();
  const expenses = rangeTransactions(range).filter((t) => t.type === "expense");
  const factor = FACTORS[periodType];

  if (!categoryBudgets.length) {
    container.innerHTML = `<p class="empty-state">No category limits yet. Add one to track spending progress.</p>`;
    return;
  }

  container.innerHTML = categoryBudgets.map((budget) => {
    const spent = expenses.filter((t) => t.category.toLowerCase() === budget.category.toLowerCase())
      .reduce((sum, t) => sum + t.amount, 0);
    const limit = Number(budget.limit) * factor;
    const percent = limit ? Math.min(100, Math.round(spent / limit * 100)) : 0;
    const warning = spent >= limit ? "Limit exceeded" : spent >= limit * 0.8 ? "Near your limit" : "";
    const status = spent >= limit ? "over" : spent >= limit * 0.8 ? "warning" : "";
    return `<article class="category-budget ${status}">
      <div class="category-budget-head"><strong>${esc(budget.category)}</strong><span>${money(spent)} / ${money(limit)}</span></div>
      <progress max="100" value="${percent}" aria-label="${esc(budget.category)} budget ${percent}% used"></progress>
      <div class="category-budget-foot"><span>${warning || `${money(Math.max(0, limit - spent))} left`}</span>
        <span class="transaction-actions">
          <button type="button" class="mini-btn edit-category-budget" data-id="${esc(budget.id)}">Edit</button>
          <button type="button" class="mini-btn delete-category-budget" data-id="${esc(budget.id)}">Delete</button>
        </span>
      </div>
    </article>`;
  }).join("");
}

/* Savings goals */
const MILESTONES = [25, 50, 75, 100];
function goalDetails(goal) {
  const remaining = Math.max(0, goal.target - goal.saved);
  const percent = Math.min(100, Math.round(goal.saved / goal.target * 100));
  let timing = "";
  if (remaining === 0) timing = "Goal reached — well done!";
  else if (goal.deadline && validDate(goal.deadline)) {
    const days = daysBetween(today(), goal.deadline);
    if (days < 0) timing = `Target date passed · ${money(remaining)} still to save`;
    else {
      const months = Math.max(days / 30.44, 1);
      timing = `${days} day${days === 1 ? "" : "s"} to go · save ${money(remaining / months)} a month`;
    }
  }
  return { remaining, percent, timing };
}
function renderGoals() {
  const list = $("savings-goal-list");
  if (!list) return;
  list.innerHTML = goals.length ? goals.map((goal) => {
    const { remaining, percent, timing } = goalDetails(goal);
    const marks = MILESTONES.map((m) => `<li class="${percent >= m ? "reached" : ""}">${m}%</li>`).join("");
    return `<article class="goal-card ${remaining === 0 ? "goal-complete" : ""}">
      <div class="category-budget-head"><strong>${esc(goal.name)}</strong><span>${money(goal.saved)} / ${money(goal.target)}</span></div>
      <progress max="100" value="${percent}" aria-label="${esc(goal.name)} ${percent}% saved"></progress>
      <ul class="milestones" aria-label="Milestones">${marks}</ul>
      <div class="category-budget-foot"><span>${percent}% saved · ${money(remaining)} left</span>
        <span class="transaction-actions">
          <button class="mini-btn edit-goal" data-id="${esc(goal.id)}" type="button">Edit</button>
          <button class="mini-btn delete-goal" data-id="${esc(goal.id)}" type="button">Delete</button>
        </span>
      </div>
      ${timing ? `<small class="goal-timing">${esc(timing)}</small>` : ""}
    </article>`;
  }).join("") : `<p class="empty-state">No savings goals yet.</p>`;
}

/* Simple, data-backed insight charts */
function renderInsights() {
  const range = periodRange();
  const expenses = rangeTransactions(range).filter((t) => t.type === "expense");
  const categorySums = {};
  expenses.forEach((t) => { categorySums[t.category] = (categorySums[t.category] || 0) + t.amount; });
  const categoriesSorted = Object.entries(categorySums).sort((a, b) => b[1] - a[1]);
  const maxCategory = Math.max(1, ...categoriesSorted.map(([, value]) => value));

  renderCategoryChart(categoriesSorted, maxCategory);

  const trendChart = $("trend-chart");
  if (trendChart) {
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(shiftMonth(`${today().slice(0, 7)}-01`, -i).slice(0, 7));
    const sums = months.map((month) => {
      const tx = transactions.filter((t) => t.date.startsWith(month));
      return {
        label: formatDate(`${month}-01`, { month: "short" }),
        income: tx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: tx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)
      };
    });
    const max = Math.max(1, ...sums.flatMap((m) => [m.income, m.expense]));
    trendChart.innerHTML = sums.map((m) => `<div class="trend-row"><span>${m.label}</span>
      <span class="chart-track"><i class="income-bar" style="width:${Math.round(m.income / max * 100)}%"></i></span>
      <span class="chart-track"><i class="expense-bar" style="width:${Math.round(m.expense / max * 100)}%"></i></span>
      <small>+${money(m.income)} / −${money(m.expense)}</small></div>`).join("");
  }

  const t = periodTotals();
  const comparison = $("income-expense-chart");
  if (comparison) comparison.innerHTML = `<p>Income: <strong>${money(t.income)}</strong></p><p>Expenses: <strong>${money(t.spent)}</strong></p><p>Difference: <strong>${money(t.income - t.spent)}</strong></p>`;

  const prevAnchor = periodType === "month" ? shiftMonth(periodAnchor, -1) : addDays(periodAnchor, periodType === "week" ? -7 : -14);
  const prevRange = periodRange(periodType, prevAnchor);
  const prevSpent = rangeTransactions(prevRange).filter((x) => x.type === "expense").reduce((s, x) => s + x.amount, 0);
  const node = $("comparison-insight");
  if (node) {
    const difference = t.spent - prevSpent;
    node.textContent = `You spent ${money(Math.abs(difference))} ${difference > 0 ? "more" : difference < 0 ? "less" : "the same"} than in the previous period (${money(prevSpent)}).`;
  }
  renderInsightStats(t, range);
  const personal = $("personal-insight");
  if (personal) {
    if (!categoriesSorted.length) personal.textContent = "Add expenses to see personalized spending insights.";
    else {
      const [top, value] = categoriesSorted[0];
      personal.textContent = `Your highest spending category this period is ${top} at ${money(value)}.`;
    }
  }
}

const PALETTE = ["#7b67d9", "#4a9b70", "#d58a26", "#c44747", "#3f8fb5", "#b0579a", "#8a9a3b", "#6b6b78"];
function renderCategoryChart(sorted, max) {
  const chart = $("category-chart");
  if (!chart) return;
  if (!sorted.length) {
    chart.innerHTML = `<p class="empty-state">No expense data in this period.</p>`;
    return;
  }
  const total = sorted.reduce((sum, [, value]) => sum + value, 0);
  if (chartMode === "pie") {
    let angle = 0;
    const stops = sorted.map(([, value], i) => {
      const start = angle;
      angle += value / total * 360;
      return `${PALETTE[i % PALETTE.length]} ${start}deg ${angle}deg`;
    }).join(", ");
    chart.innerHTML = `<div class="pie" role="img" aria-label="Spending by category pie chart" style="background:conic-gradient(${stops})"></div>
      <ul class="pie-legend">${sorted.map(([name, value], i) => `<li><button type="button" class="chart-link" data-category="${esc(name)}" title="${esc(name)}: ${money(value)} (${Math.round(value / total * 100)}%)">
        <i style="background:${PALETTE[i % PALETTE.length]}"></i><span>${esc(name)}</span><strong>${Math.round(value / total * 100)}%</strong></button></li>`).join("")}</ul>`;
  } else {
    chart.innerHTML = sorted.map(([name, value]) => `
      <button type="button" class="chart-row chart-link" data-category="${esc(name)}" title="${esc(name)}: ${money(value)} (${Math.round(value / total * 100)}% of spending)">
        <span>${esc(name)}</span><span class="chart-track"><i style="width:${Math.round(value / max * 100)}%"></i></span><strong>${money(value)}</strong></button>`).join("");
  }
}
function renderInsightStats(t, range) {
  const node = $("insight-stats");
  if (!node) return;
  const now = today();
  const elapsed = now < range.start ? 0 : Math.min(daysBetween(range.start, now), daysBetween(range.start, range.end)) + 1;
  const length = daysBetween(range.start, range.end) + 1;
  const daily = elapsed ? t.spent / elapsed : 0;
  const months = {};
  transactions.filter((x) => x.type === "expense").forEach((x) => { months[x.date.slice(0, 7)] = (months[x.date.slice(0, 7)] || 0) + x.amount; });
  const monthValues = Object.values(months);
  const avgMonth = monthValues.length ? monthValues.reduce((a, b) => a + b, 0) / monthValues.length : 0;
  const saved = t.income > 0 ? Math.round((t.income - t.spent) / t.income * 100) : null;
  const used = t.budget > 0 ? Math.round(t.spent / t.budget * 100) : 0;
  const projected = elapsed && now <= range.end ? daily * length : t.spent;
  const stats = [
    ["Average daily spending", money(daily)],
    ["Average weekly spending", money(daily * 7)],
    ["Average monthly spending", money(avgMonth)],
    ["Projected spending this period", money(projected)],
    ["Planned vs actual", `${money(t.spent)} of ${money(t.budget)} (${used}%)`],
    ["Income saved", saved === null ? "Add income to see this" : `${saved}%`]
  ];
  node.innerHTML = stats.map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${esc(value)}</strong></div>`).join("");
}

/* Transaction history and filters */
function renderHistory() {
  const list = $("history-list");
  if (!list) return;
  renderCategoryOptions();
  const query = ($("history-search")?.value || "").trim().toLowerCase();
  const type = $("history-type")?.value || "all";
  const category = $("history-category")?.value || "all";
  const from = $("history-from")?.value || "";
  const to = $("history-to")?.value || "";
  const sort = $("history-sort")?.value || "newest";

  let items = transactions.filter((t) =>
    (type === "all" || t.type === type) &&
    (category === "all" || t.category === category) &&
    (!from || t.date >= from) && (!to || t.date <= to) &&
    (!query || `${t.description} ${t.category} ${t.notes}`.toLowerCase().includes(query))
  );
  const sorters = {
    newest: (a, b) => b.date.localeCompare(a.date),
    oldest: (a, b) => a.date.localeCompare(b.date),
    highest: (a, b) => b.amount - a.amount,
    lowest: (a, b) => a.amount - b.amount
  };
  items = items.slice().sort(sorters[sort] || sorters.newest);
  if ($("history-count")) $("history-count").textContent = `${items.length} transaction${items.length === 1 ? "" : "s"}`;
  list.innerHTML = items.length ? items.map((t) => row(t, true)).join("")
    : `<li class="empty-state">No transactions match your filters.</li>`;
}

/* Main render */
function render() {
  renderSummary();
  renderAllocations();
  renderBills();
  renderTransactions();
  renderCategoryBudgets();
  renderGoals();
  renderSubscriptions();
  renderDebts();
  renderForecast();
  renderInsights();
  renderHistory();
  renderChallenges();
  renderNotifications();
}

/* Modal helpers */
function openModal(id) {
  $(id)?.classList.remove("hidden");
  $(id)?.querySelector("input:not([type=hidden]), select")?.focus();
}
function closeModal(id) { $(id)?.classList.add("hidden"); }
function formError(id, message) { if ($(id)) $(id).textContent = message; }

document.addEventListener("click", (event) => {
  const close = event.target.closest("[data-close]");
  if (close) closeModal(close.dataset.close);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") document.querySelectorAll(".modal:not(.hidden)").forEach((m) => m.classList.add("hidden"));
});
document.querySelectorAll(".modal").forEach((modal) => modal.addEventListener("click", (event) => {
  if (event.target === modal) modal.classList.add("hidden");
}));

/* Transactions */
const txForm = $("transaction-form");
function editTransaction(id = "") {
  const item = transactions.find((t) => t.id === id);
  txForm.reset();
  $("transaction-id").value = item?.id || "";
  $("transaction-modal-title").textContent = item ? "Edit transaction" : "Add transaction";
  $("transaction-submit-btn").textContent = item ? "Save" : "Add";
  formError("transaction-form-error", "");
  if (item) {
    for (const key of ["type", "amount", "description", "category", "date", "notes"]) txForm.elements[key].value = item[key] || "";
  } else {
    const r = periodRange();
    txForm.elements.date.value = today() >= r.start && today() <= r.end ? today() : r.start;
  }
  openModal("transaction-modal");
}
$("add-transaction-btn")?.addEventListener("click", () => editTransaction());
txForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = new FormData(txForm);
  const id = String(data.get("id") || "");
  const item = {
    id: id || uid(),
    type: String(data.get("type")),
    amount: validAmount(data.get("amount")),
    description: String(data.get("description") || "").trim(),
    category: String(data.get("category") || "").trim(),
    date: String(data.get("date") || ""),
    notes: String(data.get("notes") || "")
  };
  if (!item.amount || !item.description || !item.category || !validDate(item.date)) {
    formError("transaction-form-error", "Enter a description, category, valid date and amount greater than zero.");
    return;
  }
  const old = transactions.find((t) => t.id === id);
  if (old?.billId) Object.assign(item, { billId: old.billId, billDue: old.billDue });
  transactions = id ? transactions.map((t) => t.id === id ? item : t) : [...transactions, item];
  rememberCategory(item.category);
  const r = periodRange();
  if (item.date < r.start || item.date > r.end) periodAnchor = item.date;
  saveTransactions();
  render();
  closeModal("transaction-modal");
});
function deleteTransaction(id) {
  const item = transactions.find((t) => t.id === id);
  if (!item || !confirm(`Delete "${item.description}" for ${money(item.amount)}?`)) return;
  transactions = transactions.filter((t) => t.id !== id);
  saveTransactions();
  render();
}

/* Budget */
$("edit-budget-btn")?.addEventListener("click", () => {
  $("budget-input").value = monthlyBudget;
  formError("budget-form-error", "");
  openModal("budget-modal");
});
$("budget-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = validAmount($("budget-input").value, true);
  if (value === null) return formError("budget-form-error", "Enter a valid budget of zero or more.");
  monthlyBudget = value;
  save(KEYS.budget, monthlyBudget);
  render();
  closeModal("budget-modal");
});

/* Money plan */
$("plan-amount-btn")?.addEventListener("click", () => {  $("allocation-form").reset();
  $("allocation-id").value = "";
  $("allocation-submit-btn").textContent = "Add";
  renderAllocations();
  openModal("plan-modal");
});
$("allocation-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("allocation-id").value;
  const name = $("planned-note").value.trim();
  const type = $("allocation-type").value;
  const amount = validAmount($("planned-amount").value);
  if (!name || !amount) return formError("allocation-form-error", "Enter a name and amount greater than zero.");
  const item = { id: id || uid(), name, type, amount };
  allocations = id ? allocations.map((a) => a.id === id ? item : a) : [...allocations, item];
  savePlan();
  $("allocation-form").reset();
  $("allocation-id").value = "";
  $("allocation-submit-btn").textContent = "Add";
  render();
});
function editAllocation(id) {
  const a = allocations.find((x) => x.id === id);
  if (!a) return;
  $("allocation-id").value = a.id;
  $("planned-note").value = a.name;
  $("allocation-type").value = a.type || "savings";
  $("planned-amount").value = a.amount;
  $("allocation-submit-btn").textContent = "Update";
}

/* Bills: paid status is represented by a matching expense transaction */
const billForm = $("bill-form");
$("add-bill-btn")?.addEventListener("click", () => {
  billForm.reset();
  billForm.elements.id.value = "";
  $("bill-modal-title").textContent = "Add bill";
  $("bill-submit-btn").textContent = "Add";
  billForm.elements.due.value = periodRange().start;
  openModal("bill-modal");
});
function editBill(id) {
  const b = bills.find((x) => x.id === id);
  if (!b) return;
  billForm.elements.id.value = b.id;
  billForm.elements.name.value = b.name;
  billForm.elements.amount.value = b.amount;
  billForm.elements.due.value = b.due;
  billForm.elements.recurring.checked = b.recurring;
  $("bill-modal-title").textContent = "Edit bill";
  $("bill-submit-btn").textContent = "Save";
  openModal("bill-modal");
}
billForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = billForm.elements.id.value;
  const name = billForm.elements.name.value.trim();
  const amount = validAmount(billForm.elements.amount.value);
  const due = billForm.elements.due.value;
  if (!name || !amount || !validDate(due)) return formError("bill-form-error", "Enter a bill name, valid due date and amount.");
  const bill = { id: id || uid(), name, amount, due, recurring: billForm.elements.recurring.checked };
  bills = id ? bills.map((b) => b.id === id ? bill : b) : [...bills, bill];
  saveBills();
  render();
  closeModal("bill-modal");
});
function markBill(id, date) {
  const payment = transactions.find((t) => t.billId === id && t.billDue === date);
  if (payment) {
    transactions = transactions.filter((t) => t !== payment);
  } else {
    const b = bills.find((x) => x.id === id);
    if (!b) return;
    transactions.push({ id: uid(), type: "expense", amount: b.amount, description: b.name, category: "Bills", date, notes: "Bill payment", billId: id, billDue: date });
    rememberCategory("Bills");
  }
  saveTransactions();
  render();
}

/* Category budget management */
function openCategoryBudget(id = "") {
  const item = categoryBudgets.find((b) => b.id === id);
  $("category-budget-form").reset();
  $("category-budget-id").value = item?.id || "";
  $("category-budget-name").value = item?.category || "";
  $("category-budget-limit").value = item?.limit || "";
  $("category-budget-title").textContent = item ? "Edit category budget" : "Add category budget";
  openModal("category-budget-modal");
}
$("add-category-budget-btn")?.addEventListener("click", () => openCategoryBudget());
$("category-budget-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("category-budget-id").value;
  const category = $("category-budget-name").value.trim();
  const limit = validAmount($("category-budget-limit").value);
  if (!category || !limit) return formError("category-budget-error", "Enter a category and a limit greater than zero.");
  rememberCategory(category);
  const item = { id: id || uid(), category, limit };
  categoryBudgets = id ? categoryBudgets.map((b) => b.id === id ? item : b) : [...categoryBudgets, item];
  save(KEYS.categoryBudgets, categoryBudgets);
  render();
  closeModal("category-budget-modal");
});
function deleteCategoryBudget(id) {
  categoryBudgets = categoryBudgets.filter((b) => b.id !== id);
  save(KEYS.categoryBudgets, categoryBudgets);
  render();
}

/* Savings goals */
function openGoal(id = "") {
  const goal = goals.find((g) => g.id === id);
  $("goal-form").reset();
  $("goal-id").value = goal?.id || "";
  $("goal-name").value = goal?.name || "";
  $("goal-target").value = goal?.target || "";
  $("goal-saved").value = goal?.saved || 0;
  $("goal-deadline").value = goal?.deadline || "";
  $("goal-modal-title").textContent = goal ? "Edit savings goal" : "Add savings goal";
  openModal("goal-modal");
}
$("add-goal-btn")?.addEventListener("click", () => openGoal());
$("goal-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("goal-id").value;
  const name = $("goal-name").value.trim();
  const target = validAmount($("goal-target").value);
  const savedAmount = validAmount($("goal-saved").value, true);
  if (!name || !target || savedAmount === null) return formError("goal-form-error", "Enter a name, a target and a saved amount of zero or more.");
  const deadline = $("goal-deadline").value;
  if (deadline && !validDate(deadline)) return formError("goal-form-error", "Enter a valid target date or leave it empty.");
  const goal = { id: id || uid(), name, target, saved: savedAmount, ...(deadline ? { deadline } : {}) };
  goals = id ? goals.map((g) => g.id === id ? goal : g) : [...goals, goal];
  save(KEYS.goals, goals);
  render();
  closeModal("goal-modal");
});
function deleteGoal(id) {
  if (!confirm("Delete this savings goal?")) return;
  goals = goals.filter((g) => g.id !== id);
  save(KEYS.goals, goals);
  render();
}

/* Delegated actions for rendered rows */
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const { id, date } = button.dataset;
  if (button.matches(".edit-transaction")) editTransaction(id);
  else if (button.matches(".delete-transaction")) deleteTransaction(id);
  else if (button.matches(".pay-bill")) markBill(id, date);
  else if (button.matches(".edit-bill")) editBill(id);
  else if (button.matches(".delete-bill")) {
    if (confirm("Delete this bill? Previous recorded payments remain in transaction history.")) {
      bills = bills.filter((b) => b.id !== id);
      saveBills();
      render();
    }
  } else if (button.matches(".edit-allocation")) editAllocation(id);
  else if (button.matches(".delete-allocation")) {
    allocations = allocations.filter((a) => a.id !== id);
    savePlan();
    render();
  } else if (button.matches(".edit-category-budget")) openCategoryBudget(id);
  else if (button.matches(".delete-category-budget")) deleteCategoryBudget(id);
  else if (button.matches(".edit-goal")) openGoal(id);
  else if (button.matches(".delete-goal")) deleteGoal(id);
});

/* History filters */
["history-search", "history-type", "history-category", "history-from", "history-to", "history-sort"]
  .forEach((id) => {
    $(id)?.addEventListener("input", renderHistory);
    $(id)?.addEventListener("change", renderHistory);
  });
$("history-clear")?.addEventListener("click", () => {
  ["history-search", "history-from", "history-to"].forEach((id) => { if ($(id)) $(id).value = ""; });
  if ($("history-type")) $("history-type").value = "all";
  if ($("history-category")) $("history-category").value = "all";
  if ($("history-sort")) $("history-sort").value = "newest";
  renderHistory();
});

/* Navigation */
function view(name) {
  const history = name === "transactions" || name === "earnings";
  $("overview-view").hidden = history;
  $("history-view").hidden = !history;
  if (name === "earnings") $("history-type").value = "income";
  else if (history) $("history-type").value = "all";
  if (name === "budget") $("category-budgets").scrollIntoView({ behavior: "smooth" });
  if (name === "insights") $("insights-panel").scrollIntoView({ behavior: "smooth" });
  if (name === "saver") $("savings-goals").scrollIntoView({ behavior: "smooth" });
  if (name === "subscriptions") $("subscriptions-panel").scrollIntoView({ behavior: "smooth" });
  if (name === "tools") $("tools-panel").scrollIntoView({ behavior: "smooth" });
  if (name === "challenges") $("challenges-panel").scrollIntoView({ behavior: "smooth" });
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.nav === name));
  renderHistory();
}
document.querySelectorAll("[data-nav]").forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  view(link.dataset.nav);
}));
$("period-type")?.addEventListener("change", (event) => {
  periodType = event.target.value;
  periodAnchor = today();
  save(KEYS.period, periodType);
  render();
});
$("period-prev")?.addEventListener("click", () => stepPeriod(-1));
$("period-next")?.addEventListener("click", () => stepPeriod(1));

/* Backup and restore */
$("export-data-btn")?.addEventListener("click", () => {
  const backup = {
    version: 1, exportedAt: new Date().toISOString(), transactions, bills, allocations,
    monthlyBudget, categories, categoryBudgets, goals, subscriptions, debts, debtPlan, challenges, layout, notifyPrefs,
    theme: localStorage.getItem(KEYS.theme)
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `money-dashboard-backup-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
  localStorage.setItem(KEYS.lastBackup, new Date().toISOString());
  showMessage("backup-message", "Backup downloaded.");
  render();
});
$("import-data-input")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (!data || !Array.isArray(data.transactions) || !Array.isArray(data.bills)) {
      throw new Error("This file is not a valid dashboard backup.");
    }
    if (!confirm("Restore this backup? It will replace the dashboard data in this browser.")) return;
    transactions = data.transactions.map(cleanTransaction).filter(Boolean);
    bills = data.bills.map(cleanBill).filter(Boolean);
    allocations = Array.isArray(data.allocations) ? data.allocations : [];
    categories = Array.isArray(data.categories) ? data.categories : [];
    categoryBudgets = Array.isArray(data.categoryBudgets) ? data.categoryBudgets : [];
    goals = Array.isArray(data.goals) ? data.goals : [];
    subscriptions = Array.isArray(data.subscriptions) ? data.subscriptions.map(cleanSubscription).filter(Boolean) : [];
    debts = Array.isArray(data.debts) ? data.debts.map(cleanDebt).filter(Boolean) : [];
    debtPlan = {
      strategy: ["avalanche", "snowball"].includes(data.debtPlan?.strategy) ? data.debtPlan.strategy : "avalanche",
      extra: validAmount(data.debtPlan?.extra, true) ?? 0
    };
    save(KEYS.debts, debts); save(KEYS.debtPlan, debtPlan);
    monthlyBudget = validAmount(data.monthlyBudget, true) ?? DEFAULT_BUDGET;
    challenges = data.challenges && typeof data.challenges === "object" ? data.challenges : {};
    layout = data.layout && typeof data.layout === "object" ? data.layout : {};
    notifyPrefs = data.notifyPrefs && typeof data.notifyPrefs === "object" ? data.notifyPrefs : {};
    save(KEYS.challenges, challenges); save(KEYS.layout, layout); save(KEYS.notifyPrefs, notifyPrefs);
    applyLayout();
    saveTransactions(); saveBills(); savePlan();
    save(KEYS.categories, categories); save(KEYS.categoryBudgets, categoryBudgets);
    save(KEYS.goals, goals); save(KEYS.subscriptions, subscriptions); save(KEYS.budget, monthlyBudget);
    if (THEMES.includes(data.theme)) applyTheme(data.theme);
    render();
    showMessage("backup-message", "Backup restored.");
  } catch (error) {
    console.error("Could not restore backup:", error);
    showMessage("backup-message", "Restore failed: choose a valid dashboard backup.");
  } finally {
    event.target.value = "";
  }
});

/* Themes */
function applyTheme(name) {
  if (!THEMES.includes(name)) return;
  document.body.classList.remove(...THEMES);
  document.body.classList.add(name);
  localStorage.setItem(KEYS.theme, name);
  document.querySelectorAll(".theme-option").forEach((button) => button.classList.toggle("active", button.dataset.theme === name));
}
$("theme-toggle-btn")?.addEventListener("click", () => openModal("theme-modal"));
document.querySelectorAll(".theme-option").forEach((button) => button.addEventListener("click", () => {
  applyTheme(button.dataset.theme);
  closeModal("theme-modal");
}));
applyTheme(THEMES.includes(localStorage.getItem(KEYS.theme)) ? localStorage.getItem(KEYS.theme) : "theme-botanical-light");

/* Subscriptions */
const CYCLES = {
  monthly: { label: "Monthly", perMonth: 1 },
  yearly: { label: "Yearly", perMonth: 1 / 12 },
  fortnightly: { label: "Fortnightly", perMonth: 26 / 12 },
  weekly: { label: "Weekly", perMonth: 52 / 12 }
};
function cleanSubscription(item) {
  if (!item || !String(item.name || "").trim() || !validAmount(item.amount) ||
      !CYCLES[item.cycle] || !validDate(item.date)) return null;
  return { id: String(item.id || uid()), name: String(item.name).trim(), amount: Number(item.amount), cycle: item.cycle, date: item.date };
}
subscriptions = subscriptions.map(cleanSubscription).filter(Boolean);
function addMonthsKeepDay(date, months, day) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)) - 1 + months;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const target = new Date(Date.UTC(y, m, 1));
  return `${target.getUTCFullYear()}-${pad(target.getUTCMonth() + 1)}-${pad(Math.min(day, last))}`;
}
function nextRenewal(sub) {
  const now = today();
  const day = Number(sub.date.slice(8, 10));
  for (let i = 0; i < 6000; i++) {
    const candidate = sub.cycle === "monthly" ? addMonthsKeepDay(sub.date, i, day)
      : sub.cycle === "yearly" ? addMonthsKeepDay(sub.date, i * 12, day)
      : addDays(sub.date, i * (sub.cycle === "weekly" ? 7 : 14));
    if (candidate >= now) return candidate;
  }
  return sub.date;
}
function renderSubscriptions() {
  const list = $("subscription-list");
  if (!list) return;
  const items = subscriptions.map((sub) => ({ sub, next: nextRenewal(sub) })).sort((a, b) => a.next.localeCompare(b.next));
  const monthly = subscriptions.reduce((sum, sub) => sum + sub.amount * CYCLES[sub.cycle].perMonth, 0);
  if ($("sub-monthly")) $("sub-monthly").textContent = money(monthly);
  if ($("sub-yearly")) $("sub-yearly").textContent = money(monthly * 12);
  list.innerHTML = items.length ? items.map(({ sub, next }) => {
    const days = daysBetween(today(), next);
    const soon = days <= 7;
    const when = days === 0 ? "Renews today" : days === 1 ? "Renews tomorrow" : `Renews in ${days} days`;
    return `<li class="${soon ? "due-soon" : ""}">
      <span class="bill-name">${esc(sub.name)}<time datetime="${next}">${esc(when)} · ${formatDate(next, { day: "numeric", month: "short" })} · ${CYCLES[sub.cycle].label.toLowerCase()} · ${money(sub.amount * CYCLES[sub.cycle].perMonth)}/month</time></span>
      <strong>${money(sub.amount)}</strong>
      <span class="bill-actions">
        <button class="mini-btn edit-subscription" data-id="${esc(sub.id)}" type="button">Edit</button>
        <button class="mini-btn delete-subscription" data-id="${esc(sub.id)}" type="button">Delete</button>
      </span>
    </li>`;
  }).join("") : `<li class="empty-state">No subscriptions yet. Add streaming, apps or memberships to see what they cost each year.</li>`;
}
function openSubscription(id = "") {
  const sub = subscriptions.find((x) => x.id === id);
  $("subscription-form").reset();
  $("subscription-id").value = sub?.id || "";
  $("subscription-name").value = sub?.name || "";
  $("subscription-amount").value = sub?.amount || "";
  $("subscription-cycle").value = sub?.cycle || "monthly";
  $("subscription-date").value = sub?.date || today();
  $("subscription-modal-title").textContent = sub ? "Edit subscription" : "Add subscription";
  formError("subscription-form-error", "");
  openModal("subscription-modal");
}$("add-subscription-btn")?.addEventListener("click", () => openSubscription());
$("subscription-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("subscription-id").value;
  const sub = cleanSubscription({
    id: id || uid(), name: $("subscription-name").value, amount: $("subscription-amount").value,
    cycle: $("subscription-cycle").value, date: $("subscription-date").value
  });
  if (!sub) return formError("subscription-form-error", "Enter a name, a cost above zero and a valid renewal date.");
  subscriptions = id ? subscriptions.map((x) => x.id === id ? sub : x) : [...subscriptions, sub];
  save(KEYS.subscriptions, subscriptions);
  render();
  closeModal("subscription-modal");
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.matches(".edit-subscription")) openSubscription(button.dataset.id);
  else if (button.matches(".delete-subscription") && confirm("Delete this subscription?")) {
    subscriptions = subscriptions.filter((x) => x.id !== button.dataset.id);
    save(KEYS.subscriptions, subscriptions);
    render();
  }
});

/* Interactive insights */
document.addEventListener("click", (event) => {
  const mode = event.target.closest("[data-chart-mode]");
  if (mode) {
    chartMode = mode.dataset.chartMode;
    document.querySelectorAll("[data-chart-mode]").forEach((b) => b.classList.toggle("active", b === mode));
    renderInsights();
    return;
  }
  const link = event.target.closest(".chart-link");
  if (link) {
    const range = periodRange();
    view("transactions");
    $("history-category").value = link.dataset.category;
    $("history-type").value = "expense";
    $("history-from").value = range.start;
    $("history-to").value = range.end;
    renderHistory();
  }
});

/* Financial calculators */
const rate = (value) => Number(value) / 1200;
const CALCULATORS = [
  {
    id: "savings", name: "Savings goal calculator", help: "How long will it take to reach a savings target?",
    fields: [["target", "Target amount", 5000], ["current", "Already saved", 0], ["monthly", "Saving each month", 250], ["rate", "Interest rate per year (%)", 0]],
    run(v) {
      if (v.target <= v.current) return [["Result", "You have already reached this target"]];
      if (v.monthly <= 0) return [["Result", "Enter a monthly saving amount above zero"]];
      let balance = v.current, months = 0;
      while (balance < v.target && months < 1200) { balance = balance * (1 + rate(v.rate)) + v.monthly; months++; }
      if (months >= 1200) return [["Result", "This would take more than 100 years"]];
      const date = shiftMonth(`${today().slice(0, 7)}-01`, months);
      return [["Time needed", `${Math.floor(months / 12)} years ${months % 12} months`], ["Target reached around", formatDate(date, { month: "long", year: "numeric" })], ["Total you save", money(v.monthly * months)]];
    }
  },
  {
    id: "compound", name: "Compound interest", help: "See how savings can grow when interest is added each month.",
    fields: [["principal", "Starting amount", 1000], ["monthly", "Added each month", 100], ["rate", "Interest rate per year (%)", 5], ["years", "Years", 10]],
    run(v) {
      let balance = v.principal;
      for (let i = 0; i < Math.round(v.years * 12); i++) balance = balance * (1 + rate(v.rate)) + v.monthly;
      const put = v.principal + v.monthly * Math.round(v.years * 12);
      return [["Final balance", money(balance)], ["Total you put in", money(put)], ["Interest earned", money(balance - put)]];
    }
  },
  {
    id: "loan", name: "Loan repayment", help: "Estimate monthly repayments and total interest on a loan.",
    fields: [["amount", "Amount borrowed", 10000], ["rate", "Interest rate per year (%)", 7], ["years", "Loan length (years)", 5]],
    run(v) {
      const n = Math.round(v.years * 12);
      if (v.amount <= 0 || n <= 0) return [["Result", "Enter an amount and loan length above zero"]];
      const r = rate(v.rate);
      const payment = r === 0 ? v.amount / n : v.amount * r / (1 - Math.pow(1 + r, -n));
      return [["Monthly repayment", money(payment)], ["Total repaid", money(payment * n)], ["Total interest", money(payment * n - v.amount)]];
    }
  },
  {
    id: "split", name: "Split a bill", help: "Share a bill between friends, with an optional tip.",
    fields: [["total", "Bill total", 120], ["people", "Number of people", 4], ["tip", "Tip (%)", 0]],
    run(v) {
      const people = Math.floor(v.people);
      if (people < 1) return [["Result", "Enter at least one person"]];
      const total = v.total * (1 + v.tip / 100);
      return [["Each person pays", money(total / people)], ["Total including tip", money(total)]];
    }
  },
  {
    id: "percent", name: "Percentage", help: "Work out a percentage of an amount.",
    fields: [["percent", "Percentage (%)", 15], ["of", "Of amount", 200]],
    run: (v) => [["Result", money(v.percent / 100 * v.of)], ["Amount remaining", money(v.of - v.percent / 100 * v.of)]]
  },
  {
    id: "income", name: "Income converter", help: "Convert pay between weekly, fortnightly, monthly and yearly.",
    fields: [["amount", "Pay amount", 800], ["period", "How often you are paid", "weekly", { weekly: "Weekly", fortnightly: "Fortnightly", monthly: "Monthly", yearly: "Yearly" }]],
    run(v) {
      const yearly = v.amount * { weekly: 52, fortnightly: 26, monthly: 12, yearly: 1 }[v.period];
      return [["Weekly", money(yearly / 52)], ["Fortnightly", money(yearly / 26)], ["Monthly", money(yearly / 12)], ["Yearly", money(yearly)]];
    }
  }
];
function currentCalculator() {
  return CALCULATORS.find((c) => c.id === $("calc-type").value) || CALCULATORS[0];
}
function renderCalculatorForm() {
  const calc = currentCalculator();
  $("calc-help").textContent = calc.help;
  $("calc-form").innerHTML = calc.fields.map(([key, label, value, options]) => options
    ? `<label class="modal-label"><span>${esc(label)}</span><select name="${key}">${Object.entries(options).map(([k, t]) => `<option value="${k}" ${k === value ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`
    : `<label class="modal-label"><span>${esc(label)}</span><input name="${key}" type="number" step="any" min="0" value="${value}" /></label>`).join("");
  runCalculator();
}
function runCalculator() {
  const calc = currentCalculator();
  const values = {};
  calc.fields.forEach(([key, , , options]) => {
    const field = $("calc-form").elements[key];
    values[key] = options ? field.value : Number(field.value) || 0;
  });
  $("calc-result").innerHTML = `<dl>${calc.run(values).map(([label, value]) => `<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl>`;
}
if ($("calc-type")) {
  $("calc-type").innerHTML = CALCULATORS.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join("");
  $("calc-type").addEventListener("change", renderCalculatorForm);
  $("calc-form").addEventListener("input", runCalculator);
  $("calc-form").addEventListener("submit", (event) => event.preventDefault());
  renderCalculatorForm();
}

/* Dashboard customisation */
const SECTIONS = [
  ["summary", "Summary cards"], ["plan", "Money plan and bills"], ["categories", "Category budgets"],
  ["goals", "Savings goals"], ["subscriptions", "Subscriptions"], ["debts", "Debt tracker"], ["forecast", "Financial forecast"], ["challenges", "Challenges and achievements"],
  ["activity", "Spending and recent transactions"], ["insights", "Insights"], ["tools", "Calculators"],
  ["data", "Backup and export"]
];
function layoutState() {
  const ids = SECTIONS.map(([id]) => id);
  const order = (Array.isArray(layout.order) ? layout.order : []).filter((id) => ids.includes(id));
  ids.forEach((id) => { if (!order.includes(id)) order.push(id); });
  const hidden = (Array.isArray(layout.hidden) ? layout.hidden : []).filter((id) => ids.includes(id));
  return { order, hidden };
}
function applyLayout() {
  const { order, hidden } = layoutState();
  document.querySelectorAll("[data-section]").forEach((node) => {
    node.hidden = hidden.includes(node.dataset.section);
    node.style.order = order.indexOf(node.dataset.section);
  });
}
function renderCustomize() {
  const { order, hidden } = layoutState();
  const names = Object.fromEntries(SECTIONS);
  $("customize-list").innerHTML = order.map((id, i) => `<li>
    <label><input type="checkbox" data-section-toggle="${id}" ${hidden.includes(id) ? "" : "checked"} /> ${esc(names[id])}</label>
    <span class="transaction-actions">
      <button class="mini-btn" type="button" data-section-move="-1" data-id="${id}" ${i === 0 ? "disabled" : ""} aria-label="Move ${esc(names[id])} up">Up</button>
      <button class="mini-btn" type="button" data-section-move="1" data-id="${id}" ${i === order.length - 1 ? "disabled" : ""} aria-label="Move ${esc(names[id])} down">Down</button>
    </span></li>`).join("");
}
function saveLayout(next) {
  layout = next;
  save(KEYS.layout, layout);
  applyLayout();
  renderCustomize();
}
$("customize-btn")?.addEventListener("click", () => { renderCustomize(); openModal("customize-modal"); });
$("customize-reset")?.addEventListener("click", () => saveLayout({}));
$("customize-list")?.addEventListener("change", (event) => {
  const id = event.target.dataset.sectionToggle;
  if (!id) return;
  const { order, hidden } = layoutState();
  saveLayout({ order, hidden: event.target.checked ? hidden.filter((x) => x !== id) : [...hidden, id] });
});
$("customize-list")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-section-move]");
  if (!button) return;
  const { order, hidden } = layoutState();
  const from = order.indexOf(button.dataset.id);
  const to = from + Number(button.dataset.sectionMove);
  if (to < 0 || to >= order.length) return;
  order.splice(to, 0, order.splice(from, 1)[0]);
  saveLayout({ order, hidden });
});
applyLayout();

/* Custom categories: add, rename, delete */
function syncCategories() {
  transactions.forEach((t) => {
    if (!categories.some((c) => c.toLowerCase() === t.category.toLowerCase())) categories.push(t.category);
  });
  if (!categories.includes("Other")) categories.push("Other");
  categories.sort((a, b) => a.localeCompare(b));
  save(KEYS.categories, categories);
}
function renderCategoryManager() {
  $("categories-list").innerHTML = categories.map((name) => {
    const count = transactions.filter((t) => t.category === name).length;
    const locked = name === "Other";
    return `<li><span>${esc(name)} <small>${count} transaction${count === 1 ? "" : "s"}</small></span>
      <span class="transaction-actions">
        ${locked ? `<small>Default</small>` : `<button class="mini-btn rename-category" data-name="${esc(name)}" type="button">Rename</button>
        <button class="mini-btn delete-category" data-name="${esc(name)}" type="button">Delete</button>`}
      </span></li>`;
  }).join("");
}
function mergeCategoryBudgets() {
  const merged = [];
  categoryBudgets.forEach((b) => {
    const same = merged.find((m) => m.category.toLowerCase() === b.category.toLowerCase());
    if (same) same.limit = Number(same.limit) + Number(b.limit);
    else merged.push({ ...b });
  });
  categoryBudgets = merged;
}
function renameCategory(oldName) {
  const input = prompt(`Rename "${oldName}" to:`, oldName);
  const name = String(input ?? "").trim();
  if (!name || name === oldName) return;
  const clash = categories.find((c) => c.toLowerCase() === name.toLowerCase() && c !== oldName);
  const finalName = clash || name;
  transactions = transactions.map((t) => t.category === oldName ? { ...t, category: finalName } : t);
  categoryBudgets = categoryBudgets.map((b) => b.category.toLowerCase() === oldName.toLowerCase() ? { ...b, category: finalName } : b);
  mergeCategoryBudgets();
  categories = [...new Set(categories.map((c) => c === oldName ? finalName : c))].sort((a, b) => a.localeCompare(b));
  save(KEYS.categories, categories); save(KEYS.categoryBudgets, categoryBudgets); saveTransactions();
  renderCategoryManager();
  render();
}
function deleteCategory(name) {
  const count = transactions.filter((t) => t.category === name).length;
  if (!confirm(`Delete "${name}"? ${count} transaction${count === 1 ? "" : "s"} will move to "Other" and its budget will be removed.`)) return;
  transactions = transactions.map((t) => t.category === name ? { ...t, category: "Other" } : t);
  categoryBudgets = categoryBudgets.filter((b) => b.category.toLowerCase() !== name.toLowerCase());
  categories = categories.filter((c) => c !== name);
  save(KEYS.categories, categories); save(KEYS.categoryBudgets, categoryBudgets); saveTransactions();
  renderCategoryManager();
  render();
}
$("manage-categories-btn")?.addEventListener("click", () => {
  syncCategories();
  formError("categories-error", "");
  renderCategoryManager();
  openModal("categories-modal");
});
$("category-add-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("category-add-name").value.trim();
  if (!name) return formError("categories-error", "Enter a category name.");
  if (categories.some((c) => c.toLowerCase() === name.toLowerCase())) return formError("categories-error", "That category already exists.");
  formError("categories-error", "");
  rememberCategory(name);
  $("category-add-name").value = "";
  renderCategoryManager();
});
$("categories-list")?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.matches(".rename-category")) renameCategory(button.dataset.name);
  else if (button.matches(".delete-category")) deleteCategory(button.dataset.name);
});

/* Budget templates */
const TEMPLATES = {
  student: { name: "Student", help: "Rent, study costs and a small savings habit.",
    lines: [["Rent", 35], ["Groceries", 15], ["Transport", 10], ["Study & textbooks", 8], ["Eating out", 7], ["Phone & internet", 5], ["Other", 5]], savings: [["Savings", 15]] },
  worker: { name: "Worker", help: "A balanced plan for a regular wage.",
    lines: [["Rent", 30], ["Groceries", 12], ["Transport", 10], ["Bills", 10], ["Eating out", 8], ["Entertainment", 5], ["Other", 5]], savings: [["Savings", 20]] },
  family: { name: "Family", help: "More for groceries, bills and children.",
    lines: [["Rent", 32], ["Groceries", 18], ["Transport", 10], ["Bills", 12], ["Childcare & school", 10], ["Eating out", 4], ["Other", 4]], savings: [["Savings", 10]] },
  fifty: { name: "50/30/20 method", help: "50% needs, 30% wants, 20% savings.",
    lines: [["Rent", 25], ["Groceries", 12], ["Transport", 8], ["Bills", 5], ["Eating out", 10], ["Entertainment", 10], ["Other", 10]], savings: [["Savings", 20]] },
  zero: { name: "Zero-based budget", help: "Every dollar of income is given a job.",
    lines: [["Rent", 30], ["Groceries", 15], ["Transport", 10], ["Bills", 10], ["Eating out", 8], ["Entertainment", 5], ["Other", 7]], savings: [["Savings", 10], ["Emergency fund", 5]] },
  envelope: { name: "Envelope budget", help: "Fixed spending envelopes for each category.",
    lines: [["Rent", 30], ["Groceries", 15], ["Transport", 10], ["Bills", 10], ["Eating out", 10], ["Entertainment", 10], ["Other", 5]], savings: [["Savings", 10]] }
};
function templatePlan() {
  const template = TEMPLATES[$("template-type").value];
  const income = validAmount($("template-income").value);
  if (!template || !income) return null;
  const amount = (pct) => Math.round(income * pct) / 100;
  return {
    template, income,
    limits: template.lines.map(([category, pct]) => ({ category, limit: amount(pct), pct })),
    savings: template.savings.map(([name, pct]) => ({ name, amount: amount(pct), pct }))
  };
}
function renderTemplatePreview() {
  const plan = templatePlan();
  $("template-help").textContent = TEMPLATES[$("template-type").value]?.help || "";
  $("template-preview").innerHTML = plan
    ? [...plan.limits.map((l) => `<li>${esc(l.category)} <span>${money(l.limit)} · ${l.pct}%</span></li>`),
       ...plan.savings.map((a) => `<li>${esc(a.name)} (saved) <span>${money(a.amount)} · ${a.pct}%</span></li>`)].join("")
    : `<li class="empty-state">Enter your monthly income to see the plan.</li>`;
}
if ($("template-type")) {
  $("template-type").innerHTML = Object.entries(TEMPLATES).map(([id, t]) => `<option value="${id}">${esc(t.name)}</option>`).join("");
  $("template-type").addEventListener("change", renderTemplatePreview);
  $("template-income").addEventListener("input", renderTemplatePreview);
}
$("templates-btn")?.addEventListener("click", () => {
  formError("template-error", "");
  renderTemplatePreview();
  openModal("templates-modal");
});
$("template-apply")?.addEventListener("click", () => {
  const plan = templatePlan();
  if (!plan) return formError("template-error", "Enter a monthly income above zero.");
  if (!confirm(`Apply the ${plan.template.name} template? Your monthly budget becomes ${money(plan.income)} and your category budgets will be replaced.`)) return;
  monthlyBudget = plan.income;
  save(KEYS.budget, monthlyBudget);
  categoryBudgets = plan.limits.map((l) => ({ id: uid(), category: l.category, limit: l.limit }));
  plan.limits.forEach((l) => rememberCategory(l.category));
  save(KEYS.categoryBudgets, categoryBudgets);
  allocations = allocations.filter((a) => !a.template);
  plan.savings.forEach((a) => allocations.push({ id: uid(), name: a.name, type: "savings", amount: a.amount, template: true }));
  savePlan();
  render();
  closeModal("templates-modal");
});

/* CSV export */
function csvCell(value) {
  let text = String(value ?? "");
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
$("export-csv-btn")?.addEventListener("click", () => {
  const rows = [["Date", "Type", "Description", "Category", "Amount", "Notes"]]
    .concat(transactions.slice().sort((a, b) => a.date.localeCompare(b.date))
      .map((t) => [t.date, t.type, t.description, t.category, t.amount.toFixed(2), t.notes]));
  const csv = "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `money-dashboard-transactions-${today()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showMessage("backup-message", `Exported ${transactions.length} transaction${transactions.length === 1 ? "" : "s"} to CSV.`);
});

/* Reminders and notification centre */
const NOTIFY_TYPES = [
  ["bills", "Bill reminders and overdue bills"], ["subscriptions", "Subscription renewals"],
  ["budgets", "Budget limit warnings"], ["goals", "Savings goal deadlines"], ["debts", "Debt payment due dates"],
  ["backup", "Backup reminders"], ["summary", "Weekly summary"]
];
function notifyOn(type) { return notifyPrefs[type] !== false; }
function buildNotifications() {
  const list = [];
  const now = today();
  if (notifyOn("bills")) {
    billOccurrences({ start: addDays(now, -31), end: addDays(now, 3) }).filter((b) => !b.paid).forEach(({ bill, date }) => {
      if (date < now) list.push({ level: "warn", text: `${bill.name} (${money(bill.amount)}) was due ${formatDate(date, { day: "numeric", month: "short" })} and is unpaid.` });
      else list.push({ level: "info", text: `${bill.name} (${money(bill.amount)}) is due ${date === now ? "today" : formatDate(date, { day: "numeric", month: "short" })}.` });
    });
  }
  if (notifyOn("subscriptions")) {
    subscriptions.forEach((sub) => {
      const next = nextRenewal(sub);
      const days = daysBetween(now, next);
      if (days <= 7) list.push({ level: "info", text: `${sub.name} renews ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`} (${money(sub.amount)}).` });
    });
  }
  if (notifyOn("budgets")) {
    const month = periodRange("month", now);
    const expenses = rangeTransactions(month).filter((t) => t.type === "expense");
    categoryBudgets.forEach((b) => {
      const spent = expenses.filter((t) => t.category.toLowerCase() === b.category.toLowerCase()).reduce((sum, t) => sum + t.amount, 0);
      const limit = Number(b.limit);
      if (spent >= limit) list.push({ level: "warn", text: `${b.category} is over its monthly limit (${money(spent)} of ${money(limit)}).` });
      else if (spent >= limit * 0.8) list.push({ level: "info", text: `${b.category} has used ${Math.round(spent / limit * 100)}% of its monthly limit.` });
    });
    const total = expenses.reduce((sum, t) => sum + t.amount, 0);
    if (monthlyBudget > 0 && total >= monthlyBudget) list.push({ level: "warn", text: `You have spent your whole monthly budget (${money(total)} of ${money(monthlyBudget)}).` });
    else if (monthlyBudget > 0 && total >= monthlyBudget * 0.9) list.push({ level: "info", text: `You have used ${Math.round(total / monthlyBudget * 100)}% of your monthly budget.` });
  }
  if (notifyOn("goals")) {
    goals.forEach((goal) => {
      if (!goal.deadline || goal.saved >= goal.target) return;
      const days = daysBetween(now, goal.deadline);
      if (days < 0) list.push({ level: "warn", text: `The target date for "${goal.name}" has passed.` });
      else if (days <= 30) list.push({ level: "info", text: `"${goal.name}" is due in ${days} day${days === 1 ? "" : "s"} and you still need ${money(goal.target - goal.saved)}.` });
    });
  }
  if (notifyOn("debts")) {
    debts.filter((d) => d.balance > 0).forEach((debt) => {
      const days = daysBetween(now, nextDebtDue(debt));
      if (days <= 7) list.push({ level: "info", text: `${debt.name} payment of ${money(Math.min(debt.minimum, debt.balance))} is due ${days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`}.` });
    });
  }
  if (notifyOn("backup")) {
    const last = localStorage.getItem(KEYS.lastBackup);
    const age = last ? Math.floor((Date.now() - Date.parse(last)) / 86400000) : null;
    if (age === null) list.push({ level: "info", text: "You have not downloaded a backup yet. Your data only lives in this browser." });
    else if (age >= 30) list.push({ level: "info", text: `Your last backup was ${age} days ago.` });
  }
  if (notifyOn("summary")) {
    const week = periodRange("week", now);
    const prev = periodRange("week", addDays(week.start, -7));
    const sum = (range) => rangeTransactions(range).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    list.push({ level: "summary", text: `This week you have spent ${money(sum(week))}. Last week: ${money(sum(prev))}.` });
  }
  return list;
}
function renderNotifications() {
  const list = buildNotifications();
  const alerts = list.filter((n) => n.level !== "summary").length;
  const badge = $("notify-count");
  if (badge) { badge.textContent = alerts; badge.hidden = alerts === 0; }
  if ($("notify-btn")) $("notify-btn").setAttribute("aria-label", `Notifications, ${alerts} new`);
  if ($("notify-list")) $("notify-list").innerHTML = list.length
    ? list.map((n) => `<li class="notify-${n.level}">${esc(n.text)}</li>`).join("")
    : `<li class="empty-state">You are all caught up.</li>`;
  if ($("notify-prefs")) $("notify-prefs").innerHTML = NOTIFY_TYPES.map(([id, label]) =>
    `<label><input type="checkbox" data-notify="${id}" ${notifyOn(id) ? "checked" : ""} /> ${esc(label)}</label>`).join("");
}
$("notify-btn")?.addEventListener("click", () => { renderNotifications(); openModal("notify-modal"); });
$("notify-prefs")?.addEventListener("change", (event) => {
  const id = event.target.dataset.notify;
  if (!id) return;
  notifyPrefs = { ...notifyPrefs, [id]: event.target.checked };
  save(KEYS.notifyPrefs, notifyPrefs);
  renderNotifications();
});

/* Challenges, streaks and achievements */
const WEEKLY_CHALLENGES = [
  "Make coffee or lunch at home for five days.",
  "Spend nothing on eating out this week.",
  "Find one subscription you can pause or cancel.",
  "Move $10 into a savings goal.",
  "Skip one impulse purchase and note what you saved.",
  "Review last week's transactions and fix any wrong categories.",
  "Try a no-spend weekend.",
  "Sell or donate one thing you no longer use.",
  "Plan your meals before you shop.",
  "Save the loose change from every purchase.",
  "Compare your phone or internet plan with another provider.",
  "Write down one money goal for next month."
];
function weekIndex(weekStart) {
  return Math.floor(daysBetween("2024-01-01", weekStart) / 7);
}
function saveChallenges() { save(KEYS.challenges, challenges); }
function loggingStreaks() {
  const dates = [...new Set(transactions.map((t) => t.date).filter((d) => d <= today()))].sort();
  let best = 0, run = 0, prev = null;
  dates.forEach((d) => {
    run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  });
  const set = new Set(dates);
  let day = set.has(today()) ? today() : addDays(today(), -1);
  let current = 0;
  while (set.has(day)) { current++; day = addDays(day, -1); }
  return { current, best };
}
function noSpendStats() {
  const now = today();
  const start = `${now.slice(0, 7)}-01`;
  const first = transactions.length ? transactions.map((t) => t.date).sort()[0] : now;
  const spendDays = new Set(transactions.filter((t) => t.type === "expense").map((t) => t.date));
  let days = 0, streak = 0;
  for (let d = start > first ? start : first; d <= now; d = addDays(d, 1)) {
    if (!spendDays.has(d)) { days++; streak++; } else streak = 0;
  }
  return { days, streak };
}
function renderChallenges() {
  const stats = $("challenge-stats");
  if (!stats) return;
  const now = today();
  const week = periodRange("week", now).start;
  const done = Array.isArray(challenges.weeklyDone) ? challenges.weeklyDone : [];
  const weeks = Array.isArray(challenges.weeks52) ? challenges.weeks52 : [];
  const logging = loggingStreaks();
  const noSpend = noSpendStats();
  const savedTotal = weeks.reduce((sum, n) => sum + n, 0);

  stats.innerHTML = [
    ["Recording streak", `${logging.current} day${logging.current === 1 ? "" : "s"}`],
    ["Best streak", `${logging.best} day${logging.best === 1 ? "" : "s"}`],
    ["No-spend days this month", `${noSpend.days} (current run ${noSpend.streak})`],
    ["52-week total", money(savedTotal)],
    ["Weekly challenges done", String(done.length)]
  ].map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${esc(value)}</strong></div>`).join("");

  const isDone = done.includes(week);
  $("weekly-challenge").textContent = WEEKLY_CHALLENGES[weekIndex(week) % WEEKLY_CHALLENGES.length];
  $("weekly-done-btn").textContent = isDone ? "Done this week - undo" : "Mark as done";
  $("weekly-done-btn").classList.toggle("primary-btn", !isDone);
  $("weekly-done-btn").classList.toggle("secondary-btn", isDone);

  const next = Array.from({ length: 52 }, (_, i) => i + 1).find((n) => !weeks.includes(n));
  $("weeks52-summary").textContent = weeks.length === 52
    ? `Challenge complete - you saved ${money(savedTotal)}!`
    : `Save the week number in dollars (week 1 = $1 ... week 52 = $52). Saved so far: ${money(savedTotal)}. Next up: ${money(next)}.`;
  $("weeks52-grid").innerHTML = Array.from({ length: 52 }, (_, i) => i + 1).map((n) =>
    `<button type="button" class="week-btn ${weeks.includes(n) ? "done" : ""}" data-week="${n}" aria-pressed="${weeks.includes(n)}" aria-label="Week ${n}, ${money(n)}">${n}</button>`).join("");

  const month = periodRange("month", now);
  const monthSpent = rangeTransactions(month).filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const badges = [
    ["First step", "Record your first transaction", transactions.length > 0],
    ["On a roll", "Record transactions 7 days in a row", logging.best >= 7],
    ["Within budget", "Spend less than your budget this month", monthlyBudget > 0 && monthSpent > 0 && monthSpent <= monthlyBudget],
    ["Goal getter", "Reach a savings goal", goals.some((g) => g.saved >= g.target)],
    ["Saver", "Save $100 across your goals", goals.reduce((s, g) => s + g.saved, 0) >= 100],
    ["Subscription spotter", "Track a subscription", subscriptions.length > 0],
    ["No-spend star", "Have 3 no-spend days this month", noSpend.days >= 3],
    ["Challenger", "Complete a weekly or 52-week challenge", done.length > 0 || weeks.length > 0]
  ];
  $("badge-list").innerHTML = badges.map(([name, text, earned]) =>
    `<li class="${earned ? "earned" : ""}"><strong>${esc(name)}</strong><span>${esc(text)}</span><small>${earned ? "Earned" : "Locked"}</small></li>`).join("");

  const reached = goals.find((g) => g.saved >= g.target);
  $("motivation").textContent = reached ? `You reached "${reached.name}" - amazing work!`
    : logging.current >= 3 ? `${logging.current} days in a row of recording your money. Keep it up!`
    : monthSpent > 0 && monthSpent <= monthlyBudget ? "You are within budget this month. Nice work."
    : "Small steps add up. Try this week's challenge.";
}
$("weekly-done-btn")?.addEventListener("click", () => {
  const week = periodRange("week", today()).start;
  const done = Array.isArray(challenges.weeklyDone) ? challenges.weeklyDone : [];
  challenges = { ...challenges, weeklyDone: done.includes(week) ? done.filter((w) => w !== week) : [...done, week] };
  saveChallenges();
  renderChallenges();
});
$("weeks52-grid")?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-week]");
  if (!button) return;
  const n = Number(button.dataset.week);
  const weeks = Array.isArray(challenges.weeks52) ? challenges.weeks52 : [];
  challenges = { ...challenges, weeks52: weeks.includes(n) ? weeks.filter((x) => x !== n) : [...weeks, n] };
  saveChallenges();
  renderChallenges();
});

/* Debt tracker */
const DEBT_TYPES = ["Credit card", "Personal loan", "Student loan", "Buy now pay later", "Other"];
function cleanDebt(item) {
  if (!item || !String(item.name || "").trim()) return null;
  const balance = validAmount(item.balance, true);
  const original = validAmount(item.original);
  const rateValue = Number(item.rate ?? 0);
  const minimum = validAmount(item.minimum);
  const dueDay = Number(item.dueDay);
  if (balance === null || original === null || minimum === null || !Number.isFinite(rateValue) ||
      item.balance === "" || item.rate === "" || item.dueDay === "" ||
      rateValue < 0 || rateValue > 100 || !Number.isInteger(dueDay) || !(dueDay >= 1 && dueDay <= 31)) return null;
  return {
    id: String(item.id || uid()), name: String(item.name).trim(),
    type: DEBT_TYPES.includes(item.type) ? item.type : "Other",
    original: Math.max(original, balance), balance, rate: rateValue, minimum, dueDay,
    payments: (Array.isArray(item.payments) ? item.payments : [])
      .filter((p) => p && validAmount(p.amount) && validDate(p.date)).map((p) => ({ date: p.date, amount: Number(p.amount) }))
  };
}
debts = (Array.isArray(debts) ? debts : []).map(cleanDebt).filter(Boolean);
if (!["avalanche", "snowball"].includes(debtPlan.strategy)) debtPlan = { ...debtPlan, strategy: "avalanche" };
debtPlan.extra = validAmount(debtPlan.extra, true) ?? 0;
function saveDebts() { save(KEYS.debts, debts); }
function nextDebtDue(debt) {
  const now = today();
  for (let i = 0; i < 3; i++) {
    const month = shiftMonth(now, i);
    const day = Math.min(debt.dueDay, new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate());
    const candidate = `${month.slice(0, 7)}-${pad(day)}`;
    if (candidate >= now) return candidate;
  }
  return now;
}
function debtOrder(list, strategy) {
  return list.slice().sort((a, b) => strategy === "snowball" ? a.balance - b.balance || b.rate - a.rate : b.rate - a.rate || a.balance - b.balance);
}
function simulateDebts(strategy, extra) {
  const items = debts.filter((d) => d.balance > 0.005).map((d) => ({ id: d.id, balance: d.balance, rate: d.rate / 1200, minimum: d.minimum, rawRate: d.rate }));
  const result = { months: 0, interest: 0, payoff: {}, never: false };
  const total = extra + items.reduce((sum, d) => sum + d.minimum, 0);
  while (items.some((d) => d.balance > 0.005)) {
    if (result.months >= 600) { result.never = true; break; }
    result.months++;
    items.forEach((d) => { if (d.balance > 0) { const interest = d.balance * d.rate; d.balance += interest; result.interest += interest; } });
    let pool = total;
    items.forEach((d) => { if (d.balance > 0) { const pay = Math.min(d.minimum, d.balance); d.balance -= pay; pool -= pay; } });
    const queue = items.filter((d) => d.balance > 0.005).sort((a, b) => strategy === "snowball" ? a.balance - b.balance || b.rawRate - a.rawRate : b.rawRate - a.rawRate || a.balance - b.balance);
    for (const d of queue) { const pay = Math.min(pool, d.balance); d.balance -= pay; pool -= pay; }
    items.forEach((d) => { if (d.balance <= 0.005 && !(d.id in result.payoff)) result.payoff[d.id] = result.months; });
  }
  return result;
}
function monthsFromNow(months) {
  const date = shiftMonth(today(), months);
  return formatDate(date, { month: "long", year: "numeric" });
}
function renderDebts() {
  const list = $("debt-list");
  if (!list) return;
  const owing = debts.reduce((sum, d) => sum + d.balance, 0);
  const active = debts.filter((d) => d.balance > 0.005);
  $("debt-total").textContent = money(owing);
  $("debt-minimums").textContent = money(active.reduce((sum, d) => sum + d.minimum, 0));
  $("debt-strategy").value = debtPlan.strategy;
  if (document.activeElement !== $("debt-extra")) $("debt-extra").value = debtPlan.extra;
  const plan = simulateDebts(debtPlan.strategy, debtPlan.extra);
  let summary = "";
  if (!debts.length) summary = "Add a credit card, loan or student loan to see your payoff plan.";
  else if (!active.length) summary = "You are debt free. Brilliant work!";
  else if (plan.never) summary = "Not paid off within 50 years in this estimate. Consider increasing payments.";
  else {
    const other = simulateDebts(debtPlan.strategy === "avalanche" ? "snowball" : "avalanche", debtPlan.extra);
    const saved = other.interest - plan.interest;
    summary = `Estimated ${plan.months} month${plan.months === 1 ? "" : "s"} and ${money(plan.interest)} interest, assuming fixed rates and monthly payments; fees are excluded.` +
      (!other.never && saved > 0.5 ? ` This strategy saves about ${money(saved)} compared with ${debtPlan.strategy === "avalanche" ? "snowball" : "avalanche"}.` : "");
  }
  $("debt-free").textContent = active.length && !plan.never ? monthsFromNow(plan.months) : active.length ? "Not on track" : debts.length ? "Debt free" : "-";
  $("debt-summary").textContent = summary;
  const first = debtOrder(active, debtPlan.strategy)[0]?.id;
  list.innerHTML = debts.length ? debts.map((d) => {
    const percent = Math.min(100, Math.round((d.original - d.balance) / d.original * 100));
    const paidOff = d.balance <= 0.005;
    const month = plan.payoff[d.id];
    const due = paidOff ? "" : `Due ${formatDate(nextDebtDue(d), { day: "numeric", month: "short" })}`;
    return `<article class="goal-card debt-card ${paidOff ? "goal-complete" : ""}">
      <div class="category-budget-head"><strong>${esc(d.name)} ${d.id === first && active.length > 1 ? `<span class="pill">Pay first</span>` : ""}</strong><span>${money(d.balance)} / ${money(d.original)}</span></div>
      <progress max="100" value="${percent}" aria-label="${esc(d.name)} ${percent}% repaid"></progress>
      <div class="category-budget-foot"><span>${esc(d.type)} · ${d.rate}% a year · min ${money(d.minimum)} · ${percent}% repaid</span>
        <span class="transaction-actions">
          ${paidOff ? "" : `<button class="mini-btn pay-debt" data-id="${esc(d.id)}" type="button">Pay</button>`}
          <button class="mini-btn edit-debt" data-id="${esc(d.id)}" type="button">Edit</button>
          <button class="mini-btn delete-debt" data-id="${esc(d.id)}" type="button">Delete</button>
        </span>
      </div>
      <small class="goal-timing">${paidOff ? "Paid off" : `${due}${month ? ` · paid off ${monthsFromNow(month)}` : ""}`}</small>
    </article>`;
  }).join("") : `<p class="empty-state">No debts tracked yet.</p>`;
}
function openDebt(id = "") {
  const debt = debts.find((d) => d.id === id);
  $("debt-form").reset();
  $("debt-id").value = debt?.id || "";
  $("debt-name").value = debt?.name || "";
  $("debt-type").value = debt?.type || "Credit card";
  $("debt-original").value = debt?.original ?? "";
  $("debt-balance").value = debt?.balance ?? "";
  $("debt-rate").value = debt?.rate ?? 0;
  $("debt-minimum").value = debt?.minimum ?? "";
  $("debt-day").value = debt?.dueDay ?? 1;
  $("debt-modal-title").textContent = debt ? "Edit debt" : "Add debt";
  formError("debt-form-error", "");
  openModal("debt-modal");
}
$("add-debt-btn")?.addEventListener("click", () => openDebt());
$("debt-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const id = $("debt-id").value;
  const old = debts.find((d) => d.id === id);
  const debt = cleanDebt({
    id: id || uid(), name: $("debt-name").value, type: $("debt-type").value, original: $("debt-original").value,
    balance: $("debt-balance").value, rate: $("debt-rate").value, minimum: $("debt-minimum").value,
    dueDay: $("debt-day").value, payments: old?.payments || []
  });
  if (!debt) return formError("debt-form-error", "Enter a name, balances above zero, a rate from 0 to 100, a minimum payment and a due day from 1 to 31.");
  debts = id ? debts.map((d) => d.id === id ? debt : d) : [...debts, debt];
  saveDebts();
  render();
  closeModal("debt-modal");
});
$("debt-strategy")?.addEventListener("change", () => {
  debtPlan = { ...debtPlan, strategy: $("debt-strategy").value };
  save(KEYS.debtPlan, debtPlan);
  renderDebts();
});
$("debt-extra")?.addEventListener("input", () => {
  debtPlan = { ...debtPlan, extra: validAmount($("debt-extra").value, true) ?? 0 };
  save(KEYS.debtPlan, debtPlan);
  renderDebts();
});
$("debt-pay-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const debt = debts.find((d) => d.id === $("debt-pay-id").value);
  const amount = validAmount($("debt-pay-amount").value);
  const date = $("debt-pay-date").value;
  if (!debt || amount === null || !validDate(date)) return formError("debt-pay-error", "Enter a payment above zero and a valid date.");
  if (amount > debt.balance) return formError("debt-pay-error", `Payment cannot exceed the current balance of ${money(debt.balance)}.`);
  const applied = amount;
  debts = debts.map((d) => d.id === debt.id ? { ...d, balance: Math.round((d.balance - applied) * 100) / 100, payments: [...d.payments, { date, amount: applied }] } : d);
  saveDebts();
  if ($("debt-pay-expense").checked) {
    rememberCategory("Debt repayment");
    transactions.push({ id: uid(), type: "expense", amount: applied, description: `${debt.name} payment`, category: "Debt repayment", date, notes: "Debt payment" });
    saveTransactions();
  }
  render();
  closeModal("debt-pay-modal");
});
if ($("debt-pay-form")) {
  const hint = document.createElement("p");
  hint.className = "modal-hint";
  hint.textContent = "The payment reduces the balance you entered; interest is not added automatically. An optional expense is separate: editing or deleting it will not change this balance.";
  $("debt-pay-form").insertBefore(hint, $("debt-pay-form").querySelector(".modal-actions"));
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.matches(".edit-debt")) openDebt(button.dataset.id);
  else if (button.matches(".pay-debt")) {
    const debt = debts.find((d) => d.id === button.dataset.id);
    if (!debt) return;
    $("debt-pay-form").reset();
    $("debt-pay-expense").checked = false;
    $("debt-pay-id").value = debt.id;
    $("debt-pay-amount").value = Math.min(debt.minimum, debt.balance);
    $("debt-pay-date").value = today();
    $("debt-pay-title").textContent = `Record payment: ${debt.name}`;
    formError("debt-pay-error", "");
    openModal("debt-pay-modal");
  } else if (button.matches(".delete-debt") && confirm("Delete this debt?")) {
    debts = debts.filter((d) => d.id !== button.dataset.id);
    saveDebts();
    render();
  }
});

/* Financial forecasting */
function monthExpenseIncome(anchor) {
  const items = rangeTransactions(periodRange("month", anchor));
  return {
    count: items.length,
    spent: items.filter((t) => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
    income: items.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0)
  };
}
function renderForecast() {
  const box = $("forecast-month");
  if (!box) return;
  const now = today();
  const range = periodRange("month", now);
  const daysInMonth = daysBetween(range.start, range.end) + 1;
  const elapsed = daysBetween(range.start, now) + 1;
  const current = monthExpenseIncome(now);
  const projected = current.spent / elapsed * daysInMonth;
  const diff = monthlyBudget - projected;
  box.innerHTML = `<p>Spent so far <strong>${money(current.spent)}</strong> (day ${elapsed} of ${daysInMonth})</p>
    <p>Projected month-end spending <strong>${money(projected)}</strong></p>
    <p class="${diff < 0 ? "forecast-over" : "forecast-ok"}">${monthlyBudget <= 0 ? "Set a monthly budget to compare." : diff < 0
      ? `On this pace you will go ${money(-diff)} over your ${money(monthlyBudget)} budget.`
      : `On this pace you will finish ${money(diff)} under your ${money(monthlyBudget)} budget.`}</p>`;
  const past = [1, 2, 3].map((i) => monthExpenseIncome(shiftMonth(now, -i))).filter((m) => m.count > 0);
  const avg = (key) => past.length ? past.reduce((sum, m) => sum + m[key], 0) / past.length : 0;
  const spend = avg("spent");
  const income = avg("income");
  $("forecast-basis").textContent = past.length
    ? `Cumulative projected income minus spending, starting at zero; based on the average of ${past.length} of the last 3 months with recorded transactions: ${money(income)} income and ${money(spend)} spending. Incomplete records can skew this estimate.`
    : "";
  if (!past.length) {
    $("forecast-list").innerHTML = `<li class="empty-state">Record income and spending in a previous month to see an estimate.</li>`;
    return;
  }
  let running = 0;
  const rows = [1, 2, 3, 4, 5, 6].map((i) => {
    const net = income - spend;
    running += net;
    return { label: formatDate(shiftMonth(now, i), { month: "short", year: "numeric" }), net, running };
  });
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.running)));
  $("forecast-list").innerHTML = rows.map((r) => `<li>
    <span>${esc(r.label)}</span>
    <span class="forecast-track"><span class="forecast-fill ${r.running < 0 ? "negative" : ""}" style="width:${Math.max(2, Math.round(Math.abs(r.running) / max * 100))}%"></span></span>
    <strong>${money(r.running)}</strong></li>`).join("");
}

/* CSV import */
function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [], cell = "", quoted = false, closedQuote = false;
  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    if (quoted) {
      if (char === '"' && clean[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
    } else if (char === '"') {
      if (cell || closedQuote) throw new Error("Invalid quote in CSV.");
      quoted = true;
    } else if (char === ",") { row.push(cell); cell = ""; closedQuote = false; }
    else if (char === "\n" || char === "\r") {
      if (char === "\r" && clean[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = []; closedQuote = false;
    } else {
      if (closedQuote) throw new Error("Unexpected text after a quoted CSV field.");
      cell += char;
    }
  }
  if (quoted) throw new Error("Unclosed quoted CSV field.");
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}
function importCsvRows(rows) {
  const header = rows[0].map((h) => h.trim().toLowerCase());
  if (new Set(header).size !== header.length) throw new Error("Duplicate column names.");
  const find = (name) => header.indexOf(name);
  const cols = {
    date: find("date"), type: find("type"), description: find("description"),
    category: find("category"), amount: find("amount"), notes: find("notes")
  };
  if (cols.date < 0 || cols.type < 0 || cols.amount < 0) throw new Error("Columns Date, Type and Amount are required.");
  const result = { added: [], duplicates: 0 };
  const seen = new Set(transactions.map((t) => `${t.date}|${t.type}|${t.amount.toFixed(2)}|${t.description.toLowerCase()}`));
  rows.slice(1).forEach((cells, index) => {
    const row = index + 2;
    if (cells.length !== header.length) throw new Error(`Row ${row}: incorrect number of columns.`);
    const date = cells[cols.date].trim();
    const type = cells[cols.type].trim().toLowerCase();
    const amountText = cells[cols.amount].trim();
    if (!validDate(date)) throw new Error(`Row ${row}: use a valid YYYY-MM-DD date.`);
    if (!["income", "expense"].includes(type)) throw new Error(`Row ${row}: type must be income or expense.`);
    if (!/^\d+(?:\.\d{1,2})?$/.test(amountText) || !validAmount(amountText)) throw new Error(`Row ${row}: amount must be positive, with a decimal point and no separators.`);
    const description = (cells[cols.description] || "").trim() || "Imported transaction";
    const wanted = (cells[cols.category] || "").trim();
    const category = categories.find((c) => c.toLowerCase() === wanted.toLowerCase()) || wanted || (type === "income" ? "Income" : "Other");
    const item = { id: uid(), type, amount: Number(amountText), description, category, date, notes: cells[cols.notes] || "" };
    const key = `${date}|${type}|${item.amount.toFixed(2)}|${description.toLowerCase()}`;
    if (seen.has(key)) result.duplicates++;
    seen.add(key);
    result.added.push(item);
  });
  return result;
}
$("import-csv-input")?.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const rows = parseCsv(await file.text());
    if (rows.length < 2) throw new Error("The CSV must contain a header and at least one transaction.");
    const result = importCsvRows(rows);
    if (!confirm(`Import ${result.added.length} transaction${result.added.length === 1 ? "" : "s"}?${result.duplicates ? `\n${result.duplicates} may be duplicates and will also be imported.` : ""}`)) return;
    result.added.forEach((t) => rememberCategory(t.category));
    transactions = [...transactions, ...result.added];
    saveTransactions();
    render();
    showMessage("backup-message", `Imported ${result.added.length} transaction${result.added.length === 1 ? "" : "s"}.`);
  } catch (error) {
    console.error("Could not import CSV:", error);
    showMessage("backup-message", `Import failed: ${error.message} No transactions were imported.`);
  } finally {
    event.target.value = "";
  }
});
if ($("import-csv-input")) {
  const hint = document.createElement("p");
  hint.className = "modal-hint";
  hint.textContent = "CSV import uses Date, Type and Amount columns: YYYY-MM-DD dates, income/expense types and positive decimal amounts (no thousands separators). Exported spreadsheet-safety apostrophes are kept; use JSON backups for an exact restore.";
  $("import-csv-input").closest(".panel-buttons").after(hint);
}

/* PDF financial report (uses the browser's Save as PDF) */
function buildReport(month) {
  const range = periodRange("month", `${month}-01`);
  const items = rangeTransactions(range);
  const expenses = items.filter((t) => t.type === "expense");
  const income = items.filter((t) => t.type === "income").reduce((sum, t) => sum + t.amount, 0);
  const spent = expenses.reduce((sum, t) => sum + t.amount, 0);
  const byCategory = {};
  expenses.forEach((t) => { byCategory[t.category] = (byCategory[t.category] || 0) + t.amount; });
  const cats = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const saved = income - spent;
  const rate = income > 0 ? Math.round(saved / income * 100) : null;
  const billRows = billOccurrences(range);
  const table = (head, rows) => `<table><thead><tr>${head.map((h, i) => `<th${i ? ' class="num"' : ""}>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`;
  return `<h2>${esc(formatDate(range.start, { month: "long", year: "numeric" }))}</h2>
    <p class="report-sub">Money Planner report · created ${esc(formatDate(today(), { day: "numeric", month: "long", year: "numeric" }))}</p>
    <div class="report-stats">
      <p>Income<strong>${money(income)}</strong></p><p>Spent<strong>${money(spent)}</strong></p>
      <p>Net<strong>${money(saved)}</strong></p><p>Budget<strong>${money(monthlyBudget)}</strong></p>
      <p>Saved<strong>${rate === null ? "-" : `${rate}%`}</strong></p></div>
    <h3>Spending by category</h3>
    ${cats.length ? table(["Category", "Spent", "Share"], cats.map(([c, v]) => `<tr><td>${esc(c)}</td><td class="num">${money(v)}</td><td class="num">${Math.round(v / spent * 100)}%</td></tr>`)) : "<p>No spending recorded.</p>"}
    <h3>Bills</h3>
    ${billRows.length ? table(["Bill", "Amount", "Status"], billRows.map((b) => `<tr><td>${esc(b.bill.name)} (${esc(formatDate(b.date, { day: "numeric", month: "short" }))})</td><td class="num">${money(b.bill.amount)}</td><td class="num">${b.paid ? "Paid" : "Unpaid"}</td></tr>`)) : "<p>No bills this month.</p>"}
    <h3>Savings goals (current)</h3>
    ${goals.length ? table(["Goal", "Saved", "Target"], goals.map((g) => `<tr><td>${esc(g.name)}</td><td class="num">${money(g.saved)}</td><td class="num">${money(g.target)}</td></tr>`)) : "<p>No savings goals.</p>"}
    <h3>Debts (current)</h3>
    ${debts.length ? table(["Debt", "Balance", "Rate"], debts.map((d) => `<tr><td>${esc(d.name)}</td><td class="num">${money(d.balance)}</td><td class="num">${d.rate}%</td></tr>`)) : "<p>No debts tracked.</p>"}
    <h3>Subscriptions (current)</h3>
    ${subscriptions.length ? table(["Subscription", "Per month", "Per year"], subscriptions.map((s) => `<tr><td>${esc(s.name)}</td><td class="num">${money(s.amount * CYCLES[s.cycle].perMonth)}</td><td class="num">${money(s.amount * CYCLES[s.cycle].perMonth * 12)}</td></tr>`)) : "<p>No subscriptions.</p>"}`;
}
function renderReport() {
  const month = $("report-month").value || today().slice(0, 7);
  $("report-body").innerHTML = buildReport(month);
}
$("report-btn")?.addEventListener("click", () => {
  $("report-month").value = today().slice(0, 7);
  renderReport();
  openModal("report-modal");
});
$("report-month")?.addEventListener("change", renderReport);
$("report-print-btn")?.addEventListener("click", () => {
  document.body.classList.add("printing-report");
  window.print();
});
window.addEventListener("afterprint", () => document.body.classList.remove("printing-report"));

/* Installable app (PWA) */
let installPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  if ($("install-btn")) $("install-btn").hidden = false;
});
$("install-btn")?.addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $("install-btn").hidden = true;
});
window.addEventListener("appinstalled", () => { if ($("install-btn")) $("install-btn").hidden = true; });
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch((error) => console.error("Service worker failed:", error)));
}

renderCategoryOptions();
render();