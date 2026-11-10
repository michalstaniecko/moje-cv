# Security Policy

## Supported versions

Only the latest 1.x release is supported, in both distribution channels:

- Mac App Store
- `.dmg` from [GitHub Releases](https://github.com/michalstaniecko/moje-cv/releases)

Please update to the latest version before reporting.

## Reporting a vulnerability

**Do not open a public issue.** Report privately via
[Security → Report a vulnerability](https://github.com/michalstaniecko/moje-cv/security/advisories/new).

Please include:

- the app version (shown in the "About CV Drawer" panel),
- the installation channel (Mac App Store or `.dmg`),
- your macOS version,
- steps to reproduce,
- the impact you observed or expect.

Do not attach real CVs or other personal data. Use made-up sample data instead.

## What to expect

CV Drawer is maintained by one person, and there is no bug bounty.

- You will get an acknowledgement within about 7 days.
- We will agree on a timeline for the fix and for public disclosure.
- If you wish, you will be credited in the published security advisory.

## Scope

In scope:

- the Electron main process and IPC between the main process and the renderer,
- importing JSON files,
- PDF export,
- opening external URLs,
- the update check in the `.dmg` build.

Out of scope:

- GitHub and Apple infrastructure,
- attacks that require an already compromised macOS account,
- social engineering.

## Privacy

CV Drawer does not store or send your data anywhere outside your Mac. See the
[privacy policy](https://ihumbak.website/cv-drawer/privacy/).
