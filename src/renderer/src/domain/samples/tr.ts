import type { SampleCvText } from '../sampleCv'

export const tr: SampleCvText = {
  name: 'Örnek CV',
  fullName: 'Ayşe Örnek',
  contacts: {
    phone: { label: 'Telefon', value: '+90 500 000 00 00' },
    email: { label: 'E-posta', value: 'ayse.ornek@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/ayse-ornek' },
    city: { label: 'Şehir', value: 'Bursa' }
  },
  summary: 'Üretim ve perakende sektörlerinde on yılı aşkın deneyime sahip satın alma uzmanı. Etkili koşullar müzakere ediyor, tedarikçilerle kalıcı ilişkiler kuruyor ve tedarikin aksamadan sürmesini sağlıyorum.',
  experience: {
    title: 'İş deneyimi',
    positions: [
      {
        role: 'Kıdemli Satın Alma Uzmanı',
        company: 'Kurgu Üretim A.Ş.',
        location: 'Bursa',
        bullets: [
          'Yurt içi ve yurt dışı tedarikçilerle fiyat ve ticari koşul müzakereleri.',
          'Bileşen ve yardımcı malzeme sağlayan 60’tan fazla tedarikçinin yönetimi.',
          'Teklif taleplerinin hazırlanması ve teklif karşılaştırmalarının analizi.',
          'Teslim sürelerini %15 kısaltan üç aylık tedarikçi değerlendirmesinin başlatılması.',
          'Şikâyetler ve tedarikçi denetimlerinde kalite ekibiyle iş birliği.',
          'Stok seviyelerinin izlenmesi ve siparişlerin üretimle birlikte planlanması.',
          'Satın alma tasarruflarının yönetim kuruluna raporlanması.',
          'Satın alma ekibine katılan yeni çalışanların oryantasyonu.'
        ]
      },
      {
        role: 'Satın Alma Uzmanı',
        company: 'Örnek Ticaret A.Ş.',
        location: 'İzmir',
        bullets: [
          'Satış planına ve departman bütçesine uygun sipariş verilmesi.',
          'Avrupa ve Asya’da yeni tedarikçilerin bulunması ve onaylanması.',
          'Çerçeve sözleşmelerinin ve ödeme koşullarının müzakeresi.',
          'Zamanında teslimatın takibi ve lojistik sorunların çözümü.',
          'ERP sistemindeki tedarikçi ve malzeme ana verilerinin yönetimi.',
          'ERP sistemi geçiş projesinde anahtar kullanıcı.',
          'Haftalık satın alma raporlarının hazırlanması.'
        ]
      },
      {
        role: 'Satın Alma Asistanı',
        company: 'Demo Lojistik Ltd. Şti.',
        location: 'İzmir',
        bullets: [
          'Satın alma siparişlerinin oluşturulması ve takibi.',
          'Faturaların ve teslimat belgelerinin kontrolü.',
          'Tedarikçilerle Türkçe ve İngilizce yazışmalar.',
          'Satın alma belgelerinin arşivlenmesi.',
          'Stok sayımlarında ekibe destek.'
        ]
      },
      {
        role: 'Müşteri Hizmetleri Uzman Yardımcısı',
        company: 'Test Turizm Seyahat Acentesi',
        location: 'Antalya',
        bullets: [
          'Müşterilere telefonla, e-postayla ve ofiste hizmet.',
          'Seyahat tekliflerinin ve rezervasyonların hazırlanması.',
          'Şikâyetlerin ele alınması.',
          'Yurt dışındaki iş ortaklarıyla iş birliği.'
        ]
      }
    ]
  },
  education: {
    title: 'Eğitim',
    entries: [
      { level: 'Sertifika programı', field: 'Satın Alma Yönetimi', institution: 'Örnek Üniversitesi' },
      { level: 'Yüksek lisans', field: 'Lojistik', institution: 'Kurgu Akademisi' }
    ]
  },
  skills: {
    title: 'Beceriler',
    items: [
      'Ticari müzakere',
      'Teklif ve satın alma maliyeti analizi',
      'ERP sistemleri (SAP, Logo)',
      'MS Excel – pivot tablolar, formüller',
      'Sürücü belgesi (B sınıfı)'
    ]
  },
  languages: {
    title: 'Diller',
    items: ['Türkçe – ana dil', 'İngilizce – C1']
  },
  hobby: {
    title: 'İlgi alanları',
    text: 'Bu bölüm gizlidir ve CV’de görünmez.'
  }
}
