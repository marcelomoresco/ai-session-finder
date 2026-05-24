# Sprint 06 — macOS Integration

## Objetivo

Transformar o app de "janela Electron" em "ferramenta de produtividade macOS de verdade": global shortcut ⌘+Shift+Space, menu bar tray, onboarding de permissões (Full Disk Access), settings page funcional, ícone, sobre tela.

## Pré-requisitos

- Sprint 05 (UI funcional)

## Tasks

### Task 06.1 — Global shortcut

**Arquivos:**

- `apps/main/src/shortcuts.ts`
- `apps/main/src/services/SettingsService.ts`
- `apps/main/src/services/SettingsStore.ts`

**O que fazer:**

```typescript
// shortcuts.ts
import { globalShortcut, BrowserWindow } from 'electron';

export class ShortcutManager {
  constructor(
    private readonly getWindow: () => BrowserWindow | null,
    private readonly settings: SettingsService,
  ) {}

  register(): void {
    const accelerator = this.settings.getLauncherShortcut();
    const success = globalShortcut.register(accelerator, () => this.toggleLauncher());
    if (!success) {
      // log warning, talvez fallback para outro shortcut
    }
  }

  unregister(): void {
    globalShortcut.unregisterAll();
  }

  private toggleLauncher(): void {
    const win = this.getWindow();
    if (!win) return;
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  }
}
```

`SettingsService` persiste em JSON simples em `userData/settings.json`:

```typescript
export interface AppSettings {
  readonly launcherShortcut: string; // default 'CommandOrControl+Shift+Space'
  readonly theme: 'system' | 'light' | 'dark';
  readonly semanticSearchEnabled: boolean;
  readonly autoStartOnLogin: boolean;
}

export class SettingsService {
  constructor(private readonly store: SettingsStore) {}

  get(): AppSettings {
    return this.store.read();
  }
  update(partial: Partial<AppSettings>): void {
    this.store.write({ ...this.store.read(), ...partial });
  }
  getLauncherShortcut(): string {
    return this.get().launcherShortcut;
  }
}
```

**Critério de aceite:**

- ⌘+Shift+Space abre/fecha launcher em qualquer app
- Trocar shortcut em Settings atualiza imediatamente
- Conflito com shortcut do sistema reporta erro

---

### Task 06.2 — Menu bar tray

**Arquivos:**

- `apps/main/src/tray.ts`
- `apps/main/resources/tray-icon.png` (1x e 2x, ambos templated)
- `apps/main/resources/tray-icon@2x.png`

**O que fazer:**

```typescript
import { Tray, Menu, nativeImage } from 'electron';

export class TrayController {
  private tray: Tray | null = null;

  constructor(
    private readonly openLauncher: () => void,
    private readonly openSettings: () => void,
    private readonly reindex: () => void,
    private readonly quit: () => void,
  ) {}

  start(): void {
    const icon = nativeImage.createFromPath(getTrayIconPath()).resize({ width: 18, height: 18 });
    icon.setTemplateImage(true);
    this.tray = new Tray(icon);
    this.refreshMenu();
  }

  refreshMenu(stats?: { indexed: number; lastSync: Date | null }): void {
    const menu = Menu.buildFromTemplate([
      { label: 'Open Launcher', accelerator: 'CmdOrCtrl+Shift+Space', click: this.openLauncher },
      { type: 'separator' },
      { label: stats ? `${stats.indexed} sessions indexed` : 'Indexing…', enabled: false },
      { label: 'Reindex now', click: this.reindex },
      { type: 'separator' },
      { label: 'Settings…', click: this.openSettings },
      { label: 'About Codex Spotlight', click: () => app.showAboutPanel() },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: this.quit },
    ]);
    this.tray?.setContextMenu(menu);
  }
}
```

**Critério de aceite:**

- Ícone aparece na barra de menu
- Template image respeita dark/light mode
- Menu reflete estado de indexação atualizado

---

### Task 06.3 — Window behavior (frameless, hide-on-blur)

**Arquivos:**

- `apps/main/src/window/createLauncherWindow.ts`

**O que fazer:**

```typescript
export function createLauncherWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 720,
    height: 480,
    frame: false,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    resizable: false,
    movable: true,
    show: false,
    fullscreenable: false,
    skipTaskbar: true,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.on('blur', () => win.hide());
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  return win;
}
```

**Critério de aceite:**

- Launcher aparece centralizado
- Blur esconde
- Funciona em fullscreen apps
- Sem dock icon (skipTaskbar + dock.hide() se quiser modo accessory)

---

### Task 06.4 — Permissions onboarding

**Arquivos:**

- `apps/renderer/src/pages/OnboardingPage.tsx`
- `apps/renderer/src/pages/onboarding/PermissionsStep.tsx`
- `apps/renderer/src/pages/onboarding/IndexingStep.tsx`
- `apps/main/src/services/PermissionsService.ts`

**O que fazer:**

`PermissionsService` testa acesso real (não confia em API que pode dar false positive):

```typescript
export class PermissionsService {
  async hasFullDiskAccess(): Promise<boolean> {
    const cursorPath = path.join(
      os.homedir(),
      'Library/Application Support/Cursor/User/workspaceStorage',
    );
    try {
      await fs.access(cursorPath, fs.constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  openSystemSettings(): void {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles');
  }
}
```

`PermissionsStep` UI:

- Explicação de POR QUE precisa (com link pro código aberto)
- Botão "Open System Settings"
- Botão "Check again" que re-verifica
- Skip se usuário só quer Claude Code (que tá em `~/.claude` e não precisa FDA)

**Critério de aceite:**

- Primeira run mostra onboarding
- Após permissão concedida, salva flag `onboardingCompleted: true`
- Re-acionar via "Help → Reset onboarding"

---

### Task 06.5 — Settings page completa

**Arquivos:**

- `apps/renderer/src/pages/SettingsPage.tsx`
- `apps/renderer/src/pages/settings/GeneralSection.tsx`
- `apps/renderer/src/pages/settings/SourcesSection.tsx`
- `apps/renderer/src/pages/settings/SearchSection.tsx`
- `apps/renderer/src/pages/settings/AboutSection.tsx`

**O que fazer:**
4 seções:

**General:**

- Launcher shortcut (com ShortcutRecorder component)
- Theme (system/light/dark)
- Auto-start on login (toggle)

**Sources:**

- Lista das 3 sources com toggle individual
- Estatística: "N sessões indexadas | última: X minutos atrás"
- Botão "Reindex all"

**Search:**

- Toggle "Enable semantic search" (com warning sobre tamanho do modelo)
- Botão "Clear search index" (com confirmação)
- Toggle "Encrypt database" (Pro feature opcional)

**About:**

- Versão, link GitHub, link Discord/Discussions, license
- Botão "Check for updates" (placeholder até Sprint 07)
- Créditos

**Critério de aceite:**

- Todas as configs persistem entre restarts
- Mudança de shortcut re-registra global shortcut
- Toggle de source desativa watcher correspondente
- Cobertura ≥75% (UI é menos crítica)

---

### Task 06.6 — Auto-start on login

**Arquivo:** `apps/main/src/services/AutoStartService.ts`

**O que fazer:**

```typescript
export class AutoStartService {
  enable(): void {
    app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true });
  }

  disable(): void {
    app.setLoginItemSettings({ openAtLogin: false });
  }

  isEnabled(): boolean {
    return app.getLoginItemSettings().openAtLogin;
  }
}
```

Sincronizar com settings.

**Critério de aceite:**

- Toggle reflete em System Settings → Login Items
- Reabrir mac inicia app oculta (tray ativa)

---

### Task 06.7 — App icon + branding

**Arquivos:**

- `apps/main/resources/icon.icns` (gerado de SVG mestre)
- `apps/main/resources/icon.png` (1024x1024)
- `apps/renderer/src/assets/logo.svg`
- `apps/main/electron-builder.yml` (referencia o icon)

**O que fazer:**

- Designar/gerar ícone (placeholder pode ser um SVG simples com letra C+S)
- Gerar `.icns` com `iconutil` ou ferramenta online
- Configurar no `electron-builder.yml`

**Critério de aceite:**

- Ícone aparece no Dock (se mostrado), Finder, About panel
- About panel mostra logo, versão, copyright

---

## Testes obrigatórios deste sprint

- `SettingsService` persist/restore
- `PermissionsService` happy + denied path (mock fs)
- E2E: Onboarding → Permissions → primeira indexação

## Definition of Done (Sprint 06)

- [ ] ⌘+Shift+Space funciona globalmente
- [ ] Tray icon presente e funcional
- [ ] Onboarding completa em <2 min para usuário novo
- [ ] Settings persistem entre restarts
- [ ] Auto-start funciona
- [ ] App roda em modo "accessory" (sem dock icon, só tray)
- [ ] `docs/macos-permissions.md` explica cada permissão

---

## Prompt para Claude Code

```
Você é um engenheiro sênior implementando o Sprint 06 do projeto Codex Spotlight.

Leia .claude/sprints/sprint-06-macos-integration.md e execute as 7 tasks em ordem.

Regras críticas:
1. Tudo macOS-specific deve estar isolado em arquivos que checam `process.platform === 'darwin'`
2. Permissões: NUNCA assumir, sempre verificar com I/O real
3. Tray icon DEVE ser template image (PNG preto monocromático com transparência)
4. Settings persistem em JSON, NÃO em electron-store (deps demais; rolar com fs nativo)
5. Para gerar icon.icns sem ferramenta externa, usar `npx png2icons` ou similar
6. Auto-start: testar manualmente após implementar (não dá pra testar em CI)

Comece pela Task 06.1.
```
