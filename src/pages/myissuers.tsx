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
import {
  bankTagLabels,
  buildCollectionGroups,
  cardRegionName,
  compareCards,
  formatBin,
  getCollectionIssuers,
  issuerLogo,
  loadMyIssuers,
  tierAccentClass,
  tierRank,
  typeLabels,
} from "../lib/data";
import type {
  Card,
  CollectedIssuer,
  CollectionGroup,
  MyIssuersData,
} from "../lib/types";

export function MyIssuersPage({ title }: { title: string }) {
  const { data, loading } = useMyIssuers();
  const sections = Object.entries(data).filter(([, records]) => records.length);
  return (
    <Shell title={title}>
      <PageHeading title={title} description="当前个人卡包中的发行方概览。" />
      {loading ? (
        <Loading />
      ) : sections.length ? (
        <div className="grid gap-6">
          {sections.map(([type, records]) => (
            <section key={type}>
              <h2 className="mb-3 text-xl font-bold">
                {myIssuerTypeLabel(type)}
              </h2>
              <div className="panel overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-soft text-muted">
                    <tr>
                      <th className="px-4 py-3">发行方</th>
                      <th className="px-4 py-3">激活卡数量</th>
                      <th className="px-4 py-3">开户行</th>
                      <th className="px-4 py-3">电话</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr
                        key={`${record.issuer || "issuer"}-${index}`}
                        className="border-t border-line"
                      >
                        <td className="px-4 py-3 font-semibold">
                          <MyIssuerCell record={record} />
                        </td>
                        <td className="px-4 py-3">
                          {record.virtualCardNum &&
                          Number(record.virtualCardNum) > 0 &&
                          Number(record.activeCardNum || 0) ===
                            Number(record.virtualCardNum)
                            ? `虚拟${record.virtualCardNum}`
                            : record.virtualCardNum &&
                                Number(record.virtualCardNum) > 0
                              ? `${record.activeCardNum || 0}(虚拟${record.virtualCardNum})`
                              : record.activeCardNum || 0}
                        </td>
                        <td className="px-4 py-3">
                          <MultilineCell value={record.branch} />
                        </td>
                        <td className="px-4 py-3">
                          <MultilineCell value={record.tel} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty text="暂无发行方数据。" />
      )}
    </Shell>
  );
}

function myIssuerTypeLabel(type: string) {
  const labels: Record<string, string> = {
    debit: "借记卡",
    credit: "信用卡",
    prepaid: "预付卡",
    transit: "交通卡",
  };
  return labels[type.toLowerCase()] || typeLabels[type] || type;
}

function MyIssuerCell({
  record,
}: {
  record: MyIssuerDataRecord;
}) {
  const metadata = getMyIssuerMetadata(record);
  const content = (
    <span className="inline-flex items-center gap-2">
      {metadata.logo && (
        <img
          src={metadata.logo}
          alt=""
          className="size-7 shrink-0 object-contain"
        />
      )}
      <span>{metadata.name}</span>
    </span>
  );
  return record.url ? (
    <SmartLink
      className="text-accent hover:underline"
      href={record.url}
      target="_blank"
      rel="noreferrer"
      aria-label={metadata.name}
    >
      {content}
    </SmartLink>
  ) : (
    content
  );
}

type MyIssuerDataRecord = MyIssuersData[string][number];

function getMyIssuerMetadata(record: MyIssuerDataRecord) {
  const requested = String(record.issuer || "").trim();
  return {
    name: String(
      record.nativeName ||
        record.native_name ||
        record.name ||
        record.issuerName ||
        record.issuer_name ||
        requested ||
        "-",
    ),
    logo: record.logo ? issuerLogo(requested, String(record.logo)) : "",
  };
}

function MultilineCell({
  value,
}: {
  value: string | string[] | Record<string, string | string[]> | undefined;
}) {
  const lines = formatIssuerLines(value);
  return lines.length ? (
    <div className="grid gap-1 whitespace-pre-line">
      {lines.map((line, index) => (
        <div key={`${line}-${index}`}>{line}</div>
      ))}
    </div>
  ) : (
    "-"
  );
}

export function useMyIssuers() {
  const [data, setData] = useState<MyIssuersData>({});
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    loadMyIssuers().then((value) => {
      if (active) {
        setData(value);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return { data, loading };
}

export function formatIssuerLines(
  value: string | string[] | Record<string, string | string[]> | undefined,
): string[] {
  if (!value) return [];
  if (Array.isArray(value))
    return value.flatMap((item) => formatIssuerLines(item));
  if (typeof value === "object")
    return Object.entries(value).flatMap(([region, items]) =>
      formatIssuerLines(items).map((item) => `${region}：${item}`),
    );
  return String(value).trim() ? [String(value)] : [];
}
