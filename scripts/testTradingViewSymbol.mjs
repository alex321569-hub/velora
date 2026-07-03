import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toTradingViewSymbolForStock } from "../lib/market/toTradingViewSymbolCore.ts";

function readUniverse(fileName) {
  return JSON.parse(readFileSync(join(process.cwd(), "lib", "market", "generated", fileName), "utf8"));
}

const universe = [...readUniverse("stockUniverse.json"), ...readUniverse("koreaStockUniverse.json")];

function findStock(symbol) {
  const normalizedSymbol = symbol.toUpperCase().replace(/\.(KS|KQ)$/i, "");
  return universe.find((item) => item.symbol.toUpperCase().replace(/\.(KS|KQ)$/i, "") === normalizedSymbol) ?? null;
}

const cases = [
  ["005930.KS", "KRX:005930"],
  ["247540.KQ", "KRX:247540"],
  ["005930", "KRX:005930"],
  ["AAPL", "NASDAQ:AAPL"],
  ["ASX", "NYSE:ASX"],
  ["QQQ", "NASDAQ:QQQ"],
  ["SPY", "AMEX:SPY"],
  ["NOT_A_REAL_SYMBOL", null],
];

let failures = 0;

for (const [input, expected] of cases) {
  const actual = toTradingViewSymbolForStock(input, findStock(input));
  const passed = actual === expected;
  console.log(`${passed ? "PASS" : "FAIL"} ${input} -> ${actual ?? "null"}`);

  if (!passed) {
    failures += 1;
    console.error(`  expected: ${expected ?? "null"}`);
  }
}

if (failures > 0) {
  process.exitCode = 1;
}
