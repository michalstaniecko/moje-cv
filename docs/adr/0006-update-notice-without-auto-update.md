# The `.dmg` build tells the user about a new version but never updates itself

A user who downloaded CV Press from GitHub Releases has no way of learning that a newer version exists, while the Mac App Store build gets updates from the store. We decided that the `.dmg` build asks the GitHub Releases API (`/repos/michalstaniecko/moje-cv/releases/latest`) at most once every 24 hours, about 10 seconds after start, and on demand from Help → "Check for Updates…". It compares the `vX.Y.Z` tag with `app.getVersion()` and only informs: an Update notice in the CV library and a native dialog. It never downloads or installs anything. The request carries no identifiers (only `User-Agent: CV-Press/<version>`), and network errors, timeouts, rate limits and odd responses are silent at startup. "Download" opens the release page built from a constant and the verified version, never a URL taken from the response.

The Mac App Store build has no check at all: no service, no timer, no menu item and no network request, decided by the same `process.mas` rule as ADR-0005 (`isMacAppStore()`), so its "Data Not Collected" privacy label stays true. Only the Developer ID `.dmg` entitlements get `com.apple.security.network.client`, without which the sandboxed app (ADR-0003) could not reach GitHub. A release is a published GitHub Release tagged `vX.Y.Z`, matching `version` in `package.json`; drafts and pre-releases are skipped by the endpoint and tags with suffixes are ignored by the app.

## Considered Options

- **electron-updater**: rejected. It needs a signed update channel (`publish` in `electron-builder.yml` is `null`, plus `latest-mac.yml` and `.blockmap` files), downloads and installs in the background, adds a dependency and does not work in the Mac App Store. Too much when a notice is enough.
- **Only a link to the releases page in the Help menu, with no network traffic**: rejected, because the user would never learn there is something to look for.
- **Checking at every start without a limit**: rejected. More requests add nothing, and without a token they bring the user closer to GitHub's limit of 60 requests an hour per IP address.
- **Checking in the Mac App Store build too**: rejected, because the store delivers updates and a request would break the privacy label.
- **A setting to turn the check off in 1.0**: deferred. Without a Settings window there is nowhere to put it; to be reconsidered when one exists.
