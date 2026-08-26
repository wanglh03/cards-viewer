import { Link2, List, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PageHeading, Shell } from "../components/Shell";
import { SmartLink } from "../components/SmartLink";
import { parseMarkdownImageAlt, resolveMarkdownImageSrc } from "../lib/markdown";
import AboutMdx from "../content/docs/about.mdx";
import ReferralMdx from "../content/docs/referral.mdx";
import OrganizationMdx from "../content/docs/organization.mdx";
import ApplicationMdx from "../content/docs/application-cn.mdx";
import HkMdx from "../content/docs/open-an-account-in-hk.mdx";
import VisaMdx from "../content/docs/visa.mdx";
import LinkMdx from "../content/docs/link.mdx";
import PullCnMdx from "../content/docs/pull-cn.mdx";
import BocMdx from "../content/docs/boc-8103102.mdx";
import CiticMdx from "../content/docs/citic.mdx";
import DebitFeeMdx from "../content/docs/debit-fee.mdx";
import IcbcMdx from "../content/docs/icbc-3136.mdx";
import MastercardMdx from "../content/docs/mastercard.mdx";

type DocComponent = ComponentType<any>;
type DocCategory = "申请与开户" | "卡组织与活动" | "银行资料" | "站点资料";
type DocEntry = {
  title: string;
  component: DocComponent;
  category: DocCategory;
};
const docs: Record<string, DocEntry> = {
  about: {
    title: "关于",
    component: AboutMdx,
    category: "站点资料",
  },
  referral: {
    title: "开户邀请码",
    component: ReferralMdx,
    category: "申请与开户",
  },
  organization: {
    title: "卡组织权益",
    component: OrganizationMdx,
    category: "卡组织与活动",
  },
  "application-cn": {
    title: "中国大陆卡片申请方式",
    component: ApplicationMdx,
    category: "申请与开户",
  },
  "open-an-account-in-hk": {
    title: "香港开户指南",
    component: HkMdx,
    category: "申请与开户",
  },
  visa: {
    title: "VISA",
    component: VisaMdx,
    category: "卡组织与活动",
  },
  link: {
    title: "相关链接",
    component: LinkMdx,
    category: "站点资料",
  },
  "pull-cn": {
    title: "中国大陆各行申请信用卡征信查询规则",
    component: PullCnMdx,
    category: "银行资料",
  },
  "boc-8103102": {
    title: "中国银行开立非预制卡（8103102）",
    component: BocMdx,
    category: "银行资料",
  },
  citic: {
    title: "中信银行申请链接",
    component: CiticMdx,
    category: "银行资料",
  },
  "debit-fee": {
    title: "各行借记卡费用一览",
    component: DebitFeeMdx,
    category: "银行资料",
  },
  "icbc-3136": {
    title: "中国工商银行信用卡附属卡快速发卡（3136）",
    component: IcbcMdx,
    category: "银行资料",
  },
  mastercard: {
    title: "Mastercard",
    component: MastercardMdx,
    category: "卡组织与活动",
  },
};

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

function MdxHeading({
  level,
  children,
  ...props
}: {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children?: ReactNode;
  [key: string]: unknown;
}) {
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
  h1: (props: any) => <MdxHeading level={1} {...props} />,
  h2: (props: any) => <MdxHeading level={2} {...props} />,
  h3: (props: any) => <MdxHeading level={3} {...props} />,
  h4: (props: any) => <MdxHeading level={4} {...props} />,
  h5: (props: any) => <MdxHeading level={5} {...props} />,
  h6: (props: any) => <MdxHeading level={6} {...props} />,
  a: ({ href, children, ...props }: any) => (
    <SmartLink href={href} {...props}>
      {children}
    </SmartLink>
  ),
  img: ({ alt, src, title, style, className, ...props }: any) => {
    const image = parseMarkdownImageAlt(alt || "");
    return (
    <img
      loading="lazy"
      src={resolveMarkdownImageSrc(src || "")}
      alt={image.alt}
      title={title}
      style={{ ...style, ...(image.width ? { width: image.width } : {}) }}
      className={`markdown-image max-h-[560px] w-auto max-w-full rounded-lg object-contain ${className || ""}`}
      {...props}
    />
    );
  },
};

export function DocsPage({ slug }: { slug: string }) {
  const doc = docs[slug] || docs.about;
  const Doc = doc.component;
  const [title, setTitle] = useState(doc.title);
  const [titleAnchor, setTitleAnchor] = useState("");
  const handleTitle = useCallback((nextTitle: string, nextAnchor: string) => {
    if (nextTitle) setTitle(nextTitle);
    if (nextAnchor) setTitleAnchor(nextAnchor);
  }, []);
  if (slug === "index") return <DocsIndex />;
  return (
    <Shell title={title}>
      <PageHeading title={title} titleAnchor={titleAnchor} />
      <MdxDocument Doc={Doc} onTitleChange={handleTitle} />
    </Shell>
  );
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
  const registry = useRef<{
    doc: DocComponent | null;
    items: MdxTocItem[];
    counts: Map<string, number>;
    entries: Map<string, MdxHeadingMeta>;
    firstTitle: string;
    firstNumber: string;
    firstId: string;
    baseLevel: number;
    counters: number[];
  }>({
    doc: null,
    items: [],
    counts: new Map(),
    entries: new Map(),
    firstTitle: "",
    firstNumber: "",
    firstId: "",
    baseLevel: 0,
    counters: [],
  });
  if (registry.current.doc !== Doc)
    registry.current = {
      doc: Doc,
      items: [],
      counts: new Map(),
      entries: new Map(),
      firstTitle: "",
      firstNumber: "",
      firstId: "",
      baseLevel: 0,
      counters: [],
    };
  const registerHeading = (
    key: string,
    level: number,
    text: string,
  ): MdxHeadingMeta => {
    const existing = registry.current.entries.get(key);
    if (existing) return existing;
    if (!registry.current.baseLevel) registry.current.baseLevel = level;
    const depth = Math.max(0, level - registry.current.baseLevel);
    registry.current.counters[depth] =
      (registry.current.counters[depth] || 0) + 1;
    registry.current.counters.length = depth + 1;
    const number = registry.current.counters.join(".");
    const base = mdxSlug(text);
    const count = (registry.current.counts.get(base) || 0) + 1;
    registry.current.counts.set(base, count);
    const id = count === 1 ? base : `${base}-${count}`;
    const isFirstH1 = level === 1 && !registry.current.firstTitle;
    if (isFirstH1) {
      registry.current.firstTitle = text;
      registry.current.firstNumber = number;
      registry.current.firstId = id;
    }
    if (!isFirstH1) registry.current.items.push({ level, id, number, text });
    const meta = { id, isFirstH1, number };
    registry.current.entries.set(key, meta);
    return meta;
  };
  useEffect(() => {
    setHeadings([...registry.current.items]);
    if (registry.current.firstTitle)
      onTitleChange(
        `${registry.current.firstNumber} ${registry.current.firstTitle}`,
        registry.current.firstId,
      );
  }, [Doc, onTitleChange]);
  return (
    <>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_220px]">
        <article className="panel markdown-content max-w-none overflow-hidden p-6 sm:p-10">
          <MdxHeadingContext.Provider value={{ registerHeading }}>
            <Doc components={mdxComponents} />
          </MdxHeadingContext.Provider>
        </article>
        {headings.length > 0 && (
          <aside className="hidden xl:order-none xl:sticky xl:top-24 xl:block">
            <MdxToc headings={headings} />
          </aside>
        )}
      </div>
      {headings.length > 0 && (
        <>
          <button
            type="button"
            className="fixed bottom-5 right-5 z-40 grid size-12 place-items-center rounded-full bg-accent text-white shadow-panel xl:hidden"
            aria-label="打开目录"
            aria-expanded={tocOpen}
            onClick={() => setTocOpen(true)}
          >
            <List size={20} />
          </button>
          <AnimatePresence>
            {tocOpen && (
              <>
                <motion.button
                  type="button"
                  aria-label="关闭目录"
                  className="fixed inset-0 z-40 bg-ink/45 xl:hidden"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setTocOpen(false)}
                />
                <motion.aside
                  className="fixed bottom-0 right-0 top-16 z-50 w-[min(86vw,320px)] overflow-y-auto border-l border-line bg-surface p-4 shadow-panel xl:hidden"
                  initial={{ x: "100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 28, stiffness: 280 }}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">
                      目录
                    </p>
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-lg text-muted hover:bg-soft hover:text-accent"
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
                </motion.aside>
              </>
            )}
          </AnimatePresence>
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
              className="block rounded-md px-2 py-1.5 text-sm text-muted transition hover:bg-accent/10 hover:text-accent"
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
  const categories = [
    "申请与开户",
    "卡组织与活动",
    "银行资料",
    "站点资料",
  ] as DocCategory[];
  const grouped = categories.map((category) => ({
    category,
    items: Object.entries(docs).filter(([, item]) => item.category === category),
  }));
  return (
    <Shell title="文档目录">
      <PageHeading title="文档目录" />
      <div className="grid gap-10">
        {grouped.map(({ category, items }) => (
          <section key={category} aria-labelledby={`docs-${category}`}>
            <h2
              id={`docs-${category}`}
              className="mb-5 text-xl font-bold text-ink dark:text-white"
            >
              {category}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map(([slug, item]) => (
                <a
                  key={slug}
                  href={`/docs/${slug}`}
                  className="block rounded-xl border border-line bg-surface p-5 shadow-panel transition hover:-translate-y-0.5 hover:border-accent dark:bg-[#1b2420]"
                >
                  <h3 className="font-bold text-ink dark:text-white">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-accent">查看文档 →</p>
                </a>
              ))}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
