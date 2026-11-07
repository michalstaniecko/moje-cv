import type { SampleCvText } from '../sampleCv'

export const en: SampleCvText = {
  name: 'Sample CV',
  fullName: 'Jane Example',
  contacts: {
    phone: { label: 'Phone', value: '+44 7700 900000' },
    email: { label: 'Email', value: 'jane.example@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/jane-example' },
    city: { label: 'City', value: 'Manchester' }
  },
  summary: 'Procurement specialist with over ten years of experience in manufacturing and retail. I negotiate effective terms, build lasting relationships with suppliers and keep supply running smoothly.',
  experience: {
    title: 'Work experience',
    positions: [
      {
        role: 'Senior Procurement Specialist',
        company: 'Fictional Manufacturing Ltd',
        location: 'Manchester',
        bullets: [
          'Negotiating prices and commercial terms with domestic and international suppliers.',
          'Managing a portfolio of more than 60 suppliers of components and auxiliary materials.',
          'Preparing and analysing requests for quotation and bid comparisons.',
          'Introducing quarterly supplier reviews that cut delivery times by 15%.',
          'Working with the quality team on complaints and supplier audits.',
          'Monitoring stock levels and planning orders together with production.',
          'Reporting procurement savings to the management board.',
          'Onboarding new members of the procurement team.'
        ]
      },
      {
        role: 'Procurement Specialist',
        company: 'Example Trading plc',
        location: 'Leeds',
        bullets: [
          'Placing orders in line with the sales plan and the department budget.',
          'Sourcing and qualifying new suppliers in Europe and Asia.',
          'Negotiating framework agreements and payment terms.',
          'Tracking on-time delivery and solving logistics issues.',
          'Maintaining supplier and material master data in the ERP system.',
          'Key user in the ERP system migration project.',
          'Preparing weekly procurement reports.'
        ]
      },
      {
        role: 'Procurement Assistant',
        company: 'Demo Logistics Ltd',
        location: 'Leeds',
        bullets: [
          'Issuing purchase orders and tracking their fulfilment.',
          'Checking invoices and delivery documents.',
          'Handling correspondence with suppliers in English and German.',
          'Archiving procurement documentation.',
          'Supporting the team during stocktaking.'
        ]
      },
      {
        role: 'Junior Customer Service Specialist',
        company: 'Test Travel Agency',
        location: 'York',
        bullets: [
          'Serving customers by phone, by email and in the office.',
          'Preparing travel offers and bookings.',
          'Handling complaints.',
          'Working with partners abroad.'
        ]
      }
    ]
  },
  education: {
    title: 'Education',
    entries: [
      { level: 'Postgraduate diploma', field: 'Procurement Management', institution: 'University of Example' },
      { level: 'Master’s degree', field: 'Logistics', institution: 'Fictional Academy' }
    ]
  },
  skills: {
    title: 'Skills',
    items: [
      'Commercial negotiation',
      'Bid and purchase cost analysis',
      'ERP systems (SAP, Oracle)',
      'MS Excel – pivot tables, formulas',
      'Driving licence (category B)'
    ]
  },
  languages: {
    title: 'Languages',
    items: ['English – native', 'German – B2']
  },
  hobby: {
    title: 'Interests',
    text: 'This section is hidden and doesn’t appear on the CV.'
  }
}
