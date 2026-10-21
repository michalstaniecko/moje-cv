import { CV_SCHEMA_VERSION, cvDocumentSchema, defaultCvSettings } from './schema'

// Szara sylwetka w proporcjach 3:4 – zdjęcie zastępcze przykładowego CV.
const placeholderPhoto =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">' +
      '<rect width="300" height="400" fill="#d9e2e2"/>' +
      '<circle cx="150" cy="150" r="70" fill="#a7b8b8"/>' +
      '<path d="M30 400c0-90 54-150 120-150s120 60 120 150z" fill="#a7b8b8"/>' +
      '</svg>'
  )

const bullets = (prefix: string, texts: string[]) =>
  texts.map((text, index) => ({ id: `${prefix}-b${index + 1}`, text }))

// Przykładowe CV z fikcyjnymi danymi, w układzie briefu.
export const sampleCv = cvDocumentSchema.parse({
  schemaVersion: CV_SCHEMA_VERSION,
  id: 'sample',
  name: 'Przykładowe CV',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  settings: defaultCvSettings,
  header: {
    fullName: 'Anna Przykładowa',
    photo: { dataUrl: placeholderPhoto },
    contacts: [
      { id: 'c1', label: 'Tel', value: '+48 600 000 000' },
      { id: 'c2', label: 'E-mail', value: 'anna.przykladowa@example.com' },
      { id: 'c3', label: 'LinkedIn', value: 'linkedin.com/in/anna-przykladowa' },
      { id: 'c4', label: 'Miasto', value: 'Wrocław' }
    ],
    summary:
      'Specjalistka ds. zakupów z ponad dziesięcioletnim doświadczeniem w branży produkcyjnej i handlowej. ' +
      'Skutecznie negocjuję warunki współpracy, buduję trwałe relacje z dostawcami i dbam o ciągłość dostaw.'
  },
  sections: [
    {
      id: 'experience',
      type: 'experience',
      title: 'Doświadczenie zawodowe',
      hidden: false,
      pageBreakBefore: false,
      items: [
        {
          id: 'e1',
          role: 'Starsza specjalistka ds. zakupów',
          company: 'Fikcyjna Produkcja Sp. z o.o.',
          location: 'Wrocław',
          start: { year: 2023, month: 3 },
          end: 'present',
          pageBreakBefore: false,
          bullets: bullets('e1', [
            'Prowadzenie negocjacji cenowych i handlowych z dostawcami krajowymi i zagranicznymi.',
            'Zarządzanie portfelem ponad 60 dostawców komponentów i materiałów pomocniczych.',
            'Przygotowywanie i analiza zapytań ofertowych oraz porównań ofert.',
            'Wdrożenie kwartalnej oceny dostawców, która skróciła czas dostaw o 15%.',
            'Współpraca z działem jakości przy reklamacjach i audytach dostawców.',
            'Monitorowanie poziomów zapasów i planowanie zamówień we współpracy z produkcją.',
            'Raportowanie oszczędności zakupowych do zarządu.',
            'Wdrażanie nowych pracowników działu zakupów.'
          ])
        },
        {
          id: 'e2',
          role: 'Specjalistka ds. zakupów',
          company: 'Przykładowy Handel S.A.',
          location: 'Poznań',
          start: { year: 2019, month: 2 },
          end: { year: 2023, month: 2 },
          pageBreakBefore: false,
          bullets: bullets('e2', [
            'Realizacja zamówień zgodnie z planem sprzedaży i budżetem działu.',
            'Wyszukiwanie i kwalifikacja nowych dostawców w Polsce i w Azji.',
            'Negocjowanie umów ramowych i warunków płatności.',
            'Kontrola terminowości dostaw i rozwiązywanie problemów logistycznych.',
            'Utrzymywanie danych podstawowych dostawców i materiałów w systemie ERP.',
            'Udział w projekcie zmiany systemu ERP jako kluczowa użytkowniczka.',
            'Przygotowywanie cotygodniowych raportów zakupowych.'
          ])
        },
        {
          id: 'e3',
          role: 'Asystentka działu zakupów',
          company: 'Demo Logistyka Sp. z o.o.',
          location: 'Poznań',
          start: { year: 2016, month: 9 },
          end: { year: 2019, month: 1 },
          pageBreakBefore: false,
          bullets: bullets('e3', [
            'Wystawianie zamówień zakupowych i kontrola ich realizacji.',
            'Weryfikacja faktur i dokumentów dostaw.',
            'Prowadzenie korespondencji z dostawcami w języku polskim i angielskim.',
            'Archiwizacja dokumentacji zakupowej.',
            'Wsparcie zespołu przy inwentaryzacjach.'
          ])
        },
        {
          id: 'e4',
          role: 'Młodsza specjalistka ds. obsługi klienta',
          company: 'Testowe Biuro Podróży',
          location: 'Poznań',
          start: { year: 2014, month: 7 },
          end: { year: 2016, month: 8 },
          pageBreakBefore: false,
          bullets: bullets('e4', [
            'Obsługa klientów telefonicznie, mailowo i w biurze.',
            'Przygotowywanie ofert i rezerwacji wyjazdów.',
            'Rozpatrywanie reklamacji.',
            'Współpraca z kontrahentami zagranicznymi.'
          ])
        }
      ]
    },
    {
      id: 'education',
      type: 'education',
      title: 'Wykształcenie',
      hidden: false,
      pageBreakBefore: false,
      items: [
        {
          id: 'ed1',
          level: 'Studia podyplomowe',
          field: 'Menedżer zakupów',
          institution: 'Uniwersytet Przykładowy',
          start: null,
          end: { year: 2024, month: 6 },
          pageBreakBefore: false
        },
        {
          id: 'ed2',
          level: 'Studia magisterskie',
          field: 'Logistyka',
          institution: 'Akademia Fikcyjna',
          start: { year: 2009, month: 10 },
          end: { year: 2014, month: 6 },
          pageBreakBefore: false
        }
      ]
    },
    {
      id: 'skills',
      type: 'list',
      title: 'Umiejętności',
      hidden: false,
      pageBreakBefore: false,
      items: [
        { id: 's1', text: 'Negocjacje handlowe' },
        { id: 's2', text: 'Analiza ofert i kosztów zakupu' },
        { id: 's3', text: 'Systemy ERP (SAP, Comarch)' },
        { id: 's4', text: 'MS Excel – tabele przestawne, formuły' },
        { id: 's5', text: 'Prawo jazdy kat. B' }
      ]
    },
    {
      id: 'languages',
      type: 'list',
      title: 'Języki',
      hidden: false,
      pageBreakBefore: false,
      items: [
        { id: 'l1', text: 'Angielski – C1' },
        { id: 'l2', text: 'Niemiecki – A2' }
      ]
    },
    {
      id: 'hobby',
      type: 'list',
      title: 'Zainteresowania',
      hidden: true,
      pageBreakBefore: false,
      items: [{ id: 'h1', text: 'Ta sekcja jest ukryta i nie pojawia się w CV.' }]
    }
  ],
  consent: {
    enabled: true,
    clauseId: null,
    text:
      'Wyrażam zgodę na przetwarzanie moich danych osobowych przez Przykładową Firmę Rekrutacyjną Sp. z o.o. ' +
      'w celu prowadzenia obecnego procesu rekrutacyjnego, zgodnie z Rozporządzeniem Parlamentu Europejskiego ' +
      'i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO).'
  }
})
