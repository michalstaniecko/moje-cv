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
| Błąd autozapisu z „Spróbuj ponownie” (#67): np. chmod 555 na folderze `cvs` w danych aplikacji, edycja, pasek błędu; po przywróceniu uprawnień „Spróbuj ponownie” zapisuje i pasek znika | [ ] | [ ] |
| Przy błędzie zapisu „← Biblioteka CV” pyta „Wyjść mimo to?”; „Zostań w edytorze” i Escape zostawiają edytor (#67) | [ ] | [ ] |
| Cmd+W i Cmd+Q tuż po wpisaniu zmiany: zmiana jest po ponownym otwarciu CV (#67) | [ ] | [ ] |
| Cmd+W i Cmd+Q przy błędzie zapisu: natywne pytanie „Zamknij / Zakończ mimo to” / „Wróć do edytora” w Interface language; „Wróć do edytora” zostawia okno i aplikację (#67) | [ ] | [ ] |
| „← Biblioteka CV” w edytorze i w bibliotece klauzul wraca do biblioteki CV (#69) | [ ] | [ ] |
| Sekcja „Projekt CV” (kolor, font, Template, CV language), a nie „Wygląd” (#69) | [ ] | [ ] |
| Zmiana nazwy CV w nagłówku edytora: kliknięcie nazwy, Enter albo kliknięcie obok zapisuje, Escape anuluje, pusta nazwa wraca do poprzedniej, ⌘Z cofa; nowa nazwa w bibliotece CV (#69) | [ ] | [ ] |
| „Nadal tu pracuję” ustawia na dokumencie i w PDF „obecnie” w CV language (#69) | [ ] | [ ] |
| Data „do” wcześniejsza niż „od” (doświadczenie i wykształcenie): ostrzeżenie pod datami, czytelne w jasnym i ciemnym wyglądzie; eksport nadal działa (#69) | [ ] | [ ] |
| Usunięcie stanowiska: „Usunięto.” z „Cofnij” na dole kolumny formularza (nie na podglądzie); „Cofnij” przywraca stanowisko z punktami; komunikat znika sam po ok. 8 s, ale nie pod kursorem ani z fokusem; VoiceOver ogłasza „Usunięto” (#69) | [ ] | [ ] |
| Duży CV (4+ strony, zdjęcie): podgląd nadąża za pisaniem, pisanie nie przycina się przy autozapisie (#72) | [ ] | [ ] |
| Pomiar wydajności na M1 (#72): `MOJE_CV_PERF=1 pnpm test:e2e:packaged e2e/performance.spec.ts`; mediana i p95 „keystroke → preview painted” < 100 ms, „cv:update total” < 100 ms, brak długich zadań ≥ 100 ms | — | [ ] |

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
| Pomoc: trzy pozycje w MAS, pięć w `.dmg` (z separatorem przed „Sprawdź aktualizacje…” i „Wesprzyj CV Press…”); każda otwiera właściwą stronę: pomoc `michalstaniecko.github.io/moje-cv/`, prywatność `…/privacy/`, zgłoszenie `github.com/michalstaniecko/moje-cv/issues/new/choose`, wsparcie GitHub Sponsors (#64) | [ ] | [ ] |
| Pomoc: systemowe pole wyszukiwania pozycji menu; po zmianie Interface language menu Pomoc od razu w nowym języku (#64) | [ ] | [ ] |

## Wersja

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| CV Press → „O aplikacji CV Press”: nazwa, wersja, numer buildu, „© 2026 Michal Staniecko” | [ ] | [ ] |
| Ta sama wersja w stopce biblioteki CV | [ ] | [ ] |
| Ta sama wersja w oknie „Więcej” Sponsor bara | — | [ ] |
| Numer buildu w panelu równy temu z App Store Connect | [ ] | — |
| Pasek o nowej wersji w bibliotece i dialog „Sprawdź aktualizacje…” (#78) | — | [ ] |

## Powiadomienie o nowej wersji (#78, ADR-0006)

Wymuszenie „nowszej wersji” w spakowanym `.dmg` bez publikowania wydania: w pustym katalogu zapisz plik `latest.json` z treścią `{"tag_name":"v99.0.0"}`, uruchom w nim `python3 -m http.server 8000`, a aplikację z terminala: `MOJE_CV_UPDATE_URL=http://127.0.0.1:8000/latest.json "/Applications/CV Press.app/Contents/MacOS/CV Press"`. Z tym adresem sprawdzenie przy starcie idzie od razu, ale limit 24 h nadal obowiązuje: żeby przy kolejnym starcie znów zapytać serwer, usuń pole `updateCheck` z `settings.json` (w `~/Library/Containers/com.michalstaniecko.mojecv/Data/Library/Application Support/Moje CV/`) albo użyj menu Pomoc. Wariant „masz najnowszą” to tag równy bieżącej wersji, a „nie udało się” to zatrzymany serwer.

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Przy nowszym wydaniu biblioteka CV pokazuje pasek „Dostępna jest nowa wersja CV Press 99.0.0.” z „Pobierz” i „Zamknij”; pasek nie zabiera fokusu i jest czytelny w jasnym i ciemnym wyglądzie | — | [ ] |
| „Pobierz” w pasku otwiera w przeglądarce stronę tego wydania (`github.com/michalstaniecko/moje-cv/releases/tag/v99.0.0`) | — | [ ] |
| „Zamknij” chowa pasek; po restarcie nie wraca, dopóki nie pojawi się kolejna wersja | — | [ ] |
| Pomoc → „Sprawdź aktualizacje…”: „Masz najnowszą wersję CV Press (…)” [OK] | — | [ ] |
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

## Ruch sieciowy

Sprawdź np. Little Snitch albo Monitorem aktywności.

| Sprawdź | MAS | DMG |
| --- | --- | --- |
| Brak jakiegokolwiek ruchu sieciowego (etykieta „Data Not Collected”) | [ ] | — |
| Wyłącznie zapytanie do `api.github.com` o najnowsze wydanie (#78, ADR-0006), nic poza nim | — | [ ] |
