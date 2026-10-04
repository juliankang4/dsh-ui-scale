import assert from 'node:assert/strict'
import { test } from 'node:test'

// lib/client.js registers a factory with the dsh module loader; capture it to reach the exports.
type Exports = { parseScale: (text: string) => number | undefined }
let factory: ((require: (id: string) => unknown) => Exports) | undefined
Object.assign(globalThis, { window: { __ModuleLoader__: { load: (row: { factory: typeof factory }) => { factory = row.factory } } } })
await import('../lib/client.js')
const { parseScale } = factory!(() => ({}))

test('accepts integers and a trailing percent sign', () => {
  assert.equal(parseScale('137'), 137)
  assert.equal(parseScale(' 150 % '), 150)
  assert.equal(parseScale('124.6'), 125)
})

test('clamps out-of-range values', () => {
  assert.equal(parseScale('10'), 50)
  assert.equal(parseScale('-5'), 50)
  assert.equal(parseScale('500'), 200)
})

test('rejects text that is not a number', () => {
  assert.equal(parseScale(''), undefined)
  assert.equal(parseScale('   '), undefined)
  assert.equal(parseScale('abc'), undefined)
  assert.equal(parseScale('12px'), undefined)
  assert.equal(parseScale('%'), undefined)
})
