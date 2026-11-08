# #84 Eksport CV do edytowalnego pliku DOCX – grilling

Sesja „grilling” (z dopisywaniem do glosariusza i ADR) nad issue #84 i researchem `docs/research/editable-export-docx.md`.
Stan na 2026-11-08, gałąź `feature/issue-84-docx-export`.

**Uwaga:** sesja odbyła się bez właściciela. Każde pytanie ma rekomendację agenta przyjętą jako decyzję roboczą.
Decyzje Q1, Q6, Q14 i Q18 odchodzą od treści issue albo są decyzjami produktowymi; pierwotnie czekały na
potwierdzenie właściciela. 2026-11-08 właściciel przekazał decyzje agentowi i wszystkie zostały **przyjęte** bez zmian
(oznaczone **[przyjęte]**), a ADR-0008 ma status *accepted*. Spec opublikowany jako #89.

Przeczytane: `CLAUDE.md`, `docs/agents/*.md`, `GLOSSARY.md`, ADR 0001–0006 (i ADR-0007 z gałęzi
`feature/issue-41-mac-app-store`, status *proposed*), research, `src/main/pdfExport.ts`, `src/main/pdfFileName.ts`,
`src/main/menu.ts`, `src/main/menuCommands.ts`, `src/shared/api.ts`, `src/preload/index.ts`,
`src/renderer/src/domain/{schema,blocks,templateGeometry}.ts`, `src/renderer/src/template/*`,
`src/renderer/src/CvScreen.tsx`, `src/shared/i18n/{en,languages}.ts`, `src/shared/cvFonts.ts`, `electron-builder.yml`,
`e2e/export.spec.ts`.

Nowe pojęcie w `GLOSSARY.md`: **DOCX export**. Nowy ADR: `docs/adr/0008-docx-export-shared-layout-built-in-main.md`
(numer 0008, bo 0007 jest już zajęty na gałęzi #41).

---

## A. Czy w ogóle DOCX

**Q1. Czy DOCX jest właściwym MVP, czy zamiast niego „własna sekcja” w aplikacji?** **[przyjęte]**
Decyzja: DOCX zostaje MVP tego issue. „Własna sekcja” (sekcja z dowolnym tekstem) idzie jako **osobne issue**,
niezależne od #84, bez blokowania się nawzajem.
Uzasadnienie: własna sekcja pokrywa tylko „dodam akapit tekstu” w ramach istniejących szablonów i wymaga podbicia
`CV_SCHEMA_VERSION` (nowy typ w `sectionSchema`, ADR-0002), formularza i widoku w 3 szablonach. DOCX pokrywa też
przypadki, których żadna sekcja nie obsłuży: dowolny układ, tabela, logo, oraz bardzo częsty wymóg agencji
rekrutacyjnych „proszę o CV w Wordzie”. Oba kierunki się nie wykluczają (research §7), ale tylko DOCX nie dotyka
schematu, więc jest tańszy w utrzymaniu kompatybilności plików.

**Q2. Czy DOCX ma być „kopią” wybranego Template, czy osobnym, uproszczonym układem?**
Decyzja: jeden wspólny, uproszczony **układ DOCX** dla wszystkich szablonów. Z CV design przenoszone są tylko: kolor
akcentu, font i CV language. Template nie zmienia DOCX-a. Wierne warianty per szablon są poza zakresem (Q30).
Uzasadnienie: zgodne z MVP w issue; celem pliku jest edycja, nie wierność. PDF pozostaje wiernym odwzorowaniem
podglądu. Zapisane w `GLOSSARY.md` (DOCX export) i ADR-0008.

**Q3. Czy aplikacja kiedykolwiek wczytuje DOCX z powrotem?**
Decyzja: nie. DOCX to plik wyjściowy, jednokierunkowy; źródłem prawdy pozostaje CV w bibliotece (i eksport JSON).
Uzasadnienie: import DOCX to osobny, ogromny problem (dowolna treść po edycji). Zapisane w definicji w glosariuszu, żeby
nikt nie oczekiwał „round-tripu”.

## B. Architektura

**Q4. Gdzie powstaje DOCX: proces main czy renderer?**
Decyzja: proces main, biblioteka `docx` (^9.15, MIT) jako zależność produkcyjna, zapis przez `dialog.showSaveDialog`.
Uzasadnienie: osadzanie fontów wymaga `Buffer` z plikami TTF (`FontOptions.data`), które main czyta z zasobów aplikacji
bez luzowania CSP (`font-src 'self'`) i bez przesyłania megabajtów przez IPC; `Packer.toBuffer` działa tylko w Node.
Wzorzec jak `pdf:export`: renderer wysyła `CvDocument`, main waliduje `cvDocumentSchema.parse`.

**Q5. Z czego budowany jest DOCX: z `CvDocument` bezpośrednio czy z bloków `generateBlocks`?**
Decyzja: z bloków `generateBlocks(document, DOCX_BLOCK_GEOMETRY)`.
Uzasadnienie: bloki są jedyną definicją tego, co trafia na dokument (pomijanie pustych pól, pustych i ukrytych sekcji,
daty z „present” w CV language, `breakBefore`, `keepWithNext`). Własna logika na `CvDocument` szybko by się rozjechała
z PDF-em. `blocks.ts` jest czystym TS (importuje tylko `shared/i18n` i typy), main już importuje z `domain` (`schema.ts`).

**Q6. Czy potrzebny jest refaktor „geometria szablonów do modułów bez CSS”?** **[przyjęte; odchodzi od issue]**
Decyzja: **nie w MVP.** Układ DOCX ma własną, stałą geometrię (`DOCX_BLOCK_GEOMETRY`: odstępy w mm i
`listSectionLayout: { title: 'above', columns: 1 }`) oraz własne marginesy strony, w module CSS-free obok buildera.
Main nie importuje żadnego `template/*/index.ts(x)`. Refaktor (`template/<id>/geometry.ts` + `Record<CvTemplateId, …>`)
wraca dopiero razem z wiernymi wariantami per szablon (Q30).
Uzasadnienie: skoro układ jest wspólny (Q2), branie marginesów i `listSectionLayout` z szablonu dałoby „pół-szablon”
(np. listy w 2 kolumnach z `modern` w tabeli), czyli bardziej skomplikowany i mniej edytowalny plik, a refaktor
kosztowałby czas bez wartości dla użytkownika. Brak zależności main → szablony usuwa też problem importu CSS.

**Q7. Jak podzielić kod?**
Decyzja:
- `src/main/docx/docxDocument.ts` – czysty moduł (bez Electrona, jak `pdfFileName.ts`): `CvDocument` + fonty (`Buffer`y
  przekazane z zewnątrz) → `Buffer` DOCX. Tu `DOCX_BLOCK_GEOMETRY`, style, mapowanie bloków.
- `src/main/docx/fontCoverage.ts` – czysta funkcja dzieląca tekst na odcinki font główny / font zastępczy (Q15).
- `src/main/docx/docxFonts.ts` – ścieżki i odczyt TTF z zasobów (jedyne miejsce zależne od `app`).
- `src/main/docxExport.ts` – rejestracja `docx:export` (walidacja, nazwa pliku, okno zapisu, zapis).
Uzasadnienie: builder testowalny jednostkowo bez Electrona; IPC cienkie jak w `pdfExport.ts`.

**Q8. Wspólne elementy z eksportem PDF.**
Decyzja:
- `pdfFileName` → `exportFileName({ fullName, cvName, language, extension: 'pdf' | 'docx' })` (ten sam algorytm,
  `CV_Imie_Nazwisko.docx`; plik i test przemianowane).
- Tytuł dokumentu (`CV – Imię Nazwisko` / `CV`) wydzielony z `withMetadata` do jednej funkcji używanej przez PDF i DOCX.
- Biała lista zapisanych ścieżek (`exportedPaths`) wydzielona do `src/main/exportedFiles.ts`, kanały
  `exported:open` / `exported:show-in-folder` (preload: `window.api.exported.open/showInFolder`) zamiast `pdf:open` /
  `pdf:show-in-folder`.
- Reguła „klauzula widoczna = `enabled` i niepusty tekst” (dziś inline w `CvPages.tsx`) wydzielona do `domain`
  (np. `consentText(document): string | null`) i używana w obu miejscach.
Uzasadnienie: te same reguły w obu eksportach nie mogą się rozjechać; zmiana API preload jest mała (jeden ekran).

**Q9. Czy DOCX zmienia schemat CV (ADR-0002) albo ustawienia aplikacji?**
Decyzja: nie. Brak podbicia `CV_SCHEMA_VERSION`, brak nowych pól w `appSettingsSchema` (patrz Q14 – brak opcji).
Uzasadnienie: eksport tylko czyta dane CV.

**Q10. Sandbox i kanały dystrybucji (ADR-0003, ADR-0005/0006, ADR-0007).**
Decyzja: bez nowych entitlements. Zapis przez okno zapisu = istniejące `files.user-selected.read-write`; fonty czytane
z `Contents/Resources` bundla; żadnej sieci (więc build MAS bez `network.client` działa tak samo). Funkcja jest
identyczna w `.dmg` i Mac App Store (żadnego `isMacAppStore()`). ADR-0007 (renderery bez sandboksu Chromium) nie ma
znaczenia: DOCX powstaje w main, z danych zwalidowanych schematem.
Uzasadnienie: research §6; generowanie to czysty JS w pamięci.

**Q11. Wpływ na checklisty „nowy szablon” (`schema.ts`) i „nowy język” (`languages.ts`).**
Decyzja:
- `schema.ts`: **brak** nowego kroku dla nowego szablonu (układ DOCX jest wspólny). Dopisać jedno zdanie komentarza,
  że DOCX celowo nie zależy od szablonu (ADR-0008), żeby nikt nie szukał „mapowania DOCX”.
- `languages.ts`: nowy krok „tag języka dla DOCX” – mapowanie `Record<CvLanguage, string>` (Q19) wymusi go kompilacją.
Uzasadnienie: issue zakładało krok w `schema.ts`, ale wynikał on z mapowania per szablon, którego w MVP nie ma.

## C. Fonty

**Q12. Skąd biorą się pliki fontów do osadzenia?**
Decyzja: niezmienione **statyczne TTF** od upstreamu, zacommitowane do repo w `resources/fonts/<rodzina>/` razem z
`OFL.txt` każdej rodziny i plikiem `SOURCES.md` (URL, commit/wydanie, SHA-256 każdego pliku):
- Lato: `google/fonts` `ofl/lato` – `Lato-Regular/Bold/Italic/BoldItalic.ttf` (ta sama wersja Lato, z której
  pochodzi `@fontsource/lato`, więc DOCX i podgląd mają te same glify),
- Arimo: `googlefonts/arimo` `fonts/ttf` – 4 statyczne kroje,
- Source Sans 3: `adobe-fonts/source-sans` wydanie 3.052R, `TTF-source-sans-3.052R.zip` – 4 statyczne kroje.
Bez pobierania w czasie budowania i bez konwersji WOFF2 z `@fontsource`.
Uzasadnienie: konwersja formatu to modyfikacja w rozumieniu OFL FAQ, a Lato i Source Sans 3 mają Reserved Font Name
(research §5). Pliki w repo = powtarzalny build offline; sumy kontrolne = łatwa weryfikacja przy aktualizacji.

**Q13. Jak fonty trafiają do aplikacji i jak main je znajduje?**
Decyzja: `extraResources` w `electron-builder.yml` (`from: resources/fonts`, `to: fonts`); w main
`app.isPackaged ? join(process.resourcesPath, 'fonts') : join(app.getAppPath(), 'resources/fonts')`. Pliki `OFL.txt`
jadą razem z fontami. Wzrost paczki: 12 plików TTF, ok. 5–7 MB.
Uzasadnienie: poza asarem, ten sam mechanizm co `container-migration.plist` na gałęzi #41; OFL wymaga dołączenia
licencji przy redystrybucji fontu w oprogramowaniu. Wariant z importem `?asset` w electron-vite odrzucony jako mniej
przejrzysty przy 12 plikach i zależny od zachowania bundlera.

**Q14. Osadzanie fontów: opcja (domyślnie włączona), opt-in, czy zawsze?** **[przyjęte; odchodzi od issue]**
Decyzja: w MVP **zawsze osadzamy**, bez przełącznika w UI. Osadzany jest tylko font CV (4 kroje), a Source Sans 3
(4 kroje) dodatkowo tylko wtedy, gdy font CV to Lato i tekst rzeczywiście zawiera znaki spoza Lato (Q15). Pełne pliki,
bez podzbiorów. Test pilnuje budżetu rozmiaru (Q27); przełącznik „bez osadzania” wraca jako osobne zadanie, jeśli
zmierzony rozmiar przekroczy budżet albo użytkownicy zgłoszą limity uploadu.
Uzasadnienie: docelowy użytkownik jest nietechniczny i nie oceni, co znaczy „osadź fonty”; aplikacja nie ma okna
ustawień (ADR-0006, „deferred”), a każda opcja to 16 tłumaczeń, stan i testy. Rekruter z Wordem na Windows to główny
odbiorca pliku, a tylko Word honoruje osadzanie – bez niego dostałby font zastępczy. Microsoft odradza osadzanie
podzbiorów przy edycji (research §5). Rozmiar w researchu (~2,5 MB) jest liczony bez kompresji ZIP; realny trzeba
zmierzyć.

**Q15. Font zastępczy (Lato bez cyrylicy i wietnamskiego) w DOCX.**
Decyzja: builder dzieli tekst na odcinki: znaki z zakresów Unicode podzbiorów `@fontsource/lato`, które ładuje
renderer, idą Lato, pozostałe – Source Sans 3 (osobne `TextRun` z `font`). Zakresy jako stałe w `fontCoverage.ts`,
test jednostkowy porównuje je z `unicode-range` w plikach CSS `@fontsource/lato`. Dla Arimo i Source Sans 3 brak
podziału (tak jak `fallbacks` w `template/fonts.ts`).
Uzasadnienie: Word nie ma stosu fontów jak CSS; bez podziału cyrylica w Lato dałaby losowy font systemowy. Te same
zakresy co w rendererze = ten sam wybór fontu co w podglądzie.

**Q16. Fonty zmiennej szerokości (variable fonts).**
Decyzja: nie używamy ich wcale; tylko statyczne kroje 400/700 normal/italic.
Uzasadnienie: pytanie z „Do sprawdzenia w praktyce” staje się bezprzedmiotowe; wsparcie fontów zmiennych w edytorach
jest niepotwierdzone (research §5).

## D. Układ dokumentu

**Q17. Strona i marginesy.**
Decyzja: A4, marginesy 20 mm z każdej strony, bez stopki i numerów stron.
Uzasadnienie: marginesy szablonów (np. 12/16/10/12 mm w `classic`) są ciasne do dalszej edycji; numer strony ma tylko
część szablonów (`modern`, `bold`), więc wspólny układ go nie ma (Q30).

**Q18. Konstrukcje Worda: tabele czy przepływ tekstu?** **[przyjęte; częściowo odchodzi od researchu]**
Decyzja: przepływ tekstu wszędzie, gdzie się da; tabela bez obramowań tylko w nagłówku ze zdjęciem.
- Nazwisko: styl akapitu **Title** (nadpisany: font CV, pogrubienie, rozmiar jak w szablonach ~21 pt).
- Kontakty: jeden akapit na kontakt, etykieta pogrubiona, wartość po tabulatorze (stały tab ok. 25 mm), więc wartości
  są wyrównane bez tabeli; pusta etykieta = sama wartość.
- Podsumowanie: zwykły akapit, kursywa.
- Nagłówek ze zdjęciem: tabela 2 kolumny bez obramowań (lewa: nazwisko, kontakty, podsumowanie; prawa: zdjęcie).
  Bez zdjęcia – bez tabeli.
- Tytuły sekcji: styl **Heading 1** (kolor akcentu, cienka dolna linia w kolorze akcentu).
- Doświadczenie: akapit „stanowisko (pogrubione) ⇥ daty” z tabulatorem wyrównanym do prawego marginesu, akapit
  „firma – miejscowość”, punkty jako **prawdziwa lista punktowana** (numbering Worda).
- Wykształcenie: „poziom (pogrubiony), kierunek, uczelnia ⇥ daty”, analogicznie.
- Sekcje listowe: Heading 1 + lista punktowana (jeden element = jeden punkt), bo `DOCX_BLOCK_GEOMETRY` ma
  `title: 'above', columns: 1`.
- Bez pól tekstowych, kształtów, kolumn sekcji i obrazów pływających.
Uzasadnienie: celem jest dopisywanie własnych elementów – nagłówki, akapity, listy i tabulatory użytkownik powiela
kopiuj-wklej w każdym z czterech edytorów, a niewidoczne tabele są dla nietechnicznego użytkownika pułapką przy
edycji. Data po prawej odpowiada `modern` i `bold` (`.cv-role-row`). Tabulatory i listy są wspierane we wszystkich
czterech edytorach; tabela zostaje tylko tam, gdzie bez niej zdjęcie musiałoby pływać (mniej przenośne, research §4).

**Q19. Język dokumentu.**
Decyzja: `w:lang` = CV language w domyślnych właściwościach tekstu (docDefaults), jako pełny tag BCP 47 z mapy
`Record<CvLanguage, string>` (`en` → `en-US`, `pl` → `pl-PL`, `pt` → `pt-BR`, `es` → `es-ES`, …). Interface language nie
wpływa na treść pliku.
Uzasadnienie: sprawdzanie pisowni w Wordzie zależy od języka z regionem; `pt` w aplikacji jest brazylijski, `es`
europejski (`languages.ts`). `Record` wymusza wpis przy nowym języku (Q11). Zgodne z glosariuszem: CV language rządzi
dokumentem.

**Q20. Metadane.**
Decyzja: `title` = ten sam tytuł co w PDF (`CV – Imię Nazwisko`, Q8), `creator` (autor) = imię i nazwisko, puste pola
pominięte. Nazwa aplikacji nie trafia do autora.
Uzasadnienie: spec Q19 (metadane Title/Author w oryginalnym zapisie) – DOCX ma się zachowywać jak PDF.

**Q21. Zdjęcie.**
Decyzja: `ImageRun` inline w prawej komórce nagłówka, 30 × 40 mm (proporcje `PHOTO_ASPECT` 3:4). Data URL dekodowany w
main; typ z prefiksu MIME (`image/jpeg` → `jpg`, `image/png` → `png`); inny lub uszkodzony – DOCX bez zdjęcia, eksport się
nie wywraca. Bez ponownej kompresji.
Uzasadnienie: po kadrowaniu zdjęcie jest JPEG-iem (`PhotoField.tsx`), więc wchodzi bez konwersji; PNG to zabezpieczenie
dla starszych lub importowanych plików (`schema.ts` przyjmuje dowolny string). 42 mm z `classic` jest za duże przy
wspólnym układzie.

**Q22. Kolor akcentu.**
Decyzja: akcent tylko w stylu Heading 1 (tekst + dolna linia). Nazwisko, tekst i punkty w kolorze tekstu. Żadnych
wypełnień akcentem, więc `onAccentColor` nie jest potrzebny. Kolor bierzemy wyłącznie z CV design – Appearance (ADR-0004)
nie ma wpływu.
Uzasadnienie: akcent w stylu nagłówka przenosi się na sekcje dopisane przez użytkownika (zmienia się w jednym miejscu
w stylach); wypełnienia przenoszą się między edytorami gorzej.

**Q23. Klauzula zgody.**
Decyzja: ostatni akapit dokumentu, 8 pt, kolor przygaszony, odstęp przed nim ok. 6 mm; łamania wierszy z treści
zachowane jako miękkie podziały (`white-space: pre-line` w szablonach). Ta sama reguła widoczności co w podglądzie (Q8).
Bez przypinania do dołu strony.
Uzasadnienie: przypięcie (tabela pływająca) jest kruche poza Wordem (research §4); po edycji i tak nie wiemy, gdzie
będzie koniec dokumentu.

**Q24. Podział stron i odstępy.**
Decyzja: `breakBefore` → `pageBreakBefore`, `keepWithNext` → `keepNext`; dodatkowo `keepNext` na wierszach stanowiska i
firmy, żeby wpis nie odrywał się od pierwszego punktu. `spaceAfterMm` z bloków → odstęp po akapicie. Wielowierszowe
podsumowanie i punkty – miękkie podziały wierszy. Ostrzeżenie „treść się nie mieści, eksportować mimo to?” nie dotyczy
DOCX (tekst przepływa).
Uzasadnienie: bezpośrednie odpowiedniki (research §3); pagination z `paginate.ts` jest specyficzna dla PDF.

## E. Interfejs i i18n

**Q25. Jak użytkownik uruchamia eksport?**
Decyzja: menu Plik „Export to DOCX…” pod „Export to PDF…” (bez skrótu klawiszowego; nowa `MenuCommand`
`'export-docx'` w `exportCommands`, aktywna tylko w edytorze) oraz drugi przycisk w pasku narzędzi edytora obok
głównego „Export to PDF” (zwykły, nie `button-primary`). Stan eksportu osobny, jak `jsonExport` w `CvScreen.tsx`:
przycisk nieaktywny w trakcie, potem powiadomienie „Saved DOCX: plik” z „Open” i „Show in Finder”, albo błąd.
Uzasadnienie: ten sam wzorzec co PDF i JSON; menu dla odkrywalności, przycisk dla częstego użycia. Rozwijany przycisk
(split button) to nowy komponent bez precedensu w aplikacji.

**Q26. Jak komunikujemy, że DOCX wygląda inaczej niż PDF?**
Decyzja: jedno zdanie w powiadomieniu po zapisie, np. „Simplified layout for editing in Word, Pages, LibreOffice or
Google Docs. The PDF matches the preview.” Bez dodatkowego okna przed eksportem.
Uzasadnienie: główne ryzyko z researchu to oczekiwania co do wierności; powiadomienie widać przy każdym eksporcie, bez
dodatkowego kroku.

**Q27. Klucze i18n (ADR-0001, 16 słowników).**
Decyzja:
- `menu.exportDocx`: „Export to DOCX…”
- `dialogs.exportDocx`: „Export to DOCX”, `dialogs.docxFilter`: „Word Document (DOCX)”
- `editor.exportDocx`: „Export to DOCX”, `editor.savedDocx(fileName)`, `editor.docxNote` (Q26),
  `editor.exportDocxFailed`: „Couldn’t save the DOCX. Try again.”
- `editor.openPdf` → `editor.openFile` (ten sam tekst „Open”, wspólny dla obu powiadomień).
Tłumaczenia robi agent, przegląd natywny osobno (praktyka z ADR-0001). Nazwa „DOCX” nie jest tłumaczona.
Uzasadnienie: „DOCX” zamiast „Word”, bo plik jest dla czterech edytorów (stąd też _Avoid_ „Word export” w glosariuszu);
nazwa filtra mówi zwykłemu użytkownikowi, czym jest plik.

## F. Testy

**Q28. Strategia testów.**
Decyzja:
- **Vitest, `docxDocument.test.ts`:** budowa `Buffer`, rozpakowanie (`fflate` jako jawna devDependency) i asercje na
  XML: `word/document.xml` (style Title / Heading1 przy nazwisku i tytułach, `w:numPr` przy punktach, tabulator z datami,
  `w:pageBreakBefore` z danych, brak ukrytych sekcji, klauzula jako ostatni akapit tylko gdy włączona i niepusta,
  miękkie podziały), `word/styles.xml` (kolor akcentu w Heading1, font CV, `w:lang` z mapy), `docProps/core.xml`
  (tytuł, autor), `word/media/*` (zdjęcie JPEG; brak przy złym data URL), `word/fontTable.xml` + `word/fonts/*.odttf`
  (osadzone 4 kroje fontu CV; Source Sans 3 tylko dla Lato z cyrylicą). Sample CV we wszystkich 16 językach buduje się
  bez błędu i mieści w budżecie rozmiaru (start: 3 MB; do skorygowania po pierwszym pomiarze).
- **Vitest, `fontCoverage.test.ts`:** podział tekstu (łacina, polskie litery, cyrylica, wietnamski), zgodność zakresów
  z `unicode-range` w CSS `@fontsource/lato`.
- **Vitest:** `exportFileName` (rozszerzenia), `enabledMenuCommands` (`export-docx` tylko w edytorze), mapa tagów
  języków (komplet, poprawne BCP 47 przez `Intl.getCanonicalLocales`).
- **Playwright (`e2e/export.spec.ts`):** `stubSaveDialog`, eksport z przycisku i z menu, plik jest ZIP-em z
  `word/document.xml` zawierającym imię z Sample CV; opcje okna zapisu (tytuł, filtr, domyślna nazwa `.docx`);
  powiadomienie z „Open” / „Show in Finder”; anulowanie nic nie zapisuje. Jeden przebieg na zbudowanej paczce
  (`test:e2e:packaged`), żeby złapać brakujące `extraResources` z fontami.
- **Ręczna macierz przed merge:** Word M365 (Mac; Windows jeśli dostępny), Pages, LibreOffice, Google Docs – Sample CV
  `en` i `ru` (z Lato): otwiera się, fonty (osadzone / dopasowane po nazwie / zamiennik), style nagłówków w galerii,
  listy, daty po prawej, zdjęcie, klauzula, dopisanie nowego wpisu przez kopiuj-wklej. Wyniki dopisane do
  `docs/research/editable-export-docx.md` i do `docs/release-checklist.md` jako krok przy zmianach w DOCX.
Uzasadnienie: logika siedzi w czystym builderze, więc większość pokrywają szybkie testy jednostkowe na XML; e2e
sprawdza tylko spięcie IPC, okna zapisu i zasobów; wizualnej zgodności edytorów nie da się zautomatyzować.

## G. Ryzyka z „Do sprawdzenia w praktyce”

**Q29. Czy Pages, Google Docs i LibreOffice używają fontów osadzonych w DOCX? Co jeśli nie?**
Decyzja: akceptujemy wynik niezależnie od testu, bez dodatkowej pracy w MVP; ręczna macierz (Q28) tylko zapisuje fakty.
Plan na każdy edytor: Word – osadzone fonty działają (udokumentowane); Google Docs – Lato, Arimo i Source Sans 3 są w
Google Fonts, więc dopasowanie po nazwie; LibreOffice – deklaruje osadzanie, do potwierdzenia; Pages – przy braku fontu
pokazuje „Replace Fonts” (udokumentowane), użytkownik może zainstalować font. Gdy test pokaże, że Pages / LibreOffice
ignorują osadzanie, dopisujemy na stronie pomocy jedno zdanie „zainstaluj font X” z linkiem do Google Fonts.
Uzasadnienie: żaden z wyników nie zmienia konstrukcji pliku; najgorszy przypadek to font zastępczy w edytorze, który
i tak nie jest głównym odbiorcą.
Fonty zmiennej szerokości: rozstrzygnięte przez Q16 (nie używamy).

## H. Zakres

**Q30. Co jest poza zakresem #84?**
Decyzja:
- wierne warianty per szablon (pas akcentu `bold`, oś czasu `modern`, stopka „imię · n / m”, listy w 2 kolumnach,
  tytuł obok listy) i potrzebny do nich refaktor geometrii (Q6), +1–3 dni na szablon,
- przełącznik „bez osadzania fontów” (Q14),
- „własna sekcja” (Q1 – osobne issue),
- ODT, RTF, eksport w Windows/Linux, import DOCX (Q3),
- osadzanie podzbiorów fontów.
W zakresie dodatkowo: wpis w `CHANGELOG.md`, akapit o DOCX na stronie pomocy (z informacją, że wygląd jest uproszczony),
zaktualizowanie opisu w `package.json` (dziś „eksport do PDF”).
Uzasadnienie: utrzymuje MVP w 4–6 dniach z researchu.

**Q31. Podział na tickety.**
Decyzja: #84 dzielimy na dwa zadania implementacyjne + jedno osobne issue:
1. **DOCX export bez osadzania** – builder (Q5–Q8, Q15 bez osadzania: fonty tylko po nazwie, z podziałem cyrylicy),
   układ (Q17–Q24), IPC, okno zapisu, menu i przycisk, i18n w 16 językach, testy jednostkowe i e2e. Samodzielnie
   wartościowe i wydawalne (ok. 3–4 dni).
2. **Osadzanie fontów w DOCX** – TTF + `OFL.txt` + `SOURCES.md` w repo, `extraResources`, odczyt w main, osadzanie w
   builderze, budżet rozmiaru, e2e na paczce, ręczna macierz edytorów (ok. 1–1,5 dnia). Blokowane przez 1.
3. **Własna sekcja w CV** (osobne issue, `needs-triage`) – niezależne od #84.
Uzasadnienie: osadzanie fontów niesie całe ryzyko licencyjno-pakowe i rozmiarowe, a bez niego DOCX i tak działa
(Google Docs dopasuje fonty po nazwie, Word podstawi zamiennik); rozdzielenie pozwala wydać i przetestować układ
wcześniej.
