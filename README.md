# Fleet Gate Hub (Claude Code Plugin)

Centralized visual status and secure unlock for:

1. Windows Local Gate (idle-window TOTP verification)
2. PTC Bastion Gate on `vm-z1-00` (Programmatic Tool Calling gate)
3. SSH Agent on `vm-z1-00` (SSH key passphrases loaded in memory)

## Installation

Install via chat:

```text
/plugin install fleet-gate --marketplace Coverup20/claude-code-fleet-gate
```

Or via CLI:

```bash
claude plugin marketplace add Coverup20/claude-code-fleet-gate
claude plugin install fleet-gate@fleet-gate
```

Restart Claude Code or run `/reload-plugins` after install or update.

## Commands

- `/gate-status`: Open the Fleet Security Gate Hub status pane.
- `/fleet-unlock`: Launch the secure WPF masked GUI prompt to unlock local gate,
  remote PTC gate, and SSH keys.
- `/fleet-lock`: Lock all gates and flush SSH agent keys.

## License

MIT © Marzio Bordin
