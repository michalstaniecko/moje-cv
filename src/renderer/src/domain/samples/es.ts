import type { SampleCvText } from '../sampleCv'

export const es: SampleCvText = {
  name: 'CV de ejemplo',
  fullName: 'Lucía Ejemplo',
  contacts: {
    // Brak oficjalnej puli numerów fikcyjnych (CNMC) – zastępczy numer komórkowy z samymi zerami.
    phone: { label: 'Teléfono', value: '+34 600 000 000' },
    email: { label: 'Email', value: 'lucia.ejemplo@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/lucia-ejemplo' },
    city: { label: 'Ciudad', value: 'Valencia' }
  },
  summary: 'Especialista en compras con más de diez años de experiencia en industria y distribución. Negocio condiciones ventajosas, creo relaciones duraderas con proveedores y garantizo la continuidad del suministro.',
  experience: {
    title: 'Experiencia laboral',
    positions: [
      {
        role: 'Especialista sénior de compras',
        company: 'Fabricaciones Ficticias S.L.',
        location: 'Valencia',
        bullets: [
          'Negociación de precios y condiciones con proveedores nacionales e internacionales.',
          'Gestión de una cartera de más de 60 proveedores de componentes y materiales auxiliares.',
          'Preparación y análisis de solicitudes de oferta y comparativas.',
          'Implantación de revisiones trimestrales que redujeron los plazos de entrega un 15 %.',
          'Colaboración con calidad en reclamaciones y auditorías de proveedores.',
          'Control de existencias y planificación de pedidos con producción.',
          'Informes de ahorro en compras para la dirección.',
          'Formación de nuevos miembros del equipo de compras.'
        ]
      },
      {
        role: 'Especialista de compras',
        company: 'Comercial Ejemplo S.A.',
        location: 'Madrid',
        bullets: [
          'Emisión de pedidos según el plan de ventas y el presupuesto.',
          'Búsqueda y homologación de nuevos proveedores en Europa y Asia.',
          'Negociación de acuerdos marco y condiciones de pago.',
          'Seguimiento de entregas y resolución de incidencias logísticas.',
          'Mantenimiento de datos maestros de proveedores y materiales en el ERP.',
          'Usuaria clave en el proyecto de migración del sistema ERP.',
          'Elaboración de informes semanales de compras.'
        ]
      },
      {
        role: 'Asistente de compras',
        company: 'Logística Demo S.L.',
        location: 'Madrid',
        bullets: [
          'Emisión de pedidos de compra y seguimiento de su cumplimiento.',
          'Verificación de facturas y albaranes.',
          'Correspondencia con proveedores en español e inglés.',
          'Archivo de la documentación de compras.',
          'Apoyo al equipo en los inventarios.'
        ]
      },
      {
        role: 'Agente júnior de atención al cliente',
        company: 'Viajes Prueba S.L.',
        location: 'Zaragoza',
        bullets: [
          'Atención al cliente por teléfono, email y en oficina.',
          'Preparación de ofertas y reservas de viajes.',
          'Gestión de reclamaciones.',
          'Colaboración con socios en el extranjero.'
        ]
      }
    ]
  },
  education: {
    title: 'Formación',
    entries: [
      { level: 'Posgrado', field: 'Gestión de Compras', institution: 'Universidad de Ejemplo' },
      { level: 'Máster', field: 'Logística', institution: 'Escuela Ficticia de Negocios' }
    ]
  },
  skills: {
    title: 'Habilidades',
    items: [
      'Negociación comercial',
      'Análisis de ofertas y costes de compra',
      'Sistemas ERP (SAP, Sage)',
      'MS Excel – tablas dinámicas, fórmulas',
      'Carné de conducir B'
    ]
  },
  languages: {
    title: 'Idiomas',
    items: ['Español – nativo', 'Inglés – C1']
  },
  hobby: {
    title: 'Intereses',
    text: 'Esta sección está oculta y no aparece en el CV.'
  }
}
