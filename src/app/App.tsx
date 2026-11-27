import { lazy, Suspense } from "react";
import { Spinner } from "../components/ui";
import { useCards } from "../lib/hooks";
import { usePathname } from "../lib/router";

const GalleryPage = lazy(() =>
  import("../pages/gallery").then((module) => ({ default: module.GalleryPage })),
);
const BinPage = lazy(() =>
  import("../pages/bin").then((module) => ({ default: module.BinPage })),
);
const DocsIndex = lazy(() =>
  import("../pages/docs").then((module) => ({ default: module.DocsIndex })),
);
const DocsPage = lazy(() =>
  import("../pages/docs").then((module) => ({ default: module.DocsPage })),
);
const EmbedPage = lazy(() =>
  import("../pages/embed").then((module) => ({ default: module.EmbedPage })),
);
const LuhnPage = lazy(() =>
  import("../pages/luhn").then((module) => ({ default: module.LuhnPage })),
);
const InterestPage = lazy(() =>
  import("../pages/interest").then((module) => ({ default: module.InterestPage })),
);
const WithdrawalPage = lazy(() =>
  import("../pages/withdrawal").then((module) => ({
    default: module.WithdrawalPage,
  })),
);
const MyPage = lazy(() =>
  import("../pages/my").then((module) => ({ default: module.MyPage })),
);
const MyIssuersPage = lazy(() =>
  import("../pages/myissuers").then((module) => ({
    default: module.MyIssuersPage,
  })),
);
const CreditPage = lazy(() =>
  import("../pages/credit").then((module) => ({ default: module.CreditPage })),
);
const WalletPage = lazy(() =>
  import("../pages/wallet").then((module) => ({ default: module.WalletPage })),
);
const CollectionPage = lazy(() =>
  import("../pages/collection").then((module) => ({
    default: module.CollectionPage,
  })),
);

function PersonalRoute({ kind }: { kind: "credit" | "wallet" }) {
  const { cards, loading } = useCards(kind);
  if (kind === "credit") return <CreditPage cards={cards} loading={loading} />;
  return <WalletPage cards={cards} loading={loading} />;
}

function RouteLoading() {
  return (
    <div className="grid min-h-dvh place-items-center gap-3 text-sm text-muted">
      <Spinner size={30} />
      <span>加载中…</span>
    </div>
  );
}

export function App() {
  const path = usePathname();

  let page = <GalleryPage />;
  if (path === "/docs") page = <DocsIndex />;
  else if (path.startsWith("/docs/") || path === "/link")
    page = (
      <DocsPage
        key={path}
        slug={path === "/link" ? "link" : path.split("/").pop() || "about"}
      />
    );
  else if (path === "/embed") page = <EmbedPage />;
  else if (path === "/bin") page = <BinPage />;
  else if (path === "/luhn") page = <LuhnPage />;
  else if (path === "/interest") page = <InterestPage />;
  else if (path === "/withdrawal") page = <WithdrawalPage />;
  else if (path === "/my") page = <MyPage />;
  else if (path === "/myissuers") page = <MyIssuersPage title="我的发行方" />;
  else if (path === "/credit") page = <PersonalRoute kind="credit" />;
  else if (path === "/wallet") page = <PersonalRoute kind="wallet" />;
  else if (path === "/collection") page = <CollectionPage />;

  return <Suspense fallback={<RouteLoading />}>{page}</Suspense>;
}
