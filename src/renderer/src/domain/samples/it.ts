import type { SampleCvText } from '../sampleCv'

export const it: SampleCvText = {
  name: 'CV di esempio',
  fullName: 'Giulia Esempio',
  contacts: {
    // Brak oficjalnej puli numerów fikcyjnych (AGCOM) – zastępczy numer komórkowy z samymi zerami.
    phone: { label: 'Telefono', value: '+39 333 000 0000' },
    email: { label: 'Email', value: 'giulia.esempio@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/giulia-esempio' },
    city: { label: 'Città', value: 'Milano' }
  },
  summary: 'Buyer con oltre dieci anni di esperienza nei settori manifatturiero e retail. Negozio condizioni vantaggiose, costruisco relazioni durature con i fornitori e garantisco la continuità degli approvvigionamenti.',
  experience: {
    title: 'Esperienza professionale',
    positions: [
      {
        role: 'Senior Buyer',
        company: 'Manifatture Fittizie S.r.l.',
        location: 'Milano',
        bullets: [
          'Negoziazione di prezzi e condizioni con fornitori italiani ed esteri.',
          'Gestione di un portafoglio di oltre 60 fornitori di componenti e materiali ausiliari.',
          'Preparazione e analisi di richieste di offerta e confronti tra offerte.',
          'Introduzione di revisioni trimestrali che hanno ridotto i tempi di consegna del 15%.',
          'Collaborazione con la qualità su reclami e audit dei fornitori.',
          'Monitoraggio delle scorte e pianificazione degli ordini con la produzione.',
          'Reportistica dei risparmi sugli acquisti per la direzione.',
          'Inserimento dei nuovi membri dell’ufficio acquisti.'
        ]
      },
      {
        role: 'Buyer',
        company: 'Esempio Commerciale S.p.A.',
        location: 'Bologna',
        bullets: [
          'Emissione degli ordini in base al piano vendite e al budget.',
          'Ricerca e qualifica di nuovi fornitori in Europa e Asia.',
          'Negoziazione di accordi quadro e termini di pagamento.',
          'Monitoraggio delle consegne e gestione dei problemi logistici.',
          'Gestione dei dati anagrafici di fornitori e materiali nell’ERP.',
          'Key user nel progetto di migrazione del sistema ERP.',
          'Preparazione di report settimanali sugli acquisti.'
        ]
      },
      {
        role: 'Assistente ufficio acquisti',
        company: 'Demo Logistica S.r.l.',
        location: 'Bologna',
        bullets: [
          'Emissione degli ordini d’acquisto e verifica dell’evasione.',
          'Controllo di fatture e documenti di trasporto.',
          'Corrispondenza con i fornitori in italiano e inglese.',
          'Archiviazione della documentazione acquisti.',
          'Supporto al team durante gli inventari.'
        ]
      },
      {
        role: 'Addetta junior al servizio clienti',
        company: 'Agenzia Viaggi Prova',
        location: 'Verona',
        bullets: [
          'Assistenza ai clienti per telefono, email e in agenzia.',
          'Preparazione di offerte e prenotazioni di viaggi.',
          'Gestione dei reclami.',
          'Collaborazione con partner esteri.'
        ]
      }
    ]
  },
  education: {
    title: 'Istruzione',
    entries: [
      { level: 'Master di I livello', field: 'Gestione degli acquisti', institution: 'Università di Esempio' },
      { level: 'Laurea magistrale', field: 'Logistica', institution: 'Accademia Fittizia' }
    ]
  },
  skills: {
    title: 'Competenze',
    items: [
      'Negoziazione commerciale',
      'Analisi delle offerte e dei costi d’acquisto',
      'Sistemi ERP (SAP, TeamSystem)',
      'MS Excel – tabelle pivot, formule',
      'Patente B'
    ]
  },
  languages: {
    title: 'Lingue',
    items: ['Italiano – madrelingua', 'Inglese – C1']
  },
  hobby: {
    title: 'Interessi',
    text: 'Questa sezione è nascosta e non compare nel CV.'
  }
}
