# Homebrew install

AI Session Finder ships as an **unsigned** macOS app (no Apple Developer ID in
the MVP). The cask strips the quarantine flag on install so it launches without
the manual `Right-click → Open` workaround.

## MVP: personal tap

The app isn't in the official `homebrew/cask` yet (that needs a notability PR —
deferred). Use the personal tap:

```bash
brew tap marcelomoresco/tap            # one-time
brew install --cask ai-session-finder
```

Upgrade / uninstall:

```bash
brew upgrade --cask ai-session-finder
brew uninstall --cask ai-session-finder --zap   # --zap also removes settings + index
```

## The cask

[`Casks/ai-session-finder.rb`](../Casks/ai-session-finder.rb) is the source of
truth: arch-specific URLs (arm64 + x64) pointing at the GitHub Release DMGs.
After each release, [`.github/workflows/homebrew.yml`](../.github/workflows/homebrew.yml)
opens a PR bumping the version + `sha256`.

### First release — fill the sha256 by hand

```bash
shasum -a 256 apps/main/release/ai-session-finder-0.1.0-arm64.dmg
shasum -a 256 apps/main/release/ai-session-finder-0.1.0-x64.dmg
```

Paste each digest into the matching `on_arm` / `on_intel` block.

## Tap setup (one-time)

1. Create a public repo `marcelomoresco/homebrew-tap`.
2. Copy `Casks/ai-session-finder.rb` into it under `Casks/`.
3. Create a PAT with `repo` scope; add it as the `HOMEBREW_TOKEN` secret on this
   repo so the bump workflow can open PRs.

## Official homebrew/cask (later)

Submitting to `homebrew/cask` means meeting their notability rules and opening a
PR. **Do not submit until we decide to** — it's a deliberate, manual launch step.
