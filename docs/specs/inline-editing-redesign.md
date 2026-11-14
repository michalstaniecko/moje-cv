# Edycja CV bezpośrednio na stronach (eksperyment) – grilling i spec

Sesja „grilling” (z dopisywaniem do glosariusza i ADR) nad eksperymentalnym przeprojektowaniem UX edytora CV.
Stan na 2026-11-14, gałąź `experiment/inline-editing-redesign`.

**Uwaga:** sesja odbyła się bez właściciela. Agent zadawał pytania i sam na nie odpowiadał; każda decyzja to
rekomendacja agenta przyjęta jako decyzja robocza. Decyzje produktowe, które warto potwierdzić, są oznaczone
**[do potwierdzenia]** i zebrane w sekcji „Otwarte pytania”.

Przeczytane: `CLAUDE.md`, `docs/agents/*.md`, `GLOSSARY.md`, ADR 0001–0008, `docs/specs/issue-84-grilling.md`,
`src/renderer/src/CvScreen.tsx`, `src/renderer/src/editor/*` (`CvForm`, `cvEditor`, `documentEdits`, `SortableList`,
`RowMenu`, `listFieldKeys`, `moveShortcut`, `removalUndo`, `PhotoField`, `MonthField`, `TemplatePicker`, `formWidth`,
`PaneSeparator`), `src/renderer/src/preview/*` (`PreviewPane`, `zoom`, `keystrokeTiming`, `pageCount`),
`src/renderer/src/template/*` (`CvPages`, `CvBlockView`, `templateDefinition`, `templates`, `pages.css`, szablony
`classic` / `modern` / `bold`), `src/renderer/src/domain/{schema,blocks,paginate,emptyCv}.ts`, `src/main/menu.ts`,
`src/shared/api.ts`, `src/shared/i18n/pl.ts`, `e2e/{export,panes,performance}.spec.ts`.

Nowe pojęcia w `GLOSSARY.md`: **Edit mode**, **Preview mode**, **Edit card**, **Outline**, **CV form**.
Nowy ADR: `docs/adr/0009-on-page-editing-as-overlay-over-unchanged-templates.md` (status *proposed* – eksperyment).

---

## Kontekst

Dziś edytor CV (`CvScreen.tsx`) to dwie kolumny: po lewej pełny formularz (`CvForm.tsx`, domyślnie 440 px, z
separatorem `PaneSeparator`), po prawej podgląd stron A4 (`PreviewPane.tsx` → `CvPages.tsx`). Strony są tylko do
oglądania i są ukryte przed czytnikiem ekranu (`aria-hidden`), a każdą zmianę robi się w formularzu, który jest długi
(CV design, nagłówek, wszystkie sekcje, klauzula zgody) i wymaga ciągłego szukania „gdzie jest to pole”.

Strony powstają tak: `generateBlocks(document, geometry)` (`domain/blocks.ts`) zamienia CV na płaską listę bloków
(puste pola, puste i ukryte sekcje są pomijane; teksty bywają łączone – `companyLine` = „firma – miejscowość”, daty
sformatowane w CV language), `CvPages` mierzy je w ukrytym kontenerze, `paginate()` dzieli na strony, a szablon rysuje
blok przez `CvBlockView` albo własne nadpisanie (`blockViews`). Ten sam `CvPages` rysuje podgląd, okno wydruku PDF
(`PrintView.tsx`) i Template thumbnail. DOCX export powstaje w main z tych samych bloków (ADR-0008).

## Cele

1. Pasek boczny zminimalizowany: zamiast pełnego formularza wąski **Outline** (konspekt CV).
2. Edycja bezpośrednio na stronach CV: kliknięcie fragmentu strony otwiera przy nim **Edit card** z polami tego
   fragmentu; zmiany widać od razu na stronie. Nowocześnie, minimalistycznie, przyjaźnie.
3. Przełącznik **Edycja / Podgląd**: w Edit mode strony mają dodatkowe kontrolki edycji, w Preview mode strony wyglądają
   dokładnie jak w PDF, bez żadnych kontrolek.

## Poza celami (non-goals)

- Jakakolwiek zmiana wyglądu dokumentu: Template, `domain/blocks.ts`, `domain/paginate.ts`, arkusze szablonów, PDF i
  DOCX zostają takie same (piksel w piksel dla stron i PDF, bez zmian w builderze DOCX).
- Zmiana schematu CV (`CV_SCHEMA_VERSION`, ADR-0002): żadnych nowych pól (np. poziom umiejętności, linki, własna
  sekcja, dodawanie/usuwanie sekcji). Edytujemy dokładnie to, co dziś edytuje formularz.
- Edycja tekstu „wprost w literach” strony (contenteditable) – patrz Q3.
- Przeciąganie myszą fragmentów po stronach (drag-and-drop na płótnie) – patrz Q11.
- Usunięcie formularza z aplikacji – zostaje jako CV form (Q14); decyzja o usunięciu po eksperymencie.
- Zmiany w bibliotece CV, bibliotece klauzul, Sponsor bar, Update notice.

---

## A. Model interakcji

**Q1. Na czym polega „edycja na stronie”: edycja w miejscu liter, czy coś obok?**
Decyzja: kliknięcie (albo Enter na fokusie) fragmentu strony w Edit mode otwiera **Edit card** – pływający panel
zakotwiczony przy tym fragmencie, z polami tylko tego fragmentu. Każde naciśnięcie klawisza zmienia CV i od razu
widać to na stronie pod kartą. Fragmenty to: imię i nazwisko, zdjęcie, kontakty, podsumowanie, tytuł sekcji, wpis
doświadczenia (z punktami), wpis wykształcenia, sekcja listowa (wszystkie elementy), klauzula zgody.
Uzasadnienie: daje poczucie „edytuję to, co widzę” (wskazanie na stronie, wynik na stronie), a nie wymaga dotykania
markupu szablonów ani logiki bloków. Karty działają tak samo dla pól, które na stronie są złączone lub sformatowane
(daty, „firma – miejscowość”, „poziom, kierunek, uczelnia”), i dla pól bez widocznego tekstu (puste wartości).

**Q2. Jak duża ma być karta: jedno pole, czy cały fragment?**
Decyzja: cały fragment, z fokusem na polu, w które kliknięto. Przykład: kliknięcie dat stanowiska otwiera kartę
stanowiska z fokusem na „Od”; kliknięcie trzeciego punktu – tę samą kartę z fokusem w trzecim punkcie. Pole pod
kursorem rozpoznajemy po klasach wspólnego „kontraktu znaczników edycji” (Q6). Gdy klasa nie pasuje – fokus na
pierwszym polu karty.
Uzasadnienie: wpis to jedna myśl (stanowisko, firma, daty, punkty) – użytkownik często poprawia kilka pól naraz;
kilka małych kart na jeden wpis to więcej klikania i więcej stanów do utrzymania.

**Q3. Overlay + karta, contenteditable na wyrenderowanych węzłach, czy pole tekstowe nałożone na tekst?**
Decyzja: **warstwa edycji (overlay) nad niezmienionymi stronami + Edit card.** Odrzucone:
- *contenteditable na węzłach szablonu* – React przerysowuje węzeł przy każdej zmianie (kursor skacze), podział stron
  przenosi blok na inną stronę (węzeł jest montowany od nowa i gubi fokus), blok istnieje dwa razy (kontener pomiarowy
  i strona), a część tekstu nie ma 1:1 pola w CV (łączone `companyLine`, daty, `details`). Wymagałoby też zmian w
  każdym szablonie (atrybuty, obsługa zdarzeń), czyli dotknięcia wyglądu dokumentu.
- *pole tekstowe nałożone dokładnie na tekst (jak w Figmie)* – zawijanie w polu nie odpowiada zawijaniu w szablonie
  (różne fonty, `text-transform`, kolumny), więc w trakcie pisania tekst „pływa”; nie rozwiązuje pól złączonych.
Uzasadnienie: overlay nie zmienia ani piksela strony, działa z każdym szablonem i każdym przyszłym szablonem, a
wszystkie pola i reguły (autozapis, łączenie kroków cofania, Enter dzieli punkt) już istnieją w formularzu.
Zapisane w ADR-0009.

**Q4. Kiedy karta się otwiera, zamyka i przełącza?**
Decyzja:
- otwiera: pojedyncze kliknięcie fragmentu w Edit mode albo Enter/spacja na jego fokusie;
- przełącza: kliknięcie innego fragmentu zamyka bieżącą kartę i otwiera nową (jedna karta naraz);
- zamyka: Escape (fokus wraca na fragment na stronie), kliknięcie w tło strony lub poza stronę, przełączenie w
  Preview mode, wyjście z edytora;
- karta nie ma przycisku „Zapisz” – zmiany są natychmiastowe (autozapis jak dziś); ma tylko „×” (zamknij).
Uzasadnienie: zachowanie znane z edytorów stron i grafiki; brak „Zapisz” zgadza się z dzisiejszym autozapisem
(`cvEditor.ts`).

**Q5. Gdzie dokładnie pojawia się karta i co, gdy fragment „ucieka” (podział stron, przewijanie, powiększenie)?**
Decyzja: karta jest w warstwie górnej (`popover`, jak `RowMenu`), w skali 1:1 niezależnie od powiększenia stron.
Pozycja: obok fragmentu po prawej stronie kartki, jeśli jest miejsce między kartką a krawędzią panelu; w przeciwnym
razie pod fragmentem (albo nad nim, gdy pod nim brakuje miejsca). Po każdym nowym podziale stron, zmianie skali,
przewinięciu i zmianie rozmiaru okna karta przelicza pozycję od aktualnego położenia fragmentu (po jego id). Gdy
fragment zniknie ze strony (np. wyczyszczono wszystkie pola wpisu), karta zostaje w ostatnim położeniu i dalej działa.
Uzasadnienie: karta nie może zasłaniać edytowanego tekstu i nie może się zmniejszać przy „Dopasuj”; zakotwiczenie
po id (a nie po węźle DOM) przeżywa przeniesienie bloku na inną stronę.

## B. Szablony i strony bez zmian

**Q6. Jak warstwa edycji wie, gdzie na stronie są fragmenty, nie zmieniając szablonów?**
Decyzja:
- Wspólne opakowanie bloku w `CvBlockView.tsx` dostaje atrybut `data-block-id={block.id}`. To jedyna zmiana w
  `src/renderer/src/template/` – atrybut nie wpływa na wygląd, pomiar ani PDF. Arkusze szablonów, nadpisania bloków,
  `generateBlocks` i `paginate` zostają nietknięte.
- Mapowanie bloku na część CV jest czystą funkcją w nowym module `src/renderer/src/canvas/editTargets.ts`:
  identyfikatory bloków już niosą źródło (`header`, `<sekcja>:title`, `<wpis>`, `<wpis>:<punkt>`,
  `<sekcja>:<pierwszy element wiersza>`), a wiersz listy ma `items` z id.
- Podział nagłówka i rozpoznanie klikniętego pola idą po **kontrakcie znaczników edycji** – klasach, których wszystkie
  trzy szablony już używają: `.cv-name`, `.cv-photo`, `.cv-contact` (dzieci = kolejne kontakty), `.cv-summary`,
  `.cv-section-title`, `.cv-role`, `.cv-company`, `.cv-date`, `.cv-education-level`, `li` w punktach i wierszach list.
  Kontrakt dopisujemy jako krok w checkliście „Nowy szablon” w `domain/schema.ts` i w komentarzu w
  `template/templateDefinition.ts`; pilnuje go test e2e (Q24).
Uzasadnienie: zero zmian wizualnych; nowy szablon dostaje edycję na stronie „za darmo”, jeśli używa tych klas, a
brak klasy psuje tylko wygodę (fokus na pierwszym polu), nigdy treść.

**Q7. Gdzie fizycznie siedzi warstwa edycji?**
Decyzja: nowy komponent `src/renderer/src/canvas/EditLayer.tsx`, renderowany przez `PreviewPane` jako rodzeństwo
`.preview-pages` w tym samym przewijanym kontenerze, **poza** korzeniem `.cv` (style szablonów, zawężone do
`.cv-template-*`, nie mogą na nią wpłynąć, a ona na nie). Hook `src/renderer/src/canvas/useFragmentRects.ts` po
każdym `onLayout`, zmianie skali i `ResizeObserver` czyta `getBoundingClientRect()` elementów
`.cv-pages [data-block-id]` (nie z `.cv-measure`) i zamienia je na prostokąty fragmentów (wpis = suma bloku wpisu i
jego punktów, osobno na każdej stronie; sekcja listowa = suma wierszy na stronie). Kolory i obrysy tylko z tokenów
`app.css` (ADR-0004), nigdy z koloru akcentu CV.
Uzasadnienie: `CvPages` zostaje komponentem „tylko dokument”, wspólnym dla podglądu, PDF i miniatur; edytor dokłada
warstwę z zewnątrz.

**Q8. Puste pola i puste wpisy: placeholdery na stronie w Edit mode?**
Decyzja: **nie.** Strona w Edit mode ma dokładnie ten sam podział stron co w Preview mode i w PDF. Brakujące części
CV są dostępne przez kontrolki warstwy edycji, które nie zajmują miejsca w dokumencie:
- pod ostatnią stroną (poza kartką) pasek „Dodaj do CV:” z przyciskami dla pustych części nagłówka (imię i nazwisko,
  zdjęcie, kontakt, podsumowanie) i dla widocznych sekcji bez treści (np. „Języki”), oraz „Klauzula zgody”, gdy jest
  wyłączona;
- w zupełnie pustym CV (nowe CV) na środku pierwszej strony podpowiedź „Zacznij od imienia i nazwiska” – też tylko w
  warstwie edycji;
- nowo dodany wpis nie ma bloku, dopóki czegoś nie wpisano: karta otwiera się zakotwiczona przy przycisku, którym go
  dodano, a po pierwszym znaku przeskakuje do powstałego bloku.
Uzasadnienie: placeholdery w treści zmieniłyby wysokości bloków i podział stron – Edit mode pokazywałby inne strony niż
PDF, a każdy szablon musiałby umieć narysować placeholder (zmiana szablonów). Ukryte sekcje są osiągalne z Outline
(Q13), nie z kartki.

**Q9. Wyróżnienie bloków za długich na stronę (`.cv-block--oversized`) w obu trybach?**
Decyzja: tylko w Edit mode (jak dziś w podglądzie). W Preview mode strony są jak w PDF, bez obrysu i bez komunikatu na
kartce; w pasku podglądu pojawia się wtedy ostrzeżenie „Część treści nie mieści się na stronie” z przyciskiem
„Pokaż”, który przełącza w Edit mode. Podpowiedź w oknie „Eksportować mimo to?” (`editor.exportCutOffHint`) zmienia
treść na „…wyróżnione w trybie edycji”.
Uzasadnienie: Preview mode ma pokazywać dokładnie to, co trafi do PDF; ostrzeżenie zostaje widoczne poza kartką.

## C. Struktura CV na stronie

**Q10. Dodawanie wpisów i elementów na stronie.**
Decyzja:
- w Edit mode po najechaniu na sekcję (albo fokusie w niej) pod jej ostatnim blokiem pojawia się mała „pigułka”
  „+ Stanowisko” / „+ Wykształcenie” / „+ Element” (w odstępie między blokami, w warstwie edycji); ta sama akcja jest
  w menu tytułu sekcji i w Outline;
- dodanie wykonuje istniejące `addExperienceItem` / `addEducationItem` / `addListItem` / `addContact` z
  `documentEdits.ts` i od razu otwiera kartę nowego elementu z fokusem na pierwszym polu;
- nowe punkty stanowiska i nowe elementy list dodaje się w karcie (przycisk „Dodaj punkt” oraz Enter dzielący pole,
  `handleListFieldKeyDown` – bez zmian).
Uzasadnienie: kontrolki pojawiają się tam, gdzie użytkownik patrzy, a logika dodawania już istnieje i jest testowana.

**Q11. Zmiana kolejności i usuwanie na stronie.**
Decyzja:
- fragment w Edit mode ma przy lewej krawędzi (w marginesie kartki, w warstwie edycji) uchwyt z menu – ten sam wzór co
  dziś `RowMenu`: „Przenieś wyżej/niżej”, „Nowa strona przed”, a dla tytułu sekcji także „Ukryj sekcję” i
  „Dodaj …”; ⌥⇧↑/↓ na uchwycie przenosi od razu (`moveShortcut.ts`);
- przeciąganie myszą tylko w Outline (sekcje) i w karcie (punkty, elementy list) – istniejący `SortableList`;
  na samej kartce **bez** drag-and-drop;
- usuwanie wpisu, punktu, elementu, kontaktu, zdjęcia – w karcie, tą samą drogą co dziś (`useRemovalUndo`,
  komunikat „Usunięto. Cofnij”), z zachowaniem dzisiejszej reguły: sekcje, stanowiska i wykształcenie usuwa się
  przyciskiem tekstowym, nie z menu wiersza.
Uzasadnienie: przeciąganie po stronach z podziałem (wpis rozbity na kilka bloków, bloki na różnych stronach, skala)
jest kosztowne i kruche; przenoszenie o jedną pozycję + DnD w Outline pokrywa potrzebę. `RowMenu` wymaga dziś
`handleProps` z dnd-kit – robimy je opcjonalnymi.

**Q12. Pola „bogate”: daty, zdjęcie, kontakty, listy, linki, poziom umiejętności.**
Decyzja:
- daty: `MonthField` + „Obecnie tu pracuję” + ostrzeżenie o odwróconych datach – jak w formularzu, w karcie wpisu;
- zdjęcie: kliknięcie zdjęcia otwiera kartę z `PhotoField` (zmień, kadrowanie, usuń); bez zdjęcia – „Zdjęcie” w pasku
  „Dodaj do CV”;
- kontakty: jedna karta „Kontakt” z całą listą (etykieta z podpowiedziami + wartość, dodaj, usuń), fokus na kontakcie,
  w który kliknięto (n-te dziecko `.cv-contact`);
- listy (umiejętności, języki): jedna karta na sekcję z wszystkimi elementami, fokus na klikniętym `li`;
- linki i poziomy umiejętności: **nie istnieją w schemacie** – poza zakresem (wymagałyby podbicia schematu, ADR-0002).
Uzasadnienie: karty składają się z istniejących komponentów pól; nic nowego w modelu danych.

**Q13. Co zostaje w zminimalizowanym pasku bocznym?**
Decyzja: **Outline** (ok. 240 px, bez separatora), od góry:
1. „Nagłówek” – kliknięcie otwiera kartę imienia i nazwiska;
2. lista sekcji w kolejności CV (`SortableList` z uchwytem i menu: przenieś, ukryj/pokaż, nowa strona przed) z
   oznaczeniem „pusta” / „ukryta” i liczbą wpisów; kliknięcie przewija stronę do sekcji i otwiera kartę jej tytułu, a
   dla sekcji ukrytej lub pustej otwiera kartę zakotwiczoną przy wierszu Outline;
3. „Klauzula zgody” z przełącznikiem „Pokaż na CV”;
4. na dole: „Formularz” (przełącza pasek na CV form) i „Zwiń” (pasek zwija się do szyny ok. 44 px z ikonami Outline i
   Formularz).
Stan paska (`outline` / `form` / `collapsed`) to preferencja aplikacji: nowe opcjonalne pole `editorSidebar` w
`appSettingsSchema` (brak pola = `outline`, bez podbijania wersji schematu – jak `formWidth`).
Uzasadnienie: Outline pokrywa to, czego nie widać na kartce (ukryte i puste sekcje, kolejność całego CV, klauzula
wyłączona) i daje szybką nawigację po długim CV, a zajmuje ok. połowę dzisiejszego formularza.

**Q14. Co z istniejącym formularzem: usunąć czy zostawić?**
Decyzja: zostaje jako **CV form** – drugi widok paska bocznego („Formularz”), z dzisiejszym separatorem i szerokością
(`useFormWidth`, `formWidth` w ustawieniach). Nie jest domyślny. **[do potwierdzenia]** ostateczne usunięcie po
eksperymencie.
Uzasadnienie: (1) dostępność – strony są `aria-hidden`, a CV form to pełny, liniowy sposób edycji dla czytnika ekranu
(test e2e „screen readers read the CV from the form only” zostaje prawdziwy); (2) ok. 190 testów e2e znajduje pola po
etykietach formularza – zostają ważne po dopisaniu jednego kroku w helperze; (3) siatka bezpieczeństwa eksperymentu.
Karty i formularz używają tych samych komponentów pól (Q20), więc koszt utrzymania obu jest mały.

## D. Tryby Edycja / Podgląd

**Q15. Czym dokładnie różnią się tryby?**
Decyzja:
- **Edit mode**: pasek boczny (Outline / CV form / szyna), warstwa edycji na stronach (obrysy przy najechaniu i
  fokusie, uchwyty, pigułki „+”, pasek „Dodaj do CV”, Edit card), wyróżnienie za długich bloków.
- **Preview mode**: bez paska bocznego (strony na całą szerokość okna), bez warstwy edycji i bez wyróżnień na
  kartkach; zostaje pasek narzędzi (wstecz, nazwa CV, przełącznik, CV design, status zapisu, eksporty) i pasek podglądu
  (licznik stron, ostrzeżenia, powiększenie). Klik w kartkę nic nie robi.
- W obu trybach działają: cofnij/ponów, eksport PDF/DOCX/JSON, CV design (Q18), zmiana nazwy CV, powiększenie.
Uzasadnienie: Preview mode = „tak będzie wyglądał PDF”; CV design i eksport nie dodają nic do kartek, więc nie ma
powodu ich blokować (zmiana Template w Preview mode to dobry sposób porównania szablonów).

**Q16. Gdzie jest przełącznik, jaki ma skrót i od jakiego trybu startujemy?**
Decyzja:
- segmentowy przełącznik „Edycja | Podgląd” na środku paska narzędzi (dwa przyciski `aria-pressed`, w grupie z
  etykietą „Tryb”);
- menu Widok → „Podgląd” (pozycja z zaznaczeniem) ze skrótem **⌘⇧P** (`CmdOrCtrl+Shift+P`), aktywna tylko w edytorze –
  nowa `MenuCommand` `'toggle-preview'` w `shared/api.ts`, `enabledMenuCommands` jak `export-docx`;
- każde otwarcie CV startuje w **Edit mode**; tryb nie jest zapisywany (stan sesji ekranu, nie preferencja);
- przełączenie trybu nie jest krokiem cofania i nie zmienia dokumentu.
Uzasadnienie: edytor otwiera się po to, żeby edytować; ⌘E jest zajęte przez eksport PDF, ⌘P nie ma znaczenia w
aplikacji bez drukowania, ale zostawiamy je wolne; ⌘⇧P nie koliduje z żadnym skrótem aplikacji ani polem tekstowym.

**Q17. Co z zawartością przełączaną w trakcie edycji (otwarta karta, fokus, przewinięcie)?**
Decyzja: przejście do Preview mode zamyka kartę (zmiany są już zapisane) i przenosi fokus na przełącznik; pozycja
przewinięcia i skala zostają. Powrót do Edit mode nie otwiera poprzedniej karty.
Uzasadnienie: przewidywalne i proste; nic nie ginie, bo karta nie ma stanu „niezapisanego”.

## E. CV design, eksport, nazwa

**Q18. Gdzie trafia CV design (kolor akcentu, font, Template, CV language)?**
Decyzja: przycisk „Projekt CV” w pasku narzędzi otwiera panel (popover pod przyciskiem, niemodalny) z dzisiejszym
`CvDesignFields`, w tym `TemplatePicker` z Template thumbnail. Zmiany widać od razu na kartkach. W CV form sekcja
CV design zostaje bez zmian.
Uzasadnienie: CV design dotyczy całego dokumentu, nie fragmentu, więc nie pasuje do Edit card ani do Outline; w pasku
narzędzi jest osiągalny także w Preview mode.

**Q19. Eksport i reszta paska narzędzi.**
Decyzja: bez zmian funkcjonalnych – „← Wróć”, nazwa CV z edycją w miejscu (`CvNameHeading`), status zapisu,
„Eksportuj do DOCX”, „Eksportuj do PDF” (główny), menu Plik jak dziś; dochodzą tylko przełącznik trybu i „Projekt CV”.
Komunikat „Usunięto. Cofnij” (`RemovalMessage`) przenosi się z dołu kolumny formularza do pływającego komunikatu w
lewym dolnym rogu panelu stron (wspólny dla kart i formularza).
Uzasadnienie: eksporty są dobrze przetestowane i nie są częścią problemu; komunikat musi być widoczny także wtedy, gdy
pasek boczny to Outline albo szyna.

## F. Architektura

**Q20. Jak współdzielić pola między CV form a Edit card?**
Decyzja: najpierw refaktor bez zmiany zachowania – komponenty pól z `CvForm.tsx` przenosimy do
`src/renderer/src/editor/fields/` jako eksportowane komponenty (`FullNameField`, `ContactsFields`, `SummaryField`,
`PhotoField` – już osobno, `SectionTitleField`, `ExperienceItemFields`, `EducationItemFields`, `ListItemsFields`,
`ConsentFields`, `CvDesignFields`). `CvForm` składa z nich formularz, `EditCard` – karty. Klucze scalania cofania
(`mergeKey`: `header:fullName`, `experience:<id>:role`, …) zostają te same, więc pisanie w karcie i w formularzu
łączy się w kroki cofania identycznie.
Uzasadnienie: jedno źródło logiki pól, reguł i etykiet; testy e2e formularza dalej sprawdzają te same komponenty.

**Q21. Stan edytora: co nowego i gdzie?**
Decyzja: stan UI poza `zundo` (nie trafia do historii ani do pliku): nowy hook
`src/renderer/src/canvas/useEditSession.ts` w `CvScreen` – `mode: 'edit' | 'preview'`,
`target: EditTarget | null` (otwarta karta), `anchor` (fragment albo element kontrolki, przy którym otwarto kartę).
`EditTarget` (unia w `canvas/editTargets.ts`): `fullName`, `photo`, `contacts` (+ opcjonalny `contactId`), `summary`,
`sectionTitle` (`sectionId`), `experienceItem` / `educationItem` (`sectionId`, `itemId`, opcjonalne `field`/`bulletId`),
`listSection` (`sectionId`, opcjonalny `itemId`), `consent`. Po każdej zmianie dokumentu (także cofnij/ponów) sesja
sprawdza, czy cel nadal istnieje w CV; jeśli nie – zamyka kartę i przenosi fokus na Outline.
Uzasadnienie: `cvEditor.ts` zostaje tylko modelem dokumentu (historia, autozapis), a zmiana trybu czy karty nigdy nie
staje się krokiem cofania.

**Q22. Cofnij/ponów z otwartą kartą.**
Decyzja: bez zmian w mechanizmie: ⌘Z / ⌘⇧Z i Edycja → Cofnij/Ponów idą do `editor.undo()/redo()` także z pól karty
(`useEditorLifecycle`). Pola karty są kontrolowane, więc pokazują stan po cofnięciu. Cofnięcie dodania wpisu z otwartą
kartą tego wpisu zamyka kartę (Q21).
Uzasadnienie: zachowanie znane z formularza; łączenie kroków działa dzięki tym samym `mergeKey`.

**Q23. Wydajność: pisanie w karcie przy długim CV.**
Decyzja: ścieżka pisania jest ta sama co dziś (`editor.edit` → `CvPages` → pomiar → `paginate`); warstwa edycji
dokłada jeden odczyt prostokątów po namalowaniu nowego podziału (w `requestAnimationFrame`, tylko w Edit mode,
ok. 50–150 elementów) i przerysowanie lekkich prostokątów (memo po id). `EditCard` wywołuje `markInput` w `onInput`
(jak dziś `<aside>`), więc `cv:keystroke-to-preview` mierzy też pisanie w karcie. Próg 100 ms z `e2e/performance.spec.ts`
obowiązuje bez zmian; spec pomiaru dostaje drugi przebieg „pisanie w karcie”.
Uzasadnienie: koszt warstwy jest liniowy i mały; pomiar już istnieje, więc regresję zobaczymy liczbowo.

**Q24. Jak pilnujemy, że wygląd dokumentu się nie zmienił?**
Decyzja:
- przed pierwszą zmianą (ticket 1) dodajemy test e2e „złotych stron”: Sample CV `en` w `classic`, `modern`, `bold` –
  zrzuty `toHaveScreenshot` każdej `.cv-page` w Preview mode oraz tekst i liczba stron eksportowanego PDF; wzorce
  zapisane z `main` przed zmianami;
- test e2e kontraktu znaczników (Q6): w każdym szablonie każdy fragment Sample CV ma swój element w warstwie edycji;
- `git diff main -- src/renderer/src/template src/renderer/src/domain/blocks.ts src/renderer/src/domain/paginate.ts src/main/docx`
  w review każdego ticketu: dozwolony jedynie atrybut `data-block-id` w `CvBlockView.tsx`.
Uzasadnienie: wymóg „szablony bez zmian” musi być sprawdzalny maszynowo, a nie deklaracją.

## G. Dostępność i klawiatura

**Q25. Jak edycja na stronie działa z klawiatury i dla czytnika ekranu?**
Decyzja:
- strony zostają `aria-hidden` (bez zmian); warstwa edycji leży obok nich i ma własne, dostępne elementy: każdy
  fragment to przycisk z nazwą „Edytuj: <co>” (np. „Edytuj: stanowisko Senior Developer”), w kolejności dokumentu, z
  widocznym obrysem fokusu;
- Tab przechodzi po fragmentach; Enter/spacja otwiera kartę; fokus trafia na pole odpowiadające fragmentowi;
- karta to niemodalny `role="dialog"` z `aria-label` (np. „Stanowisko: Senior Developer”); Escape zamyka i wraca na
  fragment; Tab z ostatniego pola karty wraca do kolejnego fragmentu (karta nie więzi fokusu);
- uchwyty menu fragmentów: `RowMenu` z pełną obsługą klawiatury jak dziś;
- CV form zostaje pełną, liniową drogą edycji dla czytnika ekranu (Q14).
Uzasadnienie: klawiatura dostaje to samo co mysz; czytnik ekranu dostaje i karty, i formularz, a nie dostaje drugiej,
mylącej kopii treści CV.

## H. Powiększenie

**Q26. Powiększenie w nowym układzie.**
Decyzja: bez zmian w `zoom.ts` (poziomy, „Dopasuj”, „100%”). Domyślne „Dopasuj” daje większe strony niż dziś, bo
pasek boczny jest węższy (a w Preview mode go nie ma). Warstwa edycji i karta przeliczają pozycje po zmianie skali;
karta zawsze w 1:1. Przy skali < 50% uchwyty i pigułki „+” chowają się (zostaje klik w fragment i Outline).
Uzasadnienie: przy małej skali kontrolki zasłaniałyby treść; edycja dalej działa przez kartę.

## I. Testy

**Q27. Strategia testów.**
Decyzja:
- **Vitest**: `canvas/editTargets.test.ts` (blok → cel edycji dla Sample CV we wszystkich trzech geometriach, w tym
  `listSectionLayout` `beside` i 2 kolumny, wiersze list, punkty, nagłówek; czy cel istnieje po zmianie dokumentu),
  `canvas/fragmentRects.test.ts` (czyste łączenie prostokątów bloków we fragmenty per strona),
  `canvas/anchoredPosition.test.ts` (prawa strona / pod / nad, granice okna – logika wydzielona z `RowMenu`),
  `menuCommands.test.ts` (`toggle-preview` tylko w edytorze), `settingsRepository` (pole `editorSidebar`).
- **Playwright – nowy `e2e/canvas.spec.ts`**: klik w imię na stronie → karta z fokusem → pisanie zmienia stronę i PDF →
  ⌘Z to jeden krok; karta stanowiska z fokusem na klikniętym punkcie, Enter dzieli punkt; dodanie stanowiska pigułką;
  pusty nowy CV z podpowiedzią i paskiem „Dodaj do CV”; Outline: ukrycie, kolejność, skok do ukrytej sekcji; menu
  fragmentu i ⌥⇧↑/↓; przełącznik i ⌘⇧P (w Preview mode zero elementów warstwy edycji, brak `.cv-block--oversized`,
  brak paska bocznego); obsługa z samej klawiatury (Tab, Enter, Escape wraca na fragment); kontrakt znaczników w trzech
  szablonach; złote strony (Q24).
- **Istniejące e2e**: helper `openFirstCv()` (i odpowiedniki) dostaje krok „Formularz” w pasku bocznym, więc testy
  oparte na etykietach pól działają bez zmian; `e2e/panes.spec.ts` przełącza najpierw na CV form (separator jest tylko
  tam); test wyróżnienia za długich bloków działa w Edit mode; tekst `exportCutOffHint` aktualizowany.
- **Pomiar**: `e2e/performance.spec.ts` z drugim przebiegiem pisania w karcie (Q23).
- **Ręcznie przed merge**: jasny i ciemny Appearance (warstwa edycji czytelna na białej kartce w obu), trzy szablony,
  16 języków interfejsu (długie etykiety w karcie i Outline), VoiceOver – przejście Tab po fragmentach.
Uzasadnienie: logika celów i pozycjonowania jest czysta i testowalna w Node (Vitest bez DOM); e2e sprawdza spięcie z
prawdziwym układem stron.

## J. i18n

**Q28. Nowe teksty interfejsu.**
Decyzja: nowe klucze w `editor` (wszystkie 16 słowników, `en` jako źródło typu – ADR-0001), m.in.: `mode.label`
(„Tryb”), `mode.edit` („Edycja”), `mode.preview` („Podgląd”), `cvDesignButton` („Projekt CV”), `outline.*`
(„Konspekt”, „Nagłówek”, „pusta”, „ukryta”, „Formularz”, „Zwiń”, „Rozwiń”), `canvas.edit(what)` („Edytuj: …”),
`canvas.addToCv` („Dodaj do CV:”), `canvas.startHint` („Zacznij od imienia i nazwiska”), `canvas.add.*`
(„+ Stanowisko”…), `card.close`, `preview.oversizedInPreview` + `preview.showInEditMode`; `menu.previewMode`
(„Podgląd”); zmieniony `editor.exportCutOffHint`. Tłumaczenia robi agent, przegląd natywny osobno.
Uzasadnienie: praktyka z ADR-0001.

## K. Zgodność z ADR

- **ADR-0002** – brak zmian schematu CV; nowe pole `editorSidebar` jest w ustawieniach aplikacji, opcjonalne (wzór
  `formWidth`, `windowState`). Brak konfliktu.
- **ADR-0004** – warstwa edycji, karty i Outline używają wyłącznie tokenów z `app.css`; warstwa leży poza `.cv`, więc
  `color-scheme` interfejsu nie dotyka kartek. Brak konfliktu, ale to twardy wymóg dla ticketów 2–7.
- **ADR-0008** – DOCX bez zmian; main nie importuje nic z `canvas/` (test `templateIndependence.test.ts` dalej ważny).
- **Nowy ADR-0009** – edycja na stronie jako overlay nad niezmienionymi stronami (Q3, Q6, Q7, Q8).
- Brak ADR, z którym spec byłby sprzeczny.

---

## Opis UX (wynik)

**Otwarcie CV.** Edytor startuje w Edit mode. U góry pasek narzędzi: „← Wróć”, nazwa CV, przełącznik
„Edycja | Podgląd”, „Projekt CV”, status zapisu, „Eksportuj do DOCX”, „Eksportuj do PDF”. Po lewej wąski Outline, po
prawej duże strony A4.

**Edycja.** Najechanie na fragment strony rysuje delikatny obrys i uchwyt z lewej (w marginesie kartki). Kliknięcie
otwiera obok kartki Edit card z polami fragmentu i kursorem w klikniętym polu. Pisanie zmienia stronę na bieżąco;
jeśli treść przejdzie na kolejną stronę, karta jedzie za fragmentem. Escape albo klik obok zamyka kartę. Pod
ostatnim blokiem sekcji przy najechaniu widać „+ Stanowisko”. Pod ostatnią stroną: „Dodaj do CV: Zdjęcie ·
Podsumowanie · Języki · Klauzula zgody” – tylko dla tego, czego jeszcze w CV nie ma.

**Outline.** Lista: Nagłówek, sekcje (z uchwytem do przeciągania, okiem ukrycia, oznaczeniem „pusta”/„ukryta”),
Klauzula zgody. Klik przewija do sekcji i otwiera kartę. Na dole „Formularz” (pełny dawny formularz) i „Zwiń”.

**Podgląd.** ⌘⇧P albo „Podgląd”: pasek boczny i wszystkie kontrolki znikają, strony zajmują całą szerokość i wyglądają
jak PDF. „Projekt CV” i eksporty dalej działają. ⌘⇧P albo „Edycja” wraca.

## Kryteria akceptacji (całość)

1. Strony w Preview mode i PDF dla Sample CV w trzech szablonach są identyczne ze wzorcem z `main` (złote strony);
   builder DOCX i jego testy bez zmian; w `src/renderer/src/template/` zmieniony tylko `data-block-id` w `CvBlockView`.
2. Każde pole, które dziś edytuje formularz, można edytować z Edit card albo z „Projekt CV”, bez otwierania CV form.
3. Przełącznik i ⌘⇧P przełączają tryby; w Preview mode nie ma w DOM żadnego elementu warstwy edycji ani paska
   bocznego, a kartki nie mają wyróżnień.
4. Edit mode ma ten sam podział stron co Preview mode i PDF (żadnych placeholderów w treści).
5. Cała edycja na stronie jest wykonalna z klawiatury (Tab, Enter, Escape, ⌥⇧↑/↓); fokus nigdy nie ginie po
   zamknięciu karty, usunięciu ani cofnięciu.
6. Cofnij/ponów działa z kart tak samo jak z formularza (te same kroki).
7. `cv:keystroke-to-preview` przy pisaniu w karcie w długim CV mieści się w progu 100 ms (pomiar ręczny jak dziś).
8. CV form działa jak dziś; istniejące testy e2e przechodzą po dopisaniu kroku „Formularz” w helperze.
9. Wszystkie nowe teksty w 16 językach; warstwa edycji czytelna w jasnym i ciemnym Appearance.

## Podział na tickety (vertical slices)

Każdy ticket jest osobno wydawalny (aplikacja działa po każdym) i ma własne testy. Kolejność = zależności.

**T1. Przełącznik Edycja / Podgląd i złote strony** – zależy od: nic.
Zakres: test złotych stron (najpierw, wzorce z `main`); `useEditSession` z `mode`; przełącznik w pasku narzędzi;
menu Widok → „Podgląd” ⌘⇧P (`toggle-preview`); Preview mode chowa pasek boczny (dziś: formularz z separatorem) i
wyróżnienie za długich bloków, ostrzeżenie w pasku podglądu z „Pokaż”; zmiana `exportCutOffHint`; i18n.
Kryteria: AC 1 i 3 (bez warstwy edycji, której jeszcze nie ma); start zawsze w Edit mode; zmiana trybu nie jest krokiem
cofania; e2e przełącznika i skrótu; `enabledMenuCommands` w Vitest.

**T2. Warstwa edycji i pierwsze Edit card: imię i nazwisko, podsumowanie, tytuły sekcji** – zależy od: T1.
Zakres: `data-block-id` w `CvBlockView`; `canvas/editTargets.ts`, `useFragmentRects`, `EditLayer`, `EditCard`,
`anchoredPosition` (wydzielone z `RowMenu`); wydzielenie `editor/fields/` dla tych pól (bez zmiany zachowania
formularza); kontrakt znaczników w checkliście „Nowy szablon” i test kontraktu; `markInput` w karcie; obsługa
klawiatury (Q25).
Kryteria: klik/Enter na imieniu, podsumowaniu, tytule sekcji otwiera kartę z fokusem; pisanie zmienia stronę; karta
jedzie za fragmentem przy zmianie podziału i skali; Escape wraca na fragment; ⌘Z jeden krok; złote strony bez zmian;
Vitest dla `editTargets`, prostokątów i pozycjonowania.

**T3. Karty wpisów i list, klauzula zgody, usuwanie z „Usunięto. Cofnij”** – zależy od: T2.
Zakres: karty stanowiska (daty, „obecnie”, punkty z `SortableList`, Enter/Backspace, ostrzeżenie dat), wykształcenia,
sekcji listowej (fokus na klikniętym `li`), klauzuli (`ConsentFields` z biblioteką); usuwanie w karcie;
`RemovalMessage` jako pływający komunikat nad stronami; zamykanie karty, gdy cel zniknął (cofnij).
Kryteria: każdy wpis Sample CV edytowalny z karty z fokusem na klikniętym polu/punkcie; usunięcie + „Cofnij” przywraca
i fokus wraca w okolice; e2e w `canvas.spec.ts`.

**T4. Nagłówek: zdjęcie i kontakty na stronie** – zależy od: T2 (równolegle z T3).
Zakres: karta zdjęcia (`PhotoField`: wybór, kadrowanie, usunięcie), karta kontaktów (lista, podpowiedzi etykiet,
dodaj/usuń, fokus na klikniętym kontakcie).
Kryteria: klik w zdjęcie i w n-ty kontakt w trzech szablonach otwiera właściwą kartę; kadrowanie działa z karty;
e2e na zdjęciu (podmieniony wybór pliku jak dziś).

**T5. Dodawanie na stronie: pigułki „+”, pasek „Dodaj do CV”, puste CV** – zależy od: T3, T4.
Zakres: pigułki pod sekcjami; pasek „Dodaj do CV” pod ostatnią stroną (puste części nagłówka, widoczne puste sekcje,
wyłączona klauzula); podpowiedź na pustej pierwszej stronie; karta nowego elementu zakotwiczona przy przycisku, potem
przy powstałym bloku.
Kryteria: od „Nowe CV” do pełnego CV bez otwierania CV form; podział stron identyczny jak w Preview mode (AC 4); e2e.

**T6. Menu fragmentu na stronie: przenoszenie, nowa strona, ukrycie sekcji** – zależy od: T3.
Zakres: uchwyty w marginesie kartki z `RowMenu` (opcjonalne `handleProps`); „Przenieś wyżej/niżej”, ⌥⇧↑/↓, „Nowa
strona przed”, „Ukryj sekcję”, „Dodaj …”; komunikaty dla czytnika ekranu jak w `SortableList`; chowanie uchwytów
przy skali < 50%.
Kryteria: przeniesienie sekcji i wpisu z menu i skrótem to jeden krok cofania, fokus zostaje na uchwycie w nowym
miejscu; e2e.

**T7. Outline jako zminimalizowany pasek boczny; CV form jako widok zapasowy** – zależy od: T3 (karty dla skoku do
sekcji), T8 (CV design poza formularzem).
Zakres: `Outline` (sekcje z `SortableList`, ukryj/pokaż, „pusta”/„ukryta”, nowa strona, klauzula z przełącznikiem,
skok + karta), szyna zwinięta, przełączanie Outline ↔ Formularz, `editorSidebar` w `appSettingsSchema` i
repozytorium ustawień; aktualizacja helperów e2e (krok „Formularz”) i `panes.spec.ts`.
Kryteria: domyślnie Outline ok. 240 px; preferencja paska przeżywa restart; ukryta sekcja osiągalna i edytowalna
z Outline; wszystkie istniejące e2e zielone; AC 2 spełnione bez CV form.

**T8. „Projekt CV” w pasku narzędzi** – zależy od: T1 (równolegle z T2–T6).
Zakres: przycisk i niemodalny panel z `CvDesignFields` (kolor, font, `TemplatePicker`, CV language), działający w obu
trybach; Escape i klik poza zamykają, fokus wraca na przycisk.
Kryteria: zmiana Template i koloru z panelu zmienia strony i PDF; w CV form sekcja CV design bez zmian; e2e.

**T9. Pomiar i dopracowanie eksperymentu** – zależy od: T2–T8.
Zakres: drugi przebieg w `e2e/performance.spec.ts` (pisanie w karcie), ręczna macierz (Appearance, 3 szablony,
16 języków, VoiceOver), poprawki znalezione w macierzy, wpis w `CHANGELOG.md` (jeśli eksperyment idzie do wydania).
Kryteria: AC 7 i 9; wyniki pomiaru dopisane do opisu PR.

Kolejność realizacji: T1 → T2 → (T3 ∥ T4 ∥ T8) → T6 → T5 → T7 → T9.

## Otwarte pytania (do właściciela)

1. **[do potwierdzenia]** Czy CV form ma zostać na stałe jako widok zapasowy, czy po eksperymencie go usuwamy (wtedy
   dostępność dla czytnika ekranu musi przejąć warstwa edycji w pełni, a ok. 190 testów e2e trzeba przepisać)?
2. **[do potwierdzenia]** Skrót ⌘⇧P dla „Podgląd” – czy właściciel woli inny (np. ⌥⌘P)?
3. **[do potwierdzenia]** Czy Preview mode ma kiedyś zostać zapamiętywany (np. otwieranie CV w ostatnim trybie)?
4. Czy po eksperymencie warto wrócić do edycji tekstu wprost na kartce dla pól 1:1 (imię, tytuł sekcji, punkt) jako
   ulepszenia kart – ADR-0009 opisuje, kiedy to rozważyć.
