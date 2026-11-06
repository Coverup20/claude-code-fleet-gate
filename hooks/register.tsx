import type { Register } from 'claude-code';

const PANE_ID = 'fleet-gate-panel';

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
        '-NoProfile',
        '-File',
        'V:\\.claude\\ptc\\fleet_gate_prompt.ps1',
      ]);
      if (res.exitCode === 0) {
        return { text: 'Flotta sbloccata con successo.' };
      }
      return { text: 'Errore durante lo sblocco della flotta.' };
    }
    if (e.command === 'fleet-lock') {
      const res = await $.process.run([
        'powershell.exe',
        '-NoProfile',
        '-File',
        'V:\\.claude\\ptc\\fleet_gate_prompt.ps1',
        '-LockAll',
      ]);
      if (res.exitCode === 0) {
        return { text: 'Flotta bloccata con successo.' };
      }
      return { text: 'Errore durante il blocco della flotta.' };
    }
    return await next(e);
  });

  // 3. Render Status Pane
  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e);

    const helperPath = 'V:\\.claude\\ptc\\fleet_gate_prompt.ps1';
    let localStatus = 'Verifica in corso...';
    let ptcStatus = 'Verifica in corso...';
    let keysStatus = 'Verifica in corso...';

    try {
      const res = await $.process.run([
        'powershell.exe',
        '-NoProfile',
        '-File',
        helperPath,
        '-CheckOnly',
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
      localStatus = 'Errore verifica';
      ptcStatus = 'Errore verifica';
      keysStatus = 'Errore verifica';
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
            <Text bold>1. Gate Locale Windows: </Text>
            <Text color={localStatus.includes('APERTO') ? 'green' : 'red'}>{localStatus}</Text>
          </Box>
          <Box>
            <Text bold>2. Gate Remoto PTC (vm-z1-00): </Text>
            <Text color={ptcStatus.includes('APERTO') ? 'green' : 'red'}>{ptcStatus}</Text>
          </Box>
          <Box>
            <Text bold>3. SSH Keys Agent (vm-z1-00): </Text>
            <Text color={keysStatus.includes('LOADED') ? 'green' : 'yellow'}>{keysStatus}</Text>
          </Box>
        </Box>

        <Box marginTop={1} flexDirection="row">
          <Button
            key="btn-refresh"
            label="[ 🔄 Aggiorna Stato ]"
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
              label="[ 🔑 Sblocca ]"
              onPress={async () => {
                await $.process.run([
                  'powershell.exe',
                  '-NoProfile',
                  '-File',
                  'V:\\.claude\\ptc\\fleet_gate_prompt.ps1',
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
              label="[ 🔒 Blocca ]"
              onPress={async () => {
                await $.process.run([
                  'powershell.exe',
                  '-NoProfile',
                  '-File',
                  'V:\\.claude\\ptc\\fleet_gate_prompt.ps1',
                  '-LockAll',
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

  // 5. In ui.render, ensure you return the JSX tree for the pane and return await next(e) for any other component.
  on('ui.render', async ($, e, next) => {
    return await next(e);
  });
};
