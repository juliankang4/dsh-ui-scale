import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'
import { installScaleShim, scaleViewportUnits } from './shim.cjs'

export const name = 'dsh-ui-scale'

export interface Config {
  /** Interface scale in percent. */
  scale: Volatile<number>
}

export const Config = z.object({
  scale: z.number().step(1).min(50).max(200).default(100).volatile(),
})

/**
 * Give the Desktop window the bounds the client half saved (Desktop always opens it at 1280x820).
 * Runs as a head script before the window is shown, so its source text must stay self-contained.
 */
function restoreWindow(key: string): void {
  if (location.protocol !== 'dsh-app:') return
  try {
    // Checked below, since the stored text can be anything.
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as { x: number, y: number, w: number, h: number } | null
    if (saved === null || ![saved.x, saved.y, saved.w, saved.h].every(Number.isFinite)) return
    const area = screen as Screen & { availLeft: number, availTop: number }
    const width = Math.min(saved.w, area.availWidth)
    const height = Math.min(saved.h, area.availHeight)
    resizeTo(width, height)
    // A spot on another or a disconnected display would hide the window, so the position comes back only on this one.
    const left = saved.x - area.availLeft
    const top = saved.y - area.availTop
    if (left >= 0 && top >= 0 && left + width <= area.availWidth && top + height <= area.availHeight) moveTo(saved.x, saved.y)
  } catch {}
}

export function apply(ctx: Context, config: Config): void {
  // Zoom the page from its first paint; the client plugin changes the scale through the shim later.
  ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'script',
      placement: 'head',
      text: `(() => { ${scaleViewportUnits}; (${installScaleShim})(${config.scale.get()}); (${restoreWindow})('dsh-ui-scale:window') })()`,
    })
  })
}
