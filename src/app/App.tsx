import { BinPage, GalleryPage } from "../pages/gallery";
import { DocsIndex, DocsPage } from "../pages/docs";
import { EmbedPage } from "../pages/embed";
import { LuhnPage } from "../pages/luhn";
import { InterestPage } from "../pages/interest";
import { MyPage } from "../pages/my";
import { MyIssuersPage } from "../pages/myissuers";
import { CreditPage } from "../pages/credit";
import { WithdrawalPage } from "../pages/withdrawal";
import { WalletPage } from "../pages/wallet";
import { CollectionPage } from "../pages/collection";
import { useCards } from "../components/filters";

function PersonalRoute({ kind }: { kind: "credit" | "wallet" | "collection" }) {
  const { cards, loading } = useCards(kind === "credit" ? "credit" : "mine");
  if (kind === "credit") return <CreditPage cards={cards} loading={loading} />;
  if (kind === "wallet") return <WalletPage cards={cards} loading={loading} />;
  return <CollectionPage cards={cards} loading={loading} />;
}

export function App() {
  const path = location.pathname.replace(/\/$/, "") || "/";
  if (path === "/docs") return <DocsIndex />;
  if (path.startsWith("/docs/") || path === "/link") {
    const slug = path === "/link" ? "link" : path.split("/").pop() || "about";
    return <DocsPage key={slug} slug={slug} />;
  }
  if (path === "/embed") return <EmbedPage />;
  if (path === "/bin") return <BinPage />;
  if (path === "/luhn") return <LuhnPage />;
  if (path === "/interest") return <InterestPage />;
  if (path === "/withdrawal") return <WithdrawalPage />;
  if (path === "/my") return <MyPage />;
  if (path === "/myissuers") return <MyIssuersPage title="现用卡" />;
  if (path === "/credit") return <PersonalRoute kind="credit" />;
  if (path === "/wallet") return <PersonalRoute kind="wallet" />;
  if (path === "/collection") return <PersonalRoute kind="collection" />;
  return <GalleryPage />;
}
