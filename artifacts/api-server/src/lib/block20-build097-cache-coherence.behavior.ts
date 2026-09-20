import assert from "node:assert/strict";
import { ScopedBriefingCache } from "./scoped-briefing-cache";

const cache = new ScopedBriefingCache<{ value: number }>(50, 2);
assert.equal(ScopedBriefingCache.scopeKey(7, [4, 2, 4]), "7:2,4");
let loads = 0;
let release!: () => void;
const barrier = new Promise<void>((resolve) => { release = resolve; });
const loader = async () => { loads += 1; await barrier; return { value: 42 }; };
const first = cache.resolve("7:2,4", loader);
const second = cache.resolve("7:2,4", loader);
release();
assert.equal((await first).value, 42);
assert.equal((await second).value, 42);
assert.equal(loads, 1);
assert.equal(cache.get("7:2,4")?.value, 42);
assert.equal(cache.get("7:2,4", Date.now() + 100), undefined);
console.log("block20 build097 scoped cache coherence: PASS");
