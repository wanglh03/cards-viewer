const TYPE_DEFINITIONS = [
  { id: "Debit", label: "借记卡" },
  { id: "Credit", label: "信用卡" },
  { id: "Prepaid", label: "预付卡" },
  { id: "Transit", label: "交通卡" },
];

const STATUS_LABELS = {
  active: "已激活",
  inactive: "未激活",
  expired: "过期",
  cancelled: "注销",
};

const STATUS_CLASS = {
  inactive: "is-muted",
  expired: "is-danger",
  cancelled: "is-danger",
};

const INITIAL_VISIBLE_COUNT = 4;

const BANK_TAG_ORDER = [
  "state",
  "stock",
  "city",
  "rural",
  "village",
  "foreign",
  "private",
  "digital",
  "others",
];

const BANK_TAG_LABELS = {
  state: "国有商行",
  stock: "全国性商行",
  city: "城商行",
  rural: "农商行",
  village: "村镇银行",
  foreign: "外资银行",
  private: "民营银行",
  digital: "数字银行",
  others: "其他",
};

const PROVINCE_QUERY_VALUES = {
  北京: "Beijing",
  天津: "Tianjin",
  河北: "Hebei",
  山西: "Shanxi",
  内蒙古: "Inner-Mongolia",
  辽宁: "Liaoning",
  吉林: "Jilin",
  黑龙江: "Heilongjiang",
  上海: "Shanghai",
  江苏: "Jiangsu",
  浙江: "Zhejiang",
  安徽: "Anhui",
  福建: "Fujian",
  江西: "Jiangxi",
  山东: "Shandong",
  河南: "Henan",
  湖北: "Hubei",
  湖南: "Hunan",
  广东: "Guangdong",
  广西: "Guangxi",
  海南: "Hainan",
  重庆: "Chongqing",
  四川: "Sichuan",
  贵州: "Guizhou",
  云南: "Yunnan",
  西藏: "Tibet",
  陕西: "Shaanxi",
  甘肃: "Gansu",
  青海: "Qinghai",
  宁夏: "Ningxia",
  新疆: "Xinjiang",
};

const REGION_DEFINITIONS = (
  window.__CARDS_VIEWER_DATA__?.regions?.continents || []
).flatMap((continent) =>
  (continent?.countries || []).filter((region) => region?.code),
);

let cards = [];
let issuerFilterValue = "all";
let issuerFilterHoverTag = "all";
let regionFilterValue = "all";
let regionFilterHoverRegion = "all";
let regionFilterHoverProvince = "";
let expandedTypeCounts = {};
let sortMode = "tier";
let cardViewMode = "all";
let lightboxImages = [];
let lightboxIndex = 0;
let pendingOrganizationFilterValue = "all";
let pendingIssuerFilterValue = "all";
let pendingRegionFilterValue = "all";
let initialDataLoaded = false;

const cardUtils = window.cardUtils || {};
const currencyUtils = window.currencyUtils || {};
const cardConfig = window.cardConfig || {};

const { TIER_ORDER_MAP, GLOBAL_TIER_ORDER } = cardConfig;

const {
  toArray,
  getBinOverlayText,
  loadCardsFromAssetsProgressively,
  compareText,
  formatBinDisplay,
  queueImageLoad,
  activateDeferredImages,
  createOption,
  appendBankNameContent,
  getTierAccentClass,
  getOrganizationRank,
  compareCardsByOrganizationAndTier,
  createCardBase,
} = cardUtils;

const { formatCurrencyList } = currencyUtils;

const sectionRoot = document.querySelector("#cardSections");
const statsRoot = document.querySelector("#stats");
const template = document.querySelector("#cardTemplate");
const modal = document.querySelector("#cardModal");
const modalImage = document.querySelector("#modalImage");
const modalAltImage = document.querySelector("#modalAltImage");
const modalTitle = document.querySelector("#modalTitle");
const modalLength = document.querySelector("#modalLength");
const modalStatus = document.querySelector("#modalStatus");
const modalVirtual = document.querySelector("#modalVirtual");
const modalApplyLink = document.querySelector("#modalApplyLink");
const modalGrid = document.querySelector("#modalGrid");
const modalDesc = document.querySelector("#modalDesc");
const modalDescSection = modalDesc?.closest(".modal-desc") || null;
const modalBenefitSection = document.querySelector("#modalBenefitSection");
const modalBenefit = document.querySelector("#modalBenefit");
const modalPanel = document.querySelector(".card-modal-panel");
const imageLightbox = document.querySelector("#imageLightbox");
const lightboxImage = document.querySelector("#lightboxImage");
const lightboxPrev = document.querySelector("[data-lightbox-prev]");
const lightboxNext = document.querySelector("[data-lightbox-next]");
const searchInput = document.querySelector("#searchInput");
const organizationFilter = document.querySelector("#organizationFilter");
const issuerFilterWrap = document.querySelector("#issuerFilterWrap");
const issuerFilterTrigger = document.querySelector("#issuerFilterTrigger");
const issuerFilterLabel = document.querySelector("#issuerFilterLabel");
const issuerFilterPanel = document.querySelector("#issuerFilterPanel");
const issuerFilterGroups = document.querySelector("#issuerFilterGroups");
const issuerFilterIssuers = document.querySelector("#issuerFilterIssuers");
const regionFilterWrap = document.querySelector("#regionFilterWrap");
const regionFilterTrigger = document.querySelector("#regionFilterTrigger");
const regionFilterLabel = document.querySelector("#regionFilterLabel");
const regionFilterPanel = document.querySelector("#regionFilterPanel");
const regionFilterGroups = document.querySelector("#regionFilterGroups");
const regionFilterProvinces = document.querySelector("#regionFilterProvinces");
const regionFilterIssuers = document.querySelector("#regionFilterIssuers");
const statusFilter = document.querySelector("#statusFilter");
const sortToggle = document.querySelector("#sortToggle");
const cardViewToggle = document.querySelector("#cardViewToggle");

function getProvinceQueryValue(value) {
  const normalized = value;
  return PROVINCE_QUERY_VALUES[normalized] || encodeURIComponent(normalized);
}

function parseProvinceQueryValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";

  const matched = Object.entries(PROVINCE_QUERY_VALUES).find(
    ([, queryValue]) => queryValue === text,
  );
  if (matched) return matched[0];

  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

function isKnownStatus(value) {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, value);
}

function getStatusLabel(value) {
  return STATUS_LABELS[value];
}

function parseStatusQueryValue(value) {
  const status = value;
  if (status === "all" || isKnownStatus(status)) return status;
  return "all";
}

function parseCardViewQueryValue(value) {
  return ["physical", "virtual"].includes(value) ? value : "all";
}

function parseSortQueryValue(value) {
  if (value === "default") return "tier";
  return ["organization", "acquired", "tier"].includes(value) ? value : "tier";
}

function createRegionBankValue(region, province, bank) {
  return `region-bank:${[region, province, bank]
    .map((value) => encodeURIComponent(value || ""))
    .join("|")}`;
}

function parseRegionBankValue(value) {
  if (!String(value || "").startsWith("region-bank:")) return null;
  const parts = value.slice(12).split("|");
  if (parts.length !== 3) return null;

  try {
    return {
      region: decodeURIComponent(parts[0]),
      province: decodeURIComponent(parts[1]),
      bank: decodeURIComponent(parts[2]),
    };
  } catch {
    return null;
  }
}

function getRegionQueryValue(value) {
  if (value === "all") return "all";
  if (value.startsWith("region-bank:")) {
    const parts = parseRegionBankValue(value);
    if (!parts?.region || !parts.bank) return "all";
    if (parts.region === "CN") {
      return `CN:${getProvinceQueryValue(parts.province)}:${encodeURIComponent(parts.bank)}`;
    }
    return `${parts.region}:${encodeURIComponent(parts.bank)}`;
  }
  if (value.startsWith("region:")) {
    return value.slice(7);
  }
  if (value.startsWith("province:")) {
    return `CN:${getProvinceQueryValue(value.slice(9))}`;
  }
  return value;
}

function parseRegionQueryValue(value) {
  const text = String(value || "").trim();
  if (!text || text === "all") return "all";
  const separatorIndex = text.indexOf(":");
  if (separatorIndex > 0) {
    const normalizedRegion = text.slice(0, separatorIndex);
    const details = text.slice(separatorIndex + 1).split(":");
    if (normalizedRegion === "CN") {
      const province = parseProvinceQueryValue(details[0]);
      if (details.length > 1) {
        try {
          return createRegionBankValue(
            "CN",
            province,
            decodeURIComponent(details.slice(1).join(":")),
          );
        } catch {
          return "all";
        }
      }
      return `province:${province}`;
    }
    if (/^[A-Za-z]{2}$/.test(normalizedRegion) && details[0]) {
      try {
        return createRegionBankValue(
          normalizedRegion,
          "",
          decodeURIComponent(details.join(":")),
        );
      } catch {
        return "all";
      }
    }
  }
  if (/^[A-Za-z]{2}$/.test(text)) {
    return `region:${text}`;
  }
  return "all";
}

function getGlobalTierRank(tier) {
  const normalizedTier = tier;
  const index = GLOBAL_TIER_ORDER.findIndex((tierGroup) =>
    tierGroup.includes(normalizedTier),
  );
  return index === -1 ? GLOBAL_TIER_ORDER.length : index;
}

function getBankTagRank(tag) {
  const index = BANK_TAG_ORDER.indexOf(tag);
  return index === -1 ? BANK_TAG_ORDER.length : index;
}

function getBankTagLabel(tag) {
  return BANK_TAG_LABELS[tag] || BANK_TAG_LABELS["others"];
}

function getRegionRank(region) {
  const index = REGION_DEFINITIONS.findIndex((item) => item.code === region);
  return index === -1 ? REGION_DEFINITIONS.length : index;
}

function getRegionLabel(region) {
  const definition = REGION_DEFINITIONS.find((item) => item.code === region);
  return definition?.name_zh || definition?.name || region || "-";
}

function getUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get("search") || "",
    organization: params.get("organization") || "all",
    issuer: params.get("issuer") || "all",
    region: parseRegionQueryValue(params.get("region") || "all"),
    status: parseStatusQueryValue(params.get("status") || "all"),
    sort: parseSortQueryValue(params.get("sort") || "tier"),
    cardView: parseCardViewQueryValue(params.get("cardView") || "all"),
  };
}

function updateUrlState() {
  const params = new URLSearchParams();
  const search = String(searchInput?.value || "").trim();
  const organizationOptionsLoaded = getOrganizationOptions().length > 0;
  const organization =
    organizationOptionsLoaded || pendingOrganizationFilterValue === "all"
      ? organizationFilter?.value || "all"
      : pendingOrganizationFilterValue || "all";
  const status = statusFilter?.value || "all";

  if (search) params.set("search", search);
  if (issuerFilterValue !== "all") params.set("issuer", issuerFilterValue);
  if (organization !== "all") params.set("organization", organization);
  if (regionFilterValue !== "all") {
    params.set("region", getRegionQueryValue(regionFilterValue));
  }
  if (status !== "all") params.set("status", status);
  if (sortMode !== "tier") params.set("sort", sortMode);
  if (cardViewMode !== "all") params.set("cardView", cardViewMode);

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

function applyUrlState(state = getUrlState()) {
  if (searchInput) searchInput.value = state.search;

  pendingOrganizationFilterValue = state.organization || "all";
  pendingIssuerFilterValue = state.issuer || "all";
  pendingRegionFilterValue = state.region || "all";

  if (statusFilter) {
    statusFilter.value = parseStatusQueryValue(state.status);
  }

  sortMode = parseSortQueryValue(state.sort);
  cardViewMode = parseCardViewQueryValue(state.cardView);

  issuerFilterValue = pendingIssuerFilterValue;
  if (issuerFilterValue.startsWith("tag:")) {
    issuerFilterHoverTag = issuerFilterValue.slice(4);
  } else if (issuerFilterValue === "all") {
    issuerFilterHoverTag = "all";
  }
  if (issuerFilterLabel) {
    issuerFilterLabel.textContent = getIssuerDisplayText(issuerFilterValue);
  }

  regionFilterValue = pendingRegionFilterValue;
  const regionBank = parseRegionBankValue(regionFilterValue);
  if (regionBank) {
    regionFilterHoverRegion = regionBank.region;
    regionFilterHoverProvince = regionBank.province;
  } else if (regionFilterValue.startsWith("region:")) {
    regionFilterHoverRegion = regionFilterValue.slice(7);
    regionFilterHoverProvince = "";
  } else if (regionFilterValue.startsWith("province:")) {
    regionFilterHoverRegion = "CN";
    regionFilterHoverProvince = regionFilterValue.slice(9);
  } else {
    regionFilterHoverRegion = "all";
    regionFilterHoverProvince = "";
  }
  if (regionFilterLabel) {
    regionFilterLabel.textContent = getRegionDisplayText(regionFilterValue);
  }
}

function initializeStaticFilters() {
  if (statusFilter) {
    statusFilter.innerHTML = "";
    statusFilter.append(
      createOption("all", "全部状态"),
      ...Object.entries(STATUS_LABELS).map(([value, label]) =>
        createOption(value, label),
      ),
    );
  }

  if (organizationFilter) {
    organizationFilter.innerHTML = "";
    organizationFilter.append(createOption("all", "全部卡组织"));
  }

  if (issuerFilterLabel) {
    issuerFilterLabel.textContent = "全部";
  }

  if (regionFilterLabel) {
    regionFilterLabel.textContent = "全部";
  }
}

function mapCardEntry(bankKey, bankInfo, entry) {
  const cardMeta = entry.card || entry;
  const type = cardMeta.type;

  const baseCard = createCardBase(bankKey, bankInfo, cardMeta, {
    organization: cardMeta.organization,
  });
  const currency = cardMeta.currency;
  const statusKey = cardMeta.status;

  return {
    ...baseCard,
    bankTag: bankInfo.tag,
    bankNativeName: bankInfo.native_name,
    bankEnglishName: bankInfo.english_name || bankKey,
    bankParent: bankInfo.parent,
    bankWebsiteUrl: bankInfo.url,
    type,
    province: bankInfo.province,
    status: statusKey,
    virtual: cardMeta.virtual === true,
    acquired: cardMeta.acquired,
    branch: cardMeta.branch,
    currency,
    desc: String(cardMeta.desc || ""),
    benefit: String(cardMeta.benefit || ""),
    annualFee: cardMeta.annual_fee,
    ftf: cardMeta.ftf,
    url: cardMeta.url,
  };
}

function getBankOptionValue(card) {
  return card.bankEnglishName || card.bankKey;
}

function getParentMap() {
  const parentMap = new Map();

  cards.forEach((card) => {
    const child = getBankOptionValue(card);
    const parent = card.bankParent;
    if (!child || !parent || parentMap.has(child)) return;
    parentMap.set(child, parent);
  });

  return parentMap;
}

function bankMatchesRecursive(card, bankValue) {
  const current = getBankOptionValue(card);
  const target = bankValue;
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
      bankTag: card.bankTag,
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const tagDiff = getBankTagRank(a.bankTag) - getBankTagRank(b.bankTag);
    if (tagDiff !== 0) return tagDiff;
    return compareText(a.label, b.label);
  });
}

function getIssuerOptionsByTag(tag) {
  return getIssuerOptions().filter((option) => option.bankTag === tag);
}

function getIssuerDisplayText(value) {
  if (value === "all") return "全部";
  if (value.startsWith("tag:")) {
    return getBankTagLabel(value.slice(4));
  }
  if (value.startsWith("bank:")) {
    const bankValue = value.slice(5);
    const match = getIssuerOptions().find(
      (option) => option.value === bankValue,
    );
    return match?.label || "全部";
  }
  return "全部";
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

function renderIssuerFilterIssuers(activeTag) {
  if (!issuerFilterIssuers) return;
  issuerFilterIssuers.innerHTML = "";

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
    issuerFilterIssuers.append(button);
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
  allButton.textContent = `全部 (${issuerOptions.length})`;
  allButton.addEventListener("mouseenter", () => {
    issuerFilterHoverTag = "all";
    updateIssuerGroupState();
    renderIssuerFilterIssuers("all");
  });
  allButton.addEventListener("focus", () => {
    issuerFilterHoverTag = "all";
    updateIssuerGroupState();
    renderIssuerFilterIssuers("all");
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
      renderIssuerFilterIssuers(tag);
    });
    button.addEventListener("focus", () => {
      issuerFilterHoverTag = tag;
      updateIssuerGroupState();
      renderIssuerFilterIssuers(tag);
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
  } else if (!initialDataLoaded) {
    issuerFilterValue = nextValue;
    if (nextValue.startsWith("tag:")) {
      issuerFilterHoverTag = nextValue.slice(4);
    } else if (nextValue.startsWith("bank:")) {
      issuerFilterHoverTag = "all";
    } else {
      issuerFilterHoverTag = "all";
    }
  } else if (nextValue.startsWith("tag:")) {
    const tag = nextValue.slice(4);
    const exists = getIssuerOptionsByTag(tag).length > 0;
    issuerFilterValue = exists ? nextValue : "all";
    issuerFilterHoverTag = exists ? tag : "all";
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
  const currentValue = pendingIssuerFilterValue || issuerFilterValue;
  setIssuerFilterValue(currentValue);
  pendingIssuerFilterValue = issuerFilterValue;
  renderIssuerFilterGroups();
  renderIssuerFilterIssuers(issuerFilterHoverTag);
}

function openIssuerFilterPanel() {
  if (!issuerFilterPanel || !issuerFilterTrigger) return;
  closeRegionFilterPanel();
  renderIssuerFilterGroups();
  renderIssuerFilterIssuers(issuerFilterHoverTag);
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
    const value = card.region;
    if (!value) return;
    const current = map.get(value) || {
      value,
      label: getRegionLabel(value),
      bankValues: new Set(),
    };
    const bankValue = getBankOptionValue(card);
    if (bankValue) current.bankValues.add(bankValue);
    map.set(value, current);
  });

  return Array.from(map.values())
    .map(({ bankValues, ...option }) => ({
      ...option,
      count: bankValues.size,
    }))
    .sort((a, b) => {
      const rankDiff = getRegionRank(a.value) - getRegionRank(b.value);
      if (rankDiff !== 0) return rankDiff;
      return compareText(a.label, b.label);
    });
}

function getProvinceOptions() {
  const map = new Map();

  cards.forEach((card) => {
    if (card.region !== "CN") return;
    const value = card.province;
    if (!value) return;
    const current = map.get(value) || {
      value,
      label: value,
      bankValues: new Set(),
    };
    const bankValue = getBankOptionValue(card);
    if (bankValue) current.bankValues.add(bankValue);
    map.set(value, current);
  });

  return Array.from(map.values())
    .map(({ bankValues, ...option }) => ({
      ...option,
      count: bankValues.size,
    }))
    .sort((a, b) => compareText(a.label, b.label));
}

function getRegionDisplayText(value) {
  if (value === "all") return "全部";
  const regionBank = parseRegionBankValue(value);
  if (regionBank) {
    const options = getRegionBankOptions(
      regionBank.region,
      regionBank.province,
    );
    const bank = options.find((option) => option.value === regionBank.bank);
    const bankLabel = bank?.label || regionBank.bank;
    if (regionBank.region === "CN") {
      return regionBank.province
        ? `中国大陆 / ${regionBank.province} / ${bankLabel}`
        : `中国大陆 / ${bankLabel}`;
    }
    return `${getRegionLabel(regionBank.region)} / ${bankLabel}`;
  }
  if (value.startsWith("region:")) {
    return getRegionLabel(value.slice(7));
  }
  if (value.startsWith("province:")) {
    const province = value.slice(9);
    return province ? `中国大陆 / ${province}` : "中国大陆";
  }
  return "全部";
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
        (region === "CN" &&
          (regionFilterValue.startsWith("province:") ||
            parseRegionBankValue(regionFilterValue)?.region === "CN"));
      button.classList.toggle("is-active", active);
    });
}

function getRegionBankOptions(region, province = "") {
  const map = new Map();
  const normalizedRegion = region;
  const normalizedProvince = province;

  cards.forEach((card) => {
    if (card.region !== normalizedRegion) return;
    if (
      normalizedRegion === "CN" &&
      province &&
      card.province !== normalizedProvince
    ) {
      return;
    }

    const value = getBankOptionValue(card);
    if (!value) return;
    const current = map.get(value) || {
      value,
      label: card.bankNativeName || card.bankEnglishName || value,
      logoUrl: card.bankLogoUrl || "",
      count: 0,
    };
    current.count += 1;
    if (!current.logoUrl && card.bankLogoUrl) {
      current.logoUrl = card.bankLogoUrl;
    }
    map.set(value, current);
  });

  return Array.from(map.values()).sort((a, b) => compareText(a.label, b.label));
}

function renderRegionFilterBankItems(
  container,
  options,
  region,
  province = "",
) {
  if (!container) return;
  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "issuer-filter-bank-item";
    button.dataset.value = createRegionBankValue(
      region,
      province,
      option.value,
    );
    appendBankNameContent(button, option.label, option.logoUrl, true);
    button.classList.toggle(
      "is-active",
      regionFilterValue === button.dataset.value,
    );
    button.addEventListener("click", () => {
      setRegionFilterValue(button.dataset.value);
      closeRegionFilterPanel();
      render();
    });
    container.append(button);
  });
}

function renderRegionFilterIssuers(activeRegion, activeProvince = "") {
  if (!regionFilterIssuers) return;
  regionFilterIssuers.innerHTML = "";

  const visible = activeRegion === "CN" && Boolean(activeProvince);
  regionFilterIssuers.hidden = !visible;
  regionFilterPanel?.classList.toggle("has-region-issuers", visible);
  if (!visible) return;
  renderRegionFilterBankItems(
    regionFilterIssuers,
    getRegionBankOptions(activeRegion, activeProvince),
    activeRegion,
    activeProvince,
  );
}

function renderRegionFilterProvinces(activeRegion) {
  if (!regionFilterProvinces) return;
  regionFilterProvinces.innerHTML = "";

  if (activeRegion !== "CN") {
    if (activeRegion && activeRegion !== "all") {
      renderRegionFilterBankItems(
        regionFilterProvinces,
        getRegionBankOptions(activeRegion),
        activeRegion,
      );
    }
    return;
  }

  getProvinceOptions().forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "issuer-filter-bank-item";
    button.dataset.value = `province:${option.value}`;
    button.textContent = `${option.label} (${option.count})`;
    button.classList.toggle(
      "is-active",
      regionFilterValue === button.dataset.value ||
        parseRegionBankValue(regionFilterValue)?.province === option.value,
    );
    const showIssuers = () => {
      regionFilterHoverProvince = option.value;
      renderRegionFilterIssuers("CN", option.value);
    };
    button.addEventListener("mouseenter", showIssuers);
    button.addEventListener("focus", showIssuers);
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
  const totalCount = new Set(
    cards.map((card) => getBankOptionValue(card)).filter(Boolean),
  ).size;

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "issuer-filter-item";
  allButton.dataset.region = "all";
  allButton.textContent = `全部 (${totalCount})`;
  allButton.addEventListener("mouseenter", () => {
    regionFilterHoverRegion = "all";
    regionFilterHoverProvince = "";
    updateRegionGroupState();
    renderRegionFilterProvinces("all");
    renderRegionFilterIssuers("all");
  });
  allButton.addEventListener("focus", () => {
    regionFilterHoverRegion = "all";
    regionFilterHoverProvince = "";
    updateRegionGroupState();
    renderRegionFilterProvinces("all");
    renderRegionFilterIssuers("all");
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
      renderRegionFilterIssuers(option.value, regionFilterHoverProvince);
    });
    button.addEventListener("focus", () => {
      regionFilterHoverRegion = option.value;
      updateRegionGroupState();
      renderRegionFilterProvinces(option.value);
      renderRegionFilterIssuers(option.value, regionFilterHoverProvince);
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
  const regionBank = parseRegionBankValue(nextValue);

  if (nextValue === "all") {
    regionFilterValue = "all";
    regionFilterHoverRegion = "all";
    regionFilterHoverProvince = "";
  } else if (!initialDataLoaded) {
    regionFilterValue = nextValue;
    if (regionBank) {
      regionFilterHoverRegion = regionBank.region;
      regionFilterHoverProvince = regionBank.province;
    } else if (nextValue.startsWith("region:")) {
      regionFilterHoverRegion = nextValue.slice(7);
      regionFilterHoverProvince = "";
    } else if (nextValue.startsWith("province:")) {
      regionFilterHoverRegion = "CN";
      regionFilterHoverProvince = nextValue.slice(9);
    } else {
      regionFilterHoverRegion = "all";
      regionFilterHoverProvince = "";
    }
  } else if (regionBank) {
    const exists = getRegionBankOptions(
      regionBank.region,
      regionBank.province,
    ).some((option) => option.value === regionBank.bank);
    if (exists) {
      regionFilterValue = createRegionBankValue(
        regionBank.region,
        regionBank.province,
        regionBank.bank,
      );
      regionFilterHoverRegion = regionBank.region;
      regionFilterHoverProvince = regionBank.province;
    } else {
      regionFilterValue = "all";
      regionFilterHoverRegion = "all";
      regionFilterHoverProvince = "";
    }
  } else if (nextValue.startsWith("region:")) {
    const region = nextValue.slice(7);
    const exists = regionOptions.some((option) => option.value === region);
    regionFilterValue = exists ? `region:${region}` : "all";
    regionFilterHoverRegion = exists ? region : "all";
    regionFilterHoverProvince = "";
  } else if (nextValue.startsWith("province:")) {
    const province = nextValue.slice(9);
    const exists = provinceOptions.some((option) => option.value === province);
    if (exists) {
      regionFilterValue = `province:${province}`;
      regionFilterHoverRegion = "CN";
      regionFilterHoverProvince = province;
    } else {
      regionFilterValue = "all";
      regionFilterHoverRegion = "all";
      regionFilterHoverProvince = "";
    }
  } else {
    regionFilterValue = "all";
    regionFilterHoverRegion = "all";
    regionFilterHoverProvince = "";
  }

  if (regionFilterLabel) {
    regionFilterLabel.textContent = getRegionDisplayText(regionFilterValue);
  }
}

function updateRegionFilterOptions() {
  const currentValue = pendingRegionFilterValue || regionFilterValue;
  setRegionFilterValue(currentValue);
  pendingRegionFilterValue = regionFilterValue;
  renderRegionFilterGroups();
  renderRegionFilterProvinces(regionFilterHoverRegion);
  renderRegionFilterIssuers(regionFilterHoverRegion, regionFilterHoverProvince);
}

function openRegionFilterPanel() {
  if (!regionFilterPanel || !regionFilterTrigger) return;
  closeIssuerFilterPanel();
  renderRegionFilterGroups();
  renderRegionFilterProvinces(regionFilterHoverRegion);
  renderRegionFilterIssuers(regionFilterHoverRegion, regionFilterHoverProvince);
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
    const organization = card.organization;
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
  const currentValue =
    pendingOrganizationFilterValue || organizationFilter.value || "all";
  const options = getOrganizationOptions();

  organizationFilter.innerHTML = "";
  organizationFilter.append(createOption("all", "全部卡组织"));
  options.forEach((item) => {
    organizationFilter.append(createOption(item, item));
  });

  if (
    !initialDataLoaded &&
    currentValue !== "all" &&
    !options.includes(currentValue)
  ) {
    pendingOrganizationFilterValue = currentValue;
    return;
  }

  organizationFilter.value = options.includes(currentValue)
    ? currentValue
    : "all";
  pendingOrganizationFilterValue = organizationFilter.value;
}

function compareCards(a, b) {
  return compareCardsByOrganizationAndTier(a, b, {
    tierOrderMap: TIER_ORDER_MAP,
  });
}

function compareAcquiredDesc(a, b) {
  const acquiredA = a.acquired;
  const acquiredB = b.acquired;

  if (acquiredA && acquiredB) {
    const acquiredDiff = compareText(acquiredB, acquiredA);
    if (acquiredDiff !== 0) return acquiredDiff;
  } else if (acquiredA) {
    return -1;
  } else if (acquiredB) {
    return 1;
  }

  return compareCards(a, b);
}

function compareTier(a, b) {
  const tierDiff = getGlobalTierRank(a.tier) - getGlobalTierRank(b.tier);
  if (tierDiff !== 0) return tierDiff;

  const organizationDiff =
    getOrganizationRank(a.organization) - getOrganizationRank(b.organization);
  if (organizationDiff !== 0) return organizationDiff;

  const issuerDiff = compareText(a.issuer, b.issuer);
  if (issuerDiff !== 0) return issuerDiff;

  return compareText(a.name, b.name);
}

function sortCards(list) {
  const comparator =
    sortMode === "acquired"
      ? compareAcquiredDesc
      : sortMode === "tier"
        ? compareTier
        : compareCards;
  return list.slice().sort(comparator);
}

function updateSortToggleState() {
  if (!sortToggle) return;
  sortToggle.querySelectorAll("[data-sort-mode]").forEach((button) => {
    const active = button.dataset.sortMode === sortMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function updateCardViewToggleState() {
  if (!cardViewToggle) return;
  cardViewToggle.querySelectorAll("[data-card-view]").forEach((button) => {
    const active = button.dataset.cardView === cardViewMode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function formatOrganizationTier(card) {
  const parts = [];
  parts.push(card.organization);
  if (card.tier) parts.push(card.tier);
  parts.push(card.type);
  return parts.join(" ");
}

function formatRegionText(card) {
  const region = card.region;
  if (!region) return "";
  if (region === "CN") {
    const province = card.province;
    return province
      ? `${getRegionLabel(region)} / ${province}`
      : getRegionLabel(region);
  }
  return getRegionLabel(region);
}

function formatAcquiredText(value) {
  return value ? `取得时间：${value}` : "";
}

function formatAcquiredDetail(card) {
  const lines = [];
  if (card.branch) lines.push(card.branch);
  if (card.acquired) lines.push(card.acquired);
  return lines.join("\n") || "-";
}

function formatMultilineText(value) {
  return String(value || "").replace(/\\n/g, "\n");
}

function formatBenefitText(card) {
  const lines = [];
  if (card.annualFee) lines.push(`年费：${card.annualFee}`);
  if (card.ftf) lines.push(`FTF: ${card.ftf}`);

  const benefitText = formatMultilineText(card.benefit);
  if (benefitText) lines.push(benefitText);

  return lines.join("\n");
}

function getSummaryFields(card) {
  return [
    { label: "卡 BIN", value: formatBinDisplay(card.bin) },
    {
      label: "卡组织 / 等级 / 类型",
      value: formatOrganizationTier(card),
    },
    {
      label: "发行方",
      value: card.issuer || "-",
      logoUrl: card.bankLogoUrl || "",
      href: card.bankWebsiteUrl || "",
      rich: "bank",
    },
    { label: "区域", value: card.region || "-" },
    {
      label: "结算货币",
      value: formatCurrencyList(card.currency),
    },
    {
      label: "取得分行与时间",
      value: formatAcquiredDetail(card),
      multiline: true,
    },
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

  if (modalLength) {
    const configuredLength = String(card.length || "").trim();
    modalLength.textContent = configuredLength
      ? `${configuredLength}位`
      : `${card.organization === "AMEX" ? 15 : 16}位`;
  }

  if (modalPanel) {
    const overlayText = getBinOverlayText(card.bin);
    if (overlayText) {
      modalPanel.dataset.overlayText = overlayText;
      modalPanel.classList.add("card-modal-panel-overlay");
    } else {
      delete modalPanel.dataset.overlayText;
      modalPanel.classList.remove("card-modal-panel-overlay");
    }
  }

  if (modalStatus) {
    modalStatus.textContent = getStatusLabel(card.status);
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
          contentRoot.className = "modal-bank-link external-link";
        }
        appendBankNameContent(contentRoot, item.value, item.logoUrl, true);
        if (item.href) {
          dd.append(contentRoot);
        }
      } else {
        dd.textContent = item.value;
        if (item.multiline) {
          dd.style.whiteSpace = "pre-line";
        }
      }
      wrapper.append(dt, dd);
      modalGrid.append(wrapper);
    });
  }

  if (modalDesc && modalDescSection) {
    const descText = formatMultilineText(card.desc);
    modalDesc.textContent = descText;
    modalDescSection.hidden = !descText;
  }

  if (modalBenefit && modalBenefitSection) {
    const benefitText = formatBenefitText(card);
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
  if (modalPanel) {
    delete modalPanel.dataset.overlayText;
    modalPanel.classList.remove("card-modal-panel-overlay");
  }
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
}

function closeLightbox() {
  if (!imageLightbox || !lightboxImage) return;
  imageLightbox.hidden = true;
  lightboxImage.src = "";
  lightboxImage.alt = "";
  lightboxImages = [];
  lightboxIndex = 0;
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
    return card.bankTag === issuerValue.slice(4);
  }

  if (issuerValue.startsWith("bank:")) {
    return bankMatchesRecursive(card, issuerValue.slice(5));
  }

  return true;
}

function cardMatchesRegion(card, value) {
  if (value === "all") return true;

  const regionBank = parseRegionBankValue(value);
  if (regionBank) {
    return (
      card.region === regionBank.region &&
      (regionBank.region !== "CN" || card.province === regionBank.province) &&
      bankMatchesRecursive(card, regionBank.bank)
    );
  }

  if (value.startsWith("region:")) {
    return card.region === value.slice(7);
  }

  if (value.startsWith("province:")) {
    return card.region === "CN" && card.province === value.slice(9);
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
    getStatusLabel(card.status),
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
  const organization = organizationFilter?.value || "all";
  const status = statusFilter?.value || "all";
  const cardViewMatches =
    cardViewMode === "all" ||
    (cardViewMode === "virtual" ? card.virtual : !card.virtual);

  return (
    (organization === "all" || card.organization === organization) &&
    (status === "all" || card.status === status) &&
    cardViewMatches &&
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
  const body = node.querySelector(".card-body");
  const image = node.querySelector(".card-visual img");
  if (image) {
    image.alt = card.name;
    queueImageLoad(image, card.image);
  }

  if (body) {
    body.classList.add(getTierAccentClass(card.tier, "tier-accent-none"));
    const overlayText = getBinOverlayText(card.bin);
    if (overlayText) {
      body.dataset.overlayText = overlayText;
      body.classList.add("card-body-overlay");
    }
  }

  const organizationBadge = node.querySelector(".card-organization-badge");
  if (organizationBadge) {
    if (card.organizationIcon) {
      organizationBadge.alt = card.organization;
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
    statusNode.textContent = getStatusLabel(card.status);
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
  if (binNode) binNode.textContent = formatBinDisplay(card.bin);

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
    currencyNode.textContent = formatCurrencyList(card.currency);
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

function getVisibleCountForType(typeId) {
  return Math.max(
    INITIAL_VISIBLE_COUNT,
    Number(expandedTypeCounts[typeId]) || INITIAL_VISIBLE_COUNT,
  );
}

function createShowMoreActions(typeId, totalCount) {
  const wrap = document.createElement("div");
  wrap.className = "show-more-wrap";

  const moreButton = document.createElement("button");
  moreButton.type = "button";
  moreButton.className = "show-more-button";
  moreButton.textContent = "展示更多";
  moreButton.addEventListener("click", () => {
    expandedTypeCounts[typeId] = Math.min(
      totalCount,
      getVisibleCountForType(typeId) + INITIAL_VISIBLE_COUNT,
    );
    render();
  });

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "show-more-button";
  allButton.textContent = "展示全部";
  allButton.addEventListener("click", () => {
    expandedTypeCounts[typeId] = totalCount;
    render();
  });

  wrap.append(moreButton, allButton);
  return wrap;
}
function render() {
  if (!sectionRoot) return;
  pendingIssuerFilterValue = issuerFilterValue;
  pendingRegionFilterValue = regionFilterValue;
  updateUrlState();

  const filteredCards = sortCards(cards.filter(cardMatches));
  renderStats(filteredCards);
  sectionRoot.innerHTML = "";

  TYPE_DEFINITIONS.forEach((type) => {
    const categoryCards = filteredCards.filter((card) => card.type === type.id);
    const visibleCount = getVisibleCountForType(type.id);
    const visibleCards = categoryCards.slice(0, visibleCount);
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
    visibleCards.forEach((card) => {
      grid.append(renderCard(card));
    });
    section.append(grid);

    if (categoryCards.length > visibleCards.length) {
      section.append(createShowMoreActions(type.id, categoryCards.length));
    }

    sectionRoot.append(section);
  });
}

function bindEvents() {
  [searchInput, organizationFilter, statusFilter].forEach((control) => {
    if (!control) return;
    control.addEventListener("input", render);
    control.addEventListener("change", render);
  });

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

  if (sortToggle) {
    sortToggle.querySelectorAll("[data-sort-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = parseSortQueryValue(button.dataset.sortMode);
        if (nextMode === sortMode) return;
        sortMode = nextMode;
        updateSortToggleState();
        render();
      });
    });
  }

  if (cardViewToggle) {
    cardViewToggle.querySelectorAll("[data-card-view]").forEach((button) => {
      button.addEventListener("click", () => {
        const nextMode = parseCardViewQueryValue(button.dataset.cardView);
        if (nextMode === cardViewMode) return;
        cardViewMode = nextMode;
        updateCardViewToggleState();
        render();
      });
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
  initialDataLoaded = false;
  initializeStaticFilters();
  applyUrlState();
  setIssuerFilterValue(issuerFilterValue);
  setRegionFilterValue(regionFilterValue);
  updateOrganizationFilterOptions();
  updateIssuerFilterOptions();
  updateRegionFilterOptions();
  updateSortToggleState();
  updateCardViewToggleState();
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

  initialDataLoaded = true;
  updateOrganizationFilterOptions();
  updateIssuerFilterOptions();
  updateRegionFilterOptions();
  render();
}

bindEvents();
window.addEventListener("popstate", () => {
  applyUrlState();
  updateOrganizationFilterOptions();
  updateIssuerFilterOptions();
  updateRegionFilterOptions();
  updateSortToggleState();
  updateCardViewToggleState();
  render();
});
init();
