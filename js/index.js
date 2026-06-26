const TYPE_DEFINITIONS = [
  { id: "debit", label: "借记卡" },
  { id: "prepaid", label: "预付卡" },
  { id: "credit", label: "信用卡" },
  { id: "transit", label: "交通卡" },
];

const STATUS_LABELS = {
  activated: "已激活",
  inactivated: "未激活",
  expired: "过期",
  cancelled: "取消",
};

const STATUS_CLASS = {
  未激活: "is-muted",
  过期: "is-danger",
  取消: "is-danger",
};

const ORGANIZATION_ORDER = [
  "Mastercard",
  "VISA",
  "AMEX",
  "UnionPay",
  "JCB",
  "China T-Union",
];

const ORGANIZATION_DISPLAY = {
  mastercard: "Mastercard",
  visa: "VISA",
  amex: "AMEX",
  unionpay: "UnionPay",
  jcb: "JCB",
  "china t-union": "China T-Union",
};

const BANK_TAG_ORDER = [
  "state",
  "stock",
  "city",
  "rural",
  "foreign",
  "digital",
  "non-bank",
];

const BANK_TAG_LABELS = {
  state: "国有商行",
  stock: "股份制商行",
  city: "城商行",
  rural: "农商行",
  foreign: "外资商行",
  digital: "数字银行",
  "non-bank": "非银行",
};

const REGION_ORDER = ["CN", "HK", "MO", "TW"];

const REGION_LABELS = {
  CN: "中国大陆",
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
  CH: "瑞士",
};

const NON_LOCAL_PROVINCE_LABEL = "非地方";

const TIER_ORDER_MAP = {
  Mastercard: [
    "World Legend",
    "World Elite",
    "World",
    "Platinum",
    "Titanium",
    "Gold",
    "Standard",
  ],
  VISA: ["Infinite", "Signature", "Platinum", "Gold", "Classic"],
  AMEX: [
    "Centurion",
    "Icon",
    "Platinum",
    "Max",
    "Gold",
    "Select",
    "Green",
    "Member",
  ],
  UnionPay: ["Diamond", "Platinum", "Gold", "Standard"],
  JCB: ["Eternity", "Precious", "Platinum", "Gold"],
  "China T-Union": [],
};

let cards = [];
let issuerFilterValue = "all";
let issuerFilterHoverTag = "all";
let regionFilterValue = "all";
let regionFilterHoverRegion = "all";
let lightboxImages = [];
let lightboxIndex = 0;

const cardUtils = window.cardUtils || {};
const currencyUtils = window.currencyUtils || {};

const {
  sanitizeFilename,
  resolveImageUrl,
  toArray,
  organizationIconUrl,
  loadCardsFromAssetsProgressively,
} = cardUtils;

const { formatCurrencyList } = currencyUtils;

const sectionRoot = document.querySelector("#cardSections");
const statsRoot = document.querySelector("#stats");
const template = document.querySelector("#cardTemplate");
const modal = document.querySelector("#cardModal");
const modalImage = document.querySelector("#modalImage");
const modalAltImage = document.querySelector("#modalAltImage");
const modalTitle = document.querySelector("#modalTitle");
const modalStatus = document.querySelector("#modalStatus");
const modalVirtual = document.querySelector("#modalVirtual");
const modalApplyLink = document.querySelector("#modalApplyLink");
const modalGrid = document.querySelector("#modalGrid");
const modalDesc = document.querySelector("#modalDesc");
const modalDescSection = modalDesc?.closest(".modal-desc") || null;
const modalBenefitSection = document.querySelector("#modalBenefitSection");
const modalBenefit = document.querySelector("#modalBenefit");
const imageLightbox = document.querySelector("#imageLightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxPrev = document.querySelector("[data-lightbox-prev]");
const lightboxNext = document.querySelector("[data-lightbox-next]");
const searchInput = document.querySelector("#searchInput");
const typeFilter = document.querySelector("#typeFilter");
const organizationFilter = document.querySelector("#organizationFilter");
const issuerFilterWrap = document.querySelector("#issuerFilterWrap");
const issuerFilterTrigger = document.querySelector("#issuerFilterTrigger");
const issuerFilterLabel = document.querySelector("#issuerFilterLabel");
const issuerFilterPanel = document.querySelector("#issuerFilterPanel");
const issuerFilterGroups = document.querySelector("#issuerFilterGroups");
const issuerFilterBanks = document.querySelector("#issuerFilterBanks");
const regionFilterWrap = document.querySelector("#regionFilterWrap");
const regionFilterTrigger = document.querySelector("#regionFilterTrigger");
const regionFilterLabel = document.querySelector("#regionFilterLabel");
const regionFilterPanel = document.querySelector("#regionFilterPanel");
const regionFilterGroups = document.querySelector("#regionFilterGroups");
const regionFilterProvinces = document.querySelector("#regionFilterProvinces");
const statusFilter = document.querySelector("#statusFilter");

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "zh-Hans-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

function normalizeOrganizationName(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const display = ORGANIZATION_DISPLAY[text.toLowerCase()];
  return display || text.replace(/\s+/g, " ");
}

function normalizeBankTag(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  return text || "non-bank";
}

function normalizeBankValue(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeRegionValue(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function normalizeProvinceValue(value) {
  const text = String(value || "")
    .trim()
    .replace(/\s+/g, " ");
  return text || NON_LOCAL_PROVINCE_LABEL;
}

function getOrganizationRank(value) {
  const normalized = normalizeOrganizationName(value).toLowerCase();
  const index = ORGANIZATION_ORDER.findIndex(
    (item) => item.toLowerCase() === normalized,
  );
  return index === -1 ? ORGANIZATION_ORDER.length : index;
}

function getTierRank(organization, tier) {
  const organizationKey = normalizeOrganizationName(organization);
  const tiers = TIER_ORDER_MAP[organizationKey] || [];
  const normalizedTier = String(tier || "")
    .trim()
    .toLowerCase();
  const index = tiers.findIndex(
    (item) => item.toLowerCase() === normalizedTier,
  );
  return index === -1 ? tiers.length : index;
}

function getBankTagRank(tag) {
  const normalized = normalizeBankTag(tag);
  const index = BANK_TAG_ORDER.indexOf(normalized);
  return index === -1 ? BANK_TAG_ORDER.length : index;
}

function getBankTagLabel(tag) {
  return BANK_TAG_LABELS[normalizeBankTag(tag)] || BANK_TAG_LABELS["non-bank"];
}

function getRegionRank(region) {
  const normalized = normalizeRegionValue(region);
  const index = REGION_ORDER.indexOf(normalized);
  return index === -1 ? REGION_ORDER.length : index;
}

function getRegionLabel(region) {
  const normalized = normalizeRegionValue(region);
  return REGION_LABELS[normalized] || normalized || "-";
}

function queueImageLoad(image, src) {
  if (!image || !src) return;
  image.dataset.src = src;
}

function activateDeferredImages(scope) {
  if (!scope || typeof scope.querySelectorAll !== "function") return;
  scope.querySelectorAll("img[data-src]").forEach((image) => {
    const src = image.dataset.src;
    if (!src || image.src) return;
    image.src = src;
    image.removeAttribute("data-src");
  });
}

function createOption(value, label) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function initializeStaticFilters() {
  if (typeFilter) {
    typeFilter.innerHTML = "";
    typeFilter.append(
      createOption("all", "全部卡片类型"),
      ...TYPE_DEFINITIONS.map((type) => createOption(type.id, type.label)),
    );
  }

  if (statusFilter) {
    statusFilter.innerHTML = "";
    statusFilter.append(
      createOption("all", "全部状态"),
      createOption("已激活", "已激活"),
      createOption("未激活", "未激活"),
      createOption("过期", "过期"),
      createOption("取消", "取消"),
    );
  }

  if (organizationFilter) {
    organizationFilter.innerHTML = "";
    organizationFilter.append(createOption("all", "全部卡组织"));
  }

  if (issuerFilterLabel) {
    issuerFilterLabel.textContent = "全部发行方";
  }

  if (regionFilterLabel) {
    regionFilterLabel.textContent = "全部区域";
  }
}

function mapCardEntry(bankKey, bankInfo, entry) {
  const cardMeta = entry.card || entry;
  const rawType = String(cardMeta.type || "")
    .trim()
    .toLowerCase();
  const typeFromOrganization = String(cardMeta.organization || "")
    .match(/\b(debit|prepaid|credit|transit)\b/i)?.[1]
    ?.toLowerCase();

  const type =
    rawType === "debit" ||
    rawType === "prepaid" ||
    rawType === "credit" ||
    rawType === "transit"
      ? rawType
      : typeFromOrganization || "credit";

  const rawOrganization = String(cardMeta.organization || "")
    .replace(/\b(debit|prepaid|credit|transit)\b/gi, "")
    .trim();

  const name = String(cardMeta.name || "").trim();
  const baseName = sanitizeFilename(name);
  const imageUrl = resolveImageUrl(
    bankKey,
    `${baseName}.${cardMeta.ext || ""}`,
  );
  const altImageUrl = resolveImageUrl(
    bankKey,
    String(cardMeta.alt_image || "").trim(),
  );
  const currency = toArray(cardMeta.currency)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
  const statusKey = String(cardMeta.status || "")
    .trim()
    .toLowerCase();

  return {
    bankKey,
    bankTag: String(bankInfo.tag || "").trim(),
    bankNativeName: String(bankInfo.native_name || "").trim(),
    bankEnglishName: String(bankInfo.english_name || bankKey || "").trim(),
    bankParent: String(bankInfo.parent || "").trim(),
    bankWebsiteUrl: String(bankInfo.url || "").trim(),
    bankLogoUrl: resolveImageUrl(bankKey, String(bankInfo.logo || "").trim()),
    name,
    type,
    bin: String(toArray(cardMeta.bin)[0] || "").trim(),
    issuer:
      String(bankInfo.native_name || "").trim() ||
      String(bankInfo.english_name || "").trim() ||
      bankKey,
    region: String(bankInfo.region || bankInfo.country || "").trim(),
    province: normalizeProvinceValue(bankInfo.province),
    organization: normalizeOrganizationName(
      rawOrganization || cardMeta.organization,
    ),
    organizationIcon: organizationIconUrl(
      rawOrganization || cardMeta.organization,
    ),
    tier: String(cardMeta.tier || "").trim(),
    status: STATUS_LABELS[statusKey] || STATUS_LABELS.activated,
    virtual: cardMeta.virtual === true,
    acquired: String(cardMeta.acquired || "").trim(),
    currency,
    desc: String(cardMeta.desc || ""),
    benefit: String(cardMeta.benefit || ""),
    annualFee: String(cardMeta.annual_fee || "").trim(),
    ftf: String(cardMeta.ftf || "").trim(),
    url: String(cardMeta.url || "").trim(),
    image: imageUrl,
    altImageUrl,
  };
}

function getBankOptionValue(card) {
  return normalizeBankValue(card.bankEnglishName || card.bankKey);
}

function getParentMap() {
  const parentMap = new Map();

  cards.forEach((card) => {
    const child = getBankOptionValue(card);
    const parent = normalizeBankValue(card.bankParent);
    if (!child || !parent || parentMap.has(child)) return;
    parentMap.set(child, parent);
  });

  return parentMap;
}

function bankMatchesRecursive(card, bankValue) {
  const current = getBankOptionValue(card);
  const target = normalizeBankValue(bankValue);
  if (!current || !target) return false;
  if (current === target) return true;

  const parentMap = getParentMap();
  const visited = new Set([current]);
  let cursor = parentMap.get(current) || "";

  while (cursor && !visited.has(cursor)) {
    if (cursor === target) return true;
    visited.add(cursor);
    cursor = parentMap.get(cursor) || "";
  }

  return false;
}

function getIssuerOptions() {
  const map = new Map();

  cards.forEach((card) => {
    const value = getBankOptionValue(card);
    if (!value || map.has(value)) return;
    map.set(value, {
      value,
      label: card.bankNativeName || card.bankEnglishName || value,
      logoUrl: card.bankLogoUrl || "",
      bankTag: normalizeBankTag(card.bankTag),
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const tagDiff = getBankTagRank(a.bankTag) - getBankTagRank(b.bankTag);
    if (tagDiff !== 0) return tagDiff;
    return compareText(a.label, b.label);
  });
}

function getIssuerOptionsByTag(tag) {
  const normalized = normalizeBankTag(tag);
  return getIssuerOptions().filter((option) => option.bankTag === normalized);
}

function getIssuerDisplayText(value) {
  if (value === "all") return "全部发行方";
  if (value.startsWith("tag:")) {
    return getBankTagLabel(value.slice(4));
  }
  if (value.startsWith("bank:")) {
    const bankValue = value.slice(5);
    const match = getIssuerOptions().find(
      (option) => option.value === bankValue,
    );
    return match?.label || "全部发行方";
  }
  return "全部发行方";
}

function appendBankNameContent(
  container,
  label,
  logoUrl,
  immediateLoad = false,
) {
  if (!container) return;

  const wrapper = document.createElement("span");
  wrapper.className = "bank-name-inline";

  if (logoUrl) {
    const image = document.createElement("img");
    image.className = "bank-logo-inline";
    image.alt = "";
    image.setAttribute("aria-hidden", "true");
    if (immediateLoad) {
      image.src = logoUrl;
    } else {
      queueImageLoad(image, logoUrl);
    }
    wrapper.append(image);
  }

  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(text);
  container.append(wrapper);
}

function updateIssuerGroupState() {
  if (!issuerFilterGroups) return;

  issuerFilterGroups
    .querySelectorAll(".issuer-filter-item")
    .forEach((button) => {
      const tag = button.dataset.tag || "";
      const active =
        (tag === "all" && issuerFilterValue === "all") ||
        issuerFilterHoverTag === tag ||
        issuerFilterValue === `tag:${tag}`;
      button.classList.toggle("is-active", active);
    });
}

function renderIssuerFilterBanks(activeTag) {
  if (!issuerFilterBanks) return;
  issuerFilterBanks.innerHTML = "";

  if (!activeTag || activeTag === "all") return;

  getIssuerOptionsByTag(activeTag).forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "issuer-filter-bank-item";
    button.dataset.value = `bank:${option.value}`;
    appendBankNameContent(button, option.label, option.logoUrl, true);
    button.classList.toggle(
      "is-active",
      issuerFilterValue === button.dataset.value,
    );
    button.addEventListener("click", () => {
      setIssuerFilterValue(button.dataset.value);
      closeIssuerFilterPanel();
      render();
    });
    issuerFilterBanks.append(button);
  });
}

function renderIssuerFilterGroups() {
  if (!issuerFilterGroups) return;
  issuerFilterGroups.innerHTML = "";

  const issuerOptions = getIssuerOptions();

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "issuer-filter-item";
  allButton.dataset.tag = "all";
  allButton.textContent = `全部发行方 (${issuerOptions.length})`;
  allButton.addEventListener("mouseenter", () => {
    issuerFilterHoverTag = "all";
    updateIssuerGroupState();
    renderIssuerFilterBanks("all");
  });
  allButton.addEventListener("focus", () => {
    issuerFilterHoverTag = "all";
    updateIssuerGroupState();
    renderIssuerFilterBanks("all");
  });
  allButton.addEventListener("click", () => {
    setIssuerFilterValue("all");
    closeIssuerFilterPanel();
    render();
  });
  issuerFilterGroups.append(allButton);

  BANK_TAG_ORDER.forEach((tag) => {
    const options = getIssuerOptionsByTag(tag);
    if (!options.length) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "issuer-filter-item";
    button.dataset.tag = tag;
    button.textContent = `${getBankTagLabel(tag)} (${options.length})`;
    button.addEventListener("mouseenter", () => {
      issuerFilterHoverTag = tag;
      updateIssuerGroupState();
      renderIssuerFilterBanks(tag);
    });
    button.addEventListener("focus", () => {
      issuerFilterHoverTag = tag;
      updateIssuerGroupState();
      renderIssuerFilterBanks(tag);
    });
    button.addEventListener("click", () => {
      setIssuerFilterValue(`tag:${tag}`);
      closeIssuerFilterPanel();
      render();
    });
    issuerFilterGroups.append(button);
  });

  updateIssuerGroupState();
}

function setIssuerFilterValue(value) {
  const nextValue = value || "all";
  const issuerOptions = getIssuerOptions();

  if (nextValue === "all") {
    issuerFilterValue = "all";
    issuerFilterHoverTag = "all";
  } else if (nextValue.startsWith("tag:")) {
    const tag = nextValue.slice(4);
    const exists = getIssuerOptionsByTag(tag).length > 0;
    issuerFilterValue = exists ? nextValue : "all";
    issuerFilterHoverTag = exists ? normalizeBankTag(tag) : "all";
  } else if (nextValue.startsWith("bank:")) {
    const bankValue = nextValue.slice(5);
    const match = issuerOptions.find((option) => option.value === bankValue);
    if (match) {
      issuerFilterValue = nextValue;
      issuerFilterHoverTag = match.bankTag;
    } else {
      issuerFilterValue = "all";
      issuerFilterHoverTag = "all";
    }
  } else {
    issuerFilterValue = "all";
    issuerFilterHoverTag = "all";
  }

  if (issuerFilterLabel) {
    issuerFilterLabel.textContent = getIssuerDisplayText(issuerFilterValue);
  }
}

function updateIssuerFilterOptions() {
  const currentValue = issuerFilterValue;
  setIssuerFilterValue(currentValue);
  renderIssuerFilterGroups();
  renderIssuerFilterBanks(issuerFilterHoverTag);
}

function openIssuerFilterPanel() {
  if (!issuerFilterPanel || !issuerFilterTrigger) return;
  closeRegionFilterPanel();
  renderIssuerFilterGroups();
  renderIssuerFilterBanks(issuerFilterHoverTag);
  issuerFilterPanel.hidden = false;
  issuerFilterTrigger.setAttribute("aria-expanded", "true");
}

function closeIssuerFilterPanel() {
  if (!issuerFilterPanel || !issuerFilterTrigger) return;
  issuerFilterPanel.hidden = true;
  issuerFilterTrigger.setAttribute("aria-expanded", "false");
}

function getRegionOptions() {
  const map = new Map();

  cards.forEach((card) => {
    const value = normalizeRegionValue(card.region);
    if (!value) return;
    const current = map.get(value) || {
      value,
      label: getRegionLabel(value),
      count: 0,
    };
    current.count += 1;
    map.set(value, current);
  });

  return Array.from(map.values()).sort((a, b) => {
    const rankDiff = getRegionRank(a.value) - getRegionRank(b.value);
    if (rankDiff !== 0) return rankDiff;
    return compareText(a.label, b.label);
  });
}

function getProvinceOptions() {
  const map = new Map();

  cards.forEach((card) => {
    if (normalizeRegionValue(card.region) !== "CN") return;
    const value = normalizeProvinceValue(card.province);
    const current = map.get(value) || {
      value,
      label: value,
      count: 0,
    };
    current.count += 1;
    map.set(value, current);
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.value === NON_LOCAL_PROVINCE_LABEL) return -1;
    if (b.value === NON_LOCAL_PROVINCE_LABEL) return 1;
    return compareText(a.label, b.label);
  });
}

function getRegionDisplayText(value) {
  if (value === "all") return "全部区域";
  if (value.startsWith("region:")) {
    return getRegionLabel(value.slice(7));
  }
  if (value.startsWith("province:")) {
    return `中国大陆 / ${value.slice(9)}`;
  }
  return "全部区域";
}

function updateRegionGroupState() {
  if (!regionFilterGroups) return;

  regionFilterGroups
    .querySelectorAll(".issuer-filter-item")
    .forEach((button) => {
      const region = button.dataset.region || "";
      const active =
        (region === "all" && regionFilterValue === "all") ||
        regionFilterHoverRegion === region ||
        regionFilterValue === `region:${region}` ||
        (region === "CN" && regionFilterValue.startsWith("province:"));
      button.classList.toggle("is-active", active);
    });
}

function renderRegionFilterProvinces(activeRegion) {
  if (!regionFilterProvinces) return;
  regionFilterProvinces.innerHTML = "";

  if (activeRegion !== "CN") return;

  getProvinceOptions().forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "issuer-filter-bank-item";
    button.dataset.value = `province:${option.value}`;
    button.textContent = `${option.label} (${option.count})`;
    button.classList.toggle(
      "is-active",
      regionFilterValue === button.dataset.value,
    );
    button.addEventListener("click", () => {
      setRegionFilterValue(button.dataset.value);
      closeRegionFilterPanel();
      render();
    });
    regionFilterProvinces.append(button);
  });
}

function renderRegionFilterGroups() {
  if (!regionFilterGroups) return;
  regionFilterGroups.innerHTML = "";

  const regionOptions = getRegionOptions();
  const totalCount = regionOptions.reduce((sum, item) => sum + item.count, 0);

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "issuer-filter-item";
  allButton.dataset.region = "all";
  allButton.textContent = `全部区域 (${totalCount})`;
  allButton.addEventListener("mouseenter", () => {
    regionFilterHoverRegion = "all";
    updateRegionGroupState();
    renderRegionFilterProvinces("all");
  });
  allButton.addEventListener("focus", () => {
    regionFilterHoverRegion = "all";
    updateRegionGroupState();
    renderRegionFilterProvinces("all");
  });
  allButton.addEventListener("click", () => {
    setRegionFilterValue("all");
    closeRegionFilterPanel();
    render();
  });
  regionFilterGroups.append(allButton);

  regionOptions.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "issuer-filter-item";
    button.dataset.region = option.value;
    button.textContent = `${option.label} (${option.count})`;
    button.addEventListener("mouseenter", () => {
      regionFilterHoverRegion = option.value;
      updateRegionGroupState();
      renderRegionFilterProvinces(option.value);
    });
    button.addEventListener("focus", () => {
      regionFilterHoverRegion = option.value;
      updateRegionGroupState();
      renderRegionFilterProvinces(option.value);
    });
    button.addEventListener("click", () => {
      setRegionFilterValue(`region:${option.value}`);
      closeRegionFilterPanel();
      render();
    });
    regionFilterGroups.append(button);
  });

  updateRegionGroupState();
}

function setRegionFilterValue(value) {
  const nextValue = value || "all";
  const regionOptions = getRegionOptions();
  const provinceOptions = getProvinceOptions();

  if (nextValue === "all") {
    regionFilterValue = "all";
    regionFilterHoverRegion = "all";
  } else if (nextValue.startsWith("region:")) {
    const region = normalizeRegionValue(nextValue.slice(7));
    const exists = regionOptions.some((option) => option.value === region);
    regionFilterValue = exists ? `region:${region}` : "all";
    regionFilterHoverRegion = exists ? region : "all";
  } else if (nextValue.startsWith("province:")) {
    const province = normalizeProvinceValue(nextValue.slice(9));
    const exists = provinceOptions.some((option) => option.value === province);
    if (exists) {
      regionFilterValue = `province:${province}`;
      regionFilterHoverRegion = "CN";
    } else {
      regionFilterValue = "all";
      regionFilterHoverRegion = "all";
    }
  } else {
    regionFilterValue = "all";
    regionFilterHoverRegion = "all";
  }

  if (regionFilterLabel) {
    regionFilterLabel.textContent = getRegionDisplayText(regionFilterValue);
  }
}

function updateRegionFilterOptions() {
  const currentValue = regionFilterValue;
  setRegionFilterValue(currentValue);
  renderRegionFilterGroups();
  renderRegionFilterProvinces(regionFilterHoverRegion);
}

function openRegionFilterPanel() {
  if (!regionFilterPanel || !regionFilterTrigger) return;
  closeIssuerFilterPanel();
  renderRegionFilterGroups();
  renderRegionFilterProvinces(regionFilterHoverRegion);
  regionFilterPanel.hidden = false;
  regionFilterTrigger.setAttribute("aria-expanded", "true");
}

function closeRegionFilterPanel() {
  if (!regionFilterPanel || !regionFilterTrigger) return;
  regionFilterPanel.hidden = true;
  regionFilterTrigger.setAttribute("aria-expanded", "false");
}

function getOrganizationOptions() {
  const values = new Set();
  cards.forEach((card) => {
    const organization = normalizeOrganizationName(card.organization);
    if (organization) values.add(organization);
  });

  return Array.from(values).sort((a, b) => {
    const rankDiff = getOrganizationRank(a) - getOrganizationRank(b);
    if (rankDiff !== 0) return rankDiff;
    return compareText(a, b);
  });
}

function updateOrganizationFilterOptions() {
  if (!organizationFilter) return;
  const currentValue = organizationFilter.value || "all";
  const options = getOrganizationOptions();

  organizationFilter.innerHTML = "";
  organizationFilter.append(createOption("all", "全部卡组织"));
  options.forEach((item) => {
    organizationFilter.append(createOption(item, item));
  });

  organizationFilter.value = options.includes(currentValue)
    ? currentValue
    : "all";
}

function compareCards(a, b) {
  const organizationDiff =
    getOrganizationRank(a.organization) - getOrganizationRank(b.organization);
  if (organizationDiff !== 0) return organizationDiff;

  const tierDiff =
    getTierRank(a.organization, a.tier) - getTierRank(b.organization, b.tier);
  if (tierDiff !== 0) return tierDiff;

  const issuerDiff = compareText(a.issuer, b.issuer);
  if (issuerDiff !== 0) return issuerDiff;

  return compareText(a.name, b.name);
}

function sortCards(list) {
  return list.slice().sort(compareCards);
}

function formatOrganizationTier(card) {
  const parts = [];
  if (card.organization) parts.push(card.organization);
  if (card.tier) parts.push(card.tier);
  const typeLabel = TYPE_DEFINITIONS.find(
    (type) => type.id === card.type,
  )?.label;
  if (typeLabel) parts.push(typeLabel);
  return parts.join(" ");
}

function formatRegionText(card) {
  const region = normalizeRegionValue(card.region);
  if (!region) return "";
  if (region === "CN") {
    return `${getRegionLabel(region)} / ${normalizeProvinceValue(card.province)}`;
  }
  return getRegionLabel(region);
}

function formatAcquiredText(value) {
  return value ? `取得时间：${value}` : "";
}

function formatMultilineText(value) {
  return String(value || "").replace(/\\n/g, "\n");
}

function formatBenefitText(card) {
  const lines = [];
  if (card.annualFee) lines.push(`年费：${card.annualFee}`);
  if (card.ftf) lines.push(`FTF: ${card.ftf}`);

  const benefitText = formatMultilineText(card.benefit).trim();
  if (benefitText) lines.push(benefitText);

  return lines.join("\n");
}

function getSummaryFields(card) {
  return [
    { label: "卡 BIN", value: card.bin || "-" },
    {
      label: "卡组织 / 等级 / 类型",
      value: formatOrganizationTier(card) || "-",
    },
    {
      label: "发行方",
      value: card.issuer || "-",
      logoUrl: card.bankLogoUrl || "",
      href: card.bankWebsiteUrl || "",
      rich: "bank",
    },
    { label: "区域", value: formatRegionText(card) || "-" },
    {
      label: "结算货币",
      value: formatCurrencyList(card.currency) || "-",
    },
    { label: "取得时间", value: card.acquired || "-" },
  ];
}

function openModal(card) {
  if (!modal || !modalImage || !modalTitle) return;

  modalImage.src = card.image;
  modalImage.alt = `${card.name} 卡面`;

  if (modalAltImage) {
    if (card.altImageUrl) {
      modalAltImage.src = card.altImageUrl;
      modalAltImage.alt = `${card.name} 另一张卡面`;
      modalAltImage.hidden = false;
    } else {
      modalAltImage.src = "";
      modalAltImage.alt = "";
      modalAltImage.hidden = true;
    }
  }

  modalTitle.textContent = card.name;

  if (modalStatus) {
    modalStatus.textContent = card.status;
    modalStatus.className = "card-modal-status badge-pill";
    const modifier = STATUS_CLASS[card.status];
    if (modifier) modalStatus.classList.add(modifier);
  }

  if (modalVirtual) {
    modalVirtual.hidden = !card.virtual;
    modalVirtual.textContent = card.virtual ? "虚拟卡" : "";
  }

  if (modalApplyLink) {
    modalApplyLink.hidden = !card.url;
    modalApplyLink.href = card.url || "#";
  }

  if (modalGrid) {
    modalGrid.innerHTML = "";
    getSummaryFields(card).forEach((item) => {
      const wrapper = document.createElement("div");
      const dt = document.createElement("dt");
      const dd = document.createElement("dd");
      dt.textContent = item.label;
      if (item.rich === "bank") {
        const contentRoot = item.href ? document.createElement("a") : dd;
        if (item.href) {
          contentRoot.href = item.href;
          contentRoot.target = "_blank";
          contentRoot.rel = "noopener noreferrer";
          contentRoot.className = "modal-bank-link";
        }
        appendBankNameContent(contentRoot, item.value, item.logoUrl, true);
        if (item.href) {
          dd.append(contentRoot);
        }
      } else {
        dd.textContent = item.value;
      }
      wrapper.append(dt, dd);
      modalGrid.append(wrapper);
    });
  }

  if (modalDesc && modalDescSection) {
    const descText = formatMultilineText(card.desc).trim();
    modalDesc.textContent = descText;
    modalDescSection.hidden = !descText;
  }

  if (modalBenefit && modalBenefitSection) {
    const benefitText = formatBenefitText(card).trim();
    modalBenefit.textContent = benefitText;
    modalBenefitSection.hidden = !benefitText;
  }

  modal.hidden = false;
  document.body.classList.add("modal-open");
}

function closeModal() {
  if (!modal) return;
  modal.hidden = true;
  document.body.classList.remove("modal-open");
  closeLightbox();
}

function updateLightboxImage() {
  const activeImage = lightboxImages[lightboxIndex];
  if (!activeImage || !lightboxImage) return;

  lightboxImage.src = activeImage.currentSrc || activeImage.src;
  lightboxImage.alt = activeImage.alt || "";

  const multiple = lightboxImages.length > 1;
  if (lightboxPrev) lightboxPrev.hidden = !multiple;
  if (lightboxNext) lightboxNext.hidden = !multiple;
}

function openLightbox(target) {
  if (!target || target.hidden || !target.src || !imageLightbox) return;

  lightboxImages = [modalImage, modalAltImage].filter(
    (image) => image && !image.hidden && image.src,
  );
  lightboxIndex = Math.max(0, lightboxImages.indexOf(target));
  updateLightboxImage();
  imageLightbox.hidden = false;
  document.body.classList.add("lightbox-open");
}

function closeLightbox() {
  if (!imageLightbox || !lightboxImage) return;
  imageLightbox.hidden = true;
  lightboxImage.src = "";
  lightboxImage.alt = "";
  lightboxImages = [];
  lightboxIndex = 0;
  document.body.classList.remove("lightbox-open");
}

function switchLightboxImage(direction) {
  if (lightboxImages.length < 2) return;
  lightboxIndex =
    (lightboxIndex + direction + lightboxImages.length) % lightboxImages.length;
  updateLightboxImage();
}

function cardMatchesIssuer(card, issuerValue) {
  if (issuerValue === "all") return true;

  if (issuerValue.startsWith("tag:")) {
    return (
      normalizeBankTag(card.bankTag) === normalizeBankTag(issuerValue.slice(4))
    );
  }

  if (issuerValue.startsWith("bank:")) {
    return bankMatchesRecursive(card, issuerValue.slice(5));
  }

  return true;
}

function cardMatchesRegion(card, value) {
  if (value === "all") return true;

  if (value.startsWith("region:")) {
    return (
      normalizeRegionValue(card.region) === normalizeRegionValue(value.slice(7))
    );
  }

  if (value.startsWith("province:")) {
    return (
      normalizeRegionValue(card.region) === "CN" &&
      normalizeProvinceValue(card.province) ===
        normalizeProvinceValue(value.slice(9))
    );
  }

  return true;
}

function buildSearchableText(card) {
  return [
    card.name,
    card.bin,
    card.issuer,
    card.bankNativeName,
    card.bankEnglishName,
    card.bankParent,
    card.organization,
    card.tier,
    card.region,
    card.province,
    card.bankTag,
    card.status,
    card.acquired,
    card.currency.join(" "),
    card.desc,
    card.benefit,
    card.annualFee,
    card.ftf,
    card.url,
  ]
    .join(" ")
    .toLowerCase();
}

function cardMatches(card) {
  const search = String(searchInput?.value || "")
    .trim()
    .toLowerCase();
  const type = typeFilter?.value || "all";
  const organization = organizationFilter?.value || "all";
  const status = statusFilter?.value || "all";

  return (
    (type === "all" || card.type === type) &&
    (organization === "all" ||
      normalizeOrganizationName(card.organization) === organization) &&
    (status === "all" || card.status === status) &&
    cardMatchesIssuer(card, issuerFilterValue) &&
    cardMatchesRegion(card, regionFilterValue) &&
    (!search || buildSearchableText(card).includes(search))
  );
}

function renderStats(filteredCards) {
  if (!statsRoot) return;
  statsRoot.innerHTML = "";

  TYPE_DEFINITIONS.forEach((type) => {
    const count = filteredCards.filter((card) => card.type === type.id).length;
    const item = document.createElement("div");
    item.className = "stat";
    item.dataset.target = type.id;
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `${type.label}分组`);
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
  const target = sectionRoot?.querySelector(`[data-section-id="${typeId}"]`);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCard(card) {
  const node = template.content.firstElementChild.cloneNode(true);
  const image = node.querySelector(".card-visual img");
  if (image) {
    image.alt = card.name;
    queueImageLoad(image, card.image);
  }

  const organizationBadge = node.querySelector(".card-organization-badge");
  if (organizationBadge) {
    if (card.organizationIcon) {
      organizationBadge.alt = card.organization || "";
      organizationBadge.hidden = false;
      queueImageLoad(organizationBadge, card.organizationIcon);
    } else {
      organizationBadge.alt = "";
      organizationBadge.hidden = true;
    }
  }

  const title = node.querySelector("h2");
  if (title) title.textContent = card.name;

  const statusNode = node.querySelector(".status");
  if (statusNode) {
    statusNode.textContent = card.status;
    statusNode.className = "status";
    const modifier = STATUS_CLASS[card.status];
    if (modifier) statusNode.classList.add(modifier);
  }

  const virtualBadge = node.querySelector(".virtual-badge");
  if (virtualBadge) {
    virtualBadge.hidden = !card.virtual;
    virtualBadge.textContent = card.virtual ? "虚拟卡" : "";
  }

  const binNode = node.querySelector('[data-field="bin"]');
  if (binNode) binNode.textContent = card.bin || "";

  const organizationNode = node.querySelector(
    '[data-field="organization-tier"]',
  );
  if (organizationNode) {
    organizationNode.textContent = formatOrganizationTier(card);
  }

  const issuerNode = node.querySelector('[data-field="issuer"]');
  if (issuerNode) {
    issuerNode.innerHTML = "";
    appendBankNameContent(issuerNode, card.issuer, card.bankLogoUrl, false);
  }

  const regionNode = node.querySelector('[data-field="region"]');
  if (regionNode) regionNode.textContent = card.region || "";

  const currencyNode = node.querySelector('[data-field="currency"]');
  if (currencyNode) {
    currencyNode.textContent = formatCurrencyList(card.currency) || "";
  }

  const acquiredNode = node.querySelector('[data-field="acquired"]');
  if (acquiredNode) {
    acquiredNode.textContent = formatAcquiredText(card.acquired);
  }

  node.addEventListener("click", () => openModal(card));
  node.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openModal(card);
    }
  });

  activateDeferredImages(node);
  return node;
}

function render() {
  if (!sectionRoot) return;

  const filteredCards = sortCards(cards.filter(cardMatches));
  renderStats(filteredCards);
  sectionRoot.innerHTML = "";

  TYPE_DEFINITIONS.forEach((type) => {
    const categoryCards = filteredCards.filter((card) => card.type === type.id);
    const section = document.createElement("section");
    section.dataset.sectionId = type.id;

    const heading = document.createElement("div");
    heading.className = "section-heading";

    const title = document.createElement("h2");
    title.textContent = type.label;

    const count = document.createElement("p");
    count.textContent = `${categoryCards.length} 张`;

    heading.append(title, count);
    section.append(heading);

    if (!categoryCards.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "暂无符合条件的卡片。";
      section.append(empty);
      sectionRoot.append(section);
      return;
    }

    const grid = document.createElement("div");
    grid.className = "card-grid";
    categoryCards.forEach((card) => {
      grid.append(renderCard(card));
    });
    section.append(grid);
    sectionRoot.append(section);
  });
}

function bindEvents() {
  [searchInput, typeFilter, organizationFilter, statusFilter].forEach(
    (control) => {
      if (!control) return;
      control.addEventListener("input", render);
      control.addEventListener("change", render);
    },
  );

  if (issuerFilterTrigger) {
    issuerFilterTrigger.addEventListener("click", () => {
      if (issuerFilterPanel?.hidden) {
        openIssuerFilterPanel();
      } else {
        closeIssuerFilterPanel();
      }
    });
  }

  if (regionFilterTrigger) {
    regionFilterTrigger.addEventListener("click", () => {
      if (regionFilterPanel?.hidden) {
        openRegionFilterPanel();
      } else {
        closeRegionFilterPanel();
      }
    });
  }

  document.addEventListener("click", (event) => {
    if (
      issuerFilterWrap &&
      event.target instanceof Node &&
      !issuerFilterWrap.contains(event.target)
    ) {
      closeIssuerFilterPanel();
    }

    if (
      regionFilterWrap &&
      event.target instanceof Node &&
      !regionFilterWrap.contains(event.target)
    ) {
      closeRegionFilterPanel();
    }
  });

  if (modal) {
    modal.addEventListener("click", (event) => {
      const target = event.target;
      if (target === modalImage || target === modalAltImage) {
        openLightbox(target);
        return;
      }
      if (target instanceof Element && target.closest("[data-close-modal]")) {
        closeModal();
      }
    });
  }

  if (imageLightbox) {
    imageLightbox.addEventListener("click", (event) => {
      const target = event.target;
      if (target === lightboxPrev) {
        switchLightboxImage(-1);
        return;
      }
      if (target === lightboxNext) {
        switchLightboxImage(1);
        return;
      }
      if (
        target instanceof Element &&
        target.closest("[data-close-lightbox]")
      ) {
        closeLightbox();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && imageLightbox && !imageLightbox.hidden) {
      closeLightbox();
      return;
    }
    if (event.key === "ArrowLeft" && imageLightbox && !imageLightbox.hidden) {
      switchLightboxImage(-1);
      return;
    }
    if (event.key === "ArrowRight" && imageLightbox && !imageLightbox.hidden) {
      switchLightboxImage(1);
      return;
    }
    if (event.key === "Escape" && modal && !modal.hidden) {
      closeModal();
    }
  });
}

async function init() {
  initializeStaticFilters();
  setIssuerFilterValue("all");
  setRegionFilterValue("all");
  updateOrganizationFilterOptions();
  updateIssuerFilterOptions();
  updateRegionFilterOptions();
  render();

  await loadCardsFromAssetsProgressively(mapCardEntry, {
    warn: true,
    onBatch(batch) {
      cards = sortCards(cards.concat(batch));
      updateOrganizationFilterOptions();
      updateIssuerFilterOptions();
      updateRegionFilterOptions();
      render();
    },
  });
}

bindEvents();
init();
