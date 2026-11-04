import type { SampleCvText } from '../sampleCv'

export const cs: SampleCvText = {
  name: 'Ukázkové CV',
  fullName: 'Jana Ukázková',
  contacts: {
    // Brak oficjalnej puli numerów fikcyjnych (ČTÚ) – zastępczy numer komórkowy z samymi zerami.
    phone: { label: 'Telefon', value: '+420 600 000 000' },
    email: { label: 'E-mail', value: 'jana.ukazkova@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/jana-ukazkova' },
    city: { label: 'Město', value: 'Brno' }
  },
  summary: 'Specialistka nákupu s více než desetiletou praxí ve výrobě a obchodu. Vyjednávám výhodné podmínky, buduji dlouhodobé vztahy s dodavateli a zajišťuji plynulost dodávek.',
  experience: {
    title: 'Pracovní zkušenosti',
    positions: [
      {
        role: 'Senior specialistka nákupu',
        company: 'Fiktivní výroba s.r.o.',
        location: 'Brno',
        bullets: [
          'Vyjednávání cen a obchodních podmínek s tuzemskými i zahraničními dodavateli.',
          'Správa portfolia více než 60 dodavatelů komponent a pomocných materiálů.',
          'Příprava a vyhodnocování poptávek a srovnání nabídek.',
          'Zavedení čtvrtletního hodnocení dodavatelů, které zkrátilo dodací lhůty o 15 %.',
          'Spolupráce s oddělením kvality při reklamacích a auditech dodavatelů.',
          'Sledování stavu zásob a plánování objednávek ve spolupráci s výrobou.',
          'Reporting úspor v nákupu vedení společnosti.',
          'Zaškolování nových členů nákupního týmu.'
        ]
      },
      {
        role: 'Specialistka nákupu',
        company: 'Příklad Obchod a.s.',
        location: 'Praha',
        bullets: [
          'Zadávání objednávek podle plánu prodeje a rozpočtu oddělení.',
          'Vyhledávání a kvalifikace nových dodavatelů v Evropě a Asii.',
          'Vyjednávání rámcových smluv a platebních podmínek.',
          'Kontrola včasnosti dodávek a řešení logistických problémů.',
          'Správa kmenových dat dodavatelů a materiálů v systému ERP.',
          'Klíčová uživatelka v projektu přechodu na nový systém ERP.',
          'Příprava týdenních reportů nákupu.'
        ]
      },
      {
        role: 'Asistentka nákupu',
        company: 'Demo Logistika s.r.o.',
        location: 'Praha',
        bullets: [
          'Vystavování nákupních objednávek a kontrola jejich plnění.',
          'Kontrola faktur a dodacích listů.',
          'Korespondence s dodavateli v češtině a angličtině.',
          'Archivace nákupní dokumentace.',
          'Podpora týmu při inventurách.'
        ]
      },
      {
        role: 'Junior specialistka péče o zákazníky',
        company: 'Cestovní kancelář Test',
        location: 'Olomouc',
        bullets: [
          'Obsluha zákazníků po telefonu, e-mailem i na pobočce.',
          'Příprava nabídek zájezdů a rezervací.',
          'Vyřizování reklamací.',
          'Spolupráce se zahraničními partnery.'
        ]
      }
    ]
  },
  education: {
    title: 'Vzdělání',
    entries: [
      { level: 'Celoživotní vzdělávání', field: 'Řízení nákupu', institution: 'Ukázková univerzita' },
      { level: 'Magisterské studium', field: 'Logistika', institution: 'Fiktivní akademie' }
    ]
  },
  skills: {
    title: 'Dovednosti',
    items: [
      'Obchodní vyjednávání',
      'Analýza nabídek a nákupních nákladů',
      'Systémy ERP (SAP, Helios)',
      'MS Excel – kontingenční tabulky, vzorce',
      'Řidičský průkaz sk. B'
    ]
  },
  languages: {
    title: 'Jazyky',
    items: ['Čeština – rodilá mluvčí', 'Angličtina – C1']
  },
  hobby: {
    title: 'Zájmy',
    text: 'Tato sekce je skrytá a v CV se nezobrazuje.'
  }
}
