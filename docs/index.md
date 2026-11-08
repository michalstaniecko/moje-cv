---
title: CV Drawer Help
lang: en
permalink: /
translation: /pl/
---

# CV Drawer Help

CV Drawer is a free Mac app for creating CVs and exporting them to PDF. It works on macOS 12 or later, on Macs with Apple silicon and with Intel processors.

## Where is my data?

Your CVs, the clause library and your settings are saved automatically on this Mac, in the app's folder:

`~/Library/Containers/com.michalstaniecko.mojecv/Data/Library/Application Support/Moje CV`

The folder keeps the app's earlier name, "Moje CV". The Mac App Store version and the version downloaded from GitHub share this folder, so on one Mac you always see the same CV library. Nothing is sent anywhere: see the [Privacy Policy]({{ '/privacy/' | relative_url }}).

Removing the app from the Applications folder does **not** delete your data.

## I used an older version. Where are my CVs?

The first time you open the new version, macOS moves the CVs from the older version (named "Moje CV" or "CV Press") into the folder above. If a CV is missing, open the older version, export the CV to a file and import it in CV Drawer, as described below.

## How do I move a CV to another Mac or keep a backup?

1. In the CV library, click **Export to file** next to the CV (or open the CV and choose **File → Export JSON…**). Save the `.json` file somewhere safe, for example on a USB drive or in iCloud Drive.
2. On the other Mac, open CV Drawer and click **Import from file** in the CV library (or choose **File → Import…**). Pick the `.json` file.

The file contains the whole CV, including the photo, so treat it like any other document with your personal data.

## How do I update the app?

- **Mac App Store**: the App Store delivers updates like for any other app.
- **Downloaded from GitHub (`.dmg`)**: CV Drawer tells you when a new version is available, and you can check yourself with **Help → Check for Updates…**. The app never downloads or installs anything by itself. Click **Download**, open the new `.dmg` file and drag CV Drawer to the Applications folder, choosing **Replace**. Your CVs stay where they are.

All versions are on the [releases page](https://github.com/michalstaniecko/moje-cv/releases/latest).

## Something doesn't work or I have an idea

[Report a problem or suggest a feature](https://github.com/michalstaniecko/moje-cv/issues/new/choose) on GitHub (you can also use **Help → Report a Problem…** in the app). Please give the app version from **CV Drawer → About CV Drawer**, for example "1.0.0 (12)", and your macOS version.

Reports on GitHub are public. Please don't attach a CV with your real personal data: if a CV is needed to show the problem, use a sample CV or replace the data with made-up text.

## Contact

E-mail: <!-- TODO(#45): contact e-mail, to be filled in by the author --> **[contact e-mail to be added]**
