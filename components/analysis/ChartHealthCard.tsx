import type { ChartHealthResult } from "@/lib/market/types";
import MobileDisclosure from "../MobileDisclosure";
import Card from "./Card";

function getGradeClass(grade: ChartHealthResult["grade"]) {
  if (grade === "VERY_HEALTHY") return "text-positive";
  if (grade === "HEALTHY") return "text-emerald-300";
  if (grade === "NEUTRAL") return "text-yellow-300";
  if (grade === "DAMAGED") return "text-orange-300";
  return "text-negative";
}

function buildChartHealthSummary(chartHealth: ChartHealthResult) {
  if (chartHealth.insufficientData) {
    return "데이터가 부족해 흐름 판단이 제한적입니다. 충분한 가격 기록이 쌓인 뒤 다시 확인하는 구간입니다.";
  }

  const score = chartHealth.score;
  const ma60Slope = chartHealth.metrics.ma60Slope;
  const ma120Slope = chartHealth.metrics.ma120Slope;
  const drawdown = chartHealth.metrics.drawdownFromRecentHigh;
  const distanceFromMa20 = chartHealth.metrics.distanceFromMa20;
  const atrPercent = chartHealth.metrics.atrPercent;
  const structure = chartHealth.marketStructure.code;
  const mediumTrendUp = (ma60Slope ?? 0) > 0 || (ma120Slope ?? 0) > 0;
  const mediumTrendWeak = (ma60Slope ?? 0) < 0 && (ma120Slope ?? 0) < 0;
  const highVolatility = (atrPercent ?? 0) > 6;
  const farFromHigh = (drawdown ?? 0) > 15;
  const stretched = (distanceFromMa20 ?? 0) > 12;

  if (score >= 70 && !highVolatility && !stretched) {
    return "상승 구조는 양호하고 가격 흐름도 안정적입니다. 다만 이전 고점 돌파 여부는 계속 확인할 필요가 있습니다.";
  }

  if (score >= 55 && structure === "LH_LL" && mediumTrendUp) {
    return "중기 상승 흐름은 유지되고 있지만 단기 고점과 저점이 낮아져, 추세 회복 확인이 필요한 구간입니다.";
  }

  if (score >= 55 && highVolatility) {
    return "흐름은 크게 무너지지 않았지만 변동성이 높아, 이전 고점 회복 여부를 지켜볼 필요가 있습니다.";
  }

  if (score >= 55 && stretched) {
    return "상승 흐름은 유지되고 있지만 현재 위치가 다소 높아, 가격 안정 여부를 확인할 필요가 있습니다.";
  }

  if (score >= 55) {
    return "중기 흐름은 아직 유지되고 있지만 단기 힘은 약해져, 다시 상승세가 강해지는지 확인이 필요합니다.";
  }

  if (score >= 40 && mediumTrendWeak) {
    return "중기 흐름이 약해지고 있어 단기 반등만으로 추세 회복을 판단하기는 이른 구간입니다.";
  }

  if (score >= 40 && farFromHigh) {
    return "가격 흐름이 약해지고 이전 고점과의 격차도 커, 회복 흐름을 더 확인할 필요가 있습니다.";
  }

  if (score >= 40) {
    return "일부 지표는 버티고 있지만 단기 흐름이 약해져, 방향성이 다시 잡히는지 확인이 필요합니다.";
  }

  return "가격 흐름과 중기 추세가 함께 약해진 상태입니다. 반등보다 안정적인 회복 확인이 먼저 필요한 구간입니다.";
}

export default function ChartHealthCard({ chartHealth }: { chartHealth?: ChartHealthResult }) {
  if (!chartHealth) {
    return (
      <MobileDisclosure
        title="차트 건전도"
        className="rounded-lg bg-surface p-3 md:contents md:rounded-none md:bg-transparent md:p-0"
        contentClassName="mt-3"
        desktopClassName="contents"
      >
        <Card title="차트 건전도" className="md:col-span-2 xl:col-span-4">
          <p className="text-muted">차트 건전도 데이터가 없습니다.</p>
        </Card>
      </MobileDisclosure>
    );
  }

  const componentRows = [
    ["이동평균선 정렬", chartHealth.components.maAlignment, 20],
    ["추세 기울기", chartHealth.components.maSlope, 15],
    ["고점/저점 구조", chartHealth.components.marketStructure, 15],
    ["가격 위치", chartHealth.components.pricePosition, 15],
    ["변동성 안정성", chartHealth.components.volatility, 10],
    ["거래량 건전도", chartHealth.components.volumeHealth, 15],
    ["단기 회복 신호", chartHealth.components.shortTermRecovery, 10],
    ["단기 과열 안정성", chartHealth.components.shortTermOverheat, 100],
  ] as const;

  return (
    <MobileDisclosure
      title="차트 건전도"
      className="rounded-lg bg-surface p-3 md:contents md:rounded-none md:bg-transparent md:p-0"
      contentClassName="mt-3"
      desktopClassName="contents"
    >
      <Card title="차트 건전도" className="md:col-span-2 xl:col-span-4">
        <div className="space-y-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className={`text-3xl font-black ${getGradeClass(chartHealth.grade)}`}>{chartHealth.score}점</p>
              <p className="mt-1 text-base font-black text-ink">상태: {chartHealth.label}</p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-panel md:w-72">
              <div
                className={`h-full rounded-full transition-all ${
                  chartHealth.score >= 70 ? "bg-positive" : chartHealth.score >= 55 ? "bg-yellow-400" : chartHealth.score >= 40 ? "bg-orange-400" : "bg-negative"
                }`}
                style={{ width: `${chartHealth.score}%` }}
              />
            </div>
          </div>

          {chartHealth.insufficientData && (
            <p className="rounded-xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-3 text-sm font-black text-yellow-300">
              데이터가 부족해 제한적으로 평가되었습니다.
            </p>
          )}

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {componentRows.map(([label, value, max]) => (
              <div key={label} className="rounded-xl border border-line/70 bg-panel/60 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-muted">{label}</span>
                  <span className="font-black text-ink">
                    {value}/{max}
                  </span>
                </div>
              </div>
            ))}
            <div className="rounded-xl border border-line/70 bg-panel/60 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-black text-muted">추세 약화 감점</span>
                <span className="font-black text-negative">-{chartHealth.damagePenalty}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line/70 bg-panel/70 p-4 md:p-5">
            <p className="text-sm font-black text-muted">AI 한줄 의견</p>
            <p className="mt-3 text-base font-black leading-7 text-ink md:text-lg md:leading-8">
              &quot;{buildChartHealthSummary(chartHealth)}&quot;
            </p>
          </div>

          {chartHealth.appliedScoreCap !== null && (
            <p className="rounded-xl border border-orange-400/30 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-300">
              {chartHealth.appliedScoreCapReason ?? `중기 추세 확인이 필요해 최종 점수가 ${chartHealth.appliedScoreCap}점 이하로 조정되었습니다.`}
            </p>
          )}
        </div>
      </Card>
    </MobileDisclosure>
  );
}
