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
    <div className="fixed inset-0 bg-soft p-2 sm:p-3">
      <iframe
        className="size-full rounded-lg border border-line bg-surface"
        src={target || "about:blank"}
        title="嵌入网页"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
