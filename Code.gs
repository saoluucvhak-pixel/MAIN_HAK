/**
 * HAK PORTAL v2
 * Cổng điều hướng chung cho các hệ thống HAK Group (menu 10 mục chính thức).
 * Portal CHỈ là menu điều hướng (nhúng iframe) — không xử lý business logic,
 * không đụng data, không thay thế phân quyền riêng của từng hệ thống con.
 */

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('HAK Group - Portal')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * URL mặc định của từng hệ thống con.
 * Có thể ghi đè bằng Script Properties (cùng tên key) khi 1 hệ thống con
 * được deploy lại và đổi URL — không cần sửa code, không cần deploy lại Portal.
 * Cách ghi đè: Project Settings > Script Properties > Add script property
 * (key = URL_QUY, URL_KHO, ... ; value = URL /exec mới).
 *
 * LƯU Ý: mỗi webapp con phải có dòng sau trong hàm doGet() của nó để
 * trình duyệt cho phép nhúng iframe (nếu không, khung sẽ trắng/báo lỗi):
 *   .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
 */
var DEFAULT_URLS = {
  URL_QUY:          'https://script.google.com/macros/s/AKfycbwCWIbL9NRdhSTxJUeUp2KqSXSttR7OEdQLKvqDDMo5xJJss-M03Upptn3rdTlXyb9O/exec',
  URL_KHO:          'https://script.google.com/macros/s/AKfycbw-7O9jKMJrH82F5z8aWSJyJfUwIlPNOKpXe1f0shhxQdOsNh49Z7dwQp0rCDWyivb4/exec',
  URL_HOPDONG:      'https://script.google.com/macros/s/AKfycbwNZPMfF1vZLGqnAOFSUyFWoz7hqFvUGhi90T5ixeoK6H3D1ez_ub0uLUlydnwOTuNX/exec',
  URL_THANHTOAN:    'https://script.google.com/macros/s/AKfycbxNjZ16ZNabQEuBpmxLC6RkIedSxVSh3lm-p41flZa7rNgWVu7Bp9qWsP7n2vpf9FFRaA/exec',
  URL_VAY:          'https://script.google.com/macros/s/AKfycbwO9TiEKQ9jMXtzL8N-5bknrM9m4iPFlNKdB-iq19KFuuPzdF749qkNT6pkyL0ysoI/exec',
  URL_UPDATE_KT:    'https://script.google.com/macros/s/AKfycbzokLFi-9Rs7eegV3VCPWdiBQfUfj6ArVag1JyeiCykmuSu90nZ3vPMxrGUjW-ncCUsFw/exec',
  URL_NHANSU:       'https://script.google.com/macros/s/AKfycbxCM0nc42d9XxrGdF-tFbRKZlY0MfwKidpfWqowcFQB6J6GIyAlzOpFLx9c8pFaZ46Eiw/exec',
  URL_LUONG:        'https://script.google.com/macros/s/AKfycbw4c4ioslORMIAibpeUI18SL2eNfPMkomZrav24Kg5kEEoza8zNuLPYd6FWgRGBLsHd/exec',
  URL_FSC:          'https://script.google.com/macros/s/AKfycbxCMHCC5ET5ec58IPoN-cKqsj6Kr6XMwRvcaIAMRMIjwbaxme6LMUuwEbUABVVTD8nbfA/exec'
};

function _resolveUrl(key) {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty(key) || DEFAULT_URLS[key] || '';
}

/**
 * Đọc nội dung 1 file HTML tĩnh trong project (dùng cho nội dung Hướng dẫn —
 * mỗi hệ thống con 1 file Guide_*.html riêng, đỡ phải nhét text dài vào Code.gs).
 * Trả về text mặc định nếu file chưa có (hệ thống con đó chưa viết hướng dẫn riêng).
 */
function _includeGuide(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    return 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.';
  }
}

/**
 * Danh sách các hệ thống con có thể sửa URL trực tiếp từ màn Quản trị.
 * Dùng chung cho getAdminInfo() và setUrlOverride() để validate key.
 */
var ADMIN_URL_FIELDS = [
  { key: 'URL_QUY',       name: 'Quỹ tiền mặt' },
  { key: 'URL_KHO',       name: 'Kho gỗ keo' },
  { key: 'URL_HOPDONG',   name: 'Hợp đồng mua bán gỗ keo' },
  { key: 'URL_THANHTOAN', name: 'Thanh toán gỗ keo' },
  { key: 'URL_VAY',       name: 'Vay ngân hàng' },
  { key: 'URL_UPDATE_KT', name: 'Update dữ liệu kế toán' },
  { key: 'URL_NHANSU',    name: 'Nhân sự' },
  { key: 'URL_LUONG',     name: 'Tiền lương' },
  { key: 'URL_FSC',       name: 'Đánh giá FSC' }
];

/**
 * Webapp này access:ANYONE nên ai có link cũng gọi được các hàm lộ ra ngoài
 * (kể cả qua console trình duyệt, không chỉ qua nút bấm) — vì vậy setUrlOverride()
 * PHẢI tự kiểm tra quyền ở phía server, không được tin giao diện.
 * Cấp quyền: Project Settings > Script Properties > thêm property
 * ADMIN_EMAILS = "email1@gmail.com,email2@gmail.com".
 */
function _isAdmin() {
  var email = '';
  try { email = (Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (err) { email = ''; }
  if (!email) return false;
  var raw = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
  var allowed = raw.split(',').map(function (s) { return s.trim().toLowerCase(); }).filter(Boolean);
  return allowed.indexOf(email) >= 0;
}

/**
 * Trả về toàn bộ cây menu cho frontend.
 * type: 'link' (mở iframe) | 'group' (có children, không click trực tiếp) |
 *       'placeholder' (chưa sẵn sàng, hiện thông báo) | 'guide' (text tĩnh) |
 *       'admin' (màn hình quản trị)
 */
function getMenu() {
  return [
    { id: 'quy',        type: 'link', icon: '💵', name: 'Quỹ tiền mặt',              url: _resolveUrl('URL_QUY'),       urlKey: 'URL_QUY' },
    { id: 'kho',        type: 'link', icon: '📦', name: 'Kho gỗ keo',                url: _resolveUrl('URL_KHO'),       urlKey: 'URL_KHO' },
    { id: 'hopdong',    type: 'link', icon: '📄', name: 'Hợp đồng mua bán gỗ keo',   url: _resolveUrl('URL_HOPDONG'),   urlKey: 'URL_HOPDONG' },
    { id: 'thanhtoan',  type: 'link', icon: '💰', name: 'Thanh toán gỗ keo',         url: _resolveUrl('URL_THANHTOAN'), urlKey: 'URL_THANHTOAN' },
    { id: 'vay',        type: 'link', icon: '🏦', name: 'Vay ngân hàng',             url: _resolveUrl('URL_VAY'),       urlKey: 'URL_VAY' },
    { id: 'updatekt',   type: 'link', icon: '🔄', name: 'Update dữ liệu kế toán',    url: _resolveUrl('URL_UPDATE_KT'), urlKey: 'URL_UPDATE_KT' },
    { id: 'nhansu',     type: 'link', icon: '👥', name: 'Nhân sự',                   url: _resolveUrl('URL_NHANSU'),    urlKey: 'URL_NHANSU' },
    { id: 'luong',      type: 'link', icon: '🧾', name: 'Tiền lương',                url: _resolveUrl('URL_LUONG'),     urlKey: 'URL_LUONG' },
    { id: 'fsc',        type: 'link', icon: '🌲', name: 'Đánh giá FSC',              url: _resolveUrl('URL_FSC'),       urlKey: 'URL_FSC' },
    {
      id: 'congcu', type: 'group', icon: '🧮', name: 'Công cụ kế toán',
      children: [
        { id: 'gtgt', type: 'placeholder', name: 'Đối chiếu thuế GTGT', note: 'Đang phát triển' }
      ]
    },
    {
      id: 'huongdan', type: 'group', icon: '📘', name: 'Hướng dẫn',
      children: [
        { id: 'hd_quy',       type: 'guide', name: 'Quỹ tiền mặt',            content: _includeGuide('Guide_Quy') },
        { id: 'hd_kho',       type: 'guide', name: 'Kho gỗ keo',              content: _includeGuide('Guide_Kho') },
        { id: 'hd_hopdong',   type: 'guide', name: 'Hợp đồng mua bán gỗ keo', content: _includeGuide('Guide_HopDong') },
        { id: 'hd_thanhtoan', type: 'guide', name: 'Thanh toán gỗ keo',       content: _includeGuide('Guide_ThanhToan') },
        { id: 'hd_vay',       type: 'guide', name: 'Vay ngân hàng',           content: _includeGuide('Guide_Vay') },
        { id: 'hd_updatekt',  type: 'guide', name: 'Update dữ liệu kế toán',  content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_nhansu',    type: 'guide', name: 'Nhân sự',                 content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_luong',     type: 'guide', name: 'Tiền lương',              content: _includeGuide('Guide_Luong') },
        { id: 'hd_fsc',       type: 'guide', name: 'Đánh giá FSC',            content: _includeGuide('Guide_FSC') }
      ]
    },
    { id: 'quantri', type: 'admin', icon: '⚙️', name: 'Quản trị' }
  ];
}

/**
 * Dữ liệu cho màn hình Quản trị: liệt kê URL đang áp dụng cho từng hệ thống.
 * isAdmin quyết định frontend có hiện ô nhập + nút Lưu hay chỉ xem read-only.
 */
function getAdminInfo() {
  var props = PropertiesService.getScriptProperties();
  return {
    isAdmin: _isAdmin(),
    rows: ADMIN_URL_FIELDS.map(function (k) {
      var overridden = !!props.getProperty(k.key);
      return {
        name: k.name,
        key: k.key,
        url: _resolveUrl(k.key),
        source: overridden ? 'Script Properties (ghi đè)' : 'Mặc định trong Code.gs'
      };
    })
  };
}

/**
 * Sửa URL của 1 hệ thống con ngay từ màn Quản trị của webapp — ghi vào
 * Script Properties, không cần vào Project Settings, không cần deploy lại Portal.
 * Truyền url = '' để xóa ghi đè (quay lại DEFAULT_URLS trong Code.gs).
 * Chỉ tài khoản có email trong Script Property ADMIN_EMAILS mới gọi được.
 */
function setUrlOverride(key, url) {
  if (!_isAdmin()) {
    throw new Error('Bạn không có quyền sửa URL. Nhờ quản trị viên thêm email của bạn vào Script Property ADMIN_EMAILS.');
  }
  var field = ADMIN_URL_FIELDS.filter(function (f) { return f.key === key; })[0];
  if (!field) throw new Error('Key không hợp lệ: ' + key);

  url = (url || '').trim();
  var props = PropertiesService.getScriptProperties();
  if (!url) {
    props.deleteProperty(key);
  } else {
    if (!/^https:\/\//i.test(url)) {
      throw new Error('URL phải bắt đầu bằng https://');
    }
    props.setProperty(key, url);
  }
  return getAdminInfo();
}
