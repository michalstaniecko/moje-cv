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

Twoje CV i ustawienia są zapisywane automatycznie na tym Macu, w folderze
`~/Library/Application Support/Moje CV` (folder zachował dawną nazwę aplikacji). Usunięcie aplikacji z folderu Aplikacje **nie** usuwa tych danych.
Kopię CV możesz w każdej chwili zapisać do pliku przyciskiem **Eksportuj do pliku** na liście CV.

## Aktualizacja

Aplikacja nie aktualizuje się sama. Aby zainstalować nowszą wersję, pobierz nowy plik `.dmg` i przeciągnij CV Drawer do folderu Aplikacje, wybierając **Zastąp**. Twoje CV zostaną zachowane.

Jeśli masz starszą wersję o nazwie **CV Press** albo **Moje CV**, nowa wersja (CV Drawer) pojawi się w folderze Aplikacje obok niej i od razu zobaczy wszystkie Twoje CV. Starą aplikację (CV Press lub Moje CV) możesz potem przenieść do Kosza – dane zostaną.

---

## Dla programisty: budowanie pliku .dmg

```
pnpm install
pnpm dist:mac
```

Wynik: `dist/CV-Drawer-<wersja>.dmg` (universal: Apple Silicon + Intel). Wersja pochodzi z pola `version` w `package.json`, konfiguracja pakowania jest w `electron-builder.yml`.

`pnpm test:e2e:packaged` buduje plik `.dmg` i uruchamia testy e2e na spakowanej aplikacji (w tym eksport PDF z osadzonymi fontami).

Testy e2e (`pnpm test:e2e`) domyślnie uruchamiają aplikację w tle: okno jest niewidoczne, nie zabiera fokusu i nie ma ikony w Docku, więc w trakcie testów można normalnie pracować. Żeby zobaczyć okno (np. przy debugowaniu), uruchom `MOJE_CV_E2E_HEADED=1 pnpm test:e2e`.
