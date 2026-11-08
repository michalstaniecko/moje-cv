# CV Drawer – instalacja i pierwsze uruchomienie (macOS)

Aplikacja działa na każdym Macu – zarówno z procesorem Apple (M1, M2, …), jak i Intel.

## Instalacja

1. Otwórz pobrany plik **`CV-Drawer-<wersja>.dmg`** (dwuklik).
2. W okienku, które się pojawi, przeciągnij ikonę **CV Drawer** na folder **Aplikacje** (Applications).
3. Zamknij okienko i wysuń dysk „CV Drawer” w Finderze (ikona ⏏ obok jego nazwy).

## Pierwsze uruchomienie

Aplikacja nie jest podpisana certyfikatem Apple, dlatego za pierwszym razem macOS zapyta, czy na pewno chcesz ją otworzyć. Wystarczy to zrobić raz – później CV Drawer uruchamia się zwyczajnie.

**Sposób 1 – prawy przycisk myszy (starsze wersje macOS):**

1. Otwórz folder **Aplikacje** w Finderze.
2. Kliknij **CV Drawer prawym przyciskiem myszy** (albo z klawiszem Control) i wybierz **Otwórz**.
3. W oknie z ostrzeżeniem kliknij **Otwórz**.

**Sposób 2 – Ustawienia systemowe (macOS 15 Sequoia i nowsze albo gdy sposób 1 nie działa):**

1. Uruchom CV Drawer dwuklikiem. Pojawi się komunikat, że aplikacji nie można otworzyć – kliknij **Gotowe** (lub **OK**).
2. Otwórz **Ustawienia systemowe → Prywatność i ochrona**.
3. Przewiń na dół do sekcji **Ochrona**. Przy informacji o „CV Drawer” kliknij **Otwórz mimo to**.
4. Potwierdź hasłem do Maca (lub Touch ID), a potem jeszcze raz kliknij **Otwórz mimo to**.

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

```
pnpm install
pnpm dist:mac
```

Wynik: `dist/CV-Drawer-<wersja>.dmg` (universal: Apple Silicon + Intel). Wersja pochodzi z pola `version` w `package.json`, konfiguracja pakowania jest w `electron-builder.yml`.

Aplikacja jest podpisana ad-hoc z entitlements sandboksu: `build/entitlements.mac.plist` (`.dmg`), `build/entitlements.mas.plist` (Mac App Store, bez dostępu do sieci) i `build/entitlements.*.inherit.plist` (procesy pomocnicze Electrona). `build/container-migration.plist` trafia do `Contents/Resources` i przenosi dane wersji bez sandboksu do kontenera (ADR-0003).

`pnpm test:e2e:packaged` buduje plik `.dmg`, sprawdza jego podpis (sandbox, entitlements, migracja) i uruchamia testy e2e na spakowanej aplikacji (w tym eksport PDF z osadzonymi fontami). Testy idą na osobnym buildzie testowym (`pnpm dist:e2e`, `electron-builder.e2e.yml`, wynik w `dist-e2e/`): ten sam sandbox, ale osobny bundle ID `com.michalstaniecko.mojecv.e2e` (osobny kontener), bez migracji danych i z dwoma dodatkami dla Playwrighta (`build/entitlements.e2e.plist`). Dzięki temu testy nigdy nie przenoszą ani nie zmieniają Twoich prawdziwych CV.

**Uwaga:** nie uruchamiaj na swoim koncie `dist/mac-universal/CV Drawer.app` ani `.dmg` z sandboksem „na próbę”, jeśli zależy Ci na danych w `~/Library/Application Support/Moje CV`: pierwsze uruchomienie zakłada kontener i od razu przenosi do niego ten folder (dawne wersje, `pnpm dev` i `pnpm test:e2e` przestaną go widzieć). Migrację testuj na osobnym koncie macOS (`docs/release-checklist.md`).

Testy e2e (`pnpm test:e2e`) domyślnie uruchamiają aplikację w tle: okno jest niewidoczne, nie zabiera fokusu i nie ma ikony w Docku, więc w trakcie testów można normalnie pracować. Żeby zobaczyć okno (np. przy debugowaniu), uruchom `MOJE_CV_E2E_HEADED=1 pnpm test:e2e`.
