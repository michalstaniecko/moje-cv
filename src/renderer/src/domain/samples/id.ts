import type { SampleCvText } from '../sampleCv'

export const id: SampleCvText = {
  name: 'Contoh CV',
  fullName: 'Dewi Contoh',
  contacts: {
    phone: { label: 'Telepon', value: '+62 812 0000 0000' },
    email: { label: 'Email', value: 'dewi.contoh@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/dewi-contoh' },
    city: { label: 'Kota', value: 'Surabaya' }
  },
  summary: 'Spesialis pengadaan dengan lebih dari sepuluh tahun pengalaman di industri manufaktur dan ritel. Saya menegosiasikan syarat yang efektif, membangun hubungan jangka panjang dengan pemasok, dan menjaga kelancaran pasokan.',
  experience: {
    title: 'Pengalaman kerja',
    positions: [
      {
        role: 'Senior Procurement Specialist',
        company: 'PT Manufaktur Fiktif',
        location: 'Surabaya',
        bullets: [
          'Negosiasi harga dan syarat komersial dengan pemasok dalam dan luar negeri.',
          'Mengelola portofolio lebih dari 60 pemasok komponen dan bahan penunjang.',
          'Menyiapkan dan menganalisis permintaan penawaran serta perbandingan penawaran.',
          'Menerapkan evaluasi pemasok per kuartal yang memangkas waktu kirim 15%.',
          'Bekerja sama dengan tim mutu dalam keluhan dan audit pemasok.',
          'Memantau tingkat stok dan merencanakan pesanan bersama produksi.',
          'Melaporkan penghematan pengadaan kepada direksi.',
          'Membimbing anggota baru tim pengadaan.'
        ]
      },
      {
        role: 'Procurement Specialist',
        company: 'PT Niaga Contoh Tbk',
        location: 'Jakarta',
        bullets: [
          'Membuat pesanan sesuai rencana penjualan dan anggaran departemen.',
          'Mencari dan mengkualifikasi pemasok baru di Eropa dan Asia.',
          'Negosiasi perjanjian kerangka dan syarat pembayaran.',
          'Memantau ketepatan pengiriman dan mengatasi masalah logistik.',
          'Mengelola data induk pemasok dan material di sistem ERP.',
          'Key user dalam proyek migrasi sistem ERP.',
          'Menyusun laporan pengadaan mingguan.'
        ]
      },
      {
        role: 'Staf Administrasi Pengadaan',
        company: 'PT Demo Logistik',
        location: 'Jakarta',
        bullets: [
          'Menerbitkan purchase order dan memantau pemenuhannya.',
          'Memeriksa faktur dan dokumen pengiriman.',
          'Korespondensi dengan pemasok dalam bahasa Indonesia dan Inggris.',
          'Mengarsipkan dokumen pengadaan.',
          'Membantu tim saat stock opname.'
        ]
      },
      {
        role: 'Staf Layanan Pelanggan Junior',
        company: 'Biro Perjalanan Uji',
        location: 'Bandung',
        bullets: [
          'Melayani pelanggan lewat telepon, email, dan di kantor.',
          'Menyiapkan penawaran dan pemesanan perjalanan.',
          'Menangani keluhan.',
          'Bekerja sama dengan mitra di luar negeri.'
        ]
      }
    ]
  },
  education: {
    title: 'Pendidikan',
    entries: [
      { level: 'Magister (S2)', field: 'Manajemen Pengadaan', institution: 'Universitas Contoh' },
      { level: 'Sarjana (S1)', field: 'Logistik', institution: 'Institut Fiktif' }
    ]
  },
  skills: {
    title: 'Keahlian',
    items: [
      'Negosiasi komersial',
      'Analisis penawaran dan biaya pembelian',
      'Sistem ERP (SAP, Oracle)',
      'MS Excel – pivot table, rumus',
      'SIM A'
    ]
  },
  languages: {
    title: 'Bahasa',
    items: ['Bahasa Indonesia – penutur asli', 'Bahasa Inggris – C1']
  },
  hobby: {
    title: 'Minat',
    text: 'Bagian ini disembunyikan dan tidak muncul di CV.'
  }
}
