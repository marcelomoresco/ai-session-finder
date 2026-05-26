# macOS permissions & integration

AI Session Finder is local-first: it reads your AI coding session files on disk
and indexes them on-device. Nothing leaves your machine (the only network use is
the one-time embedding-model download).

## Full Disk Access (optional)

Some session stores live in macOS-protected locations:

| Tool | Location | Needs Full Disk Access? |
| --- | --- | --- |
| Claude Code | `~/.claude/projects` | **No** (not a protected path) |
| Codex CLI | `~/.codex` | **No** in most setups |
| Cursor | `~/Library/Application Support/Cursor/...` | **Yes** — protected |

So you only need Full Disk Access if you want **Cursor** sessions indexed. Claude
Code works out of the box.

**Why we verify with real I/O:** the app never trusts a permissions API that can
false-positive. `PermissionsService.hasFullDiskAccess()` actually attempts to read
Cursor's storage directory and reports the real result.

**Granting it:** System Settings → Privacy & Security → Full Disk Access → add
**AI Session Finder** (the onboarding screen has an "Open System Settings" button
and a "Check again" button).

## Menu-bar (accessory) app

The app runs as a macOS *accessory* (`LSUIElement`): it lives in the menu-bar
tray with no Dock icon. Open the launcher with the global shortcut or the tray's
"Open Launcher".

## Global shortcut

Default: **⌘ + Shift + Space** toggles the launcher from any app. Change it in
Settings → General; the shortcut re-registers immediately. If another app owns
the combo, registration fails and is logged (pick a different one).

## Start at login

Settings → General → "Start at login" uses macOS Login Items and opens the app
hidden (tray only). Toggling it reflects in System Settings → General → Login
Items.

## Privacy

- Indexing and embeddings run entirely on-device.
- Secrets (API keys, tokens, JWTs, private keys) are redacted **before** anything
  is written to the local database.
- Logs contain metadata only — never session content.
