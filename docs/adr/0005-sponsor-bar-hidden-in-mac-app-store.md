# The Sponsor bar is shown in every channel except the Mac App Store, detected at runtime

The Sponsor bar links to GitHub Sponsors, an external payment page. App Store Review Guideline 3.1.1 forbids links that lead users to purchase outside the store, and donation links have been a common rejection reason even in free apps. We decided that the main process hides the Sponsor bar whenever Electron reports a Mac App Store build (`process.mas`) and shows it in every other channel (the Developer ID `.dmg` today, any future Windows/Linux build). The renderer only receives a boolean and never decides itself. No build flag, environment variable or packaging config carries the choice, so a MAS target can be added to `electron-builder.yml` later without touching the bar.

## Considered Options

- **Same bar with the link in every channel**: rejected, because a rejection in App Review costs a resubmission cycle for a feature unrelated to the app's purpose.
- **Text-only bar in MAS ("free and open source", no link)**: rejected for now, because a bar that cannot be acted on is noise; it can be reconsidered if Apple's stance on donation mentions changes.
- **Build-time flag (`define` in electron-vite or env var)**: rejected, because `process.mas` already encodes exactly the same fact and cannot drift from the actual package.
