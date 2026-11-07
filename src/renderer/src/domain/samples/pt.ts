import type { SampleCvText } from '../sampleCv'

export const pt: SampleCvText = {
  name: 'Currículo de exemplo',
  fullName: 'Mariana Exemplo',
  contacts: {
    // Brak oficjalnej puli numerów fikcyjnych (Anatel) – zastępczy numer komórkowy z samymi zerami.
    phone: { label: 'Telefone', value: '+55 11 90000-0000' },
    email: { label: 'E-mail', value: 'mariana.exemplo@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/mariana-exemplo' },
    city: { label: 'Cidade', value: 'Campinas' }
  },
  summary: 'Especialista em compras com mais de dez anos de experiência na indústria e no varejo. Negocio condições vantajosas, construo relações duradouras com fornecedores e garanto o abastecimento contínuo.',
  experience: {
    title: 'Experiência profissional',
    positions: [
      {
        role: 'Especialista de Compras Sênior',
        company: 'Indústria Fictícia Ltda.',
        location: 'Campinas',
        bullets: [
          'Negociação de preços e condições comerciais com fornecedores nacionais e estrangeiros.',
          'Gestão de uma carteira de mais de 60 fornecedores de componentes e materiais auxiliares.',
          'Preparação e análise de cotações e comparativos de propostas.',
          'Implantação de avaliações trimestrais de fornecedores, com redução de 15% nos prazos.',
          'Atuação com a área de qualidade em reclamações e auditorias de fornecedores.',
          'Monitoramento de estoques e planejamento de pedidos junto com a produção.',
          'Relatórios de economia em compras para a diretoria.',
          'Integração de novos membros da equipe de compras.'
        ]
      },
      {
        role: 'Especialista de Compras',
        company: 'Comércio Exemplo S.A.',
        location: 'São Paulo',
        bullets: [
          'Emissão de pedidos conforme o plano de vendas e o orçamento da área.',
          'Busca e qualificação de novos fornecedores na Europa e na Ásia.',
          'Negociação de contratos-quadro e condições de pagamento.',
          'Acompanhamento dos prazos de entrega e solução de problemas logísticos.',
          'Manutenção do cadastro de fornecedores e materiais no ERP.',
          'Usuária-chave no projeto de migração do sistema ERP.',
          'Elaboração de relatórios semanais de compras.'
        ]
      },
      {
        role: 'Assistente de Compras',
        company: 'Demo Logística Ltda.',
        location: 'São Paulo',
        bullets: [
          'Emissão de pedidos de compra e acompanhamento da entrega.',
          'Conferência de notas fiscais e documentos de entrega.',
          'Correspondência com fornecedores em português e inglês.',
          'Arquivamento da documentação de compras.',
          'Apoio à equipe nos inventários.'
        ]
      },
      {
        role: 'Assistente de Atendimento Júnior',
        company: 'Agência de Viagens Teste',
        location: 'Curitiba',
        bullets: [
          'Atendimento a clientes por telefone, e-mail e na loja.',
          'Elaboração de pacotes e reservas de viagens.',
          'Tratamento de reclamações.',
          'Contato com parceiros no exterior.'
        ]
      }
    ]
  },
  education: {
    title: 'Formação acadêmica',
    entries: [
      { level: 'Pós-graduação (MBA)', field: 'Gestão de Compras', institution: 'Universidade Exemplo' },
      { level: 'Bacharelado', field: 'Logística', institution: 'Faculdade Fictícia' }
    ]
  },
  skills: {
    title: 'Habilidades',
    items: [
      'Negociação comercial',
      'Análise de propostas e custos de compra',
      'Sistemas ERP (SAP, TOTVS)',
      'MS Excel – tabelas dinâmicas, fórmulas',
      'CNH categoria B'
    ]
  },
  languages: {
    title: 'Idiomas',
    items: ['Português – nativo', 'Inglês – C1']
  },
  hobby: {
    title: 'Interesses',
    text: 'Esta seção está oculta e não aparece no currículo.'
  }
}
