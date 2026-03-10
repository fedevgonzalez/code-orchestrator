# Security Policy

## Security Model

Code Orchestrator executes AI-generated code via `claude -p` subprocesses. This is inherently powerful and comes with security considerations.

### Permission Modes

The `allowUnsafePermissions` config option controls how Claude handles tool permissions:

| Value | Behavior |
|-------|----------|
| `true` (default) | Claude auto-approves file writes, command execution, etc. Faster but less controlled. |
| `false` | Claude prompts for permission on each tool use. Safer for untrusted or sensitive projects. |

Set this in your `.orchestrator.config.mjs`:

```js
export default {
  allowUnsafePermissions: false, // Claude will prompt before writing files or running commands
};
```

### Dashboard Authentication

The dashboard and HTTP API are open by default (localhost only). To require authentication:

```bash
export ORCHESTRATOR_TOKEN=your-secret-token
```

When set, all requests (except `/health`) require the token via:
- Query parameter: `?token=your-secret-token`
- Header: `Authorization: Bearer your-secret-token`

### CORS Policy

The dashboard API restricts CORS to localhost origins only. If you need to access the API from a remote host, use a reverse proxy with proper authentication.

## Command Execution

The orchestrator executes commands in these contexts:

1. **`claude -p` subprocesses** — AI-generated tool use (file writes, shell commands)
2. **Phase validation** — build/test commands from config or auto-detected
3. **Gate checks** — commands defined in execution plans
4. **Task validation** — `run:` commands from task definitions

Commands from sources 2-4 are sanitized to reject shell metacharacters (`;`, `&`, `|`, `` ` ``, `$`, `(`, `)`) unless they are known-safe prefixes (`npm`, `npx`).

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer at the address listed in package.json, or use GitHub's private vulnerability reporting feature
3. Include steps to reproduce and potential impact
4. Allow reasonable time for a fix before public disclosure

## Best Practices

- Run the orchestrator in an isolated environment (container, VM) for untrusted projects
- Set `allowUnsafePermissions: false` when working on sensitive codebases
- Set `ORCHESTRATOR_TOKEN` when exposing the dashboard on a network
- Review generated execution plans with `--dry-run` before running
- Monitor the dashboard during execution for unexpected behavior
- Keep Claude Code CLI updated to the latest version
