(() => {
  const themeKey = "bankcard-theme";
  const GITHUB_REPOSITORY_URL = "https://github.com/wanglh03/cards-viewer";
  const EXTERNAL_URL_PATTERN = /^(https?:)?\/\/|^\/s\//i;
  const GITHUB_ICON_MARKUP = `
    <svg class="icon-link-svg" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M12 .5C5.65.5.5 5.66.5 12.03c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1.19-.02-2.15-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.78 2.71 1.27 3.37.97.1-.75.4-1.27.73-1.56-2.56-.29-5.24-1.29-5.24-5.73 0-1.27.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.17 1.19a10.94 10.94 0 0 1 5.77 0c2.19-1.5 3.16-1.19 3.16-1.19.64 1.58.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.11 0 4.45-2.68 5.44-5.24 5.73.41.36.78 1.08.78 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56A11.53 11.53 0 0 0 23.5 12.03C23.5 5.66 18.35.5 12 .5Z" />
    </svg>`;
  const page = document.body?.dataset.page || "home";
  const basePath = document.body?.dataset.basePath || "";
  const rootPath = document.body?.dataset.rootPath || `${basePath}index.html`;

  function withBasePath(path) {
    const text = String(path || "").trim();
    if (
      !text ||
      /^(https?:)?\/\//i.test(text) ||
      text.startsWith("/") ||
      text.startsWith("#") ||
      text.startsWith("./") ||
      text.startsWith("../")
    ) {
      return text;
    }
    return `${basePath}${text}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function sanitizeFilename(name) {
    return String(name || "")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ");
  }

  function assetPath(...parts) {
    return withBasePath(
      parts.map((part) => encodeURIComponent(part)).join("/"),
    );
  }

  function resolveImageUrl(bankKey, value) {
    const text = String(value || "");
    if (!text) return "";
    if (
      /^(https?:)?\/\//i.test(text) ||
      text.startsWith("/") ||
      text.startsWith("assets/")
    ) {
      return text.startsWith("assets/") ? withBasePath(text) : text;
    }
    return assetPath("assets", "issuers", bankKey, text);
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value === undefined || value === null) return [];
    return [value];
  }

  function firstDefined(...values) {
    return values.find(
      (value) => value !== undefined && value !== null && value !== "",
    );
  }

  function compareText(a, b) {
    return String(a || "").localeCompare(String(b || ""), "zh-Hans-CN", {
      numeric: true,
      sensitivity: "base",
    });
  }

  function formatCell(value, fallback = "-") {
    const text = String(value || "");
    return text || fallback;
  }

  function formatBinDisplay(value) {
    const text = String(value || "");
    if (text.length > 6 && text.length !== 8) {
      return `${text.slice(0, 6)} ${text.slice(6)}`;
    }
    return text;
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

  function getTierAccentClass(tier, fallback = "") {
    return (
      Object.entries(TIER_ACCENT_CLASS).find(([, tiers]) =>
        tiers.includes(tier),
      )?.[0] || fallback
    );
  }

  function isExternalUrl(url) {
    return EXTERNAL_URL_PATTERN.test(String(url || ""));
  }

  function renderLinkAttributes(href, className = "") {
    const classes = [className, isExternalUrl(href) ? "external-link" : ""]
      .filter(Boolean)
      .join(" ");
    const attributes = [
      classes ? `class="${classes}"` : "",
      `href="${escapeHtml(href)}"`,
      isExternalUrl(href) ? 'target="_blank" rel="noopener noreferrer"' : "",
    ].filter(Boolean);
    return attributes.join(" ");
  }

  function renderLink(label, url, className = "") {
    const href = withBasePath(url);
    return `<a ${renderLinkAttributes(href, className)}>${escapeHtml(label)}</a>`;
  }

  function createExternalLink(url, label = url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "external-link";
    link.textContent = label;
    return link;
  }

  function renderGithubLink(className, url = GITHUB_REPOSITORY_URL) {
    return `<a class="${className}" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" aria-label="GitHub 仓库" title="GitHub 仓库">${GITHUB_ICON_MARKUP}</a>`;
  }

  function normalizeOrganizationKey(organization) {
    const text = organization;
    if (!text) return "";
    return ORGANIZATIONS.find(({ name }) => name === text)?.icon || text;
  }

  const { ORGANIZATIONS = [], TIER_ACCENT_CLASS = {} } =
    window.cardConfig || {};
  const ORGANIZATION_ORDER = ORGANIZATIONS.map(({ name }) => name);

  function getOrganizationRank(value, organizationOrder = ORGANIZATION_ORDER) {
    const index = organizationOrder.indexOf(value);
    return index === -1 ? organizationOrder.length : index;
  }

  function sortOrganizationOptions(
    list,
    organizationOrder = ORGANIZATION_ORDER,
  ) {
    return list.slice().sort((a, b) => {
      const rankDiff =
        getOrganizationRank(a, organizationOrder) -
        getOrganizationRank(b, organizationOrder);
      if (rankDiff !== 0) return rankDiff;
      return compareText(a, b);
    });
  }

  function getTierRank(organization, tier, tierOrderMap = {}) {
    const tiers = tierOrderMap[organization] || [];
    const normalizedTier = tier;
    const index = tiers.findIndex((item) => {
      const tierNames = Array.isArray(item) ? item : [item];
      return tierNames.includes(normalizedTier);
    });
    return index === -1 ? tiers.length : index;
  }

  function sortCardsByOrganizationAndTier(
    list,
    { organizationOrder = ORGANIZATION_ORDER, tierOrderMap = {} } = {},
  ) {
    return list.slice().sort((a, b) =>
      compareCardsByOrganizationAndTier(a, b, {
        organizationOrder,
        tierOrderMap,
      }),
    );
  }

  function compareCardsByOrganizationAndTier(
    a,
    b,
    { organizationOrder = ORGANIZATION_ORDER, tierOrderMap = {} } = {},
  ) {
    const organizationDiff =
      getOrganizationRank(a.organization, organizationOrder) -
      getOrganizationRank(b.organization, organizationOrder);
    if (organizationDiff !== 0) return organizationDiff;

    const tierDiff =
      getTierRank(a.organization, a.tier, tierOrderMap) -
      getTierRank(b.organization, b.tier, tierOrderMap);
    if (tierDiff !== 0) return tierDiff;

    const issuerDiff = compareText(a.issuer, b.issuer);
    if (issuerDiff !== 0) return issuerDiff;

    return compareText(a.name, b.name);
  }

  function createCardBase(
    bankKey,
    bankInfo,
    cardMeta,
    {
      organization = cardMeta.organization,
      displayName,
      preferAltImage = false,
    } = {},
  ) {
    const baseName = cardMeta.name;
    const altImageUrl = resolveImageUrl(bankKey, cardMeta.alt_image || "");
    const primaryImage = firstDefined(
      cardMeta.image,
      cardMeta.ext ? `${sanitizeFilename(baseName)}.${cardMeta.ext}` : "",
    );
    const primaryImageUrl = resolveImageUrl(bankKey, primaryImage);
    return {
      bankKey,
      name: String(displayName ?? baseName),
      baseName,
      image: preferAltImage && altImageUrl ? altImageUrl : primaryImageUrl,
      altImageUrl,
      bin: cardMeta.bin,
      length: cardMeta.length,
      organization,
      organizationIcon: organizationIconUrl(organization),
      tier: cardMeta.tier,
      issuer: bankInfo.native_name || bankInfo.english_name || bankKey,
      bankLogoUrl: resolveImageUrl(bankKey, bankInfo.logo),
      region: bankInfo.region,
      status: cardMeta.status,
    };
  }

  function organizationIconUrl(organization) {
    const key = normalizeOrganizationKey(organization);
    if (!key) return "";
    return assetPath("assets", "logo", key);
  }

  function resolveAssetFolderKey(item) {
    return typeof item === "string"
      ? item
      : item?.dir || item?.key || item?.id || item?.name || "";
  }

  function getPreloadedSiteData() {
    const data = window.__CARDS_VIEWER_DATA__;
    return data && typeof data === "object" ? data : null;
  }

  function getBinOverlayText(bin) {
    const key = bin;
    const preloaded = getPreloadedSiteData();
    const overlays = preloaded?.binOverlays;
    if (!overlays || typeof overlays !== "object") return "";
    for (const [label, bins] of Object.entries(overlays)) {
      if (!Array.isArray(bins)) continue;
      if (bins.some((item) => item === key)) {
        return label;
      }
    }
    return "";
  }

  async function fetchJsonSafe(url, options = {}) {
    try {
      const res = await fetch(withBasePath(url), { cache: "no-cache" });
      const text = await res.text();
      if (!res.ok) {
        if (options.warn) {
          console.warn(`JSON request failed: ${url}`, res.status);
        }
        return null;
      }
      try {
        return JSON.parse(text);
      } catch {
        if (options.warn) {
          console.warn(
            `JSON response was not valid JSON: ${url}`,
            text.slice(0, 80),
          );
        }
        return null;
      }
    } catch (error) {
      if (options.warn) {
        console.warn(`JSON request failed: ${url}`, error);
      }
      return null;
    }
  }

  async function discoverAssetFolders() {
    const preloaded = getPreloadedSiteData();
    if (preloaded?.issuers && typeof preloaded.issuers === "object") {
      return Object.keys(preloaded.issuers);
    }

    return [];
  }

  async function loadCardsFromAssets(mapEntry, options = {}) {
    if (typeof mapEntry !== "function") return [];

    const warn = Boolean(options.warn);
    const onBatch =
      typeof options.onBatch === "function" ? options.onBatch : null;
    const issuers = await discoverAssetFolders();
    const preloaded = getPreloadedSiteData();
    const loaded = [];

    for (const item of issuers) {
      const bankKey = resolveAssetFolderKey(item);
      if (!bankKey) continue;

      const url = assetPath("assets", "issuers", bankKey, "data.json");
      const data =
        preloaded?.issuers?.[bankKey] || (await fetchJsonSafe(url, { warn }));
      if (!data || !data.bank || !Array.isArray(data.cards)) {
        if (warn) {
          console.warn(`Skipped issuer data: ${url}`);
        }
        continue;
      }

      const batch = [];
      for (const entry of data.cards) {
        const mapped = mapEntry(bankKey, data.bank, entry);
        if (mapped !== null && mapped !== undefined) {
          loaded.push(mapped);
          batch.push(mapped);
        }
      }

      if (batch.length && onBatch) {
        await onBatch(batch, {
          bankKey,
          bank: data.bank,
          loadedCount: loaded.length,
        });
      }
    }

    return loaded;
  }

  async function loadCardsFromAssetsProgressively(mapEntry, options = {}) {
    return loadCardsFromAssets(mapEntry, options);
  }

  async function loadFooterLinks() {
    const preloaded = getPreloadedSiteData();
    return Array.isArray(preloaded?.footerLinks?.columns)
      ? preloaded.footerLinks.columns.slice()
      : [];
  }

  window.cardUtils = {
    sanitizeFilename,
    assetPath,
    resolveImageUrl,
    toArray,
    firstDefined,
    compareText,
    formatCell,
    formatBinDisplay,
    queueImageLoad,
    activateDeferredImages,
    createOption,
    appendBankNameContent,
    getTierAccentClass,
    createExternalLink,
    normalizeOrganizationKey,
    getOrganizationRank,
    sortOrganizationOptions,
    getTierRank,
    sortCardsByOrganizationAndTier,
    compareCardsByOrganizationAndTier,
    organizationIconUrl,
    createCardBase,
    resolveAssetFolderKey,
    getBinOverlayText,
    fetchJsonSafe,
    discoverAssetFolders,
    loadCardsFromAssets,
    loadCardsFromAssetsProgressively,
    loadFooterLinks,
  };

  function getSavedTheme() {
    try {
      return localStorage.getItem(themeKey);
    } catch {
      return null;
    }
  }

  function setTheme(theme) {
    if (!theme) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(themeKey, theme);
    } catch {
      // Ignore storage failures.
    }
  }

  function currentTheme() {
    return (
      document.documentElement.dataset.theme ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light")
    );
  }

  const cookieConsentKey = "cards-viewer-cookie-consent";

  function hasCookieConsent() {
    return document.cookie
      .split("; ")
      .some((cookie) => cookie === `${cookieConsentKey}=accepted`);
  }

  function setCookieConsent() {
    document.cookie = `${cookieConsentKey}=accepted; max-age=31536000; path=/; SameSite=Lax`;
  }

  function setupCookieNotice() {
    if (hasCookieConsent()) return;

    const notice = document.createElement("aside");
    notice.className = "cookie-notice";
    notice.setAttribute("aria-label", "Cookie 使用提示");
    notice.innerHTML = `
      <p>本网站使用 Cookies 帮助改善浏览体验。“接受”即表示阁下同意我们的数据处理，或者“拒绝”同意。</p>
      <button type="button">接受</button>
      <button type="button">拒绝</button>
    `;

    notice.querySelector("button")?.addEventListener("click", () => {
      setCookieConsent();
      notice.remove();
    });

    document.body.append(notice);
  }

  const savedTheme = getSavedTheme();
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }

  const defaultNavigationItems = [
    { label: "卡片收藏", url: "index.html", page: "home" },
    { label: "现持信用卡", url: "credit.html", page: "credit" },
    { label: "卡 BIN 一览", url: "bin.html", page: "bin" },
    { label: "取款手续费", url: "withdrawal.html", page: "withdrawal" },
    { label: "卡号计算", url: "luhn.html", page: "luhn" },
    { label: "文档", source: "footer", section: "文档" },
    { label: "关于", url: "docs/about.html", page: "about" },
  ];

  function getNavigationConfig() {
    const configured = getPreloadedSiteData()?.navigation;
    return configured && typeof configured === "object" ? configured : {};
  }

  function isNavigationItemActive(item) {
    return (
      item?.page === page ||
      (Array.isArray(item?.children) &&
        item.children.some((child) => child?.page === page))
    );
  }

  function renderNavigationItem(item, index) {
    if (!item || !item.label) return "";

    const hasChildren = Array.isArray(item.children);
    const isFooterMenu = item.source === "footer";
    if (!hasChildren && !isFooterMenu) {
      return renderLink(
        item.label,
        item.url || "#",
        `nav-link${isNavigationItemActive(item) ? " is-active" : ""}`,
      );
    }

    const toggleId = `navMenuToggle${index}`;
    const submenuId = `navSubmenu${index}`;
    const childrenMarkup = (item.children || [])
      .filter((child) => child?.label && child?.url)
      .map((child) => renderLink(child.label, child.url, "nav-submenu-link"))
      .join("");
    const sourceAttributes = isFooterMenu
      ? ` data-nav-source="footer" data-nav-section="${escapeHtml(item.section || "")}"`
      : "";

    return `
      <div class="nav-menu-group" data-nav-menu>
        <button
          class="nav-link nav-submenu-toggle${isNavigationItemActive(item) ? " is-active" : ""}"
          id="${toggleId}"
          type="button"
          aria-expanded="false"
          aria-controls="${submenuId}"
        >
          <span>${escapeHtml(item.label)}</span>
          <span class="nav-submenu-chevron" aria-hidden="true">⌄</span>
        </button>
        <div
          class="nav-submenu"
          id="${submenuId}"
          aria-label="${escapeHtml(item.label)}子菜单"
          aria-hidden="true"${sourceAttributes}
        >${childrenMarkup}</div>
      </div>
    `;
  }

  const navigation = getNavigationConfig();
  const navigationItems = Array.isArray(navigation.items)
    ? navigation.items
    : defaultNavigationItems;
  const primaryNavigationMarkup = navigationItems
    .map(renderNavigationItem)
    .join("");
  const brand = navigation.brand || {};
  const brandLabel = brand.label || "卡片收藏";
  const brandMark = brand.mark || brandLabel.slice(0, 1);
  const brandHref = withBasePath(brand.url || rootPath);
  const githubConfig = navigation.github;
  const githubEnabled = githubConfig !== false && githubConfig?.enabled !== false;
  const githubUrl =
    typeof githubConfig === "object" && githubConfig.url
      ? githubConfig.url
      : GITHUB_REPOSITORY_URL;

  const navRoot = document.querySelector("#siteNav");
  if (navRoot) {
    navRoot.innerHTML = `
      <nav class="topbar" aria-label="${escapeHtml(navigation.ariaLabel || "页面导航")}">
        <a ${renderLinkAttributes(brandHref, "organization")} aria-label="${escapeHtml(brand.ariaLabel || `${brandLabel}首页`)}">
          <span class="organization-mark" aria-hidden="true">${escapeHtml(brandMark)}</span>
          <span>${escapeHtml(brandLabel)}</span>
        </a>
        <div class="toolbar">
          <button
            class="nav-toggle"
            id="navToggle"
            type="button"
            aria-expanded="false"
            aria-controls="navLinks"
            aria-label="展开页面导航"
          >
            <span class="nav-toggle-bar" aria-hidden="true"></span>
            <span class="nav-toggle-bar" aria-hidden="true"></span>
            <span class="nav-toggle-bar" aria-hidden="true"></span>
          </button>
          <div class="nav-links" id="navLinks" aria-label="页面切换" aria-hidden="false">
            <div class="nav-drawer-panel">
              <div class="nav-drawer-main">
                ${primaryNavigationMarkup}
                ${githubEnabled ? renderGithubLink("nav-link nav-github-mobile", githubUrl) : ""}
              </div>
            </div>
          </div>
          ${githubEnabled ? renderGithubLink("icon-link nav-github-desktop", githubUrl) : ""}
          <button
            class="theme-toggle"
            id="themeToggle"
            type="button"
            aria-label="切换明暗主题"
          >
            <span class="theme-icon" aria-hidden="true"></span>
          </button>
        </div>
      </nav>
    `;
  }

  const footerRoot = document.querySelector("#siteFooter");
  if (footerRoot) {
    footerRoot.innerHTML = `
      <footer class="site-footer">
        <div class="footer-columns" id="footerColumns"></div>
        ${githubEnabled ? renderGithubLink("footer-repository-link", githubUrl) : ""}
        <div class="copyright">© 2026 GTB. All rights reserved.</div>
      </footer>
    `;
  }

  function renderFooterLinks(columns) {
    const footerColumns = document.querySelector("#footerColumns");
    const footerNavSubmenus = Array.from(
      document.querySelectorAll('[data-nav-source="footer"]'),
    );
    if (!footerColumns && !footerNavSubmenus.length) return;

    const documentColumn = columns.find(
      (column) =>
        column?.title === "文档" ||
        column?.links?.some((link) =>
          String(link?.url || "").startsWith("/docs/"),
        ),
    );

    footerNavSubmenus.forEach((submenu) => {
      const section = submenu.dataset.navSection;
      const column =
        columns.find((item) => section && item?.title === section) ||
        documentColumn;
      submenu.innerHTML = (column?.links || [])
        .filter((link) => link?.label && link?.url)
        .map((link) => renderLink(link.label, link.url, "nav-submenu-link"))
        .join("");
    });

    const html = columns
      .filter((column) => column && Array.isArray(column.links))
      .map((column) => {
        const links = column.links
          .filter((link) => link?.label && link?.url)
          .map((link) => `<li>${renderLink(link.label, link.url)}</li>`)
          .join("");

        if (!links) return "";
        return `
          <section class="footer-column" aria-label="${escapeHtml(column.title || "底部链接")}">
            <h2 class="footer-column-title">${escapeHtml(column.title || "")}</h2>
            <ul class="footer-column-links">
              ${links}
            </ul>
          </section>
        `;
      })
      .join("");

    if (footerColumns) {
      footerColumns.innerHTML = html;
    }
  }

  if (!document.querySelector("#backToTop")) {
    const backToTop = document.createElement("button");
    backToTop.id = "backToTop";
    backToTop.className = "back-to-top";
    backToTop.type = "button";
    backToTop.setAttribute("aria-label", "回到顶部");
    backToTop.textContent = "↑";
    document.body.append(backToTop);
  }

  const themeToggle = document.querySelector("#themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      setTheme(next);
    });
  }

  const navToggle = document.querySelector("#navToggle");
  const navLinks = document.querySelector("#navLinks");
  const navMenus = navLinks
    ? Array.from(navLinks.querySelectorAll("[data-nav-menu]"))
    : [];
  if (navToggle && navLinks) {
    const menuCloseDelay = 200;
    const menuCloseTimers = new Map();

    const cancelMenuClose = (menu) => {
      const timer = menuCloseTimers.get(menu);
      if (timer === undefined) return;
      window.clearTimeout(timer);
      menuCloseTimers.delete(menu);
    };

    const setMenuOpen = (menu, open) => {
      const toggle = menu.querySelector(".nav-submenu-toggle");
      const submenu = menu.querySelector(".nav-submenu");
      if (!toggle || !submenu) return;
      cancelMenuClose(menu);
      toggle.setAttribute("aria-expanded", String(open));
      submenu.classList.toggle("is-open", open);
      submenu.setAttribute("aria-hidden", String(!open));
    };

    const closeMenuLater = (menu) => {
      cancelMenuClose(menu);
      if (window.innerWidth <= 820) return;
      menuCloseTimers.set(
        menu,
        window.setTimeout(() => {
          menuCloseTimers.delete(menu);
          setMenuOpen(menu, false);
        }, menuCloseDelay),
      );
    };

    const setNavOpen = (open) => {
      navToggle.setAttribute("aria-expanded", String(open));
      navLinks.classList.toggle("is-open", open);
      navLinks.setAttribute(
        "aria-hidden",
        String(!open && window.innerWidth <= 820),
      );
      document.body.classList.toggle("nav-open", open);
      if (!open) navMenus.forEach((menu) => setMenuOpen(menu, false));
    };
    const closeNav = () => setNavOpen(false);

    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      setNavOpen(!isOpen);
    });

    navLinks.querySelectorAll("a.nav-link, a.nav-submenu-link").forEach((link) => {
      link.addEventListener("click", closeNav);
    });

    navMenus.forEach((menu) => {
      const toggle = menu.querySelector(".nav-submenu-toggle");
      toggle?.addEventListener("click", () => {
        const isOpen = toggle.getAttribute("aria-expanded") === "true";
        setMenuOpen(menu, !isOpen);
      });
      menu.addEventListener("mouseenter", () => {
        if (window.innerWidth > 820) setMenuOpen(menu, true);
      });
      menu.addEventListener("mouseleave", () => {
        closeMenuLater(menu);
      });
    });

    navLinks.addEventListener("click", (event) => {
      if (event.target === navLinks) {
        closeNav();
      }
    });

    document.addEventListener("click", (event) => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      if (
        isOpen &&
        !navLinks.contains(event.target) &&
        !navToggle.contains(event.target)
      ) {
        closeNav();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeNav();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) {
        closeNav();
      }
    });

    setNavOpen(false);
  }

  const backToTopButton = document.querySelector("#backToTop");
  if (backToTopButton) {
    const updateBackToTopState = () => {
      backToTopButton.classList.toggle("is-visible", window.scrollY > 320);
    };

    backToTopButton.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    window.addEventListener("scroll", updateBackToTopState, { passive: true });
    updateBackToTopState();
  }

  setupCookieNotice();
  loadFooterLinks().then(renderFooterLinks);
})();
