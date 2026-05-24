# Getting Started — Como estruturar e começar

> Guia prático: do zero até "primeiro commit do Sprint 00" em ~20 minutos.

## Visão do fluxo completo

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Você cria repo vazio no GitHub                              │
│  2. Clona local, copia arquivos de sprint pra .claude/sprints/  │
│  3. Abre Claude Code dentro do repo                             │
│  4. Cola o prompt do Sprint 00                                  │
│  5. Claude Code lê o sprint e executa task por task             │
│  6. Você revisa diffs, aprova commits                           │
│  7. Quando Sprint 00 termina, repete para Sprint 01, 02, ...    │
└─────────────────────────────────────────────────────────────────┘
```

Loop é sempre o mesmo: **abrir sprint → executar → revisar → commitar → próximo sprint**.

## Passo 1 — Decidir o nome final

Antes de tudo, escolhe o nome. Sugestões:

| Nome              | Pros                    | Cons                              |
| ----------------- | ----------------------- | --------------------------------- |
| `recall`          | Curto, descritivo       | Genérico (vários produtos chamam) |
| `stash`           | Curto, evoca "guardado" | git stash já existe               |
| `replay`          | Sugere voltar à sessão  | Comum                             |
| `trail`           | "Trilha das sessões"    | Confunde com debug trails         |
| `lookback`        | Sugere histórico        | Um pouco longo                    |
| `coda`            | Latim p/ "final", curto | Disambig com Coda.io              |
| `aura`            | Curto, único            | Não descreve nada                 |
| `codex-spotlight` | Descritivo              | Confunde com OpenAI Codex         |

**Meu pick:** `recall` ou `stash`. Vou usar `recall` como placeholder nos comandos abaixo — substitui pelo seu nome final.

## Passo 2 — Criar repositório no GitHub

```bash
# Pelo gh CLI (recomendado)
gh repo create recall \
  --public \
  --description "Spotlight for Claude Code, Codex, and Cursor sessions" \
  --license apache-2.0 \
  --clone

cd recall
```

Ou manualmente:

1. Acessa github.com/new
2. Nome: `recall` (ou seu pick)
3. Public
4. Add README, .gitignore (Node), license Apache 2.0
5. Clone localmente

## Passo 3 — Copiar arquivos de sprint

Os arquivos `ROADMAP.md` e `sprint-*.md` foram entregues na sessão. Vamos colocá-los em `.claude/sprints/` dentro do repo (assim Claude Code consegue ler facilmente):

```bash
cd ~/code/recall   # ou onde clonou

mkdir -p .claude/sprints

# Copia os arquivos da pasta de outputs deste chat
cp ~/Downloads/sprints/*.md .claude/sprints/
# ou se baixou em outro lugar, ajusta o path

# Verifica
ls .claude/sprints/
# Deve listar: ROADMAP.md, sprint-00-foundation.md, ..., sprint-07-release.md
```

## Passo 4 — Find-replace do nome do projeto

Os arquivos de sprint usam `codex-spotlight` como placeholder. Troca tudo de uma vez:

```bash
# Mac: usar sed inline (vai criar backups .bak que depois você apaga)
find .claude/sprints -name "*.md" -exec sed -i.bak 's/codex-spotlight/recall/g' {} \;
find .claude/sprints -name "*.md" -exec sed -i.bak 's/Codex Spotlight/Recall/g' {} \;

# Verifica que não sobrou nenhum
grep -r "codex-spotlight" .claude/sprints/  # deve não retornar nada

# Limpa backups
find .claude/sprints -name "*.bak" -delete
```

## Passo 5 — Estrutura final esperada (antes do Sprint 00)

```
recall/
├── .claude/
│   └── sprints/
│       ├── ROADMAP.md
│       ├── sprint-00-foundation.md
│       ├── sprint-01-domain-persistence.md
│       ├── sprint-02-source-adapters.md
│       ├── sprint-03-indexer-pipeline.md
│       ├── sprint-04-services-ipc.md
│       ├── sprint-05-ui-launcher.md
│       ├── sprint-06-macos-integration.md
│       └── sprint-07-release.md
├── .gitignore
├── LICENSE
└── README.md
```

## Passo 6 — Commit inicial

```bash
git add .claude/
git commit -m "docs: add sprint roadmap and execution plan"
git push origin main
```

## Passo 7 — Primeira sessão Claude Code

```bash
# Garante que tem Claude Code instalado
which claude
# Se não tiver: https://docs.claude.com/en/docs/claude-code/install

# Abre Claude Code DENTRO do repo
cd ~/code/recall
claude
```

Cola este prompt:

```
Você é um engenheiro sênior implementando o Sprint 00 do projeto Recall.

Leia .claude/sprints/sprint-00-foundation.md e execute todas as 9 tasks em ordem (00.1 a 00.9).

Antes de começar, leia também .claude/sprints/ROADMAP.md para entender o contexto geral.

Regras:
1. Pare e me peça confirmação antes de fazer commit
2. Após cada task, rode os comandos de verificação e me reporte o resultado
3. Use Conventional Commits para cada chunk lógico (1 commit por task ou agrupado por tema)
4. Se algo no spec não fizer sentido na prática, me consulte antes de improvisar
5. Versões de dependências: use as mais recentes estáveis disponíveis no momento da execução, não decore as do documento

Comece pela Task 00.1.
```

## Passo 8 — Loop de revisão

Para cada task que Claude Code completar:

1. **Leia o diff** — `git diff` ou veja na UI do Claude Code
2. **Rode os comandos de verificação** mencionados na task (`pnpm typecheck`, `pnpm test`, etc)
3. **Se tudo OK:** aprove o commit
4. **Se houver problema:** descreva o problema e peça correção

Quando o Sprint 00 terminar:

```bash
# Cria branch para o sprint (opcional mas recomendado)
git checkout -b sprint-01-domain
```

E abre nova sessão Claude Code com o prompt do Sprint 01.

## Padrões de trabalho recomendados

### Branch por sprint

```bash
git checkout -b sprint-XX-tema
# trabalha, commita
git push -u origin sprint-XX-tema
# abre PR pra main, mergeia quando satisfeito
```

### Plan mode antes de sprints grandes

Sprints 02, 03 e 05 são densos. Vale usar plan mode antes:

```bash
claude --plan
> Leia .claude/sprints/sprint-02-source-adapters.md e me apresente o plano de execução com ordem das tasks, dependências internas e estimativa de mudanças por arquivo. Não execute nada ainda.
```

Revisa o plano, ajusta se necessário, daí roda em modo normal.

### CLAUDE.md vivo

O arquivo `.claude/CLAUDE.md` (criado no Sprint 00) é lido por toda nova sessão. Atualiza ele quando:

- Mudar stack/biblioteca
- Adicionar convenção nova
- Documentar uma "pegadinha" recorrente

### Quando dividir uma sessão Claude Code

Cada sprint = 1 sessão. Não tenta fazer 2 sprints na mesma janela — contexto fica pesado e Claude perde o fio.

### Commits

Convencione: 1 task = 1 commit (ou commits agrupados por subtema):

```
feat(domain): add Session, Turn, SearchQuery types
test(domain): add property tests for branded types
chore(domain): export public API from index.ts
```

## Próximos passos imediatos

Faz nessa ordem:

1. [ ] Decidir nome (mesmo que provisório)
2. [ ] Criar repo GitHub
3. [ ] Copiar arquivos de sprint para `.claude/sprints/`
4. [ ] Find-replace do nome
5. [ ] Commit inicial
6. [ ] Abrir Claude Code, colar prompt do Sprint 00
7. [ ] Tomar um café enquanto Claude bota o esqueleto pra rodar

Estimativa pro Sprint 00: ~2-3h de wall-clock (1h Claude trabalhando, 1-2h você revisando).

## Quando voltar pra mim

Volta aqui pra discutir comigo se:

- Algo no spec ou no sprint não fizer sentido na prática
- Quiser ajustar prioridades (ex: pular Cursor source, focar só em Claude Code)
- Tomar decisões grandes (nome, licença, naming de pacote)
- Quiser repensar arquitetura depois de aprender algo novo no caminho
- Precisar de um novo sprint (ex: "Sprint 08 — Aider source")

Posso também:

- Bootstrap o repositório real localmente (todos os arquivos do Sprint 00 prontos, você só `pnpm install`)
- Escrever a landing page do Sprint 07 antes de chegar lá (pra começar a coletar emails de waitlist)
- Fazer o POC do parser Claude Code em Python (valida tese end-to-end em 1h)
- Refinar qualquer sprint se a execução revelar buracos
