(() => {
  const TYPE_OPTIONS = ["Debit", "Credit", "Prepaid", "Transit"];
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
    normalizeBankTag,
    resolveIssuerLogoUrl,
    createIssuerFilterModel,
  } = cardUtils;
  const { TIER_ORDER_MAP = {} } = cardConfig;

  const cards = [];
  let searchValue = "";
  let issuerValue = "all";
  let issuerHoverTag = "all";
  let regionFilterValue = "all";
  let regionFilterHoverRegion = "all";
  let regionFilterHoverProvince = "";
  let currentPage = 1;
  let pageSize = 12;

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
  const firstPage = document.querySelector("#galleryFirstPage");
  const previousPage = document.querySelector("#galleryPreviousPage");
  const nextPage = document.querySelector("#galleryNextPage");
  const lastPage = document.querySelector("#galleryLastPage");
  const pageLabel = document.querySelector("#galleryPageLabel");
  const pageInput = document.querySelector("#galleryPageInput");
  const pageJump = document.querySelector("#galleryPageJump");
  const pageSizeSelect = document.querySelector("#galleryPageSize");
  const lightbox = document.querySelector("#galleryLightbox");
  const lightboxImage = document.querySelector("#galleryLightboxImage");
  const lightboxMeta = document.querySelector("#galleryLightboxMeta");
  const lightboxThumbs = document.querySelector("#galleryLightboxThumbs");
  const lightboxPrevious = document.querySelector("#galleryLightboxPrevious");
  const lightboxNext = document.querySelector("#galleryLightboxNext");
  let lightboxCard = null;
  let lightboxSources = [];
  let lightboxIndex = 0;
  let lightboxRenderId = 0;

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

  function getProvinceQueryValue(value) {
    return PROVINCE_QUERY_VALUES[value] || encodeURIComponent(value);
  }

  function parseProvinceQueryValue(value) {
    const matched = Object.entries(PROVINCE_QUERY_VALUES).find(
      ([, queryValue]) => queryValue === value,
    );
    if (matched) return matched[0];
    try {
      return decodeURIComponent(value || "");
    } catch {
      return value || "";
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
    if (value.startsWith("region:")) return value.slice(7);
    if (value.startsWith("province:")) {
      return `CN:${getProvinceQueryValue(value.slice(9))}`;
    }
    return "all";
  }

  function parseRegionQueryValue(value) {
    const text = String(value || "").trim();
    if (!text || text === "all") return "all";
    const separatorIndex = text.indexOf(":");
    if (separatorIndex > 0) {
      const region = text.slice(0, separatorIndex);
      const details = text.slice(separatorIndex + 1).split(":");
      if (region === "CN") {
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
        return province ? `province:${province}` : "all";
      }
      if (/^[A-Za-z]{2}$/.test(region) && details[0]) {
        try {
          return createRegionBankValue(
            region,
            "",
            decodeURIComponent(details.join(":")),
          );
        } catch {
          return "all";
        }
      }
    }
    return /^[A-Za-z]{2}$/.test(text) ? `region:${text}` : "all";
  }

  function getUrlState() {
    const params = new URLSearchParams(window.location.search);
    const requestedPageSize = params.get("pageSize") || "12";
    const numericPageSize = Number(requestedPageSize);
    return {
      search: params.get("search") || "",
      organization: params.get("organization") || "all",
      issuer: params.get("issuer") || "all",
      region: parseRegionQueryValue(params.get("region") || "all"),
      type: params.get("type") || "all",
      page: Math.max(1, Number(params.get("page")) || 1),
      pageSize:
        requestedPageSize === "all"
          ? "all"
          : [12, 20, 60, 100].includes(numericPageSize)
            ? numericPageSize
            : 12,
    };
  }

  function updateUrlState() {
    const params = new URLSearchParams();
    const searchQuery = String(searchInput?.value || "").trim();
    if (searchQuery) params.set("search", searchQuery);
    if (issuerValue !== "all") params.set("issuer", issuerValue);
    if (organizationFilter?.value && organizationFilter.value !== "all") {
      params.set("organization", organizationFilter.value);
    }
    if (regionFilterValue !== "all") {
      params.set("region", getRegionQueryValue(regionFilterValue));
    }
    if (typeFilter?.value && typeFilter.value !== "all") {
      params.set("type", typeFilter.value);
    }
    if (currentPage > 1) params.set("page", String(currentPage));
    if (pageSize !== 12) params.set("pageSize", String(pageSize));
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }

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
    const issuerMetadata = new Map();
    for (const [issuerKey, issuerData] of Object.entries(info)) {
      const bank = issuerData?.bank;
      if (!bank) continue;
      const metadata = {
        issuerKey,
        bank,
        tag: normalizeBankTag(bank.tag),
      };
      [issuerKey, bank.english_name, bank.native_name]
        .filter(Boolean)
        .forEach((value) => {
          issuerMetadata.set(String(value).trim().toLowerCase(), metadata);
        });
    }

    for (const [bankKey, issuerData] of Object.entries(info)) {
      if (!issuerData?.bank || !Array.isArray(issuerData.cards)) continue;
      const bankInfo = issuerData.bank;
      const parentMetadata = issuerMetadata.get(
        String(bankInfo.parent || "").trim().toLowerCase(),
      );
      issuerData.cards.forEach((entry) => {
        const cardMeta = entry?.card || entry;
        if (!cardMeta || !cardMeta.name) return;
        const base = createCardBase(bankKey, bankInfo, cardMeta, {
          organization: cardMeta.organization,
        });
        cards.push({
          ...base,
          issuer: cardMeta.issuer || base.issuer,
          bankTag: normalizeBankTag(bankInfo.tag),
          bankNativeName: bankInfo.native_name || "",
          bankEnglishName: bankInfo.english_name || bankKey,
          bankParent: bankInfo.parent || "",
          bankParentTag: parentMetadata?.tag || "",
          bankParentName:
            parentMetadata?.bank.native_name ||
            parentMetadata?.bank.english_name ||
            parentMetadata?.issuerKey ||
            "",
          bankParentLogoUrl: parentMetadata
            ? resolveIssuerLogoUrl(
                parentMetadata.issuerKey,
                parentMetadata.bank.logo || "",
                parentMetadata.bank.region,
              )
            : "",
          bankParentRegion: parentMetadata?.bank.region || "",
          bankParentProvince: parentMetadata?.bank.province || "",
          bankWebsiteUrl: bankInfo.url || "",
          province: bankInfo.province || "",
          type: normalizeType(cardMeta.type),
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

  const issuerFilterModel = createIssuerFilterModel(() => cards, {
    getValue: getBankValue,
    getTag: (card) => card.bankTag,
    getParent: (card) => card.bankParent,
    getLabel: (card, value) =>
      card.bankNativeName || card.bankEnglishName || value,
    getLogo: (card) => card.bankLogoUrl || "",
    getParentTag: (card) => card.bankParentTag,
    getParentLabel: (card) => card.bankParentName,
    getParentLogo: (card) => card.bankParentLogoUrl,
  });

  function resolveIssuerValue(value) {
    return issuerFilterModel.resolveIssuerValue(value);
  }

  function bankMatchesRecursive(card, target) {
    return issuerFilterModel.matches(card, target);
  }

  function getBankTagRank(tag) {
    const index = BANK_TAG_ORDER.indexOf(tag);
    return index === -1 ? BANK_TAG_ORDER.length : index;
  }

  function getIssuerOptions() {
    return issuerFilterModel.getOptions().sort((a, b) => {
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

  function normalizeIssuerValue(value) {
    if (value === "all") return "all";
    if (value.startsWith("tag:")) {
      return getIssuerOptions().some((item) => item.tag === value.slice(4))
        ? value
        : "all";
    }
    if (value.startsWith("bank:")) {
      return getIssuerOptions().some((item) => item.value === value.slice(5))
        ? value
        : "all";
    }
    return "all";
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
    cards.forEach((card) => {
      if (!card.bankParentRegion || !card.bankParent) return;
      const option = map.get(card.bankParentRegion) || {
        value: card.bankParentRegion,
        label: getRegionLabel(card.bankParentRegion),
        bankValues: new Set(),
      };
      option.bankValues.add(resolveIssuerValue(card.bankParent));
      map.set(card.bankParentRegion, option);
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
    cards.forEach((card) => {
      if (
        card.bankParentRegion !== "CN" ||
        !card.bankParentProvince ||
        !card.bankParent
      ) {
        return;
      }
      const option = map.get(card.bankParentProvince) || {
        value: card.bankParentProvince,
        label: card.bankParentProvince,
        bankValues: new Set(),
      };
      option.bankValues.add(resolveIssuerValue(card.bankParent));
      map.set(card.bankParentProvince, option);
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
    const addOption = (value, label, logoUrl) => {
      if (!value) return;
      const option = map.get(value) || { value, label, logoUrl };
      if (!option.logoUrl && logoUrl) option.logoUrl = logoUrl;
      map.set(value, option);
    };

    cards.forEach((card) => {
      if (card.region !== region) return;
      if (region === "CN" && province && card.province !== province) return;
      const value = getBankValue(card);
      if (!value) return;
      addOption(
        value,
        card.bankNativeName || card.bankEnglishName || value,
        card.bankLogoUrl || "",
      );
    });
    cards.forEach((card) => {
      if (card.bankParentRegion !== region || !card.bankParent) return;
      if (
        region === "CN" &&
        province &&
        card.bankParentProvince !== province
      ) {
        return;
      }
      addOption(
        resolveIssuerValue(card.bankParent),
        card.bankParentName || card.bankParent,
        card.bankParentLogoUrl || "",
      );
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

  function applyUrlState() {
    const state = getUrlState();
    searchValue = state.search.trim().toLowerCase();
    if (searchInput) searchInput.value = state.search;

    if (organizationFilter) {
      const organizationValues = [...organizationFilter.options].map(
        (option) => option.value,
      );
      organizationFilter.value = organizationValues.includes(state.organization)
        ? state.organization
        : "all";
    }

    issuerValue = normalizeIssuerValue(state.issuer);
    issuerHoverTag = issuerValue.startsWith("tag:")
      ? issuerValue.slice(4)
      : issuerValue.startsWith("bank:")
        ? getIssuerOptions().find((item) => item.value === issuerValue.slice(5))?.tag || "all"
        : "all";
    if (issuerLabel) issuerLabel.textContent = getIssuerLabel(issuerValue);

    setRegionFilterValue(state.region);
    if (typeFilter) {
      typeFilter.value = TYPE_OPTIONS.includes(state.type) ? state.type : "all";
    }
    pageSize = state.pageSize;
    currentPage = state.page;
    if (pageSizeSelect) pageSizeSelect.value = String(pageSize);
  }

  function closePanel(panel, trigger) {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function regionMatches(card) {
    if (regionFilterValue === "all") return true;
    const regionBank = parseRegionBankValue(regionFilterValue);
    if (regionBank) {
      return bankMatchesRecursive(card, regionBank.bank);
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
      card.bin,
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

  function getTotalPages(filteredCount = filteredCards().length) {
    return pageSize === "all"
      ? 1
      : Math.max(1, Math.ceil(filteredCount / pageSize));
  }

  function jumpToPage(value) {
    const totalPages = getTotalPages();
    const requestedPage = Number.parseInt(value, 10);
    if (!Number.isFinite(requestedPage)) {
      if (pageInput) pageInput.value = String(currentPage);
      return;
    }
    currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function formatRegion(card) {
    const label = regionLabels.get(card.region) || card.region || "-";
    return card.region === "CN" && card.province
      ? `${label} / ${card.province}`
      : label;
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function getImageSizeKeys(card, sourceUrl) {
    if (sourceUrl === card?.altImageUrl) {
      return {
        loadedKey: "altFileSizeLoaded",
        bytesKey: "altFileSizeBytes",
        promiseKey: "altFileSizePromise",
      };
    }
    if (sourceUrl === card?.backImageUrl) {
      return {
        loadedKey: "backFileSizeLoaded",
        bytesKey: "backFileSizeBytes",
        promiseKey: "backFileSizePromise",
      };
    }
    return {
      loadedKey: "fileSizeLoaded",
      bytesKey: "fileSizeBytes",
      promiseKey: "fileSizePromise",
    };
  }

  function getImageSizeBytes(card, sourceUrl) {
    return card?.[getImageSizeKeys(card, sourceUrl).bytesKey];
  }

  async function loadImageSize(card, sourceUrl = card?.image) {
    if (!card || !sourceUrl) return 0;
    const { loadedKey, bytesKey, promiseKey } = getImageSizeKeys(
      card,
      sourceUrl,
    );
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
        return card[bytesKey];
      });
    return card[promiseKey];
  }

  async function loadCardImageSize(card) {
    return loadImageSize(card, card?.image);
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

  function updateLightboxThumbs() {
    lightboxThumbs?.querySelectorAll("button").forEach((button, index) => {
      const active = index === lightboxIndex;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function renderLightboxThumbs() {
    if (!lightboxThumbs) return;
    lightboxThumbs.innerHTML = "";
    lightboxSources.forEach((source, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-lightbox-thumb";
      const label =
        index === 0
          ? "卡面正面"
          : source === lightboxCard?.backImageUrl
            ? "卡面背面"
            : "卡面反面";
      button.setAttribute("aria-label", label);
      button.addEventListener("click", () => {
        lightboxIndex = index;
        renderLightboxImage();
      });

      const image = document.createElement("img");
      image.src = source;
      image.alt = "";
      image.loading = "eager";
      image.decoding = "async";
      button.append(image);
      lightboxThumbs.append(button);
    });
    updateLightboxThumbs();
  }

  function updateLightboxMeta(card, sourceUrl = card?.image) {
    if (!lightboxMeta || !lightboxImage) return;
    const resolution =
      lightboxImage.naturalWidth && lightboxImage.naturalHeight
        ? `${lightboxImage.naturalWidth}×${lightboxImage.naturalHeight}`
        : "";
    const size = formatBytes(getImageSizeBytes(card, sourceUrl));
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
    const renderId = ++lightboxRenderId;
    lightboxImage.classList.add("is-loading");
    lightboxImage.loading = "eager";
    lightboxImage.decoding = "async";
    const isCurrentImage = () =>
      renderId === lightboxRenderId &&
      sameImageUrl(lightboxImage.currentSrc || lightboxImage.src, sourceUrl);
    lightboxImage.onload = () => {
      if (isCurrentImage()) {
        lightboxImage.classList.remove("is-loading");
        updateLightboxMeta(lightboxCard, sourceUrl);
      }
    };
    lightboxImage.onerror = () => {
      if (isCurrentImage()) {
        lightboxImage.classList.remove("is-loading");
        if (lightboxMeta) lightboxMeta.textContent = "";
      }
    };
    lightboxImage.src = sourceUrl;
    lightboxImage.alt = `${lightboxCard.name} 卡面`;
    updateLightboxMeta(lightboxCard, sourceUrl);
    void loadImageSize(lightboxCard, sourceUrl).then(() =>
      renderId === lightboxRenderId && updateLightboxMeta(lightboxCard, sourceUrl),
    );
    updateLightboxControls();
    updateLightboxThumbs();
  }

  function openLightbox(card, sourceImage) {
    if (!lightbox || !lightboxImage) return;
    lightboxCard = card;
    lightboxSources = [
      ...new Set(
        [card.image, card.altImageUrl, card.backImageUrl].filter(Boolean),
      ),
    ];
    const sourceUrl =
      sourceImage?.currentSrc || sourceImage?.src || card.image || "";
    const sourceIndex = lightboxSources.findIndex((item) =>
      sameImageUrl(item, sourceUrl),
    );
    lightboxIndex = sourceIndex >= 0 ? sourceIndex : 0;
    lightboxImage.classList.remove("is-portrait");
    renderLightboxThumbs();
    if (typeof lightbox.showModal === "function") lightbox.showModal();
    else lightbox.setAttribute("open", "");
    renderLightboxImage();
  }

  function closeLightbox() {
    lightboxRenderId += 1;
    if (typeof lightbox?.close === "function") lightbox.close();
    else lightbox?.removeAttribute("open");
    if (lightboxImage) {
      lightboxImage.classList.add("is-loading");
      lightboxImage.onload = null;
      lightboxImage.onerror = null;
      lightboxImage.removeAttribute("src");
    }
    if (lightboxMeta) lightboxMeta.textContent = "";
    lightboxCard = null;
    lightboxSources = [];
    lightboxIndex = 0;
    if (lightboxThumbs) lightboxThumbs.innerHTML = "";
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
    const tierClass =
      card.tier === "Titanium"
        ? "tier-accent-spectrum"
        : getTierAccentClass(card.tier, "tier-accent-none");
    article.className = `gallery-card ${tierClass}`;

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

    body.append(cardMeta);

    article.append(figure, body);
    return article;
  }

  function render() {
    if (!grid) return;
    const filtered = filteredCards().sort((a, b) =>
      compareCardsByOrganizationAndTier(a, b, { tierOrderMap: TIER_ORDER_MAP }),
    );
    const totalPages = getTotalPages(filtered.length);
    currentPage = Math.min(currentPage, totalPages);
    updateUrlState();
    const start = pageSize === "all" ? 0 : (currentPage - 1) * pageSize;
    const visible =
      pageSize === "all" ? filtered : filtered.slice(start, start + pageSize);
    grid.innerHTML = "";
    visible.forEach((card) => grid.append(renderCard(card)));
    empty.hidden = visible.length > 0;
    if (stats)
      stats.textContent = filtered.length
        ? `${start + 1}-${start + visible.length} / ${filtered.length} 张卡面`
        : "0 / 0 张卡面";
    if (pageLabel)
      pageLabel.textContent = `第 ${currentPage} / ${totalPages} 页`;
    if (firstPage) firstPage.disabled = currentPage <= 1;
    if (previousPage) previousPage.disabled = currentPage <= 1;
    if (nextPage) nextPage.disabled = currentPage >= totalPages;
    if (lastPage) lastPage.disabled = currentPage >= totalPages;
    if (pageInput) {
      pageInput.value = String(currentPage);
      pageInput.max = String(totalPages);
    }
    if (pageSizeSelect) pageSizeSelect.value = String(pageSize);
  }

  async function reloadIssuerInfo() {
    const payload = data.issuerInfoUrl
      ? await fetchJsonSafe(data.issuerInfoUrl, { warn: true })
      : null;
    cards.length = 0;
    mapIssuerCards(normalizeIssuerInfo(payload));
    updateOrganizationOptions();
    applyUrlState();
    renderIssuerGroups();
    renderRegionGroups();
    renderRegionFilterProvinces(regionFilterHoverRegion);
    renderRegionFilterIssuers(
      regionFilterHoverRegion,
      regionFilterHoverProvince,
    );
    render();
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
      pageSize = pageSizeSelect.value === "all"
        ? "all"
        : Number(pageSizeSelect.value) || 12;
      currentPage = 1;
      render();
    });
    firstPage?.addEventListener("click", () => {
      if (currentPage <= 1) return;
      currentPage = 1;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    previousPage?.addEventListener("click", () => {
      if (currentPage <= 1) return;
      currentPage -= 1;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    nextPage?.addEventListener("click", () => {
      const totalPages = getTotalPages();
      if (currentPage >= totalPages) return;
      currentPage += 1;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    lastPage?.addEventListener("click", () => {
      const totalPages = getTotalPages();
      if (currentPage >= totalPages) return;
      currentPage = totalPages;
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    pageJump?.addEventListener("click", () => {
      jumpToPage(pageInput?.value);
    });
    pageInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        jumpToPage(pageInput.value);
      }
    });
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
