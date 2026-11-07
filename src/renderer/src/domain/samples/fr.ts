import type { SampleCvText } from '../sampleCv'

export const fr: SampleCvText = {
  name: 'CV exemple',
  fullName: 'Camille Exemple',
  contacts: {
    // Pula ARCEP dla dzieł audiowizualnych (06 39 98, Plan national de numérotation).
    phone: { label: 'Téléphone', value: '+33 6 39 98 00 00' },
    email: { label: 'E-mail', value: 'camille.exemple@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/camille-exemple' },
    city: { label: 'Ville', value: 'Lyon' }
  },
  summary: 'Acheteuse forte de plus de dix ans d’expérience dans l’industrie et la distribution. Je négocie des conditions avantageuses, je construis des relations durables avec les fournisseurs et j’assure la continuité des approvisionnements.',
  experience: {
    title: 'Expérience professionnelle',
    positions: [
      {
        role: 'Acheteuse senior',
        company: 'Industries Fictives SARL',
        location: 'Lyon',
        bullets: [
          'Négociation des prix et conditions avec des fournisseurs français et étrangers.',
          'Gestion d’un portefeuille de plus de 60 fournisseurs de composants et consommables.',
          'Préparation et analyse des appels d’offres et comparatifs.',
          'Mise en place de revues trimestrielles réduisant les délais de livraison de 15 %.',
          'Travail avec la qualité sur les réclamations et audits fournisseurs.',
          'Suivi des stocks et planification des commandes avec la production.',
          'Reporting des économies d’achat à la direction.',
          'Intégration des nouveaux membres de l’équipe achats.'
        ]
      },
      {
        role: 'Acheteuse',
        company: 'Négoce Exemple SA',
        location: 'Lille',
        bullets: [
          'Passation des commandes selon le plan de ventes et le budget.',
          'Recherche et qualification de fournisseurs en Europe et en Asie.',
          'Négociation de contrats-cadres et de délais de paiement.',
          'Suivi des livraisons et résolution des problèmes logistiques.',
          'Gestion des données fournisseurs et articles dans l’ERP.',
          'Utilisatrice clé du projet de migration de l’ERP.',
          'Préparation des reportings achats hebdomadaires.'
        ]
      },
      {
        role: 'Assistante achats',
        company: 'Démo Logistique SAS',
        location: 'Lille',
        bullets: [
          'Émission des bons de commande et suivi de leur exécution.',
          'Contrôle des factures et bons de livraison.',
          'Correspondance avec les fournisseurs en français et en anglais.',
          'Archivage de la documentation achats.',
          'Soutien à l’équipe lors des inventaires.'
        ]
      },
      {
        role: 'Conseillère clientèle junior',
        company: 'Agence de Voyages Test',
        location: 'Nantes',
        bullets: [
          'Accueil des clients par téléphone, e-mail et en agence.',
          'Préparation d’offres et de réservations de voyages.',
          'Traitement des réclamations.',
          'Collaboration avec des partenaires à l’étranger.'
        ]
      }
    ]
  },
  education: {
    title: 'Formation',
    entries: [
      { level: 'Diplôme universitaire', field: 'Management des achats', institution: 'Université d’Exemple' },
      { level: 'Master', field: 'Logistique', institution: 'École Fictive de Commerce' }
    ]
  },
  skills: {
    title: 'Compétences',
    items: [
      'Négociation commerciale',
      'Analyse des offres et des coûts d’achat',
      'ERP (SAP, Sage)',
      'MS Excel – tableaux croisés, formules',
      'Permis B'
    ]
  },
  languages: {
    title: 'Langues',
    items: ['Français – langue maternelle', 'Anglais – C1']
  },
  hobby: {
    title: 'Centres d’intérêt',
    text: 'Cette section est masquée et n’apparaît pas dans le CV.'
  }
}
