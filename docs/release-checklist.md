# Checklista wydania (smoke test spakowanej aplikacji)

Ręczny test spakowanej aplikacji przed wysłaniem do review (#48). Przechodzi go człowiek osobno w obu kanałach:

- **MAS**: build Mac App Store (#44, `docs/wydanie-mac-app-store.md`), z TestFlight albo `mas-dev` na czystym koncie.
- **DMG**: notaryzowany `.dmg` (#43).

Każdy punkt odhacz w kolumnie kanału. „—” oznacza, że punkt nie dotyczy kanału.

> **Zasada:** każdy kolejny ticket specu „Gotowość UI/UX do wydania 1.0” (#77) dopisuje tu wiersze dla swojej funkcji. Pozycje dla funkcji jeszcze niewdrożonych są już na liście z numerem ticketu w nawiasie.

## Adresy do App Store Connect

Strona aplikacji na `ihumbak.website`. Te same adresy otwiera menu Pomoc (`src/shared/links.ts`). Strona jest tylko po angielsku, więc w lokalizacji PL wpisz te same adresy.

| Pole w App Store Connect | Adres (EN i PL) |
| --- | --- |
| Privacy Policy URL | `https://ihumbak.website/cv-drawer/privacy/` |
| Support URL | `https://ihumbak.website/cv-drawer/` |

Przed wysłaniem do review sprawdź, że obie strony otwierają się przez HTTPS i mają aktualną treść (polityka prywatności: brak ruchu sieciowego w MAS, sprawdzanie nowej wersji w `.dmg`).

## Wydanie `.dmg` (Developer ID, #43)

Build i dane uwierzytelniające: `docs/instalacja.md`. Kolejność:

1. `version` w `package.json` = wydawana wersja `X.Y.Z`; wpis w `CHANGELOG.md`.
2. `pnpm dist:mac` z certyfikatem Developer ID w pęku kluczy i zmiennymi `APPLE_*` → `dist/CV-Drawer-X.Y.Z.dmg`.
3. Automatyczne sprawdzenie pliku (bez uruchamiania aplikacji):
   `MOJE_CV_RELEASE_DMG=dist/CV-Drawer-X.Y.Z.dmg MOJE_CV_DIST_APP="dist/mac-universal/CV Drawer.app" pnpm exec playwright test e2e/release.spec.ts e2e/sandbox.spec.ts`
4. Smoke test z tej listy na czystym koncie macOS (albo innym Macu) z pliku pobranego przez przeglądarkę, czyli z kwarantanną.
5. GitHub Release w `michalstaniecko/moje-cv`: tag `vX.Y.Z` (równy `version`, bez przyrostków), tytuł `CV Drawer X.Y.Z`, notatki po angielsku z `docs/release-notes/X.Y.Z.md` (krótkie podsumowanie dla klienta na podstawie sekcji wersji w `CHANGELOG.md`, przejrzane w PR-ze), załącznik `CV-Drawer-X.Y.Z.dmg`; **opublikowany**, nie draft i nie pre-release (inaczej `/releases/latest` go nie zwróci, ADR-0006).
   Tagi `v*` tworzy tylko admin (ruleset). Tag na commicie z `main`, z którego zbudowano `.dmg`:

   ```sh
   git tag -a vX.Y.Z -m "CV Drawer X.Y.Z" && git push origin vX.Y.Z
   gh release create vX.Y.Z dist/CV-Drawer-X.Y.Z.dmg --verify-tag --title "CV Drawer X.Y.Z" --notes-file docs/release-notes/X.Y.Z.md
   gh api repos/michalstaniecko/moje-cv/releases/latest --jq .tag_name   # vX.Y.Z
   ```

   W dniu wydania wpisz datę w nagłówku wersji w `CHANGELOG.md` (`## [X.Y.Z] – RRRR-MM-DD`).

| Sprawdź | DMG |
| --- | --- |
| `pnpm dist:mac` bez certyfikatu albo bez zmiennych `APPLE_*` kończy się błędem z listą braków i nie tworzy `.dmg` | [ ] |
| Nazwa pliku `CV-Drawer-X.Y.Z.dmg`, wersja z `package.json` | [ ] |
| `xcrun stapler validate dist/CV-Drawer-X.Y.Z.dmg`: „The validate action worked!” | [ ] |
| `spctl --assess --type open --context context:primary-signature -vv dist/CV-Drawer-X.Y.Z.dmg`: „accepted”, „source=Notarized Developer ID” | [ ] |
| Aplikacja w `.dmg`: `spctl --assess --type execute -vv` „accepted”, „source=Notarized Developer ID”; `xcrun stapler validate` działa | [ ] |
| `codesign -dv --verbose=2` aplikacji: `Authority=Developer ID Application: … (8A9ZJPAGY8)`, `TeamIdentifier=8A9ZJPAGY8`, `flags=0x10000(runtime)` | [ ] |
| `lipo -archs "CV Drawer.app/Contents/MacOS/CV Drawer"`: `x86_64 arm64` | [ ] |
| `.dmg` pobrany przeglądarką na czystym Macu: otwiera się, a aplikacja z Aplikacji startuje bez ostrzeżenia Gatekeepera (najwyżej „pobrana z internetu… Otwórz”), bez „Otwórz mimo to” | [ ] |
| Aplikacja startuje też bez sieci (stempel w pakiecie) | [ ] |
| W Monitorze aktywności CV Drawer i procesy pomocnicze mają „Piaskownica: Tak”; grupa aplikacji `8A9ZJPAGY8.com.michalstaniecko.cvdrawer` działa pod Developer ID (aplikacja startuje, okno się otwiera; macOS 15+ nie pyta o dostęp do danych innych aplikacji) | [ ] |
| GitHub Release `vX.Y.Z` opublikowany z załącznikiem `CV-Drawer-X.Y.Z.dmg`; link „Pobierz” z powiadomienia o nowej wersji prowadzi do niego | [ ] |

## Instalacja i pierwsze uruchomienie

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Instalacja i pierwsze uruchomienie bez ostrzeżenia Gatekeepera | [ ] | [ ] |
| Ikona w Docku i w Finderze (#73) | [ ] | [ ] |
| Sample CV w Interface language systemu | [ ] | [ ] |

## Biblioteka CV

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Nowe CV | [ ] | [ ] |
| „Dodaj przykładowe CV” | [ ] | [ ] |
| Pusty stan biblioteki z „Dodaj przykładowe CV” (#70) | [ ] | [ ] |
| „Wczytywanie…” zamiast pustej listy przy starcie z dużą biblioteką (#70) | [ ] | [ ] |
| Duplikowanie | [ ] | [ ] |
| Zmiana nazwy | [ ] | [ ] |
| Tagi i filtr po tagach | [ ] | [ ] |
| Usuwanie z potwierdzeniem | [ ] | [ ] |
| Uszkodzony plik CV jest widoczny i da się go usunąć | [ ] | [ ] |
| Plik CV z nowszej wersji (`"schemaVersion": 99`) ma „Wymaga nowszej wersji CV Drawer”, nie da się go otworzyć, a usunięcie ma osobne potwierdzenie (#70) | [ ] | [ ] |
| Klawiatura: po zamknięciu zmiany nazwy, tagów i potwierdzenia usunięcia fokus wraca na przycisk wiersza; po usunięciu przechodzi na sąsiednie CV (#70) | [ ] | [ ] |

## Edytor CV

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Wszystkie sekcje da się wypełnić, podgląd się odświeża | [ ] | [ ] |
| Kolejność sekcji i pozycji: przeciąganie i strzałki | [ ] | [ ] |
| Przełączniki „nowa strona” | [ ] | [ ] |
| Kolor i font | [ ] | [ ] |
| Cofnij / Ponów z klawiatury (Cmd+Z, Shift+Cmd+Z) i z menu Edycja | [ ] | [ ] |
| Autozapis: zmiany są po ponownym otwarciu CV | [ ] | [ ] |
| Błąd autozapisu z „Spróbuj ponownie” (#67): np. chmod 555 na folderze `cvs` w danych aplikacji, edycja, pasek błędu; po przywróceniu uprawnień „Spróbuj ponownie” zapisuje i pasek znika | [ ] | [ ] |
| Przy błędzie zapisu „← Biblioteka CV” pyta „Wyjść mimo to?”; „Zostań w edytorze” i Escape zostawiają edytor (#67) | [ ] | [ ] |
| Cmd+W i Cmd+Q tuż po wpisaniu zmiany: zmiana jest po ponownym otwarciu CV (#67) | [ ] | [ ] |
| Cmd+W i Cmd+Q przy błędzie zapisu: natywne pytanie „Zamknij / Zakończ mimo to” / „Wróć do edytora” w Interface language; „Wróć do edytora” zostawia okno i aplikację (#67) | [ ] | [ ] |
| „← Biblioteka CV” w edytorze i w bibliotece klauzul wraca do biblioteki CV (#69) | [ ] | [ ] |
| Sekcja „Projekt CV” (kolor, font, Template, CV language), a nie „Wygląd” – w CV form i jako panel „Projekt CV” w pasku narzędzi (#69, #127) | [ ] | [ ] |
| Zmiana nazwy CV w nagłówku edytora: kliknięcie nazwy, Enter albo kliknięcie obok zapisuje, Escape anuluje, pusta nazwa wraca do poprzedniej, ⌘Z cofa; nowa nazwa w bibliotece CV (#69) | [ ] | [ ] |
| „Nadal tu pracuję” ustawia na dokumencie i w PDF „obecnie” w CV language (#69) | [ ] | [ ] |
| Data „do” wcześniejsza niż „od” (doświadczenie i wykształcenie): ostrzeżenie pod datami, czytelne w jasnym i ciemnym wyglądzie; eksport nadal działa (#69) | [ ] | [ ] |
| Usunięcie stanowiska (z CV form i z menu uchwytu wpisu na stronie – „Usuń stanowisko”): „Usunięto.” z „Cofnij” w lewym dolnym rogu panelu stron; „Cofnij” przywraca stanowisko z punktami (po usunięciu ze strony – z kursorem w jego stanowisku); komunikat znika sam po ok. 8 s, ale nie pod kursorem ani z fokusem; VoiceOver ogłasza „Usunięto” (#69) | [ ] | [ ] |
| VoiceOver na uchwycie ⠿ sekcji „Języki”: instrukcja przeciągania w Interface language; Spacja „Podniesiono sekcję „Języki””, strzałka „Przesuwasz…: pozycja 3 z 5”, Spacja „Upuszczono…”, Escape „Odłożono…”; nigdzie identyfikatora (#71) | [ ] | [ ] |
| VoiceOver w Preview mode nie czyta treści stron (imię, sekcje), a w Edit mode czyta je jako CV z polami tekstowymi (zob. „Edycja na stronach”); licznik stron, ostrzeżenie o długości i przyciski powiększenia są dostępne w obu trybach (#71) | [ ] | [ ] |
| CV dłuższe niż 2 strony: ostrzeżenie w pasku podglądu z ikoną ⚠ w kolorze ostrzeżenia (bursztynowy), czytelne w jasnym i ciemnym wyglądzie (#71) | [ ] | [ ] |
| Duży CV (4+ strony, zdjęcie): podgląd nadąża za pisaniem, pisanie nie przycina się przy autozapisie (#72) | [ ] | [ ] |
| Pomiar wydajności na M1 (#72): `MOJE_CV_PERF=1 pnpm test:e2e:packaged e2e/performance.spec.ts`; mediana i p95 „keystroke → preview painted” < 100 ms, „cv:update total” < 100 ms, brak długich zadań ≥ 100 ms | — | [ ] |

## Edycja na stronach (Edit mode / Preview mode, #122)

Eksperyment `experiment/inline-editing-redesign`: edycja WYSIWYG na stronach CV (`docs/specs/wysiwyg-editing.md`,
ADR-0010; wcześniej `docs/specs/inline-editing-redesign.md`). Tekst CV edytuje się w Page fields wprost na stronach,
wartości nietekstowe w Field popovers (data, zdjęcie, pasek klauzuli, podpowiedzi etykiet kontaktu); Edit card już nie
ma. Wymagają człowieka – e2e tego nie sprawdzą. Zrzuty do przeglądu (oba Appearance: Outline z kursorem w polu wpisu
i placeholderami, popover daty, pasek klauzuli, menu uchwytu wpisu, panel „Projekt CV”, pasek „Dodaj do CV”) można
wygenerować skryptem jak w T9 (#131) do `dist/` (nieśledzone).

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Jasny i Ciemny Appearance: obrys pola i fragmentu, kursor i zaznaczenie w polu, szare placeholdery pustych pól, żetony dat, znaczek ⚠ odwróconych dat, uchwyty fragmentów, pigułki „+”, pasek „Dodaj do CV”, podpowiedź pustego CV, Field popovers (data, zdjęcie, podpowiedzi etykiet, pasek klauzuli), menu uchwytów, komunikat „Usunięto. Cofnij”, Outline i szyna czytelne; kartki zostają białe, bez koloru interfejsu (ADR-0004) | [ ] | [ ] |
| Trzy szablony (Classic, Modern, Bold): w Edit mode bez kursora w polu strony wyglądają i dzielą się na strony jak w Preview mode i PDF; klik w tekst stawia kursor w klikniętym znaku; klik w linię złączoną („firma – miejscowość”, „poziom, kierunek, uczelnia”, w Classic „etykieta: wartość”) rozdziela ją na pola z kursorem we właściwym polu; obrys fragmentu dokładnie wokół treści; pigułki „+” w Classic pod ostatnim blokiem sekcji; w Modern uchwyty prawej kolumny w odstępie między kolumnami | [ ] | [ ] |
| IME: pisanie po polsku (⌥ + litera: ą, ę, ł, ż) i z klawiszem martwym (np. ⌥E, potem e → é) w punkcie, stanowisku i podsumowaniu; japoński (Kotoeri/Hiragana: „nihongo” → wybór kandydata spacją, Enter zatwierdza) – kompozycja się nie przerywa, podkreślenie kandydatów jest w polu, Enter zatwierdzający kandydata nie dzieli punktu ani nie przechodzi do następnego pola; po zatwierdzeniu ⌘Z cofa całe słowo | [ ] | [ ] |
| Wklejanie: z Worda i z Pages (pogrubienie, kursywa, lista punktowana) oraz ze strony WWW (np. profil LinkedIn, z linkami) do stanowiska, punktu i podsumowania – zostaje sam tekst w foncie szablonu, bez formatowania i niewidocznych znaków; kilka linii wklejonych do punktu lub elementu listy daje osobne punkty/elementy (puste linie pominięte) i jeden krok ⌘Z; do pola jednowierszowego – jedna linia ze spacjami; przeciągnięcie zaznaczonego tekstu działa jak wklejenie, upuszczenie pliku na stronę nic nie robi | [ ] | [ ] |
| Sprawdzanie pisowni macOS: literówka w punkcie, stanowisku, podsumowaniu i tytule sekcji jest podkreślona w Edit mode (słownik zgodny z CV language, np. polskie CV – polskie słowa bez podkreśleń), w imieniu, kontaktach i datach nie; w Preview mode i w PDF podkreśleń nie ma | [ ] | [ ] |
| 16 języków: placeholdery pól i nazwy dat („Od”, „Do”), popover daty („Nadal tu pracuję”, „Wyczyść”), popover zdjęcia, pasek klauzuli („Ukryj klauzulę”, „Klauzula z biblioteki”, „Zapisz jako nową klauzulę”), menu uchwytów („Usuń stanowisko/wykształcenie”, „Dodaj kontakt”), Outline („ukryta”/„pusta”, „Pokaż na CV”, przełącznik ukrytej sekcji), przełącznik „Outline \| Formularz” i pasek narzędzi się mieszczą; przegląd tłumaczeń nowych tekstów przez native speakerów (komunikaty `aria-live`, „Strony CV”, „Pokaż sekcję na CV, żeby ją edytować”; skrócone etykiety przełącznika trybu po rosyjsku, „← Mes CV” po francusku) | [ ] | [ ] |
| VoiceOver – czytanie stron: w Edit mode VO czyta CV w kolejności dokumentu, Page fields jako pola tekstowe z nazwą „<pole> – <część CV>” (np. „Firma – Stanowisko „Buyer””), placeholdery pustych pól jako podpowiedź; linia złączona poza aktywnym wpisem to jedno pole z nazwami pól („Firma – …, Miasto – …”), a napis dat – jeden przycisk z nazwą obu dat; żetony dat w rozwiniętym wpisie to przyciski „Od: 03.2021”; etykieta kontaktu to edytowalny combobox; w Preview mode strony ukryte | [ ] | [ ] |
| VoiceOver – klawiatura: Escape w polu przenosi na panel „Strony CV” (ogłoszony z nazwą), strzałki przewijają strony; po Enterze w punkcie i w wartości kontaktu komunikat („Nowy punkt 4.”, „Nowy kontakt 3.”) i nazwa nowego pola nie zagłuszają się nawzajem (oba słychać albo komunikat nie ucina nazwy); Backspace/Delete na brzegu punktu („Połączono z punktem 3.”), ⌥⇧↑/↓ w polu („Przeniesiono…”); Shift+F10 i klawisz menu w polu otwierają menu uchwytu jego fragmentu, Escape wraca do pola z kursorem w tym samym miejscu; uchwyt kontaktów ogłaszany jako „Działania: kontakty” z „Dodaj kontakt” | [ ] | [ ] |
| VoiceOver – Outline i popovers: klik w wiersz ukrytej sekcji przenosi na przełącznik „Pokaż „…” na CV” z opisem „Pokaż sekcję na CV, żeby ją edytować”; włączenie pokazuje sekcję z kursorem w jej tytule; popover daty jako okno dialogowe przy żetonie, Escape wraca na żeton; pasek klauzuli jako pasek narzędzi (Tab między kontrolkami); popover błędu zdjęcia przy „Dodaj do CV: Zdjęcie” (plik, którego nie da się wczytać) ogłaszany od razu (`role="alert"`), Escape wraca na przycisk; wiersze Outline z liczbą wpisów („4 elementy”); szyna jako „Pasek boczny” w rotorze punktów orientacyjnych | [ ] | [ ] |
| Panel „Projekt CV”: wybór koloru w systemowym próbniku kolorów nie zamyka panelu; Escape i klik obok zamykają, fokus wraca na przycisk | [ ] | [ ] |
| Minimalny rozmiar okna (960 × 640): Field popovers (data przy żetonie na dole strony – nad nim, pasek klauzuli nad klauzulą, zdjęcie, podpowiedzi etykiet), panel „Projekt CV” i menu uchwytów mieszczą się w oknie; kursor w polu przy dole panelu stron zostaje widoczny przy pisaniu i po przejściu wpisu na kolejną stronę; pasek narzędzi w jednej linii także z „Zmiany zapisane” (nazwa CV może się uciąć wielokropkiem) | [ ] | [ ] |
| Pisanie na stronach w dużym CV (4+ strony, zdjęcie) nadąża jak w CV form, także z kursorem w punkcie na ostatniej stronie; pomiar: `MOJE_CV_PERF=1 pnpm test:e2e:packaged e2e/performance.spec.ts` – przebiegi „typing in the pages” (keystroke → preview painted) i „entering an entry on the page” (klik → wpis z pustym polem odsłonięty i namalowany), mediana i p95 < 100 ms, brak długich zadań; wyniki z S7 w `docs/specs/wysiwyg-editing.md` (#131) | — | [ ] |

## Eksport do PDF

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Nazwa pliku | [ ] | [ ] |
| Nazwa pliku z transliteracją: Sample CV po ukraińsku `CV_Olena_Zrazkova.pdf`, po rosyjsku `CV_Anna_Obraztsova.pdf`; po usunięciu imienia i nazwiska nazwa z nazwy CV (#68) | [ ] | [ ] |
| „Otwórz” i „Pokaż w Finderze” w powiadomieniu pod paskiem narzędzi; × zamyka powiadomienie (#68) | [ ] | [ ] |
| Tekst w PDF da się zaznaczyć | [ ] | [ ] |
| Metadane PDF (tytuł, autor) | [ ] | [ ] |
| Liczba stron zgodna z podglądem | [ ] | [ ] |
| CV z za długim fragmentem (np. bardzo długie podsumowanie): eksport pyta „Eksportować mimo to?”; „Anuluj” i Escape nie otwierają okna zapisu, „Eksportuj mimo to” zapisuje PDF (#68) | [ ] | [ ] |
| W trakcie przygotowania PDF widać pasek postępu i „Przygotowywanie PDF…”; VoiceOver ogłasza postęp i wynik (#68) | [ ] | [ ] |

## Eksport do DOCX

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Przycisk „Eksportuj do DOCX” w pasku narzędzi i Plik → Eksportuj do DOCX… zapisują plik `CV_Imie_Nazwisko.docx` (#89) | [ ] | [ ] |
| Powiadomienie „Zapisano DOCX” z „Otwórz” i „Pokaż w Finderze” oraz uwagą o uproszczonym układzie; × zamyka powiadomienie (#89) | [ ] | [ ] |
| Fonty CV z `Contents/Resources/fonts` czytane w App Sandbox: eksport się udaje, w pliku są osadzone fonty (#93) | [ ] | [ ] |
| Plik otwarty w Wordzie na Windows bez zainstalowanego fontu CV pokazuje font CV (osadzony), nie zastępczy (#93) | [ ] | [ ] |
| Sample CV ma zdjęcie SVG, więc jego DOCX nie ma zdjęcia – to oczekiwane; zdjęcie wgrane z JPG/PNG jest w DOCX (#89) | [ ] | [ ] |
| Sprawdź DOCX export w edytorach: plik z tego wydania otwiera się bez ostrzeżeń i napraw w Word (M365), Pages, LibreOffice i Google Docs, a układ zgadza się z macierzą zgodności w `docs/research/editable-export-docx.md` (#94). Wystarczy raz na wydanie, w jednym kanale | — | [ ] |

## Eksport i import JSON

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Eksport CV do pliku `.json` | [ ] | [ ] |
| Import poprawnego pliku | [ ] | [ ] |
| Odrzucenie niepoprawnego pliku z komunikatem | [ ] | [ ] |

## Zdjęcie

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Wybór zdjęcia i kadrowanie | [ ] | [ ] |
| Kadrowanie z klawiatury: Tab do ramki (widoczny obrys fokusu), strzałki przesuwają zdjęcie, z Shift szybciej; okno się nie przewija (#71) | [ ] | [ ] |
| „Bez zdjęcia” | [ ] | [ ] |
| Za duży albo nieobsługiwany plik daje komunikat | [ ] | [ ] |

## Templates

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Każdy Template w podglądzie | [ ] | [ ] |
| Każdy Template w PDF | [ ] | [ ] |

## Biblioteka klauzul

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Dodanie, edycja, usunięcie klauzuli i klauzula domyślna | [ ] | [ ] |
| Klauzula w CV i w PDF | [ ] | [ ] |
| Escape w formularzu klauzuli zamyka go bez zapisu; po zamknięciu (Escape, Anuluj, Zapisz) fokus wraca na „Dodaj klauzulę” albo „Edytuj” (#71) | [ ] | [ ] |

## Interface language

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Przełączenie na kilka z 16 języków, w tym rosyjski lub ukraiński (cyrylica) i wietnamski | [ ] | [ ] |
| Wybrany język przetrwa restart | [ ] | [ ] |

## Appearance

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Jasny, Ciemny, System | [ ] | [ ] |
| Wybrany wygląd przetrwa restart | [ ] | [ ] |

## Sponsor bar

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Sponsor bar widoczny na dole okna | — (niewidoczny) | [ ] |
| Sponsor link otwiera GitHub Sponsors w przeglądarce | — | [ ] |
| Okno „Więcej” otwiera się i zamyka | — | [ ] |
| VoiceOver (rotor, punkty orientacyjne): belka to „Wsparcie CV Drawer”, nie „Sponsor” (#71) | — | [ ] |

## Menu aplikacji

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Menu: CV Drawer, Plik, Edycja, Widok, Okno, Language, Wygląd, Pomoc (#63, #64) | [ ] | [ ] |
| Plik: Nowe CV ⌘N, Dodaj przykładowe CV, Importuj… ⌘O w bibliotece CV i z edytora (powrót do biblioteki) (#63) | [ ] | [ ] |
| Plik: Eksportuj JSON… i Eksportuj do PDF… ⌘E w edytorze; w bibliotece CV wyszarzone (#63) | [ ] | [ ] |
| Plik: w bibliotece klauzul tworzenie i import wyszarzone; Zamknij okno ⌘W (#63) | [ ] | [ ] |
| Widok: „Podgląd” ⇧⌘P (z zaznaczeniem w Preview mode), aktywna tylko w edytorze CV; pełny ekran ⌃⌘F; w menu Widok tylko jedna pozycja pełnego ekranu (bez systemowego duplikatu) (#63, #123) | [ ] | [ ] |
| ⇧⌘P przełącza tryb dokładnie raz – w polu na stronie (Page field), w CV form i bez fokusu w polu (skrót obsługuje edytor, a pozycja menu dostaje tylko nieobsłużony klawisz); przytrzymanie nie przełącza w kółko; Widok → „Podgląd” myszą też przełącza (#123, #131) | [ ] | [ ] |
| CV Drawer → Usługi działa na zaznaczonym tekście; Okno → „Przenieś wszystko na wierzch” i lista okien (#63) | [ ] | [ ] |
| Pomoc: „Sprawdź aktualizacje…” (#78) i „Wesprzyj CV Drawer…” (#64) | — (brak obu pozycji) | [ ] |
| Pomoc: strona pomocy, polityka prywatności, zgłaszanie problemu otwierają przeglądarkę (#64) | [ ] | [ ] |
| Pomoc: trzy pozycje w MAS, pięć w `.dmg` (z separatorem przed „Sprawdź aktualizacje…” i „Wesprzyj CV Drawer…”); każda otwiera właściwą stronę: pomoc `ihumbak.website/cv-drawer/`, prywatność `…/privacy/`, zgłoszenie `github.com/michalstaniecko/moje-cv/issues/new/choose`, wsparcie GitHub Sponsors (#64) | [ ] | [ ] |
| Pomoc: systemowe pole wyszukiwania pozycji menu; po zmianie Interface language menu Pomoc od razu w nowym języku (#64) | [ ] | [ ] |

## Wersja

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| CV Drawer → „O aplikacji CV Drawer”: nazwa, wersja, numer buildu, „© 2026 Michal Staniecko” | [ ] | [ ] |
| Ta sama wersja w stopce biblioteki CV | [ ] | [ ] |
| Ta sama wersja w oknie „Więcej” Sponsor bara | — | [ ] |
| Numer buildu w panelu równy temu z App Store Connect | [ ] | — |
| `Info.plist` buildu MAS: `ITSAppUsesNonExemptEncryption` = false, `LSMinimumSystemVersion` 13.0, kategoria Productivity; `.pkg` przechodzi walidację w Transporterze (docs/wydanie-mac-app-store.md, #44) | [ ] | — |
| Pasek o nowej wersji w bibliotece i dialog „Sprawdź aktualizacje…” (#78) | — | [ ] |

## Powiadomienie o nowej wersji (#78, ADR-0006)

Wymuszenie „nowszej wersji” w spakowanym `.dmg` bez publikowania wydania: w pustym katalogu zapisz plik `latest.json` z treścią `{"tag_name":"v99.0.0"}`, uruchom w nim `python3 -m http.server 8000`, a aplikację z terminala: `MOJE_CV_UPDATE_URL=http://127.0.0.1:8000/latest.json "/Applications/CV Drawer.app/Contents/MacOS/CV Drawer"`. Z tym adresem sprawdzenie przy starcie idzie od razu, ale limit 24 h nadal obowiązuje: żeby przy kolejnym starcie znów zapytać serwer, usuń pole `updateCheck` z `settings.json` (w `~/Library/Containers/com.michalstaniecko.cvdrawer/Data/Library/Application Support/Moje CV/`) albo użyj menu Pomoc. Wariant „masz najnowszą” to tag równy bieżącej wersji, a „nie udało się” to zatrzymany serwer.

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Przy nowszym wydaniu biblioteka CV pokazuje pasek „Dostępna jest nowa wersja CV Drawer 99.0.0.” z „Pobierz” i „Zamknij”; pasek nie zabiera fokusu i jest czytelny w jasnym i ciemnym wyglądzie | — | [ ] |
| „Pobierz” w pasku otwiera w przeglądarce stronę tego wydania (`github.com/michalstaniecko/moje-cv/releases/tag/v99.0.0`) | — | [ ] |
| „Zamknij” chowa pasek; po restarcie nie wraca, dopóki nie pojawi się kolejna wersja | — | [ ] |
| Pomoc → „Sprawdź aktualizacje…”: „Masz najnowszą wersję CV Drawer (…)” [OK] | — | [ ] |
| Pomoc → „Sprawdź aktualizacje…”: „Dostępna jest nowa wersja…” [Pobierz] [Później]; „Pobierz” otwiera stronę wydania | — | [ ] |
| Pomoc → „Sprawdź aktualizacje…” bez sieci: „Nie udało się sprawdzić aktualizacji.” [Otwórz stronę wydań] [OK]; przycisk otwiera `…/releases/latest` | — | [ ] |
| Bez internetu przy starcie: żadnego komunikatu ani paska | — | [ ] |
| Pasek, pozycja menu i dialogi w nowym Interface language po przełączeniu | — | [ ] |
| Brak pozycji „Sprawdź aktualizacje…” i paska; brak jakiegokolwiek ruchu sieciowego w Little Snitch | [ ] | — |
| Entitlements `.dmg` mają `com.apple.security.network.client` (inaczej sprawdzanie zawsze milczy), a MAS go nie ma (#42, #43) | [ ] | [ ] |
| Wydanie opublikowane jako GitHub Release (nie draft, nie pre-release) z tagiem `vX.Y.Z` równym `version` w `package.json` (#74, #48) | — | [ ] |

## Awarie i okno

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Błąd renderera pokazuje ekran błędu z przeładowaniem (#65) | [ ] | [ ] |
| Zmień rozmiar i położenie okna, zamknij aplikację (⌘Q) i uruchom ponownie: okno wraca w tym samym miejscu i rozmiarze (#66) | [ ] | [ ] |
| Zmaksymalizuj okno (dwuklik w pasek tytułu albo ⌥ + zielony przycisk), zakończ i uruchom: okno znowu zmaksymalizowane (#66) | [ ] | [ ] |
| Z zewnętrznym monitorem: zostaw okno na monitorze, zakończ, odłącz monitor, uruchom: okno na ekranie laptopa (#66) | [ ] | [ ] |
| Okna nie da się zmniejszyć poniżej 960×640; w tym rozmiarze edytor i biblioteka się mieszczą, długa nazwa CV jest ucięta wielokropkiem (#66) | [ ] | [ ] |
| Zminimalizuj okno i uruchom aplikację drugi raz (`open -n` na pakiecie aplikacji): nie startuje druga kopia, okno wraca na wierzch (#66) | [ ] | [ ] |
| Przy działającej wersji DMG uruchom wersję z MAS (lub odwrotnie): druga nie startuje, bo kanały dzielą folder danych (#66) | [ ] | [ ] |

## Trwałość danych

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| CV, ustawienia, klauzule, język i wygląd po zamknięciu i ponownym uruchomieniu | [ ] | [ ] |
| Wspólna biblioteka MAS i `.dmg` na jednym Macu (ADR-0003) | [ ] | [ ] |

## Sandbox i migracja danych (#42, ADR-0003)

Migracja działa tylko raz, przy zakładaniu kontenera, więc sprawdzaj ją na **czystym koncie macOS** (nowy użytkownik w Ustawieniach systemowych → Użytkownicy i grupy), nigdy na swoim: na swoim koncie pierwsze uruchomienie przeniosłoby prawdziwe dane do kontenera.

1. Na czystym koncie zainstaluj wersję bez sandboksu (`.dmg` ad-hoc 0.3.0 albo dowolną do 0.6.0), dodaj 2–3 CV (jedno ze zdjęciem), klauzulę, zmień Interface language i Appearance, zakończ aplikację.
2. Sprawdź, że dane są w `~/Library/Application Support/Moje CV` (`cvs/`, `settings.json`) i że nie ma `~/Library/Containers/com.michalstaniecko.cvdrawer`.
3. Zainstaluj wersję z sandboksem i uruchom ją.

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Podpis: `codesign -d --entitlements - "/Applications/CV Drawer.app"` ma `app-sandbox`, `files.user-selected.read-write` i grupę `8A9ZJPAGY8.com.michalstaniecko.cvdrawer`, bez `temporary-exception` i bez `network.server`; `network.client` tylko w DMG | [ ] | [ ] |
| Pakiet ma `Contents/Resources/container-migration.plist` | [ ] | [ ] |
| Po pierwszym uruchomieniu wszystkie CV z kroku 1 są w bibliotece, ze zdjęciem; klauzula, Interface language i Appearance zachowane | [ ] | [ ] |
| Dane są teraz w `~/Library/Containers/com.michalstaniecko.cvdrawer/Data/Library/Application Support/Moje CV`, a w `~/Library/Application Support` nie ma już `Moje CV` | [ ] | [ ] |
| Monitor aktywności → kolumna „Piaskownica”: CV Drawer i jego procesy pomocnicze mają „Tak” | [ ] | [ ] |
| Eksport PDF do wybranego folderu (np. Biurko, Dokumenty), potem „Otwórz” i „Pokaż w Finderze” | [ ] | [ ] |
| Eksport JSON do wybranego folderu i import tego pliku | [ ] | [ ] |
| Wybór zdjęcia z dowolnego folderu (np. Obrazy, Pobrane) | [ ] | [ ] |
| Plan B: na drugim czystym koncie najpierw uruchom wersję z sandboksem (pusty kontener), potem starą; eksport CV do `.json` w starej i import w nowej działa (strona pomocy, `ihumbak.website/cv-drawer/`) | [ ] | [ ] |

## Ruch sieciowy

Sprawdź np. Little Snitch albo Monitorem aktywności.

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Brak jakiegokolwiek ruchu sieciowego (etykieta „Data Not Collected”) | [ ] | — |
| Wyłącznie zapytanie do `api.github.com` o najnowsze wydanie (#78, ADR-0006), nic poza nim | — | [ ] |
