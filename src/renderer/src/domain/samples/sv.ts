import type { SampleCvText } from '../sampleCv'

export const sv: SampleCvText = {
  name: 'Exempel-cv',
  fullName: 'Emma Exempelsson',
  contacts: {
    // Pula PTS dla książek i filmów (070-174 06 05 – 070-174 06 99).
    phone: { label: 'Telefon', value: '+46 70 174 06 05' },
    email: { label: 'E-post', value: 'emma.exempelsson@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/emma-exempelsson' },
    city: { label: 'Ort', value: 'Göteborg' }
  },
  summary: 'Inköpare med över tio års erfarenhet inom tillverkning och handel. Jag förhandlar fram goda villkor, bygger långsiktiga leverantörsrelationer och säkrar ett stabilt varuflöde.',
  experience: {
    title: 'Arbetslivserfarenhet',
    positions: [
      {
        role: 'Senior inköpare',
        company: 'Fiktiv Tillverkning AB',
        location: 'Göteborg',
        bullets: [
          'Förhandling av priser och villkor med svenska och utländska leverantörer.',
          'Ansvar för en portfölj med över 60 leverantörer av komponenter och förbrukningsmaterial.',
          'Framtagning och analys av offertförfrågningar och anbudsjämförelser.',
          'Införde kvartalsvisa leverantörsuppföljningar som kortade ledtiderna med 15 %.',
          'Reklamationer och leverantörsrevisioner tillsammans med kvalitetsteamet.',
          'Bevakning av lagernivåer och planering av beställningar med produktionen.',
          'Rapportering av inköpsbesparingar till ledningsgruppen.',
          'Introduktion av nya medarbetare i inköpsteamet.'
        ]
      },
      {
        role: 'Inköpare',
        company: 'Exempel Handel AB',
        location: 'Stockholm',
        bullets: [
          'Beställningar enligt försäljningsplanen och avdelningens budget.',
          'Sökning och kvalificering av nya leverantörer i Europa och Asien.',
          'Förhandling av ramavtal och betalningsvillkor.',
          'Uppföljning av leveransprecision och lösning av logistikproblem.',
          'Underhåll av leverantörs- och artikeldata i affärssystemet.',
          'Superanvändare i projektet för byte av affärssystem.',
          'Sammanställning av veckovisa inköpsrapporter.'
        ]
      },
      {
        role: 'Inköpsassistent',
        company: 'Demo Logistik AB',
        location: 'Stockholm',
        bullets: [
          'Utfärdande av inköpsorder och uppföljning av leveranser.',
          'Kontroll av fakturor och leveransdokument.',
          'Korrespondens med leverantörer på svenska och engelska.',
          'Arkivering av inköpsdokumentation.',
          'Stöd till teamet vid inventering.'
        ]
      },
      {
        role: 'Junior kundtjänstmedarbetare',
        company: 'Test Resebyrå AB',
        location: 'Uppsala',
        bullets: [
          'Kundservice via telefon, e-post och på kontoret.',
          'Framtagning av reseerbjudanden och bokningar.',
          'Hantering av reklamationer.',
          'Samarbete med partner utomlands.'
        ]
      }
    ]
  },
  education: {
    title: 'Utbildning',
    entries: [
      { level: 'Vidareutbildning', field: 'Inköpsledning', institution: 'Exempeluniversitetet' },
      { level: 'Masterexamen', field: 'Logistik', institution: 'Fiktiva högskolan' }
    ]
  },
  skills: {
    title: 'Kompetenser',
    items: [
      'Affärsförhandling',
      'Analys av anbud och inköpskostnader',
      'Affärssystem (SAP, IFS)',
      'MS Excel – pivottabeller, formler',
      'B-körkort'
    ]
  },
  languages: {
    title: 'Språk',
    items: ['Svenska – modersmål', 'Engelska – C1']
  },
  hobby: {
    title: 'Intressen',
    text: 'Det här avsnittet är dolt och syns inte i cv:t.'
  }
}
