import { formatPrice } from "@/lib/formatters";
import type { StockBasicInfo, StockIndicators } from "@/lib/market/types";
import type { AiOpinion, AnalysisInput, BreakdownCategory, BreakdownItem, Checkpoint, CheckpointPriority, Rating } from "./types";

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getDistancePercent(price: number | null | undefined, currentPrice: number) {
  if (price == null || currentPrice <= 0) return null;
  return (Math.abs(currentPrice - price) / currentPrice) * 100;
}

function isMacdStatus(status: string | undefined, keyword: "up" | "down") {
  if (!status) return false;
  if (keyword === "up") return status.includes("상승") || status.includes("곸듅");
  return status.includes("하락") || status.includes("섎씫");
}

function getAiRating(score: number): Rating {
  if (score >= 95) return { stars: "★★★★★", label: "긍정 / 과열 점검" };
  if (score >= 90) return { stars: "★★★★☆", label: "긍정 / 주의" };
  if (score >= 80) return { stars: "★★★★", label: "긍정" };
  if (score >= 70) return { stars: "★★★☆", label: "양호" };
  if (score >= 60) return { stars: "★★★", label: "중립 우위" };
  if (score >= 50) return { stars: "★★☆", label: "중립" };
  if (score >= 40) return { stars: "★★", label: "주의" };
  return { stars: "★", label: "위험" };
}

function getConfidenceGrade(confidence: number): Rating {
  if (confidence >= 95) return { stars: "★★★★★", label: "매우 높음" };
  if (confidence >= 90) return { stars: "★★★★☆", label: "높음" };
  if (confidence >= 80) return { stars: "★★★★", label: "양호" };
  if (confidence >= 70) return { stars: "★★★☆", label: "보통" };
  if (confidence >= 60) return { stars: "★★★", label: "낮음" };
  return { stars: "★★", label: "매우 낮음" };
}

function getRisk(score: number, rsi: number, supportDistance: number | null, resistanceDistance: number | null, nearHigh: boolean, recentReturn: number) {
  let risk = 0;
  if (score < 50) risk += 2;
  else if (score < 70) risk += 1;
  if (rsi >= 75 || rsi <= 25) risk += 2;
  else if (rsi >= 70 || rsi <= 30) risk += 1;
  if (supportDistance === null || supportDistance <= 3 || supportDistance >= 20) risk += 1;
  if (resistanceDistance !== null && resistanceDistance <= 3) risk += 1;
  if (nearHigh || recentReturn >= 12) risk += 1;

  if (risk >= 5) return { icon: "🔴", label: "매우 높음", className: "text-negative" };
  if (risk >= 3) return { icon: "🟠", label: "높음", className: "text-orange-300" };
  if (risk >= 1) return { icon: "🟡", label: "보통", className: "text-yellow-300" };
  return { icon: "🟢", label: "낮음", className: "text-positive" };
}

function chooseTemplate(items: string[], seed: number) {
  return items[Math.abs(Math.round(seed)) % items.length];
}

function buildAiTemplates(trendLabel: string, shortLabel: string, macdLabel: string, rsiLabel: string) {
  const trendText =
    trendLabel === "상승"
      ? "중장기 추세는 여전히 긍정적입니다"
      : trendLabel === "하락"
        ? "중장기 추세는 아직 부담이 남아 있습니다"
        : "중장기 방향성은 뚜렷하게 한쪽으로 기울지 않았습니다";
  const shortText =
    shortLabel === "조정 중"
      ? "단기적으로는 조정 흐름이 나타나고 있습니다"
      : shortLabel === "단기 급등"
        ? "단기 상승 속도가 다소 빠른 구간입니다"
        : "단기 흐름은 비교적 안정적입니다";
  const momentumText =
    macdLabel === "상승 신호"
      ? "모멘텀은 아직 살아 있는 모습입니다"
      : macdLabel === "하락 신호"
        ? "모멘텀은 다소 약해진 상태입니다"
        : "모멘텀은 중립에 가까운 상태입니다";
  const rsiText =
    rsiLabel === "과열"
      ? "RSI 부담이 있어 단기 추격은 신중할 필요가 있습니다"
      : rsiLabel === "과매도"
        ? "RSI는 과매도권에 가까워 기술적 반등 가능성도 열려 있습니다"
        : "RSI는 과열권이 아니어서 가격 부담은 제한적입니다";

  return [
    `${trendText}. ${shortText}만, 주요 지지선이 유지된다면 추세 훼손으로 보기는 이릅니다.`,
    `${trendText}. 다만 ${shortText}므로 신규 진입은 5일선 회복 여부를 확인하는 접근이 적절해 보입니다.`,
    `${trendText}. ${rsiText}는 점도 긍정적이나, 저항 구간이 가까우면 추격 매수는 부담이 될 수 있습니다.`,
    `${shortText}. ${trendText}만, 거래량이 동반되지 않으면 반등의 신뢰도는 제한적입니다.`,
    `${momentumText}. 현재는 가격이 지지선 위에서 안정되는지 확인하며 대응하는 것이 좋아 보입니다.`,
    `${trendText}. ${momentumText}만, 단기 저항을 돌파하기 전까지는 속도 조절 가능성을 염두에 둘 필요가 있습니다.`,
    `${shortText}. ${rsiText}는 점을 감안하면 급격한 과열보다는 숨 고르기 성격에 가깝습니다.`,
    `${trendText}. 단기적으로는 저항 돌파보다 눌림목에서 매수세가 유입되는지 확인하는 전략이 유리합니다.`,
    `${momentumText}. 현재는 지지선 이탈 여부가 단기 리스크를 판단하는 핵심 변수입니다.`,
    `${trendText}. ${shortText}므로 오늘은 5일선 회복과 거래량 변화를 우선 확인할 필요가 있습니다.`,
    `현재 가격은 중요한 분기점에 있습니다. ${trendText}만, 저항선 부근에서는 기대수익보다 리스크 관리가 앞서야 합니다.`,
    `${shortText}. ${momentumText}라면 반등 시도는 가능하지만, 확인 없는 추격은 부담스럽습니다.`,
    `${trendText}. ${rsiText}는 점에서 추가 상승 여력은 남아 있으나, 저항 돌파 확인이 필요합니다.`,
    `가격 흐름은 아직 무너지지 않았습니다. ${shortText}므로 단기 평균선 회복 여부가 중요합니다.`,
    `${trendText}. 다만 단기 상승폭이 커진 구간이라면 분할 접근이 더 합리적입니다.`,
    `${momentumText}. 지지선 근처에서 매수세가 확인되면 단기 반등 신뢰도가 높아질 수 있습니다.`,
    `${shortText}. 중장기 평균선 위에 머무는 동안에는 조정을 기회로 보는 시각도 가능합니다.`,
    `${trendText}. 저항선이 가까운 만큼 돌파 후 안착 여부를 확인하는 것이 안전합니다.`,
    `${rsiText}. 현재는 급하게 방향을 예단하기보다 지지와 저항 사이의 반응을 확인할 구간입니다.`,
    `${momentumText}. MACD가 개선되기 전까지는 상승 탄력보다 변동성 관리에 초점을 둘 필요가 있습니다.`,
    `${trendText}. 단기 조정이 이어지더라도 20일선 부근에서 지지가 확인되면 흐름은 유지될 수 있습니다.`,
    `${shortText}. 거래량이 늘어나는 반등이 나와야 다음 상승 구간의 신뢰도가 높아집니다.`,
    `${trendText}. 현재는 저항 돌파보다 손절 기준을 명확히 정하는 대응이 더 중요합니다.`,
    `${momentumText}. RSI가 안정권을 유지한다면 단기 조정 이후 재상승 가능성은 남아 있습니다.`,
    `현재는 추세와 가격 부담이 함께 존재하는 구간입니다. 눌림목 확인 후 접근하는 전략이 유리해 보입니다.`,
    `${trendText}. 52주 고점 부근이라면 좋은 흐름과 별개로 단기 차익 실현 가능성을 고려해야 합니다.`,
    `${shortText}. 지지선이 멀리 떨어져 있다면 진입 가격의 안전마진은 충분하지 않을 수 있습니다.`,
    `${trendText}. MACD가 약해진 상태라면 반등보다 모멘텀 회복을 먼저 확인하는 편이 좋습니다.`,
    `${momentumText}. 저항 돌파와 거래량 증가가 동시에 확인되면 흐름은 한 단계 개선될 수 있습니다.`,
    `${shortText}. 현재는 장기 흐름보다 단기 평균선 회복 여부가 투자 판단의 우선순위입니다.`,
    `${trendText}. 가격이 주요 이동평균선 위에서 유지된다면 중장기 관점의 부담은 크지 않습니다.`,
    `${rsiText}. 다만 단기 저항이 가까우면 상승 여력은 제한적으로 볼 필요가 있습니다.`,
    `${momentumText}. 단기 신호가 약해진 만큼 매수보다 관찰의 비중을 높이는 것이 적절합니다.`,
    `${trendText}. 조정 구간에서는 거래량 감소보다 저점 방어 여부를 더 중요하게 봐야 합니다.`,
    `${shortText}. 5일선 회복 전까지는 단기 탄력이 완전히 살아났다고 보기 어렵습니다.`,
    `${trendText}. 저항선 돌파 후 거래량이 붙는다면 추세 지속 가능성은 높아질 수 있습니다.`,
    `${momentumText}. 지표가 엇갈리는 구간에서는 분할 매수와 명확한 기준가 설정이 필요합니다.`,
    `${trendText}. 현재는 공격적인 매수보다 지지선 부근의 수급 확인이 더 중요합니다.`,
    `${shortText}. RSI가 과열권이 아니라면 조정 이후 재반등 여지는 남아 있습니다.`,
    `${trendText}. 단기 급등 이후라면 가격보다 거래량과 종가 위치를 우선 확인해야 합니다.`,
    `${momentumText}. MACD 회복이 동반되면 단기 추세 개선 신호로 볼 수 있습니다.`,
    `${trendText}. 고점권에서는 상승 추세가 유지되더라도 신규 매수의 기대수익률은 낮아질 수 있습니다.`,
    `${shortText}. 현재는 저항 돌파보다 지지선 재확인이 더 현실적인 체크포인트입니다.`,
    `${trendText}. 200일선 위 흐름이 유지된다면 장기 관점의 구조는 아직 양호합니다.`,
    `${momentumText}. RSI가 중립권에 머물면 급격한 과열 부담은 크지 않습니다.`,
    `${shortText}. 거래량이 줄어드는 조정이라면 추세 훼손보다는 속도 조절로 해석할 수 있습니다.`,
    `${trendText}. 저항선이 3% 이내라면 단기 목표가보다 돌파 확인을 우선해야 합니다.`,
    `${momentumText}. 하락 신호가 완화되기 전까지는 반등 시 분할 대응이 적절합니다.`,
    `${trendText}. 주요 이동평균선 위에서 종가가 유지되는지가 이번 구간의 핵심입니다.`,
    `${shortText}. 단기 변동성이 커진 만큼 매수 판단은 하루 더 확인하는 편이 안정적입니다.`,
    `${trendText}. 지지선과 평균선이 겹치는 구간에서 반등하면 신뢰도는 더 높아질 수 있습니다.`,
    `${momentumText}. 현재는 상승 여력보다 리스크 대비 보상비율을 점검할 필요가 있습니다.`,
    `${trendText}. 중장기 흐름은 양호하지만, 단기적으로는 저항선 돌파 확인이 필요합니다.`,
  ];
}

export function getProgressColor(score: number) {
  if (score >= 80) return "bg-positive";
  if (score >= 60) return "bg-yellow-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-negative";
}

export function getTodayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function getDisplayDate(date: string) {
  return date.slice(5).replace("-", "-");
}

export function getMacdStatusClass(status: string) {
  if (isMacdStatus(status, "up")) return "text-positive";
  if (isMacdStatus(status, "down")) return "text-negative";
  return "text-muted";
}

export function buildAiOpinion({ indicators, currentPrice, currency: _currency, recentPrices }: AnalysisInput): AiOpinion {
  const ma = indicators.movingAverages;
  const support = indicators.supportResistance.supports[0] ?? null;
  const resistance = indicators.supportResistance.resistances[0] ?? null;
  const supportDistance = getDistancePercent(support?.price, currentPrice);
  const resistanceDistance = getDistancePercent(resistance?.price, currentPrice);
  const range = indicators.week52High - indicators.week52Low;
  const week52Position = range > 0 ? (currentPrice - indicators.week52Low) / range : 0.5;
  const nearHigh = indicators.week52High > 0 && Math.abs(currentPrice - indicators.week52High) / indicators.week52High <= 0.02;
  const priceDiscovery = !resistance && week52Position >= 0.85;
  const chronological = [...recentPrices].reverse();
  const recentReturn = chronological[0]?.close
    ? (((chronological.at(-1)?.close ?? currentPrice) - chronological[0].close) / chronological[0].close) * 100
    : 0;
  const avgVolume = chronological.length ? chronological.reduce((sum, price) => sum + (price.volume ?? 0), 0) / chronological.length : 0;
  const volumeRising = (chronological.at(-1)?.volume ?? 0) > avgVolume && avgVolume > 0;
  const scoreItems: BreakdownItem[] = [];
  let score = 50;

  function add(label: string, points: number, reason: string, category: BreakdownCategory) {
    scoreItems.push({ label, points, reason, category });
    score += points;
  }

  if (ma.sma5 !== null && currentPrice < ma.sma5) add("5일선", -8, "단기 평균선 하회", "short");
  if (ma.sma20 !== null) currentPrice > ma.sma20 ? add("20일선", 4, "단기 추세 상회", "short") : add("20일선", -10, "단기 추세 하회", "short");
  if (ma.sma60 !== null) currentPrice > ma.sma60 ? add("60일선", 6, "분기 추세 상회", "long") : add("60일선", -10, "분기 추세 하회", "long");
  if (ma.sma120 !== null) currentPrice > ma.sma120 ? add("120일선", 8, "중기 상승 추세 유지", "long") : add("120일선", -12, "중기 추세 하회", "long");
  if (ma.sma200 !== null) currentPrice > ma.sma200 ? add("200일선", 10, "장기 상승 추세 유지", "long") : add("200일선", -15, "장기 추세 하회", "long");

  if (indicators.rsi >= 80) add("RSI", -12, "강한 과열 구간", "momentum");
  else if (indicators.rsi >= 75) add("RSI", -8, "과열 주의", "momentum");
  else if (indicators.rsi >= 45 && indicators.rsi <= 65) add("RSI", 5, "적정 구간", "momentum");

  const macdStatus = indicators.macd?.status;
  if (isMacdStatus(macdStatus, "up")) add("MACD", 6, "Signal 위", "momentum");
  if (isMacdStatus(macdStatus, "down")) add("MACD", -8, "Signal 아래", "momentum");

  if (supportDistance === null) add("지지선", -5, "의미 있는 지지선 부족", "levels");
  else if (supportDistance >= 3 && supportDistance <= 10) add("지지선", 5, "현재가와 적정 거리", "levels");
  else if (supportDistance >= 20) add("지지선", -5, "지지선이 너무 멂", "levels");

  if (resistanceDistance !== null && resistanceDistance <= 3) add("저항선", -5, "저항선 근접", "levels");
  if (nearHigh) add("52주 고점", -3, "52주 고점 2% 이내", "levels");
  if (volumeRising) add("최근 거래량", 3, "평균 거래량 증가", "volume");

  const aiScore = Math.round(clamp(score));
  const rating = getAiRating(aiScore);
  const risk = getRisk(aiScore, indicators.rsi, supportDistance, resistanceDistance, nearHigh, recentReturn);
  const confidenceItems: BreakdownItem[] = [];
  let confidence = 80;

  function addConfidence(label: string, points: number, reason: string) {
    confidenceItems.push({ label, points, reason, category: "confidence" });
    confidence += points;
  }

  const hasEnoughData = recentPrices.length >= 10;
  const hasSupportOverlap =
    support !== null &&
    [ma.sma20, ma.sma60, ma.sma120, ma.sma200].some((value) => value !== null && Math.abs(value - support.price) / currentPrice <= 0.02);
  const rsiMacdAligned =
    (indicators.rsi >= 50 && isMacdStatus(macdStatus, "up")) || (indicators.rsi < 50 && isMacdStatus(macdStatus, "down"));
  const volumeProfileExists = indicators.supportResistance.supports
    .concat(indicators.supportResistance.resistances)
    .some((level) => level.reason.includes("거래량") || level.reason.includes("嫄곕옒"));

  hasEnoughData ? addConfidence("데이터 품질", 5, "최근 시세 확보") : addConfidence("데이터 품질", -10, "최근 데이터 부족");
  ma.sma200 !== null ? addConfidence("장기 데이터", 3, "200일선 계산 가능") : addConfidence("장기 데이터", -8, "200일선 부족");
  if (hasSupportOverlap) addConfidence("지지/평균선", 5, "지지선과 평균선 중첩");
  if (rsiMacdAligned) addConfidence("지표 일치", 4, "RSI와 MACD 방향 일치");
  if (volumeProfileExists) addConfidence("매물대", 3, "거래량 기반 가격대 포함");
  if (volumeRising) addConfidence("거래량", 2, "최근 거래량 충분");
  if (indicators.macd === null) addConfidence("MACD", -6, "MACD 계산 불가");
  if (!support) addConfidence("지지선", -8, "지지 정보 부족");
  if (!resistance) addConfidence("저항선", priceDiscovery ? -6 : -5, priceDiscovery ? "가격 발견 구간" : "저항 정보 부족");

  const confidenceScore = Math.round(clamp(confidence));
  const confidenceGrade = getConfidenceGrade(confidenceScore);
  const aboveLongMas = [ma.sma60, ma.sma120, ma.sma200].filter((value): value is number => value !== null).every((value) => currentPrice > value);
  const belowAllMas = [ma.sma5, ma.sma20, ma.sma60, ma.sma120, ma.sma200].filter((value): value is number => value !== null).every((value) => currentPrice < value);
  const trendLabel = belowAllMas ? "하락" : aboveLongMas ? "상승" : "중립";
  const shortLabel = currentPrice < (ma.sma5 ?? 0) || recentReturn < -3 ? "조정 중" : recentReturn > 8 ? "단기 급등" : "안정";
  const rsiLabel = indicators.rsi >= 70 ? "과열" : indicators.rsi <= 30 ? "과매도" : "과열 아님";
  const macdLabel = isMacdStatus(macdStatus, "up") ? "상승 신호" : isMacdStatus(macdStatus, "down") ? "하락 신호" : macdStatus ?? "데이터 없음";
  const seed = aiScore + confidenceScore + Math.round(indicators.rsi) + Math.round(recentReturn);
  const aiComment = chooseTemplate(buildAiTemplates(trendLabel, shortLabel, macdLabel, rsiLabel), seed);
  const caution =
    nearHigh || priceDiscovery || recentReturn >= 12
      ? "고점 근접 또는 저항선 부재 구간입니다. 추격 매수는 신중해야 합니다."
      : null;

  return {
    aiScore,
    rating,
    risk,
    confidenceScore,
    confidenceGrade,
    aiComment,
    caution,
    trendLabel,
    shortLabel,
    rsiLabel,
    macdLabel,
    support,
    resistance,
    supportDistance,
    resistanceDistance,
    scoreItems,
    confidenceItems,
    volumeRising,
  };
}

export function buildCheckpoints(
  opinion: AiOpinion,
  indicators: StockIndicators,
  currency: StockBasicInfo["currency"],
) {
  const checkpoints: Checkpoint[] = [];
  const ma5 = indicators.movingAverages.sma5;

  function add(title: string, description: string, priority: CheckpointPriority) {
    if (checkpoints.some((checkpoint) => checkpoint.title === title)) return;
    checkpoints.push({ title, description, priority });
  }

  if (ma5 !== null && opinion.shortLabel === "조정 중") {
    add("5일선 회복 여부", "단기 추세가 다시 살아나는지 확인", "critical");
  } else if (ma5 !== null) {
    add("5일선 유지 여부", "단기 매수세가 이어지는지 확인", "watch");
  }

  if (opinion.resistance && opinion.resistanceDistance !== null && opinion.resistanceDistance <= 3) {
    add(`${formatPrice(opinion.resistance.price, currency)} 저항 돌파`, "추세 지속 여부를 판단하는 핵심 가격대", "critical");
  } else if (opinion.resistance) {
    add(`${formatPrice(opinion.resistance.price, currency)} 저항 접근`, "상승 여력이 실제로 열리는지 확인", "watch");
  }

  if (indicators.rsi >= 70) {
    add("RSI 과열 해소 여부", "단기 추격 매수 부담이 줄어드는지 확인", "critical");
  } else if (indicators.rsi < 50) {
    add("RSI 50 회복 여부", "매수 탄력이 중립선 위로 올라서는지 확인", "watch");
  }

  const macdStatus = indicators.macd?.status;
  if (isMacdStatus(macdStatus, "down")) {
    add("MACD 골든크로스 여부", "모멘텀 개선이 동반되는지 확인", "watch");
  } else if (isMacdStatus(macdStatus, "up")) {
    add("MACD 상승 신호 유지", "현재 모멘텀이 꺾이지 않는지 확인", "watch");
  }

  if (!opinion.volumeRising) {
    add("거래량 증가 여부", "상승 신뢰도가 뒷받침되는지 확인", "watch");
  } else {
    add("거래량 유지 여부", "수급이 계속 붙는지 확인", "info");
  }

  if (opinion.support) {
    add(
      `${formatPrice(opinion.support.price, currency)} 지지 여부`,
      "하락 시 방어선으로 작동하는지 확인",
      opinion.supportDistance !== null && opinion.supportDistance <= 3 ? "critical" : "watch",
    );
  }

  add("다음 실적 발표 확인", "실적 이벤트 전후 변동성 확대 가능성 점검", "info");

  const priorityRank: Record<CheckpointPriority, number> = { critical: 0, watch: 1, info: 2 };
  return checkpoints.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]).slice(0, 5);
}

export function groupBreakdownItems(items: BreakdownItem[]) {
  return [
    { key: "long", title: "📈 장기 추세", items: items.filter((item) => item.category === "long") },
    { key: "short", title: "📉 단기 추세", items: items.filter((item) => item.category === "short") },
    { key: "momentum", title: "📊 모멘텀", items: items.filter((item) => item.category === "momentum") },
    { key: "levels", title: "🛡 지지/저항", items: items.filter((item) => item.category === "levels") },
    { key: "volume", title: "📈 거래량", items: items.filter((item) => item.category === "volume") },
  ].filter((group) => group.items.length > 0);
}
