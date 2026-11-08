# The Developer ID build turns off Chromium's own sandbox and relies on App Sandbox

Status: proposed, pending confirmation by the owner.

The regular (non-MAS) Electron build confines its helper processes (renderer, GPU, network) in Chromium's own Seatbelt sandbox. A process that already runs inside App Sandbox (ADR-0003) cannot apply a second Seatbelt profile, so with App Sandbox on, every helper of the Developer ID `.dmg` exits at start ("sandbox initialization failed: Operation not permitted") and the window never opens. We decided that the sandboxed `.dmg` starts Chromium with `no-sandbox` (`src/main/appSandbox.ts`, only when `APP_SANDBOX_CONTAINER_ID` is set and `process.mas` is false), so its renderers are confined only by App Sandbox, which every helper inherits through `com.apple.security.inherit` (`build/entitlements.inherit.plist`). This is how the Mac App Store Electron build works anyway: it ships without Chromium's sandbox and relies on App Sandbox alone. Both channels therefore get the same confinement.

The trade-off: a compromised renderer is limited by App Sandbox, the same as the main process (the container, files the user picked in a dialog and, in the `.dmg` only, outgoing network connections), instead of the stricter per-process Chromium profile, which also denies file and network access to renderers. The renderers only load the app's own bundled code (no remote content), which keeps this risk small.

## Considered Options

- **Unsandboxed `.dmg` with Chromium's sandbox**: rejected by ADR-0003 (two data libraries on one Mac).
- **Building the `.dmg` from the MAS Electron build**: rejected. The MAS variant hides Developer ID only features through `process.mas` (Sponsor bar, update check, ADR-0005/0006) and is not meant for distribution outside the store.
- **Keeping Chromium's sandbox inside App Sandbox**: not possible, helpers cannot start.
