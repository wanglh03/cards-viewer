import { Expand, ImageOff } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Card } from "../lib/types";
import { cardRegionName, formatBin, tierAccentClass } from "../lib/data";

const imageSizeCache = new Map<string, number | null>();

export function CardTile({ card, onOpen }: { card: Card; onOpen?: (card: Card) => void }) {
  return <motion.article layout initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }} className={`group overflow-hidden rounded-xl border shadow-panel dark:bg-[#1b2420] ${tierAccentClass(card.tier)}`}>
    <button className="relative block w-full text-left" onClick={() => onOpen?.(card)} aria-label={`查看 ${card.name}`}>
      <CardArtwork src={card.image} fallbackSrc={card.altImageUrl} alt={`${card.name} 卡面`} showMeta />
      <span className="absolute right-3 top-3 grid size-9 place-items-center rounded-lg bg-black/50 text-white opacity-0 backdrop-blur transition group-hover:opacity-100"><Expand size={16} /></span>
    </button>
    <div className="p-4"><h2 className="truncate text-base font-bold text-ink dark:text-white" title={card.name}>{card.name}</h2><div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted"><span className="flex min-w-0 items-center gap-1.5 truncate">{card.bankLogoUrl && <img src={card.bankLogoUrl} alt="" className="size-4 shrink-0 object-contain" />}{card.issuer || "未知发行方"}</span><span className="shrink-0 text-right">{cardRegionName(card)}</span></div><div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted"><span className="flex min-w-0 items-center gap-2">{card.organizationIconUrl && <img src={card.organizationIconUrl} alt={card.organization} title={card.organization} className="organization-logo shrink-0 object-contain" />}<span>{[card.tier, card.type].filter(Boolean).join(" ")}</span></span><span className="font-mono">{card.bin ? formatBin(card.bin) : ""}</span></div></div>
  </motion.article>;
}

export function CardArtwork({
  src,
  fallbackSrc,
  alt,
  showMeta = false,
  eager = false,
}: {
  src: string;
  fallbackSrc?: string;
  alt: string;
  showMeta?: boolean;
  eager?: boolean;
}) {
  const initialSource = src || fallbackSrc || "";
  const [source, setSource] = useState(initialSource);
  const [failed, setFailed] = useState(!initialSource);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [bytes, setBytes] = useState<number | null>(null);

  useEffect(() => {
    const nextSource = src || fallbackSrc || "";
    setSource(nextSource);
    setFailed(!nextSource);
    setDimensions(null);
    setBytes(null);
  }, [src, fallbackSrc]);

  useEffect(() => {
    if (!source || !dimensions) return;
    if (imageSizeCache.has(source)) {
      setBytes(imageSizeCache.get(source) ?? null);
      return;
    }
    const controller = new AbortController();
    fetch(source, { method: "HEAD", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`Image metadata request failed: ${response.status}`);
        const value = response.headers.get("content-length");
        const size = value ? Number(value) : null;
        imageSizeCache.set(source, size);
        setBytes(size);
      })
      .catch(() => {
        if (!controller.signal.aborted) imageSizeCache.set(source, null);
      });
    return () => controller.abort();
  }, [source, dimensions]);

  const portrait = Boolean(dimensions && dimensions.height > dimensions.width);
  return (
    <div>
      <div className="relative flex aspect-[1.586] items-center justify-center overflow-hidden bg-soft">
        {!failed && source ? (
          <img
            src={source}
            alt={alt}
            loading={eager ? "eager" : "lazy"}
            className={`object-cover transition duration-500 group-hover:scale-[1.03] ${portrait ? "absolute" : "size-full"}`}
            style={portrait ? {
              left: "50%",
              top: "50%",
              width: "63.05%",
              height: "158.6%",
              transform: "translate(-50%, -50%) rotate(90deg)",
            } : undefined}
            onLoad={(event) => setDimensions({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => {
              if (fallbackSrc && source !== fallbackSrc) {
                setSource(fallbackSrc);
                setFailed(false);
              } else {
                setFailed(true);
              }
            }}
          />
        ) : (
          <div className="grid size-full place-items-center text-muted"><ImageOff size={24} /></div>
        )}
      </div>
      {showMeta && (
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs text-muted">
          <span>{dimensions ? `${dimensions.width}x${dimensions.height}` : "-"}</span>
          <span>{bytes ? formatFileSize(bytes) : "-"}</span>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)}MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)}GB`;
}

export function CardModal({ card, onClose }: { card: Card | null; onClose: () => void }) {
  if (!card) return null;
  const fields: [string, string][] = [["卡组织", card.organization], ["等级", card.tier], ["类型", card.type], ["BIN", formatBin(card.bin)], ["地区", cardRegionName(card)], ["结算货币", card.currency.join(" / ")]];
  return <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-5 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}><motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} className="panel max-h-[90vh] w-full max-w-4xl overflow-auto bg-white p-5 dark:bg-[#1b2420]" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-accent">{card.issuer}</p><h2 className="mt-1 text-2xl font-bold">{card.name}</h2></div><button className="quiet-button px-3" onClick={onClose} aria-label="关闭">×</button></div><div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_240px]"><CardImageGallery card={card} /><dl className="grid content-start gap-3 text-sm">{fields.filter(([, value]) => value).map(([label, value]) => <Info key={label} label={label} value={value} />)}</dl></div>{card.desc && <section className="mt-6 border-t border-line pt-5"><h3 className="text-sm font-bold">描述</h3><p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted">{card.desc}</p></section>}{card.benefit && <section className="mt-5 border-t border-line pt-5"><h3 className="text-sm font-bold">权益</h3><p className="mt-2 whitespace-pre-line text-sm leading-7 text-muted">{card.benefit}</p></section>}</motion.div></div>;
}

export function CardImageGallery({ card }: { card: Card }) {
  const images = [
    card.image ? { src: card.image, label: "正面卡面" } : null,
    card.altImageUrl ? { src: card.altImageUrl, label: "横版卡面" } : null,
    card.backImageUrl ? { src: card.backImageUrl, label: "背面卡面" } : null,
  ].filter((image): image is { src: string; label: string } => Boolean(image));
  const uniqueImages = images.filter((image, index) => images.findIndex((item) => item.src === image.src) === index);
  if (!uniqueImages.length) return <div className="grid min-h-48 place-items-center rounded-lg bg-soft text-sm text-muted">暂无卡面图片</div>;
  return <div className={`grid gap-3 ${uniqueImages.length === 1 ? "grid-cols-1" : "sm:grid-cols-2"}`}>{uniqueImages.map((image, index) => <figure key={image.src} className="flex flex-col items-center overflow-hidden rounded-lg bg-soft"><img src={image.src} alt={`${card.name}${image.label}`} className="mx-auto h-auto max-w-full object-contain" loading={index ? "lazy" : undefined} /><figcaption className="w-full border-t border-line/60 px-3 py-2 text-xs text-muted">{image.label}</figcaption></figure>)}</div>;
}
function Info({ label, value }: { label: string; value: string }) { return <div className="border-b border-line pb-2"><dt className="text-xs text-muted">{label}</dt><dd className="mt-1 font-medium">{value || "-"}</dd></div>; }
