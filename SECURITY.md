# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, use GitHub's private vulnerability reporting:

1. Go to the **Security** tab of this repository.
2. Click **Report a vulnerability**.
3. Fill in the advisory form with as much detail as you can.

This opens a private channel between you and the maintainers.

Please include:

- The type of issue (e.g. local file disclosure, code execution, path traversal).
- The affected component (`apps/main`, `apps/renderer`, an indexer/source adapter, etc.).
- Step-by-step reproduction instructions and, if possible, a proof of concept.
- The impact: what an attacker could achieve.

## What to expect

- We aim to acknowledge a report within **5 business days**.
- We'll keep you informed as we investigate and work on a fix.
- We'll credit you in the advisory once a fix ships, unless you prefer to remain anonymous.

## Scope

AI Session Finder is a **local-first desktop app**: it indexes session data on
your own machine and performs embeddings on-device. Of particular interest:

- Parsing untrusted session files (malformed logs from any source).
- The Electron trust boundary (main ↔ renderer IPC, `contextIsolation`).
- Any path that could read or write files outside the app's data directory.

Thank you for helping keep users safe.
