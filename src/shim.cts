// Page zoom for a renderer that offers none. The document gets CSS zoom, and what standardized
// zoom leaves in window pixels (element rects, window size, pointer coordinates, hit tests,
// viewport units, media query bounds) is converted to the zoomed CSS pixels layout uses. Page
// code then measures and places things as it would under browser zoom.
//
// The host injects the source of both functions as a head script, so they must stay
// self-contained apart from installScaleShim calling scaleViewportUnits.

/** Divide the viewport units in a CSS value by the scale variable; strings and url() stay as they are. */
export function scaleViewportUnits(value: string): string {
  return value.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|url\(\s*(?:"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|(?:[^)\\]|\\.)*)\s*\))|(?<![\w.-])(-?\d*\.?\d+)([sld]?v(?:w|h|i|b|min|max))\b/g,
    (match, kept: string | undefined, n: string, unit: string) => kept ?? `calc(${n}${unit} / var(--dsh-ui-scale, 1))`,
  )
}

export interface ScaleShim {
  get(): number
  set(scale: number): void
  /** Undo every change the shim made to the page. */
  dispose(): void
}

export function installScaleShim(initial: number): ScaleShim {
  let z = 1
  const undo: (() => void)[] = []
  const style = document.createElement('style')

  const patch = <T extends object>(owner: T, name: keyof T & string, descriptor: PropertyDescriptor) => {
    const original = Object.getOwnPropertyDescriptor(owner, name)!
    Object.defineProperty(owner, name, { ...original, ...descriptor })
    undo.push(() => { Object.defineProperty(owner, name, original) })
  }

  const rect = (r: DOMRect) => z === 1 ? r : new DOMRect(r.x / z, r.y / z, r.width / z, r.height / z)
  for (const proto of [Element.prototype, Range.prototype] as (Element | Range)[]) {
    const one = proto.getBoundingClientRect
    const all = proto.getClientRects
    patch(proto, 'getBoundingClientRect', { value(this: Element & Range) { return rect(one.call(this)) } })
    patch(proto, 'getClientRects', {
      value(this: Element & Range) {
        const list = all.call(this)
        if (z === 1) return list
        const rects = Array.from(list, rect)
        return Object.setPrototypeOf(Object.assign(rects, { item: (i: number) => rects[i] ?? null }), DOMRectList.prototype)
      },
    })
  }

  const owner = (target: object, name: string) => {
    let found: object | null = target
    while (found !== null && !Object.hasOwn(found, name)) found = Object.getPrototypeOf(found)
    return found
  }
  // Converts a numeric getter, and the matching setter back to window pixels when `from` is given.
  const convert = (target: object, names: string[], to: (this: unknown, value: number) => number, from?: (this: unknown, value: number) => number) => {
    for (const name of names) {
      const found = owner(target, name)
      const { get, set } = found === null ? {} : Object.getOwnPropertyDescriptor(found, name)!
      if (get === undefined) continue
      patch(found!, name as never, {
        get(this: unknown) { return to.call(this, get.call(this) as number) },
        ...from !== undefined && set !== undefined ? { set(this: unknown, value: number) { set.call(this, from.call(this, value)) } } : {},
      })
    }
  }
  convert(window, ['innerWidth', 'innerHeight'], value => value / z)
  // The element that stands for the viewport reports window pixels for its size and scrolling:
  // the root (the body in quirks mode) for its client size, the scrolling element for the rest.
  const viewport = (element: unknown) => element === (document.compatMode === 'BackCompat' ? document.body : document.documentElement)
  const scroller = (element: unknown) => element !== null && element === document.scrollingElement
  convert(Element.prototype, ['clientWidth', 'clientHeight'], function (value) { return viewport(this) ? value / z : value })
  convert(Element.prototype, ['scrollWidth', 'scrollHeight', 'scrollTop', 'scrollLeft'],
    function (value) { return scroller(this) ? value / z : value },
    function (value) { return scroller(this) ? value * z : value })
  convert(window, ['scrollX', 'scrollY', 'pageXOffset', 'pageYOffset'], value => value / z)
  const toWindow = (args: unknown[]) => {
    const [x, y] = args
    if (typeof x !== 'object' || x === null) return args.length < 2 ? args : [Number(x) * z, Number(y) * z]
    // Read the members directly: scroll options may come from a prototype or getters (a DOMRect).
    const { left, top, behavior } = x as ScrollToOptions
    return [{
      ...left === undefined ? {} : { left: left * z },
      ...top === undefined ? {} : { top: top * z },
      ...behavior === undefined ? {} : { behavior },
    }]
  }
  for (const name of ['scroll', 'scrollTo', 'scrollBy'] as const) {
    for (const [target, applies] of [[window, () => true], [Element.prototype, scroller]] as const) {
      const found = owner(target, name)
      const original = found === null ? undefined : (found as Record<string, unknown>)[name]
      if (typeof original !== 'function') continue
      patch(found!, name as never, { value(this: unknown, ...args: unknown[]) { return original.apply(this, applies(this) ? toWindow(args) : args) } })
    }
  }
  convert(VisualViewport.prototype, ['width', 'height', 'offsetLeft', 'offsetTop', 'pageLeft', 'pageTop'], value => value / z)
  // Events created by page code already carry the CSS pixels it computed.
  convert(MouseEvent.prototype, ['clientX', 'clientY', 'pageX', 'pageY', 'x', 'y', 'offsetX', 'offsetY', 'movementX', 'movementY'],
    function (this: unknown, value) { return (this as Event).isTrusted ? value / z : value })
  // Canvas content such as PDF pages renders at the sharper ratio, as under browser zoom.
  convert(window, ['devicePixelRatio'], value => value * z)

  // Hit tests take window pixels; callers now pass CSS pixels.
  for (const name of ['elementFromPoint', 'elementsFromPoint', 'caretRangeFromPoint', 'caretPositionFromPoint'] as const) {
    const original = (Document.prototype as unknown as Record<string, unknown>)[name]
    if (typeof original !== 'function') continue
    patch(Document.prototype, name as never, { value(this: Document, x: number, y: number) { return original.call(this, x * z, y * z) } })
  }

  // Viewport units resolve before zoom, so 100vw would be z windows wide. Style sheet and inline
  // values are divided by a variable, which follows later scale changes. Media queries see the
  // real window, so their pixel bounds are multiplied instead, from the original text on each change.
  const scaleDeclarations = (declarations: CSSStyleDeclaration, keep: (name: string, value: string, next: string, priority: string) => void) => {
    for (const name of Array.from(declarations)) {
      const value = declarations.getPropertyValue(name)
      // Our own writes come back through the observer; converted values are left alone.
      const next = value.includes('--dsh-ui-scale') ? value : scaleViewportUnits(value)
      if (next === value) continue
      const priority = declarations.getPropertyPriority(name)
      declarations.setProperty(name, next, priority)
      keep(name, value, next, priority)
    }
  }
  const seen = new WeakSet<CSSStyleSheet>()
  const media = new Map<CSSMediaRule, string>()
  const bound = (rule: CSSMediaRule, text: string) => {
    const next = text.replace(/(\d*\.?\d+)px/g, (_, n: string) => `${Number(n) * z}px`)
    if (rule.media.mediaText !== next) rule.media.mediaText = next
  }
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      const declarations = (rule as Partial<CSSStyleRule>).style
      if (declarations !== undefined) {
        scaleDeclarations(declarations, (name, value, _, priority) => {
          undo.push(() => { declarations.setProperty(name, value, priority) })
        })
      }
      if (rule instanceof CSSMediaRule && /\dpx/.test(rule.media.mediaText)) {
        const text = rule.media.mediaText
        media.set(rule, text)
        bound(rule, text)
        undo.push(() => { rule.media.mediaText = text })
      }
      const nested = (rule as Partial<CSSGroupingRule>).cssRules
      if (nested !== undefined) walk(nested)
    }
  }
  const scan = () => {
    for (const sheet of Array.from(document.styleSheets)) {
      if (seen.has(sheet) || sheet.ownerNode === style) continue
      try {
        walk(sheet.cssRules)
        seen.add(sheet)
      } catch {
        // A sheet that is still loading throws; its load event scans again.
      }
    }
  }
  // Inline styles are rewritten when set and when their element joins the page.
  // Each converted inline value is restored on dispose unless page code has replaced it since.
  // Weak references let removed elements go.
  const converted = new Set<WeakRef<CSSStyleDeclaration>>()
  const originals = new WeakMap<CSSStyleDeclaration, Map<string, { value: string, next: string, priority: string }>>()
  const inline = (element: Element) => {
    if (!(element instanceof HTMLElement || element instanceof SVGElement)) return
    const declarations = element.style
    scaleDeclarations(declarations, (name, value, next, priority) => {
      let own = originals.get(declarations)
      if (own === undefined) {
        originals.set(declarations, own = new Map())
        converted.add(new WeakRef(declarations))
      }
      own.set(name, { value, next, priority })
    })
  }
  const sheetNode = (node: Node) => node.nodeName === 'STYLE' || node.nodeName === 'LINK'
  const observer = new MutationObserver((records) => {
    let sheets = false
    for (const r of records) {
      if (r.type === 'attributes') inline(r.target as Element)
      sheets ||= sheetNode(r.target)
      for (const node of Array.from(r.addedNodes)) {
        sheets ||= sheetNode(node)
        if (!(node instanceof Element)) continue
        if (node.hasAttribute('style')) inline(node)
        node.querySelectorAll('[style]').forEach(inline)
      }
    }
    if (sheets) scan()
  })
  observer.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] })
  document.querySelectorAll('[style]').forEach(inline)
  document.addEventListener('load', scan, true)
  undo.push(() => {
    observer.disconnect()
    document.removeEventListener('load', scan, true)
    style.remove()
    for (const ref of converted) {
      const declarations = ref.deref()
      for (const [name, { value, next, priority }] of declarations === undefined ? [] : originals.get(declarations)!) {
        if (declarations!.getPropertyValue(name) === next) declarations!.setProperty(name, value, priority)
      }
    }
  })

  const set = (scale: number) => {
    z = scale / 100
    style.textContent = z === 1 ? '' : `html{zoom:${z};--dsh-ui-scale:${z}}`
    for (const [rule, text] of media) bound(rule, text)
    scan()
    // Overlays re-place themselves on resize.
    window.dispatchEvent(new Event('resize'))
  }
  const global = globalThis as { __dshUiScale?: ScaleShim }
  const shim: ScaleShim = {
    get: () => z * 100,
    set,
    dispose: () => {
      set(100)
      for (const step of undo.reverse()) step()
      delete global.__dshUiScale
    },
  }
  global.__dshUiScale = shim
  document.head.append(style)
  set(initial)
  return shim
}
