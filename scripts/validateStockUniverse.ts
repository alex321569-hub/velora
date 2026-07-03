import stockUniverse from "../lib/market/generated/stockUniverse.json" with { type: "json" };

type GeneratedStock = {
  symbol: string;
  name: string;
  assetType: "stock" | "etf";
  sector: string;
  industry: string;
  aliases: string[];
};

const suspiciousSharePattern = /(American Depositary Shares?|Depositary Shares|Common Shares?|Ordinary Shares?|Class A Ordinary Shares)/i;
const depositaryOrOrdinaryPattern = /(American Depositary Shares?|Depositary Shares|Ordinary Shares?|Class A Ordinary Shares)/i;
const items = stockUniverse as GeneratedStock[];
const suspiciousEtfs = items.filter((item) => item.assetType === "etf" && suspiciousSharePattern.test([item.name, ...item.aliases].join(" ")));
const depositaryOrOrdinaryEtfs = items.filter(
  (item) => item.assetType === "etf" && depositaryOrOrdinaryPattern.test([item.name, ...item.aliases].join(" ")),
);

console.log(`Stock universe symbols: ${items.length.toLocaleString()}`);
console.log(`ETF count: ${items.filter((item) => item.assetType === "etf").length.toLocaleString()}`);
console.log(`Suspicious ADR/common/ordinary share ETFs: ${suspiciousEtfs.length.toLocaleString()}`);
console.log(`Depositary/ordinary share ETFs: ${depositaryOrOrdinaryEtfs.length.toLocaleString()}`);

if (suspiciousEtfs.length > 0) {
  console.log(
    suspiciousEtfs
      .slice(0, 25)
      .map((item) => `${item.symbol}: ${item.name}`)
      .join("\n"),
  );
}

if (depositaryOrOrdinaryEtfs.length > 0) {
  console.error(
    depositaryOrOrdinaryEtfs
      .slice(0, 25)
      .map((item) => `${item.symbol}: ${item.name}`)
      .join("\n"),
  );
  process.exitCode = 1;
}
