# Launch playbook — AI Session Finder v0.1.0

Distribution for the MVP is **GitHub Releases + Homebrew only** (no landing page).
Everything social is posted **manually on the day** — nothing here is automated.

## Pre-flight (T-7 days)

- [ ] DMG v0.1.0 published on GitHub Releases (arm64 + x64), unsigned
- [ ] `Right-click → Open` workaround documented in README
- [ ] Homebrew cask live in `marcelomoresco/homebrew-tap`, `brew install --cask` verified
- [ ] README polished: tagline, badges, screenshot/GIF, install
- [ ] 3 people install on different Macs (Intel + Apple Silicon) and smoke-test
- [ ] 30s + 2min demo recordings

## T-3 days

- [ ] Soft heads-up post in /r/Cursor or /r/ClaudeAI with a "feedback wanted" tone

## T = 0 (launch day — all manual)

- [ ] **6:00 EST** — Submit Show HN (title + body below)
- [ ] **6:05** — Thread on X
- [ ] **6:10** — Posts in /r/ClaudeAI, /r/OpenAI
- [ ] **6:30** — Own HN comment with technical context (Cursor SQLite WAL story)
- [ ] **All day** — reply to every comment within ~30 min

## T+1

- [ ] Indie Hackers post
- [ ] DEV.to writeup: reverse-engineering Cursor's SQLite chat store

## T+7

- [ ] Retro: what worked, what to change
- [ ] Plan next sprint from feedback

---

## Copy-paste templates

**Show HN title**

```
Show HN: AI Session Finder – Spotlight for Claude Code, Codex, and Cursor sessions
```

**Show HN body**

```
Hi HN — I built this because I have 50+ AI coding sessions across Claude Code,
Codex CLI, and Cursor, and finding "the session where I fixed that webhook bug"
was impossible.

AI Session Finder indexes all your local sessions and lets you search them with
full-text + semantic search via ⌘+Shift+Space. Everything runs locally, no
telemetry, fully open source (Apache 2.0).

Stack: Electron + TypeScript, SQLite with FTS5 + sqlite-vec, Transformers.js for
on-device embeddings.

The hardest part was Cursor — its chat history lives in a SQLite DB with WAL
locking, so I copy it to a temp file when it's locked. Writeup of the format: [link]

It ships unsigned for now (no Apple Developer ID yet) — install via Homebrew
(`brew install --cask ai-session-finder`) or download the DMG and Right-click → Open.

Looking for feedback on UX, which tool to support next (Aider?), and bug reports.

GitHub: https://github.com/marcelomoresco/ai-session-finder
```

> ⚠️ Reminder: do NOT script these posts. Timing, subreddit etiquette, and tone
> matter more than automation. Post by hand and stay present for replies.
