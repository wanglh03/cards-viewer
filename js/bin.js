(() => {
  const cardUtils = window.cardUtils || {};
  const {
    loadCardsFromAssets,
    organizationIconUrl,
    resolveIssuerLogoUrl,
    compareText,
    getTierAccentClass,
    formatBinDisplay,
    getOrganizationRank,
    appendBankNameContent,
    normalizeBankTag,
    createIssuerFilterModel,
  } = cardUtils;

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

  const tbody = document.querySelector("#binTableBody");
  const template = document.querySelector("#binRowTemplate");
  const searchInput = document.querySelector("#binSearchInput");
  const issuerWrap = document.querySelector("#binIssuerFilterWrap");
  const issuerTrigger = document.querySelector("#binIssuerFilterTrigger");
  const issuerLabel = document.querySelector("#binIssuerFilterLabel");
  const issuerPanel = document.querySelector("#binIssuerFilterPanel");
  const issuerGroups = document.querySelector("#binIssuerFilterGroups");
  const issuerList = document.querySelector("#binIssuerFilterIssuers");
  const organizationFilter = document.querySelector(
    "#binOrganizationFilter",
  );
  const typeFilter = document.querySelector("#binTypeFilter");

  let rows = [];
  let searchValue = "";
  let issuerValue = "all";
  let issuerHoverTag = "all";

  function mapBinRow(bankKey, bankInfo, entry) {
    const cardMeta = entry.card || entry;
    const bin = String(cardMeta.bin ?? "").trim();
    if (!bin) return null;

    return {
      bin,
      length: cardMeta.length,
      organization: cardMeta.organization,
      tier: cardMeta.tier,
      type: cardMeta.type,
      typeKey: cardMeta.type,
      bankKey,
      bankTag: normalizeBankTag(bankInfo.tag),
      bankEnglishName: bankInfo.english_name || bankKey,
      bankParent: bankInfo.parent || "",
      bankParentTag: bankInfo.parentBankTag || "",
      bankParentName: bankInfo.parentBankName || "",
      bankParentLogoUrl: bankInfo.parentBankLogoUrl || "",
      issuer: String(
        bankInfo.native_name || bankInfo.english_name || bankKey || "",
      ),
      name: cardMeta.name,
      organizationIcon: organizationIconUrl(cardMeta.organization),
      issuerLogo: resolveIssuerLogoUrl(
        bankKey,
        String(bankInfo.logo || ""),
        bankInfo.region,
      ),
    };
  }

  function sortRows(rows) {
    return rows.slice().sort((a, b) => {
      const binDiff = a.bin.localeCompare(b.bin, "en", {
        numeric: false,
        sensitivity: "base",
      });
      if (binDiff !== 0) return binDiff;

      const organizationDiff = compareText(a.organization, b.organization);
      if (organizationDiff !== 0) return organizationDiff;

      const tierDiff = compareText(a.tier, b.tier);
      if (tierDiff !== 0) return tierDiff;

      const typeDiff = compareText(a.type, b.type);
      if (typeDiff !== 0) return typeDiff;

      const issuerDiff = compareText(a.issuer, b.issuer);
      if (issuerDiff !== 0) return issuerDiff;

      return compareText(a.name, b.name);
    });
  }

  function groupRowsByBin(rows) {
    const groups = [];

    rows.forEach((item) => {
      const lastGroup = groups[groups.length - 1];
      if (lastGroup && lastGroup.bin === item.bin) {
        if (item.tier && !lastGroup.tiers.includes(item.tier)) {
          lastGroup.tiers.push(item.tier);
        }
        lastGroup.names.push(item.name);
        return;
      }

      groups.push({
        ...item,
        tiers: item.tier ? [item.tier] : [],
        names: [item.name],
      });
    });

    return groups;
  }

  function getRowTierAccentClass(tiers) {
    const values = Array.isArray(tiers) ? tiers : [tiers];
    const accents = values
      .map((value) => getTierAccentClass(value))
      .filter(Boolean);

    if (accents.includes("tier-accent-diamond")) {
      return "tier-accent-diamond";
    }
    if (accents.includes("tier-accent-spectrum")) {
      return "tier-accent-spectrum";
    }
    if (accents.includes("tier-accent-platinum")) {
      return "tier-accent-platinum";
    }
    if (accents.includes("tier-accent-gold")) {
      return "tier-accent-gold";
    }

    return "";
  }

  function buildRow(item) {
    const row = template.content.firstElementChild.cloneNode(true);
    const tierAccentClass = getRowTierAccentClass(item.tiers || item.tier);
    if (tierAccentClass) {
      row.classList.add(tierAccentClass);
    }

    row.querySelector(".bin-code-cell").textContent = formatBinDisplay(item.bin);
    const configuredLength = String(item.length || "").trim();
    row.querySelector(".bin-length-cell").textContent = configuredLength
      ? configuredLength
      : String(item.organization === "AMEX" ? 15 : 16);

    const organizationCell = row.querySelector(".bin-organization-cell");
    if (item.organizationIcon) {
      const image = document.createElement("img");
      image.className = "organization-icon";
      image.alt = item.organization;
      image.src = item.organizationIcon;
      organizationCell.append(image);
    } else {
      organizationCell.textContent = item.organization;
    }

    row.querySelector(".bin-tier-cell").textContent =
      item.tiers?.filter(Boolean).join("\n") || item.tier || "-";
    row.querySelector(".bin-type-cell").textContent = item.type;
    const issuerCell = row.querySelector(".bin-issuer-cell");
    issuerCell.innerHTML = "";
    if (item.issuerLogo) {
      const image = document.createElement("img");
      image.className = "bank-logo-inline";
      image.alt = "";
      image.setAttribute("aria-hidden", "true");
      image.src = item.issuerLogo;
      issuerCell.append(image);
    }
    const issuerText = document.createElement("span");
    issuerText.textContent = item.issuer || "-";
    issuerCell.append(issuerText);
    row.querySelector(".bin-name-cell").textContent = item.names.join("    ");
    return row;
  }

  function updateOrganizationOptions() {
    const current = organizationFilter?.value || "all";
    const options = [
      ...new Set(rows.map((row) => row.organization).filter(Boolean)),
    ].sort(
      (a, b) =>
        getOrganizationRank(a) - getOrganizationRank(b) || compareText(a, b),
    );
    if (!organizationFilter) return;

    organizationFilter.innerHTML = '<option value="all">全部卡组织</option>';
    options.forEach((organization) => {
      const option = document.createElement("option");
      option.value = organization;
      option.textContent = organization;
      organizationFilter.append(option);
    });
    organizationFilter.value = options.includes(current) ? current : "all";
  }

  function getBankValue(row) {
    return row.bankEnglishName || row.bankKey;
  }

  const issuerFilterModel = createIssuerFilterModel(() => rows, {
    getValue: getBankValue,
    getTag: (row) => row.bankTag,
    getParent: (row) => row.bankParent,
    getLabel: (row, value) => row.issuer || row.bankEnglishName || value,
    getLogo: (row) => row.issuerLogo || "",
    getParentTag: (row) => row.bankParentTag,
    getParentLabel: (row) => row.bankParentName,
    getParentLogo: (row) => row.bankParentLogoUrl,
  });

  function bankMatchesRecursive(row, target) {
    return issuerFilterModel.matches(row, target);
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

  function issuerMatches(row, value) {
    if (value === "all") return true;
    if (value.startsWith("tag:")) return row.bankTag === value.slice(4);
    if (!value.startsWith("bank:")) return true;
    return bankMatchesRecursive(row, value.slice(5));
  }

  function getIssuerLabel(value) {
    if (value === "all") return "全部";
    if (value.startsWith("tag:")) {
      return BANK_TAG_LABELS[value.slice(4)] || value.slice(4);
    }
    return (
      getIssuerOptions().find((item) => item.value === value.slice(5))?.label ||
      "全部"
    );
  }

  function closeIssuerPanel() {
    if (!issuerPanel || !issuerTrigger) return;
    issuerPanel.hidden = true;
    issuerTrigger.setAttribute("aria-expanded", "false");
  }

  function openIssuerPanel() {
    if (!issuerPanel || !issuerTrigger) return;
    renderIssuerGroups();
    renderIssuerList(issuerHoverTag);
    issuerPanel.hidden = false;
    issuerTrigger.setAttribute("aria-expanded", "true");
  }

  function updateIssuerGroupState() {
    issuerGroups?.querySelectorAll(".issuer-filter-item").forEach((button) => {
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
    button.dataset.value = value;
    button.addEventListener("click", onClick);
    return button;
  }

  function setIssuer(value) {
    issuerValue = value;
    if (value.startsWith("tag:")) issuerHoverTag = value.slice(4);
    else if (value === "all") issuerHoverTag = "all";
    else
      issuerHoverTag =
        getIssuerOptions().find((item) => item.value === value.slice(5))?.tag ||
        "all";
    if (issuerLabel) issuerLabel.textContent = getIssuerLabel(value);
    renderIssuerList(issuerHoverTag);
    renderRows();
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
          `bank:${item.value}`,
          issuerValue === `bank:${item.value}`,
          () => {
            setIssuer(`bank:${item.value}`);
            closeIssuerPanel();
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
      `${getIssuerLabel("all")} (${options.length})`,
      "all",
      issuerValue === "all",
      () => {
        setIssuer("all");
        closeIssuerPanel();
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
        `${BANK_TAG_LABELS[tag] || tag} (${count})`,
        `tag:${tag}`,
        issuerValue === `tag:${tag}` || issuerHoverTag === tag,
        () => {
          setIssuer(`tag:${tag}`);
          closeIssuerPanel();
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

  function rowMatchesSearch(item) {
    if (!searchValue) return true;
    return [
      item.bin,
      item.organization,
      item.tier,
      item.type,
      item.issuer,
      item.bankEnglishName,
      item.name,
    ]
      .join(" ")
      .toLowerCase()
      .includes(searchValue);
  }

  function renderRows() {
    const organizationValue = organizationFilter?.value || "all";
    const typeValue = typeFilter?.value || "all";
    const filteredRows = rows.filter(
      (item) =>
        rowMatchesSearch(item) &&
        issuerMatches(item, issuerValue) &&
        (organizationValue === "all" ||
          item.organization === organizationValue) &&
        (typeValue === "all" || item.typeKey === typeValue),
    );
    const grouped = groupRowsByBin(sortRows(filteredRows));

    tbody.innerHTML = "";
    if (!grouped.length) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML =
        '<td class="empty-state" colspan="7">暂无符合条件的卡 BIN 数据。</td>';
      tbody.append(emptyRow);
      return;
    }

    const fragment = document.createDocumentFragment();
    grouped.forEach((item) => {
      fragment.append(buildRow(item));
    });
    tbody.append(fragment);
  }

  async function init() {
    if (!tbody) return;

    rows = await loadCardsFromAssets(mapBinRow);
    updateOrganizationOptions();
    renderIssuerGroups();
    renderRows();
  }

  searchInput?.addEventListener("input", () => {
    searchValue = searchInput.value.trim().toLowerCase();
    renderRows();
  });
  organizationFilter?.addEventListener("change", renderRows);
  typeFilter?.addEventListener("change", renderRows);
  issuerTrigger?.addEventListener("click", () => {
    if (issuerPanel?.hidden) openIssuerPanel();
    else closeIssuerPanel();
  });
  document.addEventListener("click", (event) => {
    if (issuerWrap && !issuerWrap.contains(event.target)) closeIssuerPanel();
  });

  init();
})();
