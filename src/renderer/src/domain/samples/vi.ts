import type { SampleCvText } from '../sampleCv'

export const vi: SampleCvText = {
  name: 'CV mẫu',
  fullName: 'Nguyễn Thu Hà',
  contacts: {
    // Brak oficjalnej puli numerów fikcyjnych (Cục Viễn thông) – zastępczy numer komórkowy z samymi zerami.
    phone: { label: 'Điện thoại', value: '+84 900 000 000' },
    email: { label: 'Email', value: 'thuha.nguyen@example.com' },
    linkedin: { label: 'LinkedIn', value: 'linkedin.com/in/thuha-nguyen' },
    city: { label: 'Thành phố', value: 'Hải Phòng' }
  },
  summary: 'Chuyên viên mua hàng với hơn mười năm kinh nghiệm trong ngành sản xuất và bán lẻ. Tôi đàm phán điều kiện hiệu quả, xây dựng quan hệ lâu dài với nhà cung cấp và duy trì nguồn cung ổn định.',
  experience: {
    title: 'Kinh nghiệm làm việc',
    positions: [
      {
        role: 'Chuyên viên mua hàng cấp cao',
        company: 'Công ty TNHH Sản xuất Hư Cấu',
        location: 'Hải Phòng',
        bullets: [
          'Đàm phán giá và điều kiện thương mại với nhà cung cấp trong và ngoài nước.',
          'Quản lý danh mục hơn 60 nhà cung cấp linh kiện và vật tư phụ.',
          'Chuẩn bị và phân tích yêu cầu báo giá cùng bảng so sánh báo giá.',
          'Triển khai đánh giá nhà cung cấp hằng quý, giúp rút ngắn 15% thời gian giao hàng.',
          'Phối hợp với bộ phận chất lượng xử lý khiếu nại và đánh giá nhà cung cấp.',
          'Theo dõi mức tồn kho và lập kế hoạch đặt hàng cùng bộ phận sản xuất.',
          'Báo cáo khoản tiết kiệm mua hàng cho ban giám đốc.',
          'Hướng dẫn nhân viên mới của bộ phận mua hàng.'
        ]
      },
      {
        role: 'Chuyên viên mua hàng',
        company: 'Công ty Cổ phần Thương mại Mẫu',
        location: 'Hà Nội',
        bullets: [
          'Đặt hàng theo kế hoạch bán hàng và ngân sách của phòng.',
          'Tìm kiếm và đánh giá nhà cung cấp mới ở châu Âu và châu Á.',
          'Đàm phán hợp đồng khung và điều kiện thanh toán.',
          'Theo dõi tiến độ giao hàng và xử lý vấn đề logistics.',
          'Quản lý dữ liệu gốc về nhà cung cấp và vật tư trên hệ thống ERP.',
          'Người dùng chủ chốt trong dự án chuyển đổi hệ thống ERP.',
          'Lập báo cáo mua hàng hằng tuần.'
        ]
      },
      {
        role: 'Trợ lý mua hàng',
        company: 'Công ty TNHH Logistics Demo',
        location: 'Hà Nội',
        bullets: [
          'Lập đơn đặt hàng và theo dõi tiến độ thực hiện.',
          'Kiểm tra hóa đơn và chứng từ giao hàng.',
          'Trao đổi thư từ với nhà cung cấp bằng tiếng Việt và tiếng Anh.',
          'Lưu trữ hồ sơ mua hàng.',
          'Hỗ trợ nhóm trong các đợt kiểm kê.'
        ]
      },
      {
        role: 'Nhân viên chăm sóc khách hàng',
        company: 'Đại lý Du lịch Thử Nghiệm',
        location: 'Đà Nẵng',
        bullets: [
          'Phục vụ khách hàng qua điện thoại, email và tại văn phòng.',
          'Chuẩn bị chương trình tour và đặt chỗ.',
          'Xử lý khiếu nại.',
          'Phối hợp với đối tác nước ngoài.'
        ]
      }
    ]
  },
  education: {
    title: 'Học vấn',
    entries: [
      { level: 'Chứng chỉ sau đại học', field: 'Quản trị mua hàng', institution: 'Trường Đại học Mẫu' },
      { level: 'Thạc sĩ', field: 'Logistics', institution: 'Học viện Hư Cấu' }
    ]
  },
  skills: {
    title: 'Kỹ năng',
    items: [
      'Đàm phán thương mại',
      'Phân tích báo giá và chi phí mua hàng',
      'Hệ thống ERP (SAP, MISA)',
      'MS Excel – bảng tổng hợp (pivot), công thức',
      'Giấy phép lái xe hạng B'
    ]
  },
  languages: {
    title: 'Ngôn ngữ',
    items: ['Tiếng Việt – bản ngữ', 'Tiếng Anh – C1']
  },
  hobby: {
    title: 'Sở thích',
    text: 'Mục này đang ẩn và không xuất hiện trên CV.'
  }
}
