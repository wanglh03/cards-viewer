import { ChevronDown, Github, Link2, Menu, Moon, Sun, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { navigationFooter, siteData } from "../lib/data";
import type { NavigationItem } from "../lib/types";
import { useTheme } from "../lib/hooks";
import { CookieConsent } from "./CookieConsent";
import { SmartLink } from "./SmartLink";

const navigation = siteData.navigation || {};
const brand = navigation.brand || { label: "卡面图鉴", mark: "卡", url: "/" };
const links = navigation.items || [];

function isActive(url?: string) {
  const path = location.pathname.replace(/\/$/, "") || "/";
  return url === path;
}

export function Shell({ children, title = "卡面图鉴" }: { children: ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const [dark, toggleDark] = useTheme();

  useEffect(() => {
    document.title = title === "卡面图鉴" ? title : `${title} · 卡面图鉴`;
  }, [title]);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="skip-link">
        跳到主要内容
      </a>
      <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/85 backdrop-blur-xl">
        <div className="page-container flex min-h-16 items-center justify-between gap-4">
          <SmartLink
            href={brand.url}
            className="flex shrink-0 items-center gap-2.5 text-sm font-bold text-ink"
            aria-label={brand.label}
          >
            <span className="grid size-9 place-items-center rounded-xl bg-ink text-sm font-black text-canvas">
              {brand.mark || "卡"}
            </span>
            <span className="truncate">{brand.label}</span>
          </SmartLink>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="主导航">
            {links.map((link) => (
              <DesktopNavItem
                key={`${link.label}-${link.url}`}
                item={link}
              />
            ))}
          </nav>

          <div className="flex items-center gap-0.5">
            {navigation.github?.enabled && (
              <SmartLink
                externalIcon={false}
                className="icon-button"
                href={navigation.github.url}
                aria-label="GitHub"
              >
                <Github size={18} />
              </SmartLink>
            )}
            <button
              className="icon-button"
              onClick={toggleDark}
              aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
              aria-pressed={dark}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              className="icon-button lg:hidden"
              onClick={() => setOpen((value) => !value)}
              aria-label={open ? "关闭菜单" : "打开菜单"}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <nav
            id="mobile-nav"
            aria-label="移动端导航"
            className="mobile-nav max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-line lg:hidden"
          >
            <div className="page-container py-3">
              {links.map((link) => (
                <MobileNavItem
                  key={`${link.label}-${link.url}`}
                  item={link}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="page-container min-h-[calc(100dvh-9rem)] py-8 sm:py-10">
        {children}
      </main>

      <footer className="mt-12 border-t border-line bg-surface/60">
        <div className="page-container py-10">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {navigationFooter.map((column) => (
              <section key={column.title}>
                <h2 className="text-sm font-bold text-ink">{column.title}</h2>
                <ul className="mt-3 grid gap-2">
                  {column.links.map((link) => (
                    <li key={`${link.label}-${link.url}`}>
                      <SmartLink
                        className="footer-link"
                        href={link.url}
                        target={link.url?.startsWith("http") ? "_blank" : undefined}
                        rel={link.url?.startsWith("http") ? "noreferrer" : undefined}
                      >
                        {link.label}
                      </SmartLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-sm text-muted">
            <SmartLink
              className="inline-flex items-center gap-2 transition hover:text-accent-ink"
              href={navigation.github?.url}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub 仓库"
            >
              <Github size={18} />
              <span>GitHub</span>
            </SmartLink>
            <span>© 2026 GTB. All rights reserved.</span>
          </div>
        </div>
      </footer>
      <CookieConsent />
    </div>
  );
}

function navChildren(item: NavigationItem) {
  return (
    item.children ||
    (item.source === "footer"
      ? navigationFooter.find((column) => column.title === item.section)?.links ||
        []
      : [])
  );
}

function DesktopNavItem({ item }: { item: NavigationItem }) {
  const [open, setOpen] = useState(false);
  const children = navChildren(item);

  if (!children.length)
    return (
      <SmartLink
        href={item.url}
        className="nav-link"
        aria-current={isActive(item.url) ? "page" : undefined}
      >
        {item.label}
      </SmartLink>
    );

  return (
    <div
      className="group relative"
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="nav-link inline-flex items-center gap-1"
      >
        {item.label}
        <ChevronDown
          size={15}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`nav-dropdown ${open ? "is-open" : ""}`}
        role="menu"
      >
        {children.map((child) => (
          <SmartLink
            key={`${child.label}-${child.url}`}
            href={child.url}
            target={child.url?.startsWith("http") ? "_blank" : undefined}
            rel={child.url?.startsWith("http") ? "noreferrer" : undefined}
            className="nav-dropdown-link"
            role="menuitem"
          >
            {child.label}
          </SmartLink>
        ))}
      </div>
    </div>
  );
}

function MobileNavItem({
  item,
  onNavigate,
  depth = 0,
}: {
  item: NavigationItem;
  onNavigate: () => void;
  depth?: number;
}) {
  const children = navChildren(item);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={depth ? "ml-4 border-l border-line pl-3" : ""}>
      {children.length ? (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="mobile-nav-link justify-between"
          >
            <span>{item.label}</span>
            <ChevronDown
              size={16}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
          {expanded &&
            children.map((child) => (
              <MobileNavItem
                key={`${child.label}-${child.url}`}
                item={child}
                onNavigate={onNavigate}
                depth={depth + 1}
              />
            ))}
        </>
      ) : item.url ? (
        <SmartLink
          href={item.url}
          onClick={onNavigate}
          className="mobile-nav-link"
          aria-current={isActive(item.url) ? "page" : undefined}
        >
          {item.label}
        </SmartLink>
      ) : (
        <div className="px-3 py-3 text-sm font-semibold text-muted">
          {item.label}
        </div>
      )}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  titleAnchor,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  titleAnchor?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1
          id={titleAnchor || undefined}
          className="scroll-mt-20 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl"
        >
          {titleAnchor ? (
            <a
              className="page-heading-link"
              href={`#${titleAnchor}`}
              aria-label={`链接到${title}`}
            >
              <span>{title}</span>
              <span className="page-heading-anchor">
                <Link2 aria-hidden="true" size={20} />
              </span>
            </a>
          ) : (
            <span>{title}</span>
          )}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}
