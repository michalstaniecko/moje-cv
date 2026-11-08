# CV Drawer – instalacja i pierwsze uruchomienie (macOS)

Aplikacja działa na każdym Macu – zarówno z procesorem Apple (M1, M2, …), jak i Intel.

## Instalacja

1. Otwórz pobrany plik **`CV-Drawer-<wersja>.dmg`** (dwuklik).
2. W okienku, które się pojawi, przeciągnij ikonę **CV Drawer** na folder **Aplikacje** (Applications).
3. Zamknij okienko i wysuń dysk „CV Drawer” w Finderze (ikona ⏏ obok jego nazwy).

## Pierwsze uruchomienie

Otwórz **CV Drawer** z folderu **Aplikacje** (albo z Launchpada). Aplikacja jest podpisana certyfikatem Apple (Developer ID) i sprawdzona przez Apple (notaryzacja), więc macOS otwiera ją bez ostrzeżeń. Za pierwszym razem może tylko zapytać, czy otworzyć aplikację pobraną z internetu – kliknij **Otwórz**.

## Gdzie są moje dane

Twoje CV i ustawienia są zapisywane automatycznie na tym Macu. CV Drawer działa w sandboksie macOS (App Sandbox), więc dane leżą w jego kontenerze:
`~/Library/Containers/com.michalstaniecko.mojecv/Data/Library/Application Support/Moje CV` (folder zachował dawną nazwę aplikacji). Ten sam folder widzi wersja z Mac App Store i wersja z pliku `.dmg`, więc po zmianie jednej na drugą masz tę samą bibliotekę CV. Usunięcie aplikacji z folderu Aplikacje **nie** usuwa tych danych.

Wersje bez sandboksu (do 0.6.0) trzymały dane w `~/Library/Application Support/Moje CV`. Przy pierwszym uruchomieniu wersji z sandboksem macOS sam przenosi ten folder do kontenera – nic nie trzeba robić.

Kopię CV możesz w każdej chwili zapisać do pliku przyciskiem **Eksportuj do pliku** na liście CV. To także plan B, gdyby po aktualizacji CV z dawnej wersji się nie pojawiły, a folder `~/Library/Application Support/Moje CV` nadal istnieje (macOS przenosi go tylko przy pierwszym uruchomieniu, gdy zakłada kontener): uruchom starą wersję aplikacji, wyeksportuj każde CV do pliku `.json` i zaimportuj je w nowej wersji (**Importuj…** w bibliotece CV).

## Aktualizacja

Aplikacja nie aktualizuje się sama. Aby zainstalować nowszą wersję, pobierz nowy plik `.dmg` i przeciągnij CV Drawer do folderu Aplikacje, wybierając **Zastąp**. Twoje CV zostaną zachowane.

Jeśli masz starszą wersję o nazwie **CV Press** albo **Moje CV**, nowa wersja (CV Drawer) pojawi się w folderze Aplikacje obok niej i od razu zobaczy wszystkie Twoje CV (przeniesione do kontenera, patrz wyżej). Starą aplikację (CV Press lub Moje CV) przenieś potem do Kosza – po przeniesieniu danych już ich nie widzi.

---

## Dla programisty: budowanie pliku .dmg

### Wydanie (Developer ID, notaryzacja)

```
pnpm install
pnpm dist:mac
```

Wynik: `dist/CV-Drawer-<wersja>.dmg` (universal: Apple Silicon + Intel). Wersja pochodzi z pola `version` w `package.json`, konfiguracja pakowania jest w `electron-builder.yml`. Aplikacja i `.dmg` są podpisane certyfikatem **Developer ID Application** zespołu `8A9ZJPAGY8`, z hardened runtime; electron-builder notaryzuje i stempluje aplikację (`mac.notarize`), a hook `build/notarize.mjs` notaryzuje i stempluje sam `.dmg`. Dwie notaryzacje trwają zwykle kilka minut.

Dane uwierzytelniające nigdy nie trafiają do repo – tylko pęk kluczy i zmienne środowiskowe:

1. **Certyfikat**: „Developer ID Application: … (8A9ZJPAGY8)” z kluczem prywatnym w pęku kluczy logowania (Xcode → Settings → Accounts → Manage Certificates albo developer.apple.com → Certificates). Sprawdzenie: `security find-identity -v -p codesigning`.
2. **Notaryzacja**, jeden z zestawów zmiennych (te same, które czyta electron-builder):

| Sposób | Zmienne |
| --- | --- |
| Klucz API App Store Connect (zalecany) | `APPLE_API_KEY` (ścieżka do pliku `AuthKey_<id>.p8`), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER` |
| Profil `notarytool` w pęku kluczy | `APPLE_KEYCHAIN_PROFILE` (opcjonalnie `APPLE_KEYCHAIN`); profil zakłada raz `xcrun notarytool store-credentials <nazwa>` |
| Apple ID | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` (hasło aplikacji z appleid.apple.com), `APPLE_TEAM_ID=8A9ZJPAGY8` |

Przykład z kluczem API (plik `.p8` trzymaj poza repo):

```
APPLE_API_KEY=~/.private_keys/AuthKey_XXXXXXXXXX.p8 APPLE_API_KEY_ID=XXXXXXXXXX APPLE_API_ISSUER=<issuer-uuid> pnpm dist:mac
```

**Bez certyfikatu albo bez danych do notaryzacji `pnpm dist:mac` kończy się błędem** przed pakowaniem, z listą tego, czego brakuje. Nie powstaje wtedy żaden plik, więc nie da się przez pomyłkę wydać `.dmg`, którego Gatekeeper nie przepuści. Sprawdzenie gotowego wydania (podpis, notaryzacja, stempel, universal): `docs/release-checklist.md`, sekcja „Wydanie `.dmg`”.

### Build lokalny (bez certyfikatu)

```
pnpm dist:mac:local
```

Wynik: `dist-local/CV-Drawer-<wersja>-local.dmg`. Ten sam sandbox, bundle ID i migracja danych co wydanie (`electron-builder.local.yml`), ale podpis ad-hoc, bez hardened runtime i bez notaryzacji. Działa tylko na Macu, na którym go zbudowano – **nie do dystrybucji** (na innym Macu Gatekeeper go zablokuje).

### Entitlements i testy

Entitlements sandboksu: `build/entitlements.mac.plist` (`.dmg`), `build/entitlements.mas.plist` (Mac App Store, bez dostępu do sieci) i `build/entitlements.*.inherit.plist` (procesy pomocnicze Electrona). Wpisy `cs.allow-jit` i `cs.allow-unsigned-executable-memory` pozwalają V8 działać z hardened runtime. `build/container-migration.plist` trafia do `Contents/Resources` i przenosi dane wersji bez sandboksu do kontenera (ADR-0003).

`pnpm test:e2e:packaged` nie wymaga certyfikatu: buduje lokalny `.dmg` (`pnpm dist:mac:local`), sprawdza podpis aplikacji z niego (sandbox, entitlements, migracja) i uruchamia testy e2e na spakowanej aplikacji (w tym eksport PDF z osadzonymi fontami). Testy idą na osobnym buildzie testowym (`pnpm dist:e2e`, `electron-builder.e2e.yml`, wynik w `dist-e2e/`): ten sam sandbox, ale osobny bundle ID `com.michalstaniecko.mojecv.e2e` (osobny kontener), bez migracji danych i z dwoma dodatkami dla Playwrighta (`build/entitlements.e2e.plist`). Dzięki temu testy nigdy nie przenoszą ani nie zmieniają Twoich prawdziwych CV.

**Uwaga:** nie uruchamiaj na swoim koncie `dist/mac-universal/CV Drawer.app`, `dist-local/mac-universal/CV Drawer.app` ani `.dmg` z sandboksem „na próbę”, jeśli zależy Ci na danych w `~/Library/Application Support/Moje CV`: pierwsze uruchomienie zakłada kontener i od razu przenosi do niego ten folder (dawne wersje, `pnpm dev` i `pnpm test:e2e` przestaną go widzieć). Migrację testuj na osobnym koncie macOS (`docs/release-checklist.md`).

Testy e2e (`pnpm test:e2e`) domyślnie uruchamiają aplikację w tle: okno jest niewidoczne, nie zabiera fokusu i nie ma ikony w Docku, więc w trakcie testów można normalnie pracować. Żeby zobaczyć okno (np. przy debugowaniu), uruchom `MOJE_CV_E2E_HEADED=1 pnpm test:e2e`.
