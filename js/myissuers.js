const myIssuersUtils = window.cardUtils || {};
const myIssuersSiteData = window.__CARDS_VIEWER_DATA__ || {};
const {
  appendBankNameContent,
  createExternalLink,
  fetchJsonSafe,
  resolveIssuerLogoUrl,
} = myIssuersUtils;

const myIssuerTypeLabels = {
  Debit: "借记卡",
  Credit: "信用卡",
  Prepaid: "预付卡",
  Transit: "交通卡",
};

const myIssuerTagLabels = {
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

const myIssuersSectionsRoot = document.querySelector("#myIssuersSections");
const myIssuersStatus = document.querySelector("#myIssuersStatus");

function setMyIssuersStatus(message, hidden = false) {
  if (!myIssuersStatus) return;
  myIssuersStatus.textContent = message;
  myIssuersStatus.hidden = hidden;
}

function buildRegionMap() {
  const map = new Map();
  const continents = myIssuersSiteData?.regions?.continents;
  if (!Array.isArray(continents)) return map;

  continents.forEach((continent) => {
    (continent?.countries || []).forEach((country) => {
      if (!country?.code) return;
      map.set(
        String(country.code).toUpperCase(),
        country.name_zh || country.name || country.code,
      );
    });
  });
  return map;
}

function getNativeName(bank, fallback) {
  return bank?.nativeName || bank?.native_name || bank?.name || fallback || "-";
}

function buildIssuerInfoMap(payload) {
  const map = new Map();
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return map;

  Object.entries(payload).forEach(([key, value]) => {
    const bank = value?.bank;
    if (!bank) return;
    const metadata = {
      name: getNativeName(bank, key),
      logo: bank.logo || "",
    };
    [key, bank.english_name, bank.englishName, bank.native_name, bank.nativeName]
      .filter(Boolean)
      .forEach((alias) => map.set(String(alias).trim().toLowerCase(), metadata));
  });
  return map;
}

function getIssuerMetadata(record, issuerInfoMap) {
  const issuer = String(record?.issuer || "").trim();
  return (
    issuerInfoMap.get(issuer.toLowerCase()) || {
      name: getNativeName(record, issuer),
      logo: record?.logo || "",
    }
  );
}

function getIssuerTagLabel(tag) {
  const value = String(tag || "").trim().toLowerCase();
  return myIssuerTagLabels[value] || myIssuerTagLabels.others;
}

function getRegionLabel(record, regionMap) {
  const regionCode = String(record?.region || "").toUpperCase();
  const region = regionMap.get(regionCode) || record?.region || "-";
  return record?.province ? `${region}/${record.province}` : region;
}

function annotateRecordSpans(records, regionMap) {
  const entries = records.map((record) => ({
    record,
    tagKey: String(record?.tag || "").trim().toLowerCase() || "others",
    tagLabel: getIssuerTagLabel(record?.tag),
    regionLabel: getRegionLabel(record, regionMap),
    tagRowSpan: 0,
    regionRowSpan: 0,
  }));

  entries.forEach((entry, index) => {
    const previous = entries[index - 1];
    if (!previous || previous.tagKey !== entry.tagKey) {
      let span = 1;
      while (entries[index + span]?.tagKey === entry.tagKey) span += 1;
      entry.tagRowSpan = span;
    }
    if (!previous || previous.regionLabel !== entry.regionLabel) {
      let span = 1;
      while (entries[index + span]?.regionLabel === entry.regionLabel) span += 1;
      entry.regionRowSpan = span;
    }
  });

  return entries;
}

function renderBranches(cell, branches) {
  cell.replaceChildren();
  const values = Array.isArray(branches) ? branches.filter(Boolean) : [];
  if (!values.length) {
    cell.textContent = "-";
    return;
  }
  values.forEach((branch) => {
    const item = document.createElement("div");
    item.textContent = branch;
    cell.append(item);
  });
}

function renderIssuerCell(cell, record, issuerInfoMap) {
  const metadata = getIssuerMetadata(record, issuerInfoMap);
  const logo = resolveIssuerLogoUrl(
    record?.issuer || "",
    record?.logo || metadata.logo,
  );
  const content = document.createElement("span");
  content.className = "myissuers-issuer-content";
  appendBankNameContent(content, metadata.name, logo, true);

  if (record?.url) {
    const link = createExternalLink(record.url, "");
    link.setAttribute("aria-label", metadata.name);
    link.append(content);
    cell.append(link);
  } else {
    cell.append(content);
  }
}

function renderRecord(recordEntry, issuerInfoMap) {
  const { record, tagLabel, tagRowSpan, regionLabel, regionRowSpan } = recordEntry;
  const row = document.createElement("tr");
  const issuerCell = document.createElement("td");
  issuerCell.className = "myissuers-issuer-cell";
  renderIssuerCell(issuerCell, record, issuerInfoMap);

  const tagCell = document.createElement("td");
  tagCell.className = "myissuers-tag-cell";
  if (tagRowSpan > 0) {
    tagCell.rowSpan = tagRowSpan;
    tagCell.textContent = tagLabel;
  }

  const regionCell = document.createElement("td");
  regionCell.className = "myissuers-region-cell";
  if (regionRowSpan > 0) {
    regionCell.rowSpan = regionRowSpan;
    regionCell.textContent = regionLabel;
  }

  const activeCardCell = document.createElement("td");
  activeCardCell.className = "myissuers-active-card-cell";
  const activeCardNum = Number(record?.activeCardNum ?? 0);
  const virtualCardNum = Number(record?.virtualCardNum ?? 0);
  activeCardCell.textContent =
    virtualCardNum > 0 && activeCardNum === virtualCardNum
      ? `虚拟${virtualCardNum}`
      : virtualCardNum > 0
        ? `${activeCardNum}(虚拟${virtualCardNum})`
        : String(activeCardNum);

  const branchCell = document.createElement("td");
  branchCell.className = "myissuers-branch-cell";
  renderBranches(branchCell, record?.branch);

  row.append(issuerCell);
  if (tagRowSpan > 0) row.append(tagCell);
  if (regionRowSpan > 0) row.append(regionCell);
  row.append(activeCardCell, branchCell);
  return row;
}

function renderIssuerSection(type, records, regionMap, issuerInfoMap) {
  const section = document.createElement("section");
  section.className = "myissuers-section";

  const heading = document.createElement("h2");
  heading.className = "myissuers-section-title";
  heading.textContent = myIssuerTypeLabels[type] || type;

  const tableWrap = document.createElement("div");
  tableWrap.className = "myissuers-table-wrap";
  const table = document.createElement("table");
  table.className = "myissuers-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">发行方</th>
        <th scope="col">分类</th>
        <th scope="col">地区</th>
        <th scope="col">激活卡数量</th>
        <th scope="col">分行</th>
      </tr>
    </thead>
  `;
  const body = document.createElement("tbody");
  annotateRecordSpans(records, regionMap).forEach((recordEntry) => {
    body.append(renderRecord(recordEntry, issuerInfoMap));
  });
  table.append(body);
  tableWrap.append(table);
  section.append(heading, tableWrap);
  myIssuersSectionsRoot?.append(section);
}

async function loadMyIssuers() {
  const [payload, issuerInfo] = await Promise.all([
    fetchJsonSafe(
      myIssuersSiteData.myissuersUrl || "/json/myissuers.json",
      { warn: true },
    ),
    fetchJsonSafe(myIssuersSiteData.issuerInfoUrl || "/json/issuer-info.json"),
  ]);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    setMyIssuersStatus("发行方数据加载失败");
    return;
  }

  const entries = Object.entries(payload).filter(([, records]) =>
    Array.isArray(records),
  );
  const totalRecords = entries.reduce((sum, [, records]) => sum + records.length, 0);
  if (!totalRecords) {
    setMyIssuersStatus("暂无发行方数据");
    return;
  }

  const regionMap = buildRegionMap();
  const issuerInfoMap = buildIssuerInfoMap(issuerInfo);
  myIssuersSectionsRoot?.replaceChildren();
  entries.forEach(([type, records]) => {
    renderIssuerSection(type, records, regionMap, issuerInfoMap);
  });
  setMyIssuersStatus("", true);
}

loadMyIssuers();
