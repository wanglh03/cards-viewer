(() => {
  const themeKey = "bankcard-theme";
  const page = document.body?.dataset.page || "home";

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

  function normalizeBrandKey(brand) {
    const text = String(brand || "").trim();
    if (!text) return "";
    const upper = text.toUpperCase();
    if (upper.includes("AMEX")) return "AMEX.png";
    if (upper.includes("MASTER")) return "Mastercard.png";
    if (upper.includes("UNION")) return "UnionPay.png";
    if (upper.includes("VISA")) return "VISA.png";
    if (upper.includes("T-UNION")) return "China_T-union.svg";
    return text;
  }

  function brandIconUrl(brand) {
    const key = normalizeBrandKey(brand);
    if (!key) return "";
    return assetPath("assets", key);
  }

  function resolveAssetFolderKey(item) {
    return typeof item === "string"
      ? item
      : item?.dir || item?.key || item?.id || item?.name || "";
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
    const loaded = [];

    for (const item of issuers) {
      const bankKey = resolveAssetFolderKey(item);
      if (!bankKey) continue;

      const url = assetPath("assets", bankKey, "data.json");
      const data = await fetchJsonSafe(url);
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

  window.cardUtils = {
    sanitizeFilename,
    assetPath,
    resolveImageUrl,
    toArray,
    firstDefined,
    normalizeBrandKey,
    brandIconUrl,
    resolveAssetFolderKey,
    fetchJsonSafe,
    discoverAssetFolders,
    loadCardsFromAssets,
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

  const loadingRoot = document.querySelector("#siteLoading");
  if (loadingRoot) {
    const loadingId = page === "credit" ? "tableLoading" : "pageLoading";
    const loadingCopy =
      page === "credit" ? "正在读取信用卡信息" : "正在读取卡片信息";
    loadingRoot.innerHTML = `
      <div class="page-loading" id="${loadingId}" role="status" aria-live="polite">
        <div class="page-loading-card">
          <div class="page-loading-spinner" aria-hidden="true"></div>
          <p>加载中...</p>
          <span>${loadingCopy}</span>
        </div>
      </div>
    `;
  }

  const navRoot = document.querySelector("#siteNav");
  if (navRoot) {
    const isHome = page === "home";
    navRoot.innerHTML = `
      <nav class="topbar" aria-label="页面导航">
        <a class="brand" href="index.html" aria-label="卡片收藏首页">
          <span class="brand-mark" aria-hidden="true">卡</span>
          <span>卡片收藏</span>
        </a>
        <div class="toolbar">
          <div class="nav-links" aria-label="页面切换">
            <a class="nav-link ${isHome ? "is-active" : ""}" href="index.html">卡片收藏</a>
            <a class="nav-link ${!isHome ? "is-active" : ""}" href="credit.html">信用卡一览</a>
          </div>
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
        </div>
        <div class="copyright">© 2026 GTB. All rights reserved.</div>
      </footer>
    `;
  }

  const themeToggle = document.querySelector("#themeToggle");
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const next = currentTheme() === "dark" ? "light" : "dark";
      setTheme(next);
    });
  }
})();
