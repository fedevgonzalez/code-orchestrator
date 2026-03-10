# Roadmap

Current version: **2.2.0**

This roadmap reflects planned features and improvements. Priorities may shift based on community feedback.

## Near-term

- [ ] **Terminal recording / GIF demo** for README — show a real build run from start to finish
- [ ] **`claude-orch init`** command — interactive project config generator (`.orchestrator.config.mjs`)
- [ ] **Notification hooks** — Slack, Discord, email notifications on run completion or failure
- [ ] **Task-level cost tracking** — break down cost per task, not just total
- [ ] **Dashboard improvements** — phase timeline visualization, review score charts, log filtering

## Mid-term

- [ ] **Custom mode API** — define modes entirely via config (no code required)
- [ ] **Remote dashboard** — optional hosted dashboard for monitoring multiple projects
- [ ] **Spec templates** — starter specs for common project types (SaaS, API, CLI tool, library)
- [ ] **Checkpoint diffing** — show what changed between checkpoint saves
- [ ] **Run comparison** — compare two runs side-by-side (tasks, scores, timing)

## Long-term

- [ ] **Multi-agent orchestration** — assign different tasks to different Claude models or instances
- [ ] **GitHub integration** — auto-create PRs from completed runs, link to issues
- [ ] **VS Code extension** — start/monitor orchestrator runs from the editor
- [ ] **Self-healing pipelines** — detect and fix infrastructure issues (missing deps, port conflicts) automatically

## Completed

- [x] 8 execution modes (build, feature, fix, audit, test, review, refactor, exec)
- [x] Automatic code review with scoring and auto-fix
- [x] Crash recovery with checkpoint and auto-restart
- [x] Multi-language support (Node.js, Python, Go, Rust, Java, Ruby, PHP, .NET)
- [x] Parallel task execution
- [x] Real-time WebSocket dashboard with auth
- [x] Plugin system with custom validators and lifecycle hooks
- [x] Dry-run mode
- [x] Rate limiter for Claude API calls
- [x] System watchdog for auto-recovery after reboot
- [x] Security hardening (command injection fixes, CORS restriction)
- [x] CI/CD with GitHub Actions (cross-platform, multi-Node matrix)

---

Have a feature idea? [Open an issue](https://github.com/fedevgonzalez/code-orchestrator/issues/new?template=feature_request.md).
