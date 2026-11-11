import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Card } from "../lib/types";
import { CardArtwork } from "../components/CardTile";
import { Shell } from "../components/Shell";
import { SmartImage } from "../components/SmartImage";
import { Loading, Spinner } from "../components/ui";
import { cardRegionName, compareCards, formatBin, typeLabels } from "../lib/data";

const STACK_OFFSET = 64;

export function WalletPage({
  cards,
  loading,
}: {
  cards: Card[];
  loading: boolean;
}) {
  const [sort, setSort] = useState<"acquired" | "issuer">("acquired");
  const [showAllCards, setShowAllCards] = useState(false);
  const [active, setActive] = useState<Card | null>(null);
  const [loadedCounts, setLoadedCounts] = useState<Record<string, number>>({});
  const scrollY = useRef(0);

  useEffect(() => setLoadedCounts({}), [cards, showAllCards, sort]);

  const openCard = (card: Card) => {
    scrollY.current = window.scrollY;
    setActive(card);
  };
  const closeCard = () => {
    setActive(null);
    window.requestAnimationFrame(() => window.scrollTo(0, scrollY.current));
  };

  const walletCards = useMemo(
    () =>
      cards
        .filter((card) => showAllCards || card.status?.toLowerCase() === "active")
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
      <div className="wallet-shell relative z-0 isolate mx-auto w-full max-w-[430px]">
        {active ? (
          <WalletDetailView card={active} onBack={closeCard} />
        ) : (
          <>
            <header className="flex items-center justify-between">
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-accent">
                  个人卡包
                </p>
                <h2 className="text-4xl font-bold leading-none text-ink">钱包</h2>
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
                className="wallet-chip"
                onClick={() => setShowAllCards((value) => !value)}
                aria-label={`切换为显示${showAllCards ? "已激活" : "所有"}卡`}
              >
                {showAllCards ? "显示所有卡" : "显示已激活卡"}
              </button>
              <button
                className="wallet-chip"
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
                {groups.map((group) => {
                  const loaded = loadedCounts[group.title] ?? 0;
                  return (
                    <section key={group.title}>
                      <h2 className="mb-3.5 text-sm font-bold text-muted">
                        {group.title}
                      </h2>
                      <div
                        className="relative w-full"
                        style={{
                          height: `${Math.max(250, 232 + (group.cards.length - 1) * STACK_OFFSET)}px`,
                        }}
                      >
                        {group.cards.map((card, index) => (
                          <button
                            key={card.id}
                            type="button"
                            onClick={() => openCard(card)}
                            aria-label={`查看${card.name}详情`}
                            className="wallet-card group absolute left-0 top-0 block aspect-[1.586] w-full overflow-hidden rounded-[18px] border-0 bg-soft text-left shadow-[0_16px_28px_rgba(42,37,29,0.18)] transition duration-200 hover:-translate-y-2 hover:scale-[1.015] focus-visible:z-50"
                            style={{ top: `${index * STACK_OFFSET}px`, zIndex: index + 1 }}
                          >
                            {index <= loaded ? (
                              <CardArtwork
                                src={card.altImageUrl || card.image}
                                fallbackSrc={card.image}
                                alt={card.name}
                                eager={index === 0}
                                onLoad={() =>
                                  setLoadedCounts((current) =>
                                    index === (current[group.title] ?? 0)
                                      ? { ...current, [group.title]: index + 1 }
                                      : current,
                                  )
                                }
                              />
                            ) : (
                              <span className="wallet-card-loading">
                                <Spinner size={18} />
                              </span>
                            )}
                            <span className="wallet-card-label group-hover:opacity-100">
                              {card.name} · {card.bankNativeName || card.issuer}
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>
                  );
                })}
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

function WalletDetailView({ card, onBack }: { card: Card; onBack: () => void }) {
  const binOverlay = card.binOverlay || "";
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
    <section className="detail-enter wallet-detail">
      <header className="flex items-center gap-3 text-sm font-bold text-muted">
        <button
          className="grid size-9 place-items-center rounded-full border border-line text-2xl leading-none text-ink transition hover:border-accent hover:text-accent-ink"
          onClick={onBack}
          aria-label="返回钱包"
        >
          <ArrowLeft size={18} />
        </button>
        <span>卡片详情</span>
      </header>
      <div className="mt-7 max-h-[calc(100dvh-12rem)] overflow-y-auto pr-1">
        <figure className="m-0 overflow-hidden rounded-[18px] bg-soft shadow-[0_20px_36px_rgba(42,37,29,0.20)]">
          <CardArtwork
            src={card.altImageUrl || card.image}
            fallbackSrc={card.image}
            alt={`${card.name} 卡面`}
            eager
          />
        </figure>
        <div className="border-b border-line px-0.5 py-[22px]">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] font-bold text-ink">
            {card.bankLogoUrl && (
              <SmartImage
                src={card.bankLogoUrl}
                alt=""
                className="size-[22px]"
                imgClassName="size-full object-contain"
                spinnerSize={12}
              />
            )}
            <span>{card.bankNativeName || card.issuer}</span>
            {(card.bankTag === "rural" || card.bankTag === "village") &&
              (card.bankParentName || card.bankParent) && (
                <>
                  {card.bankParentLogoUrl && (
                    <SmartImage
                      src={card.bankParentLogoUrl}
                      alt=""
                      className="size-[18px]"
                      imgClassName="size-full object-contain"
                      spinnerSize={10}
                    />
                  )}
                  <span className="text-xs font-semibold text-muted">
                    {card.bankParentName || card.bankParent}
                  </span>
                </>
              )}
          </div>
          <h2 className="text-[clamp(1.1rem,4vw,1.55rem)] font-bold leading-[1.18] text-ink">
            {card.name}
          </h2>
          <p className="my-2 text-[13px] font-semibold text-muted">
            {card.bin ? formatBin(card.bin) : "-"} ·{" "}
            {card.length || (card.organization === "AMEX" ? "15" : "16")}位
          </p>
          <div className="flex flex-wrap gap-2 text-[13px] font-bold">
            <span className="text-green-700 dark:text-green-300">已激活</span>
            {binOverlay && <span className="text-[#9a6731] dark:text-[#e0b070]">{binOverlay}</span>}
            {card.virtual && (
              <span className="text-blue-700 dark:text-blue-300">虚拟卡</span>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center border-b border-line px-0.5 py-[18px]">
          {fields
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="py-1.5 text-sm text-muted">{label}</dt>
                <dd className="min-w-0 py-1.5 text-sm font-semibold text-ink">
                  {label === "卡组织" && card.organizationIconUrl ? (
                    <SmartImage
                      src={card.organizationIconUrl}
                      alt={value}
                      className="h-12 w-24"
                      imgClassName="size-full object-contain object-left"
                      spinnerSize={14}
                    />
                  ) : (
                    value
                  )}
                </dd>
              </div>
            ))}
        </dl>
        {card.desc && <DetailSection title="描述" text={card.desc} />}
        {card.benefit && <DetailSection title="权益" text={card.benefit} />}
      </div>
    </section>
  );
}

function DetailSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="px-0.5 pt-[18px]">
      <h3 className="mb-2 text-[15px] font-bold text-ink">{title}</h3>
      <p className="whitespace-pre-line text-sm leading-[1.7] text-muted">
        {text}
      </p>
    </section>
  );
}
