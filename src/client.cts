import type { Context } from '@deepseek-ai/cordis'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { createElement as h, useEffect, useId, useRef, useState } from 'react'

/** Locale namespace, and the settings namespace (the entry id in cordis.patch.yml). */
const NS = 'ui-scale'
const MIN = 50
const MAX = 200
const STEP = 5
const PRESETS = [100, 110, 125, 150, 175, 200]

const en = {
  title: 'Interface scale',
  description: 'Resizes everything except menus and pop-ups',
  input: 'Interface scale in percent',
  presets: 'Scale presets',
}
type ScaleKey = keyof typeof en
const zh: Record<ScaleKey, string> = {
  title: '界面缩放',
  description: '调整除菜单和弹窗以外的界面大小',
  input: '界面缩放百分比',
  presets: '缩放预设',
}
const ko: Record<ScaleKey, string> = {
  title: '화면 배율',
  description: '메뉴와 팝업을 뺀 화면 전체의 크기를 조절합니다',
  input: '화면 배율(퍼센트)',
  presets: '배율 프리셋',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'ui-scale': ScaleKey
  }
}

/**
 * Parse the percent field: numbers round to a whole percent, out-of-range values clamp, anything else is rejected.
 * @returns the scale to apply, or undefined to revert the field.
 */
export function parseScale(text: string): number | undefined {
  const trimmed = text.trim().replace(/\s*%$/, '')
  const value = Number(trimmed)
  if (trimmed === '' || !Number.isFinite(value)) return undefined
  return Math.min(MAX, Math.max(MIN, Math.round(value)))
}

// dsh sizes and places overlays (menus, tooltips, hover cards) from getBoundingClientRect, which
// is off by the zoom factor inside a zoomed element. So only the app root and full-window modal
// layers (Settings, dialogs) are zoomed: overlays portaled to <body> stay at 100%, inline tooltips
// and menus are zoomed back to 100%, and modal dialogs are capped to the window because their
// viewport-unit sizes grow with the zoom.
const LAYERS = '#root,body>[role="presentation"]:has(>[aria-modal="true"])'
const zoomCss = (scale: number) => scale === 100 ? '' : `${LAYERS}{zoom:${scale / 100}}`
  + `:is(${LAYERS}) :is([role="tooltip"],[data-menu-material]):not([data-menu-material] *){zoom:${100 / scale}}`
  + `body>[role="presentation"]>[aria-modal="true"]{max-width:100%;max-height:100%}`

const rowCss = `
.dsh-ui-scale{display:flex;flex-direction:column;gap:12px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dsh-ui-scale-head{display:flex;align-items:center;gap:8px}
.dsh-ui-scale-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;padding-right:48px}
.dsh-ui-scale-title{font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
.dsh-ui-scale-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dsh-ui-scale-field{display:inline-flex;align-items:center;gap:8px;font-size:14px;line-height:22px;color:var(--dsw-alias-label-secondary)}
.dsh-ui-scale-field input{box-sizing:border-box;width:72px;height:36px;padding:0 8px;border:none;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);font:inherit;text-align:center;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary)}
.dsh-ui-scale-controls{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px}
.dsh-ui-scale-controls>input{flex:1 1 160px;min-width:0;height:32px;margin:0;accent-color:var(--dsw-alias-label-primary);cursor:pointer}
.dsh-ui-scale-presets{display:flex;flex-wrap:wrap;gap:4px}
.dsh-ui-scale-presets button{height:28px;padding:0 8px;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);background:transparent;font:inherit;font-size:12px;font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);cursor:pointer}
.dsh-ui-scale-presets button:hover:not([aria-pressed="true"]){background:var(--dsw-alias-interactive-bg-hover)}
.dsh-ui-scale-presets button[aria-pressed="true"]{background:var(--dsw-alias-bg-module-platform);border-color:var(--dsw-static-neutral-bluish-400)}
`

interface RowInjected {
  hooks: { scale: HostObservable<number> }
  setScale: (scale: number) => void
}

type RowProps = PropsRuntime<'settings.general.item'> & PropsLocale<'ui-scale'> & InjectFace<RowInjected>

function ScaleRow({ t, useScale, setScale }: RowProps) {
  const scale = useScale(value => value)
  // Slider position while dragging; applied on release so the slider does not move under the pointer.
  const [dragged, setDragged] = useState<number>()
  // Field text while editing; applied on Enter or blur.
  const [text, setText] = useState<string>()
  const row = useRef<HTMLDivElement>(null)
  const slider = useRef<HTMLInputElement>(null)
  const id = useId()
  const shown = dragged ?? scale
  // The value the slider rests on (the range input snaps an off-step scale to its step).
  const resting = MIN + Math.round((scale - MIN) / STEP) * STEP

  // Zooming shifts the scrolled Settings content, so bring this row back into view.
  const change = (next: number) => {
    setScale(next)
    requestAnimationFrame(() => { row.current?.scrollIntoView({ block: 'nearest' }) })
  }

  // The native `change` event fires on pointer release and on each keyboard step;
  // React's onChange is the `input` event, which also fires during a drag.
  useEffect(() => {
    const input = slider.current
    if (input === null) return
    const commit = () => {
      setDragged(undefined)
      change(Number(input.value))
    }
    input.addEventListener('change', commit)
    return () => { input.removeEventListener('change', commit) }
  })

  const commitText = () => {
    if (text === undefined) return
    const parsed = parseScale(text)
    setText(undefined)
    if (parsed !== undefined) change(parsed)
  }

  return h('div', { ref: row, className: 'dsh-ui-scale' },
    h('div', { className: 'dsh-ui-scale-head' },
      h('div', { className: 'dsh-ui-scale-text' },
        h('div', { id: `${id}title`, className: 'dsh-ui-scale-title' }, t('title')),
        h('div', { id: `${id}desc`, className: 'dsh-ui-scale-desc' }, t('description'))),
      h('label', { className: 'dsh-ui-scale-field' },
        h('input', {
          type: 'text',
          inputMode: 'numeric',
          'aria-label': t('input'),
          value: text ?? String(shown),
          onChange: event => { setText(event.target.value) },
          onBlur: commitText,
          onKeyDown: (event) => { if (event.key === 'Enter') commitText() },
        }),
        h('span', { 'aria-hidden': true }, '%'))),
    h('div', { className: 'dsh-ui-scale-controls' },
      h('input', {
        ref: slider,
        type: 'range',
        min: MIN,
        max: MAX,
        step: STEP,
        value: shown,
        'aria-labelledby': `${id}title`,
        'aria-describedby': `${id}desc`,
        'aria-valuetext': `${shown}%`,
        // A drag that returns to the resting value fires no `change`, so it must not leave a stale position.
        onChange: (event) => {
          const value = Number(event.target.value)
          setDragged(value === resting ? undefined : value)
        },
      }),
      h('div', { role: 'group', 'aria-label': t('presets'), className: 'dsh-ui-scale-presets' },
        PRESETS.map(preset => h('button', {
          key: preset,
          type: 'button',
          'aria-pressed': preset === scale,
          onClick: () => { change(preset) },
        }, `${preset}%`)))))
}

export const inject = ['slots', 'locale', 'configForms']

export function apply(ctx: Context): void {
  const boot = (globalThis as { __DSH_UI_SCALE__?: unknown }).__DSH_UI_SCALE__
  let scale = typeof boot === 'number' ? parseScale(String(boot)) ?? 100 : 100
  const listeners = new Set<() => void>()
  const style = document.getElementById('dsh-ui-scale') ?? Object.assign(document.createElement('style'), { id: 'dsh-ui-scale' })
  const show = (next: number) => {
    scale = next
    style.textContent = zoomCss(next) + rowCss
    for (const listener of listeners) listener()
  }
  show(scale)
  ctx.effect(() => {
    document.head.append(style)
    return () => { style.remove() }
  }, 'ui-scale: styles')

  const form = ctx.configForms.get<{ scale: number }>(NS)
  // Host reads that land between quick writes carry older values; adopt only once our writes settle.
  let writing = 0
  const adopt = () => {
    if (writing > 0) return
    const stored = form.getSnapshot().value?.scale
    if (stored !== undefined && stored !== scale) show(stored)
  }
  ctx.effect(() => form.subscribe(adopt), 'ui-scale: settings')
  adopt()

  const setScale = (next: number) => {
    if (next === scale) return
    show(next)
    writing += 1
    // A rejected write falls back to the stored value; on pages without Host persistence the new scale stays.
    form.set('scale', next).catch(() => {}).finally(() => {
      writing -= 1
      adopt()
    })
  }
  const scaleSource: HostObservable<number> = {
    getSnapshot: () => scale,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }

  ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'ui-scale: en/zh strings')
  ctx.effect(() => ctx.locale.register(NS, 'ko', ko), 'ui-scale: ko strings')
  ctx.slots.inject('settings.general.item', () => ctx.slots.register({
    name: 'settings.general.item',
    id: 'ui-scale',
    order: 11.5,
    locale: NS,
    inject: (): RowInjected => ({ hooks: { scale: scaleSource }, setScale }),
  }, ScaleRow))
}
