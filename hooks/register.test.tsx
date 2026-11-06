import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

test('commands are registered on session start', async ($, on) => {
  const registered: string[] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => {
    registered.push(e.name)
    return { value: { command: e.name } }
  })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })
  expect(registered).toContain('gate-status')
  expect(registered).toContain('fleet-unlock')
  expect(registered).toContain('fleet-lock')
})

test('/gate-status opens fleet-gate-panel and returns panel opened', async ($, on) => {
  const opened: { id: string; title: string }[] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('ui.open', (_, e) => {
    opened.push({ id: e.id, title: e.title })
    return { value: { isPlaced: true } }
  })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  const result = await $.command.run({
    command: 'gate-status',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })

  expect(opened).toEqual([{ id: 'fleet-gate-panel', title: 'Fleet Security Gate Hub' }])
  expect(result.text).toContain('panel opened')
})

test('/fleet-unlock executes powershell with STA and Bypass, returning success on exit code 0', async ($, on) => {
  const ran: string[][] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  const result = await $.command.run({
    command: 'fleet-unlock',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })

  expect(ran.length).toBe(1)
  const argv = ran[0] ?? []
  expect(argv).toContain('powershell.exe')
  expect(argv).toContain('-STA')
  expect(argv).toContain('-ExecutionPolicy')
  expect(argv).toContain('Bypass')
  expect(result.text).toBeDefined()
})

test('/fleet-lock executes powershell with -LockAll command, returning success on exit code 0', async ($, on) => {
  const ran: string[][] = []
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('process.run', (_, e) => {
    ran.push([...e.argv])
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  await $.session.start({ cwd: '/work', surface: 'terminal', isInteractive: true })

  const result = await $.command.run({
    command: 'fleet-lock',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })

  expect(ran.length).toBe(1)
  const argv = ran[0] ?? []
  expect(argv).toContain('powershell.exe')
  expect(argv.some(arg => arg.includes('-LockAll'))).toBe(true)
  expect(result.text).toBeDefined()
})
