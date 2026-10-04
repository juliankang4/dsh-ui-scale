import type { Context, Volatile } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import z from '@deepseek-ai/schemastery'

export const name = 'dsh-ui-scale'

export interface Config {
  /** Interface scale in percent. */
  scale: Volatile<number>
}

export const Config = z.object({
  scale: z.number().step(1).min(50).max(200).default(100).volatile(),
})

export function apply(ctx: Context, config: Config): void {
  // Zoom the page from its first paint; the client plugin takes over this style element when it loads.
  ctx.on('webserver/index-inject', (table) => {
    const scale = config.scale.get()
    table.push({
      kind: 'script',
      placement: 'head',
      text: `globalThis.__DSH_UI_SCALE__=${scale};document.head.append(Object.assign(document.createElement('style'),{id:'dsh-ui-scale',textContent:'#root{zoom:${scale / 100}}'}))`,
    })
  })
}
