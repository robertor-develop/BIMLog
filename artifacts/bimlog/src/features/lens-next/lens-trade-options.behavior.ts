import assert from "node:assert/strict";
import { LENS_TRADE_OPTIONS, mergeLensTradeOptions } from "./lens-trade-options";

assert.ok(LENS_TRADE_OPTIONS.includes("Geothermal"));
assert.ok(LENS_TRADE_OPTIONS.includes("Pool"));

const options = mergeLensTradeOptions(["Electrical", "Custom Trade", " Pool ", null]);
assert.equal(options.filter((trade) => trade === "Electrical").length, 1);
assert.equal(options.filter((trade) => trade === "Pool").length, 1);
assert.ok(options.includes("Geothermal"));
assert.ok(options.includes("Custom Trade"));
assert.deepEqual(options, [...options].sort((left, right) => left.localeCompare(right)));

console.log("PASS lens trade catalog includes Geothermal and Pool while preserving project trades");
