let cards = [];
let pendingOrganizationFilterValue = "all";
let pendingIssuerFilterValue = "all";
let pendingRegionFilterValue = "all";
let initialDataLoaded = false;

const cardUtils = window.cardUtils || {};
const currencyUtils = window.currencyUtils || {};
const batchUtils = window.batchUtils || {};
const cardConfig = window.cardConfig || {};

const { ORGANIZATIONS = [], TIER_ORDER_MAP } = cardConfig;
const ORGANIZATION_ORDER = ORGANIZATIONS.filter(({ credit }) => credit).map(
  ({ name }) => name,
);

const {
  firstDefined,
  loadCardsFromAssetsProgressively,
  compareText,
  formatCell,
  formatBinDisplay,
  queueImageLoad,
  activateDeferredImages,
  createOption,
  appendBankNameContent,
  sortOrganizationOptions,
  sortCardsByOrganizationAndTier,
  createCardBase,
} = cardUtils;

const { parseCurrencyAmount, formatCurrencyDisplay } = currencyUtils;
const { appendInBatches } = batchUtils;

const tbody = document.querySelector("#creditTableBody");
const template = document.querySelector("#creditRowTemplate");
const searchInput = document.querySelector("#tableSearchInput");
const organizationFilter = document.querySelector("#creditOrganizationFilter");
const issuerFilter = document.querySelector("#creditIssuerFilter");
const regionFilter = document.querySelector("#creditRegionFilter");
const imageLightbox = document.querySelector("#imageLightbox");
const lightboxImage = document.querySelector("#lightboxImage");

function normalizeRegionQueryValue(value) {
  const text = String(value || "");
  if (!text || text === "all") return "all";
  return /^[A-Za-z]{2}$/.test(text) ? text.toUpperCase() : "all";
}

function getUrlState() {
  const params = new URLSearchParams(window.location.search);
  return {
    search: params.get("search") || "",
    organization: params.get("organization") || "all",
    issuer: params.get("issuer") || "all",
    region: normalizeRegionQueryValue(params.get("region") || "all"),
  };
}

function applyUrlState(state = getUrlState()) {
  if (searchInput) searchInput.value = state.search;
  pendingOrganizationFilterValue = state.organization || "all";
  pendingIssuerFilterValue = state.issuer || "all";
  pendingRegionFilterValue = state.region || "all";
}

function updateUrlState() {
  const params = new URLSearchParams();
  const search = String(searchInput?.value || "").trim();
  const organization =
    initialDataLoaded || pendingOrganizationFilterValue === "all"
      ? organizationFilter?.value || "all"
      : pendingOrganizationFilterValue || "all";
  const issuer =
    initialDataLoaded || pendingIssuerFilterValue === "all"
      ? issuerFilter?.value || "all"
      : pendingIssuerFilterValue || "all";
  const region =
    initialDataLoaded || pendingRegionFilterValue === "all"
      ? regionFilter?.value || "all"
      : pendingRegionFilterValue || "all";

  if (search) params.set("search", search);
  if (issuer !== "all") params.set("issuer", issuer);
  if (organization !== "all") params.set("organization", organization);
  if (region !== "all") params.set("region", normalizeRegionQueryValue(region));

  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", nextUrl);
}

function sortCreditCards(list) {
  return sortCardsByOrganizationAndTier(list, {
    organizationOrder: ORGANIZATION_ORDER,
    tierOrderMap: TIER_ORDER_MAP,
  });
}

function isSupplementaryCard(cardMeta) {
  const explicitFlag = firstDefined(cardMeta.sub_card);

  if (typeof explicitFlag === "boolean") return explicitFlag;

  const desc = String(cardMeta.desc || "");
  return desc.includes("附卡");
}

function normalizeLimitMap(limitValue, fallbackCurrency) {
  if (!limitValue || typeof limitValue === "string") {
    const text = String(limitValue || "");
    if (!text) return {};
    const fallbackCurrencyCode = fallbackCurrency[0];
    return { [fallbackCurrencyCode]: text };
  }

  if (typeof limitValue !== "object" || Array.isArray(limitValue)) return {};

  return Object.entries(limitValue).reduce((acc, [currency, amount]) => {
    const code = currency;
    const value = amount;
    if (!code || !value) return acc;
    acc[code] = value;
    return acc;
  }, {});
}

function sumCreditLimits(list) {
  const totals = {};
  const sharedLimitBanks = new Set();

  list
    .filter((card) => !card.supplementary)
    .forEach((card) => {
      if (card.sharedLimit && card.bankKey) {
        if (sharedLimitBanks.has(card.bankKey)) return;
        sharedLimitBanks.add(card.bankKey);
      }

      Object.entries(card.limitMap || {}).forEach(([currency, amount]) => {
        const value = parseCurrencyAmount(amount);
        if (value <= 0) return;
        totals[currency] = (totals[currency] || 0) + value;
      });
    });

  return totals;
}

function renderCreditStats(list) {
  const statsRoot = document.querySelector("#stats");
  if (!statsRoot) return;

  const totals = sumCreditLimits(list);
  const entries = Object.entries(totals);
  const display = entries.length
    ? entries
        .map(([currency, amount]) => formatCurrencyDisplay(currency, amount))
        .join(" + ")
    : "-";

  statsRoot.innerHTML = `
    <div class="stat stat-credit-total" tabindex="0" role="button" aria-label="总授信 ${display}">
      <strong>${display}</strong>
      <span>总授信</span>
    </div>
  `;
}

function renderLimitCell(cell, limitMap, sharedLimit = false) {
  cell.innerHTML = "";
  const values = Object.entries(limitMap || {})
    .filter(([, amount]) => parseCurrencyAmount(amount) > 0)
    .map(([currency, amount]) => {
      const formatted = formatCurrencyDisplay(currency, amount);
      return sharedLimit ? `共享${formatted}` : formatted;
    });

  if (!values.length) {
    cell.textContent = "-";
    return;
  }

  const list = document.createElement("div");
  list.className = "limit-list";

  values.forEach((value) => {
    const item = document.createElement("div");
    item.className = "limit-item";
    item.textContent = value;
    list.append(item);
  });

  cell.append(list);
}

function buildCreditRow(card) {
  const row = template.content.firstElementChild.cloneNode(true);
  const image = row.querySelector("img");
  queueImageLoad(image, card.image);
  image.alt = card.name;
  image.title = "点击放大";
  image.addEventListener("click", (event) => {
    event.stopPropagation();
    openLightbox(card);
  });

  const organizationCell = row.querySelector(".card-organization-cell");
  if (card.organizationIcon) {
    const organizationIcon = document.createElement("img");
    organizationIcon.className = "organization-icon";
    organizationIcon.alt = card.organization;
    organizationIcon.title = card.organization;
    organizationIcon.loading = "lazy";
    queueImageLoad(organizationIcon, card.organizationIcon);
    organizationCell.append(organizationIcon);
  } else {
    organizationCell.textContent = card.organization;
  }

  row.querySelector(".card-name-cell").textContent = card.name;
  row.querySelector(".card-bin-cell").textContent = formatBinDisplay(card.bin);
  row.querySelector(".card-tier-cell").textContent = formatCell(card.tier);
  const issuerCell = row.querySelector(".card-issuer-cell");
  if (issuerCell) {
    issuerCell.innerHTML = "";
    appendBankNameContent(
      issuerCell,
      formatCell(card.issuer),
      card.bankLogoUrl,
      false,
    );
  }
  row.querySelector(".card-region-cell").textContent = formatCell(card.region);
  renderLimitCell(
    row.querySelector(".card-limit-cell"),
    card.limitMap,
    card.sharedLimit,
  );
  row.querySelector(".card-billing-day-cell").textContent = formatCell(
    card.billingDay,
  );
  row.querySelector(".card-due-day-cell").textContent = formatCell(card.dueDay);
  row.querySelector(".card-annual-fee-cell").textContent = formatCell(
    card.annualFee,
  );
  row.querySelector(".card-ftf-cell").textContent = formatCell(card.ftf);
  row.querySelector(".card-benefit-cell").textContent = formatCell(
    card.benefit,
  );
  return row;
}

function mapCreditCard(bankKey, bankInfo, entry) {
  const cardMeta = entry.card || entry;
  if (cardMeta.type !== "Credit") return null;

  const bankBillingDay = firstDefined(bankInfo.billing_day);
  const bankDueDay = firstDefined(bankInfo.due_day);
  const bankLimit = firstDefined(bankInfo.limit);
  const limitValue = bankLimit != null ? bankLimit : cardMeta.limit;
  const sharedLimit = bankLimit != null;

  const name = cardMeta.name;
  const supplementary = isSupplementaryCard(cardMeta);
  const cardName = supplementary ? `${name}（附卡）` : name;
  const baseCard = createCardBase(bankKey, bankInfo, cardMeta, {
    displayName: cardName,
    preferAltImage: true,
  });
  const issuer = baseCard.issuer;
  const issuerValue = bankInfo.english_name || bankKey || issuer;
  return {
    ...baseCard,
    issuerValue,
    limitMap: normalizeLimitMap(limitValue, cardMeta.currency),
    sharedLimit,
    supplementary,
    billingDay:
      bankBillingDay != null
        ? bankBillingDay
        : firstDefined(cardMeta.billing_day),
    dueDay: bankDueDay != null ? bankDueDay : firstDefined(cardMeta.due_day),
    annualFee: firstDefined(cardMeta.annual_fee),
    ftf: firstDefined(cardMeta.ftf),
    benefit: cardMeta.benefit,
    searchText: [
      cardName,
      baseCard.bin,
      baseCard.organization,
      baseCard.tier,
      issuer,
      baseCard.region,
      cardMeta.benefit,
    ]
      .join(" ")
      .toLowerCase(),
  };
}

function updateFilterOptions() {
  const currentOrganization =
    pendingOrganizationFilterValue || organizationFilter?.value || "all";
  const currentIssuer =
    pendingIssuerFilterValue || issuerFilter?.value || "all";
  const currentRegion =
    pendingRegionFilterValue || regionFilter?.value || "all";

  const organizations = sortOrganizationOptions(
    Array.from(new Set(cards.map((card) => card.organization).filter(Boolean))),
    ORGANIZATION_ORDER,
  );
  const issuers = Array.from(
    new Map(
      cards
        .filter((card) => card.issuerValue)
        .map((card) => [
          card.issuerValue,
          { value: card.issuerValue, label: card.issuer || card.issuerValue },
        ]),
    ).values(),
  ).sort((a, b) => compareText(a.label, b.label));
  const regions = Array.from(
    new Set(cards.map((card) => card.region).filter(Boolean)),
  ).sort((a, b) => compareText(a, b));

  if (organizationFilter) {
    organizationFilter.innerHTML = "";
    organizationFilter.append(createOption("all", "全部卡组织"));
    organizations.forEach((item) => {
      organizationFilter.append(createOption(item, item));
    });
    if (
      !initialDataLoaded &&
      currentOrganization !== "all" &&
      !organizations.includes(currentOrganization)
    ) {
      pendingOrganizationFilterValue = currentOrganization;
    } else {
      organizationFilter.value = organizations.includes(currentOrganization)
        ? currentOrganization
        : "all";
      pendingOrganizationFilterValue = organizationFilter.value;
    }
  }

  if (issuerFilter) {
    issuerFilter.innerHTML = "";
    issuerFilter.append(createOption("all", "全部发行方"));
    issuers.forEach((item) => {
      issuerFilter.append(createOption(item.value, item.label));
    });
    if (
      !initialDataLoaded &&
      currentIssuer !== "all" &&
      !issuers.some((item) => item.value === currentIssuer)
    ) {
      pendingIssuerFilterValue = currentIssuer;
    } else {
      issuerFilter.value = issuers.some((item) => item.value === currentIssuer)
        ? currentIssuer
        : "all";
      pendingIssuerFilterValue = issuerFilter.value;
    }
  }

  if (regionFilter) {
    regionFilter.innerHTML = "";
    regionFilter.append(createOption("all", "全部"));
    regions.forEach((item) => {
      regionFilter.append(createOption(item, item));
    });
    if (
      !initialDataLoaded &&
      currentRegion !== "all" &&
      !regions.includes(currentRegion)
    ) {
      pendingRegionFilterValue = currentRegion;
    } else {
      regionFilter.value = regions.includes(currentRegion)
        ? currentRegion
        : "all";
      pendingRegionFilterValue = regionFilter.value;
    }
  }
}

function openLightbox(card) {
  if (!card || !card.image || !imageLightbox || !lightboxImage) return;
  lightboxImage.src = card.image;
  lightboxImage.alt = `${card.name} 卡面`;
  imageLightbox.hidden = false;
}

function closeLightbox() {
  if (!imageLightbox || !lightboxImage) return;
  imageLightbox.hidden = true;
  lightboxImage.src = "";
  lightboxImage.alt = "";
}

function renderRows() {
  const search = String(searchInput?.value || "")
    .trim()
    .toLowerCase();
  const organizationValue = organizationFilter?.value || "all";
  const issuerValue = issuerFilter?.value || "all";
  const regionValue = regionFilter?.value || "all";

  if (initialDataLoaded) {
    pendingOrganizationFilterValue = organizationValue;
    pendingIssuerFilterValue = issuerValue;
    pendingRegionFilterValue = regionValue;
  }
  updateUrlState();

  tbody.innerHTML = "";

  const filtered = sortCreditCards(
    cards.filter(
      (card) =>
        (organizationValue === "all" ||
          card.organization === organizationValue) &&
        (issuerValue === "all" || card.issuerValue === issuerValue) &&
        (regionValue === "all" || card.region === regionValue) &&
        (!search || card.searchText.includes(search)),
    ),
  );

  if (!filtered.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML =
      '<td class="empty-state" colspan="13">暂无符合条件的信用卡。</td>';
    tbody.append(emptyRow);
    return;
  }

  appendInBatches(filtered, buildCreditRow, tbody, {
    batchSize: 10,
    afterChunk(nodes) {
      window.requestAnimationFrame(() => {
        nodes.forEach((node) => activateDeferredImages(node));
      });
    },
  });
}

async function init() {
  initialDataLoaded = false;
  applyUrlState();
  cards = [];
  renderCreditStats(cards);
  updateFilterOptions();
  renderRows();

  await loadCardsFromAssetsProgressively(mapCreditCard, {
    onBatch(batch) {
      const activeBatch = batch.filter((card) => card.status === "active");
      if (!activeBatch.length) return;
      cards = sortCreditCards(cards.concat(activeBatch));
      renderCreditStats(cards);
      updateFilterOptions();
      renderRows();
    },
  });

  initialDataLoaded = true;
  updateFilterOptions();
  renderRows();
}

searchInput?.addEventListener("input", renderRows);
[organizationFilter, issuerFilter, regionFilter].forEach((control) => {
  control?.addEventListener("change", renderRows);
});

if (imageLightbox) {
  imageLightbox.addEventListener("click", (event) => {
    const target = event.target;
    if (target instanceof Element && target.closest("[data-close-lightbox]")) {
      closeLightbox();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && imageLightbox && !imageLightbox.hidden) {
    closeLightbox();
  }
});

window.addEventListener("popstate", () => {
  applyUrlState();
  updateFilterOptions();
  renderRows();
});

init();
