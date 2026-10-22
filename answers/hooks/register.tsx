import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { AnswerEntry } from '../types'

const PANE = 'answers'
const MAX_ITEMS = 400
const MAX_TEXT = 200

const items = atom({ plugin: 'answers', key: 'items' } as const, [])
const showAll = atom({ plugin: 'answers', key: 'showAll' } as const, false)
const pulled = atom({ plugin: 'answers', key: 'pulled' } as const, false)

/** The first line of a message that carries words, markdown marks stripped. */
const firstLine = (text: string): string => {
  for (const raw of text.split('\n')) {
    const line = raw
      .replace(/^[\s#>*\-•`|]+/, '')
      .replace(/\*\*|__|`/g, '')
      .trim()
    if (line) return line.slice(0, MAX_TEXT)
  }
  return ''
}

const clip = (text: string, width: number): string =>
  text.length > width ? `${text.slice(0, Math.max(1, width - 1))}…` : text

const hhmm = (at: number): string => {
  const d = new Date(at)
  try {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  } catch {
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
}

/** Marks the closing assistant row(s) of one loop's last turn as its final answer. */
const markFinal = (list: AnswerEntry[], answer: string | null, agentId: string | undefined): AnswerEntry[] => {
  let last = list.length - 1
  while (last >= 0 && list[last]?.agentId !== agentId) last--
  const lastRow = list[last]
  if (lastRow === undefined || lastRow.role !== 'assistant' || lastRow.isFinal) return list
  const next = list.slice()
  next[last] = { ...lastRow, isFinal: true }
  // Earlier blocks of the same final message, when the answer's text carries them.
  const plain = answer?.replace(/\*\*|__|`/g, '') ?? null
  for (let i = last - 1; i >= 0 && plain !== null; i--) {
    const row = next[i]
    if (row === undefined) break
    if (row.agentId !== agentId) continue // another loop's row, interleaved
    if (row.role !== 'assistant') break
    if (!plain.includes(row.text.slice(0, 40))) break
    next[i] = { ...row, isFinal: true }
  }
  return next
}

/** Keeps the last MAX_ITEMS rows of one loop, every other loop's untouched. */
const capLoop = (list: AnswerEntry[], agentId: string | undefined): AnswerEntry[] => {
  let extra = list.filter(row => row.agentId === agentId).length - MAX_ITEMS
  return extra <= 0 ? list : list.filter(row => row.agentId !== agentId || extra-- <= 0)
}

/** A history row's id until the transcript draws the row and `adopt` learns the real one. */
const isPlaceholder = (id: string): boolean => id.startsWith('history:')

/**
 * Indexes the main conversation's history once, while nothing of it is
 * indexed yet: a resumed session, a plugin installed mid-session. The rows
 * come without ids or times (`$.session.messages` has neither); `adopt` gives
 * each its id once the transcript draws it, and until then a jump is refused.
 */
const backfill = async ($: EngineInterface): Promise<number> => {
  if (await read($, pulled)) return 0
  if ((await read($, items)).some(row => row.agentId === undefined)) return 0
  let list: AnswerEntry[] = []
  for (const m of await $.session.messages()) {
    // ponytail: tool results and the engine's framing (<command-name>, <local-command-stdout>) are told by shape
    if (m.toolResults?.length || m.text.startsWith('<')) continue
    const text = firstLine(m.text)
    if (!text) continue
    if (m.role === 'user') list = markFinal(list, null, undefined)
    list.push({ id: `history:${list.length}`, role: m.role, text, at: 0, isFinal: false, onScreen: false })
  }
  if (list.length === 0) return 0
  const history = capLoop(markFinal(list, null, undefined), undefined)
  await update($, items, cur => (cur.some(row => row.agentId === undefined) ? cur : [...history, ...cur]))
  await update($, pulled, () => true)
  return history.length
}

/** Gives a history row its transcript id once the transcript draws the row: matched by role and first line. */
const adopt = async (
  $: EngineInterface,
  role: AnswerEntry['role'],
  id: string,
  text: string,
): Promise<AnswerEntry | undefined> => {
  const line = firstLine(text)
  const row = (await read($, items)).find(
    x => isPlaceholder(x.id) && x.agentId === undefined && x.role === role && x.text === line,
  )
  if (row === undefined) return undefined
  await update($, items, list => list.map(x => (x.id === row.id ? { ...x, id } : x)))
  return { ...row, id }
}

export const register: Register = on => {
  // What the transcript has drawn of each assistant row: id -> onScreen, so a
  // redraw that changes nothing writes nothing.
  const drawn = new Map<string, boolean>()
  let warnedUnknownId = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'answers',
      description: "Index of this session's answers in a pane; click an entry to jump to it",
      argumentHint: '[all|final|clear|index]',
    })
    void $.ui.open({ id: PANE, title: 'Answers' })
    await backfill($).catch(err => $.ui.log(`answers: history not indexed: ${String(err)}`, { to: 'debug' }))

    return next(e)
  })

  on('command.run', { command: 'answers' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'clear') {
      await update($, items, () => [])
      await update($, pulled, () => true) // emptied on purpose: no history comes back on the next open
      drawn.clear()
      return { text: 'Answers index cleared.' }
    }
    if (arg === 'index') {
      // Drops the main conversation's rows and lists them afresh from the session's history.
      await update($, items, list => list.filter(row => row.agentId !== undefined))
      await update($, pulled, () => false)
      drawn.clear()
      const n = await backfill($)
      void $.ui.open({ id: PANE, title: 'Answers' })
      return { text: `Indexed ${n} rows of this conversation; a row becomes a jump target once the transcript draws it.` }
    }
    if (arg === 'all' || arg === 'final') {
      await update($, showAll, () => arg === 'all')
    }
    const opened = await $.ui.open({ id: PANE, title: 'Answers' })
    await backfill($).catch(err => $.ui.log(`answers: history not indexed: ${String(err)}`, { to: 'debug' }))
    void $.ui.scroll({ in: PANE, to: 'end' }).catch(() => undefined) // ponytail: unplaced pane, or a kit with no scroll: nothing to do

    const hint = e.presentation.isFullscreen ? '' : ' Jumping to a message needs the fullscreen renderer.'
    return {
      text: opened.isPlaced
        ? `Answers pane opened.${hint}`
        : 'Answers pane will show once the terminal is wide enough (110 columns in fullscreen).',
    }
  })

  // Every row a conversation keeps passes here, the main one's and each
  // subagent's: index the prompts and the model's text blocks, by the id the
  // transcript gives them, tagged with the loop they belong to.
  on('session.append', async ($, e, next) => {
    const stored = await next(e)
    if (e.door !== 'prompt' && e.door !== 'response') return stored
    if (e.message.isMeta) return stored
    const role = e.message.role
    if (role !== 'user' && role !== 'assistant') return stored
    if (role === 'user') {
      const kind = e.origin.kind
      if (kind !== 'composer' && kind !== 'bridge' && kind !== 'sdk') return stored
    }
    const text = firstLine(
      e.message.content
        .flatMap(block => (block.type === 'text' ? [block.text] : []))
        .join('\n'),
    )
    if (!text) return stored

    const id = stored.deny === undefined ? stored.uuid : e.uuid
    const at = await $.clock.now()
    const entry: AnswerEntry = { id, role, agentId: e.agentId, text, at, isFinal: false, onScreen: false }
    await update($, items, list => {
      // A new prompt closes the previous turn, should turn.complete have missed it.
      const base = role === 'user' ? markFinal(list, null, e.agentId) : list
      // ponytail: finished loops keep their rows for the session; prune on agent end if state grows
      return capLoop([...base.filter(row => row.id !== id), entry], e.agentId)
    })

    return stored
  }).catch(($, e, next) => next(e))

  on('turn.complete', async ($, e, next) => {
    if (e.reason === 'answer' && e.answer.trim() !== '') {
      const { answer, agentId } = e
      await update($, items, list => markFinal(list, answer, agentId))
    }

    return next(e)
  })

  // Which answers the viewport shows now. A render hook may not write state,
  // so the write is deferred out of the drawing, and only when it changed.
  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const onScreen = e.props.onScreen !== undefined ? e.props.onScreen !== null : undefined
    if (onScreen !== undefined && drawn.get(e.requestId) !== onScreen) {
      drawn.set(e.requestId, onScreen)
      const { requestId: id, props: { text } } = e
      $.clock.after(0, () => {
        void (async () => {
          const list = await read($, items)
          const row = list.find(x => x.id === id) ?? (await adopt($, 'assistant', id, text))
          if (!row) {
            if (!warnedUnknownId && list.some(x => x.role === 'assistant')) {
              warnedUnknownId = true
              $.ui.log(`answers: drawn row ${id} is not in the index (ids differ?)`, { to: 'debug' })
            }
            return
          }
          if (row.onScreen === onScreen) return
          await update($, items, l => l.map(x => (x.id === id ? { ...x, onScreen } : x)))
        })()
      })
    }

    return next(e)
  })

  // A prompt's row: a history row takes its id from the first drawing.
  on('ui.render', { component: 'UserMessage' }, ($, e, next) => {
    if (!drawn.has(e.requestId)) {
      drawn.set(e.requestId, false) // seen once; a prompt has no dot to track
      const { requestId: id, props: { text } } = e
      $.clock.after(0, () => void adopt($, 'user', id, text))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const list = await read($, items)
    const all = await read($, showAll)
    const width = Math.max(16, e.props.bodyColumns)
    // The transcript beside the pane: the main conversation's, or one agent's.
    const rows = list.filter(row => row.agentId === e.props.view.agentId)
    const shown = all ? rows : rows.filter(row => row.role === 'user' || row.isFinal)
    const finals = rows.filter(row => row.isFinal).length

    const jump = (id: string) => async () => {
      if (isPlaceholder(id)) return $.ui.toast('A history row: it becomes a jump target once the transcript has drawn it.')
      const moved = await $.ui.scroll({ to: { requestId: id }, block: 'start' })
      if (moved.deny !== undefined) $.ui.toast(`Cannot jump there: ${moved.deny}`)
    }

    return (
      <Box flexDirection="column">
        <Box>
          <Text weight="semibold">Answers </Text>
          <Text dimColor>{finals} </Text>
          <Button key="mode" plain dimColor onPress={() => update($, showAll, v => !v)}>
            {all ? '[all blocks]' : '[final only]'}
          </Button>
        </Box>
        {shown.length === 0 && <Text dimColor>No answers yet.</Text>}
        {shown.map(row =>
          row.role === 'user' ? (
            <Button key={row.id} plain dimColor onPress={jump(row.id)}>
              {clip(`› ${row.at ? `${hhmm(row.at)} ` : ''}${row.text}`, width)}
            </Button>
          ) : (
            <Button key={row.id} plain onPress={jump(row.id)}>
              {clip(`${row.onScreen ? '●' : ' '} ${row.text}`, width)}
            </Button>
          ),
        )}
      </Box>
    )
  })
}
