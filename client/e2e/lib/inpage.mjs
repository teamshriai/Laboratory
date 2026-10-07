// Helpers installed in every page (through an init script, so the page's
// Content-Security-Policy does not apply) as window.__e2e. Everything here
// runs in the browser: it must not refer to anything outside the function.

/* global window, document, getComputedStyle, CSS */

export function installHelpers() {
  const OVERLAY =
    '[role=dialog], [role=alertdialog], [role=menu], [role=listbox], [data-radix-popper-content-wrapper]'
  const FOCUSABLE =
    'button:not([disabled]), a[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable=true]'

  const clean = (s) =>
    String(s ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)

  function visible(el) {
    if (!el || !el.isConnected) return false
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    if (el.checkVisibility)
      return el.checkVisibility({
        opacityProperty: true,
        visibilityProperty: true,
      })
    return true
  }

  function name(el) {
    if (!el) return ''
    const by = el.getAttribute('aria-labelledby')
    if (by) {
      const t = by
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
      if (clean(t)) return clean(t)
    }
    const label = el.getAttribute('aria-label')
    if (label) return clean(label)
    if (el.labels && el.labels.length) return clean(el.labels[0].textContent)
    const text = clean(el.innerText || el.textContent)
    if (text) return text
    const title = el.getAttribute('title') || el.getAttribute('placeholder')
    if (title) return clean(title)
    const inner = el.querySelector('[aria-label]')
    return inner ? clean(inner.getAttribute('aria-label')) : ''
  }

  function role(el) {
    const r = el.getAttribute('role')
    if (r) return r
    const tag = el.tagName.toLowerCase()
    if (tag === 'a' && el.hasAttribute('href')) return 'link'
    if (tag === 'input') return `input[${el.type}]`
    return tag
  }

  function describe(el) {
    if (!el) return '(none)'
    if (el === document.body) return '<body>'
    if (el === document.documentElement) return '<html>'
    const n = name(el)
    const id = el.id ? `#${el.id}` : ''
    return n
      ? `${role(el)} "${n}"`
      : `${role(el)}${id || '.' + clean(el.className).split(' ')[0]}`
  }

  function overlays() {
    const found = []
    for (const node of document.querySelectorAll(OVERLAY)) {
      let el = node
      if (node.hasAttribute('data-radix-popper-content-wrapper')) {
        if (node.querySelector('[role=tooltip]')) continue
        el = node.firstElementChild
      }
      if (!el || !visible(el)) continue
      if (el.getAttribute('data-state') === 'closed') continue
      found.push(el)
    }
    // Keep the outermost of nested ones (a listbox inside a dialog).
    return found.filter((a) => !found.some((b) => b !== a && b.contains(a)))
  }

  function overlayName(el) {
    const by = el.getAttribute('aria-labelledby')
    const label = el.getAttribute('aria-label')
    const titleEl = by ? document.getElementById(by.split(' ')[0]) : null
    const title = titleEl ? titleEl.innerText || titleEl.textContent : label
    const kind = el.getAttribute('role') || 'popover'
    const heading = el.querySelector('h1,h2,h3')
    return `${kind} "${clean(title || heading?.innerText || '').slice(0, 60)}"`
  }

  function markOverlays() {
    for (const el of overlays()) el.setAttribute('data-e2e-seen', '')
  }

  function newOverlays() {
    return overlays().filter((el) => !el.hasAttribute('data-e2e-seen'))
  }

  function bottomNavTop() {
    const nav = document.querySelector('nav.bottom-nav')
    if (!nav || !visible(nav)) return Infinity
    return nav.getBoundingClientRect().top
  }

  function pageState() {
    const se = document.scrollingElement
    const over = se.scrollWidth - window.innerWidth
    let culprit = ''
    if (over > 1) {
      // The deepest element that sticks out is the most useful lead.
      for (const el of document.querySelectorAll('body *')) {
        const r = el.getBoundingClientRect()
        if (
          r.right > window.innerWidth + 1 &&
          r.width > 0 &&
          getComputedStyle(el).position !== 'fixed'
        )
          culprit = `${describe(el)} .${clean(el.className).slice(0, 60)}`
      }
    }
    const text = document.body.innerText || ''
    const h1 = document.querySelector('h1')
    return {
      url: location.pathname + location.search,
      overflow: over,
      culprit,
      h1: h1 ? clean(h1.textContent) : '',
      boundary: /something went wrong|this record could not be shown/i.test(
        text,
      ),
      loadError: /we could not load this/i.test(text),
      notFoundPage: /page not found/i.test(h1?.textContent ?? ''),
      skeletons: [...document.querySelectorAll('.skeleton')].filter(visible)
        .length,
    }
  }

  /** At the end of the page, the content must clear the bottom bar and the AI launcher. */
  async function coveredAtEnd() {
    const se = document.scrollingElement
    const main =
      document.querySelector('#main > div') || document.querySelector('main')
    if (!main) return ''
    const fab = document.querySelector('button[aria-controls="lab-assistant"]')
    window.scrollTo(0, se.scrollHeight)
    await new Promise((r) => setTimeout(r, 120))
    // The last visible thing in the content, not the padded wrapper.
    let bottom = 0
    for (const el of main.querySelectorAll('*')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      if (r.bottom > bottom && getComputedStyle(el).position !== 'fixed')
        bottom = r.bottom
    }
    const navTop = bottomNavTop()
    const fabTop =
      fab && visible(fab) ? fab.getBoundingClientRect().top : Infinity
    window.scrollTo(0, 0)
    if (bottom > navTop + 1)
      return `content ends ${Math.round(bottom - navTop)}px under the bottom navigation bar`
    if (bottom > fabTop + 1)
      return `content ends ${Math.round(bottom - fabTop)}px under the AI launcher`
    return ''
  }

  /** Buttons, tabs and menu triggers to click, marked data-e2e-c="<i>". */
  function collect(scopes, destructive) {
    const bad = new RegExp(destructive, 'i')
    const out = []
    const seenTables = new Set()
    for (const el of document.querySelectorAll('[data-e2e-c]'))
      el.removeAttribute('data-e2e-c')
    for (const scopeSel of scopes) {
      for (const scope of document.querySelectorAll(scopeSel)) {
        const nodes = scope.querySelectorAll(
          'button, [role=tab], [role=button], [aria-haspopup]:not(a), [role=combobox], [role=switch]',
        )
        for (const el of nodes) {
          if (el.closest(OVERLAY)) continue
          if (el.disabled || el.getAttribute('aria-disabled') === 'true')
            continue
          if (el.closest('[inert], [aria-hidden=true]')) continue
          const n = name(el)
          if (bad.test(n)) continue
          let key
          const cell = el.closest('td, [role=cell], [role=gridcell]')
          if (!visible(el)) {
            // DataTable's visually hidden "Open <row>" button (in a table,
            // or in the stacked records on phones): one per visible list.
            if (!el.hasAttribute('data-row-open')) continue
            const list =
              el.closest('table, ul, ol, [role=list]') ?? el.parentElement
            if (!visible(list) || seenTables.has(list)) continue
            seenTables.add(list)
            key = `row-open:${seenTables.size}`
          } else if (/^(radio|tab|menuitemradio)$/.test(role(el))) {
            // Filter chips and tabs: one unselected option per group (the
            // tab URLs have their own route-sweep entries).
            if (
              el.getAttribute('aria-checked') === 'true' ||
              el.getAttribute('aria-selected') === 'true'
            )
              continue
            const group = el.closest('[role=radiogroup], [role=tablist]')
            const groups = [
              ...document.querySelectorAll('[role=radiogroup], [role=tablist]'),
            ]
            key = `${role(el)}:group:${group ? name(group) || groups.indexOf(group) : n}`
          } else {
            const generic = n
              .replace(/[A-Z]{2,}-?\d[\w-]*/g, '#')
              .replace(/\d+/g, '#')
              .toLowerCase()
            key = `${role(el)}:${generic}${cell ? ':in-row' : ''}`
          }
          if (out.some((c) => c.key === key)) continue
          const i = out.length
          el.setAttribute('data-e2e-c', String(i))
          out.push({
            i,
            key,
            name: n,
            role: role(el),
            hidden: key.startsWith('row-open'),
            haspopup: el.getAttribute('aria-haspopup') || '',
            inHeader: Boolean(el.closest('header, nav.bottom-nav')),
          })
        }
      }
    }
    return out
  }

  /** Resolves once the element's (finite) animations have finished. */
  async function settleAnimations(el, ms = 1500) {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()))
    const finite = (el ?? document.body)
      .getAnimations({ subtree: true })
      .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
    await Promise.race([
      Promise.all(finite.map((a) => a.finished.catch(() => {}))),
      new Promise((r) => setTimeout(r, ms)),
    ])
    await frame()
    await frame()
  }

  function checkOverlay(el) {
    const issues = []
    const vw = window.innerWidth
    const vh = window.innerHeight
    const r = el.getBoundingClientRect()
    const label = overlayName(el)
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1)
      issues.push(
        `${label} does not fit the ${vw}x${vh} viewport (box ${Math.round(r.left)},${Math.round(r.top)} - ${Math.round(r.right)},${Math.round(r.bottom)})`,
      )
    const focusables = [...el.querySelectorAll(FOCUSABLE)].filter(visible)
    const last = focusables.at(-1)
    if (last) {
      last.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const lr = last.getBoundingClientRect()
      const navTop = bottomNavTop()
      if (
        lr.bottom > vh + 1 ||
        lr.top < -1 ||
        lr.right > vw + 1 ||
        lr.left < -1
      )
        issues.push(
          `${label}: last control ${describe(last)} cannot be scrolled into view (box ${Math.round(lr.left)},${Math.round(lr.top)} - ${Math.round(lr.right)},${Math.round(lr.bottom)})`,
        )
      else {
        const cx = Math.min(vw - 1, Math.max(0, lr.left + lr.width / 2))
        const cy = Math.min(vh - 1, Math.max(0, lr.top + lr.height / 2))
        const hit = document.elementFromPoint(cx, cy)
        if (
          hit &&
          !(hit === last || last.contains(hit) || hit.contains(last))
        ) {
          const nav = hit.closest('nav.bottom-nav')
          issues.push(
            `${label}: last control ${describe(last)} is covered by ${nav ? 'the bottom navigation bar' : describe(hit)}`,
          )
        } else if (
          lr.bottom > navTop + 1 &&
          !el.contains(document.elementFromPoint(cx, navTop + 2))
        )
          issues.push(
            `${label}: last control ${describe(last)} sits under the bottom navigation bar`,
          )
      }
    }
    return { label, issues }
  }

  function focusReport() {
    const active = document.activeElement
    const trigger = document.querySelector('[data-e2e-trigger]')
    if (
      !active ||
      active === document.body ||
      active === document.documentElement
    )
      return {
        ok: false,
        symptom: 'focus lost to <body> after Escape',
        on: describe(active),
      }
    if (
      trigger &&
      (active === trigger ||
        trigger.contains(active) ||
        active.contains(trigger))
    )
      return { ok: true, on: describe(active) }
    const inOverlay = active.closest(OVERLAY)
    if (inOverlay && visible(inOverlay))
      return { ok: true, on: describe(active) }
    if (trigger && trigger.isConnected && visible(trigger))
      return {
        ok: false,
        symptom: `focus went to ${describe(active)} instead of back to the trigger`,
        on: describe(active),
      }
    return { ok: true, on: describe(active) }
  }

  /** Disabled GuardedButtons (the wrapper span carries the tooltip). */
  function guarded() {
    const out = []
    for (const span of document.querySelectorAll('main span[tabindex="0"]')) {
      const btn = span.querySelector(':scope > button:disabled')
      if (!btn || !visible(span)) continue
      span.setAttribute('data-e2e-g', String(out.length))
      out.push({ i: out.length, name: name(btn) })
    }
    return out
  }

  function tooltipText() {
    const parts = []
    for (const node of document.querySelectorAll(
      '[role=tooltip], [data-radix-popper-content-wrapper]',
    )) {
      const el = node.hasAttribute('data-radix-popper-content-wrapper')
        ? node.firstElementChild
        : node
      if (el && visible(el)) parts.push(clean(el.innerText || el.textContent))
    }
    return parts.filter(Boolean).join(' | ')
  }

  /** Resting focus-related styles of every focusable element, before any focus. */
  const STYLE_PROPS = [
    'outlineStyle',
    'outlineWidth',
    'outlineColor',
    'outlineOffset',
    'boxShadow',
    'borderTopColor',
    'borderBottomColor',
    'backgroundColor',
    'color',
    'textDecorationLine',
  ]
  function styleOf(el) {
    const chain = []
    let node = el
    for (let i = 0; i < 4 && node && node !== document.body; i += 1) {
      const s = getComputedStyle(node)
      chain.push(STYLE_PROPS.map((p) => s[p]).join('|'))
      // Pseudo-element rings (::after) are a common focus treatment.
      const after = getComputedStyle(node, '::after')
      chain.push(
        `${after.boxShadow}|${after.outlineStyle}|${after.borderTopColor}|${after.content}`,
      )
      node = node.parentElement
    }
    return chain.join('/')
  }
  let resting = new WeakMap()
  function snapshotResting() {
    resting = new WeakMap()
    for (const el of document.querySelectorAll(FOCUSABLE))
      resting.set(el, styleOf(el))
  }
  function focusState() {
    const el = document.activeElement
    if (!el || el === document.body || el === document.documentElement)
      return { body: true, desc: describe(el) }
    if (!el.hasAttribute('data-e2e-f'))
      el.setAttribute('data-e2e-f', String(Math.random()).slice(2, 10))
    const r = el.getBoundingClientRect()
    const before = resting.get(el)
    const now = styleOf(el)
    return {
      body: false,
      id: el.getAttribute('data-e2e-f'),
      desc: describe(el),
      visible: r.width > 0 && r.height > 0,
      known: before !== undefined,
      indicator: before === undefined ? null : before !== now,
      inMain: Boolean(el.closest('main')),
      inOverlay: Boolean(el.closest(OVERLAY)),
      isSkip: el.tagName === 'A' && el.getAttribute('href') === '#main',
      skipVisible: el.tagName === 'A' && r.width > 4 && r.height > 4,
      isMain: el.id === 'main',
    }
  }

  /** Toasts not yet marked as seen (the DOM belongs to sonner: only mark it). */
  function toasts(type = null) {
    return [...document.querySelectorAll('[data-sonner-toast]:not([data-e2e-seen])')]
      .filter((t) => !type || t.getAttribute('data-type') === type)
      .map((t) => ({
        type: t.getAttribute('data-type'),
        text: clean(t.innerText).slice(0, 200),
      }))
  }
  function markToasts() {
    for (const t of document.querySelectorAll('[data-sonner-toast]')) t.setAttribute('data-e2e-seen', '')
  }
  // Print emulation: the app listens for beforeprint/afterprint.
  window.print = () => {
    window.__e2ePrinted = (window.__e2ePrinted || 0) + 1
    window.dispatchEvent(new Event('beforeprint'))
    setTimeout(() => window.dispatchEvent(new Event('afterprint')), 50)
  }

  window.__e2e = {
    toasts,
    markToasts,
    OVERLAY,
    visible,
    name,
    describe,
    overlays,
    overlayName,
    markOverlays,
    newOverlays,
    pageState,
    coveredAtEnd,
    collect,
    checkOverlay,
    settleAnimations,
    focusReport,
    guarded,
    tooltipText,
    snapshotResting,
    focusState,
  }
}
