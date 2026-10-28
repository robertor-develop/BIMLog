import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const merge = require(path.join(root, 'vendor/deepmerge-safe'))

const malicious = JSON.parse('{"safe":{"value":1},"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"prototype":{"polluted":true}}')
const result = merge({}, malicious)
assert.deepEqual(result, { safe: { value: 1 } })
assert.equal({}.polluted, undefined)
assert.equal(Object.prototype.polluted, undefined)

assert.deepEqual(merge({ nested: { left: 1 }, list: [1] }, { nested: { right: 2 }, list: [2] }), {
  nested: { left: 1, right: 2 },
  list: [1, 2],
})
assert.deepEqual(merge.all([{ first: 1 }, { second: 2 }]), { first: 1, second: 2 })

console.log('Deepmerge security backport: PASS unsafeKeys=3 compatibility=object,array,all')
