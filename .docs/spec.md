# CV Drawer – specyfikacja v1

Lokalna aplikacja desktopowa do tworzenia CV z podglądem stron A4 na żywo i eksportem do PDF.
Użytkownik docelowy: osoba nietechniczna na macOS. Wzorzec wyglądu: `.docs/brief/CV_Magdalena_Czerwinska.html`.

## 1. Decyzje

| # | Obszar | Decyzja |
|---|---|---|
| Q1 | Technologia | Electron + React + TypeScript + Vite. Podgląd i PDF renderuje ten sam silnik (Chromium). |
| Q2 | Odbiorcy | Kilka znanych osób. Aplikacja niepodpisana + instrukcja pierwszego uruchomienia (PPM → Otwórz). |
| Q3 | Edycja | Formularz po lewej, podgląd stron A4 po prawej. Podgląd tylko do odczytu i ukryty przed czytnikami ekranu (źródłem treści jest formularz); pasek podglądu zostaje dostępny. |
| Q4 | Sekcje | Typowane sekcje z template'u (pole `type`), z możliwością ukrycia i zmiany kolejności. Nowe typy dodawane w kodzie. |
| Q5 | Podział stron | Automatyczne reguły + przełącznik „nowa strona przed tym elementem” przy sekcji i wpisie. |
| Q6 | Klauzula – zachowanie | Zawsze na dole ostatniej strony. Gdy się nie mieści – na dół nowej strony. Przełącznik wł./wył. Zwykły tekst. |
| Q7 | Klauzula – treści | Globalna biblioteka zapisanych klauzul; CV wybiera jedną i może ją nadpisać lokalnie. |
| Q8 | Język | Język interfejsu niezależny od języka CV, 16 języków: angielski, polski, hiszpański (europejski, neutralny), francuski, niemiecki, portugalski (brazylijski), włoski, niderlandzki, rosyjski, ukraiński, turecki, indonezyjski, wietnamski, czeski, rumuński, szwedzki – jeden słownik na język, bez wariantów regionalnych. Przy pierwszym uruchomieniu język systemu, jeśli obsługiwany (wariant regionalny → język bazowy, np. `pt-PT` → `pt`), inaczej angielski; zmiana w menu Language działa od razu i jest zapamiętywana. Etykieta menu jest dwujęzyczna, „<lokalnie> / Language” (np. „Sprache / Language”, „Język / Language”), po angielsku samo „Language”; pozycje to nazwy języków w nich samych, alfabetycznie (łacinka przed cyrylicą), System na końcu. Cały interfejs (menu, okna plików, ekrany, komunikaty, licznik stron z odmianą `Intl.PluralRules`) pochodzi z własnego typowanego słownika wspólnego dla main i renderera (ADR-0001); nowy język = nowy słownik, jego przykładowe CV i pozycja na liście języków. Treść domyślna (nazwa nowego CV, tytuły sekcji, etykiety kontaktu, przykładowe CV, dopisek „(kopia)”) powstaje w języku interfejsu z chwili utworzenia, potem jest zwykłą, edytowalną treścią; zmiana języka nie zmienia istniejących CV. Przykładowe CV jest zlokalizowane (lokalne imię, fikcyjne firmy, miasta, fikcyjny telefon, lokalne nazwy stopni) przy tej samej strukturze, datach i liczbie stron co angielskie; w `ru`, `uk` i `vi` startuje z Source Sans 3. Klauzulę zgody ma tylko polskie przykładowe CV. Błędy z procesu głównego widoczne dla użytkownika (np. niepoprawny plik importu) trafiają do renderera jako kody. Nazwa aplikacji „CV Drawer” jest ta sama we wszystkich językach; folder danych pozostaje „Moje CV”. |
| Q9 | Zdjęcie | Wgranie pliku, kadrowanie do stałych proporcji, opcja „bez zdjęcia” (nagłówek bez kolumny zdjęcia). |
| Q10 | Projekt CV | Kolor akcentu (domyślnie `#1a6e72`) + wybór fontu (Q24). Reszta stała. |
| Q11 | Formatowanie | Zwykły tekst wszędzie (bez pogrubień, linków). |
| Q12 | Kontakt | Lista par etykieta–wartość z podpowiedziami: Tel, E-mail, LinkedIn, Miasto. |
| Q13 | Zapis | Biblioteka CV w aplikacji (lista: Nowe / Duplikuj / Usuń) + eksport/import `.json`. |
| Q14 | Autozapis | Debounce ~500 ms, brak przycisku „Zapisz”. Undo/redo (Cmd+Z / Cmd+Shift+Z) w sesji. Nieudany zapis: pasek `role="alert"` pod paskiem narzędzi ze „Spróbuj ponownie”; wyjście z edytora pyta „Wyjść mimo to?”. Zamknięcie okna i Quit z otwartym edytorem czekają na zapis (najwyżej 10 s), a przy nieudanym pytają natywnym oknem, czy zamknąć mimo to (#67). Usunięcie pozycji, punktu, elementu listy, kontaktu albo zdjęcia pokazuje na dole kolumny formularza „Usunięto. Cofnij” (`role="status"`, znika po 8 s, nie pod kursorem ani z fokusem); „Cofnij” cofa dokładnie to usunięcie, a każda kolejna zmiana chowa komunikat (#69). |
| Q15 | Silnik stron | Własny, blokowy (sekcja 4). Bez Paged.js. |
| Q16 | Kontynuacja | Punkty przechodzą na kolejną stronę bez „(cd.)”. |
| Q17 | Daty | Miesiąc + rok, format `MM.RRRR`. Doświadczenie: zakres + „obecnie” w CV language (np. „present” po angielsku). Wykształcenie: data ukończenia, opcjonalnie początek. Checkbox w formularzu: „Nadal tu pracuję”. Koniec wcześniejszy niż początek (dwie pełne daty; ten sam miesiąc to nie błąd) daje ostrzeżenie pod datami (`aria-describedby` pola końca), bez blokady zapisu i eksportu (#69). |
| Q18 | Kolejność | Ręczna: drag & drop + strzałki góra/dół (sekcje, wpisy, punkty). Przeciąganie z klawiatury ogłasza czytnikowi ekranu element, pozycję („pozycja 3 z 5”), upuszczenie i anulowanie w Interface language. |
| Q19 | Eksport PDF | Systemowe okno zapisu, nazwa `CV_Imie_Nazwisko.pdf` z transliteracją (mapa liter nierozkładalnych i cyrylicy, potem NFD; dla CV language `uk` zasady ukraińskie), kolejno z imienia i nazwiska, z nazwy CV, a na końcu `CV.pdf`. Przy za długich blokach najpierw pytanie „Eksportować mimo to?”. W trakcie przygotowania wskaźnik postępu; przekroczenie czasu ma osobny komunikat. Potem zamykane powiadomienie z „Pokaż w Finderze / Otwórz” pod paskiem narzędzi. Tekst zaznaczalny, metadane Title/Author (w oryginalnym zapisie). |
| Q20 | Liczba stron | Licznik stron w podglądzie; dyskretna informacja przy > 2 stronach. Bez limitu. |
| Q21 | Dane startowe | Przykładowe CV z fikcyjnymi danymi przy pierwszym uruchomieniu, w języku interfejsu. Prawdziwe dane – osobny JSON do importu, poza repo. |
| Q22 | Wersjonowanie | `schemaVersion` w każdym pliku + migracje. |
| Q23 | Dystrybucja | `.dmg` universal (arm64 + x64) przez electron-builder. Konfiguracja gotowa na Win/Linux. Bez auto-update. W `.dmg` powiadomienie o nowej wersji z GitHub Releases (raz na 24 h i z menu Pomoc), w MAS aktualizacje ze sklepu (ADR-0006). |
| Q24 | Font | Dołączone fonty: **Lato (domyślny)**, Source Sans 3, Arimo. Wybór per CV. Osadzane w PDF. |
| Q25 | Puste dane | Puste pola i sekcje nie są renderowane. |
| Q26 | Za duży blok | Blok wyższy niż strona nie jest dzielony; dostaje własną stronę i ostrzeżenie „Ten fragment jest za długi…”. W PDF jest ucięty, więc eksport takiego CV najpierw pyta „Eksportować mimo to?” („Eksportuj mimo to” / „Anuluj”). |
| Q27 | Skalowanie | Dopasowanie do szerokości panelu + przyciski +, −, 100%. |
| Q28 | Stos | electron-vite, pnpm, Zustand + zundo, Zod, Radix/shadcn, dnd-kit, Vitest, Playwright (Electron), pdf-lib (metadane). |
| Q29 | Proces | Spec → akceptacja → `git init` → etapy pionowe (sekcja 7). |
| Q30 | Nazwa | **CV Drawer** (wcześniej „Moje CV”, potem „CV Press” – odrzucona jako zbyt bliska PressCV; issue #47, #83), ta sama w PL i EN: `productName` „CV Drawer”, `appId` `com.michalstaniecko.mojecv` (bez zmian, ADR-0003), artefakt `CV-Drawer-<wersja>.dmg`, tytuł okna „CV Drawer”. Folder danych przypięty do `Moje CV` niezależnie od `productName`. Repo: `github.com/michalstaniecko/moje-cv`. |

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
    language: InterfaceLanguage  // CV language: stały tekst dokumentu („present”) i `lang` stron; stare CV → 'pl'
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
  interfaceLanguage?: InterfaceLanguage  // 'en' | 'pl' | 'es' | 'fr' | 'de' | 'pt' | 'it' | 'nl' | 'ru' | 'uk' | 'tr' | 'id' | 'vi' | 'cs' | 'ro' | 'sv'; brak = język systemu
  windowState?: { x: number; y: number; width: number; height: number; maximized: boolean }  // okno aplikacji (wymiary sprzed maksymalizacji, liczby całkowite); brak = rozmiar domyślny
}
```

Uwagi:
- Klauzula: wybór z biblioteki kopiuje `text` do CV; późniejsza edycja w CV nie zmienia biblioteki. W UI przycisk „Zapisz jako nową klauzulę” / „Przywróć z biblioteki”.
- Zdjęcie trzymane jako data URL w JSON – eksport CV to jeden samowystarczalny plik.
- Nowy typ sekcji = nowy wariant unii + komponent renderujący + generator bloków + formularz.

## 3. Przechowywanie

- `userData/cvs/<id>.json` – jedno CV na plik.
- `userData/settings.json` – `AppSettings`, w tym stan okna (`windowState`): rozmiar, pozycja i zmaksymalizowanie, zapisywane z opóźnieniem ~500 ms po zmianie i od razu przy zamykaniu okna. Przy starcie okno wraca na swoje miejsce tylko wtedy, gdy jego pasek tytułu jest na którymś z podłączonych ekranów (dopasowane do tego ekranu, czysta funkcja `windowState.ts`); inaczej rozmiar domyślny 1280×900 przycięty do ekranu głównego i wyśrodkowany. Uszkodzony plik ustawień daje rozmiar domyślny.
- Zapis atomowy (zapis do pliku tymczasowego + rename).
- Odczyt: `JSON.parse` → migracje do bieżącej `schemaVersion` → walidacja Zod. Plik niepoprawny nie jest nadpisywany; CV oznaczone jako uszkodzone na liście. Plik z nowszą `schemaVersion` (zapisany w nowszej wersji aplikacji) też nie jest nadpisywany, ale na liście jest oznaczony osobno od uszkodzonego („Wymaga nowszej wersji CV Drawer”); da się go tylko usunąć.
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

**Wydajność (#72)**: odpowiedź podglądu na klawisz (od zdarzenia `input` w formularzu do namalowania podglądu z nowym podziałem stron, User Timing `cv:keystroke-to-preview`) ma mieścić się w **100 ms** (mediana i p95) na M1 w zbudowanej aplikacji. Autozapis nie może tworzyć w rendererze zadań dłuższych niż 100 ms i ma kończyć się w procesie głównym w < 100 ms. Optymalizujemy tylko to, co pomiar pokaże powyżej progu. Pomiar to opcjonalny test `e2e/performance.spec.ts` (duży CV: 4+ strony, zdjęcie), pomijany bez `MOJE_CV_PERF=1`; wypisuje medianę i p95, a asercjami sprawdza tylko fixture. Uruchamiany na zbudowanej aplikacji, nigdy na serwerze deweloperskim: `pnpm build && MOJE_CV_PERF=1 pnpm exec playwright test e2e/performance.spec.ts` albo `MOJE_CV_PERF=1 pnpm test:e2e:packaged e2e/performance.spec.ts`. `MOJE_CV_PERF_CPU_SLOWDOWN=4` spowalnia procesor renderera (przybliżenie starszego Maca). `MOJE_CV_PERF=1` włącza też pomiar autozapisu w procesie głównym (`src/main/perfLog.ts`); bez niej nic nie jest mierzone ani logowane.

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
6. `dialog.showSaveDialog` z domyślną nazwą `CV_Imie_Nazwisko.pdf` (`src/main/pdfFileName.ts`: transliteracja do `[A-Za-z0-9-]`, słowa rozdzielone `_`; bez imienia i nazwiska nazwa CV, na końcu `CV.pdf`) → zapis → zamykane powiadomienie z „Otwórz” / „Pokaż w Finderze”. Przed krokiem 1 renderer pyta o eksport CV z blokami wyższymi niż strona; od kroku 1 do wyniku widać wskaźnik postępu. Gdy strona druku nie zgłosi gotowości w czasie (30 s, `MOJE_CV_PRINT_TIMEOUT_MS` w e2e), wynik to `timed-out` z osobnym komunikatem.

## 6. Architektura

- **main**: okna, IPC, system plików (CV, ustawienia, import/eksport), eksport PDF, dialogi (tytuły i filtry w języku interfejsu), język interfejsu (wybór → system → angielski; `MOJE_CV_LANGUAGE=<kod>` wymusza go w testach) i menu aplikacji w tym języku (CV Drawer z Usługami; Plik: Nowe CV ⌘N, Dodaj przykładowe CV, Importuj… ⌘O, Eksportuj JSON…, Eksportuj do PDF… ⌘E, Zamknij okno ⌘W – komendy `menu:command` wysyłane do renderera, aktywne zależnie od ekranu zgłoszonego przez renderer okna, na którym działa menu (okna z fokusem); Edycja → Cofnij / Ponów w edytorze CV przekazywane do historii CV; Widok z pełnym ekranem; Language; Wygląd; systemowe menu Okno z „Przenieś wszystko na wierzch”; Pomoc z systemowym wyszukiwaniem: Pomoc CV Drawer, Polityka prywatności, Zgłoś problem… i – poza Mac App Store – Sprawdź aktualizacje… oraz Wesprzyj CV Drawer…), otwieranie w przeglądarce wyłącznie stałych adresów z `src/shared/links.ts` (`shell.openExternal`, bez URL-i z renderera), panel „O aplikacji” z wersją z `app.getVersion()` (jedyne źródło numeru wersji), prawami autorskimi i adresem pomocy z `src/shared/links.ts`. Sprawdzanie nowej wersji tylko w `.dmg` (ADR-0006, `updateCheck.ts` i `updates.ts`): `net.fetch` do GitHub Releases API raz na 24 h (ok. 10 s po starcie) i od razu z menu Pomoc, porównanie tagu `vX.Y.Z` z `app.getVersion()`, stan w ustawieniach (`updateCheck`), ciche błędy, natywne dialogi; w MAS żadnego zapytania (`MOJE_CV_UPDATE_URL=off` wyłącza w testach sprawdzanie przy starcie i sieć – menu daje wtedy „nie udało się” bez zapytania, a adres na `127.0.0.1`/`localhost` zastępuje GitHuba). Obsługa awarii lokalnie, bez telemetrii i sieci (`crashHandling.ts`, licznik `crashGuard.ts`): okno aplikacji po awarii renderera przeładowuje się samo, a po czwartej awarii w ciągu minuty pyta „Wczytaj ponownie” / „Zakończ”; nieobsłużony wyjątek lub odrzucona obietnica → log i natywne okno błędu w języku interfejsu (najwyżej raz na minutę); awaria ukrytego okna wydruku od razu kończy eksport błędem. Żadna treść nie otwiera nowych okien, nie nawiguje poza aplikację ani sama nie przeładowuje okna (`lockNavigation` w `windows.ts`, bez wyjątków; „Wczytaj ponownie” z ekranu błędu przeładowuje okno przez proces główny). Jedna instancja aplikacji na folder danych (`app.requestSingleInstanceLock()` po ustawieniu `userData`): druga kopia kończy się od razu, bez okna, a działające okno wychodzi na wierzch (przywrócone, jeśli było zminimalizowane). Okno ma rozmiar minimalny 960×640. Logi i wyjątki procesu głównego są po angielsku.
- **preload**: wąskie API przez `contextBridge`: `cv.list/get/create/addSample/save/delete/duplicate/import/export`, `settings.get/save`, `pdf.export`, `photo.pick`, `language.get/onChange` (bieżący język interfejsu i jego zmiany), `editor.onHistoryCommand` (otwarty edytor dostaje Cofnij / Ponów z menu), `editor.onFlushRequest` (proces główny prosi edytor o zapis przed zamknięciem okna lub zakończeniem aplikacji i dostaje wynik), `menu.setScreen/onCommand` (renderer zgłasza bieżący ekran: biblioteka CV, biblioteka klauzul albo edytor, i dostaje komendy menu Plik), `app.version` (numer wersji z procesu głównego dla stopki biblioteki CV i okna „Więcej”), `app.reload` (ekran błędu prosi proces główny o przeładowanie swojego okna), `updates.notice/onNotice/download/dismiss` (Update notice w bibliotece CV; adres strony wydania i zamykaną wersję zna tylko proces główny). `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- **renderer** (React):
  - `domain/` – schematy Zod, migracje, formatowanie dat, generator bloków, `paginate` (bez Reacta, testowane w Vitest).
  - `template/` – komponenty renderujące bloki i strony (`<CvPages>`), CSS przeniesiony z template'u, fonty `@font-face` z plików lokalnych.
  - `editor/` – formularze sekcji, drag & drop, kadrowanie zdjęcia, biblioteka klauzul.
  - `preview/` – panel podglądu: licznik stron, informacja o długości CV, powiększenie (dopasowanie do szerokości, +, −, 100%).
  - `i18n.tsx` – bieżący język interfejsu z procesu głównego (`useInterfaceLanguage`, `useDictionary`); jego zmiana od razu przerysowuje okno. Słowniki w `src/shared/i18n/` (wspólne z main).
  - `store/` – Zustand + zundo, autozapis.
  - `ErrorBoundary.tsx` – błąd renderowania pokazuje przetłumaczony ekran „Coś poszło nie tak” z „Wczytaj ponownie” zamiast pustego okna (owija `<App />` wewnątrz `InterfaceLanguageProvider`; trasa wydruku nie jest owijana). Oczekującą zmianę zapisuje sprzątanie edytora przy odmontowaniu.
- **Testy**: Vitest dla `paginate`, generatora bloków, migracji, formatowania dat. Playwright (Electron): start aplikacji → przykładowe CV → eksport PDF → plik istnieje i ma oczekiwaną liczbę stron. Testy e2e domyślnie wymuszają angielski (`MOJE_CV_LANGUAGE=en`); osobne testy sprawdzają uruchomienie po polsku, zmianę języka oraz w pętli po wszystkich 16 językach: start, menu, liczbę stron przykładowego CV w PDF i to, że teksty mieszczą się w przyciskach i paskach.

## 7. Plan wdrożenia (etapy pionowe)

1. Szkielet electron-vite + statyczny podgląd przykładowego CV z podziałem na strony i klauzulą (dane z kodu).
2. Eksport PDF (ukryte okno, printToPDF, metadane, dialog zapisu).
3. Formularz edycji wszystkich sekcji + kolejność + przełączniki „nowa strona” + kolor + font.
4. Biblioteka CV, autozapis, undo/redo, import/eksport JSON, migracje.
5. Biblioteka klauzul.
6. Zdjęcie: wgrywanie, kadrowanie, „bez zdjęcia”.
7. Build `.dmg` universal + instrukcja pierwszego uruchomienia (PL).

## 8. Poza zakresem v1

Wiele template'ów, formatowanie tekstu, podpisywanie/notaryzacja, auto-update, wersje Win/Linux (niezablokowane, ale nietestowane).
