const types = [
  { id: "debit", label: "借记卡" },
  { id: "prepaid", label: "预付卡" },
  { id: "credit", label: "信用卡" },
  { id: "transit", label: "交通卡" },
];

let cards = [];

// Note: data.json is expected to always be present and complete.
// Fetch directly and assume the JSON contains required fields.
const cardUtils = window.cardUtils || {};
const {
  sanitizeFilename,
  resolveImageUrl,
  toArray,
  firstDefined,
  brandIconUrl,
  loadCardsFromAssets,
} = cardUtils;

function normalizeCurrencies(value) {
  return toArray(value)
    .map((currency) => String(currency).trim())
    .filter(Boolean);
}

function mapCardEntry(bankKey, bankInfo, entry) {
  const issuerName = bankInfo.native_name || bankInfo.english_name || bankKey;
  // Assume entry (or entry.card) contains all required keys.
  const cardMeta = entry.card || entry;
  const statusMap = {
    activated: "已激活",
    "not activated": "未激活",
    expired: "过期",
    "destroyed or lost": "销毁/遗失",
  };
  // normalize brand and extract any embedded type (e.g. "UnionPay Debit")
  let rawBrand = cardMeta.brand || "";
  const typeFromBrandMatch = rawBrand.match(/\b(debit|prepaid|credit)\b/i);
  if (typeFromBrandMatch)
    rawBrand = rawBrand.replace(/\b(debit|prepaid|credit)\b/gi, "").trim();
  const typeRaw = (
    cardMeta.type ||
    (typeFromBrandMatch && typeFromBrandMatch[1]) ||
    ""
  ).toLowerCase();
  const typeId =
    typeRaw === "debit"
      ? "debit"
      : typeRaw === "prepaid"
        ? "prepaid"
        : typeRaw === "transit"
          ? "transit"
          : typeRaw === "credit"
            ? "credit"
            : "credit";
  const binValue = cardMeta.bin;
  const bin = String(toArray(binValue)[0]);
  const ext = cardMeta.ext;
  // form image path from description
  const base = sanitizeFilename(cardMeta.description);
  const image = resolveImageUrl(bankKey, `${base}.${ext}`);
  const currencies = normalizeCurrencies(
    cardMeta.currencies || cardMeta.currency,
  );
  const rawStatus = (cardMeta.status || "").toLowerCase();
  const statusLabel = statusMap[rawStatus] || "已激活";

  return {
    type: typeId,
    name: cardMeta.description,
    bin,
    issuer: issuerName,
    assetFolder: bankKey,
    brand: rawBrand || cardMeta.brand || "",
    brandIcon: brandIconUrl(rawBrand || cardMeta.brand || ""),
    tier: cardMeta.tier,
    status: statusLabel,
    acquired: cardMeta.acquired,
    // region must come from bank info (cards no longer provide region)
    region: bankInfo.region || bankInfo.country,
    currencies,
    note: `${cardMeta.note || ""}`,
    image,
    altImageUrl: resolveImageUrl(
      bankKey,
      cardMeta["alt_image"] || cardMeta.alt_image || "",
    ),
  };
}

const sectionRoot = document.querySelector("#cardSections");
const statsRoot = document.querySelector("#stats");
const template = document.querySelector("#cardTemplate");
const modal = document.querySelector("#cardModal");
const modalImage = document.querySelector("#modalImage");
const modalAltImage = document.querySelector("#modalAltImage");
const modalTitle = document.querySelector("#modalTitle");
const modalStatus = document.querySelector("#modalStatus");
const modalGrid = document.querySelector("#modalGrid");
const modalNote = document.querySelector("#modalNote");
const imageLightbox = document.querySelector("#imageLightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxPrev = document.querySelector("[data-lightbox-prev]");
const lightboxNext = document.querySelector("[data-lightbox-next]");
const pageLoading = document.querySelector("#pageLoading");
const searchInput = document.querySelector("#searchInput");
const typeFilter = document.querySelector("#typeFilter");
const statusFilter = document.querySelector("#statusFilter");
let lightboxImages = [];
let lightboxIndex = 0;
let pageReady = false;
let pageLoadingHidden = false;
let pageLoadingTimer = null;

const statusClass = {
  未激活: "is-muted",
  过期: "is-danger",
  "销毁/遗失": "is-danger",
};

const typeText = {
  debit: "Debit",
  prepaid: "Prepaid",
  credit: "Credit",
  transit: "Transit",
};

function currencyLabel(currency) {
  if (currency === "CNY") return "¥CNY";
  if (currency === "USD") return "$USD";
  if (currency === "EUR") return "€EUR";
  if (currency === "JPY") return "¥JPY";
  if (currency === "GBP") return "£GBP";
  if (currency === "HKD") return "$HKD";
  if (currency === "AUD") return "$AUD";
  if (currency === "CAD") return "$CAD";
  if (currency === "CHF") return "CHF";
  if (currency === "KRW") return "₩KRW";
  if (currency === "SGD") return "$SGD";
  if (currency === "NZD") return "$NZD";
  return currency;
}

function formatCurrencies(currencies) {
  return currencies.map(currencyLabel).join(" / ");
}

function formatBrandTypeTier(card) {
  const parts = [];
  if (card.brand) parts.push(card.brand);
  if (card.tier) parts.push(card.tier);
  const mappedType =
    (card.type && typeText[card.type]) ||
    (card.type
      ? String(card.type).charAt(0).toUpperCase() + String(card.type).slice(1)
      : "");
  if (mappedType) parts.push(mappedType);
  return parts.join(" ");
}

function formatAcquired(acquired) {
  if (!acquired) return "";
  return `取得时间：${acquired}`;
}

function getSummaryFields(card) {
  return [
    ["卡 BIN", card.bin],
    ["卡组织 / 等级 / 类型", formatBrandTypeTier(card)],
    ["发行方", card.issuer],
    ["发行区域", card.region || "China"],
    ["结算货币", formatCurrencies(card.currencies)],
    ["取得时间", card.acquired],
  ];
}

function openModal(card) {
  modalImage.src = card.image;
  modalImage.alt = `${card.name} 卡面`;
  if (card.altImageUrl) {
    modalAltImage.src = card.altImageUrl;
    modalAltImage.alt = `${card.name} 另一张卡面`;
    modalAltImage.hidden = false;
  } else {
    modalAltImage.src = "";
    modalAltImage.alt = "";
    modalAltImage.hidden = true;
  }
  modalTitle.textContent = card.name;
  modalStatus.textContent = card.status;
  modalStatus.className = "card-modal-status";
  const modifier = statusClass[card.status];
  if (modifier) modalStatus.classList.add(modifier);

  modalGrid.innerHTML = "";
  const summary = getSummaryFields(card);
  summary.forEach(([label, value]) => {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    wrapper.append(dt, dd);
    modalGrid.append(wrapper);
  });

  modalNote.textContent = card.note;
  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal() {
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  closeLightbox();
}

function openLightbox(target) {
  if (!target || target.hidden || !target.src) return;
  lightboxImages = [modalImage, modalAltImage].filter(
    (image) => !image.hidden && image.src,
  );
  lightboxIndex = Math.max(0, lightboxImages.indexOf(target));
  updateLightboxImage();
  imageLightbox.hidden = false;
  document.body.classList.add("lightbox-open");
}

function closeLightbox() {
  imageLightbox.hidden = true;
  lightboxImage.src = "";
  lightboxImage.alt = "";
  lightboxImages = [];
  lightboxIndex = 0;
  document.body.classList.remove("lightbox-open");
}

function updateLightboxImage() {
  const activeImage = lightboxImages[lightboxIndex];
  if (!activeImage) return;
  lightboxImage.src = activeImage.currentSrc || activeImage.src;
  lightboxImage.alt = activeImage.alt;
  const hasMultipleImages = lightboxImages.length > 1;
  lightboxPrev.hidden = !hasMultipleImages;
  lightboxNext.hidden = !hasMultipleImages;
}

function switchLightboxImage(direction) {
  if (lightboxImages.length < 2) return;
  lightboxIndex =
    (lightboxIndex + direction + lightboxImages.length) % lightboxImages.length;
  updateLightboxImage();
}

function preloadImage(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve();
      return;
    }
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}

async function preloadCardImages(items) {
  const urls = new Set();
  items.forEach((card) => {
    if (card.image) urls.add(card.image);
    if (card.altImageUrl) urls.add(card.altImageUrl);
  });
  await Promise.allSettled(Array.from(urls, preloadImage));
}

function markPageReady() {
  if (pageReady) return;
  pageReady = true;
  const hide = () => {
    if (pageLoadingHidden || !pageLoading) return;
    pageLoadingHidden = true;
    document.body.classList.remove("page-loading");
    pageLoading.classList.add("is-hidden");
    pageLoadingTimer = window.setTimeout(() => {
      if (pageLoading && pageLoading.parentElement) {
        pageLoading.hidden = true;
      }
    }, 260);
  };

  if (document.readyState === "complete") {
    window.requestAnimationFrame(hide);
    return;
  }

  window.addEventListener("load", () => {
    window.requestAnimationFrame(hide);
  });
}

function cardMatches(card) {
  const search = searchInput.value.trim().toLowerCase();
  const type = typeFilter.value;
  const status = statusFilter.value;
  const searchable = [
    card.name,
    card.bin,
    card.issuer,
    card.brand,
    card.tier,
    card.region,
    card.status,
    card.acquired,
    card.currencies.join(" "),
    card.note,
  ]
    .join(" ")
    .toLowerCase();

  return (
    (type === "all" || card.type === type) &&
    (status === "all" || card.status === status) &&
    (!search || searchable.includes(search))
  );
}

function renderStats(filteredCards) {
  statsRoot.innerHTML = "";
  types.forEach((type) => {
    const count = filteredCards.filter((card) => card.type === type.id).length;
    const item = document.createElement("div");
    item.className = "stat";
    item.dataset.target = type.id;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `跳转到${type.label}分组`);
    item.innerHTML = `<strong>${count}</strong><span>${type.label}</span>`;
    item.addEventListener("click", () => scrollToTypeSection(type.id));
    item.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        scrollToTypeSection(type.id);
      }
    });
    statsRoot.append(item);
  });
}

function scrollToTypeSection(typeId) {
  const target = sectionRoot.querySelector(`[data-section-id="${typeId}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCard(card) {
  const node = template.content.firstElementChild.cloneNode(true);
  const image = node.querySelector("img");
  image.src = card.image;
  image.alt = `${card.name}`;
  const brandBadge = node.querySelector(".card-brand-badge");
  if (brandBadge) {
    if (card.brandIcon) {
      brandBadge.src = card.brandIcon;
      brandBadge.alt = card.brand || "";
      brandBadge.hidden = false;
    } else {
      brandBadge.src = "";
      brandBadge.alt = "";
      brandBadge.hidden = true;
    }
  }
  node.querySelector("h2").textContent = card.name;
  const status = node.querySelector(".status");
  status.textContent = card.status;
  const modifier = statusClass[card.status];
  if (modifier) status.classList.add(modifier);

  node.querySelector('[data-field="bin"]').textContent = card.bin;
  node.querySelector('[data-field="brand-tier"]').textContent =
    formatBrandTypeTier(card);
  node.querySelector('[data-field="issuer"]').textContent = card.issuer;
  node.querySelector('[data-field="region"]').textContent =
    card.region || "China";
  node.querySelector('[data-field="currencies"]').textContent =
    formatCurrencies(card.currencies);
  node.querySelector('[data-field="acquired"]').textContent = formatAcquired(
    card.acquired,
  );

  node.addEventListener("click", () => openModal(card));
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openModal(card);
    }
  });
  return node;
}

function render() {
  const filteredCards = cards.filter(cardMatches);
  sectionRoot.innerHTML = "";
  renderStats(filteredCards);

  types.forEach((type) => {
    if (typeFilter.value !== "all" && typeFilter.value !== type.id) {
      return;
    }

    const categoryCards = filteredCards.filter((card) => card.type === type.id);
    const section = document.createElement("section");
    section.dataset.sectionId = type.id;
    section.innerHTML = `
      <div class="section-heading">
        <h2>${type.label}</h2>
        <p>${categoryCards.length} 张</p>
      </div>
    `;

    if (categoryCards.length) {
      const grid = document.createElement("div");
      grid.className = "card-grid";
      categoryCards.forEach((card) => grid.append(renderCard(card)));
      section.append(grid);
    } else {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "暂无符合条件的卡片。";
      section.append(empty);
    }

    sectionRoot.append(section);
  });
}

[searchInput, typeFilter, statusFilter].forEach((control) =>
  control.addEventListener("input", render),
);
async function init() {
  document.body.classList.add("page-loading");
  cards = await loadCardsFromAssets(mapCardEntry, { warn: true });
  render();
  await preloadCardImages(cards);
  markPageReady();
}

init();

modal.addEventListener("click", (event) => {
  let el = event.target;
  if (el && el.nodeType !== 1) el = el.parentElement;
  if (el === modalImage || el === modalAltImage) {
    openLightbox(el);
    return;
  }
  if (
    el &&
    typeof el.closest === "function" &&
    el.closest("[data-close-modal]")
  ) {
    closeModal();
  }
});

imageLightbox.addEventListener("click", (event) => {
  let el = event.target;
  if (el && el.nodeType !== 1) el = el.parentElement;
  if (el === lightboxPrev) {
    switchLightboxImage(-1);
    return;
  }
  if (el === lightboxNext) {
    switchLightboxImage(1);
    return;
  }
  if (
    el &&
    typeof el.closest === "function" &&
    el.closest("[data-close-lightbox]")
  ) {
    closeLightbox();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !imageLightbox.hidden) {
    closeLightbox();
    return;
  }
  if (event.key === "ArrowLeft" && !imageLightbox.hidden) {
    event.preventDefault();
    switchLightboxImage(-1);
    return;
  }
  if (event.key === "ArrowRight" && !imageLightbox.hidden) {
    event.preventDefault();
    switchLightboxImage(1);
    return;
  }
  if (event.key === "Escape" && !modal.hidden) {
    closeModal();
  }
});
