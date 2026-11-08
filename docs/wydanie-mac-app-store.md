# Wydanie w Mac App Store

Ręczny, lokalny proces wydania buildu Mac App Store (#44, spec #41), bez CI. Konfiguracja: sekcja `mas`
w `electron-builder.yml`, skrypt `build/distMas.ts`. Po wysyłce: checklista `docs/release-checklist.md` (kolumna MAS)
i wpis w App Store Connect (#48).

## Jednorazowo

Na developer.apple.com (zespół `8A9ZJPAGY8`), w pęku kluczy Maca, z którego budujesz:

1. Certyfikaty:
   - **Apple Distribution** (albo starszy „Mac App Distribution”, w pęku kluczy jako „3rd Party Mac Developer Application”) – podpis aplikacji;
   - **Mac Installer Distribution** (w pęku kluczy jako „3rd Party Mac Developer Installer”) – podpis `.pkg`;
   - **Apple Development** – tylko do `mas-dev`.

   electron-builder wybiera je po nazwie „Michal Staniecko” (`mas.identity`). Sprawdzenie: `security find-identity -v`.
2. App ID `com.michalstaniecko.mojecv` (explicit). Grupa aplikacji `8A9ZJPAGY8.com.michalstaniecko.mojecv`
   z entitlements ma prefiks zespołu, więc na macOS nie trzeba jej rejestrować w profilu.
3. Profile provisioningowe dla tego App ID, **poza repo** (np. `~/Developer/profiles/`):
   - typ **Mac App Store Connect** (dystrybucja) → `MOJE_CV_MAS_PROVISIONING_PROFILE`;
   - typ **macOS App Development** z tym Makiem na liście urządzeń → `MOJE_CV_MAS_DEV_PROVISIONING_PROFILE`.

   Profil wygasa razem z certyfikatem; po odnowieniu pobierz nowy.
4. W App Store Connect wpis aplikacji z tym bundle ID (#48).

## Wersja i numer buildu

- **Wersja** (`CFBundleShortVersionString`) to `version` z `package.json` (debiut w sklepie: 1.0.0). Każda nowa wersja
  w sklepie musi być wyższa od poprzedniej.
- **Numer buildu** (`CFBundleVersion`) to osobny, rosnący licznik podawany przy każdym buildzie w
  `MOJE_CV_BUILD_NUMBER`: dodatnia liczba całkowita, **większa od każdego numeru wysłanego wcześniej** (dowolnej
  wersji). Ostatni numer: App Store Connect → aplikacja → TestFlight. Ten sam numer nie przejdzie drugi raz, więc po
  odrzuconej paczce zbuduj ją ponownie z kolejnym numerem. Wpisz numer w checklistę wydania („Build MAS”).

Bez `MOJE_CV_BUILD_NUMBER` albo profilu `pnpm dist:mas` kończy się błędem, zanim cokolwiek zbuduje.

## Budowanie

```sh
MOJE_CV_BUILD_NUMBER=12 \
MOJE_CV_MAS_PROVISIONING_PROFILE=~/Developer/profiles/CV_Drawer_Mac_App_Store.provisionprofile \
pnpm dist:mas
```

Wynik: `dist/mas-universal/CV-Drawer-<wersja>.pkg` (Apple Silicon + Intel) i podpisana aplikacja obok. Build ma:

- entitlements z `build/entitlements.mas.plist` (sandbox, pliki wybrane przez użytkownika, grupa aplikacji, **bez
  sieci**) i `build/entitlements.mas.inherit.plist` dla helperów; `application-identifier` i `team-identifier`
  dopisuje electron-builder z profilu;
- `ITSAppUsesNonExemptEncryption = false`, kategorię Productivity, `ElectronTeamID`;
- `container-migration.plist` (dane wersji `.dmg` sprzed sandboksu, ADR-0003);
- Electron w wariancie MAS (`process.mas`), więc bez Sponsor bara, pozycji „Wesprzyj…” i „Sprawdź aktualizacje…”
  oraz bez żadnego ruchu sieciowego (ADR-0005, ADR-0006).

Minimalny macOS (`LSMinimumSystemVersion`) to wartość z Electrona: dla Electrona 45 **13.0** (Ventura). Niżej
Electron 45 się nie uruchamia, więc tego samego wymaga wpis w sklepie.

Sprawdzenie przed wysyłką:

```sh
APP="dist/mas-universal/CV Drawer.app"
plutil -p "$APP/Contents/Info.plist" | grep -E 'CFBundle(Short)?Version|ITSApp|LSMinimum|Category'
codesign -d --entitlements - "$APP"                 # app-sandbox, user-selected, grupa, bez network.*
codesign --verify --deep --strict "$APP"
pkgutil --check-signature dist/mas-universal/CV-Drawer-*.pkg   # „3rd Party Mac Developer Installer”
```

## Wysyłka

**Transporter** (aplikacja z Mac App Store, zalogowana kontem dewelopera): przeciągnij `.pkg`, „Zweryfikuj”, potem
„Dostarcz”.

Albo z terminala przez `xcrun altool` z kluczem API App Store Connect (Users and Access → Integrations → App Store
Connect API; plik `AuthKey_<KEY_ID>.p8` w `~/.appstoreconnect/private_keys/`, poza repo):

```sh
xcrun altool --validate-app -f dist/mas-universal/CV-Drawer-<wersja>.pkg -t macos --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>
xcrun altool --upload-app   -f dist/mas-universal/CV-Drawer-<wersja>.pkg -t macos --apiKey <KEY_ID> --apiIssuer <ISSUER_ID>
```

Build pojawia się w App Store Connect (TestFlight) po przetworzeniu, zwykle kilkanaście minut; uwagi Apple przychodzą
mailem. Dalej: test z TestFlight według checklisty i wysyłka do review (#48).

## Lokalny test z sandboksem (`mas-dev`)

```sh
MOJE_CV_MAS_DEV_PROVISIONING_PROFILE=~/Developer/profiles/CV_Drawer_Mac_Development.provisionprofile \
pnpm dist:mas-dev
```

Wynik: `dist/mas-dev-universal/CV Drawer.app`, podpisana certyfikatem Apple Development, z tymi samymi entitlements co
build sklepowy. `MOJE_CV_BUILD_NUMBER` jest tu opcjonalny.

> **Uruchamiaj ją tylko na czystym koncie macOS** (jak test migracji w checkliście). Ma prawdziwy bundle ID
> `com.michalstaniecko.mojecv` i `container-migration.plist`, więc pierwsze uruchomienie na Twoim koncie przeniosłoby
> Twoją bibliotekę CV z `~/Library/Application Support/Moje CV` do kontenera.

Na czystym koncie sprawdź co najmniej: edycję CV, eksport PDF, eksport i import JSON, wybór zdjęcia, brak Sponsor bara
i pozycji „Sprawdź aktualizacje…”, kolumnę „Piaskownica” w Monitorze aktywności.
