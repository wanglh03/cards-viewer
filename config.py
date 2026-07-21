from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HTML_DIR = ROOT / "html"
DIST = ROOT / "dist"
DEV_DIR = ROOT / ".dev"
KV_EXPORT = ROOT / "kv" / "info.json"
ASSETS_DIR = ROOT / "assets"
ISSUERS_DIR = ASSETS_DIR / "issuers"
INFO_DIR = ASSETS_DIR / "info"
MYCARDS_DIR = ASSETS_DIR / "mycards"
CONFIG_DIR = ROOT / "config"
DOCS_DIR = ROOT / "docs"
TEMPLATES_DIR = ROOT / "templates"
HTML_FILES = (
    "index.html",
    "collection.html",
    "credit.html",
    "bin.html",
    "withdrawal.html",
    "luhn.html",
)
ROOT_MARKDOWN_PAGES = (("docs/link.md", "link.html", "link"),)
STATIC_DIRS = ("assets", "css", "js")
STATIC_DATA_SCRIPT = '<script src="js/generated/static-data.js"></script>'
LOCAL_DATA_SCRIPT = '<script src="js/generated/local-data.js"></script>'
BIN_OVERLAYS_SCRIPT = '<script src="js/generated/bin-overlays.js"></script>'
PRELOADED_MARKER = '<script src="js/common.js"></script>'
SHORT_LINK_MARKER = "<!-- cards-viewer-short-link -->"
SHORT_LINK_KEY_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]*$")
DEV_RELOAD_SCRIPT = """<script>
(() => {
  let lastToken = null;

  async function checkReload() {
    try {
      const response = await fetch("/__reload.txt?ts=" + Date.now(), {
        cache: "no-cache",
      });
      if (!response.ok) return;

      const token = (await response.text()).trim();
      if (!token) return;

      if (lastToken === null) {
        lastToken = token;
        return;
      }

      if (token !== lastToken) {
        location.reload();
      }
    } catch {
      // Ignore transient polling failures while rebuilding.
    }
  }

  checkReload();
  window.setInterval(checkReload, 1000);
})();
</script>"""
WATCH_DIRECTORIES = ("assets", "config", "css", "docs", "html", "js", "templates")
WATCH_FILE_SUFFIXES = {
    ".html",
    ".css",
    ".js",
    ".json",
    ".md",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".ico",
    ".jfif",
    ".pptx",
}
