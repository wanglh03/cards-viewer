const walletUtils = window.cardUtils || {};
const walletSiteData = window.__CARDS_VIEWER_DATA__ || {};
const {
  createCardBase,
  fetchJsonSafe,
  loadCardsFromAssetsProgressively,
} = walletUtils;

const walletApp = document.querySelector("#walletApp");
const walletStack = document.querySelector("#walletCardStack");
const walletStatus = document.querySelector("#walletStatus");
const walletCount = document.querySelector("#walletCount");
const walletDetailView = document.querySelector("#walletDetailView");
const walletBackButton = document.querySelector("#walletBackButton");
const walletDetailImage = document.querySelector("#walletDetailImage");
const walletDetailTitle = document.querySelector("#walletDetailTitle");
const walletDetailIssuer = document.querySelector("#walletDetailIssuer");
const walletDetailGrid = document.querySelector("#walletDetailGrid");
const walletDetailDescription = document.querySelector("#walletDetailDescription");
const walletDetailBenefit = document.querySelector("#walletDetailBenefit");

let walletCards = [];
let activeWalletCard = null;

function setWalletStatus(message, hidden = false) {
  if (!walletStatus) return;
  walletStatus.textContent = message;
  walletStatus.hidden = hidden;
}

function mapWalletCard(bankKey, bankInfo, entry) {
  const cardMeta = entry.card || entry;
  if (String(cardMeta.status || "").toLowerCase() !== "active") return null;

  const baseCard = createCardBase(bankKey, bankInfo, cardMeta, {
    organization: cardMeta.organization,
    preferAltImage: true,
  });
  return {
    ...baseCard,
    type: cardMeta.type,
    issuer: bankInfo.native_name || bankInfo.nativeName || bankKey,
    issuerUrl: bankInfo.url || "",
    region: bankInfo.region || "",
    province: bankInfo.province || "",
    status: cardMeta.status,
    virtual: cardMeta.virtual === true,
    acquired: cardMeta.acquired || "",
    desc: String(cardMeta.desc || ""),
    benefit: String(cardMeta.benefit || ""),
    currency: cardMeta.currency || [],
  };
}

function formatCardType(card) {
  return { Debit: "借记卡", Credit: "信用卡", Prepaid: "预付卡", Transit: "交通卡" }[
    card.type
  ] || card.type || "-";
}

function formatRegion(card) {
  if (!card.region) return "-";
  return card.province ? `${card.region}/${card.province}` : card.region;
}

function formatCurrency(card) {
  return Array.isArray(card.currency) && card.currency.length
    ? card.currency.join(" / ")
    : "-";
}

function getAcquiredTimestamp(value) {
  const text = String(value || "").trim();
  if (!text) return Number.NEGATIVE_INFINITY;

  const timestamp = Date.parse(text);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function compareWalletCardsByAcquired(a, b) {
  const acquiredA = getAcquiredTimestamp(a.acquired);
  const acquiredB = getAcquiredTimestamp(b.acquired);
  if (acquiredA === acquiredB) return 0;
  return acquiredB - acquiredA;
}

function setTextOrHide(root, selector, value) {
  const section = root.querySelector(selector);
  if (!section) return;
  const text = String(value || "").trim();
  section.hidden = !text;
  const paragraph = section.querySelector("p");
  if (paragraph) paragraph.textContent = text;
}

function applyWalletImageOrientation(image, card) {
  if (!image) return;
  const isPortrait =
    !card.altImageUrl && image.naturalHeight > image.naturalWidth;
  image.classList.toggle("is-portrait", isPortrait);
}

function openWalletDetail(card) {
  if (!walletApp || !walletDetailView) return;
  activeWalletCard = card;
  walletDetailImage.onload = () => applyWalletImageOrientation(walletDetailImage, card);
  walletDetailImage.classList.remove("is-portrait");
  walletDetailImage.src = card.image || "";
  if (walletDetailImage.complete) {
    applyWalletImageOrientation(walletDetailImage, card);
  }
  walletDetailImage.alt = `${card.name} 卡面`;
  walletDetailTitle.textContent = card.name || "-";
  walletDetailIssuer.textContent = card.issuer || "-";
  walletDetailGrid.innerHTML = "";

  [
    ["卡组织", card.organization],
    ["等级", card.tier],
    ["类型", formatCardType(card)],
    ["地区", formatRegion(card)],
    ["货币", formatCurrency(card)],
    ["取得时间", card.acquired],
  ].forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    description.textContent = value || "-";
    walletDetailGrid.append(term, description);
  });

  setTextOrHide(walletDetailView, "#walletDetailDescription", card.desc);
  setTextOrHide(walletDetailView, "#walletDetailBenefit", card.benefit);
  walletDetailView.setAttribute("aria-hidden", "false");
  walletApp.classList.add("is-detail-open");
  walletDetailView.querySelector(".wallet-back-button")?.focus();
}

function closeWalletDetail() {
  if (!walletApp || !walletDetailView) return;
  walletApp.classList.remove("is-detail-open");
  walletDetailView.setAttribute("aria-hidden", "true");
  activeWalletCard = null;
}

function renderWalletCards() {
  if (!walletStack) return;
  walletStack.replaceChildren();
  walletStack.style.setProperty("--wallet-card-count", String(walletCards.length));
  walletStack.style.height = `${Math.max(250, 232 + (walletCards.length - 1) * 64)}px`;

  walletCards.forEach((card, index) => {
    const button = document.createElement("button");
    button.className = "wallet-card";
    button.type = "button";
    button.style.setProperty("--wallet-card-index", String(index));
    button.style.zIndex = String(index + 1);
    button.setAttribute("aria-label", `查看${card.name || "卡片"}详情`);

    const image = document.createElement("img");
    image.src = card.image || "";
    image.alt = card.name || "卡片";
    image.loading = index < 2 ? "eager" : "lazy";
    image.decoding = "async";
    image.addEventListener("load", () => applyWalletImageOrientation(image, card), {
      once: true,
    });
    button.append(image);
    button.addEventListener("click", () => openWalletDetail(card));
    walletStack.append(button);
  });
}

async function loadWalletCards() {
  const cards = await loadCardsFromAssetsProgressively(mapWalletCard, {
    onlyMycards: true,
    warn: true,
  });
  walletCards = cards.filter(Boolean).sort(compareWalletCardsByAcquired);
  walletCount.textContent = String(walletCards.length);

  if (!walletCards.length) {
    setWalletStatus("暂无已激活卡片");
    return;
  }
  renderWalletCards();
  setWalletStatus("", true);
}

walletBackButton?.addEventListener("click", closeWalletDetail);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeWalletCard) closeWalletDetail();
});

loadWalletCards().catch(() => setWalletStatus("卡片数据加载失败"));
