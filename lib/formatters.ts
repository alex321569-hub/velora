export type CurrencyCode = "USD" | "KRW";

export function formatPrice(value: number | null | undefined, currency: CurrencyCode = "USD") {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "데이터 없음";
  }

  if (currency === "KRW") {
    return value.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "데이터 없음";
  }

  if (Math.abs(value) < 0.005) {
    return "0.00%";
  }

  return value > 0 ? `▲ +${value.toFixed(2)}%` : `▼ ${value.toFixed(2)}%`;
}

export function formatVolume(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "데이터 없음";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCompactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "데이터 없음";
  }

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function getPercentColorClass(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || Math.abs(value) < 0.005) {
    return "text-muted";
  }

  return value > 0 ? "text-positive" : "text-negative";
}
