import { List, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeading, Shell } from "../components/Shell";
import { SmartLink } from "../components/SmartLink";
import { Empty, Loading } from "../components/ui";
import { loadDocSource, loadDocsIndex, type DocEntry } from "../lib/docs";
import {
  markdownToHtml,
  parseMarkdownImageAlt,
  resolveMarkdownImageSrc,
} from "../lib/markdown";

type TocItem = { level: number; id: string; number: string; text: string };
type RenderedDoc = { html: string; title: string; toc: TocItem[] };

const LINK_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></svg>';

function headingSlug(text: string) {
  return (
    text
      .trim()
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section"
  );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Turn the fetched Markdown into safe-to-inject HTML plus a derived TOC. */
function renderDoc(source: string, fallbackTitle: string): RenderedDoc {
  const template = document.createElement("template");
  template.innerHTML = markdownToHtml(source);
  const fragment = template.content;

  fragment.querySelectorAll("img").forEach((element) => {
    const image = element as HTMLImageElement;
    const parsedAlt = parseMarkdownImageAlt(image.getAttribute("alt") || "");
    image.alt = parsedAlt.alt;
    if (parsedAlt.width) image.style.width = parsedAlt.width;
    image.src = resolveMarkdownImageSrc(image.getAttribute("src") || "");
    image.loading = "lazy";
    image.decoding = "async";
    image.classList.add("markdown-image");

    const wrapper = document.createElement("span");
    wrapper.className = "markdown-image-wrap is-loading";
    image.parentNode?.insertBefore(wrapper, image);
    wrapper.appendChild(image);
    const finish = () => wrapper.classList.remove("is-loading");
    const fail = () => {
      wrapper.classList.remove("is-loading");
      wrapper.classList.add("is-error");
    };
    image.addEventListener("load", finish);
    image.addEventListener("error", fail);
    if (image.complete) {
      if (image.naturalWidth > 0) finish();
      else fail();
    }
  });

  fragment.querySelectorAll("a[href]").forEach((element) => {
    const anchor = element as HTMLAnchorElement;
    if (/^https?:\/\//i.test(anchor.getAttribute("href") || "")) {
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
    }
  });

  const headings = Array.from(
    fragment.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6"),
  );
  let title = fallbackTitle;
  if (headings[0]?.tagName === "H1") {
    title = headings[0].textContent?.trim() || title;
    headings.shift()?.remove();
  }

  const toc: TocItem[] = [];
  const counters: number[] = [];
  const usedIds = new Map<string, number>();
  let baseLevel = 0;
  headings.forEach((heading) => {
    const level = Number(heading.tagName.slice(1));
    if (!baseLevel) baseLevel = level <= 2 ? 2 : level;
    const depth = Math.max(0, level - baseLevel);
    counters[depth] = (counters[depth] || 0) + 1;
    counters.length = depth + 1;
    const number = counters.join(".");
    const text = heading.textContent?.trim() || "";
    const base = headingSlug(text);
    const seen = (usedIds.get(base) || 0) + 1;
    usedIds.set(base, seen);
    const id = seen === 1 ? base : `${base}-${seen}`;
    const inner = heading.innerHTML;
    heading.id = id;
    heading.innerHTML = `<a class="heading-link" href="#${id}" aria-label="链接到${escapeHtml(
      text,
    )}"><span class="heading-number">${number}</span>${inner}<span class="heading-anchor">${LINK_ICON}</span></a>`;
    toc.push({ level, id, number, text });
  });

  return { html: template.innerHTML, title, toc };
}

function useDocsIndex() {
  const [docs, setDocs] = useState<DocEntry[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    loadDocsIndex()
      .then((entries) => {
        if (active) setDocs(entries);
      })
      .catch(() => {
        if (active) setError("文档目录加载失败，请稍后重试。");
      });
    return () => {
      active = false;
    };
  }, []);
  return { docs, error };
}

const SLUG_ALIASES: Record<string, string> = {
  "application-cn": "opening-cn",
  "open-an-account-in-hk": "opening-hk",
};

export function DocsPage({ slug: routeSlug }: { slug: string }) {
  const { docs, error: indexError } = useDocsIndex();
  const entry = useMemo(() => {
    if (!docs) return undefined;
    const wanted = SLUG_ALIASES[routeSlug] || routeSlug;
    return (
      docs.find((doc) => doc.slug === wanted) ||
      docs.find((doc) => doc.slug === "about") ||
      docs[0]
    );
  }, [docs, routeSlug]);
  const [doc, setDoc] = useState<RenderedDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tocOpen, setTocOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!entry) return;
    let active = true;
    setLoading(true);
    setError("");
    setDoc(null);
    setTocOpen(false);
    loadDocSource(entry.file)
      .then((source) => {
        if (!active) return;
        setDoc(renderDoc(source, entry.title));
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError("文档加载失败，请稍后重试。");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [entry?.file, entry?.title]);

  // Images may already be cached when the HTML is injected.
  useEffect(() => {
    if (!doc) return;
    articleRef.current
      ?.querySelectorAll(".markdown-image-wrap.is-loading")
      .forEach((wrapper) => {
        const image = wrapper.querySelector("img");
        if (!image?.complete) return;
        wrapper.classList.remove("is-loading");
        if (image.naturalWidth === 0) wrapper.classList.add("is-error");
      });
  }, [doc]);

  if (indexError)
    return (
      <Shell title="文档目录">
        <PageHeading title="文档目录" />
        <Empty text={indexError} />
      </Shell>
    );

  if (!docs)
    return (
      <Shell title="文档目录">
        <PageHeading title="文档目录" />
        <Loading label="正在加载文档目录" />
      </Shell>
    );

  if (!entry)
    return (
      <Shell title="文档目录">
        <PageHeading title="文档目录" />
        <Empty text="暂无文档。请检查 CDN 的 /docs/index.json。" />
      </Shell>
    );

  const title = doc?.title || entry.title;
  return (
    <Shell title={title}>
      <PageHeading title={title} />
      {loading ? (
        <Loading label="正在加载文档" />
      ) : error ? (
        <Empty text={error} />
      ) : doc ? (
        <>
          <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_220px]">
            <article
              ref={articleRef}
              className="panel markdown-content min-w-0 max-w-none overflow-hidden p-5 sm:p-8 lg:p-10"
              dangerouslySetInnerHTML={{ __html: doc.html }}
            />
            {doc.toc.length > 0 && (
              <aside className="hidden xl:sticky xl:top-24 xl:block">
                <DocToc headings={doc.toc} />
              </aside>
            )}
          </div>

          {doc.toc.length > 0 && (
            <>
              <button
                type="button"
                className="fixed bottom-5 right-4 z-40 grid size-12 place-items-center rounded-full bg-primary text-white shadow-panel xl:hidden"
                aria-label="打开目录"
                aria-expanded={tocOpen}
                aria-controls="mobile-toc"
                onClick={() => setTocOpen(true)}
              >
                <List size={20} />
              </button>
              {tocOpen && (
                <>
                  <button
                    type="button"
                    aria-label="关闭目录"
                    className="fixed inset-0 z-40 bg-black/50 xl:hidden"
                    onClick={() => setTocOpen(false)}
                  />
                  <aside
                    id="mobile-toc"
                    className="toc-drawer fixed bottom-0 right-0 top-16 z-50 w-[min(86vw,320px)] overflow-y-auto border-l border-line bg-surface p-4 shadow-panel xl:hidden"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                        目录
                      </p>
                      <button
                        type="button"
                        className="grid size-9 place-items-center rounded-lg text-muted hover:bg-soft hover:text-accent-ink"
                        aria-label="关闭目录"
                        onClick={() => setTocOpen(false)}
                      >
                        <X size={18} />
                      </button>
                    </div>
                    <DocToc
                      headings={doc.toc}
                      className=""
                      onNavigate={() => setTocOpen(false)}
                    />
                  </aside>
                </>
              )}
            </>
          )}
        </>
      ) : null}
    </Shell>
  );
}

function DocToc({
  headings,
  className = "panel p-4",
  onNavigate,
}: {
  headings: TocItem[];
  className?: string;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="目录" className={className}>
      <ul className="grid gap-1">
        {headings.map((heading) => (
          <li key={heading.id} className={heading.level > 2 ? "pl-3" : ""}>
            <SmartLink
              href={`#${heading.id}`}
              onClick={onNavigate}
              className="block rounded-md px-2 py-1.5 text-sm text-muted transition hover:bg-accent/10 hover:text-accent-ink"
            >
              {heading.number} {heading.text}
            </SmartLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DocsIndex() {
  const { docs, error } = useDocsIndex();
  const grouped = useMemo(() => {
    if (!docs) return [];
    const groups = new Map<string, DocEntry[]>();
    docs.forEach((doc) => {
      const items = groups.get(doc.category) || [];
      items.push(doc);
      groups.set(doc.category, items);
    });
    return [...groups.entries()]
      .sort((a, b) => (a[1][0]?.order || 999) - (b[1][0]?.order || 999))
      .map(([category, items]) => ({ category, items }));
  }, [docs]);

  return (
    <Shell title="文档目录">
      <PageHeading
        title="文档目录"
        description="申请、卡组织、银行资料与站点相关说明。"
      />
      {error ? (
        <Empty text={error} />
      ) : !docs ? (
        <Loading label="正在加载文档目录" />
      ) : grouped.length ? (
        <div className="grid gap-10">
          {grouped.map(({ category, items }) => (
            <section key={category} aria-labelledby={`docs-${category}`}>
              <h2
                id={`docs-${category}`}
                className="mb-5 text-xl font-bold text-ink"
              >
                {category}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <SmartLink
                    key={item.slug}
                    href={`/docs/${item.slug}`}
                    externalIcon={false}
                    className="group block rounded-xl border border-line bg-surface p-5 shadow-panel transition hover:-translate-y-0.5 hover:border-accent"
                  >
                    <h3 className="font-bold text-ink">{item.title}</h3>
                    <p className="mt-2 text-sm text-accent-ink transition group-hover:underline">
                      查看文档 →
                    </p>
                  </SmartLink>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty text="暂无文档。" />
      )}
    </Shell>
  );
}
