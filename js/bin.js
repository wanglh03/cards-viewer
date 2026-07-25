(() => {
  const cardUtils = window.cardUtils || {};
  const {
    loadCardsFromAssets,
    organizationIconUrl,
    resolveImageUrl,
    compareText,
    getTierAccentClass,
    formatBinDisplay,
  } = cardUtils;

  const tbody = document.querySelector("#binTableBody");
  const template = document.querySelector("#binRowTemplate");
  const typeFilter = document.querySelector("#binTypeFilter");

  let rows = [];

  function mapBinRow(bankKey, bankInfo, entry) {
    const cardMeta = entry.card || entry;
    const bin = cardMeta.bin;

    return {
      bin,
      length: cardMeta.length,
      organization: cardMeta.organization,
      tier: cardMeta.tier,
      type: cardMeta.type,
      typeKey: cardMeta.type,
      issuer: String(
        bankInfo.native_name || bankInfo.english_name || bankKey || "",
      ),
      name: cardMeta.name,
      organizationIcon: organizationIconUrl(cardMeta.organization),
      issuerLogo: resolveImageUrl(bankKey, String(bankInfo.logo || "")),
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
    row.querySelector(".bin-name-cell").textContent = item.names.join("\n");
    return row;
  }

  function renderRows() {
    const typeValue = typeFilter?.value || "all";
    const filteredRows = rows.filter(
      (item) => typeValue === "all" || item.typeKey === typeValue,
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
    renderRows();
  }

  typeFilter?.addEventListener("change", renderRows);

  init();
})();
