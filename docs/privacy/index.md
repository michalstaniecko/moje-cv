---
title: CV Drawer Privacy Policy
lang: en
permalink: /privacy/
translation: /pl/privacy/
---

# CV Drawer Privacy Policy

Last updated: 8 November 2026

CV Drawer is a Mac app made by Michal Staniecko. This policy explains what happens to your data when you use it.

## In short

CV Drawer does not collect, send or share the content of your CVs or any other personal data. There are no accounts, no analytics, no tracking and no ads.

## Your data stays on your Mac

Everything you enter in CV Drawer (your CVs, the photo, the clause library and your settings) is saved only on your Mac, in the app's own folder. Your CV and photo leave that folder only as files you save yourself: when you export a CV to PDF or to a `.json` file, it goes where you choose in the save dialog. What you do with those files afterwards is up to you.

## Network connections

The app behaves differently depending on where you got it.

### Mac App Store version

The Mac App Store version does not connect to the internet at all. Updates are delivered by the App Store. This matches the "Data Not Collected" label on its App Store page.

### Version downloaded from GitHub (`.dmg`)

The version downloaded from [GitHub Releases](https://github.com/michalstaniecko/moje-cv/releases) checks whether a newer version has been published:

- once a day at most, about 10 seconds after the app starts, and
- when you choose **Help → Check for Updates…**.

To do this, the app asks `api.github.com` for the number of the latest release. The request contains only the app version, in the User-Agent header (for example `CV-Drawer/1.0.0`). It contains no identifiers and nothing from your CVs. Like any website, GitHub sees your IP address, which it handles according to the [GitHub Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). The app never downloads or installs anything by itself: if a new version exists, it only tells you, and the **Download** button opens the release page in your browser.

### Links that open in your browser

The pages opened from the Help menu (this help site, this policy and the page for reporting a problem) and the link for supporting the author through GitHub Sponsors open in your web browser. From then on, the privacy policy of the website you visit applies.

## Diagnostics from Apple

If you have chosen in macOS settings to share analytics with app developers, Apple may give me anonymous crash reports and usage statistics for the Mac App Store version. This is controlled by Apple and by your settings, not by the app.

## Children

CV Drawer is not directed at children and collects no data from anyone.

## Changes to this policy

If this policy changes, the new version will be published on this page with a new date. Earlier versions are available in the [history of this page](https://github.com/michalstaniecko/moje-cv/commits/main/docs/privacy/index.md).

## Contact

Questions about privacy: <!-- TODO(#45): contact e-mail, to be filled in by the author --> **[contact e-mail to be added]**, or [open an issue on GitHub](https://github.com/michalstaniecko/moje-cv/issues/new/choose).
