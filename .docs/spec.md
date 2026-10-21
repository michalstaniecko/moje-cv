# Moje CV – specyfikacja v1

Lokalna aplikacja desktopowa do tworzenia CV z podglądem stron A4 na żywo i eksportem do PDF.
Użytkownik docelowy: osoba nietechniczna na macOS. Wzorzec wyglądu: `.docs/brief/CV_Magdalena_Czerwinska.html`.

## 1. Decyzje

| # | Obszar | Decyzja |
|---|---|---|
| Q1 | Technologia | Electron + React + TypeScript + Vite. Podgląd i PDF renderuje ten sam silnik (Chromium). |
| Q2 | Odbiorcy | Kilka znanych osób. Aplikacja niepodpisana + instrukcja pierwszego uruchomienia (PPM → Otwórz). |
| Q3 | Edycja | Formularz po lewej, podgląd stron A4 po prawej. Podgląd tylko do odczytu. |
| Q4 | Sekcje | Typowane sekcje z template'u (pole `type`), z możliwością ukrycia i zmiany kolejności. Nowe typy dodawane w kodzie. |
| Q5 | Podział stron | Automatyczne reguły + przełącznik „nowa strona przed tym elementem” przy sekcji i wpisie. |
| Q6 | Klauzula – zachowanie | Zawsze na dole ostatniej strony. Gdy się nie mieści – na dół nowej strony. Przełącznik wł./wył. Zwykły tekst. |
| Q7 | Klauzula – treści | Globalna biblioteka zapisanych klauzul; CV wybiera jedną i może ją nadpisać lokalnie. |
| Q8 | Język | Interfejs po polsku. Nagłówki sekcji z polskimi domyślnymi, edytowalne. |
| Q9 | Zdjęcie | Wgranie pliku, kadrowanie do stałych proporcji, opcja „bez zdjęcia” (nagłówek bez kolumny zdjęcia). |
| Q10 | Wygląd | Kolor akcentu (domyślnie `#1a6e72`) + wybór fontu (Q24). Reszta stała. |
| Q11 | Formatowanie | Zwykły tekst wszędzie (bez pogrubień, linków). |
| Q12 | Kontakt | Lista par etykieta–wartość z podpowiedziami: Tel, E-mail, LinkedIn, Miasto. |
| Q13 | Zapis | Biblioteka CV w aplikacji (lista: Nowe / Duplikuj / Usuń) + eksport/import `.json`. |
| Q14 | Autozapis | Debounce ~500 ms, brak przycisku „Zapisz”. Undo/redo (Cmd+Z / Cmd+Shift+Z) w sesji. |
| Q15 | Silnik stron | Własny, blokowy (sekcja 4). Bez Paged.js. |
| Q16 | Kontynuacja | Punkty przechodzą na kolejną stronę bez „(cd.)”. |
| Q17 | Daty | Miesiąc + rok, format `MM.RRRR`. Doświadczenie: zakres + „obecnie”. Wykształcenie: data ukończenia, opcjonalnie początek. |
| Q18 | Kolejność | Ręczna: drag & drop + strzałki góra/dół (sekcje, wpisy, punkty). |
| Q19 | Eksport PDF | Systemowe okno zapisu, nazwa `CV_Imie_Nazwisko.pdf`, potem „Pokaż w Finderze / Otwórz”. Tekst zaznaczalny, metadane Title/Author. |
| Q20 | Liczba stron | Licznik stron w podglądzie; dyskretna informacja przy > 2 stronach. Bez limitu. |
| Q21 | Dane startowe | Przykładowe CV z fikcyjnymi danymi przy pierwszym uruchomieniu. Prawdziwe dane – osobny JSON do importu, poza repo. |
| Q22 | Wersjonowanie | `schemaVersion` w każdym pliku + migracje. |
| Q23 | Dystrybucja | `.dmg` universal (arm64 + x64) przez electron-builder. Konfiguracja gotowa na Win/Linux. Bez auto-update. |
| Q24 | Font | Dołączone fonty: **Lato (domyślny)**, Source Sans 3, Arimo. Wybór per CV. Osadzane w PDF. |
| Q25 | Puste dane | Puste pola i sekcje nie są renderowane. |
| Q26 | Za duży blok | Blok wyższy niż strona nie jest dzielony; dostaje własną stronę i ostrzeżenie „Ten fragment jest za długi…”. |
| Q27 | Skalowanie | Dopasowanie do szerokości panelu + przyciski +, −, 100%. |
| Q28 | Stos | electron-vite, pnpm, Zustand + zundo, Zod, Radix/shadcn, dnd-kit, Vitest, Playwright (Electron), pdf-lib (metadane). |
| Q29 | Proces | Spec → akceptacja → `git init` → etapy pionowe (sekcja 7). |
| Q30 | Nazwa | **Moje CV**: `productName` „Moje CV”, `appId` `com.michalstaniecko.mojecv`, artefakt `Moje-CV-<wersja>.dmg`, tytuł okna „Moje CV”. Repo: `github.com/michalstaniecko/moje-cv`. |

## 2. Model danych

Źródłem prawdy są schematy Zod; typy TS z nich wywiedzione.

```ts
type YearMonth = { year: number; month: number }          // month 1–12
type Id = string                                          // nanoid

type CvDocument = {
  schemaVersion: 1
  id: Id
  name: string                  // nazwa na liście CV, np. „CV – Talent Partners”
  createdAt: string             // ISO
  updatedAt: string
  settings: {
    accentColor: string         // hex
    font: 'lato' | 'source-sans-3' | 'arimo'
  }
  header: {
    fullName: string
    photo: { dataUrl: string } | null    // już wykadrowane, JPEG
    contacts: { id: Id; label: string; value: string }[]
    summary: string
  }
  sections: Section[]           // kolejność = kolejność w CV
  consent: {
    enabled: boolean
    clauseId: Id | null         // klauzula z biblioteki, z której pochodzi tekst
    text: string                // tekst użyty w tym CV (kopia, edytowalna lokalnie)
  }
}

type SectionBase = { id: Id; title: string; hidden: boolean; pageBreakBefore: boolean }

type Section =
  | SectionBase & { type: 'experience'; items: ExperienceItem[] }
  | SectionBase & { type: 'education';  items: EducationItem[] }
  | SectionBase & { type: 'list';       items: { id: Id; text: string }[] }  // Umiejętności, Języki

type ExperienceItem = {
  id: Id
  role: string
  company: string
  location: string              // renderowane jako „Firma – Miasto”
  start: YearMonth | null
  end: YearMonth | 'present' | null
  bullets: { id: Id; text: string }[]
  pageBreakBefore: boolean
}

type EducationItem = {
  id: Id
  level: string                 // „Studia podyplomowe”
  field: string                 // „Menedżer zakupów”
  institution: string           // renderowane jako „poziom, kierunek, uczelnia”
  start: YearMonth | null
  end: YearMonth | null
  pageBreakBefore: boolean
}

// Ustawienia globalne (poza CV)
type AppSettings = {
  schemaVersion: 1
  clauses: { id: Id; name: string; text: string }[]
  defaultClauseId: Id | null
}
```

Uwagi:
- Klauzula: wybór z biblioteki kopiuje `text` do CV; późniejsza edycja w CV nie zmienia biblioteki. W UI przycisk „Zapisz jako nową klauzulę” / „Przywróć z biblioteki”.
- Zdjęcie trzymane jako data URL w JSON – eksport CV to jeden samowystarczalny plik.
- Nowy typ sekcji = nowy wariant unii + komponent renderujący + generator bloków + formularz.

## 3. Przechowywanie

- `userData/cvs/<id>.json` – jedno CV na plik.
- `userData/settings.json` – `AppSettings`.
- Zapis atomowy (zapis do pliku tymczasowego + rename).
- Odczyt: `JSON.parse` → migracje do bieżącej `schemaVersion` → walidacja Zod. Plik niepoprawny nie jest nadpisywany; CV oznaczone jako uszkodzone na liście.
- Import `.json`: ta sama ścieżka (migracja + walidacja) i nowe `id`, żeby nie nadpisać istniejącego.

## 4. Podział na strony

Stałe (z template'u): A4 210×297 mm, marginesy 12 / 16 / 10 / 12 mm (góra / prawo / dół / lewo) → obszar treści 182×275 mm.

### 4.1 Bloki
Dokument zamieniany jest na płaską listę niepodzielnych bloków:

| Blok | keepWithNext |
|---|---|
| Nagłówek (zdjęcie, imię, kontakt, podsumowanie) | nie |
| Tytuł sekcji | tak |
| Wpis doświadczenia: data + stanowisko + firma + **pierwszy** punkt | nie |
| Kolejny punkt wpisu (renderowany z wcięciem kolumny daty) | nie |
| Wpis wykształcenia | nie |
| Sekcja listy: tytuł + pierwszy element (układ dwukolumnowy) | nie |
| Kolejny element listy | nie |

Każdy blok ma też `breakBefore` (z `pageBreakBefore` sekcji lub wpisu). Odstępy realizowane są paddingiem wewnątrz bloku (nie marginesem), żeby wysokości sumowały się bez zapadania marginesów.

### 4.2 Pomiar
Bloki renderowane są tymi samymi komponentami w ukrytym kontenerze o szerokości 182 mm, po `document.fonts.ready`. Mierzymy `getBoundingClientRect().height`. Przeliczanie przy zmianie danych/ustawień (debounce) – pomiar nie zależy od zoomu podglądu.

### 4.3 Algorytm (czysta funkcja, testy jednostkowe)
```ts
paginate(input: {
  blocks: { id: string; height: number; keepWithNext: boolean; breakBefore: boolean }[]
  pageHeight: number
  consent: { height: number; gap: number } | null
}): {
  pages: string[][]             // id bloków na każdej stronie
  consentOnOwnPage: boolean
  oversizedIds: string[]
}
```
1. Zachłanne wypełnianie stron w kolejności bloków.
2. `breakBefore` → nowa strona (jeśli bieżąca niepusta).
3. Łańcuch `keepWithNext` (tytuł sekcji + następny blok) traktowany jako jedna jednostka przy decyzji o przeniesieniu.
4. Blok wyższy niż `pageHeight` → osobna strona + `oversizedIds`.
5. Klauzula: jeśli na ostatniej stronie zostaje ≥ `height + gap` – w stopce ostatniej strony; inaczej nowa strona z samą klauzulą na dole.

### 4.4 Renderowanie stron
Każda strona to `div` 210×297 mm z paddingiem marginesów, `overflow: hidden`, `break-after: page`. Klauzula: absolutnie pozycjonowana na dole obszaru treści ostatniej strony. Ten sam komponent `<CvPages>` jest używany w podglądzie i do PDF.

## 5. Eksport PDF

1. Renderer → IPC `pdf:export(cvId)`.
2. Main otwiera ukryte `BrowserWindow` z trasą `#/print/<id>`, renderującą wyłącznie `<CvPages>` w skali 1:1.
3. Strona druku sygnalizuje gotowość (fonty załadowane, podział policzony, zdjęcie wczytane).
4. `webContents.printToPDF({ pageSize: 'A4', margins: { marginType: 'none' }, printBackground: true, preferCSSPageSize: true })`.
5. pdf-lib ustawia Title („CV – Imię Nazwisko”) i Author (imię i nazwisko).
6. `dialog.showSaveDialog` z domyślną nazwą `CV_Imie_Nazwisko.pdf` (bez polskich znaków i spacji) → zapis → opcje „Otwórz” / „Pokaż w Finderze”.

## 6. Architektura

- **main**: okna, IPC, system plików (CV, ustawienia, import/eksport), eksport PDF, dialogi, polskie menu aplikacji (Edycja → Cofnij / Ponów w edytorze CV przekazywane do historii CV).
- **preload**: wąskie API przez `contextBridge`: `cv.list/get/save/delete/duplicate/import/export`, `settings.get/save`, `pdf.export`, `photo.pick`, `editor.setActive/onHistoryCommand` (edytor zgłasza, że jest otwarty, i dostaje Cofnij / Ponów z menu). `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **renderer** (React):
  - `domain/` – schematy Zod, migracje, formatowanie dat, generator bloków, `paginate` (bez Reacta, testowane w Vitest).
  - `template/` – komponenty renderujące bloki i strony (`<CvPages>`), CSS przeniesiony z template'u, fonty `@font-face` z plików lokalnych.
  - `editor/` – formularze sekcji, drag & drop, kadrowanie zdjęcia, biblioteka klauzul.
  - `preview/` – panel podglądu: licznik stron, informacja o długości CV, powiększenie (dopasowanie do szerokości, +, −, 100%).
  - `store/` – Zustand + zundo, autozapis.
- **Testy**: Vitest dla `paginate`, generatora bloków, migracji, formatowania dat. Playwright (Electron): start aplikacji → przykładowe CV → eksport PDF → plik istnieje i ma oczekiwaną liczbę stron.

## 7. Plan wdrożenia (etapy pionowe)

1. Szkielet electron-vite + statyczny podgląd przykładowego CV z podziałem na strony i klauzulą (dane z kodu).
2. Eksport PDF (ukryte okno, printToPDF, metadane, dialog zapisu).
3. Formularz edycji wszystkich sekcji + kolejność + przełączniki „nowa strona” + kolor + font.
4. Biblioteka CV, autozapis, undo/redo, import/eksport JSON, migracje.
5. Biblioteka klauzul.
6. Zdjęcie: wgrywanie, kadrowanie, „bez zdjęcia”.
7. Build `.dmg` universal + instrukcja pierwszego uruchomienia (PL).

## 8. Poza zakresem v1

Wiele template'ów, formatowanie tekstu, podpisywanie/notaryzacja, auto-update, wersje Win/Linux (niezablokowane, ale nietestowane), interfejs w innych językach.
