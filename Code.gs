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
  URL_QUY:          'https://script.google.com/macros/s/AKfycbxYLFKIay6WstaVnd-ylWyqSeJhKJo1YVeablwmfytNmI0dCQVC5LIB6tgXetaxp0oA/exec',
  URL_KHO:          'https://script.google.com/macros/s/AKfycbxrOuwbgruu5p--h2E2UwMWUGM9CmxQZsGH5gu8D-ccgfZj1xB6kLRN2RHpEnf4EkZK0Q/exec',
  URL_HOPDONG:      'https://script.google.com/macros/s/AKfycbzAibKTnhAe1PQghyJy9CfuwMJ5JQYmS-9qslXLKBWIB-PrstsVwmddSc8d4LjHMUDT/exec',
  URL_THANHTOAN:    'https://script.google.com/macros/s/AKfycbwvyz6JCkX6VbrgB3icTQZ5zJ96f3HYz8-ePTgI8L94omqxr1JHSdg1RHT8FzjinA1C/exec',
  URL_VAY:          'https://script.google.com/macros/s/AKfycbxnHJ9-3yN9pvnAT9WQf-kEnHcn-CN-kZpkLGzyXWRCpEA-KnbB-dld7j98m6KxqPcM/exec',
  URL_UPDATE_KT:    'https://script.google.com/macros/s/AKfycbwL_4AuypxkI5g5N0TBC0sYUWhC9pJxmeBdfD2Yx3AomDHfUOe458weSFyw7QjJudKutw/exec',
  URL_NHANSU:       'https://script.google.com/macros/s/AKfycbzsOYPhbjPfybPMvYTSTgQryY71cb5IiQ8uTfuP0oJQvSjB2i5_f6hzjVacy1oLdn2NeQ/exec',
  URL_LUONG:        'https://script.google.com/macros/s/AKfycbw9U5JN0kaXDRTCBUvTtDUZRRyWtbSE_z03Lpb8NYx4Sr3gALto23MzuU8bKalXC4X8/exec',
  URL_FSC:          'https://script.google.com/macros/s/AKfycbzT0-9pyjBk3-4vE0NRHJ7PjW7Y-4GUVEAeacE5iMfA4u8-xOFaallj1zhgS32X8OTJlw/exec'
};

function _resolveUrl(key) {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty(key) || DEFAULT_URLS[key] || '';
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
        { id: 'hd_quy',       type: 'guide', name: 'Quỹ tiền mặt',            content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_kho',       type: 'guide', name: 'Kho gỗ keo',              content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_hopdong',   type: 'guide', name: 'Hợp đồng mua bán gỗ keo', content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_thanhtoan', type: 'guide', name: 'Thanh toán gỗ keo',       content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_vay',       type: 'guide', name: 'Vay ngân hàng',           content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_updatekt',  type: 'guide', name: 'Update dữ liệu kế toán',  content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_nhansu',    type: 'guide', name: 'Nhân sự',                 content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_luong',     type: 'guide', name: 'Tiền lương',              content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' },
        { id: 'hd_fsc',       type: 'guide', name: 'Đánh giá FSC',            content: 'Chưa có nội dung hướng dẫn — sẽ cập nhật sau.' }
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
