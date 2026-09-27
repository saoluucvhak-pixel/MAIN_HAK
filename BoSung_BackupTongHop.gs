/**
 * ============================================================
 * BẢNG TỔNG HỢP (HoSoKeo_DN) — ĐỒNG BỘ SỐ LIỆU + SAO LƯU + TRIGGER
 * ============================================================
 * Các chức năng trong file này được điều khiển từ khu "⚙️ Quản trị" của
 * Portal (tab "Bảng tổng hợp"): chạy ngay, đặt lịch chạy tự động (trigger),
 * mở thư mục sao lưu, mở trang Trigger của dự án.
 *
 * Portal là dự án Apps Script ĐỘC LẬP (không gắn với Sheet nào) nên
 * SpreadsheetApp.getActiveSpreadsheet()/getUi() không dùng được — mọi chức
 * năng mở Bảng tổng hợp theo URL cấu hình (TONGHOP_URL, mặc định bên dưới,
 * sửa được ngay trong khu Quản trị).
 *
 * Tên các hàm công khai (dongBoDuLieuToanDienV12, saoLuuDinhKy, ...) giữ
 * nguyên như cũ để trigger đã tạo trước đây vẫn chạy được — nay mỗi lần
 * chạy đều qua _chayTacVuTongHop_() (khoá chống chạy chồng + ghi nhật ký).
 */
var TONG_HOP_CFG = {
  // Nơi lưu dữ liệu đồng bộ (file "HoSoKeo_DN")
  DEFAULT_TONGHOP_URL: 'https://docs.google.com/spreadsheets/d/1PfXmgnO4ad1Aourjcjoh7hZxL6mVuywL73wHle0oq6I/edit',
  // ID Thư mục BACKUP tổng
  DEFAULT_BACKUP_FOLDER_ID: '1TMAjOkAew6m0vBM9KvLgPbODSUofFjrS',
  PROP_TONGHOP_URL: 'TONGHOP_URL',
  PROP_BACKUP_FOLDER_ID: 'BACKUP_FOLDER_ID',
  PROP_NHAT_KY: 'TONGHOP_NHAT_KY_JSON',
  PROP_LICH: 'TONGHOP_LICH_JSON',
  SO_DONG_NHAT_KY: 30,
  CHO_KHOA_MS: 10000,
  // Chống timeout: Apps Script dừng cứng mỗi lần chạy ở 6 phút. Tác vụ tự
  // tạm dừng an toàn khi đã chạy quá NGAN_SACH_MS rồi hẹn trigger chạy tiếp.
  NGAN_SACH_MS: 270000,             // 4,5 phút
  DU_TRU_GHI_MS: 90000,             // cần còn >= 1,5 phút mới bắt đầu pha ghi dữ liệu
  CHO_CHAY_TIEP_MS: 60000,          // chạy tiếp sau 1 phút
  SO_LAN_CHAY_TIEP_TOI_DA: 20,
  PROP_CHO_CHAY_TIEP: 'TONGHOP_CHO_CHAY_TIEP_JSON',
  HAM_CHAY_TIEP: 'tiepTucTacVuTongHop',
  SHEET_HOSOKEO: 'HoSoKeo_DN',
  SHEET_HOSORUNG: 'HoSoRung_DN',
  SHEET_TOADO: 'ToaDoRung_DN'
};

// CẤU HÌNH THÔNG TIN FILE NGUỒN
var CAU_HINH_FILE = {
  // FILE 1: FILE "DNTT_GK_DN" (Đề nghị thanh toán - Giám tải Doanh nghiệp)
  // -> Vai trò: Nơi tiếp nhận dữ liệu thô ban đầu, cần lọc sạch dòng trống
  //             và là nguồn bốc dữ liệu chính (Số xe, mã cân, ngày tháng...) mang đi đồng bộ.
  urlFile1: "https://docs.google.com/spreadsheets/d/1oUm87_gbDbnuPc_We0dyZ_e4kHXBHXs95AQAxp5okYo/edit",

  // FILE 2: FILE "HD_NCC" (Hợp đồng Nhà cung cấp)
  // -> Vai trò: Nơi lưu thông tin gốc của đối tác. Code dùng "Mã hợp đồng" để sang đây
  //             tra cứu tự động: Mã khách hàng, Tên chủ rừng và Địa chỉ khu rừng.
  urlFile2: "https://docs.google.com/spreadsheets/d/1cv11ORWuAF3Sit4f-kA0xrP6-ab4SF-7LEdkCvGi_gI/edit",

  // FILE 3: FILE "PhieuCan_DN" (Dữ liệu Phiếu cân Doanh nghiệp)
  // -> Vai trò: Nơi lưu dữ liệu trạm cân vật lý. Code dùng "Mã cân (Cột E)" để sang đây
  //             rút trích thông tin chính xác về: Giờ vào, Giờ ra và Khối lượng hàng.
  urlFile3: "https://docs.google.com/spreadsheets/d/1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g/edit",

  // FILE 4: "BaoGiaNhapGoKeo_DN"
  urlFile4: "https://docs.google.com/spreadsheets/d/1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0/edit?usp=sharing"
};

/**
 * Danh sách tác vụ được phép chạy/đặt lịch từ khu Quản trị — chỉ đúng các
 * hàm này, không gọi hàm tuỳ ý theo tên client gửi lên.
 */
var TAC_VU_TONG_HOP = {
  dongBoDuLieuToanDienV12:     { ten: '🔄 Đồng bộ dữ liệu toàn diện (V12)', moTa: 'DNTT_GK_DN + HD_NCC + PhieuCan_DN → sheet HoSoKeo_DN', fn: _tvDongBoToanDien_ },
  dongBoDuLieuLamHoSoRung:     { ten: '🌳 Đồng bộ dữ liệu rừng',            moTa: 'HD_NCC + HD_RUNG → sheet HoSoRung_DN (ghi đè toàn bộ)', fn: _tvDongBoHoSoRung_ },
  capNhatThongMinhToaDoRung:   { ten: '📍 Cập nhật tọa độ rừng',            moTa: 'HD_GPS + HD_RUNG → sheet ToaDoRung_DN (thêm mới + làm mới)', fn: _tvCapNhatToaDo_ },
  saoLuuDinhKy:                { ten: '💾 Sao lưu định kỳ',                 moTa: 'Copy 4 file nguồn + Bảng tổng hợp vào thư mục BACKUP_<ngày giờ>', fn: _tvSaoLuu_ },
  chuanHoaDuLieuCotHIJ:        { ten: '📏 Chuẩn hóa cột phiếu cân (H/I/J)', moTa: 'PhieuCan_DN: giá trị > 70.000 ở cột H, I, J chia 1000', fn: _tvChuanHoaHIJ_ },
  xoaDongNhanhNhatGiuDinhDang: { ten: '🧹 Xóa dòng lỗi phiếu cân',          moTa: 'PhieuCan_DN: xoá dòng cột W trống hoặc cột Y = "Lỗi ĐK/Báo giá"', fn: _tvXoaDongLoiPhieuCan_ }
};

// ---------- Hàm công khai (menu cũ / trigger gọi trực tiếp theo tên) ----------
function dongBoDuLieuToanDienV12(e)     { return _chayTacVuTongHop_('dongBoDuLieuToanDienV12', _nguonChay_(e)); }
function dongBoDuLieuLamHoSoRung(e)     { return _chayTacVuTongHop_('dongBoDuLieuLamHoSoRung', _nguonChay_(e)); }
function capNhatThongMinhToaDoRung(e)   { return _chayTacVuTongHop_('capNhatThongMinhToaDoRung', _nguonChay_(e)); }
function saoLuuDinhKy(e)                { return _chayTacVuTongHop_('saoLuuDinhKy', _nguonChay_(e)); }
function chuanHoaDuLieuCotHIJ(e)        { return _chayTacVuTongHop_('chuanHoaDuLieuCotHIJ', _nguonChay_(e)); }
function xoaDongNhanhNhatGiuDinhDang(e) { return _chayTacVuTongHop_('xoaDongNhanhNhatGiuDinhDang', _nguonChay_(e)); }

/** Trigger 1 lần do hệ thống tự hẹn khi 1 tác vụ tạm dừng vì sắp hết giờ. */
function tiepTucTacVuTongHop() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === TONG_HOP_CFG.HAM_CHAY_TIEP) ScriptApp.deleteTrigger(t);
  });
  var cho = _docJsonProp_(TONG_HOP_CFG.PROP_CHO_CHAY_TIEP, {});
  var tenHam = Object.keys(cho).filter(function (k) { return TAC_VU_TONG_HOP[k]; })[0];
  try {
    if (tenHam) _chayTacVuTongHop_(tenHam, 'Tự chạy tiếp (lần ' + cho[tenHam].lan + ')');
  } catch (err) {
    Logger.log('Chạy tiếp ' + tenHam + ' lỗi: ' + err);
  } finally {
    // Còn tác vụ chờ (tác vụ khác, hoặc vừa rồi bị khoá do tác vụ khác đang chạy) → hẹn tiếp
    if (Object.keys(_docJsonProp_(TONG_HOP_CFG.PROP_CHO_CHAY_TIEP, {})).length) _henChayTiep_();
  }
}

function _nguonChay_(e) {
  return (e && e.triggerUid) ? 'Trigger tự động' : 'Trình soạn thảo Apps Script';
}

// ---------- Cấu hình ----------
function _tongHopUrl_() {
  return PropertiesService.getScriptProperties().getProperty(TONG_HOP_CFG.PROP_TONGHOP_URL) || TONG_HOP_CFG.DEFAULT_TONGHOP_URL;
}
function _backupFolderId_() {
  return PropertiesService.getScriptProperties().getProperty(TONG_HOP_CFG.PROP_BACKUP_FOLDER_ID) || TONG_HOP_CFG.DEFAULT_BACKUP_FOLDER_ID;
}
function _moBangTongHop_() {
  try {
    return SpreadsheetApp.openByUrl(_tongHopUrl_());
  } catch (err) {
    throw new Error('Không mở được Bảng tổng hợp (' + _tongHopUrl_() + ') — kiểm tra URL và quyền truy cập của tài khoản chủ script.');
  }
}
function _laySheetTongHop_(tenSheet) {
  var sh = _moBangTongHop_().getSheetByName(tenSheet);
  if (!sh) throw new Error("Không tìm thấy sheet '" + tenSheet + "' trong Bảng tổng hợp.");
  return sh;
}
function _moFileNguon_(url, tenFile) {
  try {
    return SpreadsheetApp.openByUrl(url);
  } catch (err) {
    throw new Error('Không thể mở file nguồn ' + tenFile + ' — kiểm tra lại quyền truy cập hoặc URL.');
  }
}

// ---------- Ngân sách thời gian (chống timeout 6 phút) ----------
var _hanChotTacVu_ = 0;

/** Số ms còn lại trước hạn chót của lượt chạy hiện tại. */
function _conLaiMs_() {
  return _hanChotTacVu_ ? _hanChotTacVu_ - Date.now() : Infinity;
}

/** Gọi tại các điểm dừng an toàn (chưa ghi dở dữ liệu): nếu thời gian còn
 * lại < duTruMs thì ném tín hiệu tạm dừng — tác vụ sẽ được chạy lại từ đầu
 * sau 1 phút, và vì mọi bước đều lặp lại được (xoá dòng trống, chỉ ghi dòng
 * chưa có, ghi đè toàn bộ) nên lần sau làm tiếp đúng phần còn lại. */
function _kiemTraThoiGian_(tienDo, duTruMs) {
  if (_conLaiMs_() >= (duTruMs || 0)) return;
  var e = new Error('Tạm dừng để tránh quá 6 phút' + (tienDo ? ' (' + tienDo + ')' : '') + '.');
  e.tamDung = true;
  throw e;
}

/** Tạo đúng 1 trigger chạy tiếp (nếu chưa có). */
function _henChayTiep_() {
  var daCo = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === TONG_HOP_CFG.HAM_CHAY_TIEP;
  });
  if (!daCo) ScriptApp.newTrigger(TONG_HOP_CFG.HAM_CHAY_TIEP).timeBased().after(TONG_HOP_CFG.CHO_CHAY_TIEP_MS).create();
}

function _datChoChayTiep_(tenHam, co) {
  var cho = _docJsonProp_(TONG_HOP_CFG.PROP_CHO_CHAY_TIEP, {});
  if (co) cho[tenHam] = { lan: ((cho[tenHam] && cho[tenHam].lan) || 0) + 1, luc: new Date().toISOString() };
  else delete cho[tenHam];
  _ghiJsonProp_(TONG_HOP_CFG.PROP_CHO_CHAY_TIEP, cho);
  return cho[tenHam];
}

/** Xoá các dòng được đánh dấu, gom các dòng liền nhau thành 1 lệnh
 * deleteRows (nhanh hơn rất nhiều so với deleteRow từng dòng), duyệt từ
 * dưới lên để không lệch chỉ số. danhDau[i] ứng với dòng dongBatDau + i. */
function _xoaCacDong_(sheet, dongBatDau, danhDau) {
  var daXoa = 0;
  var i = danhDau.length - 1;
  while (i >= 0) {
    if (!danhDau[i]) { i--; continue; }
    var cuoi = i;
    while (i - 1 >= 0 && danhDau[i - 1]) i--;
    _kiemTraThoiGian_('đã xoá ' + daXoa + ' dòng ở sheet ' + sheet.getName());
    sheet.deleteRows(dongBatDau + i, cuoi - i + 1);
    daXoa += cuoi - i + 1;
    i--;
  }
  return daXoa;
}

// ---------- Chạy tác vụ: khoá + nhật ký + chạy tiếp khi sắp timeout ----------
function _chayTacVuTongHop_(tenHam, nguon) {
  var tv = TAC_VU_TONG_HOP[tenHam];
  if (!tv) throw new Error('Tác vụ không hợp lệ: ' + tenHam);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(TONG_HOP_CFG.CHO_KHOA_MS)) {
    throw new Error('Đang có 1 tác vụ Bảng tổng hợp khác chạy — vui lòng thử lại sau ít phút.');
  }
  var batDau = Date.now();
  _hanChotTacVu_ = batDau + TONG_HOP_CFG.NGAN_SACH_MS;
  try {
    var thongDiep = tv.fn();
    _datChoChayTiep_(tenHam, false);
    _ghiNhatKyTongHop_(tenHam, nguon, true, thongDiep, batDau);
    Logger.log(tv.ten + ': ' + thongDiep);
    return { success: true, message: thongDiep };
  } catch (err) {
    var loi = String((err && err.message) || err);
    if (err && err.tamDung) {
      var cho = _datChoChayTiep_(tenHam, true);
      if (cho.lan <= TONG_HOP_CFG.SO_LAN_CHAY_TIEP_TOI_DA) {
        _henChayTiep_();
        var msg = '⏸ ' + loi + ' Hệ thống tự chạy tiếp sau ~1 phút (lần ' + cho.lan + ').';
        _ghiNhatKyTongHop_(tenHam, nguon, true, msg, batDau);
        return { success: true, tamDung: true, message: msg };
      }
      _datChoChayTiep_(tenHam, false);
      loi += ' Đã tự chạy tiếp ' + TONG_HOP_CFG.SO_LAN_CHAY_TIEP_TOI_DA + ' lần vẫn chưa xong — dừng hẳn, cần kiểm tra dữ liệu nguồn.';
    } else {
      _datChoChayTiep_(tenHam, false);
    }
    _ghiNhatKyTongHop_(tenHam, nguon, false, loi, batDau);
    Logger.log(tv.ten + ' — LỖI: ' + loi);
    throw new Error(loi);
  } finally {
    _hanChotTacVu_ = 0;
    lock.releaseLock();
  }
}

function _docJsonProp_(key, macDinh) {
  try {
    var raw = PropertiesService.getScriptProperties().getProperty(key);
    return raw ? JSON.parse(raw) : macDinh;
  } catch (e) { return macDinh; }
}
function _ghiJsonProp_(key, val) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(val));
}

function _ghiNhatKyTongHop_(tenHam, nguon, ok, thongDiep, batDau) {
  try {
    var list = _docJsonProp_(TONG_HOP_CFG.PROP_NHAT_KY, []);
    list.unshift({
      tacVu: tenHam,
      luc: new Date(batDau).toISOString(),
      giay: Math.round((Date.now() - batDau) / 1000),
      nguon: nguon || '',
      ok: ok,
      thongDiep: String(thongDiep || '').slice(0, 300)
    });
    _ghiJsonProp_(TONG_HOP_CFG.PROP_NHAT_KY, list.slice(0, TONG_HOP_CFG.SO_DONG_NHAT_KY));
  } catch (e) {
    Logger.log('Không ghi được nhật ký: ' + e);
  }
}

// ---------- Trigger (đặt lịch chạy tự động) ----------
var THU_TRONG_TUAN = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
var TEN_THU = { MONDAY: 'Thứ 2', TUESDAY: 'Thứ 3', WEDNESDAY: 'Thứ 4', THURSDAY: 'Thứ 5', FRIDAY: 'Thứ 6', SATURDAY: 'Thứ 7', SUNDAY: 'Chủ nhật' };

function _moTaLich_(lich) {
  if (!lich) return '';
  if (lich.kieu === 'gio') return 'Mỗi ' + lich.soGio + ' giờ';
  if (lich.kieu === 'ngay') return 'Hằng ngày lúc ' + lich.gio + 'h';
  if (lich.kieu === 'tuan') return 'Hằng tuần ' + (TEN_THU[lich.thu] || lich.thu) + ' lúc ' + lich.gio + 'h';
  return '';
}

/**
 * Đặt lịch cho 1 tác vụ: xoá trigger cũ của đúng hàm đó rồi tạo mới.
 * kieu: 'tat' | 'gio' (giaTri = số giờ 1/2/4/6/8/12) | 'ngay' (gio 0-23) |
 *       'tuan' (thu = MONDAY..SUNDAY, gio 0-23).
 * Trigger thuộc tài khoản chủ script (Portal deploy "Execute as: Me").
 */
function _datLichTongHop_(tenHam, kieu, giaTri, thu) {
  if (!TAC_VU_TONG_HOP[tenHam]) throw new Error('Tác vụ không hợp lệ: ' + tenHam);
  var lich = null;
  var soGio = parseInt(giaTri, 10);
  if (kieu === 'gio') {
    if ([1, 2, 4, 6, 8, 12].indexOf(soGio) === -1) throw new Error('Số giờ lặp phải là 1, 2, 4, 6, 8 hoặc 12.');
    lich = { kieu: 'gio', soGio: soGio };
  } else if (kieu === 'ngay' || kieu === 'tuan') {
    if (isNaN(soGio) || soGio < 0 || soGio > 23) throw new Error('Giờ chạy phải từ 0 đến 23.');
    lich = { kieu: kieu, gio: soGio };
    if (kieu === 'tuan') {
      if (THU_TRONG_TUAN.indexOf(thu) === -1) throw new Error('Thứ trong tuần không hợp lệ.');
      lich.thu = thu;
    }
  } else if (kieu !== 'tat') {
    throw new Error('Kiểu lịch không hợp lệ.');
  }

  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === tenHam) ScriptApp.deleteTrigger(t);
  });

  if (lich) {
    var b = ScriptApp.newTrigger(tenHam).timeBased();
    if (lich.kieu === 'gio') b.everyHours(lich.soGio);
    else if (lich.kieu === 'ngay') b.everyDays(1).atHour(lich.gio);
    else b.onWeekDay(ScriptApp.WeekDay[lich.thu]).atHour(lich.gio);
    b.create();
  }

  var tatCaLich = _docJsonProp_(TONG_HOP_CFG.PROP_LICH, {});
  if (lich) {
    var nd = _xacDinhNguoiDung_();
    lich.capNhatLuc = new Date().toISOString();
    lich.capNhatBoi = (nd && nd.email) || '';
    tatCaLich[tenHam] = lich;
  } else {
    delete tatCaLich[tenHam];
  }
  _ghiJsonProp_(TONG_HOP_CFG.PROP_LICH, tatCaLich);
  return _getTongHopInfo_();
}

// ---------- API cho khu Quản trị (gọi qua api() trong Code.gs) ----------
function _getTongHopInfo_() {
  var soTrigger = {};
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var h = t.getHandlerFunction();
    soTrigger[h] = (soTrigger[h] || 0) + 1;
  });
  var tatCaLich = _docJsonProp_(TONG_HOP_CFG.PROP_LICH, {});
  var nhatKy = _docJsonProp_(TONG_HOP_CFG.PROP_NHAT_KY, []);
  var choChayTiep = _docJsonProp_(TONG_HOP_CFG.PROP_CHO_CHAY_TIEP, {});

  var tacVu = Object.keys(TAC_VU_TONG_HOP).map(function (k) {
    var lanCuoi = nhatKy.filter(function (x) { return x.tacVu === k; })[0] || null;
    var lich = soTrigger[k] ? (tatCaLich[k] || null) : null;
    return {
      key: k,
      ten: TAC_VU_TONG_HOP[k].ten,
      moTa: TAC_VU_TONG_HOP[k].moTa,
      soTrigger: soTrigger[k] || 0,
      lich: lich,
      moTaLich: soTrigger[k] ? (_moTaLich_(lich) || 'Có trigger (tạo ngoài Portal)') : '',
      lanCuoi: lanCuoi,
      choChayTiep: choChayTiep[k] || null
    };
  });

  var folderId = _backupFolderId_();
  return {
    tongHopUrl: _tongHopUrl_(),
    tongHopMacDinh: !PropertiesService.getScriptProperties().getProperty(TONG_HOP_CFG.PROP_TONGHOP_URL),
    backupFolderId: folderId,
    backupFolderUrl: 'https://drive.google.com/drive/folders/' + folderId,
    triggerPageUrl: 'https://script.google.com/home/projects/' + ScriptApp.getScriptId() + '/triggers',
    tacVu: tacVu,
    nhatKy: nhatKy.map(function (x) {
      return { tacVu: x.tacVu, ten: TAC_VU_TONG_HOP[x.tacVu] ? TAC_VU_TONG_HOP[x.tacVu].ten : x.tacVu, luc: x.luc, giay: x.giay, nguon: x.nguon, ok: x.ok, thongDiep: x.thongDiep };
    }),
    banSaoGanDay: _danhSachBanSaoGanDay_(folderId, 5)
  };
}

/** Chạy ngay 1 tác vụ từ khu Quản trị. */
function _chayTacVuTuPortal_(tenHam) {
  var nd = _xacDinhNguoiDung_();
  var kq = _chayTacVuTongHop_(tenHam, 'Portal: ' + ((nd && nd.email) || '?'));
  return { message: kq.message, tamDung: !!kq.tamDung, info: _getTongHopInfo_() };
}

/** Lưu cấu hình: truong = 'tongHopUrl' | 'backupFolderId'; giaTri = '' để về mặc định. */
function _luuCauHinhTongHop_(truong, giaTri) {
  giaTri = String(giaTri || '').trim();
  var props = PropertiesService.getScriptProperties();
  if (truong === 'tongHopUrl') {
    if (!giaTri) { props.deleteProperty(TONG_HOP_CFG.PROP_TONGHOP_URL); return _getTongHopInfo_(); }
    if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[-\w]{25,}/.test(giaTri)) {
      throw new Error('URL Bảng tổng hợp phải có dạng https://docs.google.com/spreadsheets/d/<ID>/...');
    }
    try { SpreadsheetApp.openByUrl(giaTri); } catch (e) {
      throw new Error('Không mở được file này — tài khoản chủ script cần có quyền chỉnh sửa.');
    }
    props.setProperty(TONG_HOP_CFG.PROP_TONGHOP_URL, giaTri);
  } else if (truong === 'backupFolderId') {
    if (!giaTri) { props.deleteProperty(TONG_HOP_CFG.PROP_BACKUP_FOLDER_ID); return _getTongHopInfo_(); }
    var m = giaTri.match(/folders\/([-\w]{10,})/);
    var id = m ? m[1] : giaTri;
    if (!/^[-\w]{10,}$/.test(id)) throw new Error('ID/link thư mục sao lưu không hợp lệ.');
    try { DriveApp.getFolderById(id).getName(); } catch (e) {
      throw new Error('Không mở được thư mục này — tài khoản chủ script cần có quyền chỉnh sửa.');
    }
    props.setProperty(TONG_HOP_CFG.PROP_BACKUP_FOLDER_ID, id);
  } else {
    throw new Error('Trường cấu hình không hợp lệ: ' + truong);
  }
  return _getTongHopInfo_();
}

function _danhSachBanSaoGanDay_(folderId, soLuong) {
  try {
    var it = DriveApp.getFolderById(folderId).getFolders();
    var ds = [];
    while (it.hasNext()) {
      var f = it.next();
      var ten = f.getName();
      if (ten.indexOf('BACKUP_') === 0) ds.push({ ten: ten, url: f.getUrl() });
    }
    ds.sort(function (a, b) { return a.ten < b.ten ? 1 : (a.ten > b.ten ? -1 : 0); });
    return ds.slice(0, soLuong);
  } catch (e) {
    return [];
  }
}

// =========================================================================
// CÁC TÁC VỤ (logic nghiệp vụ) — mỗi hàm trả về 1 câu thông báo kết quả
// =========================================================================

function _tvDongBoToanDien_() {
  // 1. Mở file đích (Hồ sơ tổng hợp - HoSoKeo_DN), sheet HoSoKeo_DN
  var sheetDich = _laySheetTongHop_(TONG_HOP_CFG.SHEET_HOSOKEO);

  // Định nghĩa vị trí các cột ở file đích (A=1, B=2, C=3, D=4...)
  var cotA_Dich = 1;
  var cotB_Makhachhang = 2;
  var cotC_Mahopdong = 3;
  var cotD_Dich = 4;  // Cột D đích: Nhận dữ liệu ngày tháng (Cột U từ File 1)
  var cotE_Dich = 5;  // Cột E đích: Mã định danh/Mã phiếu cân (Dùng để kiểm tra trùng)
  var cotF_Dich = 6;
  var cotG_Dich = 7;
  var cotH_Dich = 8;
  var cotI_Dich = 9;
  var cotJ_Dich = 10;
  var cotK_Dich = 11;
  var cotL_Dich = 12;
  var cotM_Dich = 13;
  var cotN_Dich = 14;
  var cotO_Dich = 15;
  var cotP_Dich = 16;
  var cotQ_Dich = 17;
  var cotR_Dich = 18;
  var cotS_Dich = 19;
  var cotU_Dich = 21; // Cột U đích: Số thứ tự nhóm BKLS (Tự động tính lại)
  var cotV_Dich = 22; // Cột V đích: Mã định danh 7 số dạng 0000001/bkls (Tự động tính lại)
  var cotW_Hovatenchurung = 23;
  var cotX_Diachirung = 24;

  // ==========================================
  // STEP 1.5: XÓA DÒNG CÓ CỘT A RỖNG TẠI 3 SHEET CỦA FILE 1 TRƯỚC KHI ĐỒNG BỘ
  // ==========================================
  var ssFile1 = _moFileNguon_(CAU_HINH_FILE.urlFile1, 'DNTT_GK_DN');
  var danhSachSheetCanXoa = ["DNTT_GK_DN_CT", "DNTT_GK_DN", "DNTT_GK_DN_112"];

  for (var sName = 0; sName < danhSachSheetCanXoa.length; sName++) {
    var sheetNguon = ssFile1.getSheetByName(danhSachSheetCanXoa[sName]);
    if (sheetNguon) {
      var dongCuoiNguon = sheetNguon.getLastRow();
      if (dongCuoiNguon >= 2) {
        var duLieuCotA = sheetNguon.getRange(2, 1, dongCuoiNguon - 1, 1).getValues();
        // Xoá theo cụm dòng liền nhau (duyệt lùi từ dưới lên, có kiểm tra thời gian)
        _xoaCacDong_(sheetNguon, 2, duLieuCotA.map(function (row) {
          return row[0] === "" || row[0] === null;
        }));
      }
    }
  }

  // Đọc dữ liệu hiện tại của File Đích để kiểm tra trùng lặp dựa trên cột E
  var dongCuoiDichBanDau = sheetDich.getLastRow();
  var setMaPhieuDaCo = {};
  if (dongCuoiDichBanDau >= 2) {
    var duLieuEDichHienTai = sheetDich.getRange(2, cotE_Dich, dongCuoiDichBanDau - 1, 1).getValues();
    for (var d = 0; d < duLieuEDichHienTai.length; d++) {
      var maE = duLieuEDichHienTai[d][0];
      if (maE) {
        var khoaE = maE instanceof Date ? maE.getTime() : maE.toString().trim();
        setMaPhieuDaCo[khoaE] = true; // Đánh dấu mã này đã tồn tại, không ghi trùng nữa
      }
    }
  }

  // ==========================================
  // STEP 2: LẤY DỮ LIỆU TỪ FILE 1 (DNTT_GK_DN_CT) GHI VÀO FILE ĐÍCH (CHỈ GHI DÒNG MỚI)
  // ==========================================
  var sheetFile1 = ssFile1.getSheetByName("DNTT_GK_DN_CT");
  if (!sheetFile1) throw new Error("Không tìm thấy sheet 'DNTT_GK_DN_CT' ở file DNTT_GK_DN.");
  var dongCuoiFile1 = sheetFile1.getLastRow();
  if (dongCuoiFile1 < 2) return 'Sheet DNTT_GK_DN_CT không có dữ liệu — không có gì để đồng bộ.';

  // Lấy dữ liệu rộng 10 cột (từ cột L đến cột U nguồn)
  var vungDuLieuFile1 = sheetFile1.getRange(2, 12, dongCuoiFile1 - 1, 10).getValues();

  var mangCotC_MaHD = [];
  var mangCotD_Ngay = [];
  var mangCotE_Moi = [];
  var mangCotP_Moi = [];
  var mangCotQ_Moi = [];
  var mangCotR_Moi = [];

  // Lọc loại bỏ trùng, chỉ lấy những dòng chưa từng xuất hiện ở file đích
  for (var k = 0; k < vungDuLieuFile1.length; k++) {
    var dinhDanhE_Nguon = vungDuLieuFile1[k][0];
    var khoaCheck = dinhDanhE_Nguon instanceof Date ? dinhDanhE_Nguon.getTime() : (dinhDanhE_Nguon ? dinhDanhE_Nguon.toString().trim() : "");

    if (khoaCheck && !setMaPhieuDaCo[khoaCheck]) {
      mangCotC_MaHD.push([vungDuLieuFile1[k][8]]); // Lấy cột T nguồn -> Cột C đích
      mangCotD_Ngay.push([vungDuLieuFile1[k][9]]); // Lấy cột U nguồn -> Cột D đích
      mangCotE_Moi.push([vungDuLieuFile1[k][0]]);  // Lấy cột L nguồn -> Cột E đích
      mangCotP_Moi.push([vungDuLieuFile1[k][1]]);
      mangCotQ_Moi.push([vungDuLieuFile1[k][4]]);
      mangCotR_Moi.push([vungDuLieuFile1[k][5]]);
    }
  }

  // Điểm dừng an toàn cuối cùng: pha ghi bên dưới phải chạy liền 1 mạch
  _kiemTraThoiGian_('đã dọn xong dòng trống, chưa ghi dòng mới', TONG_HOP_CFG.DU_TRU_GHI_MS);

  // Nếu phát hiện có dữ liệu mới phát sinh thì tiến hành ghi nối tiếp vào cuối bảng tính
  if (mangCotE_Moi.length > 0) {
    var dongBatDauGhi = sheetDich.getLastRow() + 1;

    sheetDich.getRange(dongBatDauGhi, cotC_Mahopdong, mangCotC_MaHD.length, 1).setNumberFormat("@");
    sheetDich.getRange(dongBatDauGhi, cotC_Mahopdong, mangCotC_MaHD.length, 1).setValues(mangCotC_MaHD);

    // Định dạng Ngày tháng dd/mm/yyyy hiển thị chuẩn cho cột D
    var vungCotD = sheetDich.getRange(dongBatDauGhi, cotD_Dich, mangCotD_Ngay.length, 1);
    vungCotD.setNumberFormat("dd/mm/yyyy");
    vungCotD.setValues(mangCotD_Ngay);

    sheetDich.getRange(dongBatDauGhi, cotE_Dich, mangCotE_Moi.length, 1).setValues(mangCotE_Moi);
    sheetDich.getRange(dongBatDauGhi, cotP_Dich, mangCotP_Moi.length, 1).setValues(mangCotP_Moi);
    sheetDich.getRange(dongBatDauGhi, cotQ_Dich, mangCotQ_Moi.length, 1).setValues(mangCotQ_Moi);
    sheetDich.getRange(dongBatDauGhi, cotR_Dich, mangCotR_Moi.length, 1).setValues(mangCotR_Moi);

    // ==========================================
    // STEP 3 & 4: THAM CHIẾU FILE 2 VÀ FILE 3 CHO CÁC DÒNG MỚI ĐƯỢC THÊM VÀO
    // ==========================================
    // Tra cứu File 2 (HD_NCC) bằng cấu hình URL tập trung
    var ssFile2 = _moFileNguon_(CAU_HINH_FILE.urlFile2, 'HD_NCC');
    var sheetFile2 = ssFile2.getSheetByName("HD_NCC");
    var dataFile2 = sheetFile2.getRange(2, 1, sheetFile2.getLastRow() - 1, sheetFile2.getLastColumn()).getValues();

    var mapHD = {};
    for (var i = 0; i < dataFile2.length; i++) {
      var maHD = dataFile2[i][2];
      if (maHD) mapHD[maHD] = { cotG: dataFile2[i][6], cotE: dataFile2[i][4], cotS: dataFile2[i][18] };
    }

    var mangCotB = [], mangCotW = [], mangCotX = [];
    for (var j = 0; j < mangCotC_MaHD.length; j++) {
      var maTimKiem = mangCotC_MaHD[j][0];
      if (maTimKiem && mapHD[maTimKiem]) {
        var maKH = mapHD[maTimKiem].cotG;
        mangCotB.push([maKH !== "" ? String(maKH) : ""]);
        mangCotW.push([mapHD[maTimKiem].cotE]);
        mangCotX.push([mapHD[maTimKiem].cotS]);
      } else {
        mangCotB.push([""]); mangCotW.push([""]); mangCotX.push([""]);
      }
    }
    var vungCotB = sheetDich.getRange(dongBatDauGhi, cotB_Makhachhang, mangCotB.length, 1);
    vungCotB.setNumberFormat("@"); vungCotB.setValues(mangCotB);
    sheetDich.getRange(dongBatDauGhi, cotW_Hovatenchurung, mangCotW.length, 1).setValues(mangCotW);
    sheetDich.getRange(dongBatDauGhi, cotX_Diachirung, mangCotX.length, 1).setValues(mangCotX);

    // Tra cứu File 3 (PhieuCan_DN) bằng cấu hình URL tập trung
    var ssFile3 = _moFileNguon_(CAU_HINH_FILE.urlFile3, 'PhieuCan_DN');
    var sheetFile3 = ssFile3.getSheetByName("PhieuCan_DN");
    var dataFile3 = sheetFile3.getRange(2, 1, sheetFile3.getLastRow() - 1, sheetFile3.getLastColumn()).getValues();

    var mapPhieuCan = {};
    for (var m = 0; m < dataFile3.length; m++) {
      var khoaW = dataFile3[m][22];
      if (khoaW) {
        var khoaTimKiemW = khoaW instanceof Date ? khoaW.getTime() : khoaW.toString().trim();
        mapPhieuCan[khoaTimKiemW] = {
          cotB: dataFile3[m][1], cotC: dataFile3[m][2], cotE: dataFile3[m][4], cotF: dataFile3[m][5],
          cotH: dataFile3[m][7], cotI: dataFile3[m][8], cotO: dataFile3[m][14], cotN: dataFile3[m][13],
          cotM: dataFile3[m][12], cotJ: dataFile3[m][9]
        };
      }
    }

    var mangF = [], mangG = [], mangJ = [], mangK = [], mangL = [], mangM = [], mangN = [], mangO = [], mangI = [], mangH = [], mangS = [];
    for (var n = 0; n < mangCotE_Moi.length; n++) {
      var giaTriE = mangCotE_Moi[n][0];
      var khoaTimKiem = giaTriE instanceof Date ? giaTriE.getTime() : (giaTriE ? giaTriE.toString().trim() : "");

      if (khoaTimKiem && mapPhieuCan[khoaTimKiem]) {
        var doiTuong = mapPhieuCan[khoaTimKiem];
        mangF.push([doiTuong.cotB]); mangG.push([doiTuong.cotF]); mangJ.push([doiTuong.cotC]);
        mangK.push([doiTuong.cotE]); mangL.push([doiTuong.cotF]); mangM.push([doiTuong.cotH]);
        mangN.push([doiTuong.cotI]); mangO.push([doiTuong.cotJ]); mangI.push([doiTuong.cotM]);
        mangH.push([doiTuong.cotN]); mangS.push([doiTuong.cotO]);
      } else {
        mangF.push([""]); mangG.push([""]); mangJ.push([""]); mangK.push([""]); mangL.push([""]);
        mangM.push([""]); mangN.push([""]); mangO.push([""]); mangI.push([""]); mangH.push([""]); mangS.push([""]);
      }
    }

    sheetDich.getRange(dongBatDauGhi, cotF_Dich, mangF.length, 1).setValues(mangF);
    sheetDich.getRange(dongBatDauGhi, cotG_Dich, mangG.length, 1).setValues(mangG);
    var vungCotJ = sheetDich.getRange(dongBatDauGhi, cotJ_Dich, mangJ.length, 1); vungCotJ.setNumberFormat("hh:mm:ss"); vungCotJ.setValues(mangJ);
    var vungCotK = sheetDich.getRange(dongBatDauGhi, cotK_Dich, mangK.length, 1); vungCotK.setNumberFormat("hh:mm:ss"); vungCotK.setValues(mangK);
    sheetDich.getRange(dongBatDauGhi, cotL_Dich, mangL.length, 1).setValues(mangL);
    sheetDich.getRange(dongBatDauGhi, cotM_Dich, mangM.length, 1).setValues(mangM);
    sheetDich.getRange(dongBatDauGhi, cotN_Dich, mangN.length, 1).setValues(mangN);
    sheetDich.getRange(dongBatDauGhi, cotO_Dich, mangO.length, 1).setValues(mangO);
    sheetDich.getRange(dongBatDauGhi, cotI_Dich, mangI.length, 1).setValues(mangI);
    sheetDich.getRange(dongBatDauGhi, cotH_Dich, mangH.length, 1).setValues(mangH);
    sheetDich.getRange(dongBatDauGhi, cotS_Dich, mangS.length, 1).setValues(mangS);
  }

  // =========================================================================
  // BẮT BUỘC: LUÔN LUÔN TÍNH TOÁN VÀ GHI LẠI CỘT A, U, V TRÊN TOÀN BỘ SHEET ĐỂ TRÁNH SẠM STT
  // =========================================================================
  var dongCuoiToanBo = sheetDich.getLastRow();
  if (dongCuoiToanBo < 2) return 'Không có dòng mới.';

  var duLieuGomNhom = sheetDich.getRange(2, 1, dongCuoiToanBo - 1, sheetDich.getLastColumn()).getValues();

  // 1. Ghi lại cột A (Số thứ tự tổng thể toàn bảng tính)
  var mangSTT_A = [];
  for (var s = 0; s < duLieuGomNhom.length; s++) {
    var valF = duLieuGomNhom[s][cotF_Dich - 1];
    if (valF !== "" && valF !== null) {
      mangSTT_A.push([s + 1]);
    } else {
      mangSTT_A.push([""]);
    }
  }
  sheetDich.getRange(2, cotA_Dich, mangSTT_A.length, 1).setValues(mangSTT_A);

  // 2. Tính toán lại số thứ tự phân nhóm (Cột U) căn cứ theo Mã Hợp Đồng (Cột C)
  var danhSachDong = [];
  for (var r = 0; r < duLieuGomNhom.length; r++) {
    var maHD_C = duLieuGomNhom[r][cotC_Mahopdong - 1];
    var ngay_E = duLieuGomNhom[r][cotE_Dich - 1];
    var gio_J = duLieuGomNhom[r][cotJ_Dich - 1];

    danhSachDong.push({
      indexGoc: r,
      maHD: maHD_C ? maHD_C.toString().trim() : "",
      ngay: ngay_E instanceof Date ? ngay_E.getTime() : (ngay_E ? new Date(ngay_E).getTime() : 0),
      gio: gio_J instanceof Date ? gio_J.getHours() * 3600 + gio_J.getMinutes() * 60 + gio_J.getSeconds() : 0
    });
  }

  var nhomMaHD = {};
  for (var d2 = 0; d2 < danhSachDong.length; d2++) {
    var item = danhSachDong[d2];
    if (item.maHD !== "") {
      if (!nhomMaHD[item.maHD]) nhomMaHD[item.maHD] = [];
      nhomMaHD[item.maHD].push(item);
    }
  }

  var mangSTT_U = [];
  for (var iStt = 0; iStt < duLieuGomNhom.length; iStt++) mangSTT_U.push([""]);

  for (var khoaHD in nhomMaHD) {
    var mangTrongNhom = nhomMaHD[khoaHD];
    mangTrongNhom.sort(function(a, b) {
      if (a.ngay !== b.ngay) return a.ngay - b.ngay;
      return a.gio - b.gio;
    });
    for (var stt = 0; stt < mangTrongNhom.length; stt++) {
      var dongGoc = mangTrongNhom[stt].indexGoc;
      mangSTT_U[dongGoc][0] = stt + 1;
    }
  }
  sheetDich.getRange(2, cotU_Dich, mangSTT_U.length, 1).setValues(mangSTT_U);

  // 3. Thiết lập mã hóa chuỗi cố định gồm 7 chữ số tại cột V (Mã BKLS)
  var mangKetQua_V = [];
  for (var x = 0; x < duLieuGomNhom.length; x++) {
    var giaTriU = mangSTT_U[x][0];
    if (giaTriU !== "" && giaTriU !== null) {
      var chuoi7So = giaTriU.toString().padStart(7, "0");
      mangKetQua_V.push([chuoi7So + "/BKLS"]);
    } else {
      mangKetQua_V.push([""]);
    }
  }
  var vungCotV = sheetDich.getRange(2, cotV_Dich, mangKetQua_V.length, 1);
  vungCotV.setNumberFormat("@");
  vungCotV.setValues(mangKetQua_V);

  return 'Đồng bộ xong: thêm mới ' + mangCotE_Moi.length + ' dòng; đã đánh lại STT/BKLS cho ' + duLieuGomNhom.length + ' dòng.';
}


// Hàm chuyển đổi ký tự cột chữ sang chỉ số mảng (A → 0)
function _chiSoCot_(colLetter) {
  var base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var result = 0;
  for (var i = 0; i < colLetter.length; i++) {
    result = result * 26 + base.indexOf(colLetter[i].toUpperCase()) + 1;
  }
  return result - 1;
}


function _tvDongBoHoSoRung_() {
  var colIndex = _chiSoCot_;
  var sheetDest = _laySheetTongHop_(TONG_HOP_CFG.SHEET_HOSORUNG);

  // 1. Mở file nguồn bằng URL
  var ssSource = _moFileNguon_(CAU_HINH_FILE.urlFile2, 'HD_NCC');

  // ================= KIỂM TRA VÀ XÓA DÒNG TRỐNG TRƯỚC KHI CHẠY =================
  function kiemTraVaXoaDongTrong(sheetObj, keyHeaderName) {
    if (!sheetObj) return;
    var lastRow = sheetObj.getLastRow();
    if (lastRow <= 1) return;

    var headerRow = sheetObj.getRange(1, 1, 1, sheetObj.getLastColumn()).getValues()[0];
    var keyColIdx = -1;
    for (var c = 0; c < headerRow.length; c++) {
      if (headerRow[c].toString().trim() === keyHeaderName) {
        keyColIdx = c + 1;
        break;
      }
    }

    if (keyColIdx !== -1) {
      var values = sheetObj.getRange(2, keyColIdx, lastRow - 1, 1).getValues();
      _xoaCacDong_(sheetObj, 2, values.map(function (row) {
        var cellValue = row[0];
        return cellValue === "" || cellValue === undefined || cellValue === null || cellValue.toString().trim() === "";
      }));
    }
  }

  var sheetNCC = ssSource.getSheetByName("HD_NCC");
  var sheetRung = ssSource.getSheetByName("HD_RUNG");
  var sheetGPS = ssSource.getSheetByName("HD_GPS");
  var sheetSTK = ssSource.getSheetByName("HD_STK");
  var sheetPicture = ssSource.getSheetByName("HD_Picture");

  kiemTraVaXoaDongTrong(sheetNCC, "ID_HD");
  kiemTraVaXoaDongTrong(sheetRung, "ID_KEY_HD");
  kiemTraVaXoaDongTrong(sheetGPS, "ID_KEY_GPS");
  kiemTraVaXoaDongTrong(sheetSTK, "ID_HD");
  kiemTraVaXoaDongTrong(sheetPicture, "ID_HD");
  // =====================================================================================

  if (!sheetNCC || !sheetRung) {
    throw new Error("Không tìm thấy sheet 'HD_NCC' hoặc 'HD_RUNG' ở file nguồn!");
  }
  _kiemTraThoiGian_('đã dọn xong dòng trống, chưa ghi HoSoRung_DN', TONG_HOP_CFG.DU_TRU_GHI_MS);

  var dataNCC = sheetNCC.getDataRange().getValues();
  var dataRung = sheetRung.getDataRange().getValues();

  if (dataNCC.length <= 1) {
    return 'Sheet HD_NCC không có dữ liệu — không có gì để đồng bộ.';
  }

  var groupsRungByD = {};
  var idxRungD = colIndex("D");
  for (var i = 1; i < dataRung.length; i++) {
    var keyD_Rung = dataRung[i][idxRungD];
    if (keyD_Rung === "" || keyD_Rung === undefined) continue;
    if (!groupsRungByD[keyD_Rung]) {
      groupsRungByD[keyD_Rung] = [];
    }
    groupsRungByD[keyD_Rung].push(dataRung[i]);
  }

  var groupsNCC = {};
  for (var i2 = 1; i2 < dataNCC.length; i2++) {
    var keyC = dataNCC[i2][colIndex("C")];
    if (keyC === "" || keyC === undefined) continue;
    if (!groupsNCC[keyC]) {
      groupsNCC[keyC] = [];
    }
    groupsNCC[keyC].push(dataNCC[i2]);
  }

  var outputData = [];

  for (var keyNCC in groupsNCC) {
    var rows = groupsNCC[keyNCC];
    var firstRow = rows[0];

    var destRow = Array(17).fill("");

    destRow[colIndex("D")] = firstRow[colIndex("C")];
    destRow[colIndex("F")] = firstRow[colIndex("D")];

    var valG = firstRow[colIndex("G")].toString().trim();
    destRow[colIndex("B")] = (valG.startsWith("0") && valG !== "0") ? "'" + valG : valG;

    destRow[colIndex("C")] = firstRow[colIndex("E")];
    destRow[colIndex("I")] = firstRow[colIndex("F")];
    destRow[colIndex("J")] = firstRow[colIndex("F")];
    destRow[colIndex("K")] = firstRow[colIndex("H")];
    destRow[colIndex("L")] = firstRow[colIndex("I")];

    var valJ_NCC = firstRow[colIndex("J")].toString().trim();
    destRow[colIndex("M")] = (valJ_NCC.startsWith("0") && valJ_NCC !== "0") ? "'" + valJ_NCC : valJ_NCC;

    destRow[colIndex("H")] = firstRow[colIndex("AE")];

    var keyD_Dich = destRow[colIndex("D")];

    if (keyD_Dich && groupsRungByD[keyD_Dich]) {
      var matchedRungRows = groupsRungByD[keyD_Dich];

      var totalJ_Rung = 0;
      var arrayForDienGiaiN = [];
      var arrayForDienGiaiQ = [];

      var idxRungI = colIndex("I");
      var idxRungJ = colIndex("J");
      var idxRungN = colIndex("N");

      for (var k = 0; k < matchedRungRows.length; k++) {
        var valJ_Rung = parseFloat(matchedRungRows[k][idxRungJ]);
        if (!isNaN(valJ_Rung)) {
          totalJ_Rung += valJ_Rung;
        }

        var textI_Rung = matchedRungRows[k][idxRungI].toString().trim();
        if (textI_Rung !== "") arrayForDienGiaiN.push(textI_Rung);

        var textN_Rung = matchedRungRows[k][idxRungN].toString().trim();
        if (textN_Rung !== "") arrayForDienGiaiQ.push(textN_Rung);
      }

      destRow[colIndex("O")] = totalJ_Rung / 10000;

      if (matchedRungRows.length >= 2) {
        destRow[colIndex("N")] = arrayForDienGiaiN.join(", ");
        destRow[colIndex("Q")] = arrayForDienGiaiQ.join(", ");
      } else {
        destRow[colIndex("N")] = matchedRungRows[0][idxRungI];
        destRow[colIndex("Q")] = matchedRungRows[0][idxRungN];
      }

    } else {
      destRow[colIndex("O")] = 0;
      destRow[colIndex("N")] = "";
      destRow[colIndex("Q")] = "";
    }

    outputData.push(destRow);
  }

  var idxF = colIndex("F");
  outputData.sort(function(a, b) {
    var dateA = a[idxF] ? new Date(a[idxF]) : new Date(0);
    var dateB = b[idxF] ? new Date(b[idxF]) : new Date(0);
    return dateA - dateB;
  });

  var idxA = colIndex("A");
  for (var i3 = 0; i3 < outputData.length; i3++) {
    outputData[i3][idxA] = i3 + 1;
  }

  if (outputData.length === 0) return 'Không có hợp đồng nào có mã (cột C) trong HD_NCC.';

  var lastRow = sheetDest.getLastRow();
  sheetDest.getRange(2, 1, lastRow >= 2 ? lastRow : 1, outputData[0].length).clearContent();

  sheetDest.getRange(2, 2, outputData.length, 1).setNumberFormat("@");
  sheetDest.getRange(2, 13, outputData.length, 1).setNumberFormat("@");

  sheetDest.getRange(2, 1, outputData.length, outputData[0].length).setValues(outputData);

  return 'Đồng bộ hồ sơ rừng xong: ' + outputData.length + ' hợp đồng.';
}


function _tvXoaDongLoiPhieuCan_() {
  var ss = _moFileNguon_(CAU_HINH_FILE.urlFile3, 'PhieuCan_DN');
  var sheet = ss.getSheetByName("PhieuCan_DN");
  if (!sheet) throw new Error("Không tìm thấy sheet 'PhieuCan_DN'.");

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'Sheet PhieuCan_DN trống.';

  // Đọc dữ liệu cột W..Y 1 lần (từ dòng 2) để check cột W (23) và Y (25)
  var vungWY = sheet.getRange(2, 23, lastRow - 1, 3).getValues();
  // Xóa theo cụm dòng lỗi liên tiếp (duyệt ngược, có kiểm tra thời gian)
  var tongXoa = _xoaCacDong_(sheet, 2, vungWY.map(function (row) {
    return row[0].toString().trim() === "" || row[2].toString().trim() === "Lỗi ĐK/Báo giá";
  }));
  return 'Đã xoá ' + tongXoa + ' dòng lỗi trong PhieuCan_DN.';
}


function _tvChuanHoaHIJ_() {
  var ss = _moFileNguon_(CAU_HINH_FILE.urlFile3, 'PhieuCan_DN');
  var sheet = ss.getSheetByName("PhieuCan_DN");
  if (!sheet) throw new Error("Không tìm thấy sheet 'PhieuCan_DN'.");

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 'Sheet trống hoặc chỉ có dòng tiêu đề.';

  // 1. Xác định vùng chứa cột H, I, J (Cột H là cột số 8, lấy cụm 3 cột H-I-J)
  var startRow = 2; // Bắt đầu từ dòng 2 để bỏ qua tiêu đề
  var numRows = lastRow - 1;
  var targetRange = sheet.getRange(startRow, 8, numRows, 3);
  var values = targetRange.getValues();

  var soO = 0;

  // 2. Duyệt qua mảng dữ liệu của 3 cột để kiểm tra điều kiện > 70.000
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < 3; c++) {
      var cellValue = values[r][c];

      // Kiểm tra nếu là số và lớn hơn 70000 thì chia cho 1000
      if (typeof cellValue === "number" && cellValue > 70000) {
        values[r][c] = cellValue / 1000;
        soO++;
      }
    }
  }

  // 3. Nếu có dữ liệu thay đổi, tiến hành ghi ngược lại xuống sheet đúng 1 lần duy nhất
  if (soO > 0) {
    targetRange.setValues(values);
    return 'Đã chuẩn hóa (chia 1000) ' + soO + ' ô có giá trị > 70.000 tại cột H, I, J.';
  }
  return 'Không có giá trị nào lớn hơn 70.000 ở các cột H, I, J.';
}


function _tvSaoLuu_() {
  // 1. Lấy thư mục gốc BACKUP
  var rootFolder;
  try {
    rootFolder = DriveApp.getFolderById(_backupFolderId_());
  } catch (e) {
    throw new Error('Không mở được thư mục sao lưu (ID ' + _backupFolderId_() + ').');
  }

  // 2. Tạo định dạng ngày giờ cho tên thư mục và tên file
  // Định dạng dùng cho thư mục: yyyy-MM-dd_HHmmss (đầy đủ giây)
  var timeFolder = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd_HHmmss");
  // Định dạng dùng đính kèm sau tên file: yyyy-MM-dd_HHmm (chỉ cần đến phút cho gọn)
  var timeFile = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd_HHmm");

  // Tạo thư mục mới trong thư mục BACKUP tổng
  var tenThuMucMoi = "BACKUP_" + timeFolder;
  var subFolder = rootFolder.createFolder(tenThuMucMoi);

  // 3. Copy từng file vào thư mục mới kèm đổi tên thêm ngày giờ
  //    (4 file nguồn + Bảng tổng hợp nơi lưu dữ liệu đồng bộ)
  var dsUrl = [CAU_HINH_FILE.urlFile1, CAU_HINH_FILE.urlFile2, CAU_HINH_FILE.urlFile3, CAU_HINH_FILE.urlFile4, _tongHopUrl_()];
  var ok = 0, loi = [];
  dsUrl.forEach(function (u) {
    if (_conLaiMs_() < 30000) { loi.push('Hết thời gian, chưa copy: ' + u); return; }
    var kq = copyAndRenameFile(u, subFolder, timeFile);
    if (kq === true) ok++; else loi.push(kq);
  });

  var msg = 'Đã sao lưu ' + ok + '/' + dsUrl.length + ' file vào thư mục ' + tenThuMucMoi + '.';
  if (loi.length) throw new Error(msg + ' Lỗi: ' + loi.join(' | '));
  return msg;
}

// Hàm phụ trách trích xuất file, sao lưu và đổi tên thêm ngày giờ.
// Trả về true nếu thành công, ngược lại trả về chuỗi mô tả lỗi.
function copyAndRenameFile(urlFile, targetFolder, timeSuffix) {
  try {
    // Trích xuất ID từ URL của Google Sheets
    var fileId = urlFile.match(/[-\w]{25,}/);
    if (!fileId) return 'Không tìm thấy ID hợp lệ cho URL: ' + urlFile;
    var file = DriveApp.getFileById(fileId[0]);
    // Tạo tên mới dạng: Tên_File_Gốc_2026-06-27_0915
    var tenFileMoi = file.getName() + "_" + timeSuffix;
    file.makeCopy(tenFileMoi, targetFolder);
    return true;
  } catch (e) {
    return 'Không thể copy file ' + urlFile + ': ' + e;
  }
}


function _tvCapNhatToaDo_() {
  var colIndex = _chiSoCot_;
  var sheetDest = _laySheetTongHop_(TONG_HOP_CFG.SHEET_TOADO);

  // 1. Mở file nguồn bằng URL
  var ssSource = _moFileNguon_(CAU_HINH_FILE.urlFile2, 'HD_NCC');

  var sheetGPS = ssSource.getSheetByName("HD_GPS");
  var sheetRung = ssSource.getSheetByName("HD_RUNG");

  if (!sheetGPS || !sheetRung) {
    throw new Error("Không tìm thấy sheet 'HD_GPS' hoặc 'HD_RUNG' ở file nguồn!");
  }

  // 2. Lấy dữ liệu từ sheet nguồn HD_GPS và HD_RUNG
  var lastRowGps = sheetGPS.getLastRow();
  if (lastRowGps <= 1) {
    return "Sheet nguồn 'HD_GPS' không có dữ liệu!";
  }
  var dataGPS = sheetGPS.getRange(2, 1, lastRowGps - 1, 6).getValues();
  var dataRung = sheetRung.getDataRange().getValues();

  // --- TẠO MAP TRA CỨU CHO HD_RUNG (Theo Cột C) ---
  var mapRungByC = {};
  var idxRungC = colIndex("C");
  for (var i = 1; i < dataRung.length; i++) {
    var keyC_Rung = dataRung[i][idxRungC];
    if (keyC_Rung !== "" && keyC_Rung !== undefined) {
      if (!mapRungByC[keyC_Rung]) {
        mapRungByC[keyC_Rung] = dataRung[i];
      }
    }
  }

  // 3. ĐỌC DỮ LIỆU HIỆN TẠI TRÊN SHEET ĐÍCH (Để tránh trùng lặp và biết dòng nào cần cập nhật)
  var lastRowDest = sheetDest.getLastRow();
  var dataDest = [];
  var mapDestRowIndex = {}; // Lưu vị trí dòng hiện tại của từng Mã trên sheet đích

  if (lastRowDest >= 2) {
    dataDest = sheetDest.getRange(2, 1, lastRowDest - 1, 17).getValues();
    for (var i2 = 0; i2 < dataDest.length; i2++) {
      var keyA_Dest = dataDest[i2][0]; // Cột A đích
      if (keyA_Dest !== "" && keyA_Dest !== undefined) {
        mapDestRowIndex[keyA_Dest] = i2; // Lưu lại chỉ số mảng của mã này
      }
    }
  }

  var countNew = 0;
  var countUpdate = 0;

  // 4. DUYỆT QUA DỮ LIỆU GPS NGUỒN ĐỂ XỬ LÝ LỌC
  for (var i3 = 0; i3 < dataGPS.length; i3++) {
    var valA_Gps = dataGPS[i3][0]; // Mã định danh (Cột A GPS)
    if (valA_Gps === "" || valA_Gps === undefined) continue;

    var destRow;
    var isExisting = mapDestRowIndex.hasOwnProperty(valA_Gps);

    if (isExisting) {
      // Nếu dòng đã có sẵn trên sheet đích, lấy dòng cũ ra để cập nhật làm mới thông tin
      destRow = dataDest[mapDestRowIndex[valA_Gps]];
      countUpdate++;
    } else {
      // Nếu là mã mới hoàn toàn, khởi tạo một dòng trống mới (17 cột)
      destRow = Array(17).fill("");
      countNew++;
    }

    // Ghi dữ liệu từ HD_GPS sang mảng dòng đích
    destRow[colIndex("A")] = dataGPS[i3][0]; // Cột A GPS -> Cột A đích
    destRow[colIndex("B")] = dataGPS[i3][1]; // Cột B GPS -> Cột B đích
    destRow[colIndex("N")] = dataGPS[i3][2]; // Cột C GPS -> Cột N đích
    destRow[colIndex("O")] = dataGPS[i3][3]; // Cột D GPS -> Cột O đích
    destRow[colIndex("P")] = dataGPS[i3][4]; // Cột E GPS -> Cột P đích
    destRow[colIndex("Q")] = dataGPS[i3][5]; // Cột F GPS -> Cột Q đích

    // Tham chiếu sang dữ liệu HD_RUNG
    if (mapRungByC[valA_Gps]) {
      var rowRung = mapRungByC[valA_Gps];

      destRow[colIndex("C")] = rowRung[colIndex("B")]; // Cột B RUNG -> Cột C đích
      destRow[colIndex("D")] = rowRung[colIndex("D")]; // Cột D RUNG -> Cột D đích
      destRow[colIndex("E")] = rowRung[colIndex("E")]; // Cột E RUNG -> Cột E đích
      destRow[colIndex("F")] = rowRung[colIndex("F")]; // Cột F RUNG -> Cột F đích

      // Giữ định dạng văn bản số 0 đầu cho cột G
      var valG_Rung = rowRung[colIndex("G")].toString().trim();
      destRow[colIndex("G")] = (valG_Rung.startsWith("0") && valG_Rung !== "0") ? "'" + valG_Rung : valG_Rung; // Cột G RUNG -> Cột G đích

      destRow[colIndex("H")] = rowRung[colIndex("H")]; // Cột H RUNG -> Cột H đích
      destRow[colIndex("I")] = rowRung[colIndex("I")]; // Cột I RUNG -> Cột I đích
      destRow[colIndex("J")] = rowRung[colIndex("J")]; // Cột J RUNG -> Cột J đích

      destRow[colIndex("K")] = rowRung[colIndex("N")]; // Cột N RUNG -> Cột K đích
      destRow[colIndex("L")] = rowRung[colIndex("O")]; // Cột O RUNG -> Cột L đích
      destRow[colIndex("M")] = rowRung[colIndex("P")]; // Cột P RUNG -> Cột M đích
    }

    // Nếu là dòng mới thì đẩy vào mảng dữ liệu tổng hợp
    if (!isExisting) {
      dataDest.push(destRow);
    }
  }

  // 5. GHI DỮ LIỆU ĐÃ TỐI ƯU XUỐNG SHEET ĐÍCH
  if (dataDest.length > 0) {
    // Định dạng Text dạng Plain Text cho cột G đích trước khi ghi dữ liệu
    sheetDest.getRange(2, 7, dataDest.length, 1).setNumberFormat("@");
    // Ghi đè toàn bộ mảng đã cập nhật và nối dòng mới xuống sheet
    sheetDest.getRange(2, 1, dataDest.length, dataDest[0].length).setValues(dataDest);
  }
  return 'Cập nhật tọa độ xong — thêm mới ' + countNew + ' dòng, làm mới ' + countUpdate + ' dòng cũ.';
}
