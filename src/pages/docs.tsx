import { Link2, List, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { ComponentType, ReactNode } from "react";
import { PageHeading, Shell } from "../components/Shell";
import { SmartLink } from "../components/SmartLink";
import { SmartImage } from "../components/SmartImage";
import {
  parseMarkdownImageAlt,
  resolveMarkdownImageSrc,
} from "../lib/markdown";
import { Empty } from "../components/ui";

type DocComponent = ComponentType<any>;
type DocMeta = {
  slug: string;
  title: string;
  category: string;
  order: number;
};
type DocModule = {
  meta: DocMeta;
  default: DocComponent;
};

/**
 * Docs are authored in the cards-assets project and synced to the CDN. The
 * `predev`/`prebuild` scripts download them into `.docs-cache` together with
 * their metadata (folder = category, first heading = title), so this index and
 * each page's TOC always follow the files themselves.
 */
const docModules = import.meta.glob("../../.docs-cache/**/*.mdx", {
  eager: true,
}) as Record<string, DocModule>;

const docEntries = Object.values(docModules)
  .map((module) => ({ ...module.meta, component: module.default }))
  .sort(
    (a, b) =>
      a.order - b.order || a.title.localeCompare(b.title, "zh-Hans-CN"),
  );

const docsBySlug = new Map(docEntries.map((doc) => [doc.slug, doc]));

const docsByCategory = [
  ...new Map(docEntries.map((doc) => [doc.category, doc.order])).entries(),
]
  .sort((a, b) => a[1] - b[1])
  .map(([category]) => ({
    category,
    items: docEntries.filter((doc) => doc.category === category),
  }));

type MdxTocItem = { level: number; id: string; number: string; text: string };
type MdxHeadingMeta = { id: string; isFirstH1: boolean; number: string };
type MdxHeadingContextValue = {
  registerHeading: (key: string, level: number, text: string) => MdxHeadingMeta;
};

const MdxHeadingContext = createContext<MdxHeadingContextValue | null>(null);

function mdxText(value: ReactNode): string {
  if (value === null || value === undefined || typeof value === "boolean")
    return "";
  if (typeof value === "string" || typeof value === "number")
    return String(value);
  if (Array.isArray(value)) return value.map(mdxText).join("");
  if (typeof value === "object" && "props" in value)
    return mdxText(
      (value as { props?: { children?: ReactNode } }).props?.children,
    );
  return "";
}

function mdxSlug(text: string) {
  return (
    text
      .trim()
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-") || "section"
  );
}

type HeadingProps = {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
  [key: string]: unknown;
};

function MdxHeading({ level, children, ...props }: HeadingProps) {
  const context = useContext(MdxHeadingContext);
  const key = useId();
  const text = mdxText(children);
  const meta = context?.registerHeading(key, level, text);
  const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  if (meta?.isFirstH1) return null;
  const id = meta?.id || mdxSlug(text);
  return (
    <Tag id={id} {...props}>
      <a
        className="heading-link"
        href={`#${id}`}
        aria-label={`链接到${text || "此标题"}`}
      >
        <span className="heading-number">{meta?.number}</span>
        <span>{children}</span>
        <span className="heading-anchor">
          <Link2 aria-hidden="true" size={16} />
        </span>
      </a>
    </Tag>
  );
}

const mdxComponents = {
  h1: (props: HeadingProps) => <MdxHeading {...props} level={1} />,
  h2: (props: HeadingProps) => <MdxHeading {...props} level={2} />,
  h3: (props: HeadingProps) => <MdxHeading {...props} level={3} />,
  h4: (props: HeadingProps) => <MdxHeading {...props} level={4} />,
  h5: (props: HeadingProps) => <MdxHeading {...props} level={5} />,
  h6: (props: HeadingProps) => <MdxHeading {...props} level={6} />,
  a: ({ href, children, ...props }: { href?: string; children?: ReactNode }) => (
    <SmartLink href={href} {...props}>
      {children}
    </SmartLink>
  ),
  img: ({ alt, src, title, style }: { alt?: string; src?: string; title?: string; style?: object }) => {
    const image = parseMarkdownImageAlt(alt || "");
    return (
      <SmartImage
        src={resolveMarkdownImageSrc(src || "")}
        alt={image.alt}
        className="markdown-image-wrap max-w-full"
        imgClassName="h-auto max-w-full max-h-[560px] object-contain"
        imgStyle={{ ...style, ...(image.width ? { width: image.width } : {}) }}
        spinnerSize={24}
      />
    );
  },
};

export function DocsPage({ slug }: { slug: string }) {
  const doc = docsBySlug.get(slug) || docsBySlug.get("about") || docEntries[0];
  const [title, setTitle] = useState(doc?.title || "文档");
  const [titleAnchor, setTitleAnchor] = useState("");
  const handleTitle = useCallback((nextTitle: string, nextAnchor: string) => {
    if (nextTitle) setTitle(nextTitle);
    if (nextAnchor) setTitleAnchor(nextAnchor);
  }, []);
  if (!doc)
    return (
      <Shell title="文档目录">
        <PageHeading title="文档目录" />
        <Empty text="暂无文档。请检查 CDN 的 /docs/index.json，或运行 npm run docs 重新同步。" />
      </Shell>
    );
  return (
    <Shell title={title}>
      <PageHeading title={title} titleAnchor={titleAnchor} />
      <MdxDocument Doc={doc.component} onTitleChange={handleTitle} />
    </Shell>
  );
}

type HeadingRegistry = {
  doc: DocComponent | null;
  items: MdxTocItem[];
  counts: Map<string, number>;
  entries: Map<string, MdxHeadingMeta>;
  firstTitle: string;
  firstId: string;
  baseLevel: number;
  counters: number[];
};

function emptyRegistry(doc: DocComponent | null): HeadingRegistry {
  return {
    doc,
    items: [],
    counts: new Map(),
    entries: new Map(),
    firstTitle: "",
    firstId: "",
    baseLevel: 0,
    counters: [],
  };
}

function MdxDocument({
  Doc,
  onTitleChange,
}: {
  Doc: DocComponent;
  onTitleChange: (title: string, anchor: string) => void;
}) {
  const [headings, setHeadings] = useState<MdxTocItem[]>([]);
  const [tocOpen, setTocOpen] = useState(false);
  const registry = useRef<HeadingRegistry>(emptyRegistry(null));
  if (registry.current.doc !== Doc) registry.current = emptyRegistry(Doc);

  const registerHeading = (key: string, level: number, text: string) => {
    const current = registry.current;
    const existing = current.entries.get(key);
    if (existing) return existing;
    const isFirstH1 = level === 1 && !current.firstTitle;
    const base = mdxSlug(text);
    const count = (current.counts.get(base) || 0) + 1;
    current.counts.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;

    // The first H1 is the document title: PageHeading renders it, so it must
    // not be numbered or listed in the table of contents.
    if (isFirstH1) {
      current.firstTitle = text;
      current.firstId = id;
      const meta = { id, isFirstH1: true, number: "" };
      current.entries.set(key, meta);
      return meta;
    }

    if (!current.baseLevel) current.baseLevel = level === 1 ? 1 : 2;
    const depth = Math.max(0, level - current.baseLevel);
    current.counters[depth] = (current.counters[depth] || 0) + 1;
    current.counters.length = depth + 1;
    const number = current.counters.join(".");
    current.items.push({ level, id, number, text });
    const meta = { id, isFirstH1, number };
    current.entries.set(key, meta);
    return meta;
  };

  useEffect(() => {
    setHeadings([...registry.current.items]);
    if (registry.current.firstTitle)
      onTitleChange(registry.current.firstTitle, registry.current.firstId);
  }, [Doc, onTitleChange]);

  return (
    <>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_220px]">
        <article className="panel markdown-content min-w-0 max-w-none overflow-hidden p-5 sm:p-8 lg:p-10">
          <MdxHeadingContext.Provider value={{ registerHeading }}>
            <Doc components={mdxComponents} />
          </MdxHeadingContext.Provider>
        </article>
        {headings.length > 0 && (
          <aside className="hidden xl:sticky xl:top-24 xl:block">
            <MdxToc headings={headings} />
          </aside>
        )}
      </div>

      {headings.length > 0 && (
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
                <MdxToc
                  headings={headings}
                  className=""
                  onNavigate={() => setTocOpen(false)}
                />
              </aside>
            </>
          )}
        </>
      )}
    </>
  );
}

function MdxToc({
  headings,
  className = "panel p-4",
  onNavigate,
}: {
  headings: MdxTocItem[];
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
  return (
    <Shell title="文档目录">
      <PageHeading title="文档目录" description="申请、卡组织、银行资料与站点相关说明。" />
      <div className="grid gap-10">
        {docsByCategory.map(({ category, items }) => (
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
    </Shell>
  );
}
