(() => {
  const TYPE_OPTIONS = ["Debit", "Credit", "Prepaid", "Transit"];
  const CURRENCY_OPTIONS = [
    "CNY",
    "HKD",
    "USD",
    "EUR",
    "GBP",
    "JPY",
    "AUD",
    "CAD",
    "CHF",
    "INR",
    "KRW",
    "MYR",
    "NZD",
    "SGD",
    "THB",
    "TWD",
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

  const data = window.__CARDS_VIEWER_DATA__ || {};
  const cardUtils = window.cardUtils || {};
  const cardConfig = window.cardConfig || {};
  const {
    compareText,
    createCardBase,
    formatBinDisplay,
    fetchJsonSafe,
    getOrganizationRank,
    getTierAccentClass,
    compareCardsByOrganizationAndTier,
    appendBankNameContent,
  } = cardUtils;
  const { TIER_ORDER_MAP = {}, ORGANIZATIONS = [] } = cardConfig;

  const cards = [];
  let searchValue = "";
  let issuerValue = "all";
  let issuerHoverTag = "all";
  let regionFilterValue = "all";
  let regionFilterHoverRegion = "all";
  let regionFilterHoverProvince = "";
  let currentPage = 1;
  let pageSize = 12;
  let issuerInputValid = false;

  const searchInput = document.querySelector("#gallerySearchInput");
  const organizationFilter = document.querySelector(
    "#galleryOrganizationFilter",
  );
  const typeFilter = document.querySelector("#galleryTypeFilter");
  const issuerWrap = document.querySelector("#galleryIssuerFilterWrap");
  const issuerTrigger = document.querySelector("#galleryIssuerFilterTrigger");
  const issuerLabel = document.querySelector("#galleryIssuerFilterLabel");
  const issuerPanel = document.querySelector("#galleryIssuerFilterPanel");
  const issuerGroups = document.querySelector("#galleryIssuerFilterGroups");
  const issuerList = document.querySelector("#galleryIssuerFilterIssuers");
  const regionWrap = document.querySelector("#galleryRegionFilterWrap");
  const regionTrigger = document.querySelector("#galleryRegionFilterTrigger");
  const regionLabel = document.querySelector("#galleryRegionFilterLabel");
  const regionPanel = document.querySelector("#galleryRegionFilterPanel");
  const regionGroups = document.querySelector("#galleryRegionFilterGroups");
  const regionProvinces = document.querySelector(
    "#galleryRegionFilterProvinces",
  );
  const regionIssuers = document.querySelector("#galleryRegionFilterIssuers");
  const grid = document.querySelector("#galleryGrid");
  const empty = document.querySelector("#galleryEmpty");
  const stats = document.querySelector("#galleryStats");
  const fileStats = document.querySelector("#galleryFileStats");
  const previousPage = document.querySelector("#galleryPreviousPage");
  const nextPage = document.querySelector("#galleryNextPage");
  const pageLabel = document.querySelector("#galleryPageLabel");
  const pageSizeSelect = document.querySelector("#galleryPageSize");
  const editor = document.querySelector("#galleryEditor");
  const editorForm = document.querySelector("#galleryEditorForm");
  const editorImage = document.querySelector("#galleryEditorImage");
  const editorTitle = document.querySelector("#galleryEditorTitle");
  const editorStatus = document.querySelector("#galleryEditorStatus");
  const editorSave = document.querySelector("#galleryEditorSave");
  const editorCurrency = document.querySelector("#galleryEditorCurrency");
  const issuerInput = document.querySelector("#galleryEditorIssuer");
  const issuerSuggestions = document.querySelector(
    "#galleryEditorIssuerSuggestions",
  );
  const turnstileContainer = document.querySelector("#galleryTurnstile");
  const lightbox = document.querySelector("#galleryLightbox");
  const lightboxImage = document.querySelector("#galleryLightboxImage");
  const lightboxMeta = document.querySelector("#galleryLightboxMeta");
  const lightboxPrevious = document.querySelector("#galleryLightboxPrevious");
  const lightboxNext = document.querySelector("#galleryLightboxNext");
  let editingCard = null;
  let turnstileSiteKey = turnstileContainer?.dataset.sitekey || "";
  let turnstileWidgetId = null;
  let turnstileToken = "";
  let pendingSave = false;
  let lightboxCard = null;
  let lightboxSources = [];
  let lightboxIndex = 0;

  const REGION_DEFINITIONS = (data.regions?.continents || []).flatMap(
    (continent) =>
      (continent?.countries || []).filter((region) => region?.code),
  );
  const regionLabels = new Map(
    REGION_DEFINITIONS.map((region) => [
      region.code,
      region.name_zh || region.name || region.code,
    ]),
  );

  function normalizeIssuerInfo(value) {
    let info = value;
    for (const key of ["issuerInfo", "issuers"]) {
      if (
        info &&
        typeof info === "object" &&
        !Array.isArray(info) &&
        info[key]
      ) {
        info = info[key];
      }
    }
    return info && typeof info === "object" && !Array.isArray(info) ? info : {};
  }

  function normalizeType(value) {
    const text = String(value || "").trim();
    return (
      TYPE_OPTIONS.find((type) => type.toLowerCase() === text.toLowerCase()) ||
      text
    );
  }

  function mapIssuerCards(info) {
    for (const [bankKey, issuerData] of Object.entries(info)) {
      if (!issuerData?.bank || !Array.isArray(issuerData.cards)) continue;
      const bankInfo = issuerData.bank;
      issuerData.cards.forEach((entry, cardIndex) => {
        const cardMeta = entry?.card || entry;
        if (!cardMeta || !cardMeta.name) return;
        const base = createCardBase(bankKey, bankInfo, cardMeta, {
          organization: cardMeta.organization,
        });
        cards.push({
          ...base,
          issuer: cardMeta.issuer || base.issuer,
          bankTag: bankInfo.tag,
          bankNativeName: bankInfo.native_name || "",
          bankEnglishName: bankInfo.english_name || bankKey,
          bankParent: bankInfo.parent || "",
          bankWebsiteUrl: bankInfo.url || "",
          province: bankInfo.province || "",
          type: normalizeType(cardMeta.type),
          cardIndex,
          desc: String(cardMeta.desc || ""),
          benefit: String(cardMeta.benefit || ""),
          ftf: cardMeta.ftf == null ? "" : String(cardMeta.ftf),
          length: cardMeta.length == null ? "" : String(cardMeta.length),
          currency: Array.isArray(cardMeta.currency)
            ? cardMeta.currency
            : cardMeta.currency
              ? [String(cardMeta.currency)]
              : [],
        });
      });
    }
  }

  function getBankValue(card) {
    return card.bankEnglishName || card.bankKey;
  }

  function getParentMap() {
    const parentMap = new Map();
    cards.forEach((card) => {
      const child = getBankValue(card);
      if (child && card.bankParent && !parentMap.has(child)) {
        parentMap.set(child, card.bankParent);
      }
    });
    return parentMap;
  }

  function bankMatchesRecursive(card, target) {
    const current = getBankValue(card);
    if (!current || !target) return false;
    if (current === target) return true;

    const parentMap = getParentMap();
    const visited = new Set([current]);
    let parent = parentMap.get(current) || "";
    while (parent && !visited.has(parent)) {
      if (parent === target) return true;
      visited.add(parent);
      parent = parentMap.get(parent) || "";
    }
    return false;
  }

  function getBankTagRank(tag) {
    const index = BANK_TAG_ORDER.indexOf(tag);
    return index === -1 ? BANK_TAG_ORDER.length : index;
  }

  function getIssuerOptions() {
    const options = new Map();
    cards.forEach((card) => {
      const value = getBankValue(card);
      if (!value || options.has(value)) return;
      options.set(value, {
        value,
        label: card.bankNativeName || card.bankEnglishName || value,
        logoUrl: card.bankLogoUrl || "",
        tag: card.bankTag,
      });
    });
    return [...options.values()].sort((a, b) => {
      const tagDiff = getBankTagRank(a.tag) - getBankTagRank(b.tag);
      return tagDiff || compareText(a.label, b.label);
    });
  }

  function issuerMatches(card, value) {
    if (value === "all") return true;
    if (value.startsWith("tag:")) return card.bankTag === value.slice(4);
    if (!value.startsWith("bank:")) return true;
    return bankMatchesRecursive(card, value.slice(5));
  }

  function setIssuer(value) {
    currentPage = 1;
    issuerValue = value;
    if (value.startsWith("tag:")) issuerHoverTag = value.slice(4);
    else if (value === "all") issuerHoverTag = "all";
    else
      issuerHoverTag =
        getIssuerOptions().find((item) => item.value === value.slice(5))?.tag ||
        "all";
    issuerLabel.textContent = getIssuerLabel(value);
    renderIssuerList(issuerHoverTag);
    render();
  }

  function getIssuerLabel(value) {
    if (value === "all") return "全部";
    if (value.startsWith("tag:"))
      return BANK_TAG_LABELS[value.slice(4)] || value.slice(4);
    return (
      getIssuerOptions().find((item) => item.value === value.slice(5))?.label ||
      "全部"
    );
  }

  function updateIssuerGroupState() {
    if (!issuerGroups) return;
    issuerGroups.querySelectorAll(".issuer-filter-item").forEach((button) => {
      const tag = button.dataset.tag || "";
      const active =
        (tag === "all" && issuerValue === "all") ||
        issuerHoverTag === tag ||
        issuerValue === `tag:${tag}`;
      button.classList.toggle("is-active", active);
    });
  }

  function makeMenuButton(
    label,
    value,
    active,
    onClick,
    className = "issuer-filter-item",
  ) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `${className}${active ? " is-active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", onClick);
    button.dataset.value = value;
    return button;
  }

  function renderIssuerList(tag) {
    if (!issuerList) return;
    issuerList.innerHTML = "";
    if (!tag || tag === "all") return;
    getIssuerOptions()
      .filter((item) => item.tag === tag)
      .forEach((item) => {
        const button = makeMenuButton(
          "",
          "bank:" + item.value,
          issuerValue === "bank:" + item.value,
          () => {
            setIssuer("bank:" + item.value);
            closePanel(issuerPanel, issuerTrigger);
          },
          "issuer-filter-bank-item",
        );
        appendBankNameContent(button, item.label, item.logoUrl, true);
        issuerList.append(button);
      });
  }

  function renderIssuerGroups() {
    if (!issuerGroups) return;
    issuerGroups.innerHTML = "";
    const options = getIssuerOptions();
    const all = makeMenuButton(
      getIssuerLabel("all") + " (" + options.length + ")",
      "all",
      issuerValue === "all",
      () => {
        setIssuer("all");
        closePanel(issuerPanel, issuerTrigger);
      },
    );
    all.dataset.tag = "all";
    const showAll = () => {
      issuerHoverTag = "all";
      updateIssuerGroupState();
      renderIssuerList("all");
    };
    all.addEventListener("mouseenter", showAll);
    all.addEventListener("focus", showAll);
    issuerGroups.append(all);

    BANK_TAG_ORDER.forEach((tag) => {
      const count = options.filter((item) => item.tag === tag).length;
      if (!count) return;
      const button = makeMenuButton(
        (BANK_TAG_LABELS[tag] || tag) + " (" + count + ")",
        "tag:" + tag,
        issuerValue === "tag:" + tag || issuerHoverTag === tag,
        () => {
          setIssuer("tag:" + tag);
          closePanel(issuerPanel, issuerTrigger);
        },
      );
      button.dataset.tag = tag;
      const showTag = () => {
        issuerHoverTag = tag;
        updateIssuerGroupState();
        renderIssuerList(tag);
      };
      button.addEventListener("mouseenter", showTag);
      button.addEventListener("focus", showTag);
      issuerGroups.append(button);
    });
    updateIssuerGroupState();
    renderIssuerList(issuerHoverTag);
  }

  function createRegionBankValue(region, province, bank) {
    return (
      "region-bank:" +
      [region, province, bank]
        .map((value) => encodeURIComponent(value || ""))
        .join("|")
    );
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

  function getRegionRank(region) {
    const index = REGION_DEFINITIONS.findIndex((item) => item.code === region);
    return index === -1 ? REGION_DEFINITIONS.length : index;
  }

  function getRegionLabel(region) {
    return regionLabels.get(region) || region || "-";
  }

  function getRegionOptions() {
    const map = new Map();
    cards.forEach((card) => {
      if (!card.region) return;
      const option = map.get(card.region) || {
        value: card.region,
        label: getRegionLabel(card.region),
        bankValues: new Set(),
      };
      const bankValue = getBankValue(card);
      if (bankValue) option.bankValues.add(bankValue);
      map.set(card.region, option);
    });
    return [...map.values()]
      .map(({ bankValues, ...option }) => ({
        ...option,
        count: bankValues.size,
      }))
      .sort((a, b) => {
        const rankDiff = getRegionRank(a.value) - getRegionRank(b.value);
        return rankDiff || compareText(a.label, b.label);
      });
  }

  function getProvinceOptions() {
    const map = new Map();
    cards.forEach((card) => {
      if (card.region !== "CN" || !card.province) return;
      const option = map.get(card.province) || {
        value: card.province,
        label: card.province,
        bankValues: new Set(),
      };
      const bankValue = getBankValue(card);
      if (bankValue) option.bankValues.add(bankValue);
      map.set(card.province, option);
    });
    return [...map.values()]
      .map(({ bankValues, ...option }) => ({
        ...option,
        count: bankValues.size,
      }))
      .sort((a, b) => compareText(a.label, b.label));
  }

  function getRegionBankOptions(region, province = "") {
    const map = new Map();
    cards.forEach((card) => {
      if (card.region !== region) return;
      if (region === "CN" && province && card.province !== province) return;
      const value = getBankValue(card);
      if (!value) return;
      const option = map.get(value) || {
        value,
        label: card.bankNativeName || card.bankEnglishName || value,
        logoUrl: card.bankLogoUrl || "",
      };
      if (!option.logoUrl && card.bankLogoUrl)
        option.logoUrl = card.bankLogoUrl;
      map.set(value, option);
    });
    return [...map.values()].sort((a, b) => compareText(a.label, b.label));
  }

  function getRegionDisplayText(value) {
    if (value === "all") return "全部";
    const regionBank = parseRegionBankValue(value);
    if (regionBank) {
      const bank = getRegionBankOptions(
        regionBank.region,
        regionBank.province,
      ).find((option) => option.value === regionBank.bank);
      const bankLabel = bank?.label || regionBank.bank;
      if (regionBank.region === "CN") {
        return regionBank.province
          ? getRegionLabel("CN") +
              " / " +
              regionBank.province +
              " / " +
              bankLabel
          : getRegionLabel("CN") + " / " + bankLabel;
      }
      return getRegionLabel(regionBank.region) + " / " + bankLabel;
    }
    if (value.startsWith("region:")) return getRegionLabel(value.slice(7));
    if (value.startsWith("province:")) {
      const province = value.slice(9);
      return province
        ? getRegionLabel("CN") + " / " + province
        : getRegionLabel("CN");
    }
    return "全部";
  }

  function updateRegionGroupState() {
    if (!regionGroups) return;
    regionGroups.querySelectorAll(".issuer-filter-item").forEach((button) => {
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

  function renderRegionBankItems(container, options, region, province = "") {
    if (!container) return;
    options.forEach((option) => {
      const value = createRegionBankValue(region, province, option.value);
      const button = makeMenuButton(
        "",
        value,
        regionFilterValue === value,
        () => {
          setRegionFilterValue(value);
          closePanel(regionPanel, regionTrigger);
          render();
        },
        "issuer-filter-bank-item",
      );
      appendBankNameContent(button, option.label, option.logoUrl, true);
      container.append(button);
    });
  }

  function renderRegionFilterIssuers(activeRegion, activeProvince = "") {
    if (!regionIssuers) return;
    regionIssuers.innerHTML = "";
    const visible = activeRegion === "CN" && Boolean(activeProvince);
    regionIssuers.hidden = !visible;
    regionPanel.classList.toggle("has-region-issuers", visible);
    if (!visible) return;
    renderRegionBankItems(
      regionIssuers,
      getRegionBankOptions(activeRegion, activeProvince),
      activeRegion,
      activeProvince,
    );
  }

  function renderRegionFilterProvinces(activeRegion) {
    if (!regionProvinces) return;
    regionProvinces.innerHTML = "";
    if (activeRegion !== "CN") {
      if (activeRegion && activeRegion !== "all") {
        renderRegionBankItems(
          regionProvinces,
          getRegionBankOptions(activeRegion),
          activeRegion,
        );
      }
      return;
    }
    getProvinceOptions().forEach((option) => {
      const value = "province:" + option.value;
      const button = makeMenuButton(
        option.label + " (" + option.count + ")",
        value,
        regionFilterValue === value ||
          parseRegionBankValue(regionFilterValue)?.province === option.value,
        () => {
          setRegionFilterValue(value);
          closePanel(regionPanel, regionTrigger);
          render();
        },
        "issuer-filter-bank-item",
      );
      const showIssuers = () => {
        regionFilterHoverProvince = option.value;
        renderRegionFilterIssuers("CN", option.value);
      };
      button.addEventListener("mouseenter", showIssuers);
      button.addEventListener("focus", showIssuers);
      regionProvinces.append(button);
    });
  }

  function renderRegionGroups() {
    if (!regionGroups) return;
    regionGroups.innerHTML = "";
    const options = getRegionOptions();
    const totalCount = new Set(
      cards.map((card) => getBankValue(card)).filter(Boolean),
    ).size;
    const all = makeMenuButton(
      getRegionDisplayText("all") + " (" + totalCount + ")",
      "all",
      regionFilterValue === "all",
      () => {
        setRegionFilterValue("all");
        closePanel(regionPanel, regionTrigger);
        render();
      },
    );
    all.dataset.region = "all";
    const showAll = () => {
      regionFilterHoverRegion = "all";
      regionFilterHoverProvince = "";
      updateRegionGroupState();
      renderRegionFilterProvinces("all");
      renderRegionFilterIssuers("all");
    };
    all.addEventListener("mouseenter", showAll);
    all.addEventListener("focus", showAll);
    regionGroups.append(all);

    options.forEach((option) => {
      const button = makeMenuButton(
        option.label + " (" + option.count + ")",
        "region:" + option.value,
        regionFilterValue === "region:" + option.value ||
          regionFilterHoverRegion === option.value ||
          (option.value === "CN" &&
            (regionFilterValue.startsWith("province:") ||
              parseRegionBankValue(regionFilterValue)?.region === "CN")),
        () => {
          setRegionFilterValue("region:" + option.value);
          closePanel(regionPanel, regionTrigger);
          render();
        },
      );
      button.dataset.region = option.value;
      const showRegion = () => {
        regionFilterHoverRegion = option.value;
        updateRegionGroupState();
        renderRegionFilterProvinces(option.value);
        renderRegionFilterIssuers(option.value, regionFilterHoverProvince);
      };
      button.addEventListener("mouseenter", showRegion);
      button.addEventListener("focus", showRegion);
      regionGroups.append(button);
    });
    updateRegionGroupState();
  }

  function setRegionFilterValue(value) {
    currentPage = 1;
    const nextValue = value || "all";
    const regionBank = parseRegionBankValue(nextValue);
    if (nextValue === "all") {
      regionFilterValue = "all";
      regionFilterHoverRegion = "all";
      regionFilterHoverProvince = "";
    } else if (regionBank) {
      const exists = getRegionBankOptions(
        regionBank.region,
        regionBank.province,
      ).some((option) => option.value === regionBank.bank);
      regionFilterValue = exists ? nextValue : "all";
      regionFilterHoverRegion = exists ? regionBank.region : "all";
      regionFilterHoverProvince = exists ? regionBank.province : "";
    } else if (nextValue.startsWith("region:")) {
      const region = nextValue.slice(7);
      const exists = getRegionOptions().some(
        (option) => option.value === region,
      );
      regionFilterValue = exists ? nextValue : "all";
      regionFilterHoverRegion = exists ? region : "all";
      regionFilterHoverProvince = "";
    } else if (nextValue.startsWith("province:")) {
      const province = nextValue.slice(9);
      const exists = getProvinceOptions().some(
        (option) => option.value === province,
      );
      regionFilterValue = exists ? nextValue : "all";
      regionFilterHoverRegion = exists ? "CN" : "all";
      regionFilterHoverProvince = exists ? province : "";
    } else {
      regionFilterValue = "all";
      regionFilterHoverRegion = "all";
      regionFilterHoverProvince = "";
    }
    if (regionLabel)
      regionLabel.textContent = getRegionDisplayText(regionFilterValue);
  }

  function openPanel(panel, trigger, renderPanel) {
    renderPanel();
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  function closePanel(panel, trigger) {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function regionMatches(card) {
    if (regionFilterValue === "all") return true;
    const regionBank = parseRegionBankValue(regionFilterValue);
    if (regionBank) {
      return (
        card.region === regionBank.region &&
        (regionBank.region !== "CN" || card.province === regionBank.province) &&
        bankMatchesRecursive(card, regionBank.bank)
      );
    }
    if (regionFilterValue.startsWith("region:")) {
      return card.region === regionFilterValue.slice(7);
    }
    if (regionFilterValue.startsWith("province:")) {
      return (
        card.region === "CN" && card.province === regionFilterValue.slice(9)
      );
    }
    return true;
  }

  function organizationMatches(card) {
    return (
      organizationFilter.value === "all" ||
      card.organization === organizationFilter.value
    );
  }

  function getSearchText(card) {
    return [
      card.name,
      card.issuer,
      card.bankNativeName,
      card.bankEnglishName,
      card.organization,
      card.tier,
      card.type,
      card.region,
      card.province,
    ]
      .join(" ")
      .toLowerCase();
  }

  function filteredCards() {
    return cards.filter((card) => {
      const matchesSearch =
        !searchValue || getSearchText(card).includes(searchValue);
      const matchesType =
        typeFilter.value === "all" || card.type === typeFilter.value;
      return (
        matchesSearch &&
        matchesType &&
        organizationMatches(card) &&
        issuerMatches(card, issuerValue) &&
        regionMatches(card)
      );
    });
  }

  function formatRegion(card) {
    const label = regionLabels.get(card.region) || card.region || "-";
    return card.region === "CN" && card.province
      ? `${label} / ${card.province}`
      : label;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
  }

  function updateFileStats() {
    if (!fileStats) return;
    const known = cards.filter((card) => card.fileSizeLoaded).length;
    const total = cards.reduce(
      (sum, card) => sum + (card.fileSizeLoaded ? card.fileSizeBytes : 0),
      0,
    );
    fileStats.textContent =
      known === cards.length
        ? `卡面总大小：${formatBytes(total)}`
        : `文件大小：${formatBytes(total)}（${known}/${cards.length}）`;
  }

  async function loadImageSize(card, sourceUrl = card?.image) {
    if (!card || !sourceUrl) return 0;
    const isAltImage = sourceUrl === card.altImageUrl;
    const loadedKey = isAltImage ? "altFileSizeLoaded" : "fileSizeLoaded";
    const bytesKey = isAltImage ? "altFileSizeBytes" : "fileSizeBytes";
    const promiseKey = isAltImage ? "altFileSizePromise" : "fileSizePromise";
    if (card[loadedKey]) return card[bytesKey];
    if (card[promiseKey]) return card[promiseKey];
    card[promiseKey] = fetch(sourceUrl, {
      method: "HEAD",
      cache: "force-cache",
    })
      .then((response) =>
        response.ok ? Number(response.headers.get("content-length")) : 0,
      )
      .catch(() => 0)
      .then((size) => {
        card[bytesKey] = Number.isFinite(size) && size > 0 ? size : 0;
        card[loadedKey] = true;
        card[promiseKey] = null;
        updateFileStats();
        return card[bytesKey];
      });
    return card[promiseKey];
  }

  async function loadCardImageSize(card) {
    return loadImageSize(card, card?.image);
  }

  async function loadAllImageSizes() {
    await Promise.all(cards.map((card) => loadCardImageSize(card)));
    updateFileStats();
  }

  function updateImageMeta(image, resolution, size) {
    const resolutionNode = image
      .closest(".gallery-image-wrap")
      ?.querySelector("[data-image-resolution]");
    const sizeNode = image
      .closest(".gallery-image-wrap")
      ?.querySelector("[data-image-size]");
    if (resolutionNode && resolution) resolutionNode.textContent = resolution;
    if (sizeNode && size) sizeNode.textContent = size;
  }

  async function loadImageMeta(image, card) {
    const resolution =
      image.naturalWidth && image.naturalHeight
        ? `${image.naturalWidth}×${image.naturalHeight}`
        : "";
    image.classList.toggle(
      "is-portrait",
      image.naturalHeight > image.naturalWidth,
    );
    image.dataset.imageResolution = resolution;
    const size = formatBytes(await loadCardImageSize(card));
    image.dataset.imageSize = size;
    updateImageMeta(image, resolution, size);
  }

  function updateLightboxControls() {
    const hasAlternate = lightboxSources.length > 1;
    if (lightboxPrevious) lightboxPrevious.hidden = !hasAlternate;
    if (lightboxNext) lightboxNext.hidden = !hasAlternate;
  }

  function updateLightboxMeta(card, sourceUrl = card?.image) {
    if (!lightboxMeta || !lightboxImage) return;
    const resolution =
      lightboxImage.naturalWidth && lightboxImage.naturalHeight
        ? `${lightboxImage.naturalWidth}×${lightboxImage.naturalHeight}`
        : "";
    const size = formatBytes(
      sourceUrl === card?.altImageUrl
        ? card?.altFileSizeBytes
        : card?.fileSizeBytes,
    );
    lightboxMeta.textContent = [resolution, size].filter(Boolean).join(" · ");
  }

  function sameImageUrl(first, second) {
    if (!first || !second) return false;
    try {
      return (
        new URL(first, window.location.href).href ===
        new URL(second, window.location.href).href
      );
    } catch {
      return first === second;
    }
  }

  function renderLightboxImage() {
    if (!lightboxCard || !lightboxImage) return;
    const sourceUrl =
      lightboxSources[lightboxIndex] || lightboxCard.image || "";
    lightboxImage.src = sourceUrl;
    lightboxImage.alt = `${lightboxCard.name} 卡面`;
    lightboxImage.onload = () => updateLightboxMeta(lightboxCard, sourceUrl);
    updateLightboxMeta(lightboxCard, sourceUrl);
    void loadImageSize(lightboxCard, sourceUrl).then(() =>
      updateLightboxMeta(lightboxCard, sourceUrl),
    );
    updateLightboxControls();
  }

  function openLightbox(card, sourceImage) {
    if (!lightbox || !lightboxImage) return;
    lightboxCard = card;
    lightboxSources = [
      ...new Set([card.image, card.altImageUrl].filter(Boolean)),
    ];
    const sourceUrl =
      sourceImage?.currentSrc || sourceImage?.src || card.image || "";
    const sourceIndex = lightboxSources.findIndex((item) =>
      sameImageUrl(item, sourceUrl),
    );
    lightboxIndex = sourceIndex >= 0 ? sourceIndex : 0;
    lightboxImage.classList.remove("is-portrait");
    renderLightboxImage();
    if (typeof lightbox.showModal === "function") lightbox.showModal();
    else lightbox.setAttribute("open", "");
  }

  function closeLightbox() {
    if (typeof lightbox?.close === "function") lightbox.close();
    else lightbox?.removeAttribute("open");
    lightboxCard = null;
    lightboxSources = [];
    lightboxIndex = 0;
  }

  function moveLightbox(step) {
    if (!lightboxCard || lightboxSources.length < 2) return;
    lightboxIndex =
      (lightboxIndex + step + lightboxSources.length) % lightboxSources.length;
    renderLightboxImage();
  }

  function formatCardLength(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return text.endsWith("位") ? text : `${text}位`;
  }

  function renderCard(card) {
    const article = document.createElement("article");
    article.className = `gallery-card ${getTierAccentClass(card.tier, "tier-accent-none")}`;

    const figure = document.createElement("figure");
    figure.className = "gallery-image-wrap";
    const image = document.createElement("img");
    image.className = "gallery-image";
    image.alt = `${card.name} 卡面`;
    image.loading = "lazy";
    image.src = card.image;
    image.addEventListener("load", () => loadImageMeta(image, card));
    image.addEventListener("error", () => {
      if (card.altImageUrl && image.src !== card.altImageUrl) {
        image.src = card.altImageUrl;
        return;
      }
      figure.classList.add("is-empty");
    });
    image.addEventListener("click", () => openLightbox(card, image));
    figure.append(image);

    const meta = document.createElement("div");
    meta.className = "gallery-image-meta";
    meta.innerHTML =
      "<span data-image-resolution></span><span data-image-size></span>";
    figure.append(meta);

    const body = document.createElement("div");
    body.className = "gallery-card-body";
    const title = document.createElement("h2");
    title.className = "gallery-card-title";
    title.textContent = card.name;
    body.append(title);

    const binRow = document.createElement("div");
    binRow.className = "gallery-card-bin-row";
    const bin = document.createElement("div");
    bin.className = "gallery-card-bin";
    bin.textContent = formatBinDisplay(card.bin) || "-";
    const length = document.createElement("span");
    length.className = "gallery-card-length";
    length.textContent = formatCardLength(card.length);
    binRow.append(bin, length);
    body.append(binRow);

    const issuerRegion = document.createElement("div");
    issuerRegion.className = "gallery-issuer-region";
    const issuer = document.createElement("span");
    issuer.className = "gallery-issuer";
    issuer.title = card.issuer || "";
    if (card.bankLogoUrl) {
      const issuerLogo = document.createElement("img");
      issuerLogo.className = "gallery-issuer-logo";
      issuerLogo.src = card.bankLogoUrl;
      issuerLogo.alt = "";
      issuerLogo.setAttribute("aria-hidden", "true");
      issuerLogo.addEventListener("error", () => issuerLogo.remove(), {
        once: true,
      });
      issuer.append(issuerLogo);
    }
    const issuerName = document.createElement("span");
    issuerName.textContent = card.issuer || "-";
    issuer.append(issuerName);
    const region = document.createElement("span");
    region.className = "gallery-region";
    region.textContent = formatRegion(card);
    region.title = region.textContent;
    issuerRegion.append(issuer, region);
    body.append(issuerRegion);

    const cardMeta = document.createElement("div");
    cardMeta.className = "gallery-card-meta";
    const organization = document.createElement("span");
    organization.className = "gallery-organization";
    if (card.organizationIcon) {
      const logo = document.createElement("img");
      logo.className = "gallery-organization-logo";
      logo.src = card.organizationIcon;
      logo.alt = `${card.organization || ""} logo`;
      organization.append(logo);
    }
    organization.title = card.organization || "";
    organization.setAttribute("aria-label", card.organization || "卡组织");
    cardMeta.append(organization);
    const tier = document.createElement("span");
    tier.className = "gallery-tier";
    tier.textContent = card.tier || "-";
    cardMeta.append(tier);
    const type = document.createElement("span");
    type.textContent = card.type || "-";
    cardMeta.append(type);

    const editButton = document.createElement("button");
    editButton.className = "gallery-edit-button";
    editButton.type = "button";
    editButton.title = "编辑卡片";
    editButton.setAttribute("aria-label", `编辑${card.name}`);
    editButton.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 16.75V20h3.25L18.6 8.65l-3.25-3.25L4 16.75Zm16.25-9.5a.9.9 0 0 0 0-1.27l-2.23-2.23a.9.9 0 0 0-1.27 0l-1.58 1.58 3.25 3.25 1.83-1.33Z" />
      </svg>`;
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      openEditor(card);
    });
    body.append(cardMeta);

    article.append(figure, body, editButton);
    return article;
  }

  function render() {
    if (!grid) return;
    const filtered = filteredCards().sort((a, b) =>
      compareCardsByOrganizationAndTier(a, b, { tierOrderMap: TIER_ORDER_MAP }),
    );
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    const start = (currentPage - 1) * pageSize;
    const visible = filtered.slice(start, start + pageSize);
    grid.innerHTML = "";
    visible.forEach((card) => grid.append(renderCard(card)));
    empty.hidden = visible.length > 0;
    if (stats)
      stats.textContent = filtered.length
        ? `${start + 1}-${start + visible.length} / ${filtered.length} 张卡面`
        : "0 / 0 张卡面";
    if (pageLabel)
      pageLabel.textContent = `第 ${currentPage} / ${totalPages} 页`;
    if (previousPage) previousPage.disabled = currentPage <= 1;
    if (nextPage) nextPage.disabled = currentPage >= totalPages;
    if (pageSizeSelect) pageSizeSelect.value = String(pageSize);
  }

  function editorField(name) {
    return editorForm?.elements.namedItem(name);
  }

  function setEditorStatus(message, isError = false) {
    if (!editorStatus) return;
    editorStatus.textContent = message;
    editorStatus.classList.toggle("is-error", isError);
  }

  function fillSelect(select, values, current) {
    if (!select) return;
    select.innerHTML = "";
    values.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value || "-";
      select.append(option);
    });
    if (current && !values.includes(current)) {
      const option = document.createElement("option");
      option.value = current;
      option.textContent = current;
      select.append(option);
    }
    select.value = current || "";
  }

  function getIssuerChoices() {
    return [
      ...new Set(
        cards.map((card) => String(card.issuer || "").trim()).filter(Boolean),
      ),
    ].sort(compareText);
  }

  function hideIssuerSuggestions() {
    if (!issuerSuggestions || !issuerInput) return;
    issuerSuggestions.hidden = true;
    issuerInput.setAttribute("aria-expanded", "false");
  }

  function renderIssuerSuggestions(query = "") {
    if (!issuerSuggestions || !issuerInput) return;
    const normalizedQuery = query.trim().toLowerCase();
    const choices = getIssuerChoices()
      .filter(
        (issuer) =>
          !normalizedQuery || issuer.toLowerCase().includes(normalizedQuery),
      )
      .slice(0, 50);
    issuerSuggestions.innerHTML = "";
    choices.forEach((issuer) => {
      const option = document.createElement("button");
      option.type = "button";
      option.className = "gallery-issuer-suggestion";
      option.setAttribute("role", "option");
      option.textContent = issuer;
      option.addEventListener("mousedown", (event) => event.preventDefault());
      option.addEventListener("click", () => {
        issuerInput.value = issuer;
        issuerInputValid = true;
        hideIssuerSuggestions();
      });
      issuerSuggestions.append(option);
    });
    issuerSuggestions.hidden = choices.length === 0;
    issuerInput.setAttribute("aria-expanded", String(choices.length > 0));
  }

  function getTierOptions(organization, current = "") {
    const configured = Array.isArray(TIER_ORDER_MAP[organization])
      ? TIER_ORDER_MAP[organization]
      : [];
    const values = [...new Set(configured.filter(Boolean))];
    if (current && !values.includes(current)) values.push(current);
    return values;
  }

  function updateEditorTierOptions(current = "") {
    const organization = String(editorField("organization")?.value || "");
    fillSelect(
      editorField("tier"),
      getTierOptions(organization, current),
      current,
    );
  }

  function getCurrencyOptions(selected = []) {
    const values = new Set(CURRENCY_OPTIONS);
    cards.forEach((card) => {
      (card.currency || []).forEach((currency) => values.add(String(currency)));
    });
    selected.forEach((currency) => values.add(String(currency)));
    return [...values].filter(Boolean);
  }

  function renderCurrencyOptions(selected = []) {
    if (!editorCurrency) return;
    const selectedSet = new Set(selected.map((currency) => String(currency)));
    editorCurrency.innerHTML = "";
    getCurrencyOptions(selected).forEach((currency) => {
      const label = document.createElement("label");
      label.className = "gallery-currency-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "currency";
      input.value = currency;
      input.checked = selectedSet.has(currency);
      label.append(input, document.createTextNode(currency));
      editorCurrency.append(label);
    });
  }

  function getSelectedCurrencies() {
    return [
      ...(editorCurrency?.querySelectorAll('input[name="currency"]:checked') ||
        []),
    ].map((input) => input.value);
  }

  function resetTurnstile() {
    turnstileToken = "";
    if (turnstileWidgetId !== null && window.turnstile?.reset) {
      window.turnstile.reset(turnstileWidgetId);
    }
  }

  function renderTurnstile() {
    if (!turnstileContainer || !turnstileSiteKey) return;
    if (!window.turnstile?.render) {
      window.setTimeout(renderTurnstile, 250);
      return;
    }
    if (turnstileWidgetId !== null && window.turnstile.reset) {
      window.turnstile.reset(turnstileWidgetId);
      return;
    }
    turnstileWidgetId = window.turnstile.render(turnstileContainer, {
      sitekey: turnstileSiteKey,
      action: "turnstile-spin-v2",
      execution: "execute",
      callback: (token) => {
        turnstileToken = token;
        if (pendingSave) {
          pendingSave = false;
          commitEditorSave();
        }
      },
      "expired-callback": resetTurnstile,
      "error-callback": () => setEditorStatus("Bot verification failed", true),
    });
  }

  function openEditor(card) {
    if (!editor || !editorForm) return;
    editingCard = card;
    editorImage.src = card.image || "";
    editorImage.alt = card.name || "";
    editorTitle.textContent = card.name || "编辑卡片";
    editorField("name").value = card.name || "";
    editorField("bin").value = card.bin || "";
    editorField("issuer").value = card.issuer || "";
    editorField("length").value = card.length || "";
    editorField("desc").value = card.desc || "";
    editorField("benefit").value = card.benefit || "";
    editorField("ftf").value = card.ftf || "";
    issuerInputValid = getIssuerChoices().includes(String(card.issuer || ""));
    hideIssuerSuggestions();
    fillSelect(
      editorField("organization"),
      ["", ...ORGANIZATIONS.map(({ name }) => name)],
      card.organization || "",
    );
    updateEditorTierOptions(card.tier || "");
    fillSelect(editorField("type"), ["", ...TYPE_OPTIONS], card.type || "");
    renderCurrencyOptions(card.currency || []);
    pendingSave = false;
    resetTurnstile();
    setEditorStatus("");
    if (typeof editor.showModal === "function") editor.showModal();
    else editor.setAttribute("open", "");
    editorField("name").focus();
    renderTurnstile();
  }

  function closeEditor() {
    if (!editor) return;
    if (typeof editor.close === "function") editor.close();
    else editor.removeAttribute("open");
    editingCard = null;
    pendingSave = false;
    resetTurnstile();
    hideIssuerSuggestions();
  }

  async function reloadIssuerInfo() {
    const payload = data.issuerInfoUrl
      ? await fetchJsonSafe(data.issuerInfoUrl, { warn: true })
      : null;
    cards.length = 0;
    mapIssuerCards(normalizeIssuerInfo(payload));
    updateOrganizationOptions();
    renderIssuerGroups();
    renderRegionGroups();
    renderRegionFilterProvinces(regionFilterHoverRegion);
    renderRegionFilterIssuers(
      regionFilterHoverRegion,
      regionFilterHoverProvince,
    );
    updateFileStats();
    render();
    void loadAllImageSizes();
  }

  async function saveEditor(event) {
    event.preventDefault();
    if (!editingCard || !editorSave) return;
    if (!turnstileToken) {
      pendingSave = true;
      if (turnstileWidgetId !== null && window.turnstile?.execute) {
        setEditorStatus("请完成防机器人验证");
        window.turnstile.execute(turnstileWidgetId);
      } else {
        setEditorStatus("Turnstile is not configured", true);
      }
      return;
    }
    const issuerValueText = String(editorField("issuer")?.value || "").trim();
    if (!issuerInputValid || !getIssuerChoices().includes(issuerValueText)) {
      setEditorStatus("请选择已有的发行方", true);
      renderIssuerSuggestions(issuerValueText);
      return;
    }
    await commitEditorSave();
  }

  async function commitEditorSave() {
    if (!editingCard || !editorSave) return;
    const issuerValueText = String(editorField("issuer")?.value || "").trim();
    if (!issuerInputValid || !getIssuerChoices().includes(issuerValueText)) {
      setEditorStatus("请选择已有的发行方", true);
      renderIssuerSuggestions(issuerValueText);
      return;
    }
    const patch = {
      name: String(editorField("name")?.value || "").trim(),
      bin: String(editorField("bin")?.value || "").trim(),
      issuer: String(editorField("issuer")?.value || "").trim(),
      organization: String(editorField("organization")?.value || "").trim(),
      tier: String(editorField("tier")?.value || "").trim(),
      type: String(editorField("type")?.value || "").trim(),
      length: String(editorField("length")?.value || "").trim(),
      currency: getSelectedCurrencies(),
      desc: String(editorField("desc")?.value || "").trim(),
      benefit: String(editorField("benefit")?.value || "").trim(),
      ftf: String(editorField("ftf")?.value || "").trim(),
    };
    if (!patch.name) {
      setEditorStatus("卡片名称不能为空", true);
      return;
    }
    editorSave.disabled = true;
    setEditorStatus("正在保存…");
    try {
      const response = await fetch(
        data.issuerInfoEditUrl || "api/issuer-info",
        {
          method: "PUT",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            issuerKey: editingCard.bankKey,
            cardIndex: editingCard.cardIndex,
            cardName: editingCard.name,
            turnstileToken,
            patch,
          }),
        },
      );
      const body = await response.text();
      let result = {};
      try {
        result = JSON.parse(body);
      } catch {
        /* The status below is enough. */
      }
      if (!response.ok)
        throw new Error(result.error || `保存失败（${response.status}）`);
      await reloadIssuerInfo();
      closeEditor();
    } catch (error) {
      resetTurnstile();
      setEditorStatus(
        error instanceof Error ? error.message : "保存失败",
        true,
      );
    } finally {
      editorSave.disabled = false;
    }
  }

  function updateOrganizationOptions() {
    const current = organizationFilter.value;
    const options = [
      ...new Set(cards.map((card) => card.organization).filter(Boolean)),
    ].sort(
      (a, b) =>
        getOrganizationRank(a) - getOrganizationRank(b) || compareText(a, b),
    );
    organizationFilter.innerHTML = '<option value="all">全部卡组织</option>';
    options.forEach((organization) => {
      const option = document.createElement("option");
      option.value = organization;
      option.textContent = organization;
      organizationFilter.append(option);
    });
    organizationFilter.value = options.includes(current) ? current : "all";
  }

  function bindEvents() {
    searchInput.addEventListener("input", () => {
      searchValue = searchInput.value.trim().toLowerCase();
      currentPage = 1;
      render();
    });
    organizationFilter.addEventListener("change", () => {
      currentPage = 1;
      render();
    });
    typeFilter.addEventListener("change", () => {
      currentPage = 1;
      render();
    });
    pageSizeSelect?.addEventListener("change", () => {
      pageSize = Number(pageSizeSelect.value) || 12;
      currentPage = 1;
      render();
    });
    previousPage?.addEventListener("click", () => {
      if (currentPage <= 1) return;
      currentPage -= 1;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    nextPage?.addEventListener("click", () => {
      currentPage += 1;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    issuerInput?.addEventListener("input", () => {
      issuerInputValid = getIssuerChoices().includes(issuerInput.value.trim());
      renderIssuerSuggestions(issuerInput.value);
    });
    issuerInput?.addEventListener("focus", () =>
      renderIssuerSuggestions(issuerInput.value),
    );
    issuerInput?.addEventListener("blur", () =>
      window.setTimeout(hideIssuerSuggestions, 120),
    );
    issuerTrigger.addEventListener("click", () => {
      if (issuerPanel.hidden)
        openPanel(issuerPanel, issuerTrigger, () => {
          renderIssuerGroups();
          renderIssuerList(issuerHoverTag);
        });
      else closePanel(issuerPanel, issuerTrigger);
    });
    regionTrigger.addEventListener("click", () => {
      if (regionPanel.hidden)
        openPanel(regionPanel, regionTrigger, () => {
          renderRegionGroups();
          renderRegionFilterProvinces(regionFilterHoverRegion);
          renderRegionFilterIssuers(
            regionFilterHoverRegion,
            regionFilterHoverProvince,
          );
        });
      else closePanel(regionPanel, regionTrigger);
    });
    document.addEventListener("click", (event) => {
      if (!issuerWrap.contains(event.target))
        closePanel(issuerPanel, issuerTrigger);
      if (!regionWrap.contains(event.target))
        closePanel(regionPanel, regionTrigger);
    });
    document
      .querySelector("#galleryEditorClose")
      ?.addEventListener("click", closeEditor);
    document
      .querySelector("#galleryEditorCancel")
      ?.addEventListener("click", closeEditor);
    editorForm?.addEventListener("submit", saveEditor);
    editorField("organization")?.addEventListener("change", () =>
      updateEditorTierOptions(),
    );
    editor?.addEventListener("click", (event) => {
      if (event.target === editor) closeEditor();
    });
    document
      .querySelector("#galleryLightboxClose")
      ?.addEventListener("click", closeLightbox);
    lightboxPrevious?.addEventListener("click", () => moveLightbox(-1));
    lightboxNext?.addEventListener("click", () => moveLightbox(1));
    lightbox?.addEventListener("click", (event) => {
      if (event.target !== lightboxImage && !event.target.closest("button"))
        closeLightbox();
    });
    document.addEventListener("keydown", (event) => {
      if (!lightbox || lightbox.hidden || !lightbox.open) return;
      if (event.key === "ArrowLeft") moveLightbox(-1);
      if (event.key === "ArrowRight") moveLightbox(1);
      if (event.key === "Escape") closeLightbox();
    });
  }

  async function init() {
    bindEvents();
    renderIssuerGroups();
    renderRegionGroups();
    renderRegionFilterProvinces(regionFilterHoverRegion);
    renderRegionFilterIssuers(
      regionFilterHoverRegion,
      regionFilterHoverProvince,
    );
    await reloadIssuerInfo();
  }

  init();
})();
