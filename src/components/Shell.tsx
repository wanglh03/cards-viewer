import { ChevronDown, Github, Link2, Menu, Moon, Sun, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { navigationFooter, siteData } from "../lib/data";
import type { NavigationItem } from "../lib/types";
import { CookieConsent } from "./CookieConsent";
import { SmartLink } from "./SmartLink";

type Props = { children: ReactNode; title?: string; wide?: boolean };

const links = siteData.navigation?.items || [];

export function Shell({ children, title = "卡面图鉴" }: Props) {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("bankcard-theme") === "dark");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    document.body.classList.toggle("theme-dark", dark);
    localStorage.setItem("bankcard-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => { document.title = `${title} · 卡面图鉴`; }, [title]);

  return <div className={dark ? "dark" : ""}>
    <header className="sticky top-0 z-40 border-b border-line/80 bg-[#f4f6f3]/90 backdrop-blur-xl dark:bg-[#101714]/90">
      <div className="mx-auto flex min-h-16 max-w-[1180px] items-center justify-between gap-4 px-5">
        <SmartLink href="/" className="flex items-center gap-3 font-bold text-ink dark:text-white">
          <span className="grid size-9 place-items-center rounded-lg bg-ink text-sm text-white dark:bg-white dark:text-ink">卡</span>
          <span>{siteData.navigation?.brand?.label || "卡面图鉴"}</span>
        </SmartLink>
        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => <DesktopNavItem key={link.label} item={link} />)}
        </nav>
        <div className="flex items-center gap-1">
          {siteData.navigation?.github?.enabled && <SmartLink externalIcon={false} className="grid size-10 place-items-center text-ink/70 hover:bg-accent/10 hover:text-accent dark:text-white/80" href={siteData.navigation.github.url} target="_blank" rel="noreferrer" aria-label="GitHub"><Github size={18} /></SmartLink>}
          <button className="grid size-10 place-items-center rounded-lg text-ink/70 hover:bg-accent/10 hover:text-accent dark:text-white/80" onClick={() => setDark((value) => !value)} aria-label="切换主题">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="grid size-10 place-items-center rounded-lg text-ink lg:hidden dark:text-white" onClick={() => setOpen((value) => !value)} aria-label="打开菜单">{open ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </div>
      <AnimatePresence>{open && <motion.nav initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="max-h-[calc(100vh-4rem)] overflow-y-auto overscroll-contain border-t border-line lg:hidden"><div className="mx-auto max-w-[1180px] px-5 py-3">{links.map((link) => <MobileNavItem key={link.label} item={link} onNavigate={() => setOpen(false)} />)}</div></motion.nav>}</AnimatePresence>
    </header>
    <main className="mx-auto min-h-[calc(100vh-9rem)] max-w-[1180px] px-5 py-10">{children}</main>
    <footer className="mt-12 border-t border-line bg-white/60 dark:bg-[#101714]/60"><div className="mx-auto max-w-[1180px] px-5 py-10"><div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">{navigationFooter.map((column) => <section key={column.title}><h2 className="text-sm font-bold text-ink dark:text-white">{column.title}</h2><ul className="mt-3 grid gap-2">{column.links.map((link) => <li key={link.label}><SmartLink className="text-sm text-muted transition hover:text-accent" href={link.url} target={link.url?.startsWith("http") ? "_blank" : undefined} rel={link.url?.startsWith("http") ? "noreferrer" : undefined}>{link.label}</SmartLink></li>)}</ul></section>)}</div><div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-5 text-sm text-muted"><SmartLink className="inline-flex items-center gap-2 transition hover:text-accent" href={siteData.navigation?.github?.url} target="_blank" rel="noreferrer" aria-label="GitHub 仓库"><Github size={18} /><span>GitHub</span></SmartLink><span>© 2026 GTB. All rights reserved.</span></div></div></footer>
    <CookieConsent />
  </div>;
}

function DesktopNavItem({ item }: { item: NavigationItem }) {
  const [open, setOpen] = useState(false);
  const children = item.children || (item.source === "footer" ? navigationFooter.find((column) => column.title === item.section)?.links || [] : []);
  if (!children.length) return <SmartLink href={item.url} className={`rounded-lg px-3 py-2 text-sm font-semibold transition hover:bg-accent/10 hover:text-accent ${isActive(item.url) ? "bg-accent/10 text-accent" : "text-ink/75 dark:text-white/80"}`}>{item.label}</SmartLink>;
  return <div className="group relative"><button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-semibold text-ink/75 transition hover:bg-accent/10 hover:text-accent dark:text-white/80">{item.label}<ChevronDown size={15} /></button><div className={`${open ? "visible opacity-100" : "invisible opacity-0"} absolute left-0 top-[calc(100%-1px)] z-50 min-w-44 rounded-lg border border-line bg-white p-1 shadow-panel transition group-hover:visible group-hover:opacity-100 dark:bg-[#1b2420]`}>{children.map((child) => <SmartLink key={child.label} href={child.url} target={child.url?.startsWith("http") ? "_blank" : undefined} rel={child.url?.startsWith("http") ? "noreferrer" : undefined} className="block rounded-md px-3 py-2 text-sm whitespace-nowrap hover:bg-accent/10 hover:text-accent">{child.label}</SmartLink>)}</div></div>;
}

function MobileNavItem({ item, onNavigate, depth = 0 }: { item: NavigationItem; onNavigate: () => void; depth?: number }) {
  const children = item.children || (item.source === "footer" ? navigationFooter.find((column) => column.title === item.section)?.links || [] : []);
  const [expanded, setExpanded] = useState(false);

  return <div className={depth ? "ml-4 border-l border-line pl-3" : ""}>
    {children.length ? (
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)} className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-semibold text-ink hover:bg-accent/10 hover:text-accent dark:text-white">
        <span>{item.label}</span>
        <ChevronDown size={16} className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
    ) : item.url ? (
      <SmartLink href={item.url} onClick={onNavigate} className="block rounded-lg px-3 py-3 text-sm font-semibold hover:bg-accent/10 hover:text-accent">{item.label}</SmartLink>
    ) : (
      <div className="px-3 py-3 text-xs font-bold uppercase tracking-wider text-muted">{item.label}</div>
    )}
    {expanded && children.map((child) => <MobileNavItem key={child.label} item={child} onNavigate={onNavigate} depth={depth + 1} />)}
  </div>;
}

function isActive(url?: string) { return url === "/" ? location.pathname === "/" : location.pathname === String(url || ""); }

export function PageHeading({ eyebrow, title, titleAnchor, description, action }: { eyebrow?: string; title: string; titleAnchor?: string; description?: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-wrap items-end justify-between gap-5"><div>{eyebrow && <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}<h1 id={titleAnchor || undefined} className="page-heading scroll-mt-20 text-4xl font-bold tracking-tight text-ink dark:text-white sm:text-5xl">{titleAnchor ? <a className="page-heading-link" href={`#${titleAnchor}`} aria-label={`链接到${title}`}><span>{title}</span><span className="page-heading-anchor"><Link2 aria-hidden="true" size={20} /></span></a> : <span>{title}</span>}</h1>{description && <p className="mt-3 max-w-2xl text-muted">{description}</p>}</div>{action}</div>;
}
