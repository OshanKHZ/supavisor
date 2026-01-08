# Contributing to Supavisor

First off, thank you for considering contributing! Every contribution helps make Supavisor better for the Supabase community.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Style Guidelines](#style-guidelines)
- [Adding New Rules](#adding-new-rules)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/).

**Quick summary:**

- Be respectful and inclusive
- Accept constructive criticism
- Focus on what's best for the community
- Welcome newcomers and help them learn

## How Can I Contribute?

### Reporting Bugs

Before submitting:

- [ ] Check [existing issues](https://github.com/oshankhz/supavisor/issues) first
- [ ] Search closed issues too

When submitting, include:

- Clear title: `[Bug] Short description`
- Steps to reproduce
- Expected vs actual behavior
- Environment (Node version, OS, Supavisor version)
- SQL migration file that triggers the bug (if applicable)

**Example:**

```
[Bug] require-rls false positive on non-public schema

Steps:
1. Create table in custom schema: CREATE TABLE custom.users (id uuid)
2. Run: supavisor migrations/**/*.sql
3. Error shown even though table is not in public schema

Expected: No error (rule only applies to public schema)
Actual: Error shown

Environment:
- Node: 18.16.0
- Supavisor: 0.2.0
- OS: Ubuntu 22.04
```

### Suggesting Features

- Open issue with `[Feature]` prefix
- Describe the problem it solves
- Explain your proposed solution
- Note any alternatives considered

**Example:**

```
[Feature] Add rule to detect missing NOT NULL constraints

Problem: Tables often have columns that should never be null but aren't constrained

Proposed Solution: New rule `require-not-null-constraints` that checks for:
- Columns named *_id without NOT NULL
- created_at/updated_at without NOT NULL

Alternatives Considered:
- Making this part of existing table validation rules
- Only warning on _id columns
```

### Contributing Code

**Good first issues** are labeled `good first issue`.

Before starting work:

1. Check if issue exists or create one
2. Comment that you're working on it
3. Wait for maintainer acknowledgment on large changes

### Improving Documentation

Documentation PRs are always welcome:

- Fix typos
- Add examples
- Clarify confusing sections
- Document undocumented rules

### Adding New Rules

See [Adding New Rules](#adding-new-rules) section below.

## Development Setup (~5 min)

### Prerequisites

- [ ] Node.js 18+
- [ ] npm 9+
- [ ] Git

### Local Setup

```bash
# Fork and clone
git clone https://github.com/YOUR-USERNAME/supavisor.git
cd supavisor

# Add upstream remote
git remote add upstream https://github.com/oshankhz/supavisor.git

# Install dependencies
npm install

# Build the project
npm run build

# Run tests to verify setup
npm test
```

You should see all tests passing.

### Running Locally

```bash
# Watch mode (rebuilds on changes)
npm run dev

# Build once
npm run build

# Run linter on test fixtures
npm run lint
```

### Running Tests

```bash
npm test              # All tests
npm test -- --watch   # Watch mode
npm run typecheck     # TypeScript check
```

### Project Structure

```
supavisor/
├── src/
│   ├── cli/          # CLI interface
│   ├── config/       # Configuration loading
│   ├── core/         # Core types and utilities
│   ├── linter/       # Linting engine
│   │   ├── rules/    # Rule implementations
│   │   ├── engine.ts
│   │   └── context/  # Project context
│   └── parser/       # SQL parsing utilities
├── test/
│   └── fixtures/     # Test SQL files
└── bin/              # CLI entry point
```

## Pull Request Process

### Before Submitting

1. **Sync with upstream:**

   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create feature branch:**

   ```bash
   git checkout -b feature/short-description
   # or
   git checkout -b fix/bug-description
   ```

3. **Make changes:**
   - Write/update tests for your changes
   - Follow style guidelines
   - Update docs if needed
   - Add test fixtures if adding rules

4. **Verify:**

   ```bash
   npm run typecheck
   npm test
   npm run build
   npm run lint
   ```

5. **Commit:**

   ```bash
   git commit -m "feat: add new feature"
   ```

### Commit Messages

Follow [Conventional Commits](https://conventionalcommits.org/):

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat: add no-cascade-delete rule` |
| `fix` | Bug fix | `fix: require-rls false positive on schemas` |
| `docs` | Documentation only | `docs: add examples for custom rules` |
| `test` | Adding tests | `test: add coverage for edge cases` |
| `refactor` | Code change (no feature/fix) | `refactor: extract table parsing logic` |
| `chore` | Maintenance | `chore: update dependencies` |

### Submitting PR

1. Push to your fork
2. Open PR against `main` branch
3. Fill out PR template
4. Link related issues: `Closes #123`

**PR Template:**

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Breaking change

## Testing
How has this been tested?

## Checklist
- [ ] Tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated
```

### What to Expect

- **Initial response:** 2-3 business days
- **Code review:** ~1 week
- **Merge after approval:** 1-2 days

We're volunteers - thanks for your patience!

## Style Guidelines

### Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Prefer functional programming where appropriate
- Keep functions small and focused

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `require-rls.ts` |
| Rule IDs | kebab-case | `no-table-without-pk` |
| Exports | camelCase | `requireRls` |
| Types | PascalCase | `RuleContext` |
| Constants | SCREAMING_SNAKE | `DEFAULT_CONFIG` |

### TypeScript

```typescript
// Good - explicit types
export function parseSQL(sql: string): ParsedStatement[] {
  // ...
}

// Good - type imports
import type { Rule, RuleContext } from '../../core/types.js'

// Good - readonly where applicable
export const allRules: readonly Rule[] = [...]
```

### File Organization

```typescript
// 1. Type imports
import type { Rule } from '../../core/types.js'

// 2. Value imports
import { getTableName } from '../../parser/index.js'

// 3. Rule implementation
export const myRule: Rule = {
  meta: { /* ... */ },
  check(statements, context) { /* ... */ }
}
```

## Adding New Rules

### 1. Create Rule File

Create `src/linter/rules/your-rule-name.ts`:

```typescript
import type { Rule } from '../../core/types.js'
import { getTableName } from '../../parser/index.js'

export const yourRuleName: Rule = {
  meta: {
    id: 'your-rule-name',
    name: 'Human Readable Name',
    description: 'What this rule checks for',
    severity: 'warning', // or 'error'
    category: 'security', // or 'performance', 'best-practice'
    scope: 'statement', // or 'project' for cross-file rules
    docs: 'https://supabase.com/docs/...',
  },
  check(statements, context) {
    for (const stmt of statements) {
      // Check logic here
      if (/* issue found */) {
        context.report({
          severity: this.meta.severity,
          message: 'Descriptive error message',
          line: stmt.line,
          // Optional auto-fix
          fix: {
            description: 'What the fix does',
            sql: 'ALTER TABLE ... ;'
          }
        })
      }
    }
  }
}
```

### 2. Register Rule

Add to `src/linter/rules/index.ts`:

```typescript
import { yourRuleName } from './your-rule-name.js'

export const allRules: Rule[] = [
  // ... existing rules
  yourRuleName,
]

export { yourRuleName }
```

### 3. Add Tests

Create test fixture in `test/fixtures/`:

```sql
-- Should trigger your-rule-name
CREATE TABLE bad_example (
  -- problematic pattern
);

-- Should pass
CREATE TABLE good_example (
  -- correct pattern
);
```

Add test case:

```typescript
import { describe, it, expect } from 'vitest'
import { lint } from '../src/linter/engine.js'

describe('your-rule-name', () => {
  it('should detect issue', async () => {
    const report = await lint({
      files: ['test/fixtures/your-test.sql'],
      rules: { 'your-rule-name': 'error' }
    })

    expect(report.errorCount).toBe(1)
    expect(report.results[0].messages[0].ruleId).toBe('your-rule-name')
  })
})
```

### 4. Update Default Config

Add to `src/cli/main.ts` DEFAULT_CONFIG:

```javascript
"your-rule-name": "warning"
```

### 5. Document Rule

Add entry to README.md rules table and create detailed documentation in `docs/rules/your-rule-name.md`.

## Need Help?

- Open issue with `question` label
- Comment on related issue
- Email: maintainers@supavisor.dev

---

Thank you for contributing to Supavisor!
