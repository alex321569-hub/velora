import AiOpinionCard from "@/components/analysis/AiOpinionCard";
import Card from "@/components/analysis/Card";
import LevelList from "@/components/analysis/LevelList";
import MovingAverageRow from "@/components/analysis/MovingAverageRow";
import MobileDisclosure from "@/components/MobileDisclosure";
import { buildAiOpinion, getMacdStatusClass } from "@/lib/analysis/aiAnalysis";
import { formatPrice } from "@/lib/formatters";
import type { RecentPricePoint, StockBasicInfo, StockIndicators } from "@/lib/market/types";

export default function AnalysisCards({
  symbol,
  indicators,
  currency,
  currentPrice,
  recentPrices,
}: {
  symbol: string;
  indicators: StockIndicators;
  currency: StockBasicInfo["currency"];
  currentPrice: number;
  recentPrices: RecentPricePoint[];
}) {
  if (indicators.calculationError) {
    return (
      <section className="mt-6">
        <h2 className="mb-4 hidden text-lg font-extrabold md:block">종목 분석</h2>
        <div className="rounded-lg bg-surface p-4 text-sm font-extrabold text-negative">데이터 오류로 지표 계산 불가</div>
      </section>
    );
  }

  const opinion = buildAiOpinion({ indicators, currentPrice, currency, recentPrices });

  return (
    <section className="mt-6">
      <h2 className="mb-4 hidden text-lg font-extrabold md:block">종목 분석</h2>
      <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-4">
        <MobileDisclosure
          title="종목 분석"
          className="rounded-lg bg-surface p-3 md:contents md:rounded-none md:bg-transparent md:p-0"
          contentClassName="mt-3 grid gap-3"
          desktopClassName="contents"
        >
        <Card title="52주 최고/최저">
          <p>최저: {formatPrice(indicators.week52Low, currency)}</p>
          <p>최고: {formatPrice(indicators.week52High, currency)}</p>
        </Card>

        <Card title="볼린저밴드">
          <p>상단: {formatPrice(indicators.bollingerBands.upper, currency)}</p>
          <p>중심: {formatPrice(indicators.bollingerBands.middle, currency)}</p>
          <p>하단: {formatPrice(indicators.bollingerBands.lower, currency)}</p>
        </Card>

        <Card title="이동평균선" className="md:col-span-2 xl:col-span-2">
          <div className="space-y-1">
            <MovingAverageRow label="5일" tooltip="단기 추세" value={indicators.movingAverages.sma5} currentPrice={currentPrice} currency={currency} />
            <MovingAverageRow label="20일" tooltip="한 달 추세" value={indicators.movingAverages.sma20} currentPrice={currentPrice} currency={currency} />
            <MovingAverageRow label="60일" tooltip="분기 추세" value={indicators.movingAverages.sma60} currentPrice={currentPrice} currency={currency} />
            <MovingAverageRow label="120일" tooltip="중기 추세" value={indicators.movingAverages.sma120} currentPrice={currentPrice} currency={currency} />
            <MovingAverageRow label="200일" tooltip="장기 추세" value={indicators.movingAverages.sma200} currentPrice={currentPrice} currency={currency} />
          </div>
        </Card>

        <Card title="RSI / MACD">
          <div>
            <p className="text-xs font-extrabold text-muted">RSI</p>
            <p>
              [{indicators.rsiStatus}] {indicators.rsi.toFixed(2)}
            </p>
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-xs font-extrabold text-muted">MACD</p>
            {indicators.macd ? (
              <div className="space-y-1">
                <p className={getMacdStatusClass(indicators.macd.status)}>{indicators.macd.status}</p>
                <p>MACD: {formatPrice(indicators.macd.macd, currency)}</p>
                <p>Signal: {formatPrice(indicators.macd.signal, currency)}</p>
                <p>Hist: {formatPrice(indicators.macd.histogram, currency)}</p>
              </div>
            ) : (
              <p>MACD: 데이터 없음</p>
            )}
          </div>
        </Card>

        <Card title="지지선">
          <LevelList levels={indicators.supportResistance.supports} currency={currency} />
        </Card>

        <Card title="저항선">
          {indicators.supportResistance.resistances.length > 0 ? (
            <LevelList levels={indicators.supportResistance.resistances} currency={currency} />
          ) : (
            <p>{indicators.supportResistance.resistanceMessage ?? "데이터 없음"}</p>
          )}
        </Card>

        </MobileDisclosure>

        <AiOpinionCard
          symbol={symbol}
          indicators={indicators}
          currentPrice={currentPrice}
          currency={currency}
          recentPrices={recentPrices}
          opinion={opinion}
        />
      </div>
    </section>
  );
}
