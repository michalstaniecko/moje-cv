import type { SampleCvText } from '../sampleCv'

export const de: SampleCvText = {
  name: 'Beispiel-Lebenslauf',
  fullName: 'Anna Beispiel',
  contacts: {
    phone: { label: 'Telefon', value: '+49 170 0000000' },
    email: { label: 'E-Mail', value: 'anna.beispiel@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/anna-beispiel' },
    city: { label: 'Wohnort', value: 'Stuttgart' }
  },
  summary: 'Einkäuferin mit über zehn Jahren Erfahrung in Industrie und Handel. Ich verhandle gute Konditionen, pflege langfristige Lieferantenbeziehungen und sichere eine stabile Versorgung.',
  experience: {
    title: 'Berufserfahrung',
    positions: [
      {
        role: 'Senior Einkäuferin',
        company: 'Fiktiv Fertigung GmbH',
        location: 'Stuttgart',
        bullets: [
          'Verhandlung von Preisen und Konditionen mit Lieferanten im In- und Ausland.',
          'Betreuung von über 60 Lieferanten für Komponenten und Hilfsstoffe.',
          'Erstellung und Auswertung von Anfragen und Angebotsvergleichen.',
          'Einführung quartalsweiser Lieferantenbewertungen: Lieferzeiten −15 %.',
          'Reklamationen und Lieferantenaudits gemeinsam mit dem Qualitätsteam.',
          'Bestandsüberwachung und Bestellplanung mit der Produktion.',
          'Berichte über Einkaufseinsparungen an die Geschäftsführung.',
          'Einarbeitung neuer Kolleginnen und Kollegen im Einkauf.'
        ]
      },
      {
        role: 'Einkäuferin',
        company: 'Beispiel Handel AG',
        location: 'Köln',
        bullets: [
          'Bestellungen gemäß Absatzplan und Abteilungsbudget.',
          'Suche und Qualifizierung neuer Lieferanten in Europa und Asien.',
          'Verhandlung von Rahmenverträgen und Zahlungsbedingungen.',
          'Überwachung der Liefertermine und Lösung logistischer Probleme.',
          'Pflege der Lieferanten- und Materialstammdaten im ERP-System.',
          'Key User im Projekt zur Umstellung des ERP-Systems.',
          'Erstellung wöchentlicher Einkaufsberichte.'
        ]
      },
      {
        role: 'Assistentin Einkauf',
        company: 'Demo Logistik GmbH',
        location: 'Köln',
        bullets: [
          'Erstellung von Bestellungen und Verfolgung ihrer Abwicklung.',
          'Prüfung von Rechnungen und Lieferpapieren.',
          'Korrespondenz mit Lieferanten auf Deutsch und Englisch.',
          'Archivierung der Einkaufsunterlagen.',
          'Unterstützung des Teams bei der Inventur.'
        ]
      },
      {
        role: 'Junior-Kundenberaterin',
        company: 'Test Reisebüro GmbH',
        location: 'Bonn',
        bullets: [
          'Kundenberatung per Telefon, E-Mail und im Büro.',
          'Erstellung von Reiseangeboten und Buchungen.',
          'Bearbeitung von Reklamationen.',
          'Zusammenarbeit mit Partnern im Ausland.'
        ]
      }
    ]
  },
  education: {
    title: 'Ausbildung',
    entries: [
      { level: 'Weiterbildung', field: 'Einkaufsmanagement', institution: 'Universität Beispielstadt' },
      { level: 'Master of Science', field: 'Logistik', institution: 'Fiktive Hochschule' }
    ]
  },
  skills: {
    title: 'Kenntnisse',
    items: [
      'Verhandlungsführung',
      'Angebots- und Einkaufskostenanalyse',
      'ERP-Systeme (SAP, Microsoft Dynamics)',
      'MS Excel – Pivot-Tabellen, Formeln',
      'Führerschein Klasse B'
    ]
  },
  languages: {
    title: 'Sprachen',
    items: ['Deutsch – Muttersprache', 'Englisch – C1']
  },
  hobby: {
    title: 'Interessen',
    text: 'Dieser Abschnitt ist ausgeblendet und erscheint nicht im Lebenslauf.'
  }
}
