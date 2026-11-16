const STORAGE_KEY = "money-dashboard-transactions";
let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

const BUDGET = 1200;

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

  return { budget: BUDGET, spent, remaining, income };
  }
function renderSummaryCards() {
  const totals = getTotals();

  const budgetEl = document.getElementById("budget-total");
  const spentEl = document.getElementById("spent-total");
  const remainingEl = document.getElementById("remaining-total");

  if (budgetEl) budgetEl.textContent = formatMoney(totals.budget);
  if (spentEl) spentEl.textContent = formatMoney(totals.spent);
  if (remainingEl) remainingEl.textContent = formatMoney(totals.remaining);
}
function renderRecentTransactions() {
  const list = document.getElementById("recent-transactions-list");

  if (!list) return;

  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 4);

  list.innerHTML = "";

  recent.forEach(item => {
    const li = document.createElement("li");

    li.innerHTML = `
      <span>${item.description}</span>
      <strong>${item.type === "expense" ? "-" : "+"}${formatMoney(item.amount)}</strong>
    `;

    list.appendChild(li);
  });
}
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}
function renderDashboard() {
  renderSummaryCards();
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
    transactionModal.classList.remove("hidden");
  });
}

document.querySelectorAll("[data-close='transaction-modal']").forEach(button => {
  button.addEventListener("click", () => {
    transactionModal.classList.add("hidden");
  });
});
const transactionForm = document.getElementById("transaction-form");

if (transactionForm) {
  transactionForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(transactionForm);

    const newTransaction = {
      id: crypto.randomUUID(),
      type: formData.get("type"),
      amount: Number(formData.get("amount")),
      description: formData.get("description"),
      category: formData.get("category"),
      date: formData.get("date"),
      notes: formData.get("notes") || ""
    };

    transactions.push(newTransaction);
    saveTransactions();
    renderDashboard();

    transactionForm.reset();
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
  openModal("plan-modal");
});

document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => {
    closeModal(button.dataset.close);
  });
});

const themeToggleButton = document.getElementById("theme-toggle-btn");
if (themeToggleButton) {
  themeToggleButton.addEventListener("click", () => {
    openModal("theme-modal");
  });
}

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

  container.innerHTML = groups.map(([date, total]) => `
    <details open>
      <summary>
        <span>${new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
        <strong>${formatMoney(total)}</strong>
      </summary>
      <ul class="mini-list">
        ${transactions
          .filter(t => t.type === "expense" && t.date === date)
          .map(t => `
            <li>${t.description} <span>${formatMoney(t.amount)}</span></li>
          `).join("")}
      </ul>
    </details>
  `).join("");
}
