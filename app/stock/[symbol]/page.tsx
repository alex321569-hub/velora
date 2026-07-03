import VeloraApp from "@/app/page";

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;

  return <VeloraApp routeSymbol={decodeURIComponent(symbol)} />;
}
