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

export function apply(ctx: Context, config: Config): void {
  // Zoom the page from its first paint; the client plugin changes the scale through the shim later.
  ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'script',
      placement: 'head',
      text: `(() => { ${scaleViewportUnits}; (${installScaleShim})(${config.scale.get()}) })()`,
    })
  })
}
