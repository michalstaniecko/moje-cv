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
2. App ID `com.michalstaniecko.cvdrawer` (explicit). Grupa aplikacji `8A9ZJPAGY8.com.michalstaniecko.cvdrawer`
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
  sieci**) i wspólny z `.dmg` `build/entitlements.inherit.plist` dla helperów; `application-identifier` i `team-identifier`
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

## Wpis w App Store Connect

Treść wpisu jest w repo, w `fastlane/metadata/<lokalizacja>/*.txt` (`en-GB` – język główny wpisu, `en-US` z tym samym tekstem, `pl`), i zmienia się ją przez PR. Do App Store
Connect wysyła ją fastlane (`brew install fastlane`) przez App Store Connect API. Klucz API to ten sam co do notaryzacji
i `altool`, z rolą co najmniej **App Manager**:

```sh
export APPLE_API_KEY_ID=<KEY_ID> APPLE_API_ISSUER=<ISSUER_ID>
# opcjonalnie APPLE_API_KEY=<ścieżka do .p8>; domyślnie ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8

fastlane mac metadata      # nazwa, podtytuł, opis, słowa kluczowe, tekst promocyjny, adresy, kategoria, copyright
pnpm screenshots           # zrzuty 2880×1800 do dist/screenshots/{pl,en}
fastlane mac screenshots   # zastępuje wszystkie zrzuty w App Store Connect tymi z dist/screenshots (en → en-GB i en-US)
```

Obie komendy edytują wersję w App Store Connect o numerze `version` z `package.json`. Jeśli nie ma jeszcze takiej
edytowalnej wersji, tworzą ją. Nie wysyłają binarki ani nie przesyłają do review.

- Limity pól (np. podtytuł 30 znaków, słowa kluczowe 100) i adresy z `src/shared/links.ts` sprawdza
  `build/appStoreMetadata.test.ts` (`pnpm test`).
- **„What's New”** (`release_notes.txt`) nie istnieje dla pierwszej wersji w sklepie. Od 1.1 dodaj
  `release_notes.txt` w każdej lokalizacji (na podstawie `CHANGELOG.md`) i usuń warunek z testu.
- Sekcja App Review: notatka dla recenzenta jest w `fastlane/app_review_notes.txt`, a kontakt (dane osobowe, poza
  repo) w zmiennych `APP_REVIEW_FIRST_NAME`, `APP_REVIEW_LAST_NAME`, `APP_REVIEW_EMAIL` i `APP_REVIEW_PHONE` (z
  numerem kierunkowym, np. `+48 …`). App Store Connect przyjmuje zmianę tej sekcji tylko z pełnym kontaktem, więc bez
  tych zmiennych `fastlane mac metadata` ją pomija.
- Nowa lokalizacja to nowy katalog w `fastlane/metadata/` z tymi samymi plikami (kody lokalizacji App Store Connect, np.
  `de-DE`), dopisany do `locales` w teście.

Ręcznie w App Store Connect, bo tego nie obejmuje ten skrypt: utworzenie rekordu aplikacji, App Privacy („Data Not
Collected”), kategoria wiekowa, cena i dostępność, wybór buildu i przesłanie do review.

## Lokalny test z sandboksem (`mas-dev`)

```sh
MOJE_CV_MAS_DEV_PROVISIONING_PROFILE=~/Developer/profiles/CV_Drawer_Mac_Development.provisionprofile \
pnpm dist:mas-dev
```

Wynik: `dist/mas-dev-universal/CV Drawer.app`, podpisana certyfikatem Apple Development, z tymi samymi entitlements co
build sklepowy. `MOJE_CV_BUILD_NUMBER` jest tu opcjonalny.

> **Uruchamiaj ją tylko na czystym koncie macOS** (jak test migracji w checkliście). Ma prawdziwy bundle ID
> `com.michalstaniecko.cvdrawer` i `container-migration.plist`, więc pierwsze uruchomienie na Twoim koncie przeniosłoby
> Twoją bibliotekę CV z `~/Library/Application Support/Moje CV` do kontenera.

Na czystym koncie sprawdź co najmniej: edycję CV, eksport PDF, eksport i import JSON, wybór zdjęcia, brak Sponsor bara
i pozycji „Sprawdź aktualizacje…”, kolumnę „Piaskownica” w Monitorze aktywności.
