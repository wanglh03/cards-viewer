(() => {
  const themeKey = "bankcard-theme";
  const page = document.body?.dataset.page || "home";
  const isHome = page === "home";
  const isCredit = page === "credit";
  const isReferral = page === "referral";

  function sanitizeFilename(name) {
    return String(name || "")
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ");
  }

  function assetPath(...parts) {
    return parts.map((part) => encodeURIComponent(part)).join("/");
  }

  function resolveImageUrl(bankKey, value) {
    const text = String(value || "").trim();
    if (!text) return "";
    if (
      /^(https?:)?\/\//i.test(text) ||
      text.startsWith("/") ||
      text.startsWith("assets/")
    ) {
      return text;
    }
    return assetPath("assets", bankKey, text);
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

  function normalizeOrganizationKey(organization) {
    const text = String(organization || "").trim();
    if (!text) return "";
    if (text === "Mastercard") return "Mastercard.png";
    if (text === "VISA") return "VISA.png";
    if (text === "AMEX") return "AMEX.png";
    if (text === "UnionPay") return "UnionPay.png";
    if (text === "JCB") return "JCB.png";
    if (text === "China T-Union") return "China_T-union.svg";
    return text;
  }

  function organizationIconUrl(organization) {
    const key = normalizeOrganizationKey(organization);
    if (!key) return "";
    return assetPath("assets", key);
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

  async function fetchJsonSafe(url, options = {}) {
    try {
      const res = await fetch(url, { cache: "no-cache" });
      const text = await res.text();
      if (!res.ok) {
        if (options.warn) {
          console.warn(`JSON request failed: ${url}`, res.status);
        }
        return null;
      }
      try {
        return JSON.parse(text);
      } catch (error) {
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

  async function discoverAssetFolders(options = {}) {
    const preloaded = getPreloadedSiteData();
    if (Array.isArray(preloaded?.manifest)) {
      return preloaded.manifest.slice();
    }

    const manifest = await fetchJsonSafe("assets/manifest.json", {
      warn: options.warn,
    });
    if (Array.isArray(manifest)) {
      return manifest.slice();
    }
    if (manifest && options.warn) {
      console.warn("assets/manifest.json must be an array");
    }
    return [];
  }

  async function loadCardsFromAssets(mapEntry, options = {}) {
    if (typeof mapEntry !== "function") return [];

    const warn = Boolean(options.warn);
    const issuers = await discoverAssetFolders({ warn });
    const preloaded = getPreloadedSiteData();
    const loaded = [];

    for (const item of issuers) {
      const bankKey = resolveAssetFolderKey(item);
      if (!bankKey) continue;

      const url = assetPath("assets", bankKey, "data.json");
      const data =
        preloaded?.banks?.[bankKey] || (await fetchJsonSafe(url, { warn }));
      if (!data || !data.bank || !Array.isArray(data.cards)) {
        if (warn) {
          console.warn(`Skipped issuer data: ${url}`);
        }
        continue;
      }

      for (const entry of data.cards) {
        const mapped = mapEntry(bankKey, data.bank, entry);
        if (mapped !== null && mapped !== undefined) {
          loaded.push(mapped);
        }
      }
    }

    return loaded;
  }

  async function loadCardsFromAssetsProgressively(mapEntry, options = {}) {
    if (typeof mapEntry !== "function") return [];

    const warn = Boolean(options.warn);
    const onBatch =
      typeof options.onBatch === "function" ? options.onBatch : null;
    const issuers = await discoverAssetFolders({ warn });
    const preloaded = getPreloadedSiteData();
    const loaded = [];

    for (const item of issuers) {
      const bankKey = resolveAssetFolderKey(item);
      if (!bankKey) continue;

      const url = assetPath("assets", bankKey, "data.json");
      const data =
        preloaded?.banks?.[bankKey] || (await fetchJsonSafe(url, { warn }));
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

  async function loadReferralItems(options = {}) {
    const preloaded = getPreloadedSiteData();
    if (Array.isArray(preloaded?.referral?.items)) {
      return preloaded.referral.items.slice();
    }

    const data = await fetchJsonSafe("assets/referral.json", options);
    return Array.isArray(data?.items) ? data.items : [];
  }

  window.cardUtils = {
    sanitizeFilename,
    assetPath,
    resolveImageUrl,
    toArray,
    firstDefined,
    normalizeOrganizationKey,
    organizationIconUrl,
    resolveAssetFolderKey,
    fetchJsonSafe,
    discoverAssetFolders,
    loadCardsFromAssets,
    loadCardsFromAssetsProgressively,
    loadReferralItems,
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

  const savedTheme = getSavedTheme();
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }

  const navRoot = document.querySelector("#siteNav");
  if (navRoot) {
    navRoot.innerHTML = `
      <nav class="topbar" aria-label="页面导航">
        <a class="organization" href="index.html" aria-label="卡片收藏首页">
          <span class="organization-mark" aria-hidden="true">卡</span>
          <span>卡片收藏</span>
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
          <div class="nav-links" id="navLinks" aria-label="页面切换">
            <a class="nav-link ${isHome ? "is-active" : ""}" href="index.html">卡片收藏</a>
            <a class="nav-link ${isCredit ? "is-active" : ""}" href="credit.html">现持信用卡</a>
            <a class="nav-link ${isReferral ? "is-active" : ""}" href="referral.html">开户邀请</a>
          </div>
          <a
            class="icon-link"
            href="https://github.com/wanglh03/cards-viewer"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub 仓库"
            title="GitHub 仓库"
          >
            <svg
              class="icon-link-svg"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                fill="currentColor"
                d="M12 .5C5.65.5.5 5.66.5 12.03c0 5.09 3.29 9.4 7.86 10.92.58.11.79-.25.79-.56 0-.28-.01-1.19-.02-2.15-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.7-1.28-1.7-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.2 1.77 1.2 1.03 1.78 2.71 1.27 3.37.97.1-.75.4-1.27.73-1.56-2.56-.29-5.24-1.29-5.24-5.73 0-1.27.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.17 1.19a10.94 10.94 0 0 1 5.77 0c2.19-1.5 3.16-1.19 3.16-1.19.64 1.58.24 2.76.12 3.05.74.81 1.18 1.84 1.18 3.11 0 4.45-2.68 5.44-5.24 5.73.41.36.78 1.08.78 2.18 0 1.58-.01 2.85-.01 3.24 0 .31.21.68.8.56A11.53 11.53 0 0 0 23.5 12.03C23.5 5.66 18.35.5 12 .5Z"
              />
            </svg>
          </a>
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
        <div class="footer-links">
          <a href="https://cards.haruka.hk/" target="_blank" rel="noopener">Cardentify</a>
          &nbsp;·&nbsp;
          <a href="https://cardbin.cn/querybin.html" target="_blank" rel="noopener">卡 BIN 查询</a>
          &nbsp;·&nbsp;
          <a href="https://bincheck.io/zh" target="_blank" rel="noopener">BIN Check</a>
          &nbsp;·&nbsp;
          <a href="http://bineagle.com/" target="_blank" rel="noopener">BIN Eagle</a>
          &nbsp;·&nbsp;
          <a href="https://www.kylc.com/huilv/whichcard.html?amt=10000" target="_blank" rel="noopener">出国该刷哪张卡</a>
        </div>
        <div class="copyright">© 2026 GTB. All rights reserved.</div>
      </footer>
    `;
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
  if (navToggle && navLinks) {
    const closeNav = () => {
      navToggle.setAttribute("aria-expanded", "false");
      navLinks.classList.remove("is-open");
    };

    navToggle.addEventListener("click", () => {
      const isOpen = navToggle.getAttribute("aria-expanded") === "true";
      navToggle.setAttribute("aria-expanded", String(!isOpen));
      navLinks.classList.toggle("is-open", !isOpen);
    });

    navLinks.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", closeNav);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 820) {
        closeNav();
      }
    });
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
})();
