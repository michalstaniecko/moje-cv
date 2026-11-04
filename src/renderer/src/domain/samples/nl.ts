import type { SampleCvText } from '../sampleCv'

export const nl: SampleCvText = {
  name: 'Voorbeeld-cv',
  fullName: 'Sanne Voorbeeld',
  contacts: {
    // Brak oficjalnej puli numerów fikcyjnych (ACM) – zastępczy numer komórkowy z samymi zerami.
    phone: { label: 'Telefoon', value: '+31 6 00000000' },
    email: { label: 'E-mail', value: 'sanne.voorbeeld@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/sanne-voorbeeld' },
    city: { label: 'Woonplaats', value: 'Eindhoven' }
  },
  summary: 'Inkoopspecialist met ruim tien jaar ervaring in productie en retail. Ik onderhandel goede voorwaarden, bouw duurzame relaties op met leveranciers en zorg voor een stabiele bevoorrading.',
  experience: {
    title: 'Werkervaring',
    positions: [
      {
        role: 'Senior inkoopspecialist',
        company: 'Fictief Productie B.V.',
        location: 'Eindhoven',
        bullets: [
          'Onderhandelen over prijzen en voorwaarden met binnen- en buitenlandse leveranciers.',
          'Beheer van een portfolio van ruim 60 leveranciers van onderdelen en hulpstoffen.',
          'Opstellen en analyseren van offerteaanvragen en offertevergelijkingen.',
          'Invoering van kwartaalbeoordelingen van leveranciers: levertijden 15% korter.',
          'Klachten en leveranciersaudits samen met het kwaliteitsteam.',
          'Bewaken van voorraden en plannen van bestellingen met de productie.',
          'Rapporteren van inkoopbesparingen aan de directie.',
          'Inwerken van nieuwe collega’s van het inkoopteam.'
        ]
      },
      {
        role: 'Inkoopspecialist',
        company: 'Voorbeeld Handel N.V.',
        location: 'Rotterdam',
        bullets: [
          'Plaatsen van bestellingen volgens het verkoopplan en het budget.',
          'Zoeken en kwalificeren van nieuwe leveranciers in Europa en Azië.',
          'Onderhandelen over raamcontracten en betalingstermijnen.',
          'Bewaken van leverdata en oplossen van logistieke problemen.',
          'Beheer van leveranciers- en artikelstamgegevens in het ERP-systeem.',
          'Key user in het migratieproject van het ERP-systeem.',
          'Opstellen van wekelijkse inkooprapportages.'
        ]
      },
      {
        role: 'Inkoopassistent',
        company: 'Demo Logistiek B.V.',
        location: 'Rotterdam',
        bullets: [
          'Uitzetten van inkooporders en bewaken van de levering.',
          'Controleren van facturen en leveringsdocumenten.',
          'Correspondentie met leveranciers in het Nederlands en Engels.',
          'Archiveren van inkoopdocumentatie.',
          'Ondersteunen van het team bij de inventarisatie.'
        ]
      },
      {
        role: 'Junior klantenservicemedewerker',
        company: 'Test Reisbureau B.V.',
        location: 'Delft',
        bullets: [
          'Klanten helpen via telefoon, e-mail en op kantoor.',
          'Opstellen van reisaanbiedingen en boekingen.',
          'Afhandelen van klachten.',
          'Samenwerken met partners in het buitenland.'
        ]
      }
    ]
  },
  education: {
    title: 'Opleiding',
    entries: [
      { level: 'Postacademische opleiding', field: 'Inkoopmanagement', institution: 'Universiteit Voorbeeldstad' },
      { level: 'Master', field: 'Logistiek', institution: 'Fictieve Academie' }
    ]
  },
  skills: {
    title: 'Vaardigheden',
    items: [
      'Commercieel onderhandelen',
      'Analyse van offertes en inkoopkosten',
      'ERP-systemen (SAP, Exact)',
      'MS Excel – draaitabellen, formules',
      'Rijbewijs B'
    ]
  },
  languages: {
    title: 'Talen',
    items: ['Nederlands – moedertaal', 'Engels – C1']
  },
  hobby: {
    title: 'Interesses',
    text: 'Deze sectie is verborgen en staat niet op het cv.'
  }
}
