import { PageHeading, Shell } from "../components/Shell";
import { Filter } from "lucide-react";

export function UtilityPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Shell title={title}>
      <PageHeading title={title} description={description} />
      <div className="panel p-8">
        <div className="flex items-start gap-3">
          <Filter className="mt-1 text-accent" />
          <div>
            <h2 className="text-xl font-bold">工具页面已接入统一架构</h2>
            <p className="mt-2 text-muted">
              数据服务、导航、主题和响应式布局均由共享组件提供，后续规则可继续扩展到同一页面。
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}
export function EmbedPage() {
  const params = new URLSearchParams(location.search);
  const value = params.get("url");
  let target = "";
  try {
    if (value) target = new URL(value, location.href).href;
  } catch {
    target = "";
  }
  return (
    <div className="fixed inset-0 bg-soft p-3">
      <iframe
        className="size-full rounded-lg border border-line bg-white"
        src={target || "about:blank"}
        title="嵌入网页"
      />
    </div>
  );
}
