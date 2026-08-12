const STORAGE_KEY = "searchPalette.history.v1";
const STATION_KEY = "searchPalette.homeStation.v1";

const services = {
  google: { label: "Google", buildUrl: (q) => `./google-search.html?q=${encodeURIComponent(q)}` },
  maps: { label: "Googleマップ", buildUrl: (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` },
  youtube: { label: "YouTube", buildUrl: (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}` },
  rakuten: { label: "楽天レシピ", buildUrl: (q) => `https://recipe.rakuten.co.jp/search/${encodeURIComponent(q)}/` },
  appstore: { label: "App Store", buildUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(`${q} site:apps.apple.com/jp/app`)}` },
  amazon: { label: "Amazon", buildUrl: (q) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}` },
  yahooTransit: {
    label: "Yahoo!乗換案内",
    buildUrl: (q) => `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(state.homeStation)}&to=${encodeURIComponent(q)}&type=1&ticket=ic&al=1&shin=1&ex=1&hb=1&lb=1&sr=1`,
  },
  currentRoute: {
    label: "現在地からの経路",
    buildUrl: (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}&travelmode=transit`,
  },
};

const state = { selectedService: "google", history: loadHistory(), homeStation: localStorage.getItem(STATION_KEY) || "" };
const input = document.querySelector("#searchInput");
const form = document.querySelector("#searchForm");
const historyList = document.querySelector("#historyList");
const selectedServiceText = document.querySelector("#selectedService");
const helpDialog = document.querySelector("#helpDialog");
const stationDialog = document.querySelector("#stationDialog");
const stationForm = document.querySelector("#stationForm");
const stationInput = document.querySelector("#stationInput");
const toast = document.querySelector("#toast");
let toastTimer;

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.query === "string").slice(0, 100) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history.slice(0, 100)));
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function renderHistory() {
  historyList.replaceChildren();

  if (!state.history.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<strong>検索履歴はまだありません</strong><p>検索すると、ここからすぐに再利用できます。</p>";
    historyList.append(empty);
    return;
  }

  const sorted = [...state.history].sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt);
  sorted.forEach((item) => {
    const row = document.createElement("article");
    row.className = `history-item${item.favorite ? " is-favorite" : ""}`;

    const remove = document.createElement("button");
    remove.className = "row-button";
    remove.type = "button";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `「${item.query}」を履歴から削除`);
    remove.addEventListener("click", () => removeHistory(item.id));

    const query = document.createElement("button");
    query.className = "history-query";
    query.type = "button";
    query.innerHTML = `<span class="query-text"></span><span class="query-meta"></span>`;
    query.querySelector(".query-text").textContent = item.query;
    query.querySelector(".query-meta").textContent = `${services[item.service]?.label || "Google"}・${formatDate(item.updatedAt)}`;
    query.addEventListener("click", () => useHistory(item));

    const favorite = document.createElement("button");
    favorite.className = `row-button favorite-button${item.favorite ? " is-active" : ""}`;
    favorite.type = "button";
    favorite.textContent = item.favorite ? "★" : "☆";
    favorite.setAttribute("aria-label", item.favorite ? "お気に入りから解除" : "お気に入りに登録");
    favorite.addEventListener("click", () => toggleFavorite(item.id));

    const search = document.createElement("button");
    search.className = "row-button";
    search.type = "button";
    search.textContent = "⌕";
    search.setAttribute("aria-label", `「${item.query}」をもう一度検索`);
    search.addEventListener("click", () => executeSearch(item.query, item.service));

    row.append(remove, query, favorite, search);
    historyList.append(row);
  });
}

function selectService(key, shouldFocus = true) {
  if (!services[key]) return;
  if (key === "yahooTransit" && !state.homeStation) {
    openStationDialog(true);
    return;
  }
  state.selectedService = key;
  document.querySelectorAll("[data-service]").forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.service === key);
    button.setAttribute("aria-pressed", String(button.dataset.service === key));
  });
  selectedServiceText.textContent = "検索ボタンを押すとGoogleで検索します";
  if (shouldFocus) input.focus({ preventScroll: true });
}

function recordHistory(query, service) {
  const normalized = query.trim();
  const existing = state.history.find((item) => item.query.toLocaleLowerCase("ja") === normalized.toLocaleLowerCase("ja"));
  if (existing) {
    existing.service = service;
    existing.updatedAt = Date.now();
  } else {
    state.history.unshift({ id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, query: normalized, service, favorite: false, updatedAt: Date.now() });
  }
  saveHistory();
  renderHistory();
}

function executeSearch(rawQuery, service = state.selectedService) {
  const query = rawQuery.trim();
  if (!query) {
    showToast("検索ワードを入力してください");
    input.focus();
    return;
  }
  if (service === "yahooTransit" && !state.homeStation) {
    openStationDialog(true);
    return;
  }
  recordHistory(query, service);
  window.open(services[service].buildUrl(query), "_blank", "noopener,noreferrer");
}

function useHistory(item) {
  input.value = item.query;
  selectService(item.service);
  input.setSelectionRange(input.value.length, input.value.length);
}

function toggleFavorite(id) {
  const item = state.history.find((entry) => entry.id === id);
  if (!item) return;
  item.favorite = !item.favorite;
  saveHistory();
  renderHistory();
  showToast(item.favorite ? "お気に入りに登録しました" : "お気に入りを解除しました");
}

function removeHistory(id) {
  state.history = state.history.filter((item) => item.id !== id);
  saveHistory();
  renderHistory();
}

async function pasteFromClipboard() {
  try {
    const text = await navigator.clipboard.readText();
    if (!text.trim()) {
      showToast("クリップボードは空です");
      return;
    }
    input.value = text.trim();
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
    showToast("貼り付けました");
  } catch {
    input.focus();
    showToast("入力欄を長押しして貼り付けてください");
  }
}

function openStationDialog(selectYahooAfterSave = false, pendingQuery = "") {
  stationDialog.dataset.selectYahooAfterSave = String(selectYahooAfterSave);
  stationDialog.dataset.pendingQuery = pendingQuery;
  stationInput.value = state.homeStation;
  stationDialog.showModal();
  setTimeout(() => stationInput.focus(), 80);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  executeSearch(input.value, "google");
});

document.querySelector("#serviceStrip").addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.dataset.action === "paste") pasteFromClipboard();
  if (button.dataset.service) {
    const service = button.dataset.service;
    if (service === "yahooTransit" && !state.homeStation) {
      const query = input.value.trim();
      if (!query) {
        showToast("到着駅を入力してください");
        input.focus();
        return;
      }
      openStationDialog(true, query);
      return;
    }
    selectService(service, false);
    executeSearch(input.value, service);
  }
});

document.querySelector("#clearButton").addEventListener("click", () => {
  if (!state.history.some((item) => !item.favorite)) return showToast("削除する履歴はありません");
  if (window.confirm("お気に入りを除く検索履歴をすべて削除しますか？")) {
    state.history = state.history.filter((item) => item.favorite);
    saveHistory();
    renderHistory();
    showToast("お気に入り以外の検索履歴を削除しました");
  }
});

document.querySelector("#helpButton").addEventListener("click", () => helpDialog.showModal());
document.querySelector("#settingsButton").addEventListener("click", () => openStationDialog(false));
document.querySelector("#closeHelpButton").addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => { if (event.target === helpDialog) helpDialog.close(); });
document.querySelector("#cancelStationButton").addEventListener("click", () => stationDialog.close());
stationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const station = stationInput.value.trim().replace(/駅$/, "");
  if (!station) return;
  state.homeStation = station;
  localStorage.setItem(STATION_KEY, station);
  stationDialog.close();
  showToast(`普段使う駅を「${station}駅」に設定しました`);
  const pendingQuery = stationDialog.dataset.pendingQuery || "";
  stationDialog.dataset.pendingQuery = "";
  if (pendingQuery) {
    selectService("yahooTransit", false);
    executeSearch(pendingQuery, "yahooTransit");
  } else if (stationDialog.dataset.selectYahooAfterSave === "true" || state.selectedService === "yahooTransit") {
    selectService("yahooTransit");
  }
});

window.addEventListener("pageshow", () => setTimeout(() => input.focus({ preventScroll: true }), 120));
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));

selectService("google", false);
renderHistory();
