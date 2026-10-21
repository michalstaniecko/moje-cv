# Moje CV – instalacja i pierwsze uruchomienie (macOS)

Aplikacja działa na każdym Macu – zarówno z procesorem Apple (M1, M2, …), jak i Intel.

## Instalacja

1. Otwórz pobrany plik **`Moje-CV-<wersja>.dmg`** (dwuklik).
2. W okienku, które się pojawi, przeciągnij ikonę **Moje CV** na folder **Aplikacje** (Applications).
3. Zamknij okienko i wysuń dysk „Moje CV” w Finderze (ikona ⏏ obok jego nazwy).

## Pierwsze uruchomienie

Aplikacja nie jest podpisana certyfikatem Apple, dlatego za pierwszym razem macOS zapyta, czy na pewno chcesz ją otworzyć. Wystarczy to zrobić raz – później Moje CV uruchamia się zwyczajnie.

**Sposób 1 – prawy przycisk myszy (starsze wersje macOS):**

1. Otwórz folder **Aplikacje** w Finderze.
2. Kliknij **Moje CV prawym przyciskiem myszy** (albo z klawiszem Control) i wybierz **Otwórz**.
3. W oknie z ostrzeżeniem kliknij **Otwórz**.

**Sposób 2 – Ustawienia systemowe (macOS 15 Sequoia i nowsze albo gdy sposób 1 nie działa):**

1. Uruchom Moje CV dwuklikiem. Pojawi się komunikat, że aplikacji nie można otworzyć – kliknij **Gotowe** (lub **OK**).
2. Otwórz **Ustawienia systemowe → Prywatność i ochrona**.
3. Przewiń na dół do sekcji **Ochrona**. Przy informacji o „Moje CV” kliknij **Otwórz mimo to**.
4. Potwierdź hasłem do Maca (lub Touch ID), a potem jeszcze raz kliknij **Otwórz mimo to**.

## Gdzie są moje dane

Twoje CV i ustawienia są zapisywane automatycznie na tym Macu, w folderze
`~/Library/Application Support/Moje CV`. Usunięcie aplikacji z folderu Aplikacje **nie** usuwa tych danych.
Kopię CV możesz w każdej chwili zapisać do pliku przyciskiem **Eksportuj do pliku** na liście CV.

## Aktualizacja

Aplikacja nie aktualizuje się sama. Aby zainstalować nowszą wersję, pobierz nowy plik `.dmg` i przeciągnij Moje CV do folderu Aplikacje, wybierając **Zastąp**. Twoje CV zostaną zachowane.

---

## Dla programisty: budowanie pliku .dmg

```
pnpm install
pnpm dist:mac
```

Wynik: `dist/Moje-CV-<wersja>.dmg` (universal: Apple Silicon + Intel). Wersja pochodzi z pola `version` w `package.json`, konfiguracja pakowania jest w `electron-builder.yml`.

`pnpm test:e2e:packaged` buduje plik `.dmg` i uruchamia testy e2e na spakowanej aplikacji (w tym eksport PDF z osadzonymi fontami).
