import { Expand } from "lucide-react";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { Card } from "../lib/types";
import {
  cardRegionName,
  formatBin,
  statusLabels,
  tierAccentClass,
} from "../lib/data";
import { SmartImage } from "./SmartImage";

export function CardTile({
  card,
  onOpen,
}: {
  card: Card;
  onOpen?: (card: Card) => void;
}) {
  const compactRegion = card.province || cardRegionName(card);
  return (
    <article className={`card-tile group ${tierAccentClass(card.tier)}`}>
      <button
        type="button"
        className="relative block w-full text-left"
        onClick={() => onOpen?.(card)}
        aria-label={`查看 ${card.name}`}
      >
        <CardArtwork
          src={card.image}
          fallbackSrc={card.altImageUrl}
          alt={`${card.name} 卡面`}
        />
        <span className="card-tile-expand">
          <Expand size={16} />
        </span>
      </button>
      <div className="p-4">
        <h2
          className="truncate text-base font-bold text-ink"
          title={card.name}
        >
          {card.name}
        </h2>
        <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            {card.bankLogoUrl && (
              <SmartImage
                src={card.bankLogoUrl}
                alt=""
                className="size-4"
                imgClassName="size-full object-contain"
                spinnerSize={12}
              />
            )}
            <span className="truncate">{card.issuer || "未知发行方"}</span>
          </span>
          <span className="shrink-0 text-right">{compactRegion}</span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-2">
            {card.organizationIconUrl && (
              <SmartImage
                src={card.organizationIconUrl}
                alt={card.organization}
                className="h-6 w-12"
                imgClassName="size-full object-contain object-left"
                spinnerSize={12}
              />
            )}
            <span className="truncate">
              {[card.tier, card.type].filter(Boolean).join(" ")}
            </span>
          </span>
          <span className="shrink-0 font-mono">
            {card.bin ? formatBin(card.bin) : ""}
          </span>
        </div>
      </div>
    </article>
  );
}

const portraitStyle: CSSProperties = {
  left: "50%",
  top: "50%",
  width: "63.05%",
  height: "158.6%",
  transform: "translate(-50%, -50%) rotate(90deg)",
};

export function CardArtwork({
  src,
  fallbackSrc,
  alt,
  eager = false,
  onLoad,
}: {
  src?: string;
  fallbackSrc?: string;
  alt: string;
  eager?: boolean;
  onLoad?: () => void;
}) {
  const [portrait, setPortrait] = useState(false);

  useEffect(() => setPortrait(false), [src, fallbackSrc]);

  return (
    <div className="relative flex aspect-[1.586] items-center justify-center overflow-hidden bg-soft">
      <SmartImage
        src={src}
        fallbackSrc={fallbackSrc}
        alt={alt}
        eager={eager}
        className="size-full"
        imgClassName={`object-cover group-hover:scale-[1.03] ${
          portrait ? "absolute" : "size-full"
        }`}
        imgStyle={portrait ? portraitStyle : undefined}
        spinnerSize={28}
        onLoad={(event) => {
          setPortrait(
            event.currentTarget.naturalHeight > event.currentTarget.naturalWidth,
          );
          onLoad?.();
        }}
      />
    </div>
  );
}

export function CardModal({
  card,
  onClose,
  showPersonalDetails = false,
}: {
  card: Card | null;
  onClose: () => void;
  showPersonalDetails?: boolean;
}) {
  useEffect(() => {
    if (!card) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [card, onClose]);

  if (!card) return null;

  const fields: [string, string][] = [
    ["卡组织", card.organization],
    ["等级", card.tier],
    ["类型", card.type],
    ["BIN", formatBin(card.bin)],
    ["地区", cardRegionName(card)],
    ["结算货币", card.currency.join(" / ")],
  ];
  const status = statusLabels[card.status || ""] || card.status || "";
  const overlay = showPersonalDetails ? card.binOverlay || "" : "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-modal-title"
      onClick={onClose}
    >
      <div
        className="modal-panel max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-panel sm:rounded-2xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-accent">
              <span className="grid size-6 shrink-0 place-items-center">
                {card.bankLogoUrl && (
                  <SmartImage
                    src={card.bankLogoUrl}
                    alt=""
                    className="size-6"
                    imgClassName="size-full object-contain"
                    spinnerSize={12}
                  />
                )}
              </span>
              <span className="truncate">{card.issuer}</span>
            </p>
            <h2
              id="card-modal-title"
              className="mt-2 text-xl font-bold text-ink sm:text-2xl"
            >
              {card.name}
            </h2>
            {showPersonalDetails && (status || overlay || card.virtual) && (
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                {status && (
                  <span className="text-green-700 dark:text-green-300">
                    {status}
                  </span>
                )}
                {overlay && <span className="text-[#9a6731] dark:text-[#e0b070]">{overlay}</span>}
                {card.virtual && (
                  <span className="text-blue-700 dark:text-blue-300">
                    虚拟卡
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            className="quiet-button shrink-0 px-3"
            onClick={onClose}
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
          <CardImageGallery card={card} />
          <dl className="grid content-start gap-3 text-sm">
            {fields
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <Info key={label} label={label} value={value} />
              ))}
          </dl>
        </div>

        {showPersonalDetails && card.acquired && (
          <DetailSection title="取得日期" text={card.acquired} />
        )}
        {showPersonalDetails && card.branch && (
          <DetailSection title="开户行" text={card.branch} />
        )}
        {card.desc && <DetailSection title="描述" text={card.desc} />}
        {card.benefit && <DetailSection title="权益" text={card.benefit} />}
      </div>
    </div>
  );
}

export function CardImageGallery({ card }: { card: Card }) {
  const images = [
    card.image ? { src: card.image, label: "正面卡面" } : null,
    card.altImageUrl ? { src: card.altImageUrl, label: "横版卡面" } : null,
    card.backImageUrl ? { src: card.backImageUrl, label: "背面卡面" } : null,
  ].filter((image): image is { src: string; label: string } => Boolean(image));
  const uniqueImages = images.filter(
    (image, index) =>
      images.findIndex((item) => item.src === image.src) === index,
  );

  if (!uniqueImages.length)
    return (
      <div className="grid min-h-48 place-items-center rounded-xl bg-soft text-sm text-muted">
        暂无卡面图片
      </div>
    );

  return (
    <div
      className={`grid gap-3 ${
        uniqueImages.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"
      }`}
    >
      {uniqueImages.map((image, index) => (
        <figure
          key={image.src}
          className="flex h-[min(52vh,420px)] w-full flex-col overflow-hidden rounded-xl bg-soft"
        >
          <div className="flex min-h-0 w-full flex-1 items-center justify-center p-2">
            <SmartImage
              src={image.src}
              alt={`${card.name}${image.label}`}
              eager={index === 0}
              className="size-full"
              imgClassName="size-full object-contain"
              spinnerSize={26}
            />
          </div>
          <figcaption className="w-full shrink-0 border-t border-line/60 px-3 py-2 text-xs text-muted">
            {image.label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function DetailSection({ title, text }: { title: string; text: string }) {
  return (
    <section className="mt-6 border-t border-line pt-5">
      <h3 className="text-sm font-bold text-ink">{title}</h3>
      <p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted">
        {text}
      </p>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line pb-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value || "-"}</dd>
    </div>
  );
}
