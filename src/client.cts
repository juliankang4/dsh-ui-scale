import type { Context } from '@deepseek-ai/cordis'
import type { HostObservable, InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { createElement as h, useEffect, useId, useRef, useState } from 'react'
import { installScaleShim, type ScaleShim } from './shim.cjs'

/** Locale namespace, and the settings namespace (the entry id in cordis.patch.yml). */
const NS = 'ui-scale'
const MIN = 50
const MAX = 200
const STEP = 5
const PRESETS = [100, 110, 125, 150, 175, 200]
/** Desktop window bounds in localStorage; the host half's restoreWindow reads the same key. */
const WINDOW_KEY = 'dsh-ui-scale:window'

const en = {
  title: 'Interface scale',
  description: 'Resizes the whole interface, including menus and pop-ups',
  input: 'Interface scale in percent',
  presets: 'Scale presets',
}
type ScaleKey = keyof typeof en
const zh: Record<ScaleKey, string> = {
  title: '界面缩放',
  description: '调整整个界面的大小，包括菜单和弹窗',
  input: '界面缩放百分比',
  presets: '缩放预设',
}
const ko: Record<ScaleKey, string> = {
  title: '화면 배율',
  description: '메뉴와 팝업을 포함한 화면 전체의 크기를 조절합니다',
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
  // The host half's head script installs the shim before first paint. A page loaded before the
  // plugin was enabled (Desktop collects head scripts once per start) gets it here instead.
  const shim = (globalThis as { __dshUiScale?: ScaleShim }).__dshUiScale ?? installScaleShim(100)
  ctx.effect(() => () => { shim.dispose() }, 'ui-scale: zoom')
  let scale = shim.get()
  const listeners = new Set<() => void>()
  const show = (next: number) => {
    scale = next
    shim.set(next)
    for (const listener of listeners) listener()
  }
  ctx.effect(() => {
    const style = Object.assign(document.createElement('style'), { id: 'dsh-ui-scale', textContent: rowCss })
    document.head.append(style)
    return () => { style.remove() }
  }, 'ui-scale: row styles')

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

  // Desktop opens its window at a fixed size; the host half's head script restores what is saved here.
  if (location.protocol === 'dsh-app:') ctx.effect(() => {
    const timer = setInterval(() => {
      // A full-screen size is no window size to come back to.
      if (outerWidth === screen.width && outerHeight === screen.height) return
      const bounds = JSON.stringify({ x: screenX, y: screenY, w: outerWidth, h: outerHeight })
      if (bounds !== localStorage.getItem(WINDOW_KEY)) localStorage.setItem(WINDOW_KEY, bounds)
    }, 1000)
    return () => { clearInterval(timer) }
  }, 'ui-scale: window bounds')

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
