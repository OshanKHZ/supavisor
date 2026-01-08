# Changelog

## [v0.1.0] - January 8th, 2026

### Added

- Fast SQL linter powered by libpg-query
- CLI with glob pattern support and auto-fix (`--fix`)
- Project mode for cross-file analysis (`--project`)
- Configuration system via `.supavisorrc.json`
- Inline ignore directives (`supavisor-disable`)
- 16 linting rules:
  - 8 security rules (RLS enforcement, auth.users protection, policy validation)
  - 3 performance rules (primary keys, foreign key indexes, duplicate indexes)
  - 5 best practice rules (schema organization, sensitive columns, function security)
- JSON output for CI/CD integration
- Programmatic API for Node.js
- TypeScript type definitions

