const STORAGE_KEY = "money-dashboard-transactions";
const PLAN_STORAGE_KEY = "money-dashboard-plan";

let transactions = [];

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  transactions = Array.isArray(saved) ? saved : [];
} catch (error) {
  console.error("Could not load saved transactions:", error);
}

let plannedBudget = { amount: 0, note: "" };

try {
  const savedPlan = JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY));
  if (savedPlan && typeof savedPlan.amount === "number") {
    plannedBudget = savedPlan;
  }
} catch (error) {
  console.error("Could not load saved plan:", error);
}

const BUDGET = 1200;
// Unpaid bills reserve part of the remaining budget.
// When a bill is paid, mark it paid and record its expense transaction.
const plannedBills = [
  { name: "Rent", amount: 400, due: "20 Dec", paid: false },
  { name: "Phone", amount: 45, due: "24 Dec", paid: false },
  { name: "Internet", amount: 60, due: "25 Dec", paid: false }
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value);
}
function getTotals() {
  const spent = transactions
    .filter(item => item.type === "expense")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const income = transactions
    .filter(item => item.type === "income")
    .reduce((sum, item) => sum + Number(item.amount), 0);

  const remaining = BUDGET - spent;
  const plannedReserve = Number(plannedBudget.amount || 0);

  const billsAllocated = plannedBills
    .filter(bill => !bill.paid)
    .reduce((sum, bill) => sum + Number(bill.amount), 0);

  // Free to spend = remaining budget - set-aside amount - unpaid bills
  const flexibleSpending = Math.max(remaining - plannedReserve - billsAllocated, 0);

  return {
    budget: BUDGET,
    spent,
    remaining,
    income,
    plannedReserve,
    billsAllocated,
    flexibleSpending
  };
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
    const element = document.getElementById(id);
    if (element) {
      element.textContent = formatMoney(value);
    }
  });
}
function renderBills() {
  const list = document.getElementById("bill-list");
  if (!list) return;

  list.innerHTML = plannedBills
    .filter(bill => !bill.paid)
    .map(bill => `
      <li><span>${escapeHtml(bill.name)} <time>${escapeHtml(bill.due)}</time></span><strong>${formatMoney(bill.amount)}</strong></li>
    `).join("");
}
function renderRecentTransactions() {
  const list = document.getElementById("recent-transactions-list");

  if (!list) return;

  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  list.innerHTML = "";

  if (!recent.length) {
    list.innerHTML = `
      <li class="empty-state">
        No recent transactions yet.
      </li>
    `;
    return;
  }

  recent.forEach(item => {
    const li = document.createElement("li");

    li.innerHTML = `
      <div class="transaction-info">
        <span>${escapeHtml(item.description)}</span>
        <strong>${item.type === "expense" ? "-" : "+"}${formatMoney(item.amount)}</strong>
      </div>

      <div class="transaction-actions">
        <button type="button" class="mini-btn edit-transaction" data-id="${escapeHtml(item.id)}">Edit</button>
        <button type="button" class="mini-btn delete-transaction" data-id="${escapeHtml(item.id)}">Delete</button>
      </div>
    `;

    list.appendChild(li);
  });
}
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function savePlan() {
  localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plannedBudget));
}
function openEditTransactionModal(id) {
  const transaction = transactions.find(item => item.id === id);
  if (!transaction) return;

  const form = document.getElementById("transaction-form");
  if (!form) return;

  const idInput = document.getElementById("transaction-id");
  const typeInput = form.querySelector('[name="type"]');
  const amountInput = form.querySelector('[name="amount"]');
  const descriptionInput = form.querySelector('[name="description"]');
  const categoryInput = form.querySelector('[name="category"]');
  const dateInput = form.querySelector('[name="date"]');
  const notesInput = form.querySelector('[name="notes"]');

  if (idInput) idInput.value = transaction.id;
  if (typeInput) typeInput.value = transaction.type;
  if (amountInput) amountInput.value = transaction.amount;
  if (descriptionInput) descriptionInput.value = transaction.description;
  if (categoryInput) categoryInput.value = transaction.category;
  if (dateInput) dateInput.value = transaction.date;
  if (notesInput) notesInput.value = transaction.notes;

  document.getElementById("transaction-modal")?.classList.remove("hidden");
  document.getElementById("transaction-form-error")?.replaceChildren();
}
function deleteTransaction(id) {
  transactions = transactions.filter(item => item.id !== id);
  saveTransactions();
  renderDashboard();
}
function showTransactionFormError(message) {
  const errorEl = document.getElementById("transaction-form-error");
  if (!errorEl) return;
  errorEl.textContent = message;
}
function renderDashboard() {
  renderSummaryCards();
  renderBills();
  renderRecentTransactions();
  renderSpendingByDate();
}
if (!transactions.length) {
  transactions = [
    {
      id: crypto.randomUUID(),
      type: "income",
      amount: 1200,
      description: "Monthly pay",
      category: "Income",
      date: "2026-11-01",
      notes: ""
    },
    {
      id: crypto.randomUUID(),
      type: "expense",
      amount: 42,
      description: "Groceries",
      category: "Groceries",
      date: "2026-11-14",
      notes: ""
    },
    {
      id: crypto.randomUUID(),
      type: "expense",
      amount: 20,
      description: "Bus pass",
      category: "Transport",
      date: "2026-11-16",
      notes: ""
    },
    {
      id: crypto.randomUUID(),
      type: "expense",
      amount: 8,
      description: "Coffee",
      category: "Eating out",
      date: "2026-11-16",
      notes: ""
    }
  ];
  saveTransactions();
}
const addTransactionBtn = document.getElementById("add-transaction-btn");
const transactionModal = document.getElementById("transaction-modal");

if (addTransactionBtn && transactionModal) {
  addTransactionBtn.addEventListener("click", () => {
    const form = document.getElementById("transaction-form");
    if (form) {
      form.reset();
      const idInput = document.getElementById("transaction-id");
      if (idInput) idInput.value = "";
    }

    transactionModal.classList.remove("hidden");
  });
}
document.addEventListener("click", (event) => {
  const editButton = event.target.closest(".edit-transaction");
  if (editButton) {
    openEditTransactionModal(editButton.dataset.id);
    return;
  }

  const deleteButton = event.target.closest(".delete-transaction");
  if (deleteButton) {
    deleteTransaction(deleteButton.dataset.id);
  }
});
const transactionForm = document.getElementById("transaction-form");

if (transactionForm) {
  transactionForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(transactionForm);

    const id = String(formData.get("id") || "").trim();
    const type = String(formData.get("type") || "").trim();
    const amount = Number(formData.get("amount"));
    const description = String(formData.get("description") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const date = String(formData.get("date") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    if (!type || !description || !category || !date || !Number.isFinite(amount) || amount <= 0) {
      showTransactionFormError("Please fill in every required field with a valid amount and date.");
      return;
    }

    showTransactionFormError("");

    const transactionData = {
      id: id || crypto.randomUUID(),
      type,
      amount,
      description,
      category,
      date,
      notes
    };

    if (id) {
      transactions = transactions.map(item => item.id === id ? transactionData : item);
    } else {
      transactions.push(transactionData);
    }

    saveTransactions();
    renderDashboard();

    transactionForm.reset();

    const transactionIdInput = document.getElementById("transaction-id");
    if (transactionIdInput) transactionIdInput.value = "";

    transactionModal.classList.add("hidden");
  });
}
document.addEventListener("DOMContentLoaded", () => {
  renderDashboard();
});
function openModal(id) {
  document.getElementById(id)?.classList.remove("hidden");
}

function closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");
}

document.getElementById("plan-amount-btn")?.addEventListener("click", () => {
  const amountInput = document.getElementById("planned-amount");
  const noteInput = document.querySelector("#plan-modal input[type='text']");

  if (amountInput) amountInput.value = plannedBudget.amount || 0;
  if (noteInput) noteInput.value = plannedBudget.note || "";

  openModal("plan-modal");
});

document.querySelector(".save-plan-btn")?.addEventListener("click", () => {
  const amountInput = document.getElementById("planned-amount");
  const noteInput = document.querySelector("#plan-modal input[type='text']");

  const amount = Number(amountInput?.value || 0);
  const note = noteInput?.value || "";

  if (!Number.isFinite(amount) || amount < 0) return;

  plannedBudget = { amount, note };

  savePlan();
  renderDashboard();
  closeModal("plan-modal");
});
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.dataset.close);
  });
});

document.getElementById("theme-toggle-btn")?.addEventListener("click", () => {
  openModal("theme-modal");
});
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

const savedTheme = localStorage.getItem("money-dashboard-theme") || "theme-botanical-light";

function applyTheme(themeName) {
  document.body.classList.remove(...themeNames);
  document.body.classList.add(themeName);
  localStorage.setItem("money-dashboard-theme", themeName);

  document.querySelectorAll(".theme-option").forEach((button) => {
    const isActive = button.dataset.theme === themeName;
    button.classList.toggle("active", isActive);
  });
}

document.querySelectorAll(".theme-option").forEach((button) => {
  button.addEventListener("click", () => {
    applyTheme(button.dataset.theme);
    closeModal("theme-modal");
  });
});

applyTheme(savedTheme);
function groupExpensesByDate() {
  const grouped = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, item) => {
      const key = item.date;
      if (!acc[key]) acc[key] = 0;
      acc[key] += Number(item.amount);
      return acc;
    }, {});

  return Object.entries(grouped)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 3);
}

function renderSpendingByDate() {
  const container = document.getElementById("spending-by-date");
  if (!container) return;

  const groups = groupExpensesByDate();

  if (!groups.length) {
    container.innerHTML = `
      <div class="empty-state">
        No spending yet. Add a transaction to see your daily totals.
      </div>
    `;
    return;
  }

  container.innerHTML = groups.map(([date, total], index) => `
    <details ${index === 0 ? "open" : ""}>
      <summary>
        <span>${new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        <strong>${formatMoney(total)}</strong>
      </summary>
      <ul class="mini-list">
        ${transactions
          .filter(t => t.type === "expense" && t.date === date)
          .map(t => `
            <li>${escapeHtml(t.description)} <span>${formatMoney(t.amount)}</span></li>
          `).join("")}
      </ul>
    </details>
  `).join("");
}
