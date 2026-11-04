# Start Instruction for Claude Code

Read `CLAUDE.md`, then `PHASE1_BUILD_DIRECTIVE.md`, then all `/docs` architecture/specification files. Treat Architecture v1.0 as frozen.

Begin Phase 1 only. Before editing, summarize the Phase 1 implementation plan mapped to `docs/TASK_BOARD.md` and identify any true external dependency that cannot be mocked. Then proceed autonomously.

Do not request Qwen or other paid-provider credentials for core Phase 1 implementation/tests; implement provider-neutral interfaces and fakes first. Do not start Phase 2 until the Phase 1 gate report passes.
