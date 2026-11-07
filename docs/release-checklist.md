# Checklista wydania (smoke test spakowanej aplikacji)

Ręczny test spakowanej aplikacji przed wysłaniem do review (#48). Przechodzi go człowiek osobno w obu kanałach:

- **MAS**: build Mac App Store (#44), z TestFlight albo instalacja lokalna.
- **DMG**: notaryzowany `.dmg` (#43).

Każdy punkt odhacz w kolumnie kanału. „—” oznacza, że punkt nie dotyczy kanału.

> **Zasada:** każdy kolejny ticket specu „Gotowość UI/UX do wydania 1.0” (#77) dopisuje tu wiersze dla swojej funkcji. Pozycje dla funkcji jeszcze niewdrożonych są już na liście z numerem ticketu w nawiasie.

Wersja: ______ Build MAS: ______ Build DMG: ______ macOS: ______ Data: ______

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
| Plik CV z nowszej wersji (`"schemaVersion": 99`) ma „Wymaga nowszej wersji CV Press”, nie da się go otworzyć, a usunięcie ma osobne potwierdzenie (#70) | [ ] | [ ] |
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
| Błąd autozapisu z „Spróbuj ponownie” (#67) | [ ] | [ ] |
| Powrót do biblioteki (#69) | [ ] | [ ] |

## Eksport do PDF

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Nazwa pliku | [ ] | [ ] |
| „Otwórz” i „Pokaż w Finderze” | [ ] | [ ] |
| Tekst w PDF da się zaznaczyć | [ ] | [ ] |
| Metadane PDF (tytuł, autor) | [ ] | [ ] |
| Liczba stron zgodna z podglądem | [ ] | [ ] |
| Ostrzeżenie o uciętej treści i komunikat przekroczenia czasu (#68) | [ ] | [ ] |

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

## Menu aplikacji

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Menu: CV Press, Plik, Edycja, Widok, Okno, Language, Wygląd, Pomoc (#63, #64) | [ ] | [ ] |
| Plik: Nowe CV ⌘N, Dodaj przykładowe CV, Importuj… ⌘O w bibliotece CV i z edytora (powrót do biblioteki) (#63) | [ ] | [ ] |
| Plik: Eksportuj JSON… i Eksportuj do PDF… ⌘E w edytorze; w bibliotece CV wyszarzone (#63) | [ ] | [ ] |
| Plik: w bibliotece klauzul tworzenie i import wyszarzone; Zamknij okno ⌘W (#63) | [ ] | [ ] |
| Widok: pełny ekran ⌃⌘F; w menu Widok tylko jedna pozycja pełnego ekranu (bez systemowego duplikatu) (#63) | [ ] | [ ] |
| CV Press → Usługi działa na zaznaczonym tekście; Okno → „Przenieś wszystko na wierzch” i lista okien (#63) | [ ] | [ ] |
| Pomoc: „Sprawdź aktualizacje…” (#78) i „Wesprzyj CV Press…” (#64) | — (brak obu pozycji) | [ ] |
| Pomoc: strona pomocy, polityka prywatności, zgłaszanie problemu otwierają przeglądarkę (#64) | [ ] | [ ] |
| Pomoc: trzy pozycje w MAS, cztery w `.dmg` (z separatorem przed „Wesprzyj CV Press…”); każda otwiera właściwą stronę: pomoc `michalstaniecko.github.io/moje-cv/`, prywatność `…/privacy/`, zgłoszenie `github.com/michalstaniecko/moje-cv/issues/new/choose`, wsparcie GitHub Sponsors (#64) | [ ] | [ ] |
| Pomoc: systemowe pole wyszukiwania pozycji menu; po zmianie Interface language menu Pomoc od razu w nowym języku (#64) | [ ] | [ ] |

## Wersja

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| CV Press → „O aplikacji CV Press”: nazwa, wersja, numer buildu, „© 2026 Michal Staniecko” | [ ] | [ ] |
| Ta sama wersja w stopce biblioteki CV | [ ] | [ ] |
| Ta sama wersja w oknie „Więcej” Sponsor bara | — | [ ] |
| Numer buildu w panelu równy temu z App Store Connect | [ ] | — |
| Pasek o nowej wersji w bibliotece i dialog „Sprawdź aktualizacje…” (#78) | — | [ ] |

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

## Ruch sieciowy

Sprawdź np. Little Snitch albo Monitorem aktywności.

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Brak jakiegokolwiek ruchu sieciowego (etykieta „Data Not Collected”) | [ ] | — |
| Wyłącznie zapytanie do `api.github.com` o najnowsze wydanie (#78, ADR-0006), nic poza nim | — | [ ] |
