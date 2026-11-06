import type { Register } from 'claude-code';

const PANE_ID = 'fleet-gate-panel';

const PS_LAUNCH_CMD = '& { $f = if (Test-Path "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1" } elseif (Test-Path "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1" } else { "V:\\.claude\\ptc\\fleet_gate_prompt.ps1" }; & $f }';
const PS_CHECK_CMD = '& { $f = if (Test-Path "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1" } elseif (Test-Path "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1" } else { "V:\\.claude\\ptc\\fleet_gate_prompt.ps1" }; & $f -CheckOnly }';
const PS_LOCK_CMD = '& { $f = if (Test-Path "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$env:USERPROFILE\\.claude\\ptc\\fleet_gate_prompt.ps1" } elseif (Test-Path "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1") { "$HOME\\.claude\\ptc\\fleet_gate_prompt.ps1" } else { "V:\\.claude\\ptc\\fleet_gate_prompt.ps1" }; & $f -LockAll }';

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

  // 2. Handle Slash Commands
  on('command.run', async ($, e, next) => {
    if (e.command === 'gate-status') {
      await $.ui.open({
        id: PANE_ID,
        title: 'Fleet Security Gate Hub',
      });
      return { text: 'Fleet Security Gate Hub panel opened.' };
    }
    if (e.command === 'fleet-unlock') {
      const res = await $.process.run([
        'powershell.exe',
        '-STA',
        '-ExecutionPolicy',
        'Bypass',
        '-NoProfile',
        '-Command',
        PS_LAUNCH_CMD,
      ]);
      if (res.exitCode === 0) {
        return { text: 'Fleet unlocked successfully.' };
      }
      return { text: 'Error unlocking fleet.' };
    }
    if (e.command === 'fleet-lock') {
      const res = await $.process.run([
        'powershell.exe',
        '-ExecutionPolicy',
        'Bypass',
        '-NoProfile',
        '-Command',
        PS_LOCK_CMD,
      ]);
      if (res.exitCode === 0) {
        return { text: 'Fleet locked successfully.' };
      }
      return { text: 'Error locking fleet.' };
    }
    return await next(e);
  });

  // 3. Render Status Pane
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);

    let localStatus = 'Checking...';
    let ptcStatus = 'Checking...';
    let keysStatus = 'Checking...';

    try {
      const res = await $.process.run([
        'powershell.exe',
        '-ExecutionPolicy',
        'Bypass',
        '-NoProfile',
        '-Command',
        PS_CHECK_CMD,
      ]);
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
            <Text color={localStatus.includes('APERTO') ? 'green' : 'red'}>{localStatus}</Text>
          </Box>
          <Box>
            <Text bold>2. Remote PTC Gate (vm-z1-00): </Text>
            <Text color={ptcStatus.includes('APERTO') ? 'green' : 'red'}>{ptcStatus}</Text>
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
                await $.process.run([
                  'powershell.exe',
                  '-STA',
                  '-ExecutionPolicy',
                  'Bypass',
                  '-NoProfile',
                  '-Command',
                  PS_LAUNCH_CMD,
                ]);
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
                await $.process.run([
                  'powershell.exe',
                  '-ExecutionPolicy',
                  'Bypass',
                  '-NoProfile',
                  '-Command',
                  PS_LOCK_CMD,
                ]);
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
