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
  URL_QUY:          'https://script.google.com/macros/s/AKfycbyX1g0hc770dJzIAcREgBcg3wVAoiQYgFcLoTZoYJzXqfRUW6fGXv9TC9GYIcUOCpqu/exec',
  URL_KHO:          'https://script.google.com/macros/s/AKfycbx5Cphc5FSTzCiRRBo1zWbBROsmTa7q-1aVgbZgKQGOpvA9oQxa412foTtqBMoiUgNpIg/exec',
  URL_HOPDONG:      'https://script.google.com/macros/s/AKfycbyVjEB2QdM8KS9GwHxN5hbv2bvpvILRvQ8NlChfPDww79_l3ep0R5ciYe_yQIXY5lJm/exec',
  URL_THANHTOAN:    'https://script.google.com/macros/s/AKfycby0UxAtq6WOEoVH_Pw9GQyHDO0CTWKAIjyKyfTYW_hcdqUwbwH2rbEtsG5l9M_TVr4LMQ/exec',
  URL_VAY:          'https://script.google.com/macros/s/AKfycbxyZ8ZtO0ccPOoHDU_f0g--ib15lhHe-SlgEhnDJ6sGuAD-j6WwdmDpLghrf4IAaF7G/exec',
  URL_UPDATE_KT:    'https://script.google.com/macros/s/AKfycbzokLFi-9Rs7eegV3VCPWdiBQfUfj6ArVag1JyeiCykmuSu90nZ3vPMxrGUjW-ncCUsFw/exec',
  URL_NHANSU:       'https://script.google.com/macros/s/AKfycbxwGTeM1Y0EEF2bIsdRmbREoMp7_Lz9yJbWZpnoXEIzfJJSUTu_LObbJD9TvfDJohupOw/exec',
  URL_LUONG:        'https://script.google.com/macros/s/AKfycbw9U5JN0kaXDRTCBUvTtDUZRRyWtbSE_z03Lpb8NYx4Sr3gALto23MzuU8bKalXC4X8/exec',
  URL_FSC:          'https://script.google.com/macros/s/AKfycbwE3DGYImUdRnD3SHC_YBbt0p0fsgjAW5xzrtYgKyk7yq6O5AvD9FN4B6HDLbIu8c34aw/exec'
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
 * Danh sách công cụ độc lập (file HTML tự chạy trên trình duyệt, không cần
 * deploy webapp riêng) được phép nhúng qua getToolContent() — chỉ cho phép
 * đúng các file trong danh sách này, không đọc file tuỳ ý theo tên client gửi lên.
 */
var TOOL_FILES = ['Tool_PhanBoKhoiLuong', 'Tool_DoiChieuThueGTGT'];

/**
 * Trả về nội dung HTML đầy đủ của 1 công cụ độc lập để client nhúng vào
 * iframe qua srcdoc (xem type:'tool' trong getMenu() và selectItem() ở Index.html).
 */
function getToolContent(toolFile) {
  if (TOOL_FILES.indexOf(toolFile) === -1) {
    throw new Error('Công cụ không hợp lệ: ' + toolFile);
  }
  return HtmlService.createHtmlOutputFromFile(toolFile).getContent();
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
        { id: 'cc_doichieugtgt', type: 'tool', name: 'Đối chiếu thuế GTGT', toolFile: 'Tool_DoiChieuThueGTGT' },
        { id: 'cc_phanbokhoiluong', type: 'tool', name: 'Phân bổ khối lượng tính lương', toolFile: 'Tool_PhanBoKhoiLuong' }
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
        { id: 'hd_nhansu',    type: 'guide', name: 'Nhân sự',                 content: _includeGuide('Guide_NhanSu') },
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
