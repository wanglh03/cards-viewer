import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Download,
  Filter,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  CardArtwork,
  CardImageGallery,
  CardModal,
  CardTile,
} from "../components/CardTile";
import { PageHeading, Shell } from "../components/Shell";
import { SmartLink } from "../components/SmartLink";
import {
  CardFilterControls,
  type CardFilterValues,
  cardMatchesFilters,
  readGalleryUrlState,
} from "./gallery";
import { useCards } from "../components/filters";
import { Empty, Loading } from "../components/ui";
import regions from "../config/regions.json";
import { buildCollectionGroups, loadCollection } from "../lib/data";
import type { CollectedIssuer, CollectionGroup } from "../lib/types";

export function CollectionPage() {
  const [issuers, setIssuers] = useState<CollectedIssuer[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadCollection().then((value) => {
      if (active) {
        setIssuers(value);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  const [mode, setMode] = useState<"simple" | "detailed">("simple");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportImageUrl, setExportImageUrl] = useState("");
  useEffect(
    () => () => {
      if (exportImageUrl) URL.revokeObjectURL(exportImageUrl);
    },
    [exportImageUrl],
  );
  const groups = useMemo(
    () => buildCollectionGroups(issuers, mode),
    [issuers, mode],
  );
  const saveAsImage = async () => {
    if (!groups.length || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const imageUrl = await exportCollectionImage(groups);
      setExportImageUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return imageUrl;
      });
    } catch {
      setExportError("图片导出失败，请稍后重试。");
    } finally {
      setExporting(false);
    }
  };
  return (
    <Shell title="银行收集进度">
      <PageHeading
        title="银行收集进度"
        description="按全国性、区域和地区层级查看已经收集的银行发行方。"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className="quiet-button"
              onClick={() =>
                setMode((value) => (value === "simple" ? "detailed" : "simple"))
              }
            >
              {mode === "simple" ? "当前为简易分组" : "当前为详细分组"}
            </button>
            <button
              className="primary-button"
              disabled={loading || !groups.length || exporting}
              onClick={saveAsImage}
            >
              <Download size={16} />
              {exporting ? "正在生成" : "生成图片"}
            </button>
          </div>
        }
      />
      {exportError && (
        <p
          className="mb-5 text-sm text-red-600 dark:text-red-300"
          role="status"
        >
          {exportError}
        </p>
      )}
      {exportImageUrl && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="银行收集进度图片"
          onClick={() => {
            URL.revokeObjectURL(exportImageUrl);
            setExportImageUrl("");
          }}
        >
          <div
            className="relative max-h-[94vh] max-w-[96vw] overflow-auto rounded-xl bg-white p-3 shadow-2xl dark:bg-[#1b2420]"
            onClick={(event) => event.stopPropagation()}
          >
            <img
              src={exportImageUrl}
              alt="银行收集进度"
              className="h-auto max-h-[calc(94vh-4rem)] max-w-[92vw] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
      {loading ? (
        <Loading />
      ) : groups.length ? (
        <div className="grid gap-8">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-bold">{group.title}</h2>
                <span className="text-sm text-muted">
                  {group.items.length} 家
                </span>
              </div>
              <div className="panel p-5">
                <div className="flex flex-wrap gap-x-5 gap-y-4">
                  {group.items.map((issuer) => (
                    <div
                      key={issuer.issuerKey}
                      className="flex flex-wrap items-center gap-1 font-medium"
                    >
                      <CollectionIssuerLabel issuer={issuer} />
                      {issuer.children?.length ? (
                        <>
                          <span
                            aria-hidden="true"
                            className="shrink-0 text-muted"
                          >
                            （
                          </span>
                          {issuer.children.map((child) => (
                            <CollectionIssuerLabel
                              key={child.issuerKey}
                              issuer={child}
                              hideLogo={child.logoUrl === issuer.logoUrl}
                            />
                          ))}
                          <span
                            aria-hidden="true"
                            className="shrink-0 text-muted"
                          >
                            ）
                          </span>
                        </>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty text="暂无符合条件的发行方。" />
      )}
    </Shell>
  );
}

export function CollectionIssuerLabel({
  issuer,
  hideLogo = false,
}: {
  issuer: CollectedIssuer;
  hideLogo?: boolean;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap ${issuer.isRetired ? "text-muted opacity-60" : ""}`}
    >
      {!hideLogo && issuer.logoUrl && (
        <img src={issuer.logoUrl} alt="" className="size-6 object-contain" />
      )}
      <span className="whitespace-nowrap">{issuer.name}</span>
    </span>
  );
}

type ExportToken =
  | {
      type: "issuer";
      issuer: CollectedIssuer;
      width: number;
      hideLogo?: boolean;
    }
  | { type: "text"; text: string; width: number };

type ExportPreparedItem = {
  lines: ExportToken[][];
  width: number;
  height: number;
};

async function exportCollectionImage(groups: CollectionGroup[]) {
  await document.fonts?.ready;
  const measureCanvas = document.createElement("canvas");
  const measureContext = measureCanvas.getContext("2d");
  if (!measureContext) throw new Error("Canvas unavailable");
  measureContext.font = "500 14px system-ui, sans-serif";

  const width = 560;
  const padding = 28;
  const contentWidth = width - padding * 2;
  const logoSize = 20;
  const lineHeight = 23;
  const itemGap = 14;
  const qrSize = 100;
  const footerHeight = qrSize + 64;
  const preparedGroups = groups.map((group) => ({
    ...group,
    rows: group.items.reduce<ExportPreparedItem[][]>((rows, issuer) => {
      const item = prepareExportIssuerItem(
        measureContext,
        issuer,
        contentWidth,
        logoSize,
        lineHeight,
      );
      item.width = Math.min(contentWidth, item.width + itemGap);
      const row = rows.at(-1);
      if (
        row &&
        row.reduce((sum, current) => sum + current.width, 0) + item.width <=
          contentWidth
      )
        row.push(item);
      else rows.push([item]);
      return rows;
    }, []),
  }));
  const height = preparedGroups.reduce(
    (total, group) =>
      total +
      40 +
      group.rows.reduce(
        (rowTotal, row) =>
          rowTotal + Math.max(...row.map((item) => item.height)) + 9,
        0,
      ),
    88 + footerHeight,
  );

  const sources = [
    ...new Set([
      ...groups.flatMap((group) =>
        group.items.flatMap((issuer) =>
          [issuer, ...(issuer.children || [])]
            .map((item) => item.logoUrl)
            .filter(Boolean),
        ),
      ),
      "/assets/qrcode_collection.png",
    ]),
  ];
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    sources.map(async (source) => {
      const image = await loadExportImage(getExportImageSource(source));
      if (image) images.set(source, image);
    }),
  );

  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = Math.ceil(height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  context.scale(scale, scale);
  const styles = getComputedStyle(document.body);
  drawCollectionExport(context, preparedGroups, images, {
    width,
    height,
    padding,
    logoSize,
    lineHeight,
    qrSize,
    footerHeight,
    background: document.body.classList.contains("theme-dark")
      ? "#101714"
      : "#f4f6f3",
    text: styles.getPropertyValue("--color-ink").trim() || "#1b2521",
    muted: styles.getPropertyValue("--color-muted").trim() || "#69766f",
    accent:
      styles.getPropertyValue("--color-accent-strong").trim() || "#0f523a",
    line: styles.getPropertyValue("--color-line").trim() || "#dce4de",
  });
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Image export failed");
  return URL.createObjectURL(blob);
}

function prepareExportIssuerItem(
  context: CanvasRenderingContext2D,
  issuer: CollectedIssuer,
  contentWidth: number,
  logoSize: number,
  lineHeight: number,
): ExportPreparedItem {
  const tokens: ExportToken[] = [
    createExportIssuerToken(context, issuer, logoSize),
  ];
  if (issuer.children?.length) {
    tokens.push({
      type: "text",
      text: "（",
      width: context.measureText("（").width,
    });
    issuer.children.forEach((child, index) => {
      if (index)
        tokens.push({
          type: "text",
          text: " ",
          width: context.measureText(" ").width,
        });
      tokens.push(
        createExportIssuerToken(
          context,
          child,
          logoSize,
          child.logoUrl === issuer.logoUrl,
        ),
      );
    });
    tokens.push({
      type: "text",
      text: "）",
      width: context.measureText("）").width,
    });
  }
  const lines: ExportToken[][] = [];
  let line: ExportToken[] = [];
  let lineWidth = 0;
  tokens.forEach((token) => {
    if (line.length && lineWidth + token.width > contentWidth) {
      lines.push(line);
      line = [];
      lineWidth = 0;
    }
    line.push(token);
    lineWidth += token.width;
  });
  if (line.length) lines.push(line);
  return {
    lines,
    width: Math.max(
      ...lines.map((current) =>
        current.reduce((sum, token) => sum + token.width, 0),
      ),
    ),
    height: Math.max(logoSize, lines.length * lineHeight),
  };
}

function createExportIssuerToken(
  context: CanvasRenderingContext2D,
  issuer: CollectedIssuer,
  logoSize: number,
  hideLogo = false,
): ExportToken {
  return {
    type: "issuer",
    issuer,
    hideLogo,
    width:
      (hideLogo ? 0 : logoSize + 8) + context.measureText(issuer.name).width,
  };
}

function getExportImageSource(source: string) {
  const url = new URL(source, location.origin);
  if (
    url.origin === "https://cards-cdn.gtbro.vip" &&
    url.pathname.startsWith("/issuers/logo/")
  ) {
    return `/export-logos/${url.pathname.slice("/issuers/logo/".length)}`;
  }
  return source;
}

function loadExportImage(source: string): Promise<HTMLImageElement> {
  return fetch(source, {
    mode: "cors",
    cache: "force-cache",
    referrerPolicy: "no-referrer",
  })
    .then((response) => {
      if (!response.ok)
        throw new Error(`Image request failed: ${response.status}`);
      return response.blob();
    })
    .then(
      (blob) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          const objectUrl = URL.createObjectURL(blob);
          image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
          };
          image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Image load failed"));
          };
          image.src = objectUrl;
        }),
    );
}

function drawCollectionExport(
  context: CanvasRenderingContext2D,
  groups: (CollectionGroup & { rows: ExportPreparedItem[][] })[],
  images: Map<string, HTMLImageElement>,
  options: {
    width: number;
    height: number;
    padding: number;
    logoSize: number;
    lineHeight: number;
    qrSize: number;
    footerHeight: number;
    background: string;
    text: string;
    muted: string;
    accent: string;
    line: string;
  },
) {
  const { width, height, padding, logoSize, lineHeight, qrSize, footerHeight } =
    options;
  context.fillStyle = options.background;
  context.fillRect(0, 0, width, height);
  context.fillStyle = options.text;
  context.font = "700 28px system-ui, sans-serif";
  context.fillText("银行收集进度", padding, 44);
  context.fillStyle = options.muted;
  context.font = "400 12px system-ui, sans-serif";
  context.fillText(new Date().toLocaleDateString("zh-CN"), padding, 66);

  let y = 96;
  groups.forEach((group) => {
    context.strokeStyle = options.line;
    context.beginPath();
    context.moveTo(padding, y - 14);
    context.lineTo(width - padding, y - 14);
    context.stroke();
    context.fillStyle = options.accent;
    context.font = "700 16px system-ui, sans-serif";
    const issuerCount = group.items.reduce(
      (count, issuer) => count + 1 + (issuer.children?.length || 0),
      0,
    );
    context.fillText(`${group.title}（${issuerCount} 家）`, padding, y + 3);
    y += 24;
    group.rows.forEach((row) => {
      let x = padding;
      const rowHeight = Math.max(...row.map((item) => item.height));
      row.forEach((item) => {
        item.lines.forEach((line, lineIndex) => {
          let tokenX = x;
          const lineTop =
            y +
            Math.max(0, (rowHeight - item.height) / 2) +
            lineIndex * lineHeight;
          line.forEach((token) => {
            if (token.type === "issuer") {
              const image = token.hideLogo
                ? null
                : images.get(token.issuer.logoUrl);
              context.globalAlpha = token.issuer.isRetired ? 0.48 : 1;
              if (image)
                context.drawImage(image, tokenX, lineTop, logoSize, logoSize);
              context.fillStyle = token.issuer.isRetired
                ? options.muted
                : options.text;
              context.font = "500 14px system-ui, sans-serif";
              context.fillText(
                token.issuer.name,
                tokenX + (token.hideLogo ? 0 : logoSize + 8),
                lineTop + 15,
              );
              context.globalAlpha = 1;
            } else {
              context.fillStyle = options.text;
              context.font = "500 14px system-ui, sans-serif";
              context.fillText(token.text, tokenX, lineTop + 15);
            }
            tokenX += token.width;
          });
        });
        x += item.width;
      });
      y += rowHeight + 9;
    });
    y += 12;
  });

  const footerTop = height - footerHeight;
  context.strokeStyle = options.line;
  context.beginPath();
  context.moveTo(padding, footerTop - 16);
  context.lineTo(width - padding, footerTop - 16);
  context.stroke();
  const qrCode = images.get("/assets/qrcode_collection.png");
  if (qrCode) {
    const qrLeft = (width - qrSize) / 2;
    context.fillStyle = "#fff";
    context.fillRect(qrLeft, footerTop, qrSize, qrSize);
    context.drawImage(qrCode, qrLeft, footerTop, qrSize, qrSize);
  }
  context.textAlign = "center";
  context.fillStyle = options.muted;
  context.font = "500 13px system-ui, sans-serif";
  context.fillText(
    "扫描二维码查看网页版。",
    width / 2,
    footerTop + qrSize + 22,
  );
  context.font = "500 12px system-ui, sans-serif";
  context.fillText(
    "© 2026 GTB. All rights reserved.",
    width / 2,
    footerTop + qrSize + 45,
  );
  context.textAlign = "start";
}
