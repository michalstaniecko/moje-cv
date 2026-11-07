import type { SampleCvText } from '../sampleCv'

export const ro: SampleCvText = {
  name: 'CV exemplu',
  fullName: 'Ioana Exemplescu',
  contacts: {
    // Brak oficjalnej puli numerów fikcyjnych (ANCOM) – zastępczy numer komórkowy z samymi zerami.
    phone: { label: 'Telefon', value: '+40 700 000 000' },
    email: { label: 'E-mail', value: 'ioana.exemplescu@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/ioana-exemplescu' },
    city: { label: 'Oraș', value: 'Cluj-Napoca' }
  },
  summary: 'Specialistă în achiziții cu peste zece ani de experiență în producție și retail. Negociez condiții avantajoase, construiesc relații durabile cu furnizorii și asigur continuitatea aprovizionării.',
  experience: {
    title: 'Experiență profesională',
    positions: [
      {
        role: 'Specialist achiziții senior',
        company: 'Producție Fictivă S.R.L.',
        location: 'Cluj-Napoca',
        bullets: [
          'Negocierea prețurilor și a condițiilor comerciale cu furnizori interni și externi.',
          'Gestionarea unui portofoliu de peste 60 de furnizori de componente și materiale auxiliare.',
          'Pregătirea și analiza cererilor de ofertă și a comparațiilor de oferte.',
          'Introducerea evaluării trimestriale a furnizorilor, cu termene de livrare mai scurte cu 15%.',
          'Colaborare cu echipa de calitate la reclamații și auditul furnizorilor.',
          'Monitorizarea stocurilor și planificarea comenzilor împreună cu producția.',
          'Raportarea economiilor din achiziții către conducere.',
          'Integrarea noilor membri ai echipei de achiziții.'
        ]
      },
      {
        role: 'Specialist achiziții',
        company: 'Comerț Exemplu S.A.',
        location: 'Timișoara',
        bullets: [
          'Plasarea comenzilor conform planului de vânzări și bugetului departamentului.',
          'Identificarea și calificarea noilor furnizori din Europa și Asia.',
          'Negocierea contractelor-cadru și a termenelor de plată.',
          'Urmărirea livrărilor la termen și rezolvarea problemelor logistice.',
          'Gestionarea datelor de bază ale furnizorilor și materialelor în ERP.',
          'Utilizator-cheie în proiectul de migrare a sistemului ERP.',
          'Întocmirea rapoartelor săptămânale de achiziții.'
        ]
      },
      {
        role: 'Asistent achiziții',
        company: 'Demo Logistică S.R.L.',
        location: 'Timișoara',
        bullets: [
          'Emiterea comenzilor de achiziție și urmărirea derulării lor.',
          'Verificarea facturilor și a documentelor de livrare.',
          'Corespondență cu furnizorii în română și engleză.',
          'Arhivarea documentației de achiziții.',
          'Sprijinirea echipei la inventariere.'
        ]
      },
      {
        role: 'Consultant junior relații clienți',
        company: 'Agenția de Turism Test',
        location: 'Brașov',
        bullets: [
          'Relația cu clienții prin telefon, e-mail și la sediu.',
          'Pregătirea ofertelor și a rezervărilor de călătorii.',
          'Soluționarea reclamațiilor.',
          'Colaborarea cu parteneri din străinătate.'
        ]
      }
    ]
  },
  education: {
    title: 'Educație',
    entries: [
      { level: 'Studii postuniversitare', field: 'Managementul achizițiilor', institution: 'Universitatea Exemplu' },
      { level: 'Licență și master', field: 'Logistică', institution: 'Academia Fictivă' }
    ]
  },
  skills: {
    title: 'Competențe',
    items: [
      'Negociere comercială',
      'Analiza ofertelor și a costurilor de achiziție',
      'Sisteme ERP (SAP, Charisma)',
      'MS Excel – tabele pivot, formule',
      'Permis de conducere categoria B'
    ]
  },
  languages: {
    title: 'Limbi',
    items: ['Română – limbă maternă', 'Engleză – C1']
  },
  hobby: {
    title: 'Interese',
    text: 'Această secțiune este ascunsă și nu apare în CV.'
  }
}
