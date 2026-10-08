import assert from 'node:assert/strict'
import { test } from 'node:test'

// lib/client.js registers a factory with the dsh module loader; capture it to reach the exports.
type Exports = { parseScale: (text: string) => number | undefined }
let factory: ((require: (id: string) => unknown) => Exports) | undefined
Object.assign(globalThis, {
  window: {
    __ModuleLoader__: {
      load: (row: { factory: typeof factory }) => {
        factory = row.factory
      },
    },
  },
})
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

test('divides viewport units but leaves strings and urls alone', async () => {
  const { scaleViewportUnits } = (await import('../lib/shim.cjs')) as { scaleViewportUnits: (value: string) => string }
  const scaled = (unit: string) => `calc(${unit} / var(--dsh-ui-scale, 1))`
  assert.equal(scaleViewportUnits('calc(100vh - 2 * 24px)'), `calc(${scaled('100vh')} - 2 * 24px)`)
  assert.equal(scaleViewportUnits('-10vw 0 0 .5dvh'), `${scaled('-10vw')} 0 0 ${scaled('.5dvh')}`)
  assert.equal(scaleViewportUnits('min(60vh, 520px)'), `min(${scaled('60vh')}, 520px)`)
  assert.equal(scaleViewportUnits('"100vw"'), '"100vw"')
  assert.equal(scaleViewportUnits(`url("/100vw.png") 'a 1vh'`), `url("/100vw.png") 'a 1vh'`)
  assert.equal(scaleViewportUnits('url(/img/10vh.png)'), 'url(/img/10vh.png)')
  assert.equal(scaleViewportUnits(`url("/img)100vw.png") 1vh`), `url("/img)100vw.png") ${scaled('1vh')}`)
  assert.equal(scaleViewportUnits(`url(/a\\)1vw.png) "x\\"2vh"`), `url(/a\\)1vw.png) "x\\"2vh"`)
  assert.equal(scaleViewportUnits('var(--gap-2vw) 12px'), 'var(--gap-2vw) 12px')
})
