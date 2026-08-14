const STORAGE_KEY = "searchPalette.history.v1";
const STATION_KEY = "searchPalette.homeStation.v1";
const ORDER_KEY = "searchPalette.serviceOrder.v4";
const ENABLED_KEY = "searchPalette.enabledServices.v1";
const DEFAULT_SERVICE_ORDER = ["google", "aiMode", "googleNews", "maps", "yahooTransit", "wordAi", "googleTranslate", "wikipedia", "amazon", "kakaku"];

const services = {
  google: { label: "Google", buildUrl: (q) => `./google-search.html?q=${encodeURIComponent(q)}` },
  aiMode: { label: "AIモード", buildUrl: (q) => `./ai-search.html?q=${encodeURIComponent(q)}` },
  googleNews: { label: "Googleニュース", buildUrl: (q) => `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=ja&gl=JP&ceid=JP%3Aja` },
  wikipedia: { label: "Wikipedia", buildUrl: (q) => `https://ja.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}` },
  googleTranslate: {
    label: "Google翻訳",
    buildUrl: (q) => {
      const target = /[ぁ-んァ-ヶ一-龠々]/u.test(q) ? "en" : "ja";
      return `https://translate.google.com/?sl=auto&tl=${target}&text=${encodeURIComponent(q)}&op=translate`;
    },
  },
  wordAi: {
    label: "単語検索",
    buildUrl: (q) => `./ai-search.html?q=${encodeURIComponent(`「${q}」の意味、品詞、英訳または和訳、発音、例文、類義語を簡潔に説明して`)}`,
  },
  maps: { label: "Googleマップ", buildUrl: (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` },
  amazon: { label: "Amazon", buildUrl: (q) => `https://www.amazon.co.jp/s?k=${encodeURIComponent(q)}` },
  kakaku: { label: "価格.com", buildUrl: (q) => `https://search.kakaku.com/${encodeURIComponent(q)}/` },
  yahooTransit: {
    label: "Yahoo!乗換案内",
    buildUrl: (q) => `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(state.homeStation)}&to=${encodeURIComponent(q)}&type=1&ticket=ic&al=1&shin=1&ex=1&hb=1&lb=1&sr=1`,
  },
};

const state = {
  selectedService: "google",
  history: loadHistory(),
  homeStation: localStorage.getItem(STATION_KEY) || "",
  serviceOrder: loadServiceOrder(),
  enabledServices: loadEnabledServices(),
};
const input = document.querySelector("#searchInput");
const inputClearButton = document.querySelector("#inputClearButton");
const form = document.querySelector("#searchForm");
const historyList = document.querySelector("#historyList");
const favoritesList = document.querySelector("#favoritesList");
const selectedServiceText = document.querySelector("#selectedService");
const helpDialog = document.querySelector("#helpDialog");
const stationDialog = document.querySelector("#stationDialog");
const stationForm = document.querySelector("#stationForm");
const stationInput = document.querySelector("#stationInput");
const serviceStrip = document.querySelector("#serviceStrip");
const orderList = document.querySelector("#orderList");
const toast = document.querySelector("#toast");
let toastTimer;

function loadHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed)
      ? parsed.filter((item) => item && typeof item.query === "string")
        .map((item) => {
          if (item.service === "nearby" || item.service === "tabelog" || item.service === "gnavi") return { ...item, service: "google" };
          if (item.service === "deepl" || item.service === "weblio") return { ...item, service: "google" };
          if (item.service === "youtube" || item.service === "rakuten" || item.service === "appstore") return { ...item, service: "google" };
          return item;
        })
        .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.history.slice(0, 100)));
}

function loadServiceOrder() {
  try {
    let saved = JSON.parse(localStorage.getItem(ORDER_KEY) || "[]");
    if (Array.isArray(saved) && saved.includes("currentRoute")) {
      saved = saved.filter((key) => key !== "currentRoute" && key !== "aiMode");
      const googleIndex = saved.indexOf("google");
      saved.splice(googleIndex >= 0 ? googleIndex + 1 : 0, 0, "aiMode");
      localStorage.setItem(ORDER_KEY, JSON.stringify(saved));
    }
    if (Array.isArray(saved)) {
      saved = saved
        .filter((key) => services[key] && key !== "youtube" && key !== "rakuten" && key !== "appstore" && key !== "nearby" && key !== "tabelog" && key !== "gnavi" && key !== "deepl" && key !== "weblio");
      DEFAULT_SERVICE_ORDER.forEach((key) => {
        if (!saved.includes(key)) {
          saved.push(key);
        }
      });
      if (saved.length === DEFAULT_SERVICE_ORDER.length) {
        localStorage.setItem(ORDER_KEY, JSON.stringify(saved));
        return saved;
      }
    }
  } catch {}
  return [...DEFAULT_SERVICE_ORDER];
}

function loadEnabledServices() {
  try {
    const saved = JSON.parse(localStorage.getItem(ENABLED_KEY) || "null");
    if (Array.isArray(saved)) return DEFAULT_SERVICE_ORDER.filter((key) => saved.includes(key));
  } catch {}
  return [...DEFAULT_SERVICE_ORDER];
}

function applyServiceOrder() {
  state.serviceOrder.forEach((key) => {
    const button = serviceStrip.querySelector(`[data-service="${key}"]`);
    if (button) {
      button.hidden = !state.enabledServices.includes(key);
      serviceStrip.append(button);
    }
  });
}

function renderOrderSettings() {
  orderList.replaceChildren();
  state.serviceOrder.forEach((key, index) => {
    const row = document.createElement("div");
    row.className = "order-item";
    const label = document.createElement("span");
    label.textContent = services[key].label;
    const visibility = document.createElement("button");
    visibility.className = "visibility-button";
    visibility.type = "button";
    const isVisible = state.enabledServices.includes(key);
    visibility.textContent = isVisible ? "表示" : "非表示";
    visibility.classList.toggle("is-off", !isVisible);
    visibility.setAttribute("aria-pressed", String(isVisible));
    visibility.setAttribute("aria-label", `${services[key].label}を${isVisible ? "非表示" : "表示"}にする`);
    visibility.addEventListener("click", () => toggleServiceVisibility(key));
    const up = document.createElement("button");
    up.className = "order-button";
    up.type = "button";
    up.textContent = "↑";
    up.disabled = index === 0;
    up.setAttribute("aria-label", `${services[key].label}を上へ移動`);
    up.addEventListener("click", () => moveService(index, -1));
    const down = document.createElement("button");
    down.className = "order-button";
    down.type = "button";
    down.textContent = "↓";
    down.disabled = index === state.serviceOrder.length - 1;
    down.setAttribute("aria-label", `${services[key].label}を下へ移動`);
    down.addEventListener("click", () => moveService(index, 1));
    row.append(label, visibility, up, down);
    orderList.append(row);
  });
}

function toggleServiceVisibility(key) {
  if (state.enabledServices.includes(key)) {
    state.enabledServices = state.enabledServices.filter((service) => service !== key);
  } else {
    state.enabledServices.push(key);
  }
  localStorage.setItem(ENABLED_KEY, JSON.stringify(state.enabledServices));
  applyServiceOrder();
  renderOrderSettings();
}

function moveService(index, direction) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= state.serviceOrder.length) return;
  [state.serviceOrder[index], state.serviceOrder[nextIndex]] = [state.serviceOrder[nextIndex], state.serviceOrder[index]];
  localStorage.setItem(ORDER_KEY, JSON.stringify(state.serviceOrder));
  applyServiceOrder();
  renderOrderSettings();
}

function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("is-visible");
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

function updateInputClearButton() {
  inputClearButton.hidden = input.value.length === 0;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function renderHistory() {
  historyList.replaceChildren();
  favoritesList.replaceChildren();

  const historyItems = state.history.filter((item) => !item.favorite).sort((a, b) => b.updatedAt - a.updatedAt);
  const favoriteItems = state.history.filter((item) => item.favorite).sort((a, b) => b.updatedAt - a.updatedAt);
  renderHistoryGroup(historyList, historyItems, false);
  renderHistoryGroup(favoritesList, favoriteItems, true);
}

function renderHistoryGroup(container, items, favorites) {
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = favorites
      ? "<strong>お気に入りはまだありません</strong><p>検索履歴の星を押すと、こちらに移動します。</p>"
      : "<strong>検索履歴はまだありません</strong><p>検索すると、ここからすぐに再利用できます。</p>";
    container.append(empty);
    return;
  }

  items.forEach((item) => {
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
    container.append(row);
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
    button.classList.remove("is-selected");
    button.removeAttribute("aria-pressed");
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
  const current = input.value;
  const separator = current && !current.endsWith(" ") ? " " : "";
  input.value = `${current}${separator}${item.query.trim()} `;
  updateInputClearButton();
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

function openStationDialog(selectYahooAfterSave = false, pendingQuery = "") {
  stationDialog.dataset.selectYahooAfterSave = String(selectYahooAfterSave);
  stationDialog.dataset.pendingQuery = pendingQuery;
  stationInput.value = state.homeStation;
  renderOrderSettings();
  stationDialog.showModal();
  setTimeout(() => stationInput.focus(), 80);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  executeSearch(input.value, "google");
});

input.addEventListener("input", updateInputClearButton);
inputClearButton.addEventListener("click", () => {
  input.value = "";
  updateInputClearButton();
  input.focus({ preventScroll: true });
});

serviceStrip.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
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
document.querySelector("#resetOrderButton").addEventListener("click", () => {
  state.serviceOrder = [...DEFAULT_SERVICE_ORDER];
  localStorage.setItem(ORDER_KEY, JSON.stringify(state.serviceOrder));
  applyServiceOrder();
  renderOrderSettings();
  showToast("ボタンを初期順に戻しました");
});
document.querySelector("#closeHelpButton").addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => { if (event.target === helpDialog) helpDialog.close(); });
document.querySelector("#cancelStationButton").addEventListener("click", () => stationDialog.close());
stationForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const station = stationInput.value.trim().replace(/駅$/, "");
  const pendingQuery = stationDialog.dataset.pendingQuery || "";
  if (!station && pendingQuery) {
    showToast("出発駅を入力してください");
    stationInput.focus();
    return;
  }
  if (station) {
    state.homeStation = station;
    localStorage.setItem(STATION_KEY, station);
  }
  stationDialog.close();
  if (station) showToast(`普段使う駅を「${station}駅」に設定しました`);
  stationDialog.dataset.pendingQuery = "";
  if (pendingQuery) {
    selectService("yahooTransit", false);
    executeSearch(pendingQuery, "yahooTransit");
  } else if (stationDialog.dataset.selectYahooAfterSave === "true" || state.selectedService === "yahooTransit") {
    selectService("yahooTransit");
  }
});

window.addEventListener("pageshow", () => setTimeout(() => input.focus({ preventScroll: true }), 120));
window.addEventListener("load", async () => {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }
});

selectService("google", false);
applyServiceOrder();
renderHistory();
updateInputClearButton();
