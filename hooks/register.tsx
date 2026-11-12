import type { Register } from 'claude-code';

const PANE_ID = 'fleet-gate-panel';

// The unlock prompt is a WPF window: the operator types an OTP code there, so
// the child may stay alive for minutes. $.process.run rejects after 30 s by
// default, which killed the unlock hook before the operator answered, so the
// wait is raised to the API's maximum here.
const CHECK_TIMEOUT_MS = 60000;
const UNLOCK_TIMEOUT_MS = 600000;
const LOCK_TIMEOUT_MS = 120000;

const PS_LAUNCH_CMD = '& { $f = if (Test-Path "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1" } elseif (Test-Path "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1" } else { "V:\\.claude\\ptc\\fleet_gate_prompt.ps1" }; & $f }';
const PS_CHECK_CMD = '& { $f = if (Test-Path "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1" } elseif (Test-Path "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1" } else { "V:\\.claude\\ptc\\fleet_gate_prompt.ps1" }; & $f -CheckOnly }';
const PS_LOCK_CMD = '& { $f = if (Test-Path "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1" } elseif (Test-Path "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1" } else { "V:\\.claude\\ptc\\fleet_gate_prompt.ps1" }; & $f -LockAll }';

function commandName(value: unknown): string {
  // Accept 'fleet-unlock', 'fleet-gate:fleet-unlock' and '/fleet-unlock':
  // a leading slash was observed to leave the handler unmatched, which makes
  // the command look unanswered even though the hook is registered.
  const raw = String(value ?? '').trim().replace(/^\//, '');
  const last = raw.includes(':') ? raw.split(':').pop() || raw : raw;
  return last.replace(/^\//, '');
}

export const register: Register = (on) => {
  // 1. Register Slash Commands
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'gate-status',
      description: 'Show Fleet Gate Hub status panel (Local Windows, Remote PTC, SSH Keys)',
    });

    await $.command.register({
      name: 'fleet-unlock',
      description: 'Launch fleet unlock prompt (Local Gate, Remote PTC Gate and vm-z1-00 SSH Keys)',
    });

    await $.command.register({
      name: 'fleet-lock',
      description: 'Lock all fleet gates and clear remote SSH agent keys',
    });

    return next(e);
  });

  // 2. Handle Slash Commands.
  // Use a single generic command.run hook and dispatch on e.command: on
  // Claude Code 2.1.322 the matcher form `{ command: 'fleet-unlock' }` no
  // longer reached the handler and the command was left unanswered. A hook
  // that throws is skipped, so the whole handler carries a .catch.
  on('command.run', async ($, e, next) => {
    const name = commandName(e.command);

    if (name === 'gate-status') {
      await $.ui.open({
        id: PANE_ID,
        title: 'Fleet Security Gate Hub',
      });
      return { text: 'Fleet Security Gate Hub panel opened.' };
    }

    if (name === 'fleet-unlock') {
      const res = await $.process.run(
        ['powershell.exe', '-STA', '-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', PS_LAUNCH_CMD],
        { timeoutMs: UNLOCK_TIMEOUT_MS },
      );
      if (res.exitCode === 0) {
        return { text: 'Fleet unlocked successfully.' };
      }
      return { text: 'Error unlocking fleet.' };
    }

    if (name === 'fleet-lock') {
      const res = await $.process.run(
        ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', PS_LOCK_CMD],
        { timeoutMs: LOCK_TIMEOUT_MS },
      );
      if (res.exitCode === 0) {
        return { text: 'Fleet locked successfully.' };
      }
      return { text: 'Error locking fleet.' };
    }

    return await next(e);
  }).catch(($, e, next) =>
    next.called ? next(e) : { text: 'Fleet gate command did not complete (timeout or error).' },
  );

  // 3. Render Status Pane
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);

    let localStatus = 'Checking...';
    let ptcStatus = 'Checking...';
    let keysStatus = 'Checking...';

    try {
      const res = await $.process.run(
        ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', PS_CHECK_CMD],
        { timeoutMs: CHECK_TIMEOUT_MS },
      );
      const stdout = res.stdout.trim();
      for (const line of stdout.split('\n')) {
        if (line.startsWith('STATUS|')) {
          const parts = line.split('|');
          for (const p of parts) {
            if (p.startsWith('LocalGate=')) localStatus = p.substring('LocalGate='.length);
            if (p.startsWith('PtcGate=')) ptcStatus = p.substring('PtcGate='.length);
            if (p.startsWith('SshKeys=')) keysStatus = p.substring('SshKeys='.length);
          }
        }
      }
    } catch (err) {
      localStatus = 'Status check failed';
      ptcStatus = 'Status check failed';
      keysStatus = 'Status check failed';
    }

    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="orange">
        <Box marginBottom={1}>
          <Text bold color="orange">
            🛡️ FLEET SECURITY GATE HUB
          </Text>
        </Box>
        <Box flexDirection="column" marginBottom={1}>
          <Box>
            <Text bold>1. Windows Local Gate: </Text>
            <Text color={localStatus.includes('OPEN') || localStatus.includes('APERTO') ? 'green' : 'red'}>{localStatus}</Text>
          </Box>
          <Box>
            <Text bold>2. Remote PTC Gate (vm-z1-00): </Text>
            <Text color={ptcStatus.includes('OPEN') || ptcStatus.includes('APERTO') ? 'green' : 'red'}>{ptcStatus}</Text>
          </Box>
          <Box>
            <Text bold>3. SSH Agent Keys (vm-z1-00): </Text>
            <Text color={keysStatus.includes('LOADED') ? 'green' : 'yellow'}>{keysStatus}</Text>
          </Box>
        </Box>

        <Box marginTop={1} flexDirection="row">
          <Button
            key="btn-refresh"
            label="[ 🔄 Refresh ]"
            onPress={async () => {
              await $.ui.open({
                id: PANE_ID,
                title: 'Fleet Security Gate Hub',
              });
            }}
          />
          <Box marginLeft={2}>
            <Button
              key="btn-unlock"
              label="[ 🔑 Unlock ]"
              onPress={async () => {
                await $.process.run(
                  ['powershell.exe', '-STA', '-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', PS_LAUNCH_CMD],
                  { timeoutMs: UNLOCK_TIMEOUT_MS },
                );
                await $.ui.open({
                  id: PANE_ID,
                  title: 'Fleet Security Gate Hub',
                });
              }}
            />
          </Box>
          <Box marginLeft={2}>
            <Button
              key="btn-lock"
              label="[ 🔒 Lock ]"
              onPress={async () => {
                await $.process.run(
                  ['powershell.exe', '-ExecutionPolicy', 'Bypass', '-NoProfile', '-Command', PS_LOCK_CMD],
                  { timeoutMs: LOCK_TIMEOUT_MS },
                );
                await $.ui.open({
                  id: PANE_ID,
                  title: 'Fleet Security Gate Hub',
                });
              }}
            />
          </Box>
        </Box>
      </Box>
    );
  });

  on('ui.render', async ($, e, next) => {
    return await next(e);
  });
};
