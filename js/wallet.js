const walletUtils = window.cardUtils || {};
const walletSiteData = window.__CARDS_VIEWER_DATA__ || {};
const {
  createCardBase,
  fetchJsonSafe,
  formatBinDisplay,
  getBinOverlayText,
  loadCardsFromAssetsProgressively,
  resolveIssuerLogoUrl,
} = walletUtils;

const walletApp = document.querySelector("#walletApp");
const walletCardGroups = document.querySelector("#walletCardGroups");
const walletStatus = document.querySelector("#walletStatus");
const walletCount = document.querySelector("#walletCount");
const walletDetailView = document.querySelector("#walletDetailView");
const walletBackButton = document.querySelector("#walletBackButton");
const walletDetailImage = document.querySelector("#walletDetailImage");
const walletDetailTitle = document.querySelector("#walletDetailTitle");
const walletDetailIssuer = document.querySelector("#walletDetailIssuer");
const walletDetailCardMeta = document.querySelector("#walletDetailCardMeta");
const walletDetailOverlay = document.querySelector("#walletDetailOverlay");
const walletDetailVirtual = document.querySelector("#walletDetailVirtual");
const walletDetailGrid = document.querySelector("#walletDetailGrid");
const walletDetailDescription = document.querySelector(
  "#walletDetailDescription",
);
const walletDetailBenefit = document.querySelector("#walletDetailBenefit");
const walletDetailScroll = document.querySelector(".wallet-detail-scroll");
const walletThemeToggle = document.querySelector("#walletThemeToggle");
const walletSortToggle = document.querySelector("#walletSortToggle");

let walletCards = [];
let activeWalletCard = null;
let walletScrollY = 0;
let issuerParentMap = new Map();
let walletSortMode = "acquired";

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
    branch: cardMeta.branch || "",
    parent: bankInfo.parent || "",
    desc: String(cardMeta.desc || ""),
    benefit: String(cardMeta.benefit || ""),
    currency: cardMeta.currency || [],
  };
}

function formatCardType(card) {
  return (
    { Debit: "借记卡", Credit: "信用卡", Prepaid: "预付卡", Transit: "交通卡" }[
      card.type
    ] ||
    card.type ||
    "-"
  );
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

function formatWalletCardMeta(card) {
  const bin = String(card.bin || "").trim();
  const length =
    String(card.length || "").trim() ||
    (card.organization === "AMEX" ? "15" : "16");
  return `${bin ? formatBinDisplay(bin) : "-"} · ${length}位`;
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

function getIssuerSortGroup(issuer) {
  const name = String(issuer || "").trim();
  if (/^[A-Za-z]/.test(name)) return 0;
  if (/^\p{Script=Han}/u.test(name)) return 1;
  return 2;
}

function compareWalletCardsByIssuer(a, b) {
  const issuerA = String(a.issuer || "");
  const issuerB = String(b.issuer || "");
  const groupDiff = getIssuerSortGroup(issuerA) - getIssuerSortGroup(issuerB);
  if (groupDiff !== 0) return groupDiff;

  const issuerDiff = issuerA.localeCompare(
    issuerB,
    getIssuerSortGroup(issuerA) === 1 ? "zh-Hans-u-co-pinyin" : "en",
    { sensitivity: "base" },
  );
  if (issuerDiff !== 0) return issuerDiff;
  return compareWalletCardsByAcquired(a, b);
}

function getSortedWalletCards(cards) {
  return [...cards].sort(
    walletSortMode === "issuer"
      ? compareWalletCardsByIssuer
      : compareWalletCardsByAcquired,
  );
}

function updateWalletSortToggle() {
  if (!walletSortToggle) return;
  const isAcquired = walletSortMode === "acquired";
  walletSortToggle.textContent = isAcquired
    ? "当前为按获得时间排序"
    : "当前为按发行方排序名称";
  walletSortToggle.setAttribute(
    "aria-label",
    isAcquired ? "切换为按发行方名称排序" : "切换为按获得时间排序",
  );
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

function buildIssuerParentMap(payload) {
  const issuers = new Map();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return issuers;
  }

  Object.entries(payload).forEach(([issuerKey, issuerData]) => {
    const bank = issuerData?.bank;
    if (!bank) return;
    const metadata = {
      parent: String(bank.parent || "").trim(),
      name:
        bank.nativeName || bank.native_name || bank.english_name || issuerKey,
      logoUrl: resolveIssuerLogoUrl(issuerKey, bank.logo || "", bank.region),
    };
    [
      issuerKey,
      bank.english_name,
      bank.englishName,
      bank.native_name,
      bank.nativeName,
    ]
      .filter(Boolean)
      .forEach((alias) => {
        issuers.set(String(alias).trim().toLowerCase(), metadata);
      });
  });

  return issuers;
}

function getIssuerParentChain(parent) {
  const chain = [];
  const seen = new Set();
  let current = String(parent || "").trim();

  while (current) {
    const key = current.toLowerCase();
    if (seen.has(key)) break;
    seen.add(key);
    const issuer = issuerParentMap.get(key);
    chain.push({
      name: issuer?.name || current,
      logoUrl: issuer?.logoUrl || "",
    });
    current = issuer?.parent || "";
  }

  return chain;
}

function appendDetailLogoText(container, logoUrl, text, className = "") {
  if (!container) return;
  if (logoUrl) {
    const logo = document.createElement("img");
    logo.className = `wallet-detail-inline-logo ${className}`.trim();
    logo.src = logoUrl;
    logo.alt = "";
    logo.setAttribute("aria-hidden", "true");
    container.append(logo);
  }
  container.append(document.createTextNode(text || "-"));
}

function openWalletDetail(card) {
  if (!walletApp || !walletDetailView) return;
  activeWalletCard = card;
  walletScrollY = window.scrollY;
  window.scrollTo(0, 0);
  if (walletDetailScroll) walletDetailScroll.scrollTop = 0;
  walletDetailImage.onload = () =>
    applyWalletImageOrientation(walletDetailImage, card);
  walletDetailImage.classList.remove("is-portrait");
  walletDetailImage.src = card.image || "";
  if (walletDetailImage.complete) {
    applyWalletImageOrientation(walletDetailImage, card);
  }
  walletDetailImage.alt = `${card.name} 卡面`;
  walletDetailTitle.textContent = card.name || "-";
  walletDetailCardMeta.textContent = formatWalletCardMeta(card);
  const overlayText = getBinOverlayText(card.bin);
  walletDetailOverlay.textContent = overlayText;
  walletDetailOverlay.hidden = !overlayText;
  walletDetailVirtual.hidden = !card.virtual;
  walletDetailIssuer.replaceChildren();
  appendDetailLogoText(
    walletDetailIssuer,
    card.bankLogoUrl,
    card.issuer,
    "wallet-detail-issuer-logo",
  );
  walletDetailGrid.innerHTML = "";

  const fields = [
    ["卡组织", card.organization],
    ["等级", card.tier],
    ["类型", formatCardType(card)],
    ["地区", formatRegion(card)],
    ["货币", formatCurrency(card)],
    ["取得时间", card.acquired],
    ["分行", card.branch],
  ];
  const parentChain = getIssuerParentChain(card.parent);
  if (parentChain.length) fields.push(["母行", parentChain]);

  fields.forEach(([label, value]) => {
    const term = document.createElement("dt");
    term.textContent = label;
    const description = document.createElement("dd");
    if (label === "卡组织") {
      description.classList.add("has-inline-logo");
      appendDetailLogoText(
        description,
        card.organizationIcon,
        value,
        "wallet-detail-organization-logo",
      );
    } else if (label === "母行") {
      description.classList.add("wallet-detail-parent-list");
      value.forEach((parent) => {
        const parentItem = document.createElement("div");
        parentItem.className = "wallet-detail-parent-item";
        appendDetailLogoText(
          parentItem,
          parent.logoUrl,
          parent.name,
          "wallet-detail-parent-logo",
        );
        description.append(parentItem);
      });
    } else {
      description.textContent = value || "-";
    }
    walletDetailGrid.append(term, description);
  });

  setTextOrHide(walletDetailView, "#walletDetailDescription", card.desc);
  setTextOrHide(walletDetailView, "#walletDetailBenefit", card.benefit);
  walletDetailView.setAttribute("aria-hidden", "false");
  walletApp.classList.add("is-detail-open");
  document.body.classList.add("wallet-detail-active");
  walletDetailView
    .querySelector(".wallet-back-button")
    ?.focus({ preventScroll: true });
}

function closeWalletDetail() {
  if (!walletApp || !walletDetailView) return;
  walletApp.classList.remove("is-detail-open");
  walletDetailView.setAttribute("aria-hidden", "true");
  document.body.classList.remove("wallet-detail-active");
  window.scrollTo(0, walletScrollY);
  activeWalletCard = null;
}

function getWalletTheme() {
  return (
    document.documentElement.dataset.theme ||
    (window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light")
  );
}

function setWalletTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("bankcard-theme", theme);
  } catch {
    // Ignore storage failures.
  }
  walletThemeToggle?.setAttribute(
    "aria-label",
    theme === "dark" ? "切换浅色模式" : "切换深色模式",
  );
  walletThemeToggle?.setAttribute(
    "title",
    theme === "dark" ? "切换浅色模式" : "切换深色模式",
  );
}

function renderWalletStack(stack, cards) {
  stack.style.setProperty("--wallet-card-count", String(cards.length));
  stack.style.height = `${Math.max(250, 232 + (cards.length - 1) * 64)}px`;

  cards.forEach((card, index) => {
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
    image.addEventListener(
      "load",
      () => applyWalletImageOrientation(image, card),
      {
        once: true,
      },
    );
    button.append(image);
    button.addEventListener("click", () => openWalletDetail(card));
    stack.append(button);
  });
}

function renderWalletCards() {
  if (!walletCardGroups) return;
  walletCardGroups.replaceChildren();

  const sortedCards = getSortedWalletCards(walletCards);
  const groups = [
    {
      title: "银行卡",
      cards: sortedCards.filter((card) => card.type !== "Transit"),
    },
    {
      title: "交通卡",
      cards: sortedCards.filter((card) => card.type === "Transit"),
    },
  ];

  groups.forEach((group) => {
    if (!group.cards.length) return;
    const section = document.createElement("section");
    section.className = "wallet-stack-group";

    const title = document.createElement("h2");
    title.className = "wallet-stack-group-title";
    title.textContent = group.title;

    const stack = document.createElement("div");
    stack.className = "wallet-card-stack";
    renderWalletStack(stack, group.cards);

    section.append(title, stack);
    walletCardGroups.append(section);
  });
}

async function loadWalletCards() {
  const [cards, issuerInfo] = await Promise.all([
    loadCardsFromAssetsProgressively(mapWalletCard, {
      onlyMycards: true,
      warn: true,
    }),
    fetchJsonSafe(walletSiteData.issuerInfoUrl || "/json/issuer-info.json"),
  ]);
  issuerParentMap = buildIssuerParentMap(issuerInfo);
  walletCards = cards.filter(Boolean);
  walletCount.textContent = String(walletCards.length);

  if (!walletCards.length) {
    setWalletStatus("暂无已激活卡片");
    return;
  }
  renderWalletCards();
  setWalletStatus("", true);
}

walletBackButton?.addEventListener("click", closeWalletDetail);
walletThemeToggle?.addEventListener("click", () => {
  setWalletTheme(getWalletTheme() === "dark" ? "light" : "dark");
});
walletSortToggle?.addEventListener("click", () => {
  walletSortMode = walletSortMode === "acquired" ? "issuer" : "acquired";
  updateWalletSortToggle();
  renderWalletCards();
});
setWalletTheme(getWalletTheme());
updateWalletSortToggle();
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeWalletCard) closeWalletDetail();
});

loadWalletCards().catch(() => setWalletStatus("卡片数据加载失败"));
