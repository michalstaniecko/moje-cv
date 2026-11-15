# Outline zamiast CV form – ustawienia i możliwości, których brakuje bez formularza

Status: przyjęta 2026-11-15 (grillowanie samodzielne na prośbę właściciela). Zastępuje decyzję #4 z
`docs/specs/wysiwyg-editing.md` („CV form zostaje na stałe”) – zob. ADR-0011.

## Cel

Właściciel chce docelowo usunąć zakładkę Form (CV form) z panelu bocznego. Zanim to nastąpi, wszystko, co dziś da się
zrobić tylko w formularzu, musi być osiągalne z Outline, ze stron w Edit mode albo z paska narzędzi. Ta specyfikacja
spisuje inwentaryzację, decyzje i podział pracy na tickety.

## Inwentaryzacja (stan na `experiment/inline-editing-redesign`, 2026-11-15)

| Możliwość | CV form | Bez formularza | Luka? |
|---|---|---|---|
| Kolor akcentu, font, Template, CV language (CV design) | `CvDesignFields` | Ten sam komponent w popoverze „CV design” na pasku narzędzi (`editor/CvDesignButton.tsx`), w Edit i Preview mode | Nie |
| Imię i nazwisko, podsumowanie, kontakty (tekst) | pola | Page fields | Nie |
| Dodanie zdjęcia, zmiana, przycięcie, usunięcie | `PhotoField` | Pasek „Add to CV: Photo”, Field popover zdjęcia | Nie |
| **Wyłączenie zdjęcia bez kasowania i ponowne włączenie** | brak (także w formularzu) | brak – „Usuń” kasuje obraz; powrót tylko przez Cofnij albo ponowny wybór pliku | **Tak (T1)** |
| Dodanie kontaktu | przycisk | Enter w wartości, menu uchwytu kontaktów, „Add to CV” | Nie |
| **Usunięcie kontaktu** | przycisk ✕ | tylko Backspace w pustym kontakcie (niewidoczne) | **Tak (T2)** |
| Kolejność kontaktów | brak | ⌥⇧↑/↓ | Częściowo (T3) |
| Tytuł, kolejność, ukrycie sekcji, „nowa strona przed” | pola, przeciąganie | Outline, menu uchwytu sekcji, Page field tytułu | Nie |
| Treść ukrytej sekcji | edytowalna | dopiero po „Pokaż w CV” w Outline | Akceptowane (D4) |
| Wpisy: dodanie, treść, daty, „obecnie”, nowa strona przed, usunięcie, kolejność | pola, przeciąganie | Page fields, Field popover daty, menu uchwytu wpisu, ⌥⇧↑/↓ | Nie |
| **Kolejność punktów i elementów listy** | przeciąganie i menu wiersza | tylko ⌥⇧↑/↓ (bez widocznej kontrolki) | **Tak (T3)** |
| Klauzula zgody: włączenie, wybór z biblioteki, tekst, przywrócenie, zapis jako nowa | pola | Outline (przełącznik), pasek klauzuli, Page field | Nie |
| Rozmiar fontu, gęstość, marginesy, format daty, rozmiar strony | brak | brak | Poza zakresem – nie istnieją nigdzie |

## Decyzje

**D1. Formularz zostanie usunięty, ale dopiero gdy luki T1–T3 są zamknięte.** Samo usunięcie (T4) to osobny,
ostatni ticket: przepisanie ok. 190 testów e2e, które dziś przełączają się na formularz, i sprzątanie (`editorSidebar:
'form'`, `formWidth`, `PaneSeparator`, przełącznik w stopce panelu, ikona Form w wąskim pasku). Zapis: ADR-0011.

**D2. Zdjęcie dostaje stan „ukryte”, który zachowuje obraz.** `header.photo` to `{ dataUrl, hidden }`
(`CV_SCHEMA_VERSION` 7, migracja 6 → 7 dopisuje `hidden: false`). Ukryte zdjęcie zachowuje się jak ukryta sekcja:
- nie ma go na stronach w Edit i Preview mode, w PDF ani w DOCX (jedno miejsce: `headerBlocks` w `domain/blocks.ts`);
- nie pojawia się w „Add to CV” (tam trafia tylko brak zdjęcia), tylko w Outline;
- Outline ma wiersz **„Photo”** pod „Header”, w tym samym wzorcu co klauzula zgody: przycisk wiersza i przełącznik
  „Show on CV”. Bez zdjęcia przycisk otwiera wybór pliku (ten sam przepływ co „Add to CV: Photo”), a przełącznika nie
  ma; ze zdjęciem widocznym przycisk przenosi fokus na zdjęcie na stronie; ze zdjęciem ukrytym wiersz ma znacznik
  „hidden”, a przycisk włącza je z powrotem;
- Field popover zdjęcia na stronie dostaje „Hide” obok „Change”, „Crop” i „Remove”; „Remove” nadal kasuje obraz (z
  „Removed. Undo”);
- przełączenie to jeden krok cofania; komunikat dla czytnika ekranu jak przy ukrywaniu sekcji.

Odrzucone: zapamiętywanie ostatnio usuniętego zdjęcia poza dokumentem (niewidoczny stan, ginie po zamknięciu CV).

**D3. CV design zostaje na pasku narzędzi, nie wchodzi do Outline.** Kolor, font, Template i CV language są już
osiągalne bez formularza (Q18 z `docs/specs/inline-editing-redesign.md`): popover działa w obu trybach, a Outline
istnieje tylko w Edit mode. Duplikat w Outline dałby dwa miejsca dla tych samych ustawień. Ustawień, których nie ma
nigdzie (rozmiar fontu, gęstość, marginesy, format daty, rozmiar strony), ta praca nie dodaje.

**D4. Treść ukrytej sekcji edytuje się po jej pokazaniu.** Bez formularza: „Show on CV” w Outline, edycja na stronie,
ewentualnie ponowne ukrycie. Wymaga dwóch kliknięć więcej, ale nie wprowadza drugiego sposobu wyświetlania treści.
Bez ticketu.

**D5. Kontakt usuwa się z menu uchwytu kontaktów.** Menu ma „Add contact”, a pod separatorem po jednej pozycji
`danger` na kontakt: „Remove contact: <etykieta>” (bez etykiety: wartość, bez obu: „contact N”), z „Removed. Undo”.
Fokus po usunięciu: następny kontakt, a gdy go nie ma – poprzedni, a gdy nie ma żadnego – uchwyt menu. Nieaktualny
komentarz w `canvas/BlockMenu.tsx` („kolejność kontaktów zmienia się tylko w CV form”) do poprawy.

Odrzucone: przycisk ✕ przy każdym kontakcie na stronie (nowa kontrolka w treści strony, łatwo kliknąć przypadkiem).

**D6. Przenoszenie punktów, elementów listy i kontaktów musi mieć widoczną drogę.** Dziś jest tylko skrót ⌥⇧↑/↓.
Zalecane: menu kontekstowe Page field (prawy przycisk myszy i Shift+F10 w polu) z „Move up” / „Move down”
(z podpowiedzią skrótu) dla punktu, elementu listy i kontaktu. Przeciągania na stronie nie dodajemy. Ticket T3.

**D7. Dostępność po usunięciu formularza.** Liniową drogą edycji stają się Outline i Page fields w kolejności
dokumentu (Tab). Przed T4 ręczna weryfikacja z VoiceOver (ticket T4, `ready-for-human`).

## Tickety

- **T1** (#132) – Ukrywanie zdjęcia bez kasowania (D2). `ready-for-agent`.
- **T2** (#133) – Usuwanie kontaktu z menu uchwytu kontaktów (D5). `ready-for-agent`.
- **T3** (#134) – Widoczne przenoszenie punktów, elementów listy i kontaktów (D6). `ready-for-agent`.
- **T4** (#135) – Usunięcie CV form (D1, D7), zależne od T1–T3. `ready-for-human` (weryfikacja z czytnikiem ekranu i decyzja
  o terminie).
