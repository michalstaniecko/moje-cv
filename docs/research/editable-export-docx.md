# Eksport CV do edytowalnego pliku (DOCX i inne) – research

Pytanie: czy CV Drawer może eksportować CV do pliku edytowalnego (np. DOCX), żeby użytkownik mógł dopisać w nim zupełnie własny element?

Stan na 2026-11-08. Twierdzenia o kodzie aplikacji odsyłają do plików w repo; pozostałe – do źródeł pierwotnych (dokumentacja producentów, README/źródła bibliotek, rejestr npm, specyfikacje). Miejsca, w których nie znalazłem źródła pierwotnego, są oznaczone jako **niezweryfikowane**.

## TL;DR

- **Da się – i jest to dobrze osadzone w obecnej architekturze.** Najlepsza droga to **DOCX budowany natywnie z modelu CV** (bloków), biblioteką [`docx`](https://github.com/dolanmiu/docx) (MIT, aktywnie rozwijana – wersja 9.15.3 wydana 2026-11-06 wg `npm view docx time`), **w procesie main**, zapis przez ten sam `dialog.showSaveDialog` co PDF.
- Układ szablonów (kolumna dat + treść, wiersze list „tytuł obok listy”, kontakty w 2 kolumnach) mapuje się na **tabele Worda bez obramowań** – najbardziej przenośną konstrukcję między Word / Pages / LibreOffice / Google Docs.
- Fonty (Lato, Arimo, Source Sans 3) są na licencji OFL z `fsType=0` (osadzanie „Installable”) i **można je osadzić w DOCX**; trzeba jednak dołączyć **oryginalne pliki TTF** (nie przerabiać WOFF2 z `@fontsource`), bo Lato i Source Sans 3 mają Reserved Font Name. Osadzanie honoruje Word (Windows, Microsoft 365 dla Mac) i LibreOffice; Pages i Google Docs – raczej nie (szczegóły niżej).
- Konwersja HTML→DOCX jest tania, ale gubi dokładnie te elementy, z których zbudowane są nasze szablony (CSS grid/flex). PDF→DOCX odpada (słaba jakość, brak sensownej biblioteki działającej w sandboxie).
- **Bez wpływu na schemat CV** (eksport jest pochodną danych, `CV_SCHEMA_VERSION` się nie zmienia). Wpływ na i18n: nowe napisy w 16 słownikach.
- **MVP**: jeden „układ DOCX” wspólny dla wszystkich szablonów (tabele, akcent, font, zdjęcie, klauzula), z osadzonymi fontami; ok. **4–6 dni pracy**. Wierniejsze odwzorowanie każdego z 3 szablonów: +1–3 dni na szablon.

---

## 1. Jak aplikacja działa dziś (kontekst)

- **Model danych**: `cvDocumentSchema` (zod) – nagłówek (imię, zdjęcie jako data URL, kontakty, podsumowanie), sekcje trzech typów (`experience`, `education`, `list`) z flagami `hidden` i `pageBreakBefore`, klauzula zgody, ustawienia (`accentColor`, `font`, `template`, `language`) – `src/renderer/src/domain/schema.ts`.
- **Bloki**: `generateBlocks` zamienia CV na niepodzielne bloki (`header`, `sectionTitle`, `experienceEntry`, `experienceBullet`, `educationEntry`, `listRow`) z `keepWithNext`, `breakBefore`, `spaceAfterMm` i gotowym tekstem dat w CV language – `src/renderer/src/domain/blocks.ts`, `src/renderer/src/domain/dates.ts`. Moduł domeny jest czystym TS (importuje tylko `shared/i18n`), więc da się go użyć w main – `pdfExport.ts` już importuje stamtąd schemat.
- **Szablony**: React + CSS (`classic`, `modern`, `bold`); różnią się geometrią (`TemplateGeometry`: marginesy, odstępy, `listSectionLayout`), nadpisaniami komponentów bloków i opcjonalną stopką strony (`modern`, `bold`: imię + numer strony / liczba stron) – `src/renderer/src/template/*`, `src/renderer/src/domain/templateGeometry.ts`. Układy to CSS grid/flex, np. `classic`: `.cv-entry { grid-template-columns: 38mm 1fr }` (`src/renderer/src/template/classic/classic.css`); `modern`: kontakty w `grid-template-columns: repeat(2, …)` i oś czasu (`modern.css`); `bold`: pas akcentu „ze spadem” w nagłówku, rysowany pseudo-elementem wychodzącym w marginesy (`bold.css`). Obecne szablony **nie mają bocznego paska (sidebara)** – to jednokolumnowe układy z wewnętrznymi siatkami.
- **Podział stron** liczy sama aplikacja (`paginate.ts`) na podstawie pomiaru bloków w DOM.
- **Eksport PDF**: ukryte `BrowserWindow` renderuje trasę `/print`, potem `webContents.printToPDF({ pageSize: 'A4', preferCSSPageSize: true, … })`, a `pdf-lib` dopisuje metadane; zapis przez `dialog.showSaveDialog` – `src/main/pdfExport.ts`. (`printToPDF` zwraca Promise z Bufferem PDF – [Electron: webContents.printToPDF](https://www.electronjs.org/docs/latest/api/web-contents#contentsprinttopdfoptions)).
- **Zdjęcie** jest po kadrowaniu zapisywane jako JPEG (`output.toDataURL('image/jpeg', …)` – `src/renderer/src/editor/PhotoField.tsx`), więc trafi do DOCX bez konwersji.
- **Fonty**: pakiety `@fontsource/*` (licencja `OFL-1.1` w ich `package.json`) dostarczają wyłącznie **WOFF/WOFF2 pocięte na podzbiory znaków** (`node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2` itd.). Do DOCX to się nie nadaje (patrz §4).

## 2. Formaty edytowalne – co gdzie się otworzy

| Format | Word | Pages (Mac) | LibreOffice | Google Docs |
|---|---|---|---|---|
| **DOCX** (OOXML, ECMA-376 / ISO/IEC 29500) | natywny | otwiera i edytuje `.doc`/`.docx` | tak | konwertuje |
| **ODT** (ODF) | tak, z różnicami | **nie** (brak na liście) | natywny | konwertuje |
| **RTF** | tak | tak | tak | konwertuje |
| HTML | tak (nie jako „dokument stronicowany”) | nie | tak | konwertuje |

Źródła:
- DOCX to Office Open XML, standard [ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/) (wydanie 5, część 1 z 12.2016), tożsamy z ISO/IEC 29500.
- Pages: „You can open and edit Microsoft Word documents (files with a .doc or .docx filename extension) … text documents (files with a .rtf or .txt filename extension)”, „You can’t open PDFs in Pages” – [Pages User Guide: Open or close a document](https://support.apple.com/guide/pages/open-or-close-a-document-tancdeedb11c/mac). ODT nie jest wymieniony.
- Google Docs konwertuje: „.doc (if newer than Microsoft® Office 95), .docx, .docm .dot, .dotx, .dotm, .html, plain text (.txt), .rtf, .odt” – [Google Docs Help: Work with Office files](https://support.google.com/docs/answer/6055139?hl=en).
- Word a ODT: tabele „Partially Supported”, pola tekstowe nie mogą być zagnieżdżone, ramki są zamieniane na pola tekstowe, sekcje z ciągłym podziałem mogą tracić właściwości – [Microsoft: Differences between the OpenDocument Text (.odt) format and the Word (.docx) format](https://support.microsoft.com/en-US/Word/differences-between-the-opendocument-text-odt-format-and-the-word-docx-format).

**Wniosek:** DOCX to jedyny format, który otwiera się we wszystkich czterech głównych edytorach (w tym w Pages, czyli domyślnym edytorze użytkownika Maca bez Office). ODT wypada przez brak obsługi w Pages; RTF ma zbyt ubogi model układu (brak sensownych zdjęć/tabel w praktyce między aplikacjami – **niezweryfikowane** na źródłach, ale bez znaczenia, skoro DOCX pokrywa wszystko).

## 3. Biblioteki JS do generowania DOCX / ODT

Dane z rejestru npm (`npm view <pakiet> version license time`) i z API GitHuba (`gh api repos/<repo>`), pobrane 2026-11-08.

| Biblioteka | Licencja | Ostatnie wydanie | Podejście | Uwagi |
|---|---|---|---|---|
| [`docx`](https://github.com/dolanmiu/docx) (dolanmiu) | MIT | 9.15.3 – 2026-11-06 | budowanie dokumentu z obiektów TS | Node + przeglądarka; zależności: `fflate`, `nanoid`; 1 otwarte issue |
| [`docxtemplater`](https://docxtemplater.com/) | MIT lub GPLv3 (rdzeń) | 3.71.1 – 2026-10-15 | wypełnianie szablonu `.docx` tagami | obrazy, HTML, stylowanie to **płatne moduły** (500 €/rok za moduł) – [cennik](https://docxtemplater.com/pricing/) |
| [`@turbodocx/html-to-docx`](https://github.com/TurboDocx/html-to-docx) | MIT | 1.23.3 – 2026-10-30 | HTML → DOCX | aktywny fork `html-to-docx`; build przeglądarkowy ok. 1,6 MB |
| [`html-to-docx`](https://github.com/privateOmega/html-to-docx) | MIT | 1.8.0 – 2023-03-26 | HTML → DOCX | brak wydań od 2023; README: „Currently it doesn't work with browser directly” |
| [`html-docx-js`](https://github.com/evidenceprime/html-docx-js) | MIT | 0.3.1 – 2016-05-17 | HTML osadzony jako altChunk | porzucona |
| [`officegen`](https://github.com/Ziv-Barber/officegen) | MIT | 0.6.5 – 2021-03-06 | strumieniowe generowanie | porzucona |
| [`simple-odf`](https://github.com/connium/simple-odf) (ODT) | MIT | 3.0.3 – 2023-01-12 | budowanie ODT | brak wydań od 2023 |

### `docx` – szczegóły istotne dla CV Drawer

Na podstawie dokumentacji w repo (`docs/usage/*.md`) i typów z paczki `docx@9.15.3` (`dist/index.d.ts`):

- **Środowisko**: „Works for Node and on the Browser” ([README](https://github.com/dolanmiu/docx)); `Packer` zwraca `Buffer`, `Blob`, `ArrayBuffer`, string lub stream – `Packer.toBuffer` działa tylko w Node ([docs/usage/packers.md](https://github.com/dolanmiu/docx/blob/master/docs/usage/packers.md)). README linkuje nawet demo „My CV generated with docx”.
- **Tabele**: scalanie komórek (`gridSpan`), cieniowanie, obramowania, `cantSplit` (wiersz nie dzieli się między strony), `keepNext` na wierszu, tabele pływające (`tblpPr`) – `dist/index.d.ts`.
- **Sekcje i kolumny**: `properties.column: { count, space, separate, equalWidth, children }`, `ColumnBreak` ([docs/usage/columns.md](https://github.com/dolanmiu/docx/blob/master/docs/usage/columns.md)).
- **Obrazy**: `ImageRun` z `type: "jpg" | "png" | "gif" | "bmp"` lub `"svg"` z fallbackiem; inline lub pływające (`floating`), także w komórce tabeli i w nagłówku/stopce ([docs/usage/images.md](https://github.com/dolanmiu/docx/blob/master/docs/usage/images.md)). Nasz JPEG wchodzi bez konwersji.
- **Nagłówki/stopki**: `Header`/`Footer`, pola `PageNumber.CURRENT` / `TOTAL_PAGES` – wystarczy na stopkę „imię · 1 / 2” szablonów `modern` i `bold`.
- **Podział stron**: `pageBreakBefore`, `keepNext`, `keepLines` na akapitach – bezpośrednie odpowiedniki naszych `breakBefore`/`keepWithNext`.
- **Pola tekstowe i kształty**: `Textbox` (VML) oraz moduł `docx/shapes` – możliwe, ale patrz §5 (przenośność).
- **Język**: `language` w opcjach przebiegu tekstu (`ILanguageOptions` → `w:lang`) – ustawimy CV language (sprawdzanie pisowni w Wordzie).
- **Metadane**: `title`, `creator` itd. w `Document` – odpowiednik `withMetadata` z `pdfExport.ts`.
- **Osadzanie fontów**: `new Document({ fonts: [{ name, data, bold, italic, boldItalic, characterSet }] })`, każdy krój jako osobny plik `fonts/fontN.odttf` z kluczem GUID do zaciemnienia ([docs/usage/fonts.md](https://github.com/dolanmiu/docx/blob/master/docs/usage/fonts.md); typy `FontOptions`, `EmbeddedFontFile` w `dist/index.d.ts`). Pole `data` jest typu `Buffer` – naturalnie w procesie main.
- **HTML**: od wersji 9 jest `docx/html` (`htmlToContent`), ale dokumentacja wprost mówi: „CSS layout, such as flex and grid containers' columns, floats other than images', and positions, isn't read: their content is written in order” ([docs/usage/html.md](https://github.com/dolanmiu/docx/blob/master/docs/usage/html.md), sekcja „What isn't read”).
- **Rozmiar**: `dist/index.mjs` ~1,0 MB (niezminifikowany); `unpackedSize` 20,5 MB wynika z wielu formatów buildów (cjs/mjs/umd/iife + `.d.ts`). W procesie main rozmiar jest mało istotny.

### Pozostałe

- **`docxtemplater`**: wymaga ręcznie przygotowanego pliku `.docx` na szablon i płatnego modułu obrazów (zdjęcie) – [cennik](https://docxtemplater.com/pricing/). Darmowa aplikacja z 3 szablonami i 16 językami nic tu nie zyskuje względem `docx`.
- **HTML→DOCX** (`@turbodocx/html-to-docx`, `html-to-docx`): README `html-to-docx` ostrzega, że „Font family doesnt work consistently for all word processor softwares – LibreOffice ignores the fontTable.xml file … Word Online … finds closest font” ([README](https://github.com/privateOmega/html-to-docx)); nie ma tu osadzania fontów.
- **ODT**: jedyna sensowna biblioteka (`simple-odf`) nie ma wydań od 2023 – kolejny argument za DOCX.

## 4. Trzy podejścia do wierności

### (a) Natywny DOCX z modelu CV – **zalecane**

Generator w main bierze `CvDocument` → `generateBlocks(document, geometry)` → buduje akapity/tabele `docx`. Daje pełną kontrolę nad stylami Worda (nagłówki jako style „Heading”, listy jako prawdziwe listy punktowane), co jest dokładnie tym, czego potrzebuje ktoś, kto chce potem coś dopisać. Koszt: osobne mapowanie na każdy szablon (ale reużywa bloków i geometrii).

### (b) HTML wyrenderowanego szablonu → DOCX – tanie, niska wierność

Wszystkie trzy szablony opierają układ na CSS grid/flex (kolumna dat 38 mm w `classic.css`, siatki kontaktów w `modern.css`/`bold.css`, pas nagłówka w `bold.css`). Zarówno `docx/html` („CSS layout, such as flex and grid … isn't read”), jak i konwertery HTML→DOCX spłaszczyłyby to do jednej kolumny tekstu. Trzeba by i tak pisać osobny „HTML dla Worda” na tabelach – czyli wykonać pracę z (a), tylko przez dodatkową warstwę.

### (c) PDF → DOCX – odpada

Word potrafi otworzyć PDF i „attempting to match layout of the original PDF”, ale „it might not look exactly the way it looked as a PDF”; gorzej konwertują się m.in. tabele z odstępami między komórkami, kolory/obramowania stron i ramki ([Microsoft: Opening PDFs in Word](https://support.microsoft.com/en-us/word/opening-pdfs-in-word)). W ekosystemie JS nie znalazłem utrzymywanej biblioteki PDF→DOCX; rozwiązania typu LibreOffice headless wymagałyby dołączenia ogromnego binarium do sandboxowanej aplikacji. **Ale** to jest darmowe obejście już dziś: użytkownik z Wordem może otworzyć wyeksportowany PDF w Wordzie – warto o tym wspomnieć w pomocy, zanim funkcja powstanie.

### Jak mapować układy CV na Worda

| Układ w HTML/CSS | Tabela Worda (bez obramowań) | Kolumny sekcji | Pole tekstowe / kształt |
|---|---|---|---|
| Kolumna dat + treść (`classic`, `modern`) | **tak** – 2 kolumny, stałe szerokości | nie (kolumny sekcji to przepływ gazetowy, tekst przelewa się z lewej do prawej) | nie |
| Tytuł sekcji obok listy (`listSectionLayout.title: 'beside'`) | **tak** | nie | nie |
| Lista w 2 kolumnach (`columns: 2`) | **tak** (wiersz = `listRow`) | możliwe, ale przepływ zmienia kolejność | nie |
| Kontakty w siatce 2 kolumn | **tak** | nie | nie |
| Zdjęcie obok imienia | **tak** (komórka z `ImageRun` inline) | nie | pływający obraz – mniej przenośny |
| Pas akcentu „ze spadem” (`bold`) | przybliżenie: wiersz tabeli z cieniowaniem na szerokość treści (lub ujemne wcięcie tabeli) | nie | kształt zakotwiczony w nagłówku strony – wierne, ale kruche poza Wordem |
| Oś czasu z kropkami (`modern`) | przybliżenie: lewe obramowanie komórki + znak „●” w kolorze akcentu | nie | nie |
| Klauzula na dole ostatniej strony | akapit na końcu (lub tabela pływająca zakotwiczona do dolnego marginesu) | – | – |
| Stopka „imię · n / m” | stopka Worda z polami `PAGE`/`NUMPAGES` | – | – |
| (przyszły) boczny pasek – sidebar | 2-kolumnowa tabela na całą wysokość; nie powtarza się sam na kolejnych stronach | kolumny sekcji o różnej szerokości – tekst przelewa się między kolumnami, niezależny sidebar trudny | pole tekstowe zakotwiczone na stronie – najwierniejsze w Wordzie, najmniej przenośne |

Obsługa w edytorach:
- **Tabele** – wspierane wszędzie: Google Docs ma pełną edycję tabel ([Google Docs Help: Add and edit tables](https://support.google.com/docs/answer/1696711)); Word↔ODT tabele tylko „Partially Supported” (limit 64 kolumn, formatowanie motywu → formatowanie komórek) ([Microsoft, ODT vs DOCX](https://support.microsoft.com/en-US/Word/differences-between-the-opendocument-text-odt-format-and-the-word-docx-format)), co dla nas nie ma znaczenia.
- **Kolumny sekcji** – Google Docs ma kolumny i podział kolumny ([Google Docs Help: Columns](https://support.google.com/docs/answer/7029052)), ale to przepływ tekstu, nie siatka.
- **Pola tekstowe / kształty pływające** – w dokumentacji Google Docs i Pages nie znalazłem deklaracji, jak importują pola tekstowe DOCX (**niezweryfikowane – wymaga testu**). Społeczność Apple wskazuje, że funkcje Worda nieobsługiwane w Pages „will not be translated (dropped)” ([Apple Community](https://discussions.apple.com/thread/250549094) – źródło nieoficjalne). Dlatego MVP nie powinno ich używać.

## 5. Fonty

### Czy DOCX może osadzać fonty?

Tak. WordprocessingML ma w tabeli fontów elementy `w:embedRegular`, `w:embedBold`, `w:embedItalic`, `w:embedBoldItalic` z relacją do pliku fontu i atrybutem `w:fontKey` (klucz GUID) oraz `w:subsetted` ([Microsoft Learn: EmbedRegularFont – fragment ISO/IEC 29500-1 §17.8.3](https://learn.microsoft.com/en-us/dotnet/api/documentformat.openxml.wordprocessing.embedregularfont)). Plik fontu jest „zaciemniany” (obfuscated) kluczem GUID – algorytm opisuje ECMA-376 Part 1, §17.8.1 „Font Embedding” ([ECMA-376](https://ecma-international.org/publications-and-standards/standards/ecma-376/)). Biblioteka `docx` robi to sama: „Each face of a font is embedded as a file of its own, with a unique key for obfuscation” (`FontWrapper` w `dist/index.d.ts`; [docs/usage/fonts.md](https://github.com/dolanmiu/docx/blob/master/docs/usage/fonts.md)).

### Kto to honoruje

- **Word**: osadzanie obsługuje Word dla Microsoft 365 (Windows i Mac); zalecane formaty to OTF/TTF, „Not all TrueType fonts can be embedded”, a uprawnienia osadzania (Non-embeddable / Preview/Print / Editable / Installable) ustala autor fontu ([Microsoft: Benefits of embedding custom fonts](https://support.microsoft.com/en-us/office/fonts/benefits-of-embedding-custom-fonts)). Strona nie wymienia Worda w przeglądarce.
- **LibreOffice**: ma osadzanie fontów w dokumentach („embed document fonts into the document file, for portability”) ([LibreOffice Help: Font embedding](https://help.libreoffice.org/latest/en-US/text/shared/01/prop_font_embed.html)); strona pomocy nie precyzuje formatów – odczyt fontów osadzonych w DOCX **niezweryfikowany na źródle pierwotnym**, wymaga testu.
- **Pages**: przy brakującym foncie pokazuje powiadomienie i pozwala wybrać zamiennik (Format > Font > Replace Fonts) ([Pages: Open or close a document](https://support.apple.com/guide/pages/open-or-close-a-document-tancdeedb11c/mac)); o fontach osadzonych w DOCX dokumentacja milczy – zakładam, że ich nie używa (**niezweryfikowane**).
- **Google Docs**: nie ma udokumentowanego wsparcia dla fontów osadzonych w DOCX (**niezweryfikowane**). Łagodzi to fakt, że Lato, Arimo i Source Sans 3 są w Google Fonts (`ofl/lato`, `ofl/arimo`, `ofl/sourcesans3` w [google/fonts](https://github.com/google/fonts)), a Google Docs udostępnia czcionki z tej kolekcji przez „More fonts” – więc dopasowanie po nazwie ma duże szanse zadziałać (**wymaga testu**).

### Licencje i pliki

| Font | Licencja (plik `OFL.txt` w [google/fonts](https://github.com/google/fonts)) | Reserved Font Name | `fsType` w OS/2 (sprawdzone na pliku z google/fonts) |
|---|---|---|---|
| Lato | OFL 1.1 | **„Lato”** | 0 (Installable) |
| Arimo | OFL 1.1 (Arimo Project Authors) | brak | 0 |
| Source Sans 3 | OFL 1.1 (Adobe) | **„Source”** | 0 |

- OFL FAQ: osadzanie w dokumencie jest dozwolone („Yes, either in full or a subset”, Q1.12) i nie zmienia licencji dokumentu (Q1.13). Zmiana formatu fontu jest zwykle modyfikacją (Q2.2, Q2.4), a przy modyfikacji nie wolno używać Reserved Font Names ([OFL FAQ](https://openfontlicense.org/ofl-faq/)).
- Wniosek praktyczny: **nie** konwertować WOFF2 z `@fontsource` do TTF (to byłaby modyfikacja, a Lato/Source mają RFN – nazwa fontu w DOCX musiałaby się zmienić). Zamiast tego dołączyć **niezmienione statyczne TTF** od upstreamu: Lato z `google/fonts/ofl/lato` (`Lato-Regular.ttf`, `-Bold`, `-Italic`, `-BoldItalic`), Arimo z [googlefonts/arimo `fonts/ttf`](https://github.com/googlefonts/arimo) (statyczne `Arimo-Regular/Bold/Italic/BoldItalic.ttf`), Source Sans 3 z wydania [adobe-fonts/source-sans 3.052R](https://github.com/adobe-fonts/source-sans/releases) (`TTF-source-sans-3.052R.zip`). W `google/fonts` Arimo i Source Sans 3 są fontami zmiennymi (`[wght]`) – do Worda lepiej dać statyczne kroje (wsparcie fontów zmiennych w edytorach jest nierówne – **niezweryfikowane**).
- **Rozmiar**: `Lato-Regular.ttf` ma 656 KB, więc 4 kroje to ok. 2,5 MB w każdym DOCX (+ font zastępczy Source Sans 3 dla CV z cyrylicą/wietnamskim przy Lato – `src/renderer/src/template/fonts.ts`). Dlatego osadzanie warto zrobić **opcjonalne** (np. przełącznik „Osadź fonty”, domyślnie włączony) albo osadzać tylko font wybrany w CV. Microsoft odradza „Embed only the characters used”, bo utrudnia edycję ([Benefits of embedding custom fonts](https://support.microsoft.com/en-us/office/fonts/benefits-of-embedding-custom-fonts)) – co zgadza się z celem funkcji (edycja).
- Paczka aplikacji urośnie o ok. 12 plików TTF (~5–7 MB) – trzeba je dodać do `files` w `electron-builder.yml` (lub jako `extraResources`).

## 6. Ograniczenia wynikające z aplikacji

- **Sandbox / Mac App Store (ADR 0003)**: zapis przez `dialog.showSaveDialog` wymaga uprawnienia `com.apple.security.files.user-selected.read-write` ([Electron: Mac App Store Submission Guide](https://www.electronjs.org/docs/latest/tutorial/mac-app-store-submission-guide)) – tego samego, którego już potrzebuje eksport PDF (`src/main/pdfExport.ts`) i eksport JSON (`src/main/cvLibrary.ts`). Generowanie DOCX to czysty JS w pamięci (bez binariów, bez sieci, bez procesów potomnych), więc sandbox nic nie zmienia. Fonty czytane z zasobów aplikacji (wewnątrz bundla) są dostępne w sandboxie. Uwaga: w repo nie ma dziś pliku entitlements ani celu `mas` w `electron-builder.yml` – to osobny temat, ale DOCX nie dokłada nowych wymagań.
- **Otwieranie po zapisie**: wzorzec `pdf:open` / `pdf:show-in-folder` z białą listą zapisanych ścieżek (`exportedPaths`) można uogólnić na DOCX; `shell.openPath` otworzy plik w domyślnym edytorze (Word/Pages).
- **Schemat CV (ADR 0002)**: eksport niczego nie zapisuje w CV – **brak podbicia `CV_SCHEMA_VERSION`**. Za to każdy nowy szablon będzie od teraz wymagał też mapowania DOCX – warto dopisać krok do listy przy `cvTemplateIds` w `schema.ts` (typ `Record<CvTemplateId, …>` wymusi to w kompilacji, tak jak `templates.ts`).
- **Geometria szablonów** siedzi w plikach `template/*/index.ts(x)`, które importują CSS – main nie może ich importować. Trzeba wydzielić same `geometry` do modułów bez CSS (np. `template/*/geometry.ts`) albo przekazać geometrię z renderera przez IPC.
- **i18n (ADR 0001)**: nowe napisy we wszystkich 16 słownikach (`src/shared/i18n/*.ts`): pozycja menu / przycisk „Eksportuj do Worda (DOCX)”, tytuł okna dialogowego i nazwa filtra (`dialogs.exportDocx`, `dialogs.docxFilter`), ew. komunikat o błędzie. Tekst stały na dokumencie („present”) już pochodzi z CV language w `formatDateRange` – DOCX dostanie to samo. `w:lang` ustawić na CV language. Nazwa pliku – reużyć `pdfFileName` z innym rozszerzeniem.
- **Glosariusz**: funkcja wprowadza nowe pojęcie (np. „Editable export” / „Eksport do Worda”) – warto je dopisać do `GLOSSARY.md` i zaznaczyć, że DOCX to *przybliżenie* wyglądu szablonu, nie jego kopia (CV pages/PDF pozostają źródłem prawdy o wyglądzie).

## 7. Rekomendacja

**Werdykt: wykonalne, umiarkowany koszt, niskie ryzyko techniczne.** Główne ryzyko to oczekiwania użytkowników co do wierności („w Wordzie wygląda trochę inaczej niż PDF”) i różnice między edytorami (Pages/Google Docs), nie sama implementacja.

**Format:** DOCX. **Biblioteka:** `docx` (MIT, aktywna, osadzanie fontów, tabele, obrazy, stopki z numerami stron, `keepNext`/`pageBreakBefore`). **Podejście:** natywne budowanie z bloków CV w procesie main, układ oparty na tabelach bez obramowań, bez pól tekstowych i kolumn sekcji.

### Proponowany zakres MVP

1. Akcja „Eksportuj do DOCX…” obok eksportu PDF (menu + przycisk), IPC `docx:export` z walidacją `cvDocumentSchema.parse` jak w `pdf:export`.
2. Jeden wspólny „układ DOCX” dla wszystkich szablonów:
   - A4, marginesy z geometrii szablonu;
   - nagłówek: tabela 2-kolumnowa (imię, kontakty, podsumowanie | zdjęcie JPEG);
   - tytuły sekcji jako styl akapitowy „Heading 2” w kolorze akcentu (łatwe do powielenia przez użytkownika – to jest sedno „dodam własny element”);
   - doświadczenie/wykształcenie: tabela „daty | treść” z punktami jako prawdziwa lista punktowana; `cantSplit` i `keepNext` zamiast naszego podziału stron;
   - sekcje listowe: tabela wg `listSectionLayout` (tytuł obok/nad, 1/2 kolumny);
   - `pageBreakBefore` z danych; ukryte sekcje pominięte (tak jak w `generateBlocks`);
   - klauzula zgody jako ostatni akapit (mniejszy font);
   - font CV jako domyślny font dokumentu + osadzone 4 kroje (oraz Source Sans 3 jako zastępczy, gdy CV language tego wymaga);
   - metadane (tytuł, autor, `creator: 'CV Drawer'`), `w:lang` = CV language.
3. Testy: jednostkowe (vitest) na mapowaniu bloków → struktura `docx` (np. przez `Packer.toString`/rozpakowanie XML), e2e (Playwright) – eksport i weryfikacja, że plik jest poprawnym ZIP-em z `word/document.xml`. Ręczna macierz: Word Mac (M365), Pages, LibreOffice, Google Docs.

**Poza MVP:** wierne warianty per szablon (stopka „imię · n / m” w `modern`/`bold`, pas akcentu `bold`, oś czasu `modern`); opcja „bez osadzania fontów”; ewentualnie ODT (LibreOffice i tak otworzy DOCX).

### Szacunek pracy

| Element | Dni |
|---|---|
| IPC, zapis, menu/przycisk, i18n w 16 językach, nazwa pliku | 1 |
| Wydzielenie geometrii z plików szablonów, generator DOCX z bloków (wspólny układ) | 2–3 |
| Fonty: dołączenie TTF, ładowanie w main, osadzanie, font zastępczy | 0,5–1 |
| Testy jednostkowe + e2e + ręczna macierz edytorów | 1 |
| **MVP razem** | **4–6** |
| Wierne odwzorowanie każdego szablonu | +1–3 na szablon |

### Ryzyka

- **Rozjazd wyglądu** DOCX vs PDF – trzeba to jasno komunikować (np. tekst przy przycisku: „do dalszej edycji; wygląd może się różnić”).
- **Pages / Google Docs** mogą zignorować osadzone fonty i część formatowania tabel – do sprawdzenia testem; tabele są tu najbezpieczniejszym wyborem.
- **Rozmiar pliku** z osadzonymi fontami (~2,5–5 MB) – akceptowalny dla CV, ale warto mieć opcję wyłączenia.
- **Utrzymanie**: każdy nowy szablon = także mapowanie DOCX (dopisać do checklisty w `schema.ts`).

### Alternatywa warta rozważenia

Jeśli rzeczywista potrzeba to „dodać zupełnie własny element”, część użytkowników obsłużyłaby **własna sekcja w samej aplikacji** (np. sekcja z dowolnym tekstem/akapitami). To zmiana schematu (nowy typ sekcji → podbicie `CV_SCHEMA_VERSION` z migracją, jak opisuje ADR 0002) i zachowuje pełną wierność PDF. Oba kierunki się nie wykluczają: własna sekcja na typowe przypadki, DOCX na naprawdę nietypowe.
