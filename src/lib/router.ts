import { useEffect, useState } from "react";

function normalize(pathname: string) {
  return pathname.replace(/\/+$/, "") || "/";
}

/**
 * A tiny client-side router: it keeps the app in sync with the History API so
 * internal links no longer trigger a full document reload.
 */
export function usePathname() {
  const [pathname, setPathname] = useState(() => normalize(location.pathname));

  useEffect(() => {
    const sync = () => setPathname(normalize(location.pathname));
    const navigate = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const anchor = (event.target as Element | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;
      const url = new URL(anchor.href, location.href);
      if (url.origin !== location.origin) return;
      // Same path: let the browser handle in-page anchors.
      if (url.pathname === location.pathname && url.search === location.search)
        return;
      event.preventDefault();
      history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
      sync();
      if (url.hash) {
        requestAnimationFrame(() =>
          document
            .getElementById(decodeURIComponent(url.hash.slice(1)))
            ?.scrollIntoView(),
        );
      } else {
        window.scrollTo(0, 0);
      }
    };
    document.addEventListener("click", navigate);
    window.addEventListener("popstate", sync);
    return () => {
      document.removeEventListener("click", navigate);
      window.removeEventListener("popstate", sync);
    };
  }, []);

  return pathname;
}
