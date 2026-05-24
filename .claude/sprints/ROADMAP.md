# Codex Spotlight — Roadmap de Sprints

> **Como usar este documento:** Cada sprint é um arquivo `.md` separado nesta pasta. Cada sprint contém tasks atômicas, paths exatos, critérios de aceite e um **prompt pronto** para colar no Claude Code. Execute os sprints em ordem (00 → 07). Não pule.

## Visão geral

8 sprints, ~3-4 semanas de trabalho focado (1 dev), entregando um app macOS funcional, open source, com busca unificada em sessões de Claude Code + Codex CLI + Cursor.

| Sprint | Tema                 | Duração  | Bloqueia   | Arquivo                                                              |
| ------ | -------------------- | -------- | ---------- | -------------------------------------------------------------------- |
| 00     | Foundation (setup)   | 1-2 dias | tudo       | [sprint-00-foundation.md](./sprint-00-foundation.md)                 |
| 01     | Domain & Persistence | 2-3 dias | 02, 03, 04 | [sprint-01-domain-persistence.md](./sprint-01-domain-persistence.md) |
| 02     | Source Adapters      | 4-5 dias | 03         | [sprint-02-source-adapters.md](./sprint-02-source-adapters.md)       |
| 03     | Indexer Pipeline     | 3 dias   | 04         | [sprint-03-indexer-pipeline.md](./sprint-03-indexer-pipeline.md)     |
| 04     | Services & IPC       | 2 dias   | 05         | [sprint-04-services-ipc.md](./sprint-04-services-ipc.md)             |
| 05     | UI Launcher          | 4 dias   | 06         | [sprint-05-ui-launcher.md](./sprint-05-ui-launcher.md)               |
| 06     | macOS Integration    | 2 dias   | 07         | [sprint-06-macos-integration.md](./sprint-06-macos-integration.md)   |
| 07     | Release              | 2 dias   | —          | [sprint-07-release.md](./sprint-07-release.md)                       |

## Convenções aplicadas em todos os sprints

### Stack obrigatória

- **TypeScript 5.5+** com `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`
- **pnpm** workspaces (sem npm/yarn)
- **Vitest** para testes (sem Jest)
- **ESLint** flat config + **Prettier**
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`)

### Princípios de código (não negociáveis)

1. **SOLID** aplicado com bom senso (sem over-engineering)
2. **DRY** — duplicação aceita até a 3ª ocorrência (regra do três)
3. **Tipos primeiro** — domain types antes da implementação
4. **Imutabilidade por padrão** — `readonly`, `ReadonlyArray`, sem mutação fora de boundaries
5. **Dependency Injection** — services recebem deps no construtor, não instanciam
6. **Erros explícitos** — sem `throw` em paths normais; usar `Result<T, E>` ou retornos `null`/`undefined` quando apropriado
7. **Zero `any`** — usar `unknown` + type guards
8. **Funções pequenas** — máx ~30 linhas; se passar, extrair

### Definition of Done universal

Toda task só está concluída quando:

- [ ] Código compila sem warnings (TS strict)
- [ ] `pnpm lint` passa sem erros
- [ ] `pnpm test` passa (testes da task incluídos)
- [ ] Cobertura ≥80% no código novo (Domain e Application)
- [ ] Commit com mensagem Conventional Commits
- [ ] PR linkado à issue/task correspondente

### Estrutura dos arquivos de sprint

Cada `sprint-XX.md` segue o mesmo layout:

1. **Objetivo** — uma frase
2. **Pré-requisitos** — sprints que precisam estar prontos
3. **Tasks** — numeradas, atômicas, com paths e critérios
4. **Testes obrigatórios** — quais devem passar antes de fechar
5. **Definition of Done** — checklist específico do sprint
6. **Prompt para Claude Code** — texto pronto para colar

## Como executar um sprint com Claude Code

### Opção 1: Sprint inteiro de uma vez (recomendado para sprints pequenos)

```bash
cd ~/code/codex-spotlight
claude
> Leia .claude/sprints/sprint-00-foundation.md e execute todas as tasks em ordem.
> Pare e me peça confirmação antes de qualquer commit.
```

### Opção 2: Task a task (recomendado para sprints grandes)

```bash
claude
> Leia .claude/sprints/sprint-02-source-adapters.md e execute apenas a Task 02.3 (ClaudeCodeSource).
> Crie testes primeiro (TDD), depois implementação.
```

### Opção 3: Plan mode antes da execução

```bash
claude --plan
> Leia .claude/sprints/sprint-03-indexer-pipeline.md e me apresente o plano de execução com a ordem das tasks, dependências internas e estimativa de mudanças por arquivo.
```

## Estrutura sugerida do repositório após Sprint 00

```
codex-spotlight/
├── .claude/
│   ├── sprints/                  # estes arquivos
│   └── CLAUDE.md                 # contexto do projeto (criado no Sprint 00)
├── .github/
│   ├── workflows/
│   │   └── ci.yml
│   └── ISSUE_TEMPLATE/
├── apps/
│   ├── main/
│   ├── indexer/
│   └── renderer/
├── packages/
│   ├── domain/
│   ├── contracts/
│   └── test-fixtures/
├── docs/
│   ├── architecture.md
│   └── contributing.md
├── LICENSE                       # Apache 2.0
├── README.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── eslint.config.js
└── .prettierrc
```

## Dependências entre sprints (grafo simplificado)

```
00 ──┬─→ 01 ──┬─→ 02 ──→ 03 ──┐
     │       │                ├─→ 04 ──→ 05 ──→ 06 ──→ 07
     └───────┘                │
                              │
                              └── (Indexer alimenta SearchService)
```

## Métricas para acompanhar progresso

Atualize após cada sprint:

| Sprint | LoC adicionadas | Cobertura | Testes | Status |
| ------ | --------------- | --------- | ------ | ------ |
| 00     | —               | —         | —      | ⬜     |
| 01     | —               | —         | —      | ⬜     |
| 02     | —               | —         | —      | ⬜     |
| 03     | —               | —         | —      | ⬜     |
| 04     | —               | —         | —      | ⬜     |
| 05     | —               | —         | —      | ⬜     |
| 06     | —               | —         | —      | ⬜     |
| 07     | —               | —         | —      | ⬜     |

## Notas finais

- **Nome do projeto:** `codex-spotlight` é placeholder. Antes do Sprint 00, decidir nome final e fazer find-replace global.
- **Repositório:** criar como `<seu-user>/<nome>` no GitHub. Se houver ambição de longo prazo, criar GitHub Org.
- **Comunicação:** abrir Discussions no GitHub desde o Sprint 00 para feedback da comunidade.
