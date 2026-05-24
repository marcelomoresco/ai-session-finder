# Sprint 07 — Release

## Objetivo

Empacotar app em DMG, configurar release automatizado, publicar landing page estática, polir README, preparar playbook de lançamento (Show HN, Reddit, Product Hunt).

## Pré-requisitos

- Todos os sprints anteriores
- Conta GitHub com repo público
- (Opcional) Apple Developer ID para signing/notarization
- Domínio para landing (`codex-spotlight.dev` ou similar)

## Tasks

### Task 07.1 — `electron-builder` config

**Arquivos:**

- `electron-builder.yml`
- `apps/main/package.json` (scripts de build)

**O que fazer:**

```yaml
# electron-builder.yml
appId: dev.codex-spotlight.app
productName: Codex Spotlight
copyright: Copyright © 2026 Codex Spotlight contributors
asar: true

directories:
  output: dist-electron
  buildResources: apps/main/resources

files:
  - apps/main/dist/**/*
  - apps/renderer/dist/**/*
  - apps/indexer/dist/**/*
  - node_modules/**/*
  - '!**/*.{md,txt,test.ts,spec.ts}'
  - '!**/__tests__/**'

mac:
  category: public.app-category.developer-tools
  target:
    - target: dmg
      arch: [arm64, x64]
    - target: zip
      arch: [arm64, x64]
  icon: apps/main/resources/icon.icns
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: apps/main/resources/entitlements.mac.plist
  entitlementsInherit: apps/main/resources/entitlements.mac.plist
  extendInfo:
    LSUIElement: 1 # accessory app (no dock icon by default)
    NSCameraUsageDescription: false
    NSMicrophoneUsageDescription: false

dmg:
  sign: false # MVP unsigned, mover para true depois
  contents:
    - x: 130
      y: 220
    - x: 410
      y: 220
      type: link
      path: /Applications

publish:
  - provider: github
    owner: codex-spotlight
    repo: codex-spotlight
    releaseType: release
```

`entitlements.mac.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
</dict>
</plist>
```

**Critério de aceite:**

- `pnpm dist` gera DMG arm64 e x64 em `dist-electron/`
- DMG abre e instala em Mac limpo
- App roda mesmo unsigned (com `Right-click → Open` workaround)

---

### Task 07.2 — GitHub Release workflow

**Arquivo:** `.github/workflows/release.yml`

**O que fazer:**

```yaml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: macos-14
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm dist
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - uses: softprops/action-gh-release@v2
        with:
          files: |
            dist-electron/*.dmg
            dist-electron/*.zip
            dist-electron/latest-mac.yml
          generate_release_notes: true
          draft: false
          prerelease: ${{ contains(github.ref, '-rc') || contains(github.ref, '-beta') }}
```

**Critério de aceite:**

- Push tag `v0.1.0` dispara build e cria release com DMG anexado
- Release notes auto-geradas a partir de commits

---

### Task 07.3 — Homebrew Cask

**Arquivos:**

- `.github/workflows/homebrew.yml`
- `docs/HOMEBREW.md`

**O que fazer:**
Workflow que abre PR no `homebrew-cask` após release:

```yaml
name: Update Homebrew Cask
on:
  release:
    types: [released]

jobs:
  bump:
    runs-on: macos-14
    steps:
      - uses: macauley/action-homebrew-bump-cask@v1
        with:
          token: ${{ secrets.HOMEBREW_TOKEN }}
          tap: homebrew/cask
          cask: codex-spotlight
          tag: ${{ github.event.release.tag_name }}
```

Antes do primeiro release, criar manualmente:

```ruby
# Casks/codex-spotlight.rb
cask "codex-spotlight" do
  version "0.1.0"
  sha256 "abc123..."

  url "https://github.com/codex-spotlight/codex-spotlight/releases/download/v#{version}/Codex-Spotlight-#{version}-arm64.dmg"
  name "Codex Spotlight"
  desc "Search across Claude Code, Codex CLI, and Cursor sessions"
  homepage "https://codex-spotlight.dev"

  app "Codex Spotlight.app"

  zap trash: [
    "~/Library/Application Support/codex-spotlight",
    "~/Library/Logs/codex-spotlight",
    "~/Library/Preferences/dev.codex-spotlight.app.plist",
  ]
end
```

**Critério de aceite:**

- `brew install --cask codex-spotlight` funciona após PR mergeado
- `brew uninstall --cask codex-spotlight --zap` remove tudo

---

### Task 07.4 — Landing page

**Arquivos:**

- `landing/` (Astro project)
- `landing/src/pages/index.astro`
- `landing/src/components/Hero.astro`
- `landing/src/components/Features.astro`
- `landing/src/components/Demo.astro`
- `landing/src/components/Install.astro`
- `landing/src/components/FAQ.astro`

**O que fazer:**
Astro + Tailwind. Páginas:

- `/` — hero, features, demo (GIF/video), install snippet, FAQ, footer
- `/docs` — proxy/redirect para README do GitHub
- `/changelog` — gerado a partir de releases

Hero:

```
Spotlight para suas sessões de AI coding.
Busca unificada em Claude Code, Codex CLI e Cursor — tudo local, tudo open source.

[Download for macOS]   [View on GitHub →]

⌘+Shift+Space para abrir
```

Demo: vídeo de 30s mostrando busca → preview → resume.

**Deploy:** Cloudflare Pages (grátis, build automático no push).

**Critério de aceite:**

- Lighthouse: Perf ≥95, A11y ≥95, SEO ≥95
- Cross-browser: Safari, Chrome, Firefox
- OG image gerada (1200x630)

---

### Task 07.5 — README polido

**Arquivo:** `README.md`

**Conteúdo:**

1. Hero badge (logo, tagline)
2. Badges (license, downloads, CI status)
3. Screenshot/GIF
4. Install (Homebrew + DMG)
5. Features (bullets curtos)
6. Architecture (link p/ docs)
7. Contributing (link)
8. License

**Critério de aceite:**

- GitHub renderiza sem warnings
- Screenshots/GIF carregam
- Links funcionam

---

### Task 07.6 — Auto-update (electron-updater)

**Arquivos:**

- `apps/main/src/services/UpdateService.ts`

**O que fazer:**

```typescript
import { autoUpdater } from 'electron-updater';

export class UpdateService {
  constructor(private readonly logger: Logger) {
    autoUpdater.logger = logger as never;
    autoUpdater.autoDownload = false;
  }

  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const result = await autoUpdater.checkForUpdates();
      return result?.updateInfo ?? null;
    } catch (err) {
      this.logger.warn({ err: String(err) }, 'update check failed');
      return null;
    }
  }

  async downloadAndInstall(): Promise<void> {
    await autoUpdater.downloadUpdate();
    autoUpdater.quitAndInstall();
  }
}
```

Trigger automático a cada 6h + manual via tray menu + settings.

**Critério de aceite:**

- Detecta nova versão no GitHub Releases
- Modal pergunta antes de instalar (não atualiza silenciosamente)
- Fallback gracioso se update server offline

---

### Task 07.7 — Launch playbook

**Arquivo:** `docs/LAUNCH.md`

**Conteúdo:**

Cronograma sugerido (segunda-feira 6am EST, sweet spot HN):

**T-7 dias:**

- [ ] Landing page no ar
- [ ] DMG v0.1.0 publicado
- [ ] README polido com screenshots/GIF
- [ ] 3 pessoas testando em Macs diferentes
- [ ] Vídeo demo de 30s e 2min

**T-3 dias:**

- [ ] Tweet teaser
- [ ] Postar em /r/Cursor com tom de "feedback wanted"

**T=0 (Lançamento):**

- [ ] **6am EST:** Submit "Show HN: Codex Spotlight — Spotlight for AI coding sessions"
- [ ] **6:05:** Thread no Twitter/X
- [ ] **6:10:** Post em /r/ClaudeAI, /r/OpenAI (codex)
- [ ] **6:30:** Comment próprio no HN com contexto técnico
- [ ] **Durante o dia:** responder TODOS os comentários em <30min

**T+1 dia:**

- [ ] Indie Hackers post
- [ ] DEV.to artigo técnico (sobre Cursor SQLite reverse-engineering)

**T+7 dias:**

- [ ] Retrospectiva: o que funcionou, o que pivotar
- [ ] Próximo sprint baseado em feedback

**Mensagens prontas:**

Show HN title:

```
Show HN: Codex Spotlight – Spotlight for Claude Code, Codex, and Cursor sessions
```

Show HN body:

```
Hi HN — I built this because I have 50+ AI coding sessions across Claude Code, Codex CLI, and Cursor, and finding "the session where I fixed that webhook bug" was impossible.

Codex Spotlight indexes all your local sessions and lets you search them with FTS + semantic search via ⌘+Shift+Space. Everything runs locally, no telemetry, fully open source (Apache 2.0).

Stack: Electron + TypeScript, SQLite with FTS5 + sqlite-vec, Transformers.js for embeddings (nomic-embed-text running on-device).

The hardest part was Cursor — its chat history lives in SQLite with WAL locking, so I had to write a fallback that copies the DB to tmp when it's locked. Writeup of the format: [link]

Looking for feedback on UX, missing tools to support (Aider next?), and bug reports.

GitHub: https://github.com/codex-spotlight/codex-spotlight
Download: https://codex-spotlight.dev
```

**Critério de aceite:**

- Playbook executável por alguém que não seja você (caso esteja viajando)
- Templates prontos para copiar-colar

---

## Definition of Done (Sprint 07)

- [ ] DMG v0.1.0 publicado no GitHub Releases
- [ ] Homebrew cask submetido
- [ ] Landing page online
- [ ] Auto-update funcionando
- [ ] Playbook de lançamento documentado
- [ ] README polido
- [ ] Tag `v0.1.0` no repo

---

## Prompt para Claude Code

```
Você é um engenheiro sênior implementando o Sprint 07 do projeto Codex Spotlight.

Leia .claude/sprints/sprint-07-release.md e execute as 7 tasks em ordem.

Regras críticas:
1. NÃO assinar/notarizar no MVP (custa $99/ano de Apple Developer + complexidade). Lançar unsigned e documentar workaround Right-click → Open
2. Landing page: ZERO JavaScript de tracking. Sem GA, sem Plausible no MVP. Privacidade é parte da pitch.
3. Antes de criar o release, fazer dry-run completo: build local, instalar em Mac limpo, smoke test
4. Para a tag v0.1.0, gerar release notes a partir dos commits dos sprints
5. NÃO automatizar tweet/post — pede MUITO cuidado, fazer manual no dia
6. Pare e me consulte antes de:
   - Publicar release
   - Submeter Homebrew PR
   - Lançar landing publicamente

Comece pela Task 07.1.
```
