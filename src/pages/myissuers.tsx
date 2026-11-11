import { useMemo, useState } from "react";
import { PageHeading, Shell } from "../components/Shell";
import { SmartLink } from "../components/SmartLink";
import { SmartImage } from "../components/SmartImage";
import { Empty, Loading, SearchField } from "../components/ui";
import { issuerLogo, typeLabels } from "../lib/data";
import { useMyIssuers } from "../lib/hooks";
import type { MyIssuersData } from "../lib/types";

type MyIssuerRecord = MyIssuersData[string][number];

const TYPE_LABELS: Record<string, string> = {
  debit: "借记卡",
  credit: "信用卡",
  prepaid: "预付卡",
  transit: "交通卡",
};

export function MyIssuersPage({ title }: { title: string }) {
  const { data, loading } = useMyIssuers();
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("zh-CN");
    return Object.entries(data)
      .map(
        ([type, records]) =>
          [
            type,
            normalized
              ? records.filter((record) =>
                  searchText(record).includes(normalized),
                )
              : records,
          ] as const,
      )
      .filter(([, records]) => records.length);
  }, [data, query]);

  return (
    <Shell title={title}>
      <PageHeading title={title} description="当前个人卡包中的发行方概览。" />
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="搜索发行方、开户行或电话"
      />
      {loading ? (
        <Loading />
      ) : sections.length ? (
        <div className="grid min-w-0 gap-6">
          {sections.map(([type, records]) => (
            <section key={type} className="min-w-0">
              <h2 className="mb-3 text-xl font-bold text-ink">
                {typeLabel(type)}
              </h2>
              <div className="panel table-scrollbar hidden max-w-full overflow-x-auto md:block">
                <table className="w-full min-w-[640px] table-fixed break-words text-left text-sm">
                  <colgroup>
                    <col className="w-[38%]" />
                    <col className="w-[14%]" />
                    <col className="w-[24%]" />
                    <col className="w-[24%]" />
                  </colgroup>
                  <thead className="bg-soft text-xs uppercase tracking-wide text-muted">
                    <tr>
                      {["发行方", "卡数", "开户行", "电话"].map((label) => (
                        <th key={label} scope="col" className="px-4 py-3 font-semibold">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((record, index) => (
                      <tr
                        key={`${record.issuer || "issuer"}-${index}`}
                        className="border-t border-line"
                      >
                        <td className="px-4 py-3 font-semibold">
                          <IssuerCell record={record} />
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {cardCountText(record)}
                        </td>
                        <td className="px-4 py-3">
                          <Lines value={record.branch} />
                        </td>
                        <td className="px-4 py-3">
                          <Lines value={record.tel} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-3 md:hidden">
                {records.map((record, index) => (
                  <article
                    key={`${record.issuer || "issuer"}-${index}`}
                    className="panel p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 font-semibold">
                        <IssuerCell record={record} />
                      </div>
                      <span className="shrink-0 text-sm text-muted">
                        {cardCountText(record)} 张
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 border-t border-line pt-3 text-sm">
                      <div>
                        <dt className="text-xs text-muted">开户行</dt>
                        <dd className="mt-1">
                          <Lines value={record.branch} />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">电话</dt>
                        <dd className="mt-1">
                          <Lines value={record.tel} />
                        </dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <Empty
          text={query.trim() ? "没有找到匹配的发行方。" : "暂无发行方数据。"}
        />
      )}
    </Shell>
  );
}

function typeLabel(type: string) {
  return TYPE_LABELS[type.toLowerCase()] || typeLabels[type] || type;
}

function cardCountText(record: MyIssuerRecord) {
  const virtual = Number(record.virtualCardNum || 0);
  const active = Number(record.activeCardNum || 0);
  if (virtual > 0 && active === virtual) return `虚拟${virtual}`;
  if (virtual > 0) return `${active}(虚拟${virtual})`;
  return active || 0;
}

function issuerMetadata(record: MyIssuerRecord) {
  const key = String(record.issuer || "").trim();
  return {
    name: String(
      record.nativeName ||
        record.native_name ||
        record.name ||
        record.issuerName ||
        record.issuer_name ||
        key ||
        "-",
    ),
    logo: record.logo ? issuerLogo(key, String(record.logo)) : "",
  };
}

function IssuerCell({ record }: { record: MyIssuerRecord }) {
  const metadata = issuerMetadata(record);
  const content = (
    <span className="inline-flex items-center gap-2">
      {metadata.logo && (
        <SmartImage
          src={metadata.logo}
          alt=""
          className="size-7 shrink-0"
          imgClassName="size-full object-contain"
          spinnerSize={12}
        />
      )}
      <span>{metadata.name}</span>
    </span>
  );
  return record.url ? (
    <SmartLink
      className="text-accent-ink hover:underline"
      href={record.url}
      externalIcon={false}
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

function searchText(record: MyIssuerRecord) {
  return [
    record.issuer,
    record.nativeName,
    record.native_name,
    record.name,
    record.issuerName,
    record.issuer_name,
    ...formatIssuerLines(record.branch),
    ...formatIssuerLines(record.tel),
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("zh-CN");
}

function Lines({ value }: { value: MyIssuerRecord["branch"] }) {
  const lines = formatIssuerLines(value);
  return lines.length ? (
    <div className="grid gap-1 whitespace-pre-line">
      {lines.map((line, index) => (
        <div key={`${line}-${index}`}>{line}</div>
      ))}
    </div>
  ) : (
    <span className="text-muted">-</span>
  );
}

function formatIssuerLines(
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
