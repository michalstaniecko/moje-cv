import type { SampleCvText } from '../sampleCv'

export const pl: SampleCvText = {
  name: 'Przykładowe CV',
  fullName: 'Anna Przykładowa',
  contacts: {
    phone: { label: 'Tel', value: '+48 600 000 000' },
    email: { label: 'E-mail', value: 'anna.przykladowa@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/anna-przykladowa' },
    city: { label: 'Miasto', value: 'Wrocław' }
  },
  summary: 'Specjalistka ds. zakupów z ponad dziesięcioletnim doświadczeniem w branży produkcyjnej i handlowej. Skutecznie negocjuję warunki współpracy, buduję trwałe relacje z dostawcami i dbam o ciągłość dostaw.',
  experience: {
    title: 'Doświadczenie zawodowe',
    positions: [
      {
        role: 'Starsza specjalistka ds. zakupów',
        company: 'Fikcyjna Produkcja Sp. z o.o.',
        location: 'Wrocław',
        bullets: [
          'Prowadzenie negocjacji cenowych i handlowych z dostawcami krajowymi i zagranicznymi.',
          'Zarządzanie portfelem ponad 60 dostawców komponentów i materiałów pomocniczych.',
          'Przygotowywanie i analiza zapytań ofertowych oraz porównań ofert.',
          'Wdrożenie kwartalnej oceny dostawców, która skróciła czas dostaw o 15%.',
          'Współpraca z działem jakości przy reklamacjach i audytach dostawców.',
          'Monitorowanie poziomów zapasów i planowanie zamówień we współpracy z produkcją.',
          'Raportowanie oszczędności zakupowych do zarządu.',
          'Wdrażanie nowych pracowników działu zakupów.'
        ]
      },
      {
        role: 'Specjalistka ds. zakupów',
        company: 'Przykładowy Handel S.A.',
        location: 'Poznań',
        bullets: [
          'Realizacja zamówień zgodnie z planem sprzedaży i budżetem działu.',
          'Wyszukiwanie i kwalifikacja nowych dostawców w Polsce i w Azji.',
          'Negocjowanie umów ramowych i warunków płatności.',
          'Kontrola terminowości dostaw i rozwiązywanie problemów logistycznych.',
          'Utrzymywanie danych podstawowych dostawców i materiałów w systemie ERP.',
          'Udział w projekcie zmiany systemu ERP jako kluczowa użytkowniczka.',
          'Przygotowywanie cotygodniowych raportów zakupowych.'
        ]
      },
      {
        role: 'Asystentka działu zakupów',
        company: 'Demo Logistyka Sp. z o.o.',
        location: 'Poznań',
        bullets: [
          'Wystawianie zamówień zakupowych i kontrola ich realizacji.',
          'Weryfikacja faktur i dokumentów dostaw.',
          'Prowadzenie korespondencji z dostawcami w języku polskim i angielskim.',
          'Archiwizacja dokumentacji zakupowej.',
          'Wsparcie zespołu przy inwentaryzacjach.'
        ]
      },
      {
        role: 'Młodsza specjalistka ds. obsługi klienta',
        company: 'Testowe Biuro Podróży',
        location: 'Poznań',
        bullets: [
          'Obsługa klientów telefonicznie, mailowo i w biurze.',
          'Przygotowywanie ofert i rezerwacji wyjazdów.',
          'Rozpatrywanie reklamacji.',
          'Współpraca z kontrahentami zagranicznymi.'
        ]
      }
    ]
  },
  education: {
    title: 'Wykształcenie',
    entries: [
      { level: 'Studia podyplomowe', field: 'Menedżer zakupów', institution: 'Uniwersytet Przykładowy' },
      { level: 'Studia magisterskie', field: 'Logistyka', institution: 'Akademia Fikcyjna' }
    ]
  },
  skills: {
    title: 'Umiejętności',
    items: [
      'Negocjacje handlowe',
      'Analiza ofert i kosztów zakupu',
      'Systemy ERP (SAP, Comarch)',
      'MS Excel – tabele przestawne, formuły',
      'Prawo jazdy kat. B'
    ]
  },
  languages: {
    title: 'Języki',
    items: ['Angielski – C1', 'Niemiecki – A2']
  },
  hobby: {
    title: 'Zainteresowania',
    text: 'Ta sekcja jest ukryta i nie pojawia się w CV.'
  },
  consent: 'Wyrażam zgodę na przetwarzanie moich danych osobowych przez Przykładową Firmę Rekrutacyjną Sp. z o.o. w celu prowadzenia obecnego procesu rekrutacyjnego, zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO).'
}
