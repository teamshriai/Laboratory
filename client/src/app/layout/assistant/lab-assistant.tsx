import { SendHorizontalIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useLanguage, useT } from '@/i18n/context'
import { createFormatter } from '@/i18n/format'
import { cn } from '@/lib/cn'
import { assistantService } from '@/services/assistant'
import type {
  AssistantIntent,
  AssistantLine,
  AssistantReply,
} from '@/services/lab-api'
import { useToday } from '@/services/queries'
import { AssistantMark } from '@/components/ui/assistant-mark'
import { IconButton } from '@/components/ui/icon-button'

/** Wide enough to dock beside the page with the full sidebar. */
const DOCK_QUERY = '(min-width: 1280px)'
const INSIGHT_KEY = 'shri-lims.assistant-insight'

type Message =
  | { id: number; role: 'user'; text: string }
  | { id: number; role: 'assistant'; reply: AssistantReply }

/** Which question an insight's priority leads to. */
const INSIGHT_INTENT: Record<string, AssistantIntent> = {
  critical: 'critical',
  qc: 'attention',
  stat: 'stat',
  overdue: 'delayed',
  transit: 'delayed',
  recollection: 'rejected',
  authorise: 'authorise',
  imaging: 'imaging',
}

function useLineText() {
  const t = useT('assistant')
  const { language } = useLanguage()
  const f = createFormatter(language)
  return (line: AssistantLine) => {
    if ('text' in line) return line.text
    const params = Object.fromEntries(
      Object.entries(line.params ?? {}).map(([k, v]) => [
        k,
        k === 'ms' && typeof v === 'number' ? f.duration(v) : v,
      ]),
    )
    return t(line.key as 'help', params)
  }
}

/**
 * The Lab Assistant (design system 13): a launcher in the corner and a
 * panel that docks beside the page on wide screens or covers it on smaller
 * ones. Answers come from `assistantService`: rules over this lab's records
 * today, a backend or AI service later.
 */
export function LabAssistant() {
  const t = useT('assistant')
  const lineText = useLineText()
  const wide = useMediaQuery(DOCK_QUERY)
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const launcher = useRef<HTMLButtonElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const log = useRef<HTMLDivElement>(null)
  const docked = open && wide
  const insight = useInsight()
  const [tipOpen, setTipOpen] = useState(false)

  // The page narrows beside a docked panel (CSS reads these attributes).
  useEffect(() => {
    const root = document.documentElement
    if (open) root.setAttribute('data-chat-open', 'true')
    if (docked) root.setAttribute('data-chat-docked', 'true')
    return () => {
      root.removeAttribute('data-chat-open')
      root.removeAttribute('data-chat-docked')
    }
  }, [open, docked])

  useEffect(() => {
    if (open) composer.current?.focus()
  }, [open])

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [messages, busy])

  const close = () => {
    setOpen(false)
    setTipOpen(false)
    // The launcher stays mounted, so focus can return to it.
    window.setTimeout(() => launcher.current?.focus(), 0)
  }

  const ask = (question: { intent?: AssistantIntent; text?: string }) => {
    const text = question.intent
      ? t(`q.${question.intent}` as 'q.attention')
      : (question.text ?? '').trim()
    if (!text || busy) return
    setMessages((m) => [...m, { id: nextId.current++, role: 'user', text }])
    setDraft('')
    setBusy(true)
    void assistantService
      .ask(question)
      .then((reply) =>
        setMessages((m) => [
          ...m,
          { id: nextId.current++, role: 'assistant', reply },
        ]),
      )
      .catch(() =>
        setMessages((m) => [
          ...m,
          {
            id: nextId.current++,
            role: 'assistant',
            reply: {
              intent: 'help',
              lines: [{ key: 'help' }],
              bullets: [],
              links: [],
            },
          },
        ]),
      )
      .finally(() => setBusy(false))
  }

  const submit = (ev: FormEvent) => {
    ev.preventDefault()
    ask({ text: draft })
  }

  const suggestions = assistantService.suggestions()

  const openPanel = () => {
    // A waiting tip shows once, as the panel's first card.
    if (insight.pending) {
      setTipOpen(true)
      insight.dismiss()
    }
    setOpen(true)
  }

  return (
    <>
      <button
        ref={launcher}
        type="button"
        aria-label={
          insight.pending ? t('launcherLabelTip') : t('launcherLabel')
        }
        aria-expanded={open}
        aria-controls="lab-assistant"
        onClick={openPanel}
        style={{ bottom: 'calc(1.25rem + var(--fab-clearance, 0px))' }}
        className={cn(
          'focus-ring fixed right-4 z-30 flex h-12 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-primary-700 shadow-card-lg transition-transform hover:scale-105 active:scale-95 md:right-5 md:border-transparent md:bg-primary-600 md:text-on-accent print:hidden',
          open && 'invisible',
        )}
      >
        <AssistantMark size={24} />
        <span aria-hidden className="pr-0.5 text-sm font-bold tracking-wide">
          {t('launcher')}
        </span>
        {insight.pending ? (
          <span
            aria-hidden
            className="absolute -top-0.5 -right-0.5 size-3 rounded-full bg-warning ring-2 ring-surface"
          />
        ) : null}
      </button>
      {open && !docked ? (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={close}
          className="fixed inset-x-0 top-[var(--header-h,4rem)] bottom-0 z-20 hidden bg-scrim sm:block"
        />
      ) : null}
      {open ? (
        <aside
          id="lab-assistant"
          aria-labelledby="lab-assistant-title"
          onKeyDown={(ev) => {
            if (ev.key === 'Escape') {
              ev.stopPropagation()
              close()
            }
          }}
          className={cn(
            'fixed top-[var(--header-h,4rem)] right-0 bottom-0 z-20 flex flex-col bg-surface print:hidden',
            docked
              ? 'w-[var(--chat-dock-w)] border-l border-line motion-safe:animate-[dock-in_200ms_var(--ease-premium)]'
              : 'w-full motion-safe:animate-[dock-in_200ms_var(--ease-premium)] sm:w-[26.25rem] sm:border-l sm:border-line sm:shadow-card-lg',
          )}
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-pastel-sky text-pastel-sky-text">
              <AssistantMark size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h2
                id="lab-assistant-title"
                className="text-sm font-semibold text-fg"
              >
                {t('title')}
              </h2>
              <p className="truncate text-xs text-fg-subtle">{t('subtitle')}</p>
            </div>
            <IconButton
              label={t('close')}
              icon={<XIcon className="size-4" />}
              onClick={close}
            />
          </header>

          <div
            ref={log}
            role="log"
            aria-live="polite"
            aria-busy={busy}
            className="min-h-0 flex-1 scrollbar-thin space-y-3 overflow-y-auto px-4 py-4"
          >
            {tipOpen && insight.top ? (
              <TipCard
                text={t(`priority.${insight.top.key}` as 'priority.critical', {
                  count: insight.top.count,
                })}
                onAsk={() => {
                  setTipOpen(false)
                  ask({
                    intent: INSIGHT_INTENT[insight.top!.key] ?? 'attention',
                  })
                }}
                onDismiss={() => setTipOpen(false)}
              />
            ) : null}
            {messages.length === 0 ? (
              <div className="grid gap-2">
                <p className="text-xs font-semibold tracking-wide text-fg-subtle uppercase">
                  {t('starters')}
                </p>
                {suggestions.map((intent) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => ask({ intent })}
                    className="focus-ring min-h-11 rounded-lg border border-line bg-surface-2 px-3 py-2 text-left text-sm text-fg transition-colors hover:border-line-strong"
                  >
                    {t(`q.${intent}` as 'q.attention')}
                  </button>
                ))}
              </div>
            ) : null}
            {messages.map((m) =>
              m.role === 'user' ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-600 px-3.5 py-2 text-sm text-on-accent">
                    <span className="sr-only">{t('you')}: </span>
                    {m.text}
                  </p>
                </div>
              ) : (
                <div key={m.id} className="flex items-start gap-2">
                  <span className="mt-1 shrink-0 text-primary-700">
                    <AssistantMark size={18} />
                  </span>
                  <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-fg">
                    {m.reply.lines.map((l, i) => (
                      <p key={i} className={i > 0 ? 'mt-1' : undefined}>
                        {lineText(l)}
                      </p>
                    ))}
                    {m.reply.bullets.length ? (
                      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-meta">
                        {m.reply.bullets.map((b, i) => (
                          <li key={i}>{lineText(b)}</li>
                        ))}
                      </ul>
                    ) : null}
                    {m.reply.intent === 'help' ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {suggestions.slice(0, 5).map((intent) => (
                          <button
                            key={intent}
                            type="button"
                            onClick={() => ask({ intent })}
                            className="focus-ring tap-reach rounded-full border border-line bg-surface px-2.5 py-1 text-xs text-fg hover:border-line-strong"
                          >
                            {t(`q.${intent}` as 'q.attention')}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {m.reply.links.length ? (
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                        {m.reply.links.map((l) => (
                          <Link
                            key={l.to}
                            to={l.to}
                            onClick={() => {
                              // Covering the page: get out of the way.
                              if (!docked) setOpen(false)
                            }}
                            className="inline-flex min-h-[24px] items-center text-meta font-semibold text-accent-text underline-offset-2 hover:underline"
                          >
                            {t(l.key as 'linkDashboard')} →
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ),
            )}
            {busy ? (
              <p className="text-xs text-fg-subtle">{t('thinking')}</p>
            ) : null}
          </div>

          <form onSubmit={submit} className="border-t border-line px-4 py-3">
            <div className="flex items-end gap-1.5 rounded-xl border border-line-strong bg-surface-2 p-1.5">
              <label htmlFor="lab-assistant-input" className="sr-only">
                {t('placeholder')}
              </label>
              <textarea
                id="lab-assistant-input"
                ref={composer}
                value={draft}
                rows={1}
                onChange={(ev) => {
                  setDraft(ev.target.value)
                  // Grow with the text, up to 128px.
                  ev.target.style.height = 'auto'
                  ev.target.style.height = `${Math.min(ev.target.scrollHeight, 128)}px`
                }}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' && !ev.shiftKey) {
                    ev.preventDefault()
                    ask({ text: draft })
                  }
                }}
                placeholder={t('placeholder')}
                className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm text-fg outline-none placeholder:text-fg-subtle"
              />
              <button
                type="submit"
                aria-label={t('send')}
                disabled={!draft.trim() || busy}
                className="focus-ring flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-600 text-on-accent transition-opacity disabled:opacity-50"
              >
                <SendHorizontalIcon className="size-4" aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-2xs text-fg-subtle">{t('disclaimer')}</p>
          </form>
        </aside>
      ) : null}
    </>
  )
}

/**
 * A tip from today's records (design system 13.3): the most urgent item,
 * once per session. It waits as a dot on the launcher and shows as the
 * panel's first card, so it never floats over the page.
 */
function useInsight() {
  const { data } = useToday()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(INSIGHT_KEY) === 'done'
    } catch {
      return false
    }
  })
  const top = data?.priorities[0]
  const dismiss = () => {
    setDismissed(true)
    try {
      sessionStorage.setItem(INSIGHT_KEY, 'done')
    } catch {
      // Tips simply return next session.
    }
  }
  return { top, pending: !dismissed && top !== undefined, dismiss }
}

function TipCard({
  text,
  onAsk,
  onDismiss,
}: {
  text: string
  onAsk: () => void
  onDismiss: () => void
}) {
  const t = useT('assistant')
  return (
    <div className="relative rounded-2xl border border-pastel-sky-text/20 bg-pastel-sky p-3 pr-11">
      <p className="text-2xs font-semibold tracking-wide text-pastel-sky-text uppercase">
        {t('insightLabel')}
      </p>
      <p className="mt-0.5 text-sm leading-snug text-fg">{text}</p>
      <button
        type="button"
        onClick={onAsk}
        className="focus-ring mt-1 inline-flex min-h-[24px] items-center rounded text-xs font-semibold text-pastel-sky-text hover:underline"
      >
        {t('insightAsk')} →
      </button>
      <button
        type="button"
        aria-label={t('insightClose')}
        onClick={onDismiss}
        className="focus-ring absolute top-0 right-0 flex size-11 items-center justify-center rounded-tr-2xl text-fg-subtle hover:text-fg"
      >
        <XIcon className="size-4" aria-hidden />
      </button>
    </div>
  )
}
