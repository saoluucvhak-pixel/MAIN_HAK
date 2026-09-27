/**
 * HAK PORTAL v2
 * Cổng điều hướng chung cho các hệ thống HAK Group (menu 10 mục chính thức).
 * Portal CHỈ là menu điều hướng (nhúng iframe) — không xử lý business logic,
 * không đụng data, không thay thế phân quyền riêng của từng hệ thống con.
 */

function doGet(e) {
  var thamSo = (e && e.parameter) || {};
  var tpl = HtmlService.createTemplateFromFile('Index');
  tpl.phien = '';
  tpl.loiDangNhap = '';
  if (thamSo.sso) {
    try {
      var email = _xacMinhSso_(thamSo.sso);
      var vaiTro = _vaiTroCua_(email);
      if (vaiTro) {
        tpl.phien = _taoPhien_(email);
      } else {
        tpl.loiDangNhap = 'Tài khoản ' + email + ' chưa được cấp quyền Quản trị hoặc đã bị khóa — liên hệ chủ hệ thống để được thêm vào danh sách.';
      }
    } catch (err) {
      tpl.loiDangNhap = String((err && err.message) || err);
    }
  }
  return tpl.evaluate()
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
  URL_KHO:          'https://script.google.com/macros/s/AKfycbwxw_liqTn4i4TPI6GMNXtSn2T3SLedE4eRbMDAbmJibUaI8VTU1M6eD_j5cp1WQGxckg/exec',
  URL_HOPDONG:      'https://script.google.com/macros/s/AKfycbyakRXr_6FzLwJajEuzyWm55p3fyxncO2djxLn4CififuBnHTTMhsOa2cA5wshLRVnL/exec',
  URL_THANHTOAN:    'https://script.google.com/macros/s/AKfycbw0fvUnm9I7eDwQ2zk-jF29VXg69dUfa7OFKvTfjWQeGIiodn5U398UrTPszNxI2N5HiQ/exec',
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
 * ============================================================
 * ĐĂNG NHẬP GMAIL & PHÂN QUYỀN KHU QUẢN TRỊ (cổng trung gian)
 * ============================================================
 * Portal vẫn access:ANYONE và mở tự do (menu/hướng dẫn/công cụ) — CHỈ khu
 * "⚙️ Quản trị" (sửa URL hệ thống con, quản lý người dùng) mới bắt buộc
 * đăng nhập xác thực qua Gmail, vì lý do sau:
 *
 * Nếu Portal deploy "Execute as: Me" (owner), Session.getActiveUser() trả về
 * RỖNG với bất kỳ ai khác owner mở web app — khiến ADMIN_EMAILS trước đây
 * gần như không chạy được cho người dùng thật. Cách khắc phục (giống hệt
 * cơ chế đã dùng ở HAK_WEBAPP_DNTT_DRAFT — xem docs/ARCHITECTURE.md mục 4b
 * của repo đó): một dự án Apps Script RIÊNG ("Cổng đăng nhập", deploy
 * Execute as: User accessing the web app) đọc đúng email người đang mở nó
 * (chạy dưới quyền người dùng nên luôn xác định được), ký (HMAC-SHA256) kèm
 * hạn dùng 5 phút + mã dùng-1-lần, rồi chuyển tới Portal qua ?sso=<token>.
 * Portal xác minh chữ ký/hạn/nonce, tra vai trò, cấp 1 "phiên" (mã ngẫu
 * nhiên, giữ trong CacheService tối đa 6 giờ). Trình duyệt lưu phiên rồi
 * gửi kèm mọi lời gọi khu Quản trị qua api(phien, tenChucNang, thamSo) —
 * hàm cửa vào DUY NHẤT có kiểm tra quyền theo API_ROUTES.
 *
 * Cài đặt (1 lần, làm trong khu Quản trị sau khi đăng nhập bằng tài khoản
 * chủ script — chủ script luôn là Quản trị mặc định, không cần cấu hình gì):
 *  1. Bấm "📋 Lấy mã nguồn Cổng đăng nhập" trong khu Quản trị.
 *  2. Mở https://script.new, xoá code mặc định, dán mã vừa lấy.
 *  3. Deploy > New deployment > Web app — Execute as: "User accessing the
 *     web app", Who has access: "Anyone with Google account". Deploy xong
 *     copy URL /exec.
 *  4. Dán URL đó vào ô "Link Cổng đăng nhập" trong khu Quản trị, bấm Lưu.
 *  5. Thêm email các Quản trị viên khác ở mục "Người dùng" trong khu Quản trị.
 *
 * ADMIN_EMAILS (Script Property, cấu hình sẵn từ trước) vẫn được giữ làm
 * danh sách Quản trị CỐ ĐỊNH — luôn có quyền, không thể tự khoá nhầm mình
 * qua giao diện web (đúng như QUAN_TRI_CO_DINH của DNTT_DRAFT).
 */
var VAI_TRO = { ADMIN: 'ADMIN' };
var TRANG_THAI_NGUOI_DUNG = { HOAT_DONG: 'Hoạt động', KHOA: 'Khóa' };
var AUTH_CFG = {
  PHIEN_TTL_GIAY: 21600,           // tối đa CacheService cho phép (6 giờ)
  SSO_HIEU_LUC_MS: 5 * 60 * 1000,  // link từ Cổng đăng nhập chỉ dùng được 5 phút
  SSO_NONCE_TTL_GIAY: 900,
  CACHE_NGUOI_DUNG_GIAY: 60,
  PROP_SSO_SECRET: 'SSO_SECRET',
  PROP_CONG_DANG_NHAP_URL: 'SSO_GATEWAY_URL',
  PROP_NGUOI_DUNG: 'PORTAL_NGUOI_DUNG_JSON',
  CACHE_KEY_NGUOI_DUNG: 'portal_nguoi_dung_v1',
  TIEN_TO_PHIEN: 'portal_phien_',
  TIEN_TO_NONCE: 'portal_sso_n_',
  LOI_DANG_NHAP: '[AUTH] ',
  LOI_QUYEN: '[QUYEN] '
};
var MAU_MA_PHIEN = /^[0-9a-f]{64}$/;
var MAU_EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Người đã xác định trong lượt gọi api() hiện tại (mỗi lời gọi Apps Script
// là 1 lần chạy riêng — biến toàn cục khởi tạo lại mỗi lần).
var _nguoiDungHienTai_ = null;

function _chuanHoaEmail_(v) {
  return String(v || '').trim().toLowerCase();
}

/** Danh sách email Quản trị cố định lấy từ Script Property ADMIN_EMAILS —
 * luôn là Quản trị, không đổi/khoá được từ giao diện web. */
function _quanTriCoDinh_() {
  var raw = PropertiesService.getScriptProperties().getProperty('ADMIN_EMAILS') || '';
  return raw.split(',').map(_chuanHoaEmail_).filter(Boolean);
}
function _laQuanTriCoDinh_(email) {
  var e = _chuanHoaEmail_(email);
  return !!e && _quanTriCoDinh_().indexOf(e) >= 0;
}

/** Danh sách Quản trị bổ sung (thêm/khoá được từ khu Người dùng), lưu dạng
 * JSON trong Script Properties — Portal không có Sheet riêng nên không dùng
 * SYS_NguoiDung như DNTT_DRAFT. */
function _docDanhSachNguoiDung_() {
  var cache = CacheService.getScriptCache();
  var raw = cache.get(AUTH_CFG.CACHE_KEY_NGUOI_DUNG);
  if (raw) return JSON.parse(raw);
  var list = [];
  try {
    var stored = PropertiesService.getScriptProperties().getProperty(AUTH_CFG.PROP_NGUOI_DUNG);
    if (stored) list = JSON.parse(stored);
  } catch (e) { list = []; }
  cache.put(AUTH_CFG.CACHE_KEY_NGUOI_DUNG, JSON.stringify(list), AUTH_CFG.CACHE_NGUOI_DUNG_GIAY);
  return list;
}
function _ghiDanhSachNguoiDung_(list) {
  PropertiesService.getScriptProperties().setProperty(AUTH_CFG.PROP_NGUOI_DUNG, JSON.stringify(list));
  CacheService.getScriptCache().remove(AUTH_CFG.CACHE_KEY_NGUOI_DUNG);
}

/** Vai trò hiệu lực của 1 email — 'ADMIN' hoặc null (chưa cấp quyền/đã khoá). */
function _vaiTroCua_(email) {
  var e = _chuanHoaEmail_(email);
  if (!e) return null;
  if (_laQuanTriCoDinh_(e)) return VAI_TRO.ADMIN;
  var nd = _docDanhSachNguoiDung_().filter(function (x) { return x.email === e; })[0];
  if (!nd || nd.trangThai !== TRANG_THAI_NGUOI_DUNG.HOAT_DONG) return null;
  return VAI_TRO.ADMIN;
}

/** Người thao tác của lượt gọi hiện tại — từ phiên (api()), có fallback
 * Session.getActiveUser() phòng khi Portal deploy "Execute as: User
 * accessing the web app" (khi đó không cần qua Cổng đăng nhập vẫn nhận
 * diện được luôn, giống DNTT_DRAFT). */
function _xacDinhNguoiDung_() {
  if (_nguoiDungHienTai_) return _nguoiDungHienTai_;
  var email = '';
  try { email = _chuanHoaEmail_(Session.getActiveUser().getEmail()); } catch (e) {}
  return email ? { email: email, vaiTro: _vaiTroCua_(email) } : null;
}

/** Chặn nếu người thao tác không có quyền `quyen` (VAI_TRO.*). */
function _yeuCauQuyen_(quyen) {
  var nd = _xacDinhNguoiDung_();
  if (!nd) throw new Error(AUTH_CFG.LOI_DANG_NHAP + 'Chưa đăng nhập — vui lòng đăng nhập bằng tài khoản Google đã được cấp quyền Quản trị.');
  if (!nd.vaiTro) throw new Error(AUTH_CFG.LOI_DANG_NHAP + 'Tài khoản ' + nd.email + ' chưa được cấp quyền Quản trị hoặc đã bị khóa.');
  if (nd.vaiTro !== quyen) throw new Error(AUTH_CFG.LOI_QUYEN + 'Tài khoản ' + nd.email + ' không có quyền thực hiện thao tác này.');
  return nd;
}

function _taoMaNgauNhien_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').toLowerCase();
}
function _taoPhien_(email) {
  var phien = _taoMaNgauNhien_();
  CacheService.getScriptCache().put(AUTH_CFG.TIEN_TO_PHIEN + phien, JSON.stringify({ email: email, taoLuc: Date.now() }), AUTH_CFG.PHIEN_TTL_GIAY);
  return phien;
}
function _docPhien_(phien) {
  if (!MAU_MA_PHIEN.test(String(phien || ''))) return '';
  var raw = CacheService.getScriptCache().get(AUTH_CFG.TIEN_TO_PHIEN + phien);
  if (!raw) return '';
  try { return _chuanHoaEmail_(JSON.parse(raw).email); } catch (e) { return ''; }
}

function _laySsoSecret_() {
  var props = PropertiesService.getScriptProperties();
  var secret = props.getProperty(AUTH_CFG.PROP_SSO_SECRET);
  if (!secret) {
    secret = _taoMaNgauNhien_();
    props.setProperty(AUTH_CFG.PROP_SSO_SECRET, secret);
  }
  return secret;
}
function _kyHmac_(data, secret) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(data, secret));
}
function _soSanhAnToan_(a, b) {
  if (a.length !== b.length) return false;
  var khac = 0;
  for (var i = 0; i < a.length; i++) khac |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return khac === 0;
}

/** Xác minh mã từ Cổng đăng nhập: đúng chữ ký, còn hạn, chưa dùng. Trả về email. */
function _xacMinhSso_(token) {
  var secret = PropertiesService.getScriptProperties().getProperty(AUTH_CFG.PROP_SSO_SECRET);
  if (!secret) throw new Error('Cổng đăng nhập chưa được cấu hình — vào khu Quản trị để thiết lập.');
  var parts = String(token || '').split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) throw new Error('Mã đăng nhập không hợp lệ.');
  if (!_soSanhAnToan_(_kyHmac_(parts[0], secret), parts[1])) throw new Error('Mã đăng nhập không hợp lệ (sai chữ ký).');
  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString('UTF-8'));
  } catch (e) {
    throw new Error('Mã đăng nhập không đọc được.');
  }
  if (!payload || typeof payload.exp !== 'number' || payload.exp < Date.now()) throw new Error('Link đăng nhập đã hết hạn — vui lòng đăng nhập lại.');
  var nonce = String(payload.n || '');
  var cache = CacheService.getScriptCache();
  if (!nonce || cache.get(AUTH_CFG.TIEN_TO_NONCE + nonce)) throw new Error('Link đăng nhập đã được dùng — vui lòng đăng nhập lại.');
  cache.put(AUTH_CFG.TIEN_TO_NONCE + nonce, '1', AUTH_CFG.SSO_NONCE_TTL_GIAY);
  var email = _chuanHoaEmail_(payload.email);
  if (!MAU_EMAIL.test(email)) throw new Error('Mã đăng nhập không có email hợp lệ.');
  return email;
}

/** Mã nguồn Cổng đăng nhập (dán vào 1 dự án Apps Script riêng — xem hướng
 * dẫn cài đặt ở khối chú thích phía trên). ADMIN mới xem/lấy được (api()). */
function _maNguonCongDangNhap_(appUrl, secret) {
  var soPhut = AUTH_CFG.SSO_HIEU_LUC_MS / 60000;
  return '// CỔNG ĐĂNG NHẬP - HAK PORTAL\n' +
    '// Dán vào 1 dự án Apps Script MỚI (https://script.new), rồi Deploy > New deployment > Web app:\n' +
    '//   Execute as: User accessing the web app  ·  Who has access: Anyone with Google account\n' +
    '// Mã bí mật bên dưới phải KHỚP với Portal — không chia sẻ file này cho người ngoài.\n' +
    'var APP_URL = ' + JSON.stringify(appUrl) + ';\n' +
    'var SSO_SECRET = ' + JSON.stringify(secret) + ';\n' +
    'var SSO_HIEU_LUC_MS = ' + AUTH_CFG.SSO_HIEU_LUC_MS + ';\n\n' +
    'function doGet(e) {\n' +
    '  var email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();\n' +
    '  if (!email) {\n' +
    '    return HtmlService.createHtmlOutput(\'<p style="font-family:Arial;padding:24px">Không xác định được tài khoản Google. Hãy đăng nhập Google rồi mở lại link này.</p>\');\n' +
    '  }\n' +
    '  var payload = JSON.stringify({ email: email, exp: Date.now() + SSO_HIEU_LUC_MS, n: Utilities.getUuid() });\n' +
    '  var p64 = Utilities.base64EncodeWebSafe(payload, Utilities.Charset.UTF_8);\n' +
    '  var sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(p64, SSO_SECRET));\n' +
    '  var url = APP_URL + "?sso=" + encodeURIComponent(p64 + "." + sig);\n' +
    '  var emailHtml = email.replace(/[&<>"\']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; });\n' +
    '  var html = \'<div style="font-family:Arial,sans-serif;padding:32px;text-align:center">\'\n' +
    '    + \'<h2 style="margin:0 0 8px">HAK Portal</h2>\'\n' +
    '    + \'<p>Tài khoản: <b>\' + emailHtml + \'</b></p>\'\n' +
    '    + \'<a href="\' + url + \'" target="_top" style="display:inline-block;margin-top:12px;padding:12px 24px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Vào Portal</a>\'\n' +
    '    + \'<p style="color:#666;font-size:12px;margin-top:16px">Link có hiệu lực ' + soPhut + ' phút và chỉ dùng được 1 lần.</p></div>\';\n' +
    '  return HtmlService.createHtmlOutput(html).setTitle("Đăng nhập HAK Portal");\n' +
    '}\n';
}

/** CÔNG KHAI (không cần đăng nhập): trạng thái đăng nhập của chính người
 * gọi + link Cổng đăng nhập, để client quyết định hiện màn hình nào. */
function thongTinDangNhap(phien) {
  var emailPhien = _docPhien_(phien);
  var email = emailPhien;
  if (!email) {
    try { email = _chuanHoaEmail_(Session.getActiveUser().getEmail()); } catch (e) {}
  }
  var vaiTro = email ? _vaiTroCua_(email) : null;
  return {
    daDangNhap: !!vaiTro,
    email: email,
    vaiTro: vaiTro || '',
    congDangNhapUrl: PropertiesService.getScriptProperties().getProperty(AUTH_CFG.PROP_CONG_DANG_NHAP_URL) || ''
  };
}

/** CÔNG KHAI: hủy phiên (chỉ xóa đúng mã phiên được gửi lên). */
function dangXuat(phien) {
  if (MAU_MA_PHIEN.test(String(phien || ''))) CacheService.getScriptCache().remove(AUTH_CFG.TIEN_TO_PHIEN + phien);
  return { success: true };
}

/** CỬA VÀO DUY NHẤT cho các chức năng khu Quản trị: kiểm tra phiên + quyền
 * rồi gọi đúng hàm nội bộ đã đăng ký trong API_ROUTES. Chức năng không có
 * trong bảng này thì KHÔNG gọi được từ web (kể cả qua console trình duyệt). */
function api(phien, tenHam, thamSo) {
  var route = Object.prototype.hasOwnProperty.call(API_ROUTES, tenHam) ? API_ROUTES[tenHam] : null;
  if (!route) throw new Error('Chức năng không tồn tại: ' + tenHam);
  _nguoiDungHienTai_ = null;
  try {
    if (phien) {
      var email = _docPhien_(phien);
      if (!email) throw new Error(AUTH_CFG.LOI_DANG_NHAP + 'Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại.');
      _nguoiDungHienTai_ = { email: email, vaiTro: _vaiTroCua_(email) };
    }
    _yeuCauQuyen_(route.quyen);
    return route.fn.apply(null, Array.isArray(thamSo) ? thamSo : []);
  } finally {
    _nguoiDungHienTai_ = null;
  }
}

/** Bảng phân quyền duy nhất cho khu Quản trị — tất cả yêu cầu vai trò ADMIN
 * (Portal chỉ có 1 vai trò gác cổng: Quản trị / không phải Quản trị). */
var API_ROUTES = {
  getAdminInfo: { fn: _getAdminInfo_, quyen: VAI_TRO.ADMIN },
  setUrlOverride: { fn: _setUrlOverride_, quyen: VAI_TRO.ADMIN },
  getNguoiDungList: { fn: _getNguoiDungList_, quyen: VAI_TRO.ADMIN },
  upsertNguoiDung: { fn: _upsertNguoiDung_, quyen: VAI_TRO.ADMIN },
  xoaNguoiDung: { fn: _xoaNguoiDung_, quyen: VAI_TRO.ADMIN },
  getCongDangNhapInfo: { fn: _getCongDangNhapInfo_, quyen: VAI_TRO.ADMIN },
  layMaNguonCongDangNhap: { fn: _layMaNguonCongDangNhap_, quyen: VAI_TRO.ADMIN },
  luuCongDangNhapUrl: { fn: _luuCongDangNhapUrl_, quyen: VAI_TRO.ADMIN },
  taoLaiSsoSecret: { fn: _taoLaiSsoSecret_, quyen: VAI_TRO.ADMIN },
  // Tab "Bảng tổng hợp" — hàm nằm ở BoSung_BackupTongHop.gs; bọc hàm để chỉ
  // tra tên lúc gọi (file đó có thể được nạp sau Code.gs).
  getTongHopInfo: { fn: function () { return _getTongHopInfo_(); }, quyen: VAI_TRO.ADMIN },
  chayTacVuTongHop: { fn: function (tenHam) { return _chayTacVuTuPortal_(tenHam); }, quyen: VAI_TRO.ADMIN },
  datLichTongHop: { fn: function (tenHam, kieu, giaTri, thu) { return _datLichTongHop_(tenHam, kieu, giaTri, thu); }, quyen: VAI_TRO.ADMIN },
  luuCauHinhTongHop: { fn: function (truong, giaTri) { return _luuCauHinhTongHop_(truong, giaTri); }, quyen: VAI_TRO.ADMIN },
  // Menu "Quản lý lâm sản" + tab Quản trị "Thông số BC lâm sản" — hàm ở LamSan.gs
  getLamSanInfo: { fn: function () { return _getLamSanInfo_(); }, quyen: VAI_TRO.ADMIN },
  lapBaoCaoLamSan: { fn: function (p) { return _lapBaoCaoLamSan_(p); }, quyen: VAI_TRO.ADMIN },
  getLamSanCauHinh: { fn: function () { return _getLamSanCauHinh_(); }, quyen: VAI_TRO.ADMIN },
  luuLamSanLink: { fn: function (key, url) { return _luuLamSanLink_(key, url); }, quyen: VAI_TRO.ADMIN },
  luuLamSanThongSoHang: { fn: function (giaTri) { return _luuLamSanThongSoHang_(giaTri); }, quyen: VAI_TRO.ADMIN }
};

/**
 * Trả về toàn bộ cây menu cho frontend.
 * type: 'link' (mở iframe) | 'group' (có children, không click trực tiếp) |
 *       'placeholder' (chưa sẵn sàng, hiện thông báo) | 'guide' (text tĩnh) |
 *       'admin' (màn hình quản trị) | 'lamsan' (báo cáo lâm sản — cần đăng nhập)
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
    { id: 'lamsan',     type: 'lamsan', icon: '🪵', name: 'Quản lý lâm sản' },
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
        { id: 'hd_fsc',       type: 'guide', name: 'Đánh giá FSC',            content: _includeGuide('Guide_FSC') },
        { id: 'hd_lamsan',    type: 'guide', name: 'Quản lý lâm sản',         content: _includeGuide('Guide_LamSan') }
      ]
    },
    { id: 'quantri', type: 'admin', icon: '⚙️', name: 'Quản trị' }
  ];
}

/**
 * Dữ liệu cho màn hình Quản trị: liệt kê URL đang áp dụng cho từng hệ thống.
 * Chỉ gọi được qua api(phien, 'getAdminInfo', []) — đã xác thực Quản trị.
 */
function _getAdminInfo_() {
  var props = PropertiesService.getScriptProperties();
  return {
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
 */
function _setUrlOverride_(key, url) {
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
  return _getAdminInfo_();
}

/**
 * Danh sách Quản trị bổ sung (không tính Quản trị cố định trong ADMIN_EMAILS —
 * nhóm đó chỉ sửa được trực tiếp trong Script Properties, không qua web).
 */
function _getNguoiDungList_() {
  return {
    coDinh: _quanTriCoDinh_(),
    boSung: _docDanhSachNguoiDung_()
  };
}

/** Thêm mới hoặc cập nhật 1 Quản trị bổ sung. trangThai: 'Hoạt động' | 'Khóa'. */
function _upsertNguoiDung_(email, hoTen, trangThai) {
  email = _chuanHoaEmail_(email);
  if (!MAU_EMAIL.test(email)) throw new Error('Email không hợp lệ: ' + email);
  if (_laQuanTriCoDinh_(email)) throw new Error('Tài khoản này đã là Quản trị cố định (ADMIN_EMAILS), không cần thêm lại.');
  if ([TRANG_THAI_NGUOI_DUNG.HOAT_DONG, TRANG_THAI_NGUOI_DUNG.KHOA].indexOf(trangThai) === -1) {
    throw new Error('Trạng thái không hợp lệ.');
  }
  var nguoiThucHien = _xacDinhNguoiDung_();
  var list = _docDanhSachNguoiDung_();
  var i = list.map(function (x) { return x.email; }).indexOf(email);
  var hoTenMoi = String(hoTen || '').trim();
  if (!hoTenMoi && i >= 0) hoTenMoi = list[i].hoTen || ''; // giữ nguyên họ tên cũ khi chỉ đổi trạng thái
  var dong = {
    email: email,
    hoTen: hoTenMoi,
    vaiTro: VAI_TRO.ADMIN,
    trangThai: trangThai,
    capNhatLuc: new Date().toISOString(),
    capNhatBoi: (nguoiThucHien && nguoiThucHien.email) || ''
  };
  if (i >= 0) list[i] = dong; else list.push(dong);
  _ghiDanhSachNguoiDung_(list);
  return _getNguoiDungList_();
}

/** Xoá hẳn 1 Quản trị bổ sung khỏi danh sách (không xoá được Quản trị cố định). */
function _xoaNguoiDung_(email) {
  email = _chuanHoaEmail_(email);
  var list = _docDanhSachNguoiDung_().filter(function (x) { return x.email !== email; });
  _ghiDanhSachNguoiDung_(list);
  return _getNguoiDungList_();
}

/** Thông tin Cổng đăng nhập hiện tại (URL đã lưu, nếu có). */
function _getCongDangNhapInfo_() {
  return {
    congDangNhapUrl: PropertiesService.getScriptProperties().getProperty(AUTH_CFG.PROP_CONG_DANG_NHAP_URL) || ''
  };
}

/** Sinh mã nguồn Cổng đăng nhập để dán vào 1 dự án Apps Script mới —
 * appUrl lấy tự động từ chính deployment hiện tại (ScriptApp.getService().getUrl()). */
function _layMaNguonCongDangNhap_() {
  var appUrl = ScriptApp.getService().getUrl();
  return _maNguonCongDangNhap_(appUrl, _laySsoSecret_());
}

/** Lưu URL Cổng đăng nhập (sau khi deploy dự án riêng ở bước cài đặt). */
function _luuCongDangNhapUrl_(url) {
  url = String(url || '').trim();
  if (url && !/^https:\/\/script\.google\.com\/(a\/[^/]+\/)?macros\/s\/[\w-]+\/exec$/.test(url)) {
    throw new Error('URL Cổng đăng nhập không hợp lệ — phải là link .../exec của web app vừa deploy.');
  }
  var props = PropertiesService.getScriptProperties();
  if (url) props.setProperty(AUTH_CFG.PROP_CONG_DANG_NHAP_URL, url);
  else props.deleteProperty(AUTH_CFG.PROP_CONG_DANG_NHAP_URL);
  return _getCongDangNhapInfo_();
}

/** Đổi mã bí mật (khi nghi bị lộ). Phải dán lại mã nguồn mới vào Cổng đăng nhập. */
function _taoLaiSsoSecret_() {
  PropertiesService.getScriptProperties().setProperty(AUTH_CFG.PROP_SSO_SECRET, _taoMaNgauNhien_());
  return { success: true, message: 'Đã tạo mã bí mật mới — nhớ lấy lại mã nguồn Cổng đăng nhập và dán đè vào dự án Cổng, Deploy > Manage deployments > Edit > New version.' };
}
