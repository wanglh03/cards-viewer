let cards = [];
const cardUtils = window.cardUtils || {};
const {
  sanitizeFilename,
  resolveImageUrl,
  toArray,
  firstDefined,
  brandIconUrl,
  loadCardsFromAssets,
} = cardUtils;

function parseDay(value) {
  const text = String(value || "").trim();
  if (!text) return Number.POSITIVE_INFINITY;
  const match = text.match(/\d+/);
  if (!match) return Number.POSITIVE_INFINITY;
  const num = Number.parseInt(match[0], 10);
  return Number.isNaN(num) ? Number.POSITIVE_INFINITY : num;
}

function compareText(a, b) {
  return String(a || "").localeCompare(String(b || ""), "zh-Hans-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

function sortCreditCards(list) {
  return list.slice().sort((a, b) => {
    const dayDiff = parseDay(a.dueDay) - parseDay(b.dueDay);
    if (dayDiff !== 0) return dayDiff;

    const issuerDiff = compareText(a.issuer, b.issuer);
    if (issuerDiff !== 0) return issuerDiff;

    const brandDiff = compareText(a.brand, b.brand);
    if (brandDiff !== 0) return brandDiff;

    return compareText(a.name, b.name);
  });
}

function isSupplementaryCard(cardMeta) {
  const explicitFlag = firstDefined(cardMeta.sub_card);

  if (typeof explicitFlag === "boolean") return explicitFlag;
  if (typeof explicitFlag === "number") return explicitFlag === 1;
  if (typeof explicitFlag === "string") {
    const normalized = explicitFlag.trim().toLowerCase();
    return ["true"].includes(normalized);
  }

  const name = String(cardMeta.description || "");
  if (name.includes("附卡")) return true;

  const note = String(cardMeta.note || "");
  return note.includes("附卡");
}

function mapCreditCard(bankKey, bankInfo, entry) {
  const cardMeta = entry.card || entry;
  const typeRaw = String(cardMeta.type || "").toLowerCase();
  if (typeRaw !== "credit") return null;

  const brand = String(cardMeta.brand || "").trim();
  const tier = String(cardMeta.tier || "").trim();
  const bin = String(toArray(cardMeta.bin)[0] || "").trim();
  const description = String(cardMeta.description || "").trim();
  const base = sanitizeFilename(description);
  const altImageUrl = resolveImageUrl(
    bankKey,
    cardMeta.alt_image || cardMeta["alt-image"] || "",
  );
  const image =
    altImageUrl || resolveImageUrl(bankKey, `${base}.${cardMeta.ext || ""}`);
  const supplementary = isSupplementaryCard(cardMeta);
  const cardName = supplementary ? `${description}（附卡）` : description;

  return {
    name: cardName,
    baseName: description,
    image,
    altImageUrl,
    bin,
    brand,
    brandIcon: brandIconUrl(brand),
    tier,
    issuer: bankInfo.native_name || bankInfo.english_name || bankKey,
    region: bankInfo.region || bankInfo.country || "",
    limit: String(firstDefined(cardMeta.limit) || "").trim(),
    billingDay: String(firstDefined(cardMeta.billing_day) || "").trim(),
    dueDay: String(firstDefined(cardMeta.due_day) || "").trim(),
    annualFee: String(firstDefined(cardMeta.annual_fee) || "").trim(),
    ftf: String(firstDefined(cardMeta.ftf) || "").trim(),
    note: String(cardMeta.note || "").trim(),
    searchText: [
      cardName,
      bin,
      brand,
      tier,
      bankInfo.native_name,
      bankInfo.english_name,
      bankInfo.region,
      cardMeta.note,
    ]
      .join(" ")
      .toLowerCase(),
  };
}

const tbody = document.querySelector("#creditTableBody");
const template = document.querySelector("#creditRowTemplate");
const searchInput = document.querySelector("#tableSearchInput");
const tableLoading = document.querySelector("#tableLoading");
const imageLightbox = document.querySelector("#imageLightbox");
const lightboxImage = document.querySelector("#lightboxImage");

function formatCell(value) {
  return value && String(value).trim() ? String(value).trim() : "—";
}

function openLightbox(card) {
  if (!card || !card.image || !imageLightbox || !lightboxImage) return;
  lightboxImage.src = card.image;
  lightboxImage.alt = `${card.name} 卡面`;
  imageLightbox.hidden = false;
  document.body.classList.add("lightbox-open");
}

function closeLightbox() {
  if (!imageLightbox || !lightboxImage) return;
  imageLightbox.hidden = true;
  lightboxImage.src = "";
  lightboxImage.alt = "";
  document.body.classList.remove("lightbox-open");
}

function renderRows() {
  const search = searchInput.value.trim().toLowerCase();
  tbody.innerHTML = "";

  const filtered = sortCreditCards(
    cards.filter((card) => !search || card.searchText.includes(search)),
  );

  if (!filtered.length) {
    const emptyRow = document.createElement("tr");
    emptyRow.innerHTML =
      '<td class="empty-state" colspan="13">暂无符合条件的信用卡。</td>';
    tbody.append(emptyRow);
    return;
  }

  filtered.forEach((card) => {
    const row = template.content.firstElementChild.cloneNode(true);
    const image = row.querySelector("img");
    image.src = card.image;
    image.alt = card.name;
    image.title = "点击放大";
    image.addEventListener("click", (event) => {
      event.stopPropagation();
      openLightbox(card);
    });
    const brandCell = row.querySelector(".card-brand-cell");
    if (card.brandIcon) {
      brandCell.innerHTML = `<img class="brand-icon" src="${card.brandIcon}" alt="${card.brand}" title="${card.brand}" loading="lazy" />`;
    } else {
      brandCell.textContent = formatCell(card.brand);
    }
    row.querySelector(".card-name-cell").textContent = formatCell(card.name);
    row.querySelector(".card-bin-cell").textContent = formatCell(card.bin);
    row.querySelector(".card-tier-cell").textContent = formatCell(card.tier);
    row.querySelector(".card-issuer-cell").textContent = formatCell(
      card.issuer,
    );
    row.querySelector(".card-region-cell").textContent = formatCell(
      card.region,
    );
    row.querySelector(".card-limit-cell").textContent = formatCell(card.limit);
    row.querySelector(".card-billing-day-cell").textContent = formatCell(
      card.billingDay,
    );
    row.querySelector(".card-due-day-cell").textContent = formatCell(
      card.dueDay,
    );
    row.querySelector(".card-annual-fee-cell").textContent = formatCell(
      card.annualFee,
    );
    row.querySelector(".card-ftf-cell").textContent = formatCell(card.ftf);
    row.querySelector(".card-note-cell").textContent = formatCell(card.note);
    tbody.append(row);
  });
}

async function init() {
  document.body.classList.add("page-loading");
  cards = await loadCardsFromAssets(mapCreditCard);
  renderRows();
  if (tableLoading) {
    tableLoading.classList.add("is-hidden");
    document.body.classList.remove("page-loading");
    window.setTimeout(() => {
      tableLoading.hidden = true;
    }, 220);
  }
}

searchInput.addEventListener("input", renderRows);
if (imageLightbox) {
  imageLightbox.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.closest && target.closest("[data-close-lightbox]")) {
      closeLightbox();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && imageLightbox && !imageLightbox.hidden) {
    closeLightbox();
  }
});

init();
