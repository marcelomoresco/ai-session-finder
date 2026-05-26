cask "ai-session-finder" do
  version "0.2.1"

  on_arm do
    sha256 "REPLACE_WITH_ARM64_DMG_SHA256" # shasum -a 256 ai-session-finder-0.1.0-arm64.dmg
    url "https://github.com/marcelomoresco/ai-session-finder/releases/download/v#{version}/ai-session-finder-#{version}-arm64.dmg"
  end
  on_intel do
    sha256 "REPLACE_WITH_X64_DMG_SHA256" # shasum -a 256 ai-session-finder-0.1.0-x64.dmg
    url "https://github.com/marcelomoresco/ai-session-finder/releases/download/v#{version}/ai-session-finder-#{version}-x64.dmg"
  end

  name "AI Session Finder"
  desc "Local search across Claude Code, Codex CLI, and Cursor sessions"
  homepage "https://github.com/marcelomoresco/ai-session-finder"

  # No published appcast yet; electron-updater drives in-app updates.
  app "AI Session Finder.app"

  # MVP ships unsigned (no Apple Developer ID). Strip the quarantine flag so
  # Gatekeeper lets the app launch without the manual Right-click → Open dance.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/AI Session Finder.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/AI Session Finder",
    "~/Library/Logs/AI Session Finder",
    "~/Library/Preferences/dev.marcelomoresco.ai-session-finder.plist",
    "~/Library/Saved Application State/dev.marcelomoresco.ai-session-finder.savedState",
  ]
end
