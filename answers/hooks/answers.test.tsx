import { expect, mock, test } from 'claude-code/testing'
import type { SessionAppendInput } from 'claude-code'

const PANE = {
  plugin: 'answers',
  component: 'Pane',
  requestId: 'answers',
  props: { title: 'Answers', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const row = (role: 'user' | 'assistant', text: string, uuid: string): SessionAppendInput => ({
  message: { type: role, role, content: [{ type: 'text', text }] },
  door: role === 'user' ? 'prompt' : 'response',
  origin: role === 'user' ? { kind: 'composer' } : { kind: 'model', model: 'm' },
  uuid,
})

const run = (args: string, isFullscreen = true) =>
  ({ command: 'answers', args, origin: { kind: 'composer' }, presentation: { isFullscreen, columns: 160 } }) as const

test('prompts and the whole final answer are listed; interim text only under [all blocks]', async ($, on) => {
  on('command.register', () => ({ value: { command: 'answers' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Review the mod', type: 'general-purpose', status: 'running' }] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.messages', () => ({ value: [] }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  mock.clock(on)
  mock.session(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.append(row('user', 'What time is it?', 'u1'))
  await $.session.append(row('assistant', 'Checking the clock.', 'a1'))
  await $.session.append(row('assistant', '**Step one** done.', 'a2'))
  await $.session.append(row('assistant', 'It is noon.', 'a3'))
  await $.turn.complete({ answer: '**Step one** done.\n\nIt is noon.', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't1' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'u1' }))?.text).toMatch(/What time is it\?$/)
  expect(await ui.find({ key: 'a3' })).toBeDefined()
  // The earlier block of the same final message is final too, bold marks or not.
  expect(await ui.find({ key: 'a2' })).toBeDefined()
  expect(await ui.find({ key: 'a1' })).toBeUndefined()

  await ui.press({ key: 'mode' })
  expect(await ui.find({ key: 'a1' })).toBeDefined()
  await ui.unmount()

  expect((await $.command.run(run('', false))).text).toMatch(/fullscreen/)
  expect((await $.command.run(run('clear'))).text).toBe('Answers index cleared.')
  const empty = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await empty.find({ type: 'Text', text: /No answers yet/ })).toBeDefined()
  await empty.unmount()
})

test("the pane lists the transcript in view: an agent's rows under its view, the main's under none", async ($, on) => {
  on('command.register', () => ({ value: { command: 'answers' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Review the mod', type: 'general-purpose', status: 'running' }] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.messages', () => ({ value: [] }))
  on('turn.complete', (_, e) => ({ text: e.answer }))
  mock.clock(on)
  mock.session(on)
  const views: unknown[] = []
  on('ui.view', (_, e) => {
    views.push(e)

    return { value: {} }
  })
  const turn = { reason: 'answer', durationMs: 1, isAborted: false } as const

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.session.append(row('user', 'Main prompt', 'u1'))
  await $.session.append(row('assistant', 'First part.', 'm0'))
  await $.session.append({ ...row('assistant', 'Agent says hi.', 'g1'), agentId: 'a1' })
  await $.turn.complete({ ...turn, answer: 'Agent says hi.', turnId: 't-a1', agentId: 'a1' })
  await $.session.append(row('assistant', 'Main says hi.', 'm1'))
  await $.turn.complete({ ...turn, answer: 'First part.\n\nMain says hi.', turnId: 't1' })

  const main = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await main.find({ key: 'm1' })).toBeDefined()
  expect(await main.find({ key: 'm0' })).toBeDefined() // final, across the agent's interleaved row
  expect(await main.find({ key: 'g1' })).toBeUndefined()
  await main.unmount()

  const agent = await $.ui.mount({ ...PANE, props: { ...PANE.props, view: { agentId: 'a1' } }, surface: 'terminal' })
  expect(await agent.find({ key: 'g1' })).toBeDefined()
  expect(await agent.find({ key: 'm1' })).toBeUndefined()

  // The header names the conversation shown; a press on it asks the view for the next one.
  expect((await agent.find({ key: 'view' }))?.text).toBe('⇄ Review the mod')
  await agent.press({ key: 'view' })
  expect(views).toEqual([{}]) // after the agent comes the main conversation
  await agent.unmount()

  const again = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await again.find({ key: 'view' }))?.text).toBe('⇄ main')
  await again.press({ key: 'view' })
  expect(views).toEqual([{}, { agentId: 'a1' }])
  await again.unmount()
})

test('history is indexed once at start, and its rows take ids as the transcript draws them', async ($, on) => {
  on('command.register', () => ({ value: { command: 'answers' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('agent.list', () => ({ value: [{ id: 'a1', description: 'Review the mod', type: 'general-purpose', status: 'running' }] }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>engine</Text>
  })
  on('session.messages', (_, e) => ({
    value: e.agentId === 'a1' ? [
      { role: 'user', text: 'Agent task', toolUses: [] },
      { role: 'assistant', text: 'Agent report', toolUses: [] },
    ] : e.agentId !== undefined ? { deny: 'unknown agent' } : [
      { role: 'user', text: 'Old prompt', toolUses: [] },
      { role: 'assistant', text: '**Old** answer', toolUses: [] },
      { role: 'user', text: '<command-name>/answers</command-name>', toolUses: [] },
      { role: 'user', text: 'x', toolUses: [], toolResults: [{ tool_use_id: 't1', text: 'x', isError: false }] },
      { role: 'user', text: 'Second prompt', toolUses: [] },
      { role: 'assistant', text: 'Second answer', toolUses: [] },
    ],
  }))
  const clock = mock.clock(on)
  mock.session(on)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  let ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Button', text: /Old prompt/ }))?.text).toBe('› Old prompt')
  expect(await ui.find({ type: 'Button', text: /Old answer/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /Second answer/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /command-name/ })).toBeUndefined()
  await ui.unmount()

  // The transcript draws the old answer: the row learns its id.
  const drawn = await $.ui.mount({
    plugin: 'answers',
    component: 'AssistantMessage',
    requestId: 'h1',
    surface: 'terminal',
    props: { text: '**Old** answer', isFirstOfReply: true, onScreen: { first: 0, last: 0, of: 1 } },
  })
  await clock.settle()
  await drawn.unmount()
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ key: 'h1' }))?.text).toMatch(/Old answer/)
  await ui.unmount()

  // Opening again pulls nothing twice.
  await $.command.run(run(''))
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.findAll({ type: 'Button', text: /Old answer/ })).toHaveLength(1)
  await ui.unmount()

  // After a clear, nothing comes back on its own; `index` rebuilds it.
  await $.command.run(run('clear'))
  await $.command.run(run(''))
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', text: /Old answer/ })).toBeUndefined()
  await ui.unmount()
  expect((await $.command.run(run('index'))).text).toMatch(/^Indexed 4 rows of the main conversation/)
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', text: /Old answer/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /Second prompt/ })).toBeDefined()
  await ui.unmount()

  // An agent's transcript first in view: its history, once; `index` there rebuilds the agent's.
  const agent = { ...PANE, props: { ...PANE.props, view: { agentId: 'a1' } }, surface: 'terminal' } as const
  ui = await $.ui.mount(agent)
  await clock.settle()
  await ui.unmount()
  ui = await $.ui.mount(agent)
  expect(await ui.find({ type: 'Button', text: /Agent report/ })).toBeDefined()
  expect(await ui.find({ type: 'Button', text: /Old answer/ })).toBeUndefined()
  await ui.unmount()
  expect((await $.command.run(run('index'))).text).toMatch(/^Indexed 2 rows of agent a1/)
  ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Button', text: /Old answer/ })).toBeDefined() // the main's untouched
  await ui.unmount()
})
