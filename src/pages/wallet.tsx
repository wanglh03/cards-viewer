import { ArrowLeft, ArrowRight, Check, Copy, Download, Filter, Search, Sparkles, X } from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CardArtwork, CardImageGallery, CardModal, CardTile } from "../components/CardTile";
import { PageHeading, Shell } from "../components/Shell";
import { SmartLink } from "../components/SmartLink";
import { CardFilterControls, type CardFilterValues, cardMatchesFilters, readGalleryUrlState } from "./gallery";
import { useCards } from "../components/filters";
import { Empty, Loading } from "../components/ui";
import regions from "../config/regions.json";
import { cardRegionName, compareCards, fetchJson, formatBin, getBinOverlayText, typeLabels } from "../lib/data";
import type { Card, CollectedIssuer, CollectionGroup, IssuerData, MyIssuersData } from "../lib/types";

export function WalletPage({ cards, loading }: { cards: Card[]; loading: boolean }) {
  const [sort, setSort] = useState<"acquired" | "issuer">("acquired");
  const [showAllCards, setShowAllCards] = useState(false);
  const [active, setActive] = useState<Card | null>(null);
  const [binOverlays, setBinOverlays] = useState<unknown>({});
  const walletScrollY = useRef(0);
  useEffect(() => {
    let mounted = true;
    fetchJson<unknown>("/json/bin-overlays.json").then((value) => {
      if (mounted) setBinOverlays(value || {});
    });
    return () => {
      mounted = false;
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    window.scrollTo(0, 0);
  }, [active]);
  const openWalletCard = (card: Card) => {
    walletScrollY.current = window.scrollY;
    setActive(card);
  };
  const closeWalletCard = () => {
    setActive(null);
    window.requestAnimationFrame(() => window.scrollTo(0, walletScrollY.current));
  };
  const walletCards = useMemo(
    () =>
      cards
        .filter(
          (card) =>
            showAllCards || card.status?.toLowerCase() === "active",
        )
        .sort((a, b) => compareCards(a, b, sort)),
    [cards, showAllCards, sort],
  );
  const groups = [
    {
      title: "银行卡",
      cards: walletCards.filter((card) => card.type !== "Transit"),
    },
    {
      title: "交通卡",
      cards: walletCards.filter((card) => card.type === "Transit"),
    },
  ].filter((group) => group.cards.length);
  return (
    <Shell title="钱包">
      <div className="relative z-0 isolate mx-auto min-h-[calc(100vh-11rem)] w-full max-w-[430px] overflow-hidden rounded-xl bg-surface px-[22px] py-7 shadow-panel dark:bg-[#171a19]">
        {active ? (
          <WalletDetailView
            card={active}
            onBack={closeWalletCard}
            binOverlays={binOverlays}
          />
        ) : (
          <>
            <header className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-accent">
                  个人卡包
                </p>
                <h1 className="text-[42px] font-bold leading-[0.98] tracking-normal text-ink dark:text-white">
                  钱包
                </h1>
              </div>
              <span
                className="grid size-10 place-items-center rounded-full border border-line text-sm font-extrabold text-muted"
                aria-label={`${showAllCards ? "全部" : "已激活"}卡片数量`}
              >
                {loading ? "-" : walletCards.length}
              </span>
            </header>
            <div className="mt-[18px] flex flex-wrap gap-2">
              <button
                className="min-h-9 rounded-lg border border-line bg-transparent px-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                onClick={() => setShowAllCards((value) => !value)}
                aria-label={`切换为显示${showAllCards ? "已激活" : "所有"}卡`}
              >
                {showAllCards ? "显示所有卡" : "显示已激活卡"}
              </button>
              <button
                className="min-h-9 rounded-lg border border-line bg-transparent px-3 text-sm font-semibold text-muted transition hover:border-accent hover:text-accent"
                onClick={() =>
                  setSort((value) =>
                    value === "acquired" ? "issuer" : "acquired",
                  )
                }
                aria-label={
                  sort === "acquired"
                    ? "切换为按发行方名称排序"
                    : "切换为按获得时间排序"
                }
              >
                {sort === "acquired" ? "按获得时间排序" : "按发行方排序"}
              </button>
            </div>
            {loading ? (
              <div className="py-5">
                <Loading />
              </div>
            ) : groups.length ? (
              <div className="mt-7 grid gap-[52px]">
                {groups.map((group) => (
                  <section key={group.title}>
                    <h2 className="mb-3.5 text-sm font-bold text-muted">
                      {group.title}
                    </h2>
                    <div
                      className="relative w-full"
                      style={{
                        height: `${Math.max(250, 232 + (group.cards.length - 1) * 64)}px`,
                      }}
                    >
                      {group.cards.map((card, index) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => openWalletCard(card)}
                          aria-label={`查看${card.name}详情`}
                          className="group absolute left-0 top-0 block aspect-[1.586] w-full overflow-hidden rounded-[18px] border-0 bg-soft text-left shadow-[0_16px_28px_rgba(42,37,29,0.18)] transition duration-200 hover:-translate-y-2 hover:scale-[1.015] focus-visible:z-50 focus-visible:outline-2 focus-visible:outline-accent"
                          style={{ top: `${index * 64}px`, zIndex: index + 1 }}
                        >
                          <CardArtwork
                            src={card.altImageUrl || card.image}
                            fallbackSrc={card.image}
                            alt={card.name}
                            eager
                          />
                          <span className="absolute inset-x-0 top-0 bg-black/55 px-4 py-3 text-sm font-semibold text-white opacity-0 transition group-hover:opacity-100">
                            {card.name} · {card.bankNativeName || card.issuer}
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <p className="py-5 text-sm text-muted">
                暂无{showAllCards ? "卡片" : "已激活卡片"}。
              </p>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}

export function WalletDetailView({
  card,
  onBack,
  binOverlays = {},
}: {
  card: Card;
  onBack: () => void;
  binOverlays?: unknown;
}) {
  const binOverlay = getBinOverlayText(card.bin, binOverlays);
  const fields: [string, string][] = [
    ["卡组织", card.organization],
    ["等级", card.tier],
    ["类型", typeLabels[card.type] || card.type],
    ["地区", cardRegionName(card)],
    ["结算货币", card.currency.join(" / ")],
    ["取得时间", card.acquired || ""],
    ["开户行", card.branch || ""],
  ];
  return (
    <motion.section
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="-mx-[22px] -my-7 min-h-[calc(100vh-11rem)] px-[22px] py-7"
    >
      <header className="flex items-center gap-3 text-sm font-bold text-muted">
        <button
          className="grid size-9 place-items-center rounded-full border border-line bg-transparent text-2xl leading-none text-ink transition hover:border-accent hover:text-accent dark:text-white"
          onClick={onBack}
          aria-label="返回钱包"
        >
          <ArrowLeft size={18} />
        </button>
        <span>卡片详情</span>
      </header>
      <div className="mt-7 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
        <figure className="relative m-0 aspect-[1.586] overflow-hidden rounded-[18px] bg-soft shadow-[0_20px_36px_rgba(42,37,29,0.20)]">
          <CardArtwork
            src={card.altImageUrl || card.image}
            fallbackSrc={card.image}
            alt={`${card.name} 卡面`}
          />
        </figure>
        <div className="border-b border-line px-0.5 py-[22px]">
          <div className="mb-2 grid grid-cols-[22px_minmax(0,1fr)] items-center gap-x-2 gap-y-1 text-[13px] font-bold text-ink dark:text-white">
            <span className="grid size-[22px] place-items-center">
              {card.bankLogoUrl && (
                <img
                  src={card.bankLogoUrl}
                  alt=""
                  className="size-[22px] object-contain"
                />
              )}
            </span>
            <span>{card.bankNativeName || card.issuer}</span>
            {(card.bankTag === "rural" || card.bankTag === "village") &&
              (card.bankParentName || card.bankParent) && (
                <>
                  <span className="grid size-[22px] place-items-center">
                    {card.bankParentLogoUrl && (
                      <img
                        src={card.bankParentLogoUrl}
                        alt=""
                        className="size-[18px] object-contain"
                      />
                    )}
                  </span>
                  <span className="text-xs font-semibold text-muted">
                    {card.bankParentName || card.bankParent}
                  </span>
                </>
              )}
          </div>
          <h2 className="text-[25px] font-bold leading-[1.18] text-ink dark:text-white">
            {card.name}
          </h2>
          <p className="my-2 text-[13px] font-semibold text-muted">
            {card.bin ? formatBin(card.bin) : "-"} · {card.length || (card.organization === "AMEX" ? "15" : "16")}位
          </p>
          <div className="flex flex-wrap gap-2 text-[13px] font-bold">
            <span className="text-green-700 dark:text-green-300">已激活</span>
            {binOverlay && <span className="text-[#9a6731]">{binOverlay}</span>}
            {card.virtual && (
              <span className="text-blue-700 dark:text-blue-300">虚拟卡</span>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-[1fr_1.35fr] items-center border-b border-line px-0.5 py-[18px]">
          {fields
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <Fragment key={label}>
                <dt className="py-1.5 text-sm text-muted">{label}</dt>
                <dd className="py-1.5 text-sm font-semibold text-ink dark:text-white">
                  {label === "卡组织" && card.organizationIconUrl ? (
                    <img
                      src={card.organizationIconUrl}
                      alt={value}
                      title={value}
                      className="h-12 max-w-24 object-contain"
                    />
                  ) : (
                    value
                  )}
                </dd>
              </Fragment>
            ))}
        </dl>
        {card.desc && (
          <section className="px-0.5 pt-[18px]">
            <h3 className="mb-2 text-[15px] font-bold">描述</h3>
            <p className="whitespace-pre-line text-sm leading-[1.7] text-muted">
              {card.desc}
            </p>
          </section>
        )}
        {card.benefit && (
          <section className="px-0.5 pt-[18px]">
            <h3 className="mb-2 text-[15px] font-bold">权益</h3>
            <p className="whitespace-pre-line text-sm leading-[1.7] text-muted">
              {card.benefit}
            </p>
          </section>
        )}
      </div>
    </motion.section>
  );
}
