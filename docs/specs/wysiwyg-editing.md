# Edycja WYSIWYG na stronach CV (eksperyment) – grilling i spec

Sesja „grilling” nad kolejnym krokiem eksperymentu z `docs/specs/inline-editing-redesign.md`.
Stan na 2026-11-14, gałąź `experiment/inline-editing-redesign`.

**Uwaga:** sesja odbyła się bez właściciela. Agent zadawał pytania i sam na nie odpowiadał, za każdym razem wybierając
rekomendowaną opcję; każda decyzja jest decyzją roboczą. Decyzje produktowe, które warto potwierdzić, mają oznaczenie
**[do potwierdzenia]** i są zebrane w „Otwartych pytaniach”.

**Wymaganie właściciela (punkt wyjścia, bez dyskusji):** „Dobry kierunek. Dalej: w trybie Outline nie ma być żadnych
formularzy do edycji treści – treść edytuje się bezpośrednio na podglądzie, czyli WYSIWYG.” To świadomie odwraca
decyzję Q1/Q3 z `inline-editing-redesign.md` i odrzucenie edycji w miejscu w ADR-0009. Wygląd CV i wynik (strony w
Preview mode, PDF, DOCX) nadal nie mogą się zmienić.

Przeczytane: `CLAUDE.md`, `GLOSSARY.md`, ADR-0002, ADR-0004, ADR-0008, ADR-0009, `docs/specs/inline-editing-redesign.md`
(z „Stanem realizacji i odstępstwami”), `git log main..HEAD`, `src/renderer/src/template/*` (`CvPages`, `CvBlockView`,
`templateDefinition`, `pages.css`, szablony `classic` / `modern` / `bold` z arkuszami), `domain/{blocks,paginate,schema,dates}.ts`,
`editor/{cvEditor,documentEdits,listFieldKeys,MonthField}.ts(x)`, `editor/fields/*`, `canvas/*` (`EditLayer`, `EditCard`,
`editTargets`, `fragmentRects`, `useFragmentRects`, `BlockMenu`, `AddControls`, `Outline`, `useEditSession`),
`preview/{PreviewPane,keystrokeTiming}.ts(x)`, `CvScreen.tsx`, `e2e/{goldenPages,canvas,performance,export}.spec.ts`.

Nowe ADR: `docs/adr/0010-wysiwyg-text-editing-in-an-edit-mode-variant-of-the-templates.md` (zastępuje część ADR-0009).
Zmiany w `GLOSSARY.md`: nowe **Page field**, **Field popover**; zmienione **Edit mode**, **Edit card** (wycofywana),
**CV form**.

---

## Kontekst

Dziś (po T1–T9) Edit mode to warstwa edycji nad niezmienionymi stronami: klik we fragment strony otwiera pływającą
**Edit card** z polami formularza tego fragmentu (`canvas/EditCard.tsx` składa ją z `editor/fields/*`). Strony są
czystym renderem: `generateBlocks` → pomiar w `.cv-measure` → `paginate` → `CvBlockView` / nadpisania szablonu
(`blockViews`) w `.cv-pages`. Teksty na stronie bywają złączone z kilku pól (`companyLine` = „firma – miejscowość”,
daty sformatowane w CV language, „poziom, kierunek, uczelnia”, „etykieta: wartość”), a puste pola i puste wpisy nie mają
bloku. Ten sam `CvPages` rysuje podgląd, okno wydruku PDF (`PrintView.tsx`) i Template thumbnail; DOCX powstaje w main z
`generateBlocks` (ADR-0008). Wygląd pilnuje e2e „złotych stron” (`e2e/goldenPages.spec.ts`: zrzuty `.cv-page` w Preview
mode i tekst PDF w trzech szablonach, wzorce z `main`).

Karta to nadal formularz – tylko bliżej tekstu. Właściciel chce, żeby tekst CV edytowało się w literach strony.

## Cele

1. W Edit mode cały tekst CV (imię i nazwisko, kontakty, podsumowanie, tytuły sekcji, stanowiska, firmy, miejscowości,
   poziomy, kierunki, uczelnie, punkty, elementy list, klauzula zgody) edytuje się wprost na stronie: klik stawia kursor w
   klikniętym miejscu, pisanie zmienia stronę na żywo, bez żadnego formularza.
2. Wartości, które nie są tekstem (daty, „obecnie”, zdjęcie, wybór klauzuli z biblioteki), mają małe kontrolki
   pojawiające się przy polu (**Field popover**), nigdy formularz całej części CV.
3. Strony w Preview mode, PDF i DOCX bez jednej różnicy; strony w Edit mode bez fokusu w polu wyglądają i dzielą się
   na strony identycznie jak w Preview mode.
4. Pełna obsługa z klawiatury i czytnikiem ekranu; pisanie mieści się w progu 100 ms (`cv:keystroke-to-preview`).

## Poza celami (non-goals)

- Zmiana wyglądu dokumentu i schematu CV (ADR-0002): żadnych nowych pól, linków, formatowania tekstu (pogrubienia,
  kursywy), poziomów umiejętności.
- Formatowanie „rich text”: edycja wyłącznie tekstu bez formatowania (W5).
- Przeciąganie fragmentów myszą po stronach (bez zmian względem Q11 poprzedniego speca).
- Usunięcie CV form – zostaje jako drugi widok paska bocznego (W20).
- Menu kontekstowe z podpowiedziami pisowni (W24) – osobne zadanie.
- Zmiany w DOCX builderze, w `paginate.ts` i w arkuszach szablonów.

---

## Dziennik decyzji

Format: pytanie → **decyzja** → dlaczego (rozważone opcje).

### A. Gdzie i jak żyje edytowalny tekst

**W1. Co dokładnie znaczy „WYSIWYG” w tym edytorze?**
**Decyzja:** w Edit mode (w obu widokach paska bocznego: Outline i CV form) każdy tekst CV na stronie to **Page field** –
edytowalny fragment tekstu jednego pola CV, w tym samym miejscu, tym samym fontem i z tym samym zawijaniem co w PDF.
Klik stawia kursor w klikniętym znaku; zmiana od razu zmienia dokument (autozapis, cofanie jak dziś). Wartości
nietekstowe mają Field popover (W12–W15). Edit card znika (W20).
Dlaczego: to dosłownie wymaganie właściciela; „w obu widokach paska”, bo strona to strona – byłoby dziwne, gdyby ta sama
kartka raz była edytowalna, a raz nie, zależnie od paska obok.

**W2. Contenteditable na węzłach szablonu, pole nałożone piksel w piksel, czy edytowalny wariant szablonów tylko w Edit mode?**
**Decyzja:** **edytowalny wariant tych samych szablonów, renderowany tylko w Edit mode.** Szablony rysują tekst pól przez
małe „sloty” (`template/editable.tsx`), które:
- bez kontekstu edycji (Preview mode, okno PDF, miniatury, kontener pomiarowy w Preview mode) zwracają **dokładnie ten sam
  markup co dziś** (te same napisy, te same węzły tekstowe, te same warunki renderowania);
- z kontekstem edycji (`CvPages` z propem `editing`, podawanym wyłącznie przez `PreviewPane` w Edit mode) rysują każde pole
  osobno jako `<span contenteditable="plaintext-only" data-field-key=…>` w tym samym elemencie szablonu, a separatory
  („ – ”, „, ”, „: ”) jako zwykły tekst między nimi.
Odrzucone:
- *contenteditable wprost na dzisiejszych węzłach* – jeden węzeł niesie kilka pól (`companyLine`, daty, „poziom, kierunek,
  uczelnia”, „etykieta: wartość”), więc nie da się odwzorować edycji na pola; React nadpisywałby tekst przy każdym
  renderze.
- *pole tekstowe nałożone na tekst* – odrzucone już w ADR-0009: inne zawijanie (fonty, `text-transform`, kolumny), tekst
  „pływa” w trakcie pisania; złączone teksty nierozwiązane.
- *osobne kopie komponentów szablonów do edycji* – trzy szablony × dwie wersje; każda poprawka wyglądu w jednej kopii
  rozjeżdża WYSIWYG z PDF. Sloty trzymają jeden kod rysujący dla obu trybów.
Dlaczego: jedyna opcja, w której tekst w Edit mode leży w prawdziwym układzie szablonu (więc zawija się jak w PDF) i ma
pola rozdzielone; tryb dokumentu pozostaje bajt w bajt taki jak dziś, co sprawdzamy maszynowo (W3). Zapisane w ADR-0010.

**W3. Jak udowadniamy, że Preview mode, PDF i DOCX się nie zmieniły, skoro dotykamy kodu szablonów?**
**Decyzja:** cztery bramki, wszystkie w CI:
1. **Złoty markup (nowy, Vitest, przed pierwszą zmianą szablonu):** `template/goldenMarkup.test.tsx` renderuje
   `renderToStaticMarkup` każdy blok `generateBlocks` dla Sample CV (`en`, `pl`) i dla fixture'u przypadków brzegowych
   (kontakt bez etykiety, wykształcenie z samym poziomem, wpis bez dat, wpis z samymi datami, „obecnie”, lista obok tytułu,
   2 kolumny, klauzula) w każdym szablonie, bez kontekstu edycji, oraz stopkę strony. Wzorzec zapisany z obecnych
   szablonów (identycznych z `main`) w pierwszym commicie. Różnica = zmiana dokumentu, wzorca nie aktualizujemy.
   `vitest.config.ts` dostaje `src/**/*.test.tsx`.
2. **Złote strony (bez zmian):** `e2e/goldenPages.spec.ts` zostaje, wzorce zostają.
3. **Złote strony w Edit mode (nowe):** ten sam spec, drugi przebieg: Edit mode, mysz poza stronami, brak fokusu w polu –
   zrzuty `.cv-page` porównane z **tymi samymi** wzorcami PNG, ta sama liczba stron i te same id bloków na stronach co w
   Preview mode. Warstwa edycji rysuje obrysy tylko przy najechaniu/fokusie, więc w spoczynku nie ma jej na zrzucie.
4. **DOCX:** `generateBlocks` bez opcji zwraca to samo co dziś (W4); testy `src/main/docx` i `templateIndependence`
   bez zmian.
Dlaczego: „szablony bez zmian” przestaje być prawdą w kodzie, więc musi być prawdą w wyniku – sprawdzalne, nie
deklarowane. Złoty markup łapie różnice szybciej i dokładniej niż zrzuty (np. dodatkowy węzeł tekstowy, którego nie
widać).

**W4. Skąd slot wie, które pole CV rysuje, i co z pustymi wpisami, które dziś nie mają bloku?**
**Decyzja:**
- `CvBlock` się **nie zmienia**. Slot dostaje blok i nazwę pola (`role`, `company`, `start`…), a kontekst edycji
  rozwiązuje pole po id bloku (`header`, `<sekcja>:title`, `<wpis>`, `<wpis>:<punkt>`, wiersz listy z `items[].id`)
  w bieżącym dokumencie – ta sama wiedza co dziś w `canvas/editTargets.ts`.
- `generateBlocks(document, geometry, options?)` dostaje opcjonalne `reveal` (zbiór części CV, które w Edit mode mają blok
  mimo pustych pól: aktywny fragment i części „odsłonięte” przez dodawanie – W10). Bez opcji wynik identyczny (test:
  `generateBlocks(d, g)` ≡ `generateBlocks(d, g, { reveal: pusty })` dla wszystkich fixture'ów; istniejące testy bloków bez
  zmian). DOCX i `PrintView` nigdy jej nie podają.
Dlaczego: najmniejsza zmiana w domenie; odsłonięcie pustej części musi wpływać na pomiar i podział stron, więc nie może
być tylko w warstwie widoku.

**W5. Jaki tekst wolno wpisać: plain text czy formatowanie?**
**Decyzja:** wyłącznie tekst bez formatowania. Page field to `contenteditable="plaintext-only"` (Chromium w Electron 45),
a obsługa `beforeinput` (`canvas/pageFieldInput.ts`) przechwytuje: `insertParagraph` / `insertLineBreak` (W11),
`insertFromPaste` / `insertFromDrop` (W6), `historyUndo` / `historyRedo` (W19), każde `format*` (blokowane). Zwykłe
wpisywanie i kasowanie (`insertText`, `delete*`) robi przeglądarka; po zdarzeniu `input` pole czyta `textContent`, a edytor
dostaje nową wartość pola. Wielowierszowe są tylko pola, w których szablon pokazuje znak nowej linii
(`getComputedStyle(pole).whiteSpace` to `pre-line`/`pre-wrap`: podsumowanie w Modern i Bold, klauzula we wszystkich) –
gdzie indziej nowa linia byłaby w PDF spacją, więc jej nie wstawiamy.
Dlaczego: schemat ma tylko napisy; `plaintext-only` wyłącza ⌘B/⌘I i wklejanie HTML w samej przeglądarce, a zasada
„wielowierszowe tam, gdzie widać nową linię” jest uczciwym WYSIWYG (Classic nie pokazuje nowych linii w podsumowaniu).

**W6. Wklejanie i upuszczanie.**
**Decyzja:** zawsze tylko `text/plain`, znormalizowany: `\r\n`/`\r` → `\n`, tabulatory i znaki sterujące → spacja,
twarde spacje zostają. Potem:
- pole jednowierszowe: nowe linie → spacja;
- pole wielowierszowe: nowe linie zostają;
- punkt stanowiska i element listy: tekst wielowierszowy dzieli się na kolejne punkty/elementy (pierwsza linia w miejsce
  kursora, reszta jako nowe elementy za bieżącym, puste linie pomijane), kursor na końcu ostatniego wklejonego – jeden
  krok cofania (`pasteIntoList` w `documentEdits.ts`) **[do potwierdzenia]**;
- upuszczenie tekstu (także przeciągnięcie z innego pola) działa jak wklejenie; upuszczenie pliku na stronę – nic.
Dlaczego: wklejanie z LinkedIn/Worda to główne źródło treści CV; podział na punkty oszczędza ręcznego dzielenia,
a normalizacja chroni przed niewidocznymi znakami w PDF.

**W7. IME i kompozycja (np. znaki diakrytyczne przez klawisze martwe, japoński, chiński).**
**Decyzja:** w trakcie kompozycji (`compositionstart` → `compositionend`) pole niczego nie wysyła do edytora i nikt nie
przepisuje jego DOM; po `compositionend` jedna zmiana z całym tekstem. Skróty pól (Enter, Backspace, ⌥⇧↑/↓) ignorują
klawisze z `isComposing` – jak dziś `listFieldKeys.ts`.
Dlaczego: ponowny podział stron albo przepisanie tekstu w trakcie kompozycji przerywa ją w Chromium; dokument się wtedy
nie zmienia, więc strony się nie przerysowują.

**W8. Kursor i zaznaczenie przy przerysowaniach React i ponownym podziale stron.**
**Decyzja:**
- Page field jest „niekontrolowany w trakcie pisania”: React renderuje pusty `span`, a tekst wpisuje efekt pola tylko
  wtedy, gdy wartość w dokumencie różni się od `textContent` (np. po cofnięciu albo zmianie z CV form). Własne pisanie
  nigdy nie przepisuje DOM, więc kursor nie skacze.
- **Aktywne pole** (sesja edycji, poza `zundo`): klucz pola i zaznaczenie jako przesunięcia znaków w wartości pola,
  aktualizowane na `selectionchange`. Klucz pola = klucz łączenia kroków cofania (W19).
- Gdy blok przechodzi na inną stronę, jego węzeł jest montowany od nowa (`CvPages` grupuje bloki w `<section>` stron;
  struktury DOM nie zmieniamy). `CvPages` po każdym nowym podziale stron woła `editing.onPagesCommitted()` w
  `useLayoutEffect` – przed malowaniem – a ten, jeśli fokus nie jest w polu aktywnego klucza, szuka
  `.cv-pages [data-field-key="…"]` (nigdy w `.cv-measure`) i przywraca fokus i zaznaczenie bez przewijania; potem pole
  jest przewijane do widoku tylko, gdy wyszło poza panel (`block: 'nearest'`).
- Kopia pomiarowa rysuje te same sloty bez `contenteditable` (identyczna geometria, zero fokusu).
- Wpis rozdzielony między strony: każde Page field leży w całości w jednym bloku, więc nie ma pola „na dwóch stronach”.
  Strzałki ↑/↓ na pierwszej/ostatniej linii pola i ←/→ na jego początku/końcu przechodzą do poprzedniego/następnego pola w
  kolejności dokumentu (też przez granicę stron).
Dlaczego: utrzymanie bloku zamontowanego przez granicę stron zmieniłoby strukturę `CvPages` (ryzyko dla złotych stron);
przywrócenie po id przed malowaniem daje ten sam efekt dla użytkownika.

**W9. Mapowanie pól, gdy jedna linia łączy kilka pól.**
**Decyzja:** osobne Page field na każde pole; separatory i stały tekst poza polami. Separator jest rysowany jak w trybie
dokumentu (tylko gdy oba sąsiednie pola są niepuste), a w aktywnym fragmencie zawsze (pola puste mają tam placeholder,
W10). Klik w separator, w kropkę osi czasu albo w pusty obszar bloku stawia kursor w najbliższym polu tego bloku
(`caretPositionFromPoint` / najbliższy prostokąt pola).

| Treść na stronie | Classic (wspólny markup) | Modern | Bold | Page fields / kontrolki |
| --- | --- | --- | --- | --- |
| Imię i nazwisko | `h1.cv-name` | `h1.cv-name` | `h1.cv-name` | `header:fullName` |
| Kontakt | `p`: „etykieta: wartość” | `.cv-contact-label` + `div` | `.cv-contact-label` + `span` | `contact:<id>:label`, `contact:<id>:value`; separator „: ” tylko w Classic |
| Podsumowanie | `p.cv-summary` | `p.cv-summary` (pre-line) | `p.cv-summary` (pre-line) | `header:summary` |
| Tytuł sekcji | `h2.cv-section-title` (dla list w 1. wierszu obok) | `h2` (uppercase) | `h2` (uppercase) | `section:<id>:title` |
| Daty | `.cv-date` „od – do” | `.cv-date` | `.cv-date` (tylko niepuste) | dwa **żetony dat** `…:start`, `…:end` + Field popover (W12) |
| Stanowisko | `.cv-role` | `.cv-role` | `.cv-role` | `experience:<id>:role` |
| Firma – miejscowość | `.cv-company` | `.cv-company` | `.cv-company` | `experience:<id>:company`, `experience:<id>:location`, separator „ – ” |
| Punkt | `li` w `.cv-bullets` | `li` | `li` | `experience:<id>:bullet:<punkt>` |
| Poziom, kierunek, uczelnia | `div`: „poziom, kierunek, uczelnia” | `strong.cv-education-level` + „, kierunek, uczelnia” | jak Modern | `education:<id>:level`, `…:field`, `…:institution`, separatory „, ” |
| Element listy | `li` w `.cv-plain-list` | `li` w `.cv-list-row` | `li` | `list:<id>:text` |
| Klauzula zgody | `p.cv-consent` (rysuje `CvPages`) | to samo | to samo | `consent:text` + pasek klauzuli (W15) |
| Zdjęcie | `img.cv-photo` | to samo | to samo | Field popover zdjęcia (W13) |
| Stopka strony (imię, n / N) | – | `footer` | `footer` | nie edytowalna (pochodna imienia) |

Sloty złożone (`CompanyLine`, `DateRange`, `EducationLine`, `ContactLine`) są w `template/editable.tsx`, więc szablony
nie powtarzają reguł separatorów; w trybie dokumentu każdy zwraca dokładnie dzisiejszy napis (np. `block.companyLine`).
Dlaczego: pole = jednostka zapisu, cofania i etykiety dla czytnika ekranu; reguły złączeń zostają w jednym miejscu
(`blocks.ts` dla dokumentu, sloty dla edycji).

**W10. Puste pola w WYSIWYG i podział stron: czy Edit mode musi dzielić strony dokładnie jak PDF?**
**Decyzja:** **tak, w spoczynku; nie, w aktywnym fragmencie.**
- **Aktywny fragment** = część CV z fokusem (imię i nazwisko; kontakty; podsumowanie; tytuł sekcji; wpis stanowiska z
  punktami; wpis wykształcenia; sekcja listowa; klauzula). Tylko w nim puste pola pokazują **placeholder w treści**:
  pusty Page field z nazwą pola w Interface language (`::before { content: attr(data-placeholder) }`, kolor szary, font i
  rozmiar szablonu), wraz z separatorami i elementami, które szablon rysuje tylko dla niepustych pól (np. `.cv-company`,
  żeton dat w Bold). Placeholder zajmuje miejsce – pomiar i podział stron w Edit mode liczą się z nim (kopia pomiarowa
  rysuje te same sloty), więc aktywny fragment może urosnąć o linię i przesunąć dalsze bloki.
- Aktywny fragment ma blok nawet wtedy, gdy wszystkie jego pola są puste (`reveal`, W4) – wyczyszczenie stanowiska w
  pustym poza nim wpisie nie zabiera pola spod kursora. Po wyjściu fokusu pusta część znika ze strony (zostaje w danych,
  jak dziś; Outline ją liczy).
- **Odsłonięta część** = nowa albo pusta część, którą użytkownik właśnie dodał („+”, „Dodaj do CV”, Outline, menu
  uchwytu): też jest w `reveal`, dostaje fokus i działa jak aktywny fragment.
- Bez fokusu w polu (i bez odsłoniętej części) Edit mode ma dokładnie ten sam podział stron i wygląd co Preview mode i
  PDF (bramka 3 z W3).
Odrzucone: placeholdery zawsze w Edit mode (strony w Edit mode stale inne niż PDF; nowe CV wyglądałoby jak szablon
formularza); placeholdery bez zajmowania miejsca (nie ma gdzie postawić kursora dla pustej firmy).
Dlaczego: kompromis znany z edytorów blokowych (placeholder tylko w bieżącym bloku); rozjazd z PDF jest ograniczony do
miejsca, w którym użytkownik właśnie pisze, i znika po wyjściu z pola. Pozostałe ostrzeżenia (np. „Część treści nie
mieści się na stronie”) liczą się z podziału Preview mode – `PreviewPane` dostaje oba podziały tylko wtedy, gdy się
różnią **[do potwierdzenia: czy wystarczy podział Edit mode]**.

### B. Klawiatura i struktura

**W11. Enter, Backspace, Delete i Tab.**
**Decyzja:**

| Pole | Enter | Shift+Enter | Backspace na początku | Delete na końcu |
| --- | --- | --- | --- | --- |
| Punkt, element listy | dzieli w miejscu kursora (`splitBullet` / `splitListItem`), kursor na początek nowego; w pustym – nic | nic (szablony nie pokazują nowej linii w punkcie, W5) | pusty: usuwa, kursor na koniec poprzedniego (jak dziś); niepusty: **łączy z poprzednim** (kursor w miejscu złączenia); pierwszy – nic | łączy z następnym |
| Wartość kontaktu | nowy kontakt za bieżącym, kursor w jego etykiecie | – | w pustym kontakcie (etykieta i wartość puste): usuwa, kursor na koniec poprzedniej wartości | – |
| Podsumowanie, klauzula (gdy wielowierszowe, W5) | nowa linia | nowa linia | zwykłe kasowanie | zwykłe |
| Pozostałe (imię, tytuł, stanowisko, firma, miejscowość, poziom, kierunek, uczelnia, etykieta) | przejście do następnego pola w kolejności dokumentu | – | zwykłe kasowanie | zwykłe |

Tab / Shift+Tab: naturalna kolejność fokusu = Page fields i żetony dat w kolejności DOM stron (= kolejność czytania
szablonu), przez granice fragmentów i stron; potem pasek „Dodaj do CV”. Escape: zamyka otwarty Field popover, a bez niego
wychodzi z pola na panel stron (`tabindex="-1"`, nazwa „Strony CV”), żeby ⌘⇧P i strzałki przewijania działały.
⌥⇧↑/↓ w punkcie i elemencie listy – przeniesienie o pozycję (jak dziś); w polu wpisu – przeniesienie wpisu (jak uchwyt).
Shift+F10 / klawisz menu – otwiera menu uchwytu fragmentu z fokusem (W21).
Złączenia i podziały idą bez klucza scalania (osobny krok cofania), nowe zmiany w `documentEdits.ts`: `mergeBulletIntoPrevious`,
`mergeListItemIntoPrevious`, `insertContactAfter`, `pasteIntoList`.
Dlaczego: semantyka edytora tekstu; łączenie przy Backspace jest odwrotnością podziału przy Enter (w formularzu brakowało
go, bo pola były osobnymi kontrolkami).

### C. Wartości nietekstowe

**W12. Daty, „obecnie”, ostrzeżenie o kolejności.**
**Decyzja:** każda data to **żeton daty**: `span` z `role="button"`, `tabindex="0"`, `aria-haspopup="dialog"`, w miejscu
daty w `.cv-date` (tekst „03.2021”, „present” w CV language albo placeholder „Od”/„Do” w aktywnym fragmencie). Klik,
Enter lub spacja otwiera **Field popover** daty przy żetonie: `MonthField` (ten sam komponent i ta sama reguła
„niedokończony wpis zostaje w polu”), dla końca stanowiska „Obecnie tu pracuję”, „Wyczyść”. Zmiana widać od razu;
Escape/Enter zamyka i wraca na żeton. Odwrócone daty (`isEndBeforeStart`): w warstwie edycji przy `.cv-date` znaczek ⚠
(poza treścią kartki, tylko Edit mode) z opisem dla czytnika ekranu (`aria-describedby` żetonu), a w popoverze treść
`DateOrderWarning`. Nigdy blokada.
Dlaczego: format daty pochodzi z CV language i nie jest tekstem do wpisania (pisanie „03.2021” w miejscu, gdzie strona
pokazuje „present”, byłoby niejednoznaczne); popover z jednym polem to kontrolka wartości, nie formularz części CV.

**W13. Zdjęcie.**
**Decyzja:** klik/Enter na zdjęciu (`img.cv-photo` ma w Edit mode nakładkę-przycisk w warstwie edycji „Zdjęcie”) otwiera
Field popover z „Zmień…”, „Kadruj…”, „Usuń” (z „Usunięto. Cofnij”). Okno kadrowania zostaje modalnym `dialog` jak dziś
(`PhotoField` przenosi logikę wyboru i kadrowania do hooka `usePhotoPicker`, wspólnego dla CV form i popovera). „Zdjęcie”
w pasku „Dodaj do CV” od razu otwiera wybór pliku.
Dlaczego: zdjęcie nie jest tekstem; kadrowanie to narzędzie obrazu, nie formularz treści.

**W14. Kontakty.**
**Decyzja:** etykieta i wartość to osobne Page fields (W9). Podpowiedzi etykiet (`defaultContent.contactLabels`, dziś
`datalist`) – lista `role="listbox"` w Field popover pod polem etykiety (combobox, `aria-autocomplete="list"`), filtrowana
tym, co wpisano; ↑/↓ i Enter wybierają. Dodawanie: Enter w wartości (W11), „Kontakt” w „Dodaj do CV”, „Dodaj kontakt” w
menu uchwytu nagłówka. Usuwanie: Backspace w pustym kontakcie; kolejność kontaktów – bez zmian (tylko CV form).
Dlaczego: kontakty to mała lista – zachowują się jak elementy listy, a podpowiedzi to pomoc przy polu, nie formularz.

**W15. Klauzula zgody.**
**Decyzja:** tekst klauzuli to wielowierszowe Page field `consent:text`. Gdy ma fokus, nad klauzulą pojawia się **pasek
klauzuli** (Field popover w formie paska narzędzi, `role="toolbar"`): „Z biblioteki ▾” (menu z klauzulami → `applyClause`),
„Przywróć z biblioteki” (gdy tekst różni się od klauzuli z biblioteki), „Zapisz jako klauzulę…” (pyta tylko o nazwę
klauzuli – metadana biblioteki, nie treść CV), „Ukryj klauzulę” (`enabled: false`). Włączanie: Outline i „Dodaj do CV”
(jak dziś).
Dlaczego: wszystkie dzisiejsze możliwości `ConsentFields` bez formularza; akcje są przyciskami, treść – na stronie.

**W16. Linki.**
**Decyzja:** schemat nie ma linków (ADR-0002) – kontakt z adresem to zwykły tekst; nic nie jest klikalne jako link w Edit
mode. Poza zakresem.

**W17. Pola wyboru, które nie dotyczą tekstu.**
**Decyzja:** „Obecnie tu pracuję” – w popoverze daty końca (W12). „Nowa strona przed” – tylko w menu uchwytu (już jest) i
w Outline dla sekcji; „Ukryj sekcję” – menu uchwytu i Outline; „Pokaż klauzulę” – Outline, „Dodaj do CV” i „Ukryj
klauzulę” w pasku klauzuli. Wszystkie nadal także w CV form.
Dlaczego: każda z tych opcji ma już miejsce poza kartą; nie potrzeba nowego.

**W18. Walidacja.**
**Decyzja:** jedyna dzisiejsza walidacja (kolejność dat) – W12. Puste pola nie są błędem. Brak blokad zapisu.

### D. Historia i stan

**W19. Cofnij/ponów: granulacja i klucze scalania.**
**Decyzja:**
- Pisanie w Page field używa **tych samych kluczy scalania co CV form** (`header:fullName`, `header:summary`,
  `contact:<id>:label|value`, `section:<id>:title`, `experience:<id>:role|company|location|start|end|bullet:<punkt>`,
  `education:<id>:level|field|institution|start|end`, `list:<id>:text`, `consent:text`). Klucz pola = klucz scalania =
  `data-field-key`. Pisanie w jednym polu łączy się w krok jak dziś (przerwa 1 s, max 5 s), także na przemian ze
  stroną i CV form.
- Podział, złączenie, wklejenie wielu linii, nowy kontakt, usunięcie, zmiany w Field popover bez klucza (osobny krok); data
  z kluczem `…:start|end` (jak `MonthField` w formularzu).
- Natywne cofanie `contenteditable` jest wyłączone (`beforeinput` `historyUndo`/`historyRedo` → `editor.undo()/redo()`;
  ⌘Z/⌘⇧Z obsługuje już `useEditorLifecycle`).
- Po cofnięciu/ponowieniu z fokusem w polu: jeśli pole istnieje, efekt pola wpisuje nową wartość, a kursor staje na końcu
  zmienionego zakresu (wspólny prefiks/sufiks starej i nowej wartości); jeśli pola już nie ma (cofnięty podział) – kursor
  na koniec poprzedniego pola tego fragmentu, a bez niego na panel stron.
Dlaczego: zero nowej semantyki historii; użytkownik CV form i stron dostaje te same kroki.

**W20. Co z Edit card?**
**Decyzja:** **znika** – po ostatnim kawałku (S6) nie ma jej kodu w `canvas/` (`EditCard.tsx`, `cardLabel`, `targetAt`,
`contractHit`, przyciski fragmentów „Edit: …”). W trakcie przejścia (S1–S4) karta otwiera się już tylko dla części, które
jeszcze nie mają Page fields. CV form zostaje (widok „Formularz” paska bocznego) jako pełna, liniowa droga edycji i
siatka bezpieczeństwa; strony obok CV form też są WYSIWYG. Komponenty `editor/fields/*` służą odtąd tylko CV form (i
`MonthField` w popoverze daty).
Odrzucone: karta w trybie CV form (dwa sposoby edycji tej samej strony zależnie od paska); karta jako zapasowa droga
dostępności (CV form robi to lepiej i już jest).
Dlaczego: wymaganie „żadnych formularzy” w Outline; trzymanie karty tylko „na wszelki wypadek” utrzymywałoby dwa modele
interakcji na tej samej kartce.

**W21. Uchwyty, pigułki „+”, „Dodaj do CV”, „Usunięto. Cofnij”, Outline, powiększenie.**
**Decyzja:**
- **Warstwa edycji** (ADR-0009) zostaje dla tego, co nie jest tekstem: obrys aktywnego fragmentu i fragmentu pod kursorem
  (`pointer-events: none` – klik trafia w Page field pod spodem), uchwyty menu, pigułki „+”, pasek „Dodaj do CV”,
  podpowiedź w pustym CV, znaczki ⚠ dat, przycisk zdjęcia. Przyciski fragmentów znikają.
- **Menu uchwytu**: dzisiejsze pozycje + **„Usuń stanowisko” / „Usuń wykształcenie”** (oddzielone, w stylu `danger`, z
  „Usunięto. Cofnij”) – skoro nie ma karty z tekstowym przyciskiem usuwania **[do potwierdzenia: odstępstwo od reguły z
  #111 „wpisy usuwa się tekstowym przyciskiem, nie z menu wiersza”]**. „Dodaj …” odsłania nowy element i stawia w nim
  kursor.
- **Pigułki „+”, „Dodaj do CV”, podpowiedź w pustym CV, „Dodaj” w Outline**: dodają (albo odsłaniają istniejący pusty
  element sekcji – reguła `reuseEmpty` z T5 dla wszystkich wejść) i stawiają kursor w pierwszym polu z placeholderami
  (W10). Części nagłówka: „Imię i nazwisko”, „Kontakt”, „Podsumowanie” odsłaniają pole; „Zdjęcie” – wybór pliku.
- **„Usunięto. Cofnij”**: pływający komunikat w lewym dolnym rogu panelu stron (bez warstwy górnej nad kartą – karty nie
  ma); „Cofnij” przywraca i stawia kursor w przywróconym polu (`data-field-key`) albo na uchwycie wpisu.
- **Outline**: klik w „Nagłówek” → kursor w imieniu; w sekcję → przewinięcie i kursor na końcu tytułu sekcji; w klauzulę
  → kursor w klauzuli; w pustą sekcję → odsłonięcie jej pierwszego elementu z kursorem; w ukrytą sekcję → fokus na jej
  przełączniku „Pokaż” z opisem „Pokaż sekcję, żeby ją edytować” (ukryta sekcja nie ma strony do edycji).
- **Powiększenie**: Page fields działają w każdej skali (strony są skalowane `transform`, kursor i zaznaczenie skalują się
  w Chromium); poniżej 50% uchwyty i pigułki chowają się jak dziś; Field popovers zawsze 1:1 (warstwa górna); bez
  automatycznego powiększania przy kliknięciu.
Dlaczego: kontrolki struktury zostają tam, gdzie są dziś i działają; jedyna luka po karcie (usuwanie wpisu) trafia do
istniejącego menu.

**W22. Dostępność.**
**Decyzja:**
- Edit mode: `.preview-pages` **przestaje być `aria-hidden`**; ukryte zostają `.cv-measure`, dekoracje (już `aria-hidden`)
  i stopki stron. Czytnik ekranu czyta CV w kolejności dokumentu, a Page fields są polami tekstowymi
  (`contenteditable` → rola `textbox`) z `aria-label` „<pole> – <część>” (np. „Firma – stanowisko Senior Developer”),
  `aria-multiline` tam, gdzie W5 pozwala, `aria-placeholder` dla pustych; żetony dat – przyciski „Od: 03.2021”.
- Preview mode: strony dalej `aria-hidden` (bez zmian).
- Uchwyty i pigułki „+” wychodzą z kolejności Tab (`tabindex="-1"`, wciąż klikalne); z klawiatury te same akcje daje
  Shift+F10 w polu (menu uchwytu jego fragmentu: przenieś, nowa strona, ukryj, dodaj, usuń). Pasek „Dodaj do CV” zostaje w
  kolejności Tab (za ostatnią stroną).
- Komunikaty `aria-live` (istniejący region `BlockMenu`) dla zmian struktury z klawiatury: „Nowy punkt 3”, „Połączono z
  punktem 2”, „Usunięto kontakt”.
- CV form zostaje pełną liniową drogą edycji; test e2e „screen readers read the CV from the form only” zmienia się na
  „w Preview mode strony są ukryte, w Edit mode strony to CV z polami tekstowymi” (S1).
Dlaczego: WYSIWYG bez czytnika ekranu byłby regresją; edytowalne strony są wreszcie lepszym wejściem niż ukryta kopia.

**W23. Wydajność (próg 100 ms).**
**Decyzja:**
- Ścieżka klawisza: `input` → `editor.edit` → `generateBlocks` → render stron → pomiar → `paginate` → render; Page field
  nie przepisuje swojego DOM (W8), a `markInput(event.timeStamp)` woła obsługa `input` pól (nasłuch na `.preview-pages`),
  więc `cv:keystroke-to-preview` mierzy pisanie na stronie.
- Aktywne pole i aktywny fragment trzymamy w małym zewnętrznym magazynie (`useSyncExternalStore`), nie w stanie
  `CvScreen`: zmiana zaznaczenia nie renderuje stron. `reveal` zmienia tożsamość tylko wtedy, gdy zmienia się aktywny
  fragment **i** ma on puste pola – wtedy (i tylko wtedy) wejście w fragment kosztuje jeden ponowny podział stron.
- `e2e/performance.spec.ts`: przebieg „pisanie w Edit card” zastąpiony przebiegiem „pisanie na stronie” (ostatnie
  stanowisko długiego CV) i nowym „wejście w wpis z pustym polem” (klik → namalowany placeholder) – oba ≤ 100 ms, CPU ×1 i
  ×4, wyniki w opisie PR.
Dlaczego: dzisiejsza ścieżka ma duży zapas (12–25 ms mediana); nowe koszty to przywrócenie kursora (O(1)) i ewentualny
podział przy zmianie fragmentu.

**W24. Sprawdzanie pisowni.**
**Decyzja:** `spellcheck` włączony w polach prozy (podsumowanie, stanowisko, firma, miejscowość, kierunek, uczelnia,
poziom, punkty, elementy list, tytuły sekcji, klauzula), wyłączony w imieniu, kontaktach i żetonach dat. Słownik – ten
Electrona/macOS (bez konfiguracji, jak dziś w formularzu); `lang` = CV language jest już na `.cv`. Podkreślenia są tylko
w Edit mode (PDF i Preview mode nie mają pól edytowalnych). Menu kontekstowe z podpowiedziami – poza zakresem (dziś
formularz też go nie ma).

### E. Kod

**W25. Gdzie co leży (zależności).**
**Decyzja:**
- `template/` nie importuje nic z `canvas/` ani `editor/`: definiuje interfejs `PageEditing` i kontekst
  (`template/editable.tsx`), sloty i sloty złożone. `PrintView` i miniatury nie znają kontekstu – zachowanie dokumentu
  bez zmian, a bundle okna PDF bez kodu edycji.
- `canvas/` implementuje `PageEditing`: komponent pola (`PageField.tsx`), obsługa wejścia (`pageFieldInput.ts` – czyste
  funkcje: `inputType` + wartość + zaznaczenie → zmiana dokumentu i nowe zaznaczenie; normalizacja wklejania), mapa pól
  (`pageFields.ts` – klucz pola → wartość, etykieta, placeholder, wielowierszowość, spellcheck, zmiana dokumentu;
  zastępuje mapowanie kliknięć z `editTargets.ts`), aktywne pole i przywracanie kursora (`useActiveField.ts`), `reveal`
  z aktywnego fragmentu (`reveal.ts`), Field popovers (`FieldPopover.tsx`, `DatePopover.tsx`, `PhotoPopover.tsx`,
  `ConsentToolbar.tsx`, `ContactLabelSuggestions.tsx`; pozycja z `anchoredPosition.ts`).
- Kontrakt znaczników edycji (klasy `.cv-name`, `.cv-role`… w `editMarkupContract`) zostaje tylko dla obrysów i uchwytów
  fragmentów; kontraktem edycji tekstu stają się sloty – checklista „Nowy szablon” w `domain/schema.ts` (krok 5) mówi:
  „tekst pól przez sloty z `template/editable.tsx`; test pól w `e2e/canvas.spec.ts`”.
Dlaczego: kierunek zależności jak dziś (szablon nie wie o edytorze); logika edycji tekstu w czystych funkcjach
testowalnych w Node.

---

## Opis UX (wynik)

**Edycja.** Edit mode: strony wyglądają dokładnie jak w PDF. Najechanie na tekst pokazuje kursor tekstowy i delikatny
obrys fragmentu; klik stawia kursor w klikniętym znaku. Pisanie zmienia stronę na żywo; jeśli wpis przejdzie na kolejną
stronę, kursor jedzie z nim. W bieżącym wpisie puste pola pokazują szare podpowiedzi („Firma”, „Miejscowość”, „Od”) –
znikają, gdy kursor wyjdzie z wpisu. Enter w punkcie tworzy kolejny punkt, Backspace na początku łączy z poprzednim. Klik
w datę otwiera mały wybór miesiąca z „Obecnie tu pracuję”. Klik w zdjęcie – „Zmień / Kadruj / Usuń”. Fokus w klauzuli
pokazuje pasek „Z biblioteki ▾ · Zapisz jako klauzulę · Ukryj”. Uchwyt przy wpisie: przenieś, nowa strona, usuń.

**Dodawanie.** „+ Stanowisko” pod sekcją albo „Dodaj do CV: Podsumowanie” stawia kursor w nowym, pustym miejscu na
stronie z podpowiedziami pól. Nowe CV: „Zacznij od imienia i nazwiska” – klik stawia kursor w imieniu na pierwszej
stronie.

**Outline / CV form.** Outline bez zmian wizualnych; klik w pozycję stawia kursor w jej tekście na stronie. CV form – jak
dziś, obok edytowalnych stron.

**Podgląd.** Bez zmian: ⌘⇧P, strony jak PDF, nic edytowalnego.

## Architektura

```
PreviewPane (Edit mode)
 ├─ CvPages document editing={pageEditing}           ← template/CvPages.tsx: provider kontekstu, reveal → generateBlocks,
 │   ├─ .cv-measure: sloty bez contenteditable           onPagesCommitted() w useLayoutEffect po nowym podziale
 │   └─ .cv-pages: sloty → <PageField> (canvas)       ← template/editable.tsx: PageEditing, CvText, CompanyLine, DateRange,
 │                                                       EducationLine, ContactLine, useShown(block, field)
 └─ EditLayer                                          ← canvas/EditLayer.tsx: obrysy (pointer-events: none), uchwyty,
     ├─ BlockMenu (+ Usuń, Shift+F10)                     pigułki, „Dodaj do CV”, ⚠ dat, przycisk zdjęcia
     └─ FieldPopover: DatePopover | PhotoPopover | ConsentToolbar | ContactLabelSuggestions
```

Pliki:
- **Zmieniane w `template/`**: `editable.tsx` (nowy), `CvPages.tsx` (prop `editing`, provider, `reveal`,
  `onPagesCommitted`), `CvBlockView.tsx` (wspólny markup przez sloty), `modern/index.tsx`, `bold/index.tsx` (sloty),
  `templateDefinition.ts` (komentarz kontraktu), `goldenMarkup.test.tsx` (nowy). Arkusze CSS szablonów i `pages.css`
  bez zmian; style pól i placeholderów w `canvas/pageFields.css` zawężone do `.cv-editing` (klasa dodawana na `.cv`
  tylko z kontekstem edycji) – bez marginesów, paddingów i ramek (tylko `outline`, `caret-color`, kolor placeholdera),
  plus `overflow-wrap`/`line-break` dziedziczone od rodzica, żeby styl edytowalnego elementu w Chromium nie zmieniał
  zawijania.
- **`domain/blocks.ts`**: opcjonalne `reveal` (W4). `paginate.ts` bez zmian.
- **`canvas/`**: nowe `PageField.tsx`, `pageFields.ts`, `pageFieldInput.ts`, `useActiveField.ts`, `reveal.ts`,
  `FieldPopover.tsx`, `DatePopover.tsx`, `PhotoPopover.tsx`, `ConsentToolbar.tsx`, `ContactLabelSuggestions.tsx`;
  zmieniane `EditLayer.tsx`, `BlockMenu.tsx`, `AddControls.tsx`, `Outline.tsx`, `useEditSession.ts` (bez `card`, z
  aktywnym polem i odsłonięciem), `editTargets.ts` (bez `hitTarget`/`fieldTarget` kliknięć); usuwane `EditCard.tsx`.
- **`editor/`**: `documentEdits.ts` (`mergeBulletIntoPrevious`, `mergeListItemIntoPrevious`, `insertContactAfter`,
  `pasteIntoList`), `fields/PhotoField.tsx` (wydzielony `usePhotoPicker`), `fields/ConsentFields.tsx` (wydzielone akcje
  biblioteki do użycia w pasku klauzuli).
- **`preview/PreviewPane.tsx`**: `aria-hidden` tylko w Preview mode, `markInput` z `input` pól, przekazanie `editing`.
- **i18n** (16 słowników, ADR-0001): placeholdery pól, etykiety pól dla czytnika ekranu, popover daty („Wyczyść”), zdjęcia,
  pasek klauzuli, „Strony CV”, opis ukrytej sekcji w Outline, „Usuń stanowisko/wykształcenie” w menu, komunikaty
  `aria-live`.

## Kryteria akceptacji (całość)

1. Złoty markup, złote strony (Preview mode) i tekst PDF identyczne ze wzorcami; DOCX i jego testy bez zmian.
2. Edit mode bez fokusu w polu: zrzuty stron równe wzorcom Preview mode, ten sam podział stron.
3. W Edit mode z Outline nie ma żadnego formularza treści: każde pole CV, które edytuje CV form, jest edytowalne na
   stronie (Page field) albo przez Field popover (daty, zdjęcie, klauzula z biblioteki); `EditCard` nie istnieje.
4. Klik w tekst stawia kursor w klikniętym miejscu; kursor i zaznaczenie przeżywają ponowny podział stron, przeniesienie
   bloku na inną stronę, zmianę skali i zmianę z CV form w innym polu.
5. Wklejenie bogatego tekstu daje czysty tekst; wklejenie wielu linii w punkt tworzy punkty; IME działa bez przerywania
   kompozycji.
6. Enter/Backspace/Delete/Tab/strzałki zgodnie z W11 i W8; ⌥⇧↑/↓ i Shift+F10 z pola.
7. ⌘Z cofa pisanie w polu w tych samych krokach co CV form; natywne cofanie pola nie działa nigdy.
8. Placeholdery tylko w aktywnym/odsłoniętym fragmencie i tylko w Edit mode; pusta część znika po wyjściu fokusu.
9. Czytnik ekranu: w Edit mode strony czytane z polami tekstowymi z nazwami; w Preview mode strony ukryte.
10. `cv:keystroke-to-preview` ≤ 100 ms przy pisaniu na stronie i przy wejściu we wpis z pustym polem (długie CV).
11. Nowe teksty w 16 językach; czytelne w jasnym i ciemnym Appearance (kartka zawsze biała, ADR-0004).

## Strategia testów

- **Vitest**: `template/goldenMarkup.test.tsx` (W3.1, pierwszy commit S1); `template/editable.test.tsx` (sloty w trybie
  edycji: osobne pola, separatory, placeholdery, `data-field-key`); `domain/blocks.test.ts` (`reveal` pusty ≡ brak
  opcji; odsłonięty pusty wpis/punkt/tytuł/nagłówek ma blok); `canvas/pageFieldInput.test.ts` (Enter/Backspace/Delete na
  granicach, wklejanie: normalizacja, podział na punkty, jednowierszowe; kursor po cofnięciu z prefiksu/sufiksu);
  `canvas/pageFields.test.ts` (klucz pola ↔ wartość ↔ zmiana dla Sample CV; klucze = klucze scalania z `editor/fields`);
  `canvas/reveal.test.ts`; `editor/documentEdits.test.ts` (złączenia, `insertContactAfter`, `pasteIntoList`).
- **Playwright**: `e2e/goldenPages.spec.ts` + przebieg Edit mode (W3.3). `e2e/canvas.spec.ts` przepisany z kart na pola:
  klik w imię → kursor, pisanie → strona i PDF, ⌘Z jeden krok; punkt rozdzielony między strony (kursor przeżywa podział);
  Enter/Backspace/Delete w punktach; wklejanie (schowek przez `clipboard` Electron); kompozycja (CDP `Input.imeSetComposition`);
  daty z popovera i ⚠; zdjęcie; kontakty z podpowiedziami; klauzula i pasek; puste pola i placeholdery; dodawanie z „+”,
  „Dodaj do CV”, Outline; usuwanie z menu uchwytu + „Cofnij”; tylko klawiatura; czytnik (role/nazwy); test pól w trzech
  szablonach (każde pole Sample CV ma Page field – następca testu kontraktu znaczników); powiększenie 50%/25%.
  `e2e/export.spec.ts` (oparte na CV form) – bez zmian poza testem czytnika ekranu. `e2e/panes.spec.ts` bez zmian.
- **Pomiar**: `e2e/performance.spec.ts` (W23).
- **Ręcznie (checklista wydania, sekcja „Edycja na stronach”)**: VoiceOver w Edit mode, polski i japoński IME, wklejanie z
  Worda/LinkedIn/Pages, pisownia macOS, trzy szablony × jasny/ciemny Appearance, minimalne okno.

## Podział na kawałki (vertical slices)

Każdy kawałek jest osobno wydawalny, ma własne testy, a cały zestaw (Vitest, e2e, złote strony) jest zielony po każdym.

**S1. Fundament i pierwsze pola: imię i nazwisko, podsumowanie, tytuły sekcji** – zależy od: nic.
Zakres: złoty markup (pierwszy commit, przed zmianą szablonów); `template/editable.tsx` (`PageEditing`, `CvText`,
`useShown`); `CvPages` z `editing`, `reveal`, `onPagesCommitted`; `generateBlocks(…, { reveal })`; `PageField` z
`plaintext-only`, `beforeinput`, wklejaniem, IME, spellcheck; aktywne pole i przywracanie kursora; aktywny fragment z
placeholderem; `markInput`; pola `header:fullName`, `header:summary`, `section:<id>:title` w trzech szablonach (w tym
tytuł obok listy w Classic); dla nich nie ma już przycisku fragmentu ani karty; strony w Edit mode bez `aria-hidden`
(test czytnika ekranu zaktualizowany); złote strony w Edit mode; przebieg „pisanie na stronie” w pomiarze.
Kryteria: AC 1, 2, 7 i 10 dla tych pól; klik stawia kursor w znaku; wyczyszczenie tytułu nie zabiera pola (placeholder);
kursor przeżywa przeniesienie tytułu na kolejną stronę (dopisywanie podsumowania); ⌘Z jak w CV form; pozostałe części
dalej otwierają karty.

**S2. Tekst wpisów i list: stanowisko, firma, miejscowość, wykształcenie, punkty, elementy list** – zależy od: S1.
Zakres: sloty złożone `CompanyLine`, `EducationLine` i `li` przez `CvText` we wspólnym markupie, Modern i Bold;
placeholdery pustych pól aktywnego wpisu (z separatorami); Enter/Backspace/Delete z W11 (nowe złączenia w
`documentEdits.ts`), wklejanie wielu linii w punkty, strzałki między polami, ⌥⇧↑/↓ z pola; klik w separator/kropkę →
najbliższe pole. Daty dalej otwierają kartę wpisu (przejściowo).
Kryteria: każde pole tekstowe wpisów Sample CV w trzech szablonach edytowalne w miejscu; punkt rozdzielony między strony
działa (Enter na dole strony przenosi kursor na kolejną); AC 5, 6 dla punktów i list; złote strony zielone.

**S3. Daty i usuwanie wpisów: żetony dat, popover daty, ⚠, „Usuń” w menu uchwytu** – zależy od: S2.
Zakres: `DateRange` z żetonami; `FieldPopover` + `DatePopover` (`MonthField`, „Obecnie tu pracuję”, „Wyczyść”,
`DateOrderWarning`); znaczek ⚠ w warstwie; „Usuń stanowisko/wykształcenie” w `BlockMenu` z „Usunięto. Cofnij”
(fokus po „Cofnij” w przywróconym wpisie); karty wpisów i list przestają się otwierać.
Kryteria: daty wszystkich wpisów zmieniane bez karty, z klawiatury (Enter, Escape wraca na żeton); odwrócone daty
oznaczone, opis dla czytnika ekranu; usunięcie i „Cofnij” jako jeden krok każde.

**S4. Nagłówek i klauzula: kontakty, zdjęcie, klauzula zgody** – zależy od: S1 (równolegle z S2–S3).
Zakres: `ContactLine` (etykieta, wartość, separator Classic), `ContactLabelSuggestions`, Enter/Backspace w kontaktach;
przycisk zdjęcia w warstwie + `PhotoPopover` (`usePhotoPicker` wydzielony z `PhotoField`, kadrowanie jak dziś);
klauzula jako Page field (rysowana przez `CvPages`) + `ConsentToolbar`.
Kryteria: po S3 i S4 żadna część strony nie otwiera Edit card; zdjęcie zmieniane i kadrowane z popovera; klauzula z
biblioteki, zapis jako nowa, przywrócenie, ukrycie z paska; AC 3 bez dodawania.

**S5. Puste części i dodawanie bez formularza** – zależy od: S3, S4.
Zakres: odsłanianie (`reveal`) z pigułek „+”, „Dodaj do CV”, podpowiedzi w pustym CV, „Dodaj …” w menu uchwytu i
Outline (z `reuseEmpty`); kursor w pierwszym polu z placeholderami; Outline: klik stawia kursor (nagłówek, sekcja,
klauzula, pusta sekcja), ukryta sekcja – fokus na „Pokaż” z opisem; pomiar „wejście we wpis z pustym polem”.
Kryteria: od „Nowe CV” do pełnego CV (wszystkie pola Sample CV) w Outline bez żadnej karty i bez CV form (e2e);
AC 8; Edit mode po wyjściu z pola ma podział Preview mode.

**S6. Koniec Edit card, klawiatura i dostępność całości** – zależy od: S5.
Zakres: usunięcie `EditCard.tsx`, przycisków fragmentów, mapowania kliknięć (`targetAt`, `contractHit`, `hitTarget`),
stanu karty w `useEditSession`; obrysy `pointer-events: none`; uchwyty i pigułki poza Tab; Shift+F10; komunikaty
`aria-live`; aktualizacja kroku 5 checklisty „Nowy szablon” i testu pól w trzech szablonach; przepisanie pozostałych
testów kart w `e2e/canvas.spec.ts`.
Kryteria: AC 3, 6, 9; `grep -r EditCard src` puste; cała edycja z samej klawiatury (e2e).

**S7. Pomiar, macierz ręczna i dokumentacja** – zależy od: S6.
Zakres: pomiar W23 (CPU ×1/×4, zbudowana aplikacja), checklista wydania (IME, VoiceOver, wklejanie, pisownia), wpis w
`CHANGELOG.md` (zastępuje opis Edit card), „Stan realizacji i odstępstwa” w tym specu, status ADR-0010.
Kryteria: AC 10, 11; wyniki pomiaru w opisie PR.

Kolejność: S1 → (S2 → S3) ∥ S4 → S5 → S6 → S7.

## Stan realizacji i odstępstwa

### S1 – fundament, imię i nazwisko, podsumowanie, tytuły sekcji (zrobione)

- **Złoty markup** zapisany przed pierwszą zmianą szablonów (`template/goldenMarkup.test.tsx`, wzorce w
  `template/__golden__/`): `renderToString` (nie `renderToStaticMarkup`), żeby wzorzec utrwalał też granice sąsiednich
  węzłów tekstowych; obok Sample CV `en`/`pl` dwa fixture'y przypadków brzegowych (drugi – nagłówek bez imienia
  i podsumowania – dopisany osobnym commitem, też na niezmienionych szablonach).
- **`reveal`** (`domain/blocks.ts`) to zbiór kluczy fragmentów warstwy edycji (`fullName`, `summary`,
  `sectionTitle:<id>`, dalej `item:<id>` itd.), nie id bloków. Tytuł sekcji bez wpisów na stronach nie jest odsłaniany
  (S5). Bez osobnego `canvas/reveal.ts`: odsłonięcie liczy `usePageEditing.ts` z aktywnego fragmentu
  i `fragmentHasEmptyField` (`canvas/pageFields.ts`, testy w `pageFields.test.ts`); aktywne pole i przywracanie kursora –
  `canvas/useActiveField.ts` (magazyn w sesji edycji, `session.activeField`).
- **Odstępstwo (W2, W5): `contenteditable="true"`, nie `plaintext-only`.** Ryzyko z „Ryzyk” się zmaterializowało:
  Chromium wymusza w edytowalnych elementach `plaintext-only` `white-space: pre-wrap` (nadpisuje każdy styl autora),
  więc nowe linie podsumowania w Classic i podwójne spacje wyglądałyby inaczej niż w PDF. Zamiast włączania edycji
  dopiero na fokus (zapasowe rozwiązanie z „Ryzyk” – tekst przeskakiwałby przy wejściu w pole, a kopia pomiarowa
  liczyłaby inny podział) pola są `contenteditable="true"` z `white-space`/`overflow-wrap`/`line-break: inherit`
  (`canvas/pageFields.css`), a czysty tekst pilnuje `canvas/PageField.tsx`: `beforeinput` przepuszcza tylko
  wpisywanie, poprawki pisowni, kompozycję i kasowanie (formatowanie, listy itd. – zablokowane), wklejanie i upuszczanie
  idą przez `paste`/`drop` (tylko `text/plain`), a element wstawiony mimo to przez przeglądarkę (np. `<br>`) jest
  spłaszczany do tekstu. Złote strony w Edit mode (W3.3) i test „ten sam podział linii podsumowania z nowymi liniami
  i podwójnymi spacjami” w `e2e/canvas.spec.ts` to sprawdzają.
- **Spacje:** w edytowalnym elemencie z `white-space: normal` przeglądarka pisze spację na końcu i spacje obok siebie
  jako twarde (U+00A0); do dokumentu trafiają jako zwykłe (`fieldValue` w `canvas/pageFieldInput.ts`). Twarda spacja
  między dwoma znakami zostaje (W6).
- **Wklejanie:** zdarzenie `paste` zamiast `beforeinput insertFromPaste` (w nim `dataTransfer` bywa pusty, a tekst
  przychodzi już przerobiony z HTML). Wklejanie wielu linii w punkty – S2.
- **Kursor:** zaznaczenie aktywnego pola jest zapamiętywane także przy `keydown`/`pointerup` i każdej zmianie, nie tylko
  na `selectionchange` (przychodzi za późno, gdy ⌘Z przemontowuje pole w tym samym zadaniu). `CvPages` woła
  `onPagesCommitted` tylko po renderze z podziałem stron policzonym z bieżących bloków.
- **Enter** w polu jednowierszowym przechodzi do następnego Page field (kursor na początku); w podsumowaniu Modern
  i Bold wstawia nową linię (W5, W11). Escape (wyjście na panel stron) i strzałki między polami – później (S2/S6).
- **Wejścia „otwierające” te części** (Outline „Nagłówek” i sekcja, „Add to CV” Imię i nazwisko/Podsumowanie, podpowiedź
  w pustym CV) przechodzą przez `session.openCard`, które dla Page fields stawia kursor w polu (`activeField.request`,
  pusta część odsłaniana) zamiast karty. Karta tytułu zostaje tylko dla sekcji, której nie ma na stronach (ukrytej albo
  pustej) – do S5 (W21: fokus na „Pokaż” / odsłonięcie pierwszego elementu).
- **Uchwyt tytułu sekcji** bez przycisku fragmentu pokazuje się przy najechaniu na Page field i przy jego fokusie
  (`data-hovered`/`data-focused`, `EditLayer.tsx`); „Ukryj sekcję” przenosi fokus na Page field następnego tytułu.
  Przycisk fragmentu listy obejmuje już tylko elementy (`li`), nie kolumnę tytułu obok listy (w Classic zasłaniał
  tytuł).
- **Powiększenie:** klik w „− / + / 100% / Dopasuj” nie zabiera fokusu (kursor zostaje w polu przy zmianie skali, AC 4).
- **Przełączanie trybu** nie montuje stron od nowa (to samo drzewo `PageFieldsProvider` → `CvPages` w obu trybach), więc
  przewinięcie i podział stron zostają.
- **ADR-0010** – opis Page field poprawiony (`contenteditable="true"` zamiast `plaintext-only`, powód jak wyżej).
- **Dostępność:** strony w Edit mode bez `aria-hidden`, stopki stron ukryte (`.cv-page-footer-frame`,
  `display: contents`). Nazwy Page fields to nazwy pól CV form („Full name”, „Summary”, „Section title “…””), więc testy
  e2e szukają pól formularza w `.editor-form` (zmienione lokatory w `export.spec.ts`, `languages.spec.ts`,
  `crash.spec.ts`, `updates.spec.ts`, `performance.spec.ts`; poza tym `export.spec.ts` bez zmian oprócz testu czytnika ekranu).
- **Nowe teksty:** żadnych – etykiety i placeholdery to istniejące teksty pól CV form („Full name”, „Summary”,
  `sectionTitle(…)`, nazwy typów sekcji).
- **Pomiar:** przebieg „Edit card” w `e2e/performance.spec.ts` zastąpiony przebiegiem „pages” (podsumowanie na
  pierwszej stronie i tytuł ostatniej sekcji na ostatniej – ostatnie stanowisko dostanie Page fields w S2).

### S2 – tekst wpisów i list (zrobione)

- **Sloty:** `CompanyLine`, `EducationLine` (wspólny markup Classic) i `EducationDetails` (Modern, Bold) w
  `template/editable.tsx`; stanowiska, punkty i elementy list przez `CvText` (`SlotName` +`role`, `company`,
  `location`, `bullet`, `level`, `field`, `institution`, `item`; `fieldOf(block, slot, part)` – `part` to id elementu
  wiersza listy). `EditableField` ma `value` (wartość pola z dokumentu – blok niesie tylko napisy złączone). Puste pole
  poza odsłoniętym fragmentem zostaje samym napisem (np. pusta rola w wierszu z datami w Modern) – placeholder tylko w
  aktywnym fragmencie. Złoty markup bez zmian (te same węzły tekstowe w trybie dokumentu).
- **Odstępstwo (W2, W9): linia złączona z kilku pól jest jednym napisem poza aktywnym wpisem.** Ryzyko „kształtowanie
  tekstu na granicy elementów” się zmaterializowało, ale inaczej niż przewidywano: każda granica elementu w środku linii
  zaokrągla położenie dalszego tekstu do 1/64 px (to samo w nieedytowalnej kopii pomiarowej – nie chodzi o
  `contenteditable`), więc „Demo Logistics Ltd – Leeds” i „Fictional Academy” różniły się w spoczynku o kilka pikseli od
  wzorców (złote strony w Edit mode). Dlatego `PageEditing.expanded` (aktywny fragment z liniami złączonymi – wpis,
  `fragmentHasJoinedFields`; odsłonięty zawsze) decyduje, czy `Joined` rysuje osobne pola z separatorami, czy
  `PageEditing.Joined` (`canvas/PageField.tsx`, `JoinedFields`): jeden `span` z napisem dokumentu, `tabindex="0"`,
  `role="textbox"`, `data-joined` (klucze i długości pól). Klik w taki napis (też w puste miejsce bloku obok, W9), Tab
  i strzałki do niego rozwijają wpis i stawiają kursor w polu pod klikniętym znakiem (`activateJoined` →
  `active.expect`, fokus po przerysowaniu). Wejście we wpis przerysowuje więc strony (bez ponownego podziału stron),
  wejście w nagłówek, tytuł czy listę – nie. To samo czeka kontakty w Classic („etykieta: wartość”, S4).
- **`reveal`:** `item:<id>` (stanowisko albo wykształcenie ma blok mimo pustych pól, stanowisko – wszystkie punkty, także
  puste) i `list:<id sekcji>` (wiersze ze wszystkimi elementami). Daty nie są jeszcze polami, więc pusta data nie
  odsłania wpisu (S3).
- **Mapa pól (`canvas/pageFields.ts`):** klucze = klucze łączenia CV form (`experience:<wpis>:role|company|location`,
  `experience:<wpis>:bullet:<punkt>`, `education:<wpis>:level|field|institution`, `list:<element>:text`; test czyta
  źródła pól formularza). `pageFieldTarget(key, document)` i `fieldChange` rozwiązują sekcję w dokumencie (klucze jej
  nie niosą). Nazwy pól: „<pole> – <część CV>” z istniejących tekstów (np. „Company – Position “Buyer””, „Bullet 3 –
  Position …”, „Item 2 – List “Languages””) – złączone separatorem „ – ” w kodzie, bez nowych tekstów w słownikach;
  placeholder – sama nazwa pola („City”, „Bullet 4”). Struktura z klawiatury jako czyste funkcje: `splitField`,
  `mergeBackward`, `mergeForward`, `pasteLines`, `moveField` (`FieldEdit` = zmiana + kursor po niej).
- **`documentEdits.ts`:** `mergeBulletIntoPrevious`, `mergeListItemIntoPrevious`, `pasteIntoBullet`, `pasteIntoListItem`
  (+ `textPaste`). Wklejenie wielu linii: pierwsza w miejsce zaznaczenia, kolejne jako nowe elementy, a tekst za
  zaznaczeniem – na końcu ostatniego (jak akapity w edytorze tekstu; spec tego nie rozstrzygał).
- **Klawiatura (W8, W11):** Enter/Backspace/Delete/wklejanie/⌥⇧↑↓ jak w W11; zmiana struktury to osobny krok cofania,
  a kursor stawia `active.expect` po nowym podziale stron (nowe pole powstaje dopiero z nowymi blokami – działa też, gdy
  nowy punkt przechodzi na kolejną stronę). Strzałki ←/→ na brzegu pola i ↑/↓ w pierwszej/ostatniej linii przechodzą do
  poprzedniego/następnego pola w kolejności DOM stron (także do linii złączonej i przez granicę stron); ↑/↓ zachowują
  położenie kursora w poziomie. ⌥⇧↑/↓ w polu wpisu przenosi cały wpis wśród wpisów na stronach (bez komunikatu
  `aria-live` – S6). **Shift+F10** / klawisz menu w polu „klika” uchwyt fragmentu (menu uchwytu; listy nie mają
  uchwytu). **Escape** nadal nic nie robi – S6.
- **Cofnięcie podziału** z kursorem w nowym punkcie: kursor na końcu poprzedniego pola fragmentu (W19; `previous`
  w `useActiveField.ts`). Utrata fokusu pola jest słuchana na dokumencie (`focusout` w `usePageEditing.ts`), a obsługi
  zdarzeń pól są podpinane w `useLayoutEffect`: pole usuwane ze strony traci fokus już po odpięciu swoich obsług,
  a nowe pole dostaje fokus z przywrócenia w tym samym commicie. `blurred` nie wyłącza aktywnego fragmentu, gdy fokus
  idzie do innego pola albo linii złączonej (inaczej wpis zwijałby się pod Tab).
- **Karty (przejściowo, W20):** karta listy nie otwiera się już ze stron (dodanie elementu z pigułki, menu, paska
  i Outline stawia kursor w odsłoniętym pustym elemencie); zostaje tylko dla sekcji ukrytej. Karta wpisu zostaje dla
  dat i nowego, pustego wpisu (S3, S5): przycisk fragmentu wpisu jest tylko dla klawiatury (`edit-fragment--keys`,
  `pointer-events: none`), a klik w `.cv-date` wpisu otwiera kartę (`usePointerOnPages` w `EditLayer.tsx`). Pigułka
  „+” sekcji pokazuje się przy najechaniu na jej treść na stronie (`useSectionHoverOnPages`).
- **Testy:** Vitest – `blocks.test.ts` (odsłonięte wpisy i listy), `documentEdits.test.ts`, `editable.test.tsx` (pola,
  separatory, placeholdery, linia złączona), `pageFields.test.ts` (mapa, klucze = klucze formularza, struktura),
  `pageFieldInput.test.ts` (`pastedLines`). e2e (`canvas.spec.ts`): pisanie we wpisach i listach (strona, formularz,
  PDF, ⌘Z jak w formularzu), Enter/Backspace/Delete/⌥⇧↑ w punktach, Enter na dole strony (kursor na kolejnej stronie),
  listy i wklejanie wielu linii, strzałki (też przez granicę stron i w linię złączoną), ⌥⇧↑ i Shift+F10 w polu wpisu,
  placeholdery w aktywnym wpisie i podział stron po wyjściu, Tab przez wszystkie pola Sample CV, test pól w trzech
  szablonach (następca testu kontraktu dla tekstu wpisów i list); testy kart wpisów otwierają je z dat albo klawiaturą,
  testy kart list zastąpione polami.
- **Pomiar** (`MOJE_CV_PERF=1`, build `out/`, przebieg „pages” pisze w punkcie 1 ostatniego stanowiska długiego CV):
  `cv:keystroke-to-preview` mediana 5,6 ms, p95 13,5 ms, max 16,8 ms (CPU ×1); mediana 24,6 ms, p95 32,7 ms, max
  35,1 ms (CPU ×4); bez długich zadań. CV form w tym samym przebiegu: mediana 12,1 ms, p95 24,7 ms.

#### Przekazanie dla S3–S7

- **S3 (daty):** `DateRange` jako slot z żetonami w miejsce `.cv-date` (w Classic `cv-date--dot` niesie kropkę osi).
  Po S3 usuń: `usePointerOnPages` – gałąź `.cv-date` (zostaje „najbliższe pole”), `edit-fragment--keys`, `keysOnly`
  w `FragmentButton`, `experienceItem`/`educationItem` w `cardKinds` (`EditCard.tsx`), kursor `.cv-date` w
  `pageFields.css`; `fragmentHasEmptyField` dla `item:` musi liczyć puste daty, jeśli żetony mają placeholdery.
  Napis dat leży poza liniami złączonymi, więc żetony nie potrzebują `expanded`; za to w Bold `.cv-date` jest rysowane
  tylko z niepustymi datami – w odsłoniętym wpisie trzeba go rysować zawsze. „Usuń stanowisko” w menu uchwytu – menu
  ma już `fragmentHandle` (Shift+F10) i `focusAfterChange`.
- **S4 (kontakty):** „etykieta: wartość” w Classic to linia złączona – użyj tego samego `Joined`/`expanded` (dodaj
  fragment `contacts` do `fragmentHasJoinedFields`); w Modern i Bold etykieta i wartość są w osobnych elementach, więc
  mogą być zwykłymi `CvText`. Klauzula (`.cv-consent`, rysuje `CvPages`) potrzebuje slotu poza `CvBlockView`.
- **S5 (dodawanie):** dodanie elementu listy już działa przez `reveal` (`openCard` → `pageFieldKey(listSection)` →
  `activeField.request`). Dla wpisów wystarczy, żeby `pageFieldKey` zwracał klucz roli/poziomu dla wpisu bez pola
  (dziś `null`, żeby karta zbierała daty) i żeby `onPages` (`useEditSession.ts`) przepuszczał nową pozycję.
  Odsłonięcie pustej sekcji bez elementów i tytuł obok pustej listy – nadal do zrobienia. Pomiar „wejście we wpis z
  pustym polem” – dodatkowo wejście we wpis przerysowuje strony (`expanded`).
- **S6:** Escape (wyjście na panel stron), komunikaty `aria-live` dla podziału/złączenia/przeniesienia z pola,
  uchwyty i pigułki poza Tab. Linia złączona jest w Tab jako `role="textbox"` z nazwą pól („Company – …, City – …”) –
  sprawdzić z VoiceOver. `targetAt`/`contractHit`/`hitTarget` są już używane tylko przez przyciski kontaktów, zdjęcia
  i klauzuli.
- **Pułapki:** `blurred` dostaje `relatedTarget` – nowe sposoby przenoszenia fokusu między polami (np. popover daty)
  muszą albo trafiać w pole, albo przez `active.expect`/`request`; zmiana aktywnego fragmentu potrafi przemontować pola
  linii złączonej pod kursorem. Nowe pola w szablonach: `fieldOf` musi znać slot, a test „Tab przez wszystkie pola”
  (`canvas.spec.ts`) pilnuje kolejności.

### S3 – daty i usuwanie wpisów (zrobione)

- **Slot `DateRange`** (`template/editable.tsx`) w `.cv-date` wspólnego markupu (Classic – z kropką osi `cv-date--dot`),
  Modern i Bold; sloty `start`/`end`, pola `experience|education:<wpis>:start|end` (= klucze łączenia `MonthField`
  w CV form, test czyta źródła pól). Napis daty – „MM.RRRR”, „present” w CV language (`dictionaryFor`), pusta data –
  pusty napis. Bold rysuje `.cv-date` także pusty, gdy wpis jest odsłonięty (`useShown(block, 'start', block.dates)`).
  Złoty markup i złote strony (też w Edit mode) bez zmian i bez nowych wzorców.
- **Odstępstwo (W12): poza rozwiniętym wpisem daty są jednym napisem, nie dwoma żetonami.** Przekazanie z S2 zakładało,
  że żetony nie potrzebują `expanded`, ale dwa żetony z „ – ” między nimi to granica elementów w środku linii (ta sama
  przesunięta o 1/64 px reszta linii co w liniach złączonych). Dlatego poza `expanded` `DateRange` rysuje
  `PageEditing.JoinedDates` (`canvas/DatePopover.tsx`, `.cv-page-dates`): jeden `span` z napisem dokumentu,
  `role="button"`, `aria-haspopup="dialog"`, `data-joined` jak linia złączona. Klik w niego rozwija wpis i otwiera
  popover daty pod kliknięciem; Tab i strzałki rozwijają wpis i stawiają fokus na żetonie. W rozwiniętym wpisie –
  żetony `DateToken` (`.cv-page-date`, `role="button"`, `tabindex="0"`, `aria-expanded`, nazwa „<data> – <część>:
  <napis>”, placeholder „From”/„To” przez `::before` jak w polach).
- **Popover daty** (`DatePopover.tsx`; bez osobnego `FieldPopover.tsx` – jedyny Field popover, wspólną część wydzielić
  w S4): `MonthField` (ta sama reguła „niedokończony wpis zostaje w polu”), „I currently work here” tylko przy końcu
  stanowiska (zapamiętuje koniec sprzed zaznaczenia, jak CV form), „Clear”, `DateOrderWarning` przy odwróconych datach
  (`aria-describedby` pola miesiąca). `popover="manual"` w warstwie górnej, pozycja z `anchoredPosition` pod żetonem
  (bez miejsca – nad nim), liczona po każdym renderze, przewinięciu i zmianie okna; zawsze 1:1. Enter w polu miesiąca
  i Escape zamykają i wracają na żeton; klik poza popoverem i żetonem zamyka; Tab z ostatniej kontrolki zamyka i idzie
  do pola za żetonem, Shift+Tab z pierwszej – na żeton. Stan otwarcia – mały magazyn w sesji (`session.datePopover`,
  zamykany przy przejściu do Preview mode, przy usunięciu wpisu i gdy żetonu już nie ma). Fokus w popoverze nie
  dezaktywuje pola (`blurred` pomija cele w `[data-field-popover]`), więc wpis zostaje rozwinięty. Zmiana miesiąca –
  z kluczem pola (jak `MonthField` w formularzu), „present”/„Clear” – osobne kroki. Wygląd: panel jak menu wiersza
  (`.field-popover` w `app.css`, tokeny `--ui-panel-bg`, `--ui-border`, `--ui-shadow`).
- **Kursor po kliknięciu w napis dat:** `openDatesAt` używa nowego `active.activate` (pole aktywne bez oczekującego
  fokusu), nie `active.expect` – przywrócenie fokusu po nowym podziale stron (wejście we wpis z pustą datą go odsłania)
  zabierało fokus popoverowi. Popover bierze fokus, gdy żeton pojawi się na stronie (`mounted` w magazynie).
- **⚠ odwróconych dat** (`DateWarnings` w `EditLayer.tsx`): znaczek w warstwie obok napisu dat (po prawej, gdy daty
  kończą blok – Modern, Bold; inaczej po lewej – Classic), `pointer-events: none`, kolor `--ui-page-warning` (jedna
  wartość – kartka zawsze biała, ADR-0004); poniżej 50% bez znaczka. Opis (`endBeforeStart`, ukryty wizualnie)
  wskazują oba żetony wpisu (`aria-describedby`, `dateWarningId`) – także napis dat poza rozwiniętym wpisem.
- **Klawiatura:** żetony są w kolejności Tab i strzałek stron (Classic: daty przed stanowiskiem); Enter/spacja otwiera
  popover, ⌥⇧↑/↓ przenosi wpis, Shift+F10 – menu uchwytu. Wejście strzałką/Tab w napis dat stawia fokus na pierwszej
  niepustej dacie (wykształcenie bez początku: na dacie końca, odsłonięty pusty żeton początku jest przed nią).
- **`fragmentHasEmptyField('item:…')`** liczy puste daty, więc wpis bez daty (np. wykształcenie Sample CV bez daty
  początku, każdy nowy wpis) jest odsłaniany przy wejściu – to kosztuje ponowny podział stron (W23; pomiar w S5/S7).
- **Usuwanie (W21):** „Remove position” / „Remove education” na końcu menu uchwytu wpisu, za kreską, w stylu `danger`
  (`RowMenuAction.danger`, `role="separator"`), z „Removed. Undo” (`useRemovalUndo`). Fokus po usunięciu – na pierwszym
  polu tekstu następnego fragmentu (`neighbourAfterHiding`, jak „Ukryj sekcję”), a bez niego `onFocusLost`; „Undo”
  stawia kursor na końcu pierwszego pola przywróconego wpisu (`activeField.request` – stanowisko/poziom, pusty
  odsłaniany). Usunięcie i przywrócenie to po jednym kroku cofania. Otwarte pytanie 2 (odstępstwo od #111) nadal do
  potwierdzenia przez właściciela.
- **Karty:** wpisy nie mają już przycisków fragmentów ani kart ze stron (`cardKinds`: zdjęcie, kontakty, klauzula;
  usunięte `edit-fragment--keys`, `keysOnly`, `pageFieldKinds` i gałąź karty w `usePointerOnPages` – klik w `.cv-date`
  obok żetonu otwiera teraz popover najbliższej daty, więc kursor `pointer` na `.cv-date` zostaje). Karta wpisu otwiera
  się tylko dla nowego, pustego wpisu (do S5) i stoi przy pierwszym polu tekstu jego fragmentu (`onPage` w
  `EditLayer.tsx`); Escape wraca tam (wpis z pustymi polami jest wtedy odsłonięty). `pageFieldKey` zwraca klucz daty dla
  celu z `field: 'start' | 'end'`.
- **Pigułki „+”** nie zabierają fokusu na `mousedown`: utrata fokusu pola chowała placeholdery odsłoniętego wpisu nad
  pigułką, strony się przesuwały i klik nie trafiał (po S3 częstsze – puste daty odsłaniają wpis).
- **Nowe teksty:** tylko „Clear” (`editor.clearDate`) w 16 słownikach; reszta to teksty CV form („From”, „To”, „From
  (optional)”, „Graduation date”, „I currently work here”, „Remove position/education”, ostrzeżenie o kolejności dat).
- **Testy:** Vitest – `pageFields.test.ts` (żetony dat: wartości w CV language, nazwy, `describedBy`, `dateChange`,
  `entryDates`, `dateName`, puste daty w `fragmentHasEmptyField`, ⌥⇧↑ z żetonu), `editable.test.tsx` (napis dat poza
  rozwiniętym wpisem, żetony z separatorem, puste żetony z placeholderami także w Bold). e2e (`canvas.spec.ts`): nowy
  test dat (klik w napis, popover przy żetonie, zmiana na stronie i w formularzu, Enter/Escape na żeton, spacja,
  „I currently work here”, ⚠ i opisy, „Clear” z placeholderem, napis po wyjściu, krok cofania na zmianę, wykształcenie
  bez początku, klik obok zamyka), nowy test usuwania z menu uchwytu; przepisane testy kart wpisów (karty zdjęcia,
  kontaktów i klauzuli zamiast kart wpisów; położenie wpisów przez `pageIndexOf`, kolejność przez `.cv-role`), Tab
  i strzałki przez żetony, test pól w trzech szablonach (przycisk dat w `.cv-date` każdego wpisu, popover z klikniętej
  daty).

#### Przekazanie dla S4–S7

- **S4:** wzór Field popover – `DatePopover.tsx` (magazyn otwarcia w sesji, `data-field-popover` dla `blurred`,
  `anchoredPosition`, zamykanie kliknięciem obok, Escape na pole); przy `PhotoPopover`/`ConsentToolbar` wydziel wspólny
  `FieldPopover`. Kontakty w Classic – `Joined`/`expanded` jak dotąd w przekazaniu S2.
- **S5:** jedyna karta wpisu to nowy, pusty wpis (`pageFieldKey` bez pola → null). Nowy wpis ma puste daty, więc po
  zmianie na klucz roli/poziomu `reveal` pokaże go od razu z żetonami-placeholderami. Pomiar „wejście we wpis z pustym
  polem” – dotyczy teraz też wpisów bez dat.
- **S6:** do usunięcia przy `EditCard.tsx`: `removeInCard` i `onPage`/`anchorElement` w `EditLayer.tsx`, `hasCard`.
  Escape z pola, komunikaty `aria-live` (usunięcie wpisu z menu ma tylko „Removed.”). Sprawdzić z VoiceOver: napis dat
  jako przycisk z nazwą obu dat, żetony w kolejności strzałek (może lepiej, żeby strzałki je pomijały – decyzja z
  VoiceOver).
- **Pułapki:** fokus do popovera nie przez `active.expect` (przywrócenie po podziale stron go zabiera) – `activate`
  i fokus z popovera po zamontowaniu żetonu. Klik w kontrolkę warstwy przy aktywnym odsłoniętym wpisie przesuwa strony
  (chowa placeholdery) – kontrolki, które nie muszą brać fokusu, niech robią `preventDefault` na `mousedown` (pigułki,
  powiększenie).
- **Niestabilny test (sprzed S3):** „the handle of a section title shows on hover…” w `canvas.spec.ts` czasem nie
  otwiera menu Enterem po ⌥⇧↓ na końcu (na commicie S2 4 z 20 powtórzeń, po S3 podobnie) – do naprawy osobno.

### S4 – nagłówek i klauzula: kontakty, zdjęcie, klauzula zgody (zrobione)

- **Wspólny `FieldPopover`** (`canvas/FieldPopover.tsx`), wydzielony z `DatePopover.tsx`: pokazanie przy kotwicy na
  stronie (`anchor`, `anchored`), położenie z `anchoredPosition` po każdym renderze, przewinięciu i zmianie okna (nowa
  opcja `prefer: 'above'`), klik obok – `onClose(false)`, Escape – `onClose(true)`, Tab z ostatniej i Shift+Tab
  z pierwszej kontrolki – `onTabOut`, `focusOnShow`, `data-field-popover` (dla `blurred`); `focusAfter` – fokus na
  następnym elemencie za kotwicą. Popover daty, zdjęcia, podpowiedzi etykiet i pasek klauzuli to jego użycia.
- **Kontakty:** sloty `contactLabel` / `contactValue` (`part` – id kontaktu; `useShown(…, part)`). W Classic
  „etykieta: wartość” to `ContactLine` – linia złączona przez `Joined` (fragment `contacts` w
  `fragmentHasJoinedFields`), w Modern i Bold etykieta i wartość to zwykłe `CvText` (komponent `Contact` w szablonie).
  Złoty markup i złote strony (też w Edit mode) bez zmian. Klucze `contact:<id>:label|value` (= klucze łączenia CV
  form, test czyta źródła), fragment `contacts`; `reveal` `contacts` daje blok nagłówka ze wszystkimi kontaktami, także
  pustymi (`domain/blocks.ts`). `fragmentHasEmptyField('contacts')` – pusta etykieta albo wartość któregokolwiek
  kontaktu, więc wejście w kontakty z kontaktem bez etykiety kosztuje ponowny podział stron (W23). Nazwy pól – teksty
  CV form („Contact label 1”, „Contact value 1”), placeholdery „Label” / „Value”, bez sprawdzania pisowni (W24).
- **Klawiatura w kontaktach (W11):** Enter w niepustej wartości – nowy kontakt za bieżącym (`insertContactAfter`),
  kursor w jego etykiecie; w pustej wartości – nic (spec tego nie rozstrzygał; jak Enter w pustym punkcie). Enter
  w etykiecie – do wartości (pole jednowierszowe). Backspace na początku pustego kontaktu (etykieta i wartość puste) –
  usuwa go, kursor na końcu poprzedniej wartości; pierwszy kontakt zostaje (jak pierwszy punkt). Każde to osobny krok
  cofania (`splitField`, `mergeBackward`, `splitsOnEnter` w `pageFields.ts`).
- **Podpowiedzi etykiet** (`ContactLabelSuggestions.tsx`, W14): pole etykiety to `role="combobox"`
  z `aria-autocomplete="list"` i `aria-controls`; lista `role="listbox"` w Field popover pod polem, dopóki pole ma
  fokus. Filtr – etykiety z `defaultContent.contactLabels` (jak `datalist` w CV form) zaczynające się od wpisanego
  tekstu, bez wielkości liter, bez etykiety równej wpisanej (`labelSuggestions`). ↑/↓ wybierają
  (`aria-activedescendant`), Enter wstawia (osobny krok cofania), klik wstawia bez zabierania fokusu polu, Escape
  i klik obok chowają listę do kolejnej zmiany tekstu; Enter bez wybranej podpowiedzi – do wartości. Klawisze łapie
  nasłuch w fazie przechwytywania (przed obsługą pola), a `aria-expanded` / `aria-activedescendant` pola ustawia lista
  – jedyna, która wie, czy jest otwarta.
- **Zdjęcie (W13):** przezroczysty przycisk „Photo” nad `img.cv-photo` w warstwie edycji (`.edit-photo`,
  `usePhotoEditing` w `PhotoPopover.tsx`, w kolejności fragmentów – czytania strony), a przy nim Field popover „Photo”:
  „Change photo”, „Crop photo” (ponowne kadrowanie zdjęcia z CV – kadruje zapisany już kadr) i „Remove photo” (styl
  `danger`, „Removed. Undo”; „Undo” stawia fokus na przycisku zdjęcia, gdy zdjęcie wróci na stronę). Wybór i kadrowanie
  – `usePhotoPicker` wydzielony z `PhotoField` (CV form, karta, popover); okno kadrowania zostaje modalnym `dialog`
  (w DOM popovera, więc klik w nim nie zamyka popovera, a Escape zamyka tylko okno). Fokus po kadrowaniu wraca na
  przycisk, który je otworzył – dopiero po zamknięciu okna (fokus poza otwartym modalnym oknem jest zablokowany). Bez
  nowych tekstów („Crop photo” to tytuł okna kadrowania).
- **Klauzula zgody (W15):** slot `ConsentText` w `template/editable.tsx` – poza `CvBlockView`, rysowany przez `CvPages`
  w kopii pomiarowej i na ostatniej stronie; `PageEditing.consentField` (null przy wyłączonej klauzuli). Pole
  `consent:text`, fragment `consent`, nazwa i placeholder „Consent clause”, wielowierszowe (`pre-line` we wszystkich
  szablonach). `reveal` `consent` – `CvPages` rysuje włączoną klauzulę mimo pustego tekstu (W10); bez niego –
  `consentText` jak dotąd.
- **Pasek klauzuli** (`ConsentToolbar.tsx`): Field popover `role="toolbar"` nad klauzulą (`prefer: 'above'`), bez
  zabierania fokusu, widoczny, dopóki aktywnym fragmentem jest klauzula (fokus w tekście albo w pasku).
  **Odstępstwo (W15):** „Clause from the library” to natywny `select` jak w CV form, nie menu „Z biblioteki ▾” – ten sam
  wybór, kontrolka znana czytnikowi ekranu, mniej kodu. „Restore from library” (gdy tekst różni się od klauzuli
  z biblioteki), „Save as new clause” (`SaveAsNewClause` z `ConsentFields` – pyta o nazwę w pasku) – po obu kursor wraca
  do tekstu (przycisk przywracania znika razem z różnicą i gubiłby fokus); „Hide clause” (`enabled: false`, fokus –
  `onFocusLost`). Tab z tekstu klauzuli wchodzi do paska, Shift+Tab z pierwszej kontrolki i Escape wracają do tekstu,
  Tab z ostatniej – dalej za klauzulą; klik obok chowa pasek (`active.blurred`). Nowy tekst: `editor.consent.hide`
  („Hide clause”) w 16 słownikach.
- **Karty:** żadna część strony nie otwiera już Edit card. Usunięte: przyciski fragmentów (`FragmentButton`, `onOpen`,
  `targetAt`, `contractHit`, Tab z przycisku do karty, `hasCard`), karty kontaktów i klauzuli, tekst `canvas.edit`
  („Edit: …”) z 16 słowników. Karta otwiera się jeszcze tylko dla: nowego, pustego wpisu, sekcji ukrytej albo pustej
  (Outline, dodawanie) i zdjęcia z „Add to CV”, gdy zdjęcia nie ma – wszystko to dodawanie (S5). `hitTarget`
  / `ContractHit` w `editTargets.ts` (z testami) nie mają już użyć – do usunięcia w S6.
- **Wejścia „otwierające” kontakty i klauzulę** stawiają kursor na stronie: „Add to CV: Contact” – w pierwszym pustym
  polu kontaktu (w nowym CV – w wartości pierwszego, bo etykiety są wypełnione), „Add to CV: Consent clause” – w jej
  odsłoniętym, pustym tekście, Outline „Consent clause” – w tekście, a przy wyłączonej klauzuli – fokus na przełączniku
  „Show on CV” (zamiast karty z „Pokaż”, jak W21 dla ukrytej sekcji). `useEditSession` dostał `current` (bieżący dokument
  edytora): część CV dodana tuż przed „otwarciem” (nowy kontakt, włączona klauzula) była szukana w dokumencie
  z ostatniego renderu i nie miała pola.
- **Poprawka do S1 (znaleziona przy klauzuli):** Enter na końcu pola wielowierszowego (klauzula, podsumowanie w Modern
  i Bold) – Chromium nie daje końcowej nowej linii własnej linii, więc pisanie trafiało przed nią. Na czas fokusu za
  końcową nową linią stoi pomocniczy `<br>` (poza tekstem pola – `textContent` go nie liczy; znika na `blur`;
  `textNodes` / `flatten` w `PageField.tsx`). Strony bez fokusu bez zmian.
- **Testy:** Vitest – `blocks.test.ts` (odsłonięte kontakty), `documentEdits.test.ts` (`insertContactAfter`),
  `editable.test.tsx` (kontakt w Classic jako linia złączona i jako pola z „: ”, w Modern i Bold osobne pola, odsłonięte
  puste z placeholderami; tekst klauzuli w `CvPages`, pusty tylko odsłonięty), `pageFields.test.ts` (pola kontaktów
  i klauzuli, klucze = klucze CV form, mapa w obie strony, `fragmentHasEmptyField`, Enter / Backspace w kontaktach),
  `ContactLabelSuggestions.test.ts`, `anchoredPosition.test.ts` (`prefer`). e2e (`canvas.spec.ts`) – nowe: kontakty na
  stronie, podpowiedzi etykiet, zdjęcie z popovera (zmiana, kadrowanie, ponowne kadrowanie, usunięcie i „Undo”, PDF),
  klauzula i jej pasek (pisanie i Enter, PDF, Tab / Shift+Tab, zapis jako nowa, przywrócenie, wybór z biblioteki,
  ukrycie, cofanie), pasek nad klauzulą przy podziale stron i skali, Enter na końcu podsumowania; przepisane: Tab przez
  kontakty i przycisk zdjęcia, test pól w trzech szablonach (kontakty, klauzula, przycisk zdjęcia), Preview mode i panel
  CV design zamykają popover, nowe CV i Outline bez kart kontaktów i klauzuli; `export.spec.ts` – test czytnika ekranu
  (linia kontaktu w Classic) i lokator etykiety kontaktu w formularzu; usunięty test „cards still open for the parts
  without page fields”.

#### Przekazanie dla S5–S7

- **S5:** karta zostaje tylko dla dodawania: nowy wpis (`pageFieldKey` bez pola → null), sekcja ukryta / pusta, zdjęcie
  z „Add to CV” (`CardFields` – `photo`). Dla zdjęcia W21 chce od razu wyboru pliku: `usePhotoPicker().pick()` z hosta
  zawsze zamontowanego w warstwie, a błąd wyboru – np. w Field popover przy przycisku paska. `useEditSession({ current })`
  rozwiązuje cel w bieżącym dokumencie, więc „otwarcie” tuż po `addExperienceItem` itp. znajdzie nowy element. „Add
  contact” w menu uchwytu nagłówka (W14) – nagłówek nie ma jeszcze uchwytu.
- **S6:** do usunięcia: `EditCard.tsx` (i `cardLabel`, `CardHeading`, `onPage` / `anchorElement` / `removeInCard`
  w `EditLayer.tsx`), `hitTarget` / `ContractHit` w `editTargets.ts`. Escape w polu (dziś nic) – Escape w etykiecie
  kontaktu z otwartą listą chowa listę (przechwytywanie przed polem), a w pasku klauzuli wraca do tekstu. `aria-live`:
  dodanie kontaktu Enterem i usunięcie Backspace'em są bez komunikatu. Sprawdzić z VoiceOver: etykieta kontaktu jako
  edytowalny `combobox`, pasek klauzuli (`toolbar` bez strzałek – Tab między kontrolkami), linia kontaktu w Classic jako
  jedno pole „Contact label 2, Contact value 2”.
- **Pułapki:** kontrolka popovera, która znika po kliknięciu (np. „Restore from library”), gubi fokus – oddawaj go polu.
  Fokus poza otwartym modalnym oknem – dopiero po jego zamknięciu. W e2e `pageField(name)` szuka `textbox`, a etykiety
  kontaktów to `combobox` (`labelField`); przycisk zdjęcia w warstwie i „Add to CV: Photo” mają tę samą nazwę
  (`photoButton` łączy klasę `.edit-photo` z rolą).

### S5 – puste części i dodawanie bez formularza (zrobione)

- **Nowy wpis bez karty:** `pageFieldKey` zwraca dla wpisu bez wskazanego pola klucz stanowiska / poziomu
  wykształcenia, a `onPages` (`useEditSession.ts`) przepuszcza każdy wpis w nieukrytej sekcji. „+” pod sekcją, „Add …”
  w menu uchwytu, „Add to CV” i Outline stawiają więc kursor w nowym, pustym wpisie odsłoniętym na stronie
  (`activeField.request` → `reveal` `item:<id>`, bo pusty wpis ma puste pola): placeholdery pól, pusty pierwszy punkt
  i żetony dat „From”/„To”. Wpis zostawiony pusty znika ze strony po wyjściu z niego (zostaje w danych i w Outline,
  jak dotąd), a strony dzielą się jak w Preview mode. Sekcja, która nie miała treści, pokazuje się z tytułem razem
  z odsłoniętym wpisem (`items.length > 0` w `blocks.ts`).
- **Cofnięcie dodania** z kursorem w nowym wpisie: pole znika, a fokus nie ma dokąd wrócić (wpis nie ma pola przed
  sobą) – `createActiveFieldStore({ onLost })` woła bezpieczne miejsce edytora (`focusSafePlace`, jak dotąd po
  zamknięciu karty; opcja sesji przemianowana z `onCardGone` na `onFocusLost`).
- **Outline (W21):** klik w pustą sekcję (bez treści na stronach) odsłania jej pierwszy element (`reuseEmpty`; bez
  elementów – dodaje go, jeden krok cofania) z kursorem w nim. **Odstępstwo – ukryta sekcja:** Outline nie miał
  przełącznika „Pokaż” dla sekcji (tylko „Hide section” w menu wiersza), więc wiersz ukrytej sekcji dostał przełącznik
  „Show on CV” pod nazwą (ten sam wygląd co przy klauzuli; nazwa dla czytnika `Show “<sekcja>” on CV`). Klik w wiersz
  ukrytej sekcji przenosi na niego fokus, a opis wiersza (`aria-describedby`, obok liczby elementów) to „Show the
  section on the CV to edit it”. Włączenie przełącznika pokazuje sekcję (jeden krok cofania) i od razu stawia kursor na
  końcu jej tytułu na stronie (pusta – w pierwszym elemencie). „Add …” w menu ukrytej sekcji dodaje element i przenosi
  fokus na ten przełącznik. Nowe teksty `editor.outline.showSection`, `editor.outline.showToEdit` w 16 słownikach.
- **Zdjęcie z „Add to CV” (W13):** od razu systemowy wybór pliku i okno kadrowania (`usePhotoEditing().add` w
  `PhotoPopover.tsx` – drugi `usePhotoPicker` w warstwie, zawsze zamontowany). Po „Apply” fokus na przycisku nowego
  zdjęcia na stronie, po „Cancel” – z powrotem na przycisku paska. Plik, którego nie da się wczytać: Field popover przy
  przycisku paska z komunikatem (`role="alert"`) i „Choose photo” (ponowny wybór); Escape wraca na przycisk paska.
- **Karty:** po S5 nic nie otwiera Edit card (`session.openCard` dla celu bez Page field – zdjęcie, tytuł ukrytej
  / pustej sekcji – nie ma już wywołań; gałąź `setCard` i `EditCard.tsx` do usunięcia w S6).
- **Odstępstwo – „Add contact” w menu uchwytu nagłówka (W14):** nie zrobione – nagłówek nie ma uchwytu (W21 nie daje mu
  innych pozycji menu). Kontakt dodaje Enter w wartości kontaktu (W11) i „Add to CV: Contact” (gdy żaden kontakt nie ma
  wartości); jeśli uchwyt nagłówka ma powstać – S6 razem z Shift+F10 w nagłówku.
- **Tytuł pustej sekcji:** tytuł sekcji, której nic nie ma na stronach, nie jest odsłaniany sam – klik w sekcję
  w Outline odsłania jej element, a z nim (gdy tytuł jest niepusty) tytuł, który wtedy jest zwykłym Page field. Pusty
  tytuł sekcji z treścią – klik w Outline odsłania go z placeholderem (jak w S1). Tytuł obok listy w Classic (W9) z pustym
  tytułem – tak samo jak w S1 (bez zmian).
- **Testy:** Vitest – `pageFields.test.ts` (klucz pierwszego pola wpisu bez pola). e2e (`canvas.spec.ts`) – nowe:
  „a full CV is built from a new CV in the Outline without any card and without the CV form” (AC S5: imię z podpowiedzi,
  zdjęcie z paska, kontakty z nowym kontaktem Enterem, podsumowanie, stanowisko z Outline – pola Enterem, daty
  z popovera z „I currently work here”, punkty, tytuł sekcji na stronie, drugie stanowisko pigułką, wykształcenie
  z Outline z datą ukończenia, listy z Outline i paska, klauzula; przez cały czas bez `.edit-card` i `.editor-form`;
  potem podział stron Edit = Preview i tekst PDF), „“Photo” in the “Add to CV” bar opens the file picker at once”;
  przepisane z kart na pola: Cmd+Z po dodaniu stanowiska (fokus w bezpieczne miejsce), „Add …” w menu uchwytu (także
  wykształcenie zostawione puste znika, podział stron bez zmian – AC 8), pigułka „+”, menu z klawiatury, Outline
  w nowym CV, ukryta sekcja w Outline (przełącznik, pokazanie z kursorem, „Add item” w ukrytej).
- **Wynik:** `pnpm typecheck`, Vitest 708/708, e2e 167 passed / 16 skipped (pomiar i testy wydania), złote strony
  (Preview i Edit mode) i złoty markup bez zmian wzorców.
- **Pomiar** (`e2e/performance.spec.ts`, nowy przebieg „entering an entry on the page”; w długim CV co drugie
  stanowisko jest bez miejscowości): klik w stanowisko → namalowana
  klatka z polem miejscowości (od czasu `mousedown`, kończy się zadaniem po malowaniu klatki, więc liczy około dwóch
  klatek). Build `out/`, M-series, 4 strony: wpis z pustym polem (odsłonięcie, nowy podział stron) mediana 31,6 ms,
  p95 32,4 ms, max 32,9 ms; wpis wypełniony (tylko rozwinięcie) 31,2 / 32,4 / 32,6 ms (CPU ×1); przy CPU ×4 – 31,9 /
  33,8 / 37,8 ms i 30,9 / 32,3 / 32,8 ms. Ponowny podział przy wejściu mieści się w tej samej klatce – próg 100 ms ma
  duży zapas. W tym samym przebiegu pisanie na stronach: mediana 16,4 ms, p95 19,1 ms (×1), 24,6 / 34,0 ms (×4); CV form
  22,8 / 26,5 ms (×1), 61,6 / 80,4 ms (×4, długie zadania) – pomiar orientacyjny (okno widoczne, inny moment niż w S2);
  na zbudowanej aplikacji – S7.

#### Przekazanie dla S6–S7

- **S6:** usunąć `EditCard.tsx` (z `cardLabel`, `CardHeading`), stan karty w `useEditSession` (`card`, `closeCard`,
  gałąź `setCard` w `openCard` – `openCard` zostaje jako „postaw kursor w części CV”, warto przemianować), w
  `EditLayer.tsx` `onPage` / `anchorElement` / `locate` / `removeInCard` / zamykanie karty kliknięciem, `added`
  (`useAddedAnchor` – kotwica kart; Outline i `AddControls` wołają już tylko `remember`), sprawdzanie `session.card`
  w `BlockMenu.tsx` i `Outline.tsx`, `hitTarget` / `ContractHit` w `editTargets.ts`, tekst `editor.card.*` tam, gdzie
  służy tylko karcie (nazwy pól używają `t.card.position` itd. – zostają). Escape w polu, `aria-live` dla dodania
  z pigułki / menu („Nowe stanowisko”), uchwyty i pigułki poza Tab. Ewentualny uchwyt nagłówka z „Add contact”.
- **S7:** pomiar W23 na zbudowanej aplikacji (oba przebiegi stron i nowy „entering an entry”, CPU ×1/×4), VoiceOver:
  przełącznik „Show on CV” ukrytej sekcji i opis wiersza, popover błędu zdjęcia przy pasku (`role="alert"`).
- **Pułapki:** przycisk, który znika po kliknięciu (przełącznik ukrytej sekcji, „Photo” w pasku po dodaniu zdjęcia),
  musi oddać fokus – tu kursor w pokazanej sekcji / przycisk zdjęcia. `addSectionElement` robi `editor.edit`, więc cel
  rozwiązuje się w bieżącym dokumencie (`current` w `useEditSession`, `editor.store.getState()` w Outline).

### S6 – koniec Edit card, klawiatura i dostępność (zrobione)

- **Edit card usunięta (W20, AC 3):** `canvas/EditCard.tsx` i jej style; stan karty w `useEditSession` – `openCard`
  zastąpione przez `focusPart(target)` („postaw kursor w części CV na stronie”, bez kotwicy); w `EditLayer.tsx`
  `onPage` / `anchorElement` / `locate` / `removeInCard`, przewijanie do kotwicy i zamykanie kliknięciem obok;
  `useAddedAnchor` (z przekazywaniem przez `CvScreen`, `EditorSidebar`, `Outline`, `BlockMenu`, `AddControls`
  i `data-outline-row`); sprawdzanie `session.card` w `BlockMenu`, `Outline`, `EditorSidebar`; `hitTarget`,
  `ContractHit` i `targetExists` w `editTargets.ts` (z testami); położenie `beside` w `anchoredPosition`; to, czego
  używała tylko karta: `inCard` (pola kontaktów, zdjęcia, klauzuli), `labelled` (`SectionTitleField`), wariant bez
  `handle` (pola stanowiska i wykształcenia), `data-edit-focus` i `focusKey` (`MonthField`), `RemovalFocus.root`,
  `onOpen` w `CvDesignButton`. Teksty `editor.card.close` i `editor.card.sectionTitle` usunięte z 16 słowników,
  a `editor.card` (nazwy wpisów i list w nazwach Page fields) to teraz `editor.part`. `grep -r EditCard src` – pusty.
- **Escape (W11):** w Page field, na żetonie daty i w linii złączonej przenosi fokus na panel stron (`main.preview`,
  `tabindex="-1"`, nazwa „CV pages” – nowy tekst `preview.pagesPanel`; obrys fokusu tylko z klawiatury): pole przestaje
  być aktywne (pusta część znika ze strony), strzałki przewijają strony. Otwarta lista podpowiedzi etykiety kontaktu
  bierze pierwszy Escape. **Odstępstwo:** pasek klauzuli to Field popover bez fokusu – Escape w tekście klauzuli od razu
  wychodzi na panel (pasek znika razem z aktywnym fragmentem), zamiast najpierw „zamknąć popover”; Escape w pasku
  wraca do tekstu (jak w S4).
- **Komunikaty `aria-live` (W22):** region i jego magazyn przeniesione z `BlockMenu` do sesji edycji
  (`canvas/announcer.tsx`: `createAnnouncer`, `LiveRegion` w warstwie), więc mówią przez niego i Page fields, i menu
  uchwytów. Enter / Backspace / Delete w punktach, elementach list i kontaktach („New bullet 4.”, „Joined with bullet
  3.”, „Removed bullet 4.”, „New contact 3.”, „Removed contact 3.”), ⌥⇧↑/↓ w polu i na żetonie („Moved bullet 3 to
  position 2 of 8.”, „Moved position “…” to position 1 of 4.” – te same teksty co menu wiersza). Teksty liczą czyste
  funkcje obok zmian struktury (`FieldEdit.announce`; `moveField` zwraca `{ change, announce }`); 8 nowych tekstów
  `editor.canvas.announce.*` w 16 słownikach. Wklejenie wielu linii mówi o ostatnim nowym elemencie (kursor stoi w nim).
  **Odstępstwo:** dodanie z pigułki „+”, menu uchwytu, paska „Add to CV” i Outline jest bez komunikatu – fokus trafia
  w nowe pole, którego nazwa już to mówi („Job title – Position “New position””), drugi komunikat byłby szumem;
  usunięcie wpisu z menu – „Removed.” (status), jak w S3.
- **Uchwyty i pigułki poza kolejnością Tab (W22):** `RowMenu tabbable={false}` na stronach, pigułki
  `tabindex="-1"` (dalej klikalne). Tab z ostatniego pola stron idzie do przycisku zdjęcia (zostaje w kolejności – jedyne
  wejście w zdjęcie z klawiatury) i paska „Add to CV”; podpowiedź pustego CV też zostaje. `focusAfter`
  (`FieldPopover.tsx`, Tab z ostatniej kontrolki popovera) pomija elementy z `tabindex="-1"`. `RowMenu` zapamiętuje
  `opener` – element z fokusem przed otwarciem menu, jeśli nie był nim uchwyt (Shift+F10 / klawisz menu w polu):
  Escape wraca do niego, a akcje dostają `{ opener }` – przeniesienie i „Nowa strona przed” z menu otwartego z pola
  zostawiają kursor w tym polu w tym samym miejscu (`active.expect`), także gdy fragment przechodzi na inną stronę.
  Menu uchwytu na stronie liczy się jak Field popover pola (`keepsFieldActive` → `data-field-popover`): Shift+F10
  z żetonu daty albo z pola linii złączonej nie zwija już wpisu (błąd znaleziony testem „tylko klawiatura”: pole,
  z którego otwarto menu, znikało, a Escape lądował na uchwycie); po zamknięciu menu bez powrotu fokusu do pola pole
  przestaje być aktywne (`onClosed`).
- **Uchwyt kontaktów (W14 – zrobione):** fragment `contacts` ma uchwyt (`handleFragments`) z jedną pozycją „Add
  contact” – nowy kontakt na końcu, kursor w jego etykiecie, jeden krok cofania; nazwa „Actions for contacts” (nowy
  tekst `editor.order.handle.contacts`). Shift+F10 w polu kontaktu otwiera to menu. W trzech szablonach stoi w marginesie
  przed `.cv-contact` (sprawdzone zrzutami); ⌥⇧↑/↓ na nim nic nie robi (kolejność kontaktów – tylko CV form, W14).
- **Obrysy:** nad tekstem nie ma już żadnych elementów warstwy (przycisków fragmentów nie ma od S4), obrys pola rysuje
  samo Page field (`pageFields.css`), więc wymaganie „obrysy `pointer-events: none`” jest spełnione bez zmian.
- **Kontrakt nowego szablonu:** krok 5 checklisty „Nowy szablon” (`domain/schema.ts`) i komentarz `BlockViewOverrides`
  (`templateDefinition.ts`) mówią: tekst każdego pola przez sloty `template/editable.tsx`, klasy kontraktu tylko dla
  warstwy, nowy szablon w teście pól i w złotym markupie. `editMarkupContract` bez `.cv-role`, `.cv-company`,
  `.cv-education-level` (służyły tylko mapowaniu kliknięć karty); `.cv-date` warstwa czyta przez kontrakt. Test pól
  w trzech szablonach przemianowany („page fields: every field of the Sample CV in the … template is edited on the
  page …”) i sprawdza też uchwyty kontaktów, tytułów i wpisów.
- **Dokumentacja:** `GLOSSARY.md` (Edit card – wycofana, kodu nie ma; Edit mode – Tab, Shift+F10, Escape),
  ADR-0009 (status), ADR-0010 (konsekwencje: mniejszy kontrakt klas, klawiatura i `aria-live`).
- **Testy:** Vitest – `pageFields.test.ts` (komunikaty po Enter / Backspace / Delete / ⌥⇧↑↓), `blockMoves.test.ts`
  (uchwyt kontaktów), `anchoredPosition.test.ts` (bez `beside`), `editTargets.test.ts` (bez `hitTarget`
  i `targetExists`). e2e (`canvas.spec.ts`) – nowe: „Escape leaves a page field, a date or a joined line for the pages
  panel …”, „a CV is edited with the keyboard alone …” (od podpowiedzi pustego CV: imię, kontakty z paska i Enterem,
  stanowisko z paska, pola Enterem i Tabem, punkty, popover daty z „I currently work here”, Shift+F10 na żetonie,
  Escape, ⌘Z – bez myszy i bez CV form); zmienione: Tab przez strony (po polach tylko zdjęcie i pasek; uchwyty
  i pigułki `tabindex="-1"`), menu z klawiatury (Shift+F10 i klawisz menu z tytułu, Escape wraca do pola z kursorem,
  przeniesienie z kursorem w polu, „Add education”, „Add contact”), Shift+F10 w polu wpisu, komunikaty w testach
  punktów, kontaktów i ⌥⇧↑ wpisu, Escape w podpowiedziach etykiet, pigułka „+” klikana myszą, test pól w trzech
  szablonach; usunięte pomocniki kart (`fragment`, `fragmentNames`, `card`, `expectCardNextTo`).
- **Wynik:** `pnpm typecheck`, Vitest 704/704, e2e 169 passed / 16 skipped (pomiar i testy wydania), złote strony (Preview i Edit mode) i złoty markup bez
  zmian wzorców.

#### Przekazanie dla S7

- **Checklista wydania** (`docs/release-checklist.md`) mówi jeszcze o Edit card (wiersze: usunięcie stanowiska „z Edit
  card”, Appearance „Edit card”, minimalne okno „Edit card przy wysokim wpisie”, pomiar „typing in the Edit card”) –
  przepisać na strony (menu uchwytu, Field popovers, przebiegi „pages” i „entering an entry” z `performance.spec.ts`).
  Dopisać do VoiceOver: panel „CV pages” po Escape, komunikaty `aria-live` (czy komunikat i nazwa nowego pola nie
  zagłuszają się po Enterze), Shift+F10 / klawisz menu i powrót Escape do pola, uchwyt kontaktów, linia złączona jako
  jeden `textbox` z nazwami pól, napis dat jako przycisk (zostały z S2–S5).
- **CHANGELOG** – wpis zastępujący opis Edit card (S7).
- **Pomiar W23:** ścieżka pisania bez zmian (komunikat tylko przy zmianie struktury); oba przebiegi stron i „entering an
  entry” na zbudowanej aplikacji – S7.
- **Pułapki:** nowe menu przy polach na stronie – `RowMenu` z `keepsFieldActive` i `onClosed`, inaczej pole, z którego
  je otwarto, przestaje być aktywne i może zniknąć (linia złączona, żeton). Nowe akcje menu uchwytu przyjmują
  `{ opener }` i – jeśli zostawiają fragment na stronie – wracają do pola przez `active.expect`, nie na uchwyt (jest
  poza Tab). Elementy poza kolejnością Tab muszą mieć `tabindex="-1"`, żeby `focusAfter` je pomijał.

## Ryzyka

- **Styl edytowalnego elementu w Chromium** może zmienić zawijanie (`overflow-wrap`, `line-break` dla edytowalnych
  hostów). Mitygacja: reset w `canvas/pageFields.css`; bramka 3 z W3 wykrywa to od S1. Gdyby szablon i tak różnił się w
  spoczynku – `contenteditable` włączane dopiero na fokus pola (kursor z `caretPositionFromPoint`), decyzja w S1.
- **Kształtowanie tekstu na granicy elementów** (kerning przy „: ” między etykietą a wartością w Classic). Bramka 3; w
  razie różnicy: separator wewnątrz pola etykiety w trybie edycji (bez zmiany trybu dokumentu).
- **Przywracanie kursora po przemontowaniu** w rzadkich przypadkach (blok usunięty i dodany w tej samej klatce). Test e2e
  na granicy stron; awaryjnie – kursor na koniec pola.

## Zgodność z ADR

- **ADR-0009** – częściowo zastąpiony przez ADR-0010: edycja tekstu w miejscu zamiast Edit card, placeholdery w aktywnym
  fragmencie, zmiany w kodzie szablonów (sloty) przy niezmienionym wyniku. Zostaje: warstwa edycji poza `.cv` dla
  kontrolek nietekstowych, ten sam podział stron w spoczynku, brak przeciągania po stronach.
- **ADR-0002** – bez zmian schematu. **ADR-0004** – kolory warstwy, popoverów i placeholderów z tokenów `app.css`
  (placeholder: stały neutralny szary na białej kartce). **ADR-0008** – DOCX bez zmian; `reveal` nigdy w main.
- **ADR-0001** – nowe teksty w 16 słownikach.

## Otwarte pytania (do właściciela)

1. **[do potwierdzenia]** Wklejenie wielu linii w punkt dzieli je na punkty (W6) – czy tak, czy zawsze jeden punkt?
2. **[do potwierdzenia]** „Usuń stanowisko/wykształcenie” w menu uchwytu (W21) – odstępstwo od reguły z #111.
3. **[do potwierdzenia]** Ostrzeżenia w pasku podglądu liczone z podziału Preview mode czy Edit mode (W10)?
4. Czy CV form zostaje na stałe (W20), skoro strony w Edit mode są dostępne dla czytnika ekranu?
5. Menu kontekstowe z podpowiedziami pisowni (W24) – osobny ticket?
