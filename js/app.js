const STORAGE_KEYS = {
  transactions: "expenseVisualizer.transactions",
  categories: "expenseVisualizer.categories",
  theme: "expenseVisualizer.theme"
};

const DEFAULT_CATEGORIES = ["Food", "Transport", "Fun"];
const ICONS = {
  moon: '<path d="M20.9 13A8.5 8.5 0 0 1 11 3.1 8.5 8.5 0 1 0 20.9 13Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};
let transactions = loadTransactions();
let categories = loadCategories();
let currentSort = "newest";
let expenseChart = null;
let toastTimer = null;

const elements = {
  form: document.getElementById("expenseForm"),
  itemName: document.getElementById("itemName"),
  amount: document.getElementById("amount"),
  category: document.getElementById("category"),
  totalBalance: document.getElementById("totalBalance"),
  transactionCount: document.getElementById("transactionCount"),
  transactionList: document.getElementById("transactionList"),
  emptyState: document.getElementById("emptyState"),
  chart: document.getElementById("expenseChart"),
  emptyChartState: document.getElementById("emptyChartState"),
  chartLegend: document.getElementById("chartLegend"),
  chartTotalBadge: document.getElementById("chartTotalBadge"),
  sortSelect: document.getElementById("sortSelect"),
  clearAllButton: document.getElementById("clearAllButton"),
  themeToggle: document.getElementById("themeToggle"),
  categoryManager: document.getElementById("categoryManager"),
  showCategoryManager: document.getElementById("showCategoryManager"),
  closeCategoryManager: document.getElementById("closeCategoryManager"),
  categoryForm: document.getElementById("categoryForm"),
  customCategory: document.getElementById("customCategory"),
  categoryList: document.getElementById("categoryList"),
  categoryManagerMessage: document.getElementById("categoryManagerMessage"),
  toast: document.getElementById("toast")
};

function loadTransactions() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.transactions));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function loadCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.categories));
    return Array.isArray(saved) && saved.length ? saved : [...DEFAULT_CATEGORIES];
  } catch {
    return [...DEFAULT_CATEGORIES];
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(transactions));
  localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(categories));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function iconSvg(name, className = "") {
  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.tag}</svg>`;
}

function getCategoryIcon(category) {
  return iconSvg("tag", "category-mark");
}

function populateCategories() {
  elements.category.innerHTML = categories
    .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
}

function validateForm() {
  clearErrors();
  let valid = true;

  if (!elements.itemName.value.trim()) {
    setError("itemNameError", "Item name is required.");
    valid = false;
  }

  const amount = Number(elements.amount.value);
  if (!elements.amount.value || !Number.isFinite(amount) || amount <= 0) {
    setError("amountError", "Enter an amount greater than 0.");
    valid = false;
  }

  if (!elements.category.value) {
    setError("categoryError", "Please choose a category.");
    valid = false;
  }

  return valid;
}

function clearErrors() {
  ["itemNameError", "amountError", "categoryError"].forEach(id => {
    document.getElementById(id).textContent = "";
  });
}

function setError(id, message) {
  document.getElementById(id).textContent = message;
}

function addTransaction(event) {
  event.preventDefault();
  if (!validateForm()) return;

  const transaction = {
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    itemName: elements.itemName.value.trim(),
    amount: Number(elements.amount.value),
    category: elements.category.value,
    createdAt: Date.now()
  };

  transactions.push(transaction);
  saveData();
  elements.form.reset();
  clearErrors();
  renderAll();
  showToast("Transaction added.");
  elements.itemName.focus();
}

function removeTransaction(id) {
  const target = transactions.find(item => item.id === id);
  if (!target) return;

  transactions = transactions.filter(item => item.id !== id);
  saveData();
  renderAll();
  showToast(`${target.itemName} deleted.`);
}

function clearAllTransactions() {
  if (!transactions.length) {
    showToast("There are no transactions to clear.");
    return;
  }

  const confirmed = window.confirm("Delete all transactions? This cannot be undone.");
  if (!confirmed) return;

  transactions = [];
  saveData();
  renderAll();
  showToast("All transactions deleted.");
}

function getSortedTransactions() {
  const copy = [...transactions];

  switch (currentSort) {
    case "oldest":
      return copy.sort((a, b) => a.createdAt - b.createdAt);
    case "amount-high":
      return copy.sort((a, b) => b.amount - a.amount);
    case "amount-low":
      return copy.sort((a, b) => a.amount - b.amount);
    case "category":
      return copy.sort((a, b) => a.category.localeCompare(b.category) || b.createdAt - a.createdAt);
    default:
      return copy.sort((a, b) => b.createdAt - a.createdAt);
  }
}

function renderTransactions() {
  const items = getSortedTransactions();
  const isEmpty = items.length === 0;

  elements.transactionList.innerHTML = items.map(transaction => `
    <article class="transaction-item">
      <div class="transaction-main">
        <div class="category-icon" aria-hidden="true">${getCategoryIcon(transaction.category)}</div>
        <div class="transaction-info">
          <p class="transaction-name" title="${escapeHtml(transaction.itemName)}">${escapeHtml(transaction.itemName)}</p>
          <p class="transaction-meta">${escapeHtml(transaction.category)} · ${formatDate(transaction.createdAt)}</p>
        </div>
      </div>
      <div class="transaction-side">
        <p class="transaction-amount">${formatCurrency(transaction.amount)}</p>
        <button class="delete-button" type="button" data-delete-id="${escapeHtml(transaction.id)}" aria-label="Delete ${escapeHtml(transaction.itemName)}">${iconSvg("close")}</button>
      </div>
    </article>
  `).join("");

  elements.emptyState.style.display = isEmpty ? "block" : "none";
  elements.clearAllButton.disabled = isEmpty;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(timestamp));
}

function renderBalance() {
  const total = transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  elements.totalBalance.textContent = formatCurrency(total);
  elements.chartTotalBadge.textContent = formatCurrency(total);
  elements.transactionCount.textContent = `${transactions.length} transaction${transactions.length === 1 ? "" : "s"}`;
}

function getCategoryTotals() {
  return categories.map(category => ({
    category,
    total: transactions
      .filter(transaction => transaction.category === category)
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0)
  })).filter(item => item.total > 0);
}

function getCategoryColor(category) {
  const index = categories.indexOf(category);
  const hue = (index * 360) / categories.length;
  return `hsl(${hue} 68% 52%)`;
}

function renderChart() {
  const categoryTotals = getCategoryTotals();
  const hasData = categoryTotals.length > 0;
  elements.emptyChartState.style.display = hasData ? "none" : "block";
  elements.chart.style.display = hasData ? "block" : "none";

  if (expenseChart) expenseChart.destroy();
  elements.chartLegend.innerHTML = "";

  if (!hasData) return;

  expenseChart = new Chart(elements.chart, {
    type: "pie",
    data: {
      labels: categoryTotals.map(item => item.category),
      datasets: [{
        data: categoryTotals.map(item => item.total),
        backgroundColor: categoryTotals.map(item => getCategoryColor(item.category)),
        borderWidth: 3,
        borderColor: getComputedStyle(document.body).getPropertyValue("--surface").trim() || "#ffffff"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(context) {
              return ` ${formatCurrency(context.raw)}`;
            }
          }
        }
      }
    }
  });

  categoryTotals.forEach(item => {
    const color = getCategoryColor(item.category);
    const legendItem = document.createElement("div");
    legendItem.className = "legend-item";
    legendItem.innerHTML = `<span class="legend-dot" style="background:${color}"></span><span>${escapeHtml(item.category)}: ${formatCurrency(item.total)}</span>`;
    elements.chartLegend.appendChild(legendItem);
  });
}

function renderCategoryManager() {
  elements.categoryList.innerHTML = categories.map(category => {
    const canRemove = !DEFAULT_CATEGORIES.includes(category);
    const used = transactions.some(transaction => transaction.category === category);
    return `
      <div class="category-chip">
        <span class="category-name">${getCategoryIcon(category)}${escapeHtml(category)}</span>
        ${canRemove ? `<button class="remove-category" type="button" data-remove-category="${escapeHtml(category)}" aria-label="Remove ${escapeHtml(category)}" ${used ? "disabled title=\"Category is in use\"" : ""}>${iconSvg("close")}</button>` : `<span class="default-category-icon" title="Default category">${iconSvg("lock")}</span>`}
      </div>
    `;
  }).join("");
}

function addCategory(event) {
  event.preventDefault();
  const name = elements.customCategory.value.trim();
  elements.categoryManagerMessage.textContent = "";

  if (!name) {
    elements.categoryManagerMessage.textContent = "Enter a category name.";
    return;
  }

  if (name.length < 2) {
    elements.categoryManagerMessage.textContent = "Category must contain at least 2 characters.";
    return;
  }

  const alreadyExists = categories.some(category => category.toLowerCase() === name.toLowerCase());
  if (alreadyExists) {
    elements.categoryManagerMessage.textContent = "That category already exists.";
    return;
  }

  categories.push(name);
  saveData();
  elements.customCategory.value = "";
  populateCategories();
  elements.category.value = name;
  renderCategoryManager();
  renderChart();
  showToast("Category added.");
}

function removeCategory(category) {
  if (DEFAULT_CATEGORIES.includes(category)) {
    showToast("Default categories cannot be removed.");
    return;
  }

  const isUsed = transactions.some(transaction => transaction.category === category);
  if (isUsed) {
    showToast("Remove or recategorize its transactions first.");
    return;
  }

  categories = categories.filter(item => item !== category);
  saveData();
  populateCategories();
  renderCategoryManager();
  renderChart();
  showToast("Category removed.");
}

function toggleCategoryManager() {
  elements.categoryManager.classList.toggle("hidden");
  if (!elements.categoryManager.classList.contains("hidden")) {
    elements.categoryManager.scrollIntoView({ behavior: "smooth", block: "start" });
    elements.customCategory.focus();
  }
}

function loadTheme() {
  const saved = localStorage.getItem(STORAGE_KEYS.theme);
  const shouldUseDark = saved === "dark";
  document.body.classList.toggle("dark", shouldUseDark);
  elements.themeToggle.innerHTML = iconSvg(shouldUseDark ? "sun" : "moon");
}

function toggleTheme() {
  const dark = document.body.classList.toggle("dark");
  localStorage.setItem(STORAGE_KEYS.theme, dark ? "dark" : "light");
  elements.themeToggle.innerHTML = iconSvg(dark ? "sun" : "moon");
  if (transactions.length) renderChart();
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function renderAll() {
  populateCategories();
  renderBalance();
  renderTransactions();
  renderChart();
  renderCategoryManager();
}

elements.form.addEventListener("submit", addTransaction);
elements.sortSelect.addEventListener("change", event => {
  currentSort = event.target.value;
  renderTransactions();
});
elements.clearAllButton.addEventListener("click", clearAllTransactions);
elements.themeToggle.addEventListener("click", toggleTheme);
elements.showCategoryManager.addEventListener("click", toggleCategoryManager);
elements.closeCategoryManager.addEventListener("click", () => elements.categoryManager.classList.add("hidden"));
elements.categoryForm.addEventListener("submit", addCategory);

elements.transactionList.addEventListener("click", event => {
  const button = event.target.closest("[data-delete-id]");
  if (button) removeTransaction(button.dataset.deleteId);
});

elements.categoryList.addEventListener("click", event => {
  const button = event.target.closest("[data-remove-category]");
  if (button) removeCategory(button.dataset.removeCategory);
});

document.querySelectorAll("[data-icon]").forEach(element => {
  element.innerHTML = iconSvg(element.dataset.icon);
});

loadTheme();
renderAll();
