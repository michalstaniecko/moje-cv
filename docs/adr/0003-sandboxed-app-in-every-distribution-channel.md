# The app is sandboxed in every distribution channel and shares one data container

The Mac App Store requires App Sandbox, which moves the app's data from `~/Library/Application Support/Moje CV` into `~/Library/Containers/com.michalstaniecko.mojecv/`. We decided that the notarized Developer ID `.dmg` is sandboxed too, with the same bundle ID, so both channels read and write the same container and a user can switch between them without ending up with two separate CV libraries. Data from the earlier unsandboxed builds is moved into the container by macOS on first launch through `container-migration.plist`, with JSON export/import as the documented fallback. The data folder name is pinned to `Moje CV` independently of `productName`, so renaming the app never moves the data or invalidates the migration. Inside App Sandbox the `.dmg` cannot keep Chromium's own sandbox, so its helpers rely on App Sandbox alone, like the Mac App Store build (ADR-0007).

## Considered Options

- **Unsandboxed `.dmg` alongside the sandboxed MAS build**: rejected, because it means two libraries on one Mac and two sets of behaviour to test.
- **Migration wizard (user picks the old folder via an open dialog)**: rejected for now, because `container-migration.plist` does the same with no code.
- **Temporary-exception entitlement for the old path**: rejected, because App Review often turns it down.
