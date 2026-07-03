import VeloraApp from "@/components/VeloraApp";

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;

  return <VeloraApp routeSymbol={decodeURIComponent(symbol)} />;
}
