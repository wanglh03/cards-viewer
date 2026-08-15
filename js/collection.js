const collectionUtils = window.cardUtils || {};
const {
  loadCardsFromAssetsProgressively,
  normalizeBankTag,
  resolveIssuerLogoUrl,
} = collectionUtils;

const collectionGroupsRoot = document.querySelector("#collectionGroups");
const collectionStatus = document.querySelector("#collectionStatus");
const collectionExportButton = document.querySelector(
  "#collectionExportButton",
);

const NATIONAL_TAGS = new Set(["state", "stock"]);
const RETIRED_STATUSES = new Set(["expired", "cancelled"]);
const NATIONAL_TAG_ORDER = ["state", "stock"];
const PROVINCE_TAG_ORDER = ["city", "rural", "private", "village"];
const PINYIN_COLLATOR = new Intl.Collator("zh-Hans-u-co-pinyin", {
  sensitivity: "base",
});

let collectionGroups = [];

function setCollectionStatus(message, hidden = false) {
  if (!collectionStatus) return;
  collectionStatus.textContent = message;
  collectionStatus.hidden = hidden;
}

function mapCollectedCard(bankKey, bankInfo, entry) {
  const card = entry.card || entry;
  const rawTag = String(bankInfo.tag || "").trim();
  if (!rawTag) return null;
  const tag = normalizeBankTag(rawTag);

  return {
    issuerKey: bankKey,
    name: bankInfo.nativeName || bankInfo.native_name || bankKey,
    logoUrl: resolveIssuerLogoUrl(
      bankKey,
      bankInfo.logo || "",
      bankInfo.region,
    ),
    province: String(bankInfo.province || "").trim(),
    status: String(card.status || "").toLowerCase(),
    tag,
  };
}

function getCollectionCategory(issuer) {
  if (NATIONAL_TAGS.has(issuer.tag)) return "全国性银行";
  if (issuer.tag === "foreign") return "外资银行";
  return issuer.province || "数字银行";
}

function sortIssuers(a, b, category) {
  const tagOrder =
    category === "全国性银行"
      ? NATIONAL_TAG_ORDER
      : category === "外资银行" || category === "数字银行"
        ? []
        : PROVINCE_TAG_ORDER;
  const tagDiff = tagOrder.indexOf(a.tag) - tagOrder.indexOf(b.tag);
  if (tagDiff !== 0) {
    const fallbackRank = tagOrder.length;
    const rankA = tagOrder.indexOf(a.tag);
    const rankB = tagOrder.indexOf(b.tag);
    return (
      (rankA === -1 ? fallbackRank : rankA) -
      (rankB === -1 ? fallbackRank : rankB)
    );
  }
  return PINYIN_COLLATOR.compare(a.name, b.name);
}

function sortCategories(a, b) {
  const fixedOrder = ["全国性银行", "外资银行"];
  const indexA = fixedOrder.indexOf(a.title);
  const indexB = fixedOrder.indexOf(b.title);
  if (indexA !== -1 || indexB !== -1) {
    return (
      (indexA === -1 ? fixedOrder.length : indexA) -
      (indexB === -1 ? fixedOrder.length : indexB)
    );
  }
  if (a.title === "数字银行") return 1;
  if (b.title === "数字银行") return -1;
  return PINYIN_COLLATOR.compare(a.title, b.title);
}

function buildCollectionGroups(cards) {
  const issuers = new Map();
  cards.filter(Boolean).forEach((card) => {
    const issuer = issuers.get(card.issuerKey) || {
      ...card,
      statuses: new Set(),
    };
    issuer.statuses.add(card.status);
    issuers.set(card.issuerKey, issuer);
  });

  const grouped = new Map();
  issuers.forEach((issuer) => {
    const category = getCollectionCategory(issuer);
    const items = grouped.get(category) || [];
    items.push({
      ...issuer,
      isRetired:
        issuer.statuses.size > 0 &&
        [...issuer.statuses].every((status) => RETIRED_STATUSES.has(status)),
    });
    grouped.set(category, items);
  });

  return [...grouped.entries()]
    .map(([title, issuersInCategory]) => ({
      title,
      issuers: issuersInCategory.sort((a, b) => sortIssuers(a, b, title)),
    }))
    .sort(sortCategories);
}

function renderIssuer(issuer) {
  const item = document.createElement("span");
  item.className = "collection-issuer";
  if (issuer.isRetired) item.classList.add("is-retired");

  if (issuer.logoUrl) {
    const logo = document.createElement("img");
    logo.className = "collection-issuer-logo";
    logo.src = issuer.logoUrl;
    logo.alt = "";
    logo.setAttribute("aria-hidden", "true");
    item.append(logo);
  }

  item.append(document.createTextNode(issuer.name));
  return item;
}

function renderCollectionGroups() {
  if (!collectionGroupsRoot) return;
  collectionGroupsRoot.replaceChildren();
  collectionGroups.forEach((group) => {
    const section = document.createElement("section");
    section.className = "collection-group";

    const title = document.createElement("h2");
    title.className = "collection-group-title";
    title.textContent = group.title;

    const paragraph = document.createElement("p");
    paragraph.className = "collection-issuer-paragraph";
    group.issuers.forEach((issuer) => paragraph.append(renderIssuer(issuer)));

    section.append(title, paragraph);
    collectionGroupsRoot.append(section);
  });
}

function loadImageForExport(src) {
  if (!src) return Promise.resolve(null);
  return fetch(src, { mode: "cors", cache: "force-cache" })
    .then((response) => {
      if (!response.ok) throw new Error(`Logo request failed: ${response.status}`);
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise((resolve) => {
          const image = new Image();
          const objectUrl = URL.createObjectURL(blob);
          image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
          };
          image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(null);
          };
          image.src = objectUrl;
        }),
    )
    .catch(() => null);
}

function wrapCanvasText(context, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const character of String(text || "")) {
    const nextLine = `${line}${character}`;
    if (line && context.measureText(nextLine).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = nextLine;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : ["-"];
}

function prepareExportLayout(context) {
  const padding = 22;
  const logoSize = 22;
  const lineHeight = 19;
  const itemGap = 16;
  const contentWidth = 390 - padding * 2;
  const groups = collectionGroups.map((group) => ({
    ...group,
    rows: group.issuers.reduce((rows, issuer) => {
      const textWidth = Math.max(70, contentWidth - logoSize - 8);
      const lines = wrapCanvasText(context, issuer.name, textWidth);
      const measuredTextWidth = Math.min(
        textWidth,
        Math.max(...lines.map((line) => context.measureText(line).width)),
      );
      const item = {
        ...issuer,
        lines,
        width: Math.min(
          contentWidth,
          logoSize + 8 + measuredTextWidth + itemGap,
        ),
        height: Math.max(logoSize, lines.length * lineHeight),
      };
      const row = rows.at(-1);
      if (row && row.width + item.width > contentWidth) {
        rows.push({ width: item.width, height: item.height, items: [item] });
      } else if (row) {
        row.width += item.width;
        row.height = Math.max(row.height, item.height);
        row.items.push(item);
      } else {
        rows.push({ width: item.width, height: item.height, items: [item] });
      }
      return rows;
    }, []),
  }));
  const height = groups.reduce(
    (total, group) =>
      total +
      40 +
      group.rows.reduce((rowTotal, row) => rowTotal + row.height + 9, 0),
    70,
  );
  return { groups, height, padding, logoSize, lineHeight, itemGap };
}

function drawCollectionImage(context, layout, images, colors) {
  const { groups, padding, logoSize, lineHeight, itemGap } = layout;
  context.fillStyle = colors.background;
  context.fillRect(0, 0, 390, layout.height);
  context.fillStyle = colors.text;
  context.font = "700 30px system-ui, sans-serif";
  context.fillText("收集进度", padding, 44);

  let y = 78;
  groups.forEach((group) => {
    context.strokeStyle = colors.line;
    context.beginPath();
    context.moveTo(padding, y - 14);
    context.lineTo(390 - padding, y - 14);
    context.stroke();
    context.fillStyle = colors.accent;
    context.font = "700 16px system-ui, sans-serif";
    context.fillText(group.title, padding, y + 3);
    y += 24;

    group.rows.forEach((row) => {
      let x = padding;
      row.items.forEach((issuer) => {
        const itemTop = y + Math.max(0, (row.height - issuer.height) / 2);
        context.globalAlpha = issuer.isRetired ? 0.48 : 1;
        const logo = images.get(issuer.logoUrl);
        if (logo) context.drawImage(logo, x, itemTop, logoSize, logoSize);
        context.fillStyle = issuer.isRetired ? colors.muted : colors.text;
        context.font = "500 15px system-ui, sans-serif";
        issuer.lines.forEach((line, index) => {
          context.fillText(line, x + logoSize + 8, itemTop + 15 + index * lineHeight);
        });
        context.globalAlpha = 1;
        x += issuer.width;
      });
      y += row.height + 9;
    });
    y += 12;
  });
}

async function exportCollectionImage() {
  if (!collectionGroups.length || !collectionExportButton) return;
  collectionExportButton.disabled = true;
  collectionExportButton.textContent = "正在导出";

  try {
    await document.fonts?.ready;
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    if (!measureContext) throw new Error("Canvas unavailable");
    measureContext.font = "500 15px system-ui, sans-serif";
    const layout = prepareExportLayout(measureContext);
    const imageSources = [
      ...new Set(
        collectionGroups.flatMap((group) =>
          group.issuers.map((issuer) => issuer.logoUrl).filter(Boolean),
        ),
      ),
    ];
    const loadedImages = await Promise.all(
      imageSources.map(async (src) => [src, await loadImageForExport(src)]),
    );
    const images = new Map(loadedImages.filter(([, image]) => image));
    const canvas = document.createElement("canvas");
    const scale = 2;
    canvas.width = 390 * scale;
    canvas.height = Math.ceil(layout.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas unavailable");
    context.scale(scale, scale);
    const style = getComputedStyle(document.documentElement);
    drawCollectionImage(context, layout, images, {
      background: style.getPropertyValue("--bg").trim() || "#f6f7f4",
      text: style.getPropertyValue("--text").trim() || "#19201d",
      muted: style.getPropertyValue("--muted").trim() || "#65706a",
      accent: style.getPropertyValue("--accent-strong").trim() || "#075a4b",
      line: style.getPropertyValue("--line").trim() || "rgba(24, 32, 29, 0.12)",
    });
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Image export failed");
    const link = document.createElement("a");
    const imageUrl = URL.createObjectURL(blob);
    link.href = imageUrl;
    link.download = "收集进度.png";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
  } finally {
    collectionExportButton.disabled = false;
    collectionExportButton.textContent = "导出为图片";
  }
}

async function loadCollection() {
  const cards = await loadCardsFromAssetsProgressively(mapCollectedCard, {
    onlyMycards: true,
    warn: true,
  });
  collectionGroups = buildCollectionGroups(cards);
  if (!collectionGroups.length) {
    setCollectionStatus("暂无符合条件的发行方");
    return;
  }
  renderCollectionGroups();
  setCollectionStatus("", true);
}

collectionExportButton?.addEventListener("click", () => {
  exportCollectionImage().catch(() => setCollectionStatus("图片导出失败"));
});

loadCollection().catch(() => setCollectionStatus("收集数据加载失败"));
