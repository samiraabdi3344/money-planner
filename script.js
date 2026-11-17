/* =========================
   Storage keys and settings
   ========================= */
const STORAGE_KEY = "money-dashboard-transactions";
const PLAN_STORAGE_KEY = "money-dashboard-plan"; // old single plan, migrated below
const ALLOCATIONS_KEY = "money-dashboard-allocations";
const BILLS_KEY = "money-dashboard-bills";
const BUDGET_KEY = "money-dashboard-budget";
const PERIOD_KEY = "money-dashboard-period";
const SEEDED_KEY = "money-dashboard-seeded";
const THEME_KEY = "money-dashboard-theme";

const DEFAULT_BUDGET = 1200;
const SPENDING_DAYS_SHOWN = 5;
const RECENT_COUNT = 4;

// Budget and set-aside amounts are monthly. Weekly and fortnightly views use a share of them.
const PERIOD_FACTOR = { month: 1, fortnight: 12 / 26, week: 12 / 52 };

const themeNames = [
  "theme-botanical-light",
  "theme-botanical-dark",
  "theme-celestial-light",
  "theme-celestial-dark",
  "theme-ocean-light",
  "theme-ocean-dark",
  "theme-meadow-light",
  "theme-meadow-dark",
  "theme-berry-light",
  "theme-berry-dark"
];

const $ = (id) => document.getElementById(id);

/* =========================
   Helpers
   Dates are plain "YYYY-MM-DD" text so time zones can never shift a day.
   ========================= */
function uid() {
  if (window.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function pad(number) {
  return String(number).padStart(2, "0");
}

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function isValidDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addDays(iso, days) {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}

function daysBetween(fromIso, toIso) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86400000);
}

function dayOfWeek(iso) {
  return new Date(`${iso}T00:00:00Z`).getUTCDay();
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function monthStart(iso) {
  return `${iso.slice(0, 7)}-01`;
}

function shiftMonth(iso, months) {
  const year = Number(iso.slice(0, 4));
  const month = Number(iso.slice(5, 7)) - 1 + months;
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

function formatDate(iso, options) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { ...options, timeZone: "UTC" });
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function loadJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch (error) {
    console.error(`Could not read saved data for ${key}:`, error);
    return undefined;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Could not save data for ${key}:`, error);
  }
}

/* =========================
   Loading saved data (bad data is ignored, never crashes the page)
   ========================= */
function sanitizeTransaction(item) {
  if (!item || typeof item !== "object") return null;

  const amount = Number(item.amount);
  if (!["expense", "income"].includes(item.type)) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!isValidDate(item.date)) return null;

  const clean = {
    id: typeof item.id === "string" && item.id ? item.id : uid(),
    type: item.type,
    amount,
    description: String(item.description || "").trim() || "Untitled",
    category: String(item.category || "").trim(),
    date: item.date,
    notes: String(item.notes || "")
  };

  if (item.billId) {
    clean.billId = String(item.billId);
    clean.billDue = isValidDate(item.billDue) ? item.billDue : item.date;
  }

  return clean;
}

function sanitizeBill(item) {
  if (!item || typeof item !== "object") return null;

  const amount = Number(item.amount);
  const name = String(item.name || "").trim();
  if (!name || !Number.isFinite(amount) || amount <= 0 || !isValidDate(item.due)) return null;

  return {
    id: typeof item.id === "string" && item.id ? item.id : uid(),
    name,
    amount,
    due: item.due,
    recurring: Boolean(item.recurring)
  };
}

function sanitizeAllocation(item) {
  if (!item || typeof item !== "object") return null;

  const amount = Number(item.amount);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  return {
    id: typeof item.id === "string" && item.id ? item.id : uid(),
    name: String(item.name || "").trim() || "Set aside",
    amount
  };
}

function createSampleTransactions() {
  const today = todayISO();
  const month = today.slice(0, 7);
  const todayDay = Number(today.slice(8, 10));
  const day = (number) => `${month}-${pad(Math.min(number, todayDay))}`;

  return [
    { id: uid(), type: "income", amount: 1200, description: "Monthly pay", category: "Income", date: day(1), notes: "" },
    { id: uid(), type: "expense", amount: 42, description: "Groceries", category: "Groceries", date: day(3), notes: "" },
    { id: uid(), type: "expense", amount: 20, description: "Bus pass", category: "Transport", date: day(5), notes: "" },
    { id: uid(), type: "expense", amount: 8, description: "Coffee", category: "Eating out", date: day(5), notes: "" }
  ];
}

function createSampleBills() {
  const month = todayISO().slice(0, 7);
  return [
    { id: uid(), name: "Rent", amount: 400, due: `${month}-28`, recurring: true },
    { id: uid(), name: "Internet", amount: 60, due: `${month}-25`, recurring: true },
    { id: uid(), name: "Phone", amount: 45, due: `${month}-20`, recurring: true }
  ];
}

let transactions = [];
const savedTransactions = loadJSON(STORAGE_KEY);
if (Array.isArray(savedTransactions)) {
  transactions = savedTransactions.map(sanitizeTransaction).filter(Boolean);
}

// Sample transactions are only created once, for first-time users.
if (localStorage.getItem(SEEDED_KEY) === null) {
  if (!transactions.length) transactions = createSampleTransactions();
  saveJSON(STORAGE_KEY, transactions);
  localStorage.setItem(SEEDED_KEY, "1");
}

let bills = [];
const savedBills = loadJSON(BILLS_KEY);
if (Array.isArray(savedBills)) {
  bills = savedBills.map(sanitizeBill).filter(Boolean);
} else {
  bills = createSampleBills();
  saveJSON(BILLS_KEY, bills);
}

let allocations = [];
const savedAllocations = loadJSON(ALLOCATIONS_KEY);
if (Array.isArray(savedAllocations)) {
  allocations = savedAllocations.map(sanitizeAllocation).filter(Boolean);
} else {
  const oldPlan = loadJSON(PLAN_STORAGE_KEY);
  if (oldPlan && Number(oldPlan.amount) > 0) {
    allocations = [sanitizeAllocation({ name: oldPlan.note, amount: oldPlan.amount })].filter(Boolean);
  }
  saveJSON(ALLOCATIONS_KEY, allocations);
}

let monthlyBudget = DEFAULT_BUDGET;
const savedBudget = loadJSON(BUDGET_KEY);
if (typeof savedBudget === "number" && Number.isFinite(savedBudget) && savedBudget >= 0) {
  monthlyBudget = savedBudget;
}

let periodType = loadJSON(PERIOD_KEY);
if (!Object.keys(PERIOD_FACTOR).includes(periodType)) periodType = "month";
let periodAnchor = todayISO();

function saveTransactions() { saveJSON(STORAGE_KEY, transactions); }
function saveBills() { saveJSON(BILLS_KEY, bills); }
function saveAllocations() { saveJSON(ALLOCATIONS_KEY, allocations); }
function saveBudget() { saveJSON(BUDGET_KEY, monthlyBudget); }

/* =========================
   Planning period (week / fortnight / month)
   ========================= */
function getPeriodRange(type = periodType, anchor = periodAnchor) {
  if (type === "week") {
    const offset = (dayOfWeek(anchor) + 6) % 7; // weeks start on Monday
    const start = addDays(anchor, -offset);
    return { start, end: addDays(start, 6) };
  }

  if (type === "fortnight") {
    const epoch = "2024-01-01"; // a Monday, so fortnights always line up
    const start = addDays(epoch, Math.floor(daysBetween(epoch, anchor) / 14) * 14);
    return { start, end: addDays(start, 13) };
  }

  const start = monthStart(anchor);
  return { start, end: addDays(shiftMonth(anchor, 1), -1) };
}

function stepPeriod(direction) {
  if (periodType === "month") periodAnchor = shiftMonth(periodAnchor, direction);
  else periodAnchor = addDays(periodAnchor, (periodType === "week" ? 7 : 14) * direction);
  renderDashboard();
}

function getPeriodLabel(range) {
  if (periodType === "month") {
    return formatDate(range.start, { month: "long", year: "numeric" });
  }

  const from = formatDate(range.start, { day: "numeric", month: "short" });
  const to = formatDate(range.end, { day: "numeric", month: "short", year: "numeric" });
  return `${from} – ${to}`;
}

function getPeriodTransactions(range) {
  return transactions.filter((item) => item.date >= range.start && item.date <= range.end);
}

/* =========================
   Bills (one list, each due date is its own "occurrence")
   Paying a bill creates one expense transaction, so it is never counted twice.
   ========================= */
function findBillPayment(billId, due) {
  return transactions.find((item) => item.billId === billId && item.billDue === due);
}

function getBillOccurrences(range) {
  const occurrences = [];

  bills.forEach((bill) => {
    const dates = [];

    if (!bill.recurring) {
      dates.push(bill.due);
    } else {
      const dueDay = Number(bill.due.slice(8, 10));
      let cursor = monthStart(range.start);

      while (cursor <= range.end) {
        const year = Number(cursor.slice(0, 4));
        const month = Number(cursor.slice(5, 7));
        const date = `${cursor.slice(0, 7)}-${pad(Math.min(dueDay, daysInMonth(year, month)))}`;
        if (date >= bill.due) dates.push(date);
        cursor = shiftMonth(cursor, 1);
      }
    }

    dates
      .filter((date) => date >= range.start && date <= range.end)
      .forEach((date) => {
        occurrences.push({ bill, date, paid: Boolean(findBillPayment(bill.id, date)) });
      });
  });

  return occurrences.sort((a, b) => a.date.localeCompare(b.date) || a.bill.name.localeCompare(b.bill.name));
}

function toggleBillPaid(billId, due) {
  const payment = findBillPayment(billId, due);

  if (payment) {
    transactions = transactions.filter((item) => item !== payment);
  } else {
    const bill = bills.find((item) => item.id === billId);
    if (!bill) return;

    transactions.push({
      id: uid(),
      type: "expense",
      amount: bill.amount,
      description: bill.name,
      category: "Bills",
      date: due,
      notes: "Bill payment",
      billId: bill.id,
      billDue: due
    });
  }

  saveTransactions();
  renderDashboard();
}

/* =========================
   Calculations
   ========================= */
function getTotals() {
  const range = getPeriodRange();
  const factor = PERIOD_FACTOR[periodType];
  const periodTransactions = getPeriodTransactions(range);

  const spent = periodTransactions
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  const income = periodTransactions
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);

  const budget = monthlyBudget * factor;
  const plannedReserve = allocations.reduce((sum, item) => sum + item.amount, 0) * factor;

  const billsAllocated = getBillOccurrences(range)
    .filter((occurrence) => !occurrence.paid)
    .reduce((sum, occurrence) => sum + occurrence.bill.amount, 0);

  const remaining = budget - spent;
  const flexibleSpending = remaining - plannedReserve - billsAllocated;

  return { budget, income, spent, remaining, plannedReserve, billsAllocated, flexibleSpending };
}

/* =========================
   Rendering
   ========================= */
function renderPeriodControls() {
  const select = $("period-type");
  if (select) select.value = periodType;

  const label = $("period-label");
  if (label) label.textContent = getPeriodLabel(getPeriodRange());
}

function renderSummaryCards() {
  const totals = getTotals();

  const values = {
    "budget-total": totals.budget,
    "spent-total": totals.spent,
    "remaining-total": totals.remaining,
    "available-to-plan": totals.flexibleSpending,
    "planned-amount-total": totals.plannedReserve,
    "bills-allocated": totals.billsAllocated
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = $(id);
    if (element) element.textContent = formatMoney(value);
  });

  const note = $("budget-note");
  if (note) {
    note.textContent = periodType === "month"
      ? `Income this period: ${formatMoney(totals.income)}`
      : `Share of ${formatMoney(monthlyBudget)}/month · Income ${formatMoney(totals.income)}`;
  }
}

function renderBills() {
  const list = $("upcoming-bills-list");
  if (!list) return;

  const occurrences = getBillOccurrences(getPeriodRange());

  if (!occurrences.length) {
    list.innerHTML = `<li class="empty-state">No bills due in this period.</li>`;
    return;
  }

  list.innerHTML = occurrences.map(({ bill, date, paid }) => `
    <li class="${paid ? "is-paid" : ""}">
      <span class="bill-name">${escapeHtml(bill.name)}<time datetime="${date}">${formatDate(date, { day: "numeric", month: "short" })}${bill.recurring ? " · monthly" : ""}</time></span>
      <strong>${formatMoney(bill.amount)}</strong>
      <div class="bill-actions">
        <button type="button" class="mini-btn pay-bill" data-bill-id="${escapeHtml(bill.id)}" data-due="${date}">${paid ? "Undo" : "Mark paid"}</button>
        <button type="button" class="mini-btn edit-bill" data-bill-id="${escapeHtml(bill.id)}">Edit</button>
        <button type="button" class="mini-btn delete-bill" data-bill-id="${escapeHtml(bill.id)}">Delete</button>
      </div>
    </li>
  `).join("");
}

function renderAllocations() {
  const list = $("allocation-list");
  if (list) {
    list.innerHTML = allocations.length
      ? allocations.map((item) => `
        <li>
          <span class="allocation-name">${escapeHtml(item.name)}</span>
          <strong>${formatMoney(item.amount)}</strong>
          <div class="transaction-actions">
            <button type="button" class="mini-btn edit-allocation" data-id="${escapeHtml(item.id)}">Edit</button>
            <button type="button" class="mini-btn delete-allocation" data-id="${escapeHtml(item.id)}">Delete</button>
          </div>
        </li>
      `).join("")
      : `<li class="empty-state">Nothing set aside yet.</li>`;
  }

  const note = $("planned-note-display");
  if (note) {
    note.textContent = allocations.length
      ? allocations.map((item) => item.name).join(", ")
      : "For savings or another goal.";
  }
}

function transactionRowHtml(item, withMeta) {
  const meta = withMeta
    ? `<small class="transaction-meta">${formatDate(item.date, { day: "numeric", month: "short", year: "numeric" })}${item.category ? ` · ${escapeHtml(item.category)}` : ""}</small>`
    : "";

  return `
    <li>
      <div class="transaction-info">
        <span>${escapeHtml(item.description)}${meta}</span>
        <strong>${item.type === "expense" ? "-" : "+"}${formatMoney(item.amount)}</strong>
      </div>
      <div class="transaction-actions">
        <button type="button" class="mini-btn edit-transaction" data-id="${escapeHtml(item.id)}">Edit</button>
        <button type="button" class="mini-btn delete-transaction" data-id="${escapeHtml(item.id)}">Delete</button>
      </div>
    </li>
  `;
}

function renderRecentTransactions() {
  const list = $("recent-transactions-list");
  if (!list) return;

  // Reversing first means that, on the same date, the newest entry is listed first.
  const recent = [...getPeriodTransactions(getPeriodRange())]
    .reverse()
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, RECENT_COUNT);

  list.innerHTML = recent.length
    ? recent.map((item) => transactionRowHtml(item, false)).join("")
    : `<li class="empty-state">No transactions in this period yet.</li>`;
}

function groupExpensesByDate(range) {
  const grouped = {};

  getPeriodTransactions(range)
    .filter((item) => item.type === "expense")
    .forEach((item) => {
      grouped[item.date] = (grouped[item.date] || 0) + item.amount;
    });

  return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
}

function renderSpendingByDate() {
  const container = $("spending-by-date-list");
  if (!container) return;

  const range = getPeriodRange();
  const groups = groupExpensesByDate(range);

  if (!groups.length) {
    container.innerHTML = `<div class="empty-state">No spending in this period. Add a transaction to see your daily totals.</div>`;
    return;
  }

  const shown = groups.slice(0, SPENDING_DAYS_SHOWN);

  container.innerHTML = shown.map(([date, total], index) => `
    <details class="details-spending" ${index === 0 ? "open" : ""}>
      <summary>
        <span>${formatDate(date, { day: "numeric", month: "short" })}</span>
        <strong>${formatMoney(total)}</strong>
      </summary>
      <ul class="mini-list">
        ${getPeriodTransactions(range)
          .filter((item) => item.type === "expense" && item.date === date)
          .map((item) => `<li>${escapeHtml(item.description)} <span>${formatMoney(item.amount)}</span></li>`)
          .join("")}
      </ul>
    </details>
  `).join("")
    + (groups.length > shown.length
      ? `<p class="empty-state">Showing the latest ${SPENDING_DAYS_SHOWN} days. Use View all to see the rest.</p>`
      : "");
}

// Only one spending date can be open at a time.
$("spending-by-date-list")?.addEventListener("toggle", (event) => {
  if (!event.target.open) return;
  event.currentTarget.querySelectorAll("details").forEach((details) => {
    if (details !== event.target) details.open = false;
  });
}, true);

/* =========================
   Transaction history (search, filters, sorting)
   ========================= */
function renderHistoryCategories() {
  const select = $("history-category");
  if (!select) return;

  const previous = select.value || "all";
  const categories = [...new Set(transactions.map((item) => item.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  select.innerHTML = `<option value="all">All categories</option>`
    + categories.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");

  select.value = categories.includes(previous) ? previous : "all";
}

function getFilteredHistory() {
  const search = ($("history-search")?.value || "").trim().toLowerCase();
  const type = $("history-type")?.value || "all";
  const category = $("history-category")?.value || "all";
  const from = $("history-from")?.value || "";
  const to = $("history-to")?.value || "";
  const sort = $("history-sort")?.value || "newest";

  const items = transactions.filter((item) => {
    if (type !== "all" && item.type !== type) return false;
    if (category !== "all" && item.category !== category) return false;
    if (from && item.date < from) return false;
    if (to && item.date > to) return false;
    if (search) {
      const text = `${item.description} ${item.category} ${item.notes}`.toLowerCase();
      if (!text.includes(search)) return false;
    }
    return true;
  });

  const sorters = {
    newest: (a, b) => b.date.localeCompare(a.date),
    oldest: (a, b) => a.date.localeCompare(b.date),
    highest: (a, b) => b.amount - a.amount,
    lowest: (a, b) => a.amount - b.amount
  };

  return [...items].reverse().sort(sorters[sort] || sorters.newest);
}

function renderHistory() {
  const list = $("history-list");
  if (!list) return;

  renderHistoryCategories();
  const items = getFilteredHistory();

  const count = $("history-count");
  if (count) count.textContent = `${items.length} transaction${items.length === 1 ? "" : "s"}`;

  list.innerHTML = items.length
    ? items.map((item) => transactionRowHtml(item, true)).join("")
    : `<li class="empty-state">No transactions match your filters.</li>`;
}

function clearHistoryFilters() {
  ["history-search", "history-from", "history-to"].forEach((id) => { if ($(id)) $(id).value = ""; });
  if ($("history-type")) $("history-type").value = "all";
  if ($("history-category")) $("history-category").value = "all";
  if ($("history-sort")) $("history-sort").value = "newest";
  renderHistory();
}

["history-search", "history-type", "history-category", "history-from", "history-to", "history-sort"].forEach((id) => {
  $(id)?.addEventListener("input", renderHistory);
  $(id)?.addEventListener("change", renderHistory);
});
$("history-clear")?.addEventListener("click", clearHistoryFilters);

/* =========================
   Rendering everything
   ========================= */
function renderDashboard() {
  renderPeriodControls();
  renderSummaryCards();
  renderBills();
  renderAllocations();
  renderRecentTransactions();
  renderSpendingByDate();
  renderHistory();
}

/* =========================
   Modals
   ========================= */
function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.querySelector("input:not([type='hidden']):not([type='checkbox']), select")?.focus();
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
}

function showFormError(id, message) {
  const element = $(id);
  if (element) element.textContent = message;
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".modal:not(.hidden)").forEach((modal) => modal.classList.add("hidden"));
});

document.querySelectorAll(".modal").forEach((modal) => {
  modal.addEventListener("mousedown", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
  });
});

/* =========================
   Transactions
   ========================= */
const transactionForm = $("transaction-form");
const field = (form, name) => form.elements.namedItem(name);

function openTransactionModal(id) {
  if (!transactionForm) return;

  const existing = id ? transactions.find((item) => item.id === id) : null;
  if (id && !existing) return;

  transactionForm.reset();
  $("transaction-id").value = existing ? existing.id : "";
  $("transaction-modal-title").textContent = existing ? "Edit transaction" : "Add transaction";
  $("transaction-submit-btn").textContent = existing ? "Save" : "Add";
  showFormError("transaction-form-error", "");

  if (existing) {
    field(transactionForm, "type").value = existing.type;
    field(transactionForm, "amount").value = existing.amount;
    field(transactionForm, "description").value = existing.description;
    field(transactionForm, "category").value = existing.category;
    field(transactionForm, "date").value = existing.date;
    field(transactionForm, "notes").value = existing.notes;
  } else {
    const range = getPeriodRange();
    const today = todayISO();
    field(transactionForm, "date").value = today >= range.start && today <= range.end ? today : range.start;
  }

  openModal("transaction-modal");
}

function deleteTransaction(id) {
  const item = transactions.find((entry) => entry.id === id);
  if (!item) return;

  const extra = item.billId ? " The bill will go back to unpaid." : "";
  if (!window.confirm(`Delete "${item.description}" (${formatMoney(item.amount)})?${extra}`)) return;

  transactions = transactions.filter((entry) => entry.id !== id);
  saveTransactions();
  renderDashboard();
}

$("add-transaction-btn")?.addEventListener("click", () => openTransactionModal());

transactionForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(transactionForm);
  const id = String(formData.get("id") || "").trim();
  const type = String(formData.get("type") || "").trim();
  const amount = Number(formData.get("amount"));
  const description = String(formData.get("description") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const date = String(formData.get("date") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  if (!["expense", "income"].includes(type) || !description || !category || !isValidDate(date) || !Number.isFinite(amount) || amount <= 0) {
    showFormError("transaction-form-error", "Please fill in every required field with a valid amount and date.");
    return;
  }

  showFormError("transaction-form-error", "");

  const existing = id ? transactions.find((item) => item.id === id) : null;
  const transactionData = { ...(existing || {}), id: id || uid(), type, amount, description, category, date, notes };

  if (existing) {
    transactions = transactions.map((item) => (item.id === id ? transactionData : item));
  } else {
    transactions.push(transactionData);
  }

  // Jump to the period that contains the transaction so you can always see it.
  const range = getPeriodRange();
  if (date < range.start || date > range.end) periodAnchor = date;

  saveTransactions();
  renderDashboard();
  closeModal("transaction-modal");
});

/* =========================
   Budget
   ========================= */
function openBudgetModal() {
  showFormError("budget-form-error", "");
  $("budget-input").value = monthlyBudget;
  openModal("budget-modal");
}

$("edit-budget-btn")?.addEventListener("click", openBudgetModal);

$("budget-form")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const value = $("budget-input").value.trim();
  const amount = Number(value);

  if (value === "" || !Number.isFinite(amount) || amount < 0) {
    showFormError("budget-form-error", "Please enter a budget of 0 or more.");
    return;
  }

  monthlyBudget = amount;
  saveBudget();
  renderDashboard();
  closeModal("budget-modal");
});

/* =========================
   Money planning (set-aside allocations)
   ========================= */
function resetAllocationForm() {
  $("allocation-form")?.reset();
  $("allocation-id").value = "";
  $("allocation-submit-btn").textContent = "Add";
  showFormError("allocation-form-error", "");
}

function openPlanModal() {
  resetAllocationForm();
  renderAllocations();
  openModal("plan-modal");
}

function editAllocation(id) {
  const item = allocations.find((entry) => entry.id === id);
  if (!item) return;

  $("allocation-id").value = item.id;
  $("planned-note").value = item.name;
  $("planned-amount").value = item.amount;
  $("allocation-submit-btn").textContent = "Update";
  showFormError("allocation-form-error", "");
  $("planned-amount").focus();
}

function deleteAllocation(id) {
  allocations = allocations.filter((entry) => entry.id !== id);
  saveAllocations();
  resetAllocationForm();
  renderDashboard();
}

$("plan-amount-btn")?.addEventListener("click", openPlanModal);

$("allocation-form")?.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = $("allocation-id").value;
  const name = $("planned-note").value.trim() || "Set aside";
  const amount = Number($("planned-amount").value);

  if (!Number.isFinite(amount) || amount <= 0) {
    showFormError("allocation-form-error", "Please enter an amount greater than 0.");
    return;
  }

  if (id && allocations.some((entry) => entry.id === id)) {
    allocations = allocations.map((entry) => (entry.id === id ? { ...entry, name, amount } : entry));
  } else {
    allocations.push({ id: uid(), name, amount });
  }

  saveAllocations();
  resetAllocationForm();
  renderDashboard();
});

/* =========================
   Bills form
   ========================= */
const billForm = $("bill-form");

function openBillModal(id) {
  if (!billForm) return;

  const existing = id ? bills.find((item) => item.id === id) : null;
  if (id && !existing) return;

  billForm.reset();
  field(billForm, "id").value = existing ? existing.id : "";
  $("bill-modal-title").textContent = existing ? "Edit bill" : "Add bill";
  $("bill-submit-btn").textContent = existing ? "Save" : "Add";
  showFormError("bill-form-error", "");

  if (existing) {
    field(billForm, "name").value = existing.name;
    field(billForm, "amount").value = existing.amount;
    field(billForm, "due").value = existing.due;
    field(billForm, "recurring").checked = existing.recurring;
  } else {
    field(billForm, "due").value = getPeriodRange().start;
  }

  openModal("bill-modal");
}

function deleteBill(id) {
  const bill = bills.find((item) => item.id === id);
  if (!bill) return;
  if (!window.confirm(`Delete the bill "${bill.name}"? Payments you already recorded will stay in your transactions.`)) return;

  bills = bills.filter((item) => item.id !== id);
  saveBills();
  renderDashboard();
}

$("add-bill-btn")?.addEventListener("click", () => openBillModal());

billForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  const id = String(field(billForm, "id").value || "");
  const name = field(billForm, "name").value.trim();
  const amount = Number(field(billForm, "amount").value);
  const due = field(billForm, "due").value;
  const recurring = field(billForm, "recurring").checked;

  if (!name || !Number.isFinite(amount) || amount <= 0 || !isValidDate(due)) {
    showFormError("bill-form-error", "Please enter a name, an amount greater than 0 and a due date.");
    return;
  }

  if (id && bills.some((item) => item.id === id)) {
    bills = bills.map((item) => (item.id === id ? { ...item, name, amount, due, recurring } : item));
  } else {
    bills.push({ id: uid(), name, amount, due, recurring });
  }

  const range = getPeriodRange();
  if (due < range.start || due > range.end) periodAnchor = due;

  saveBills();
  renderDashboard();
  closeModal("bill-modal");
});

/* =========================
   Clicks on buttons that are created by the page
   ========================= */
document.addEventListener("click", (event) => {
  const closeButton = event.target.closest("[data-close]");
  if (closeButton) {
    closeModal(closeButton.dataset.close);
    return;
  }

  const actions = [
    [".edit-transaction", (button) => openTransactionModal(button.dataset.id)],
    [".delete-transaction", (button) => deleteTransaction(button.dataset.id)],
    [".pay-bill", (button) => toggleBillPaid(button.dataset.billId, button.dataset.due)],
    [".edit-bill", (button) => openBillModal(button.dataset.billId)],
    [".delete-bill", (button) => deleteBill(button.dataset.billId)],
    [".edit-allocation", (button) => editAllocation(button.dataset.id)],
    [".delete-allocation", (button) => deleteAllocation(button.dataset.id)]
  ];

  for (const [selector, run] of actions) {
    const button = event.target.closest(selector);
    if (button) {
      run(button);
      return;
    }
  }
});

/* =========================
   Navigation and period controls
   ========================= */
let activeNav = "overview";

function showView(name) {
  const showHistory = name === "history";
  if ($("overview-view")) $("overview-view").hidden = showHistory;
  if ($("history-view")) $("history-view").hidden = !showHistory;
  window.scrollTo({ top: 0 });
}

function setActiveNav(key) {
  activeNav = key;
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.nav === activeNav);
  });
}

function handleNavigation(target, type) {
  if (target === "overview") {
    showView("overview");
    setActiveNav("overview");
  } else if (target === "transactions" || target === "earnings") {
    const filterType = target === "earnings" ? "income" : type || "all";
    if ($("history-type")) $("history-type").value = filterType;
    renderHistory();
    showView("history");
    setActiveNav(target);
  } else if (target === "insights") {
    showView("overview");
    setActiveNav("insights");
    $("spending-by-date")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } else if (target === "budget") {
    openBudgetModal();
  } else if (target === "saver") {
    openPlanModal();
  }
}

document.querySelectorAll("[data-nav]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    handleNavigation(link.dataset.nav, link.dataset.type);
  });
});

$("period-type")?.addEventListener("change", (event) => {
  periodType = event.target.value;
  periodAnchor = todayISO();
  saveJSON(PERIOD_KEY, periodType);
  renderDashboard();
});

$("period-prev")?.addEventListener("click", () => stepPeriod(-1));
$("period-next")?.addEventListener("click", () => stepPeriod(1));

/* =========================
   Themes
   ========================= */
function applyTheme(themeName) {
  document.body.classList.remove(...themeNames);
  document.body.classList.add(themeName);
  localStorage.setItem(THEME_KEY, themeName);

  document.querySelectorAll(".theme-option").forEach((button) => {
    button.classList.toggle("active", button.dataset.theme === themeName);
  });
}

$("theme-toggle-btn")?.addEventListener("click", () => openModal("theme-modal"));

document.querySelectorAll(".theme-option").forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.theme);
    closeModal("theme-modal");
  });
});

const savedTheme = localStorage.getItem(THEME_KEY);
applyTheme(themeNames.includes(savedTheme) ? savedTheme : "theme-botanical-light");

renderDashboard();
