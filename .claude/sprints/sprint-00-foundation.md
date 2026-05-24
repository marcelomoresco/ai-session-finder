# Sprint 00 — Foundation

## Objetivo

Subir esqueleto do monorepo, configurar tooling (TS, ESLint, Prettier, Vitest, CI), licença Apache 2.0, documentos de comunidade e shell Electron vazia mas rodando.

## Pré-requisitos

- Nenhum (primeiro sprint)
- Node 20+ instalado
- pnpm 9+ instalado (`npm i -g pnpm`)
- Conta GitHub com repositório criado (vazio)

## Tasks

### Task 00.1 — Inicializar monorepo pnpm

**Arquivos:**

- `package.json` (root)
- `pnpm-workspace.yaml`
- `.gitignore`
- `.nvmrc` (`20`)

**O que fazer:**

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

```json
// package.json root
{
  "name": "codex-spotlight",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": { "node": ">=20.0.0" },
  "scripts": {
    "dev": "pnpm --filter @cs/main dev",
    "build": "pnpm -r build",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "typecheck": "pnpm -r typecheck"
  }
}
```

**Critério de aceite:**

- `pnpm install` na raiz não dá erro
- `pnpm -r ls` lista os workspaces (mesmo vazios)

---

### Task 00.2 — TypeScript base config

**Arquivos:**

- `tsconfig.base.json`

**O que fazer:**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "verbatimModuleSyntax": true,
    "useDefineForClassFields": true,
    "incremental": true
  }
}
```

**Critério de aceite:**

- Arquivos `tsconfig.json` dos pacotes filhos podem extender (`"extends": "../../tsconfig.base.json"`)

---

### Task 00.3 — ESLint flat config + Prettier

**Arquivos:**

- `eslint.config.js`
- `.prettierrc`
- `.prettierignore`

**Stack:** ESLint v9 (flat config), `typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-react-hooks`.

**O que fazer:** configurar regras estritas:

- `@typescript-eslint/no-explicit-any: error`
- `@typescript-eslint/no-unused-vars: error` (com `_` ignore pattern)
- `@typescript-eslint/consistent-type-imports: error`
- `@typescript-eslint/no-floating-promises: error`
- `@typescript-eslint/no-misused-promises: error`
- `no-console: warn` (exceto em CLI scripts)

`.prettierrc`:

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**Critério de aceite:**

- `pnpm lint` roda sem erros em projeto vazio
- `pnpm format` formata arquivos

---

### Task 00.4 — Vitest config

**Arquivos:**

- `vitest.config.ts`

**O que fazer:**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      exclude: ['**/*.config.*', '**/dist/**', '**/node_modules/**'],
    },
    include: ['**/*.{test,spec}.ts'],
  },
});
```

**Critério de aceite:**

- `pnpm test` roda (sem testes ainda, mas sem erro)

---

### Task 00.5 — Apps Electron shell

**Arquivos:**

- `apps/main/package.json`
- `apps/main/tsconfig.json`
- `apps/main/electron.vite.config.ts`
- `apps/main/src/index.ts`
- `apps/renderer/package.json`
- `apps/renderer/tsconfig.json`
- `apps/renderer/vite.config.ts`
- `apps/renderer/index.html`
- `apps/renderer/src/main.tsx`

**O que fazer:**

- Configurar `electron-vite` para HMR
- Main process abre `BrowserWindow` 700x500, frameless, transparente (preparando p/ launcher style)
- Renderer com React 19 + Tailwind 4 + shadcn/ui base
- `pnpm dev` deve abrir janela com texto "Hello Codex Spotlight"

**Dependências chave:**

```json
{
  "dependencies": {
    "electron": "^32.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "electron-vite": "^2.3.0",
    "vite": "^5.4.0",
    "@vitejs/plugin-react": "^4.3.0",
    "tailwindcss": "^4.0.0"
  }
}
```

**Critério de aceite:**

- `pnpm dev` abre janela Electron
- Hot reload funciona ao editar `App.tsx`
- `pnpm build` produz bundles em `apps/main/dist` e `apps/renderer/dist`

---

### Task 00.6 — Packages vazios (`domain`, `contracts`)

**Arquivos:**

- `packages/domain/package.json`
- `packages/domain/tsconfig.json`
- `packages/domain/src/index.ts` (apenas `export {};`)
- `packages/contracts/package.json`
- `packages/contracts/tsconfig.json`
- `packages/contracts/src/index.ts` (apenas `export {};`)

**O que fazer:**

- Cada pacote tem `name: "@cs/domain"` e `@cs/contracts`
- `exports` field apontando para `./src/index.ts` (será trocado para `./dist` no build)
- Sem código de produção ainda — virão no Sprint 01

**Critério de aceite:**

- `pnpm -r typecheck` passa
- `apps/main` consegue importar de `@cs/domain` (mesmo que vazio)

---

### Task 00.7 — Licença e documentos comunitários

**Arquivos:**

- `LICENSE` (Apache 2.0, copyright "Codex Spotlight contributors")
- `README.md` (intro, status "WIP", link para sprints)
- `CONTRIBUTING.md` (como rodar local, como abrir PR, conventional commits)
- `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, copy oficial)
- `SECURITY.md` (como reportar vulnerabilidades)
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/feature_request.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/FUNDING.yml` (placeholder vazio se ainda não tem GH Sponsors)

**Critério de aceite:**

- GitHub renderiza "Community Standards" sem warnings
- `README.md` tem badges: licença, CI status, downloads (placeholder)

---

### Task 00.8 — CI básica (GitHub Actions)

**Arquivos:**

- `.github/workflows/ci.yml`

**O que fazer:**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:

jobs:
  build-test:
    runs-on: macos-14 # ARM, mais rápido pra Electron
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test --coverage
      - run: pnpm build
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

**Critério de aceite:**

- PR aberto dispara o workflow
- Workflow termina verde em <5 min

---

### Task 00.9 — CLAUDE.md (contexto para Claude Code futuro)

**Arquivos:**

- `.claude/CLAUDE.md`

**O que fazer:**
Documento curto (~80 linhas) que vai ser lido por toda nova sessão Claude Code no repo:

```markdown
# Codex Spotlight — Context for Claude Code

## What this is

Open-source macOS launcher for searching across Claude Code, Codex CLI, and Cursor sessions.

## Stack

- Electron + TypeScript + React
- SQLite (better-sqlite3 + FTS5 + sqlite-vec)
- Transformers.js for local embeddings
- tRPC for IPC, Vitest for tests

## Conventions

- pnpm only (no npm/yarn)
- TypeScript strict mode (no `any`)
- SOLID + DRY
- Conventional Commits
- TDD when feasible (tests first for new domain logic)

## Where things live

- `apps/main` — Electron main process
- `apps/renderer` — React UI
- `apps/indexer` — Worker thread for indexing
- `packages/domain` — pure types
- `packages/contracts` — tRPC schemas (Zod)
- `packages/test-fixtures` — anonymized session data

## Commands

- `pnpm dev` — start Electron in dev mode
- `pnpm test` — run all tests
- `pnpm lint` — ESLint
- `pnpm typecheck` — TypeScript check across workspaces

## When in doubt

Read the sprint file under `.claude/sprints/sprint-XX.md` matching the current work.
```

**Critério de aceite:**

- Arquivo existe, é referenciado pelos sprints

---

## Testes obrigatórios deste sprint

- Nenhum (sprint de setup). Os testes começam no Sprint 01.

## Definition of Done (Sprint 00)

- [ ] `pnpm install && pnpm dev` abre Electron em Mac limpo
- [ ] `pnpm test` roda (vazio mas sem erro)
- [ ] `pnpm lint` passa
- [ ] `pnpm typecheck` passa
- [ ] CI verde no GitHub
- [ ] LICENSE, README, CONTRIBUTING, CODE_OF_CONDUCT presentes
- [ ] `.claude/CLAUDE.md` criado
- [ ] Commit final: `chore: sprint 00 — foundation setup`

---

## Prompt para Claude Code

```
Você é um engenheiro sênior implementando o Sprint 00 do projeto Codex Spotlight.

Leia o arquivo .claude/sprints/sprint-00-foundation.md e execute todas as 9 tasks em ordem (00.1 a 00.9).

Regras:
1. Pare e me peça confirmação antes de fazer commit
2. Após cada task, rode os comandos de verificação e me reporte o resultado
3. Use Conventional Commits para cada chunk lógico (1 commit por task ou agrupado por tema)
4. Se algo no spec não fizer sentido na prática, me consulte antes de improvisar
5. Versões de dependências: use as mais recentes estáveis disponíveis no momento da execução, não decore as do documento

Comece pela Task 00.1.
```
