/**
 * ============================================================
 * QUẢN LÝ LÂM SẢN — BÁO CÁO MẪU 04, 14, 29 (THÁNG / 6 THÁNG / NĂM)
 * ============================================================
 * Menu "🪵 Quản lý lâm sản" của Portal: người dùng chọn kỳ báo cáo + tồn
 * đầu kỳ → Portal TỰ ĐIỀN tham số vào sheet Thamso_RPKL của file
 * ThamSo_BaoCao (Thamso_Ngay_MAU07 tự sinh danh sách ngày bằng công thức
 * SEQUENCE theo Thamso_RPKL!B2:C2) → lập các sheet báo cáo trong file
 * RP_XK_BKLS (đúng mẫu RP_MAU04, RP_MAU14, RP_MAU29_M, RP_MAU29_6T,
 * RP_MAU29_Y) → trả link tải Excel từng sheet.
 *
 * Link 4 file liên quan và thông số hàng hoá (tên, đơn vị, tiêu hao SX)
 * sửa được ở khu Quản trị → tab "Thông số BC lâm sản" (Script Properties,
 * không cần sửa code). Mọi chức năng chỉ gọi được qua api() (đã đăng nhập).
 *
 * Logic tính toán giữ nguyên các hàm generateSingleReport /
 * generateReportMau29Month / generateReportMau29 / generateReportMau29Year
 * gốc; chỉ khác: nạp dữ liệu 1 lần + lập chỉ mục theo ngày/TKHQ thay cho
 * filter/find lặp lại mỗi ngày (O(ngày × dòng) → O(dòng)) để không bị
 * quá 6 phút khi dữ liệu lớn.
 */
var LS_CFG = {
  LINKS: [
    { key: 'LS_URL_XUATHANG', ten: 'Xuất hàng (XUATHANG_DN)', moTa: 'Sheet NL_PC_XH, NL_DH_XB',
      macDinh: 'https://docs.google.com/spreadsheets/d/1ZZ2iUwkkKe8wXdztA7mL-v9j6fmgY5c5rlDdI1sNoAk/edit' },
    { key: 'LS_URL_THAMSO', ten: 'Tham số báo cáo (ThamSo_BaoCao)', moTa: 'Sheet Thamso_RPKL, Thamso_Ngay_MAU07',
      macDinh: 'https://docs.google.com/spreadsheets/d/1_GT6DqJx0-Mi7b3CDkeykA19F4y8gUfiqh_Q_F9Ro1g/edit' },
    { key: 'LS_URL_BAOCAO', ten: 'File báo cáo (RP_XK_BKLS)', moTa: 'Nơi ghi các sheet RP_MAU04/14/29',
      macDinh: 'https://docs.google.com/spreadsheets/d/1CVwV6jP6TgiJNhpaop3bmyg_Q8Dvh6wdixtbEUKjJxs/edit' },
    { key: 'LS_URL_HOSOKEO', ten: 'Hồ sơ keo (HoSoKeo_DN)', moTa: 'Sheet HoSoKeo_DN — mặc định dùng chung link Bảng tổng hợp',
      macDinh: '' }
  ],
  SHEET_TS_NGAY: 'Thamso_Ngay_MAU07',
  SHEET_TS_RP: 'Thamso_RPKL',
  SHEET_HS_KEO: 'HoSoKeo_DN',
  SHEET_PC_XH: 'NL_PC_XH',
  SHEET_DH_XB: 'NL_DH_XB',
  // Thông số hàng hoá sửa được ở Quản trị — ghi vào MỌI dòng Thamso_RPKL
  THONG_SO_HANG: ['Tiêu hao SX', 'Tên thông thường', 'Tên khoa học', 'TÊN HH_TKHQ',
                  'Đơn vị tính (MT)', 'Đơn vị tính (BDMT)', 'Loài nguy cấp Quý hiếm'],
  PROP_LAN_CUOI: 'LS_LAN_LAP_CUOI_JSON',
  CHO_KHOA_MS: 15000
};

var LS_BAO_CAO = {
  M04_14: { ten: 'Mẫu 04 (theo ngày) + Mẫu 14 (xuất khẩu)', sheets: ['RP_MAU04', 'RP_MAU14'] },
  M29_M:  { ten: 'Mẫu 29 theo tháng', sheets: ['RP_MAU29_M'] },
  M29_6T: { ten: 'Mẫu 29 định kỳ 6 tháng', sheets: ['RP_MAU29_6T'] },
  M29_Y:  { ten: 'Mẫu 29 theo năm', sheets: ['RP_MAU29_Y'] }
};

// ---------- Cấu hình link ----------
function _lsUrl_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (v) return v;
  if (key === 'LS_URL_HOSOKEO') return _tongHopUrl_();
  var f = LS_CFG.LINKS.filter(function (x) { return x.key === key; })[0];
  return f ? f.macDinh : '';
}
function _lsMo_(key) {
  var f = LS_CFG.LINKS.filter(function (x) { return x.key === key; })[0];
  try {
    return SpreadsheetApp.openByUrl(_lsUrl_(key));
  } catch (e) {
    throw new Error('Không mở được file ' + f.ten + ' — kiểm tra link ở Quản trị > Thông số BC lâm sản và quyền truy cập của tài khoản chủ script.');
  }
}
/** getSheetByName không phân biệt hoa/thường (THAMSO_RPKL = Thamso_RPKL). */
function _lsSheet_(ss, ten, batBuoc) {
  var sh = ss.getSheetByName(ten);
  if (!sh) {
    var t = ten.toLowerCase();
    sh = ss.getSheets().filter(function (s) { return s.getName().toLowerCase() === t; })[0] || null;
  }
  if (!sh && batBuoc) throw new Error("Không tìm thấy sheet '" + ten + "' trong file " + ss.getName() + '.');
  return sh;
}

// ---------- Tiện ích (giữ nguyên từ code gốc) ----------
function getSingleSheetDownloadUrl(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return null;
  // Thêm tham số &gid=ID_SHEET để ép Google chỉ xuất duy nhất tab sheet được chỉ định
  return ss.getUrl().replace(/edit.*$/, '') + 'export?format=xlsx&gid=' + sheet.getSheetId();
}

function getSheetDataAsObjects(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  var headers = data[0].map(function (h) { return String(h).trim(); });
  return data.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (header, i) { obj[header] = row[i]; });
    return obj;
  });
}

function formatKeyDate(dateVal) {
  if (!dateVal) return null;
  var date = new Date(dateVal);
  if (isNaN(date.getTime())) return String(dateVal).trim();
  var mm = String(date.getMonth() + 1).padStart(2, '0');
  var dd = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + mm + '-' + dd;
}

function fnChenhLechDoKho(khoiLuong, doKhoPCXH, doKhoNhaMay) {
  var _khoiLuong = khoiLuong || 0;
  var _doKhoPCXH = doKhoPCXH || 0;
  var _doKhoNhaMay = doKhoNhaMay || 0;
  if (_doKhoNhaMay === 0) return 0;
  return ((_khoiLuong * _doKhoPCXH) / _doKhoNhaMay) - _khoiLuong;
}

function autoResizeColumns(sheet, totalCols) {
  for (var col = 1; col <= totalCols; col++) {
    sheet.autoResizeColumn(col);
  }
}

function _lsNgay_(s) {
  var m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

// =========================================================================
// NẠP DỮ LIỆU 1 LẦN + LẬP CHỈ MỤC
// =========================================================================
function _lsNapDuLieu_(tuNgay, denNgay) {
  var ssXH = _lsMo_('LS_URL_XUATHANG');
  var ssTS = _lsMo_('LS_URL_THAMSO');
  var ssHK = _lsMo_('LS_URL_HOSOKEO');

  var data_TS_Ngay = getSheetDataAsObjects(_lsSheet_(ssTS, LS_CFG.SHEET_TS_NGAY, true))
    .filter(function (r) { return r['Ngày trong năm'] && r['Mẫu']; });
  var data_TS_Rp = getSheetDataAsObjects(_lsSheet_(ssTS, LS_CFG.SHEET_TS_RP, true))
    .filter(function (r) { return String(r['Mẫu'] || '').trim(); });
  var data_Hs_Keo = getSheetDataAsObjects(_lsSheet_(ssHK, LS_CFG.SHEET_HS_KEO, true));
  var data_PC_XH = getSheetDataAsObjects(_lsSheet_(ssXH, LS_CFG.SHEET_PC_XH, true));
  var data_DHXB = getSheetDataAsObjects(_lsSheet_(ssXH, LS_CFG.SHEET_DH_XB, true));
  if (!data_TS_Rp.length) throw new Error('Sheet Thamso_RPKL chưa có dòng tham số nào (cột Mẫu).');

  // Phòng khi công thức SEQUENCE ở Thamso_Ngay_MAU07 bị ghi đè/chưa tính
  // lại kịp: tự sinh danh sách ngày theo kỳ đã chọn, Mẫu = dòng đầu Thamso_RPKL.
  var tuKey = formatKeyDate(tuNgay), denKey = formatKeyDate(denNgay);
  var dsKey = data_TS_Ngay.map(function (r) { return formatKeyDate(r['Ngày trong năm']); }).sort();
  if (!dsKey.length || dsKey[0] !== tuKey || dsKey[dsKey.length - 1] !== denKey) {
    var mauMacDinh = String(data_TS_Rp[0]['Mẫu']).trim();
    data_TS_Ngay = [];
    for (var d = new Date(tuNgay); d <= denNgay; d.setDate(d.getDate() + 1)) {
      data_TS_Ngay.push({ 'Ngày trong năm': new Date(d), 'Mẫu': mauMacDinh });
    }
  }
  data_TS_Ngay.sort(function (a, b) { return new Date(a['Ngày trong năm']) - new Date(b['Ngày trong năm']); });

  function nhomTheoNgay(list, cot) {
    var m = {};
    list.forEach(function (r) {
      var k = formatKeyDate(r[cot]);
      if (!k) return;
      (m[k] = m[k] || []).push(r);
    });
    return m;
  }
  // Tương đương data_DHXB.find(d => String(d["SỐ TKHQ"]).trim() === tkhqKey): lấy dòng ĐẦU TIÊN
  var dhxbTheoTKHQ = {};
  data_DHXB.forEach(function (d) {
    var k = String(d['SỐ TKHQ']).trim();
    if (!Object.prototype.hasOwnProperty.call(dhxbTheoTKHQ, k)) dhxbTheoTKHQ[k] = d;
  });

  return {
    ssBaoCao: _lsMo_('LS_URL_BAOCAO'),
    data_TS_Ngay: data_TS_Ngay,
    data_TS_Rp: data_TS_Rp,
    defaultTS: data_TS_Rp[0] || {},
    data_DHXB: data_DHXB,
    hsKeoTheoNgay: nhomTheoNgay(data_Hs_Keo, 'Ngày nhập'),
    pcxhTheoNgay: nhomTheoNgay(data_PC_XH, 'Ngày xuất'),
    dhxbTheoTKHQ: dhxbTheoTKHQ,
    soDong: { hsKeo: data_Hs_Keo.length, pcxh: data_PC_XH.length, dhxb: data_DHXB.length, ngay: data_TS_Ngay.length }
  };
}

function _lsTieuHaoDoKhoCuaPhieu_(D, rowPC) {
  var tkhqKey = rowPC['SỐ TKHQ'] ? String(rowPC['SỐ TKHQ']).trim() : '';
  var rowDHMatched = D.dhxbTheoTKHQ[tkhqKey] || {};
  var klXuatItem = Number(rowPC['Khối lượng (Tấn)']) || 0;
  return fnChenhLechDoKho(klXuatItem, Number(rowDHMatched['ĐỘ KHÔ']) || 0, Number(rowDHMatched['ĐỘ KHÔ NHÀ MÁY']) || 0);
}
function _lsTongKL_(list) {
  return list.reduce(function (sum, r) { return sum + (Number(r['Khối lượng (Tấn)']) || 0); }, 0);
}
function _lsGhiSheet_(ss, ten, headers, mauNen, rows, dinhDang) {
  var sheet = ss.getSheetByName(ten) || ss.insertSheet(ten);
  sheet.clear();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground(mauNen).setHorizontalAlignment('center');
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    dinhDang(sheet, rows.length);
    autoResizeColumns(sheet, headers.length);
  }
  return rows.length;
}

// =========================================================================
// HÀM 1: BÁO CÁO THEO NGÀY -> RP_MAU04 & RP_MAU14 (LŨY KẾ)
// =========================================================================
function _lsMau04Va14_(D) {
  var defaultTS = D.defaultTS;

  // 1. CẤU HÌNH GỐC THEO MÃ HÀNG (MẪU) ĐỂ LẤY TÊN VÀ ĐỊNH MỨC
  var mapConfigGoc = {};
  D.data_TS_Rp.forEach(function (row) {
    var mauKey = row['Mẫu'] ? String(row['Mẫu']).trim().toUpperCase() : '';
    if (mauKey) {
      mapConfigGoc[mauKey] = {
        tonDauCauHinh: Number(row['Tồn đầu ngày'] || row['Ton_DauKy']) || 0,
        tieuHaoSX: Number(row['Tiêu hao SX']) || 0,
        tenTiengViet: row['Tên tiếng Việt/Tên thương mại'] || row['Tên thông thường'] || 'Dăm gỗ keo',
        tenKhoaHoc: row['Tên khoa học'] || 'Acacia mangium'
      };
    }
  });

  var thongTinTonLuyKeTheoMau = {};
  var daLayTonDauCauHinh = {};
  var tempAllProcessedData = [];

  D.data_TS_Ngay.forEach(function (rowSrc) {
    var ngayKey = formatKeyDate(rowSrc['Ngày trong năm']);
    var mauKey = rowSrc['Mẫu'] ? String(rowSrc['Mẫu']).trim().toUpperCase() : '';
    if (!ngayKey || !mauKey) return;

    var tsRepo = mapConfigGoc[mauKey] || { tonDauCauHinh: 0, tieuHaoSX: 0, tenTiengViet: 'Dăm gỗ keo', tenKhoaHoc: 'Acacia mangium' };

    // 2. TỒN ĐẦU KỲ: chỉ bốc số dư cấu hình đúng 1 lần đầu tiên, sau đó lấy tồn cuối ngày trước
    var tonDauKyThucTe = 0;
    if (tsRepo.tonDauCauHinh > 0 && !daLayTonDauCauHinh[mauKey]) {
      tonDauKyThucTe = tsRepo.tonDauCauHinh;
      daLayTonDauCauHinh[mauKey] = true;
    } else {
      tonDauKyThucTe = thongTinTonLuyKeTheoMau[mauKey] || 0;
    }

    // --- Nhập trong ngày ---
    var mapHsKeoCuaNgay = D.hsKeoTheoNgay[ngayKey] || [];
    var klNhapTan = 0;
    var hoSoNhap = '';
    if (mapHsKeoCuaNgay.length > 0) {
      klNhapTan = _lsTongKL_(mapHsKeoCuaNgay);
      var countPhieuCan = 0, countBKLS = 0;
      var uniqueChuLamSan = {};
      mapHsKeoCuaNgay.forEach(function (r) {
        var pc = r['Số phiếu cân'] || r['SỐ PHIẾU CÂN'] || r['Số phiếu'] || r['Phiếu cân'] || '';
        var bk = r['Số BKLS'] || r['Số bảng kê'] || r['Số hiệu'] || '';
        var cls = r['Họ và tên chủ rừng'] || r['Chủ rừng'] || r['Chủ lâm sản'] || '';
        if (String(pc).trim() !== '' || String(bk).trim() !== '') countPhieuCan++;
        if (String(bk).trim() !== '') countBKLS++;
        if (String(cls).trim() !== '') uniqueChuLamSan[String(cls).trim()] = true;
      });
      hoSoNhap = countPhieuCan + ' số phiếu cân, ' + countBKLS + ' BKLS, ' + Object.keys(uniqueChuLamSan).length + ' Chủ lâm sản';
    }

    var tieuHaoSX_Calc = klNhapTan * tsRepo.tieuHaoSX;

    // --- Xuất trong ngày ---
    var listPhieuXuatCuaNgay = D.pcxhTheoNgay[ngayKey] || [];
    var klXuatTanTong = 0, chenhLechXuatDoKhoTong = 0;
    var soBangKeXuat = '', hoSoXuatKem = '';
    if (listPhieuXuatCuaNgay.length > 0) {
      klXuatTanTong = _lsTongKL_(listPhieuXuatCuaNgay);
      if (klXuatTanTong !== 0) {
        var countXuatPhieuCan = 0, countXuatBKLS = 0;
        var listBKLS_Strings = [];
        var uniqueXeChay = {};
        listPhieuXuatCuaNgay.forEach(function (rowPC) {
          var pcXuat = rowPC['Số phiếu cân'] || rowPC['Số phiếu'] || rowPC['Phiếu cân'] || '';
          var bkXuat = rowPC['Số BKLS'] || rowPC['Số bảng kê'] || rowPC['Số hiệu'] || rowPC['SỐ TKHQ'] || '';
          var bksXe = rowPC['Biển số 1'] || rowPC['Số xe'] || rowPC['Biển số'] || '';
          if (String(pcXuat).trim() !== '') countXuatPhieuCan++;
          if (String(bkXuat).trim() !== '') {
            countXuatBKLS++;
            listBKLS_Strings.push(String(bkXuat).trim());
          }
          if (String(bksXe).trim() !== '') uniqueXeChay[String(bksXe).trim()] = true;
          chenhLechXuatDoKhoTong += _lsTieuHaoDoKhoCuaPhieu_(D, rowPC);
        });
        soBangKeXuat = listBKLS_Strings.filter(Boolean).join(', ');
        hoSoXuatKem = countXuatPhieuCan + ' số phiếu cân, ' + countXuatBKLS + ' BKLS, ' + Object.keys(uniqueXeChay).length + ' xe chạy và hóa đơn xuất bán';
      }
    }

    var tongNguyenLieuTieuHao = Number((tieuHaoSX_Calc + chenhLechXuatDoKhoTong).toFixed(3));
    var tonCuoiKyThucTe = Number((tonDauKyThucTe + klNhapTan - klXuatTanTong - tongNguyenLieuTieuHao).toFixed(3));
    thongTinTonLuyKeTheoMau[mauKey] = tonCuoiKyThucTe;

    var dateObj = new Date(ngayKey);
    var locThang = !isNaN(dateObj.getTime()) ? String(dateObj.getMonth() + 1).padStart(2, '0') + '/' + dateObj.getFullYear() : '';

    tempAllProcessedData.push({
      ngayDoiChieu: ngayKey,
      inTuNgay: defaultTS['IN_Tungay'],
      inDenNgay: defaultTS['IN_Denngay'],
      record: [
        tonDauKyThucTe, rowSrc['Ngày trong năm'], tsRepo.tenTiengViet, tsRepo.tenKhoaHoc, '-', 'Tấn', 0,
        klNhapTan, hoSoNhap, rowSrc['Ngày trong năm'], soBangKeXuat, 0, klXuatTanTong, hoSoXuatKem,
        tongNguyenLieuTieuHao, tonCuoiKyThucTe, rowSrc['Ghi chú'] || '-', 'Đã xác nhận', locThang
      ]
    });
  });

  var finalOutputData1 = [];
  tempAllProcessedData.forEach(function (item) {
    if (item.ngayDoiChieu && item.inTuNgay && item.inDenNgay) {
      var dTarget = new Date(item.ngayDoiChieu), dTu = new Date(item.inTuNgay), dDen = new Date(item.inDenNgay);
      dTarget.setHours(0, 0, 0, 0); dTu.setHours(0, 0, 0, 0); dDen.setHours(0, 0, 0, 0);
      if (dTarget < dTu || dTarget > dDen) return;
    }
    finalOutputData1.push(item.record);
  });

  var headers1 = [
    'Lâm sản tồn đầu kỳ', 'Ngày, tháng, năm', 'Tên tiếng Việt/Tên thương mại', 'Tên khoa học',
    '.Số hiệu, nhãn đánh dấu', '.Đơn vị tính', '.Loài nguy cấp, quý, hiếm; CITES', '.Loài thông thường',
    'Hồ sơ kèm theo lâm sản nhập', 'Ngày, tháng, năm.', 'Số bảng kê lâm sản xuất ra', 'Loài nguy cấp, quý,hiếm;CITES',
    'Loài thông thường', 'Hồ sơ lâm sản xuất kèm theo', 'Ước tính nguyên liệu tiêu hao (nếu có)',
    'Lâm sản tồn cuối kỳ', 'Ghi chú', 'Xác nhận lâm sản tồn', 'LOC_THÁNG'
  ];
  var n1 = _lsGhiSheet_(D.ssBaoCao, 'RP_MAU04', headers1, '#c8e6c9', finalOutputData1, function (sh, n) {
    sh.getRange(2, 2, n, 1).setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center');
    sh.getRange(2, 10, n, 1).setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center');
    sh.getRange(2, 1, n, 1).setNumberFormat('#,##0.000');
    sh.getRange(2, 8, n, 1).setNumberFormat('#,##0.000');
    sh.getRange(2, 13, n, 1).setNumberFormat('#,##0.000');
    sh.getRange(2, 15, n, 2).setNumberFormat('#,##0.000');
    sh.getRange(2, 19, n, 1).setHorizontalAlignment('center');
  });

  // --- RP_MAU14: theo đơn hàng xuất bán trong kỳ ---
  var finalOutputData2 = [];
  var indexSTT = 1;
  D.data_DHXB.forEach(function (rowDH) {
    var donGiaUSD = Number(rowDH['ĐƠN GIÁ (USD)']) || 0;
    var klBDMT = Number(rowDH['KL_BDMT']) || 0;
    var triGiaUSD = Number((donGiaUSD * klBDMT).toFixed(2));
    var ngayDonHangRaw = rowDH['Ngày đơn hàng'];
    var inTuNgayRaw = defaultTS['IN_Tungay'];
    var inDenNgayRaw = defaultTS['IN_Denngay'];

    var isIncluded = false;
    if (ngayDonHangRaw && inTuNgayRaw && inDenNgayRaw) {
      var dateDonHang = new Date(ngayDonHangRaw), dateTuNgay = new Date(inTuNgayRaw), dateDenNgay = new Date(inDenNgayRaw);
      if (!isNaN(dateDonHang.getTime()) && !isNaN(dateTuNgay.getTime()) && !isNaN(dateDenNgay.getTime())) {
        dateDonHang.setHours(0, 0, 0, 0); dateTuNgay.setHours(0, 0, 0, 0); dateDenNgay.setHours(0, 0, 0, 0);
        if (dateDonHang >= dateTuNgay && dateDonHang <= dateDenNgay) isIncluded = true;
      }
    } else { isIncluded = true; }

    if (isIncluded) {
      finalOutputData2.push([
        indexSTT++,
        rowDH['SỐ TKHQ'] || '',
        defaultTS['TÊN HH_TKHQ'] || defaultTS['Tên thông thường'] || 'Dăm gỗ keo',
        defaultTS['Tên thông thường'] || 'Dăm gỗ keo',
        defaultTS['Tên khoa học'] || 'Acacia mangium',
        defaultTS['Đơn vị tính (MT)'] || 'Tấn',
        // Lấy từ NL_DH_XB nếu sheet có cột này, không có thì để trống như cũ
        rowDH['Khối lượng NK'] !== undefined ? rowDH['Khối lượng NK'] : '',
        rowDH['Trị giá NK (USD)'] !== undefined ? rowDH['Trị giá NK (USD)'] : '',
        defaultTS['Đơn vị tính (BDMT)'] || 'BDMT',
        klBDMT,
        triGiaUSD
      ]);
    }
  });

  var headers2 = ['STT', 'SỐ TKHQ', 'TÊN HH_TKHQ', 'Tên thông thường', 'Tên khoa học',
    'Đơn vị tính (MT)', 'Khối lượng NK', 'Trị giá NK (USD)', 'Đơn vị tính (BDMT)', 'KL_BDMT', 'Trị giá (USD)'];
  var n2 = _lsGhiSheet_(D.ssBaoCao, 'RP_MAU14', headers2, '#bbdefb', finalOutputData2, function (sh, n) {
    sh.getRange(2, 7, n, 2).setNumberFormat('#,##0.00');
    sh.getRange(2, 10, n, 2).setNumberFormat('#,##0.00');
    sh.getRange(2, 1, n, 2).setHorizontalAlignment('center');
  });

  return { RP_MAU04: n1, RP_MAU14: n2 };
}

// =========================================================================
// HÀM 2-4: MẪU 29 THEO THÁNG / 6 THÁNG / NĂM (LŨY KẾ TỒN QUA CÁC KỲ)
// Ba hàm gốc giống hệt nhau, chỉ khác cách gom kỳ và các cột cuối —
// gộp chung, tham số hoá bằng `kieu`.
// =========================================================================
var LS_KY_29 = {
  M: {
    sheet: 'RP_MAU29_M', mauNen: '#e8f5e9',
    cotCuoi: ['LOC_THÁNG', 'Ngày báo cáo', 'Tháng báo cáo', 'Năm báo cáo'],
    ky: function (d) {
      var thang = d.getMonth() + 1, nam = d.getFullYear();
      return { khoa: String(thang).padStart(2, '0') + '/' + nam, thuTu: nam * 100 + thang, nhan: String(thang).padStart(2, '0') + '/' + nam, phu: [thang, nam] };
    }
  },
  '6T': {
    sheet: 'RP_MAU29_6T', mauNen: '#b2dfdb',
    cotCuoi: ['LOC_6T', 'Ngày báo cáo', 'Thời điểm báo cáo', 'Năm báo cáo'],
    ky: function (d) {
      var nam = d.getFullYear(), so = (d.getMonth() + 1) <= 6 ? 1 : 2; // 1: 6T đầu năm, 2: 6T cuối năm
      return { khoa: '6T' + so + '/' + nam, thuTu: nam * 10 + so, nhan: '6T' + so + '/' + nam, phu: [so, nam] };
    }
  },
  Y: {
    sheet: 'RP_MAU29_Y', mauNen: '#ffe0b2',
    cotCuoi: ['LOC_Y', 'Ngày báo cáo'],
    ky: function (d) {
      var nam = d.getFullYear();
      return { khoa: String(nam), thuTu: nam, nhan: nam, phu: [] };
    }
  }
};

function _lsMau29_(D, kieu) {
  var K = LS_KY_29[kieu];
  var data_TS_Rp = D.data_TS_Rp, defaultTS = D.defaultTS;

  // CẤU HÌNH THEO MẪU + KHOẢNG NGÀY HIỆU LỰC
  var listConfigs = data_TS_Rp.map(function (row) {
    var tuNgayRaw = row['Từ ngày'] || row['Ngày tháng năm nhập'] || row['Ngày trong năm'];
    var denNgayRaw = row['Đến ngày'] || row['IN_Denngay'] || tuNgayRaw;
    return {
      mau: row['Mẫu'] ? String(row['Mẫu']).trim() : '',
      tuNgay: tuNgayRaw ? new Date(tuNgayRaw) : null,
      denNgay: denNgayRaw ? new Date(denNgayRaw) : null,
      tonDauCauHinh: Number(row['Tồn đầu ngày'] || row['Ton_DauKy']) || 0,
      tieuHaoSX: Number(row['Tiêu hao SX']) || 0
    };
  });

  var rawMap = {};
  D.data_TS_Ngay.forEach(function (rowSrc) {
    var ngayGoc = rowSrc['Ngày trong năm'];
    var ngayKey = formatKeyDate(ngayGoc);
    var mauKey = rowSrc['Mẫu'] ? String(rowSrc['Mẫu']).trim() : '';
    if (!ngayKey || !mauKey) return;

    var dateObj = new Date(ngayGoc);
    var tsRepo = listConfigs.filter(function (cfg) {
      if (cfg.mau !== mauKey) return false;
      if (cfg.tuNgay && dateObj < cfg.tuNgay) return false;
      if (cfg.denNgay && dateObj > cfg.denNgay) return false;
      return true;
    })[0] || { tonDauCauHinh: 0, tieuHaoSX: 0 };

    var ky = K.ky(dateObj);
    var groupKey = ky.khoa + '_' + mauKey;
    if (!rawMap[groupKey]) {
      rawMap[groupKey] = { ky: ky, mau: mauKey, nhap: 0, xuat: 0, tieuHao: 0, tonDauCauHinhGoc: 0 };
    }
    var g = rawMap[groupKey];
    if (tsRepo.tonDauCauHinh > 0 && g.tonDauCauHinhGoc === 0) g.tonDauCauHinhGoc = tsRepo.tonDauCauHinh;

    var klNhapTan = _lsTongKL_(D.hsKeoTheoNgay[ngayKey] || []);
    g.nhap += klNhapTan;
    g.tieuHao += (klNhapTan * tsRepo.tieuHaoSX);

    var listPhieuXuatCuaNgay = D.pcxhTheoNgay[ngayKey] || [];
    if (listPhieuXuatCuaNgay.length > 0) {
      g.xuat += _lsTongKL_(listPhieuXuatCuaNgay);
      listPhieuXuatCuaNgay.forEach(function (rowPC) { g.tieuHao += _lsTieuHaoDoKhoCuaPhieu_(D, rowPC); });
    }
  });

  var listPeriods = Object.keys(rawMap).map(function (k) { return rawMap[k]; });
  listPeriods.sort(function (a, b) { return a.ky.thuTu - b.ky.thuTu; });

  // Lũy kế: kỳ đầu của mẫu lấy tồn cấu hình, các kỳ sau lấy tồn cuối kỳ trước
  var tonLuyKe = {};
  var finalRowsOutput = [];
  var indexSTT = 1;
  listPeriods.forEach(function (p) {
    var tonDau = Object.prototype.hasOwnProperty.call(tonLuyKe, p.mau) ? tonLuyKe[p.mau] : (p.tonDauCauHinhGoc > 0 ? p.tonDauCauHinhGoc : 0);
    var tonCuoi = tonDau + (p.nhap - p.xuat - p.tieuHao);
    tonLuyKe[p.mau] = tonCuoi;

    var matchTS = data_TS_Rp.filter(function (r) { return String(r['Mẫu']).trim() === p.mau; })[0] || defaultTS;
    var ngayBaoCaoRaw = matchTS['IN_Denngay'] || defaultTS['IN_Denngay'];
    finalRowsOutput.push([
      indexSTT++,
      matchTS['TÊN HH_TKHQ'] || matchTS['Tên thông thường'] || 'Dăm gỗ keo',
      matchTS['Loài nguy cấp Quý hiếm'] || matchTS['Nhóm loài'] || 'Loài thông thường',
      matchTS['Đơn vị tính (MT)'] || 'Tấn',
      Number(tonDau.toFixed(3)),
      Number(p.nhap.toFixed(3)),
      Number((p.nhap + tonDau).toFixed(3)),
      Number((p.xuat + p.tieuHao).toFixed(3)),
      Number(tonCuoi.toFixed(3)),
      p.ky.nhan,
      ngayBaoCaoRaw ? formatKeyDate(ngayBaoCaoRaw) : '-'
    ].concat(p.ky.phu));
  });

  var headers = ['TT', 'Tên lâm sản', 'Nhóm loài (thông thường; nguy cấp, quý, hiếm; Phụ lục CITES)',
    'Đơn vị tính', 'Tồn kho đầu kỳ', 'Nhập trong kỳ', 'Tổng cộng', 'Lâm sản xuất ra', 'Tồn kho cuối kỳ'].concat(K.cotCuoi);
  var n = _lsGhiSheet_(D.ssBaoCao, K.sheet, headers, K.mauNen, finalRowsOutput, function (sh, soDong) {
    sh.getRange(2, 1, soDong, 1).setHorizontalAlignment('center');
    sh.getRange(2, 4, soDong, 1).setHorizontalAlignment('center');
    sh.getRange(2, 5, soDong, 5).setNumberFormat('#,##0.000');
    sh.getRange(2, 10, soDong, K.cotCuoi.length).setHorizontalAlignment('center');
  });
  var kq = {}; kq[K.sheet] = n;
  return kq;
}

// Giữ tên hàm gốc để chạy tay trong trình soạn thảo (dùng tham số đang có trong Thamso_RPKL)
function generateSingleReport()      { return _lsChayTheoThamSoHienTai_(['M04_14']); }
function generateReportMau29Month()  { return _lsChayTheoThamSoHienTai_(['M29_M']); }
function generateReportMau29()       { return _lsChayTheoThamSoHienTai_(['M29_6T']); }
function generateReportMau29Year()   { return _lsChayTheoThamSoHienTai_(['M29_Y']); }

function _lsChayTheoThamSoHienTai_(dsBaoCao) {
  var ts = _lsDocThamSo_();
  return _lsLapBaoCao_({ tuNgay: ts.tuNgay, denNgay: ts.denNgay, tonDau: ts.tonDau, baoCao: dsBaoCao, khongGhiThamSo: true });
}

// =========================================================================
// THAM SỐ: đọc / tự điền vào Thamso_RPKL
// =========================================================================
function _lsCotTheoTieuDe_(sheet) {
  var tieuDe = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  tieuDe.forEach(function (h, i) { var t = String(h).trim(); if (t && !map[t]) map[t] = i + 1; });
  return map;
}

function _lsDocThamSo_() {
  var sh = _lsSheet_(_lsMo_('LS_URL_THAMSO'), LS_CFG.SHEET_TS_RP, true);
  var rows = getSheetDataAsObjects(sh).filter(function (r) { return String(r['Mẫu'] || '').trim(); });
  var r0 = rows[0] || {};
  function isoNgay(v) { return v instanceof Date ? Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd') : ''; }
  var hang = {};
  LS_CFG.THONG_SO_HANG.forEach(function (k) { hang[k] = r0[k] !== undefined ? r0[k] : ''; });
  return {
    tuNgay: isoNgay(r0['IN_Tungay']),
    denNgay: isoNgay(r0['IN_Denngay']),
    tonDau: Number(r0['Tồn đầu ngày']) || 0,
    dsMau: rows.map(function (r) { return String(r['Mẫu']).trim(); }),
    hang: hang
  };
}

/** Ghi giá trị theo tên cột cho các dòng Thamso_RPKL. chiDongDauMoiMau: chỉ
 * dòng đầu tiên của mỗi Mẫu (kỳ báo cáo); false: mọi dòng (thông số hàng). */
function _lsGhiThamSo_(giaTriTheoCot, chiDongDauMoiMau) {
  var ssTS = _lsMo_('LS_URL_THAMSO');
  var sh = _lsSheet_(ssTS, LS_CFG.SHEET_TS_RP, true);
  var cot = _lsCotTheoTieuDe_(sh);
  var thieu = Object.keys(giaTriTheoCot).filter(function (k) { return !cot[k]; });
  if (thieu.length) throw new Error('Sheet Thamso_RPKL thiếu cột: ' + thieu.join(', '));
  if (!cot['Mẫu']) throw new Error("Sheet Thamso_RPKL thiếu cột 'Mẫu'.");
  var lastRow = sh.getLastRow();
  if (lastRow < 2) throw new Error('Sheet Thamso_RPKL chưa có dòng tham số nào.');

  var dsMau = sh.getRange(2, cot['Mẫu'], lastRow - 1, 1).getValues();
  var daGap = {}, soDong = 0;
  dsMau.forEach(function (r, i) {
    var mau = String(r[0] || '').trim().toUpperCase();
    if (!mau) return;
    if (chiDongDauMoiMau && daGap[mau]) return;
    daGap[mau] = true;
    Object.keys(giaTriTheoCot).forEach(function (k) {
      sh.getRange(i + 2, cot[k]).setValue(giaTriTheoCot[k]);
    });
    soDong++;
  });
  SpreadsheetApp.flush(); // để Thamso_Ngay_MAU07 (SEQUENCE) tính lại theo kỳ mới
  return soDong;
}

// =========================================================================
// LẬP BÁO CÁO
// =========================================================================
function _lsLapBaoCao_(p) {
  var tuNgay = p.tuNgay instanceof Date ? p.tuNgay : _lsNgay_(p.tuNgay);
  var denNgay = p.denNgay instanceof Date ? p.denNgay : _lsNgay_(p.denNgay);
  if (!tuNgay || !denNgay) throw new Error('Chọn Từ ngày / Đến ngày hợp lệ.');
  if (tuNgay > denNgay) throw new Error('Từ ngày phải trước hoặc bằng Đến ngày.');
  var soNgay = Math.round((denNgay - tuNgay) / 86400000) + 1;
  if (soNgay > 999) throw new Error('Kỳ báo cáo tối đa 999 ngày (giới hạn công thức Thamso_Ngay_MAU07).');
  var dsBaoCao = (p.baoCao || []).filter(function (k) { return LS_BAO_CAO[k]; });
  if (!dsBaoCao.length) throw new Error('Chọn ít nhất 1 báo cáo.');
  var tonDau = Number(p.tonDau);
  if (p.tonDau === '' || p.tonDau === null || isNaN(tonDau)) throw new Error('Tồn đầu kỳ phải là số.');

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LS_CFG.CHO_KHOA_MS)) throw new Error('Đang có tác vụ khác chạy (lập báo cáo / đồng bộ) — thử lại sau ít phút.');
  var batDau = Date.now();
  try {
    // 1. TỰ ĐIỀN THAM SỐ kỳ báo cáo vào Thamso_RPKL (dòng đầu mỗi Mẫu)
    if (!p.khongGhiThamSo) {
      _lsGhiThamSo_({ 'IN_Tungay': tuNgay, 'IN_Denngay': denNgay, 'Ngày tháng năm nhập': tuNgay, 'Tồn đầu ngày': tonDau }, true);
    }

    // 2. Nạp dữ liệu + lập các báo cáo đã chọn
    var D = _lsNapDuLieu_(tuNgay, denNgay);
    var soDong = {};
    dsBaoCao.forEach(function (k) {
      var kq = k === 'M04_14' ? _lsMau04Va14_(D) : _lsMau29_(D, k.replace('M29_', ''));
      Object.keys(kq).forEach(function (s) { soDong[s] = kq[s]; });
    });
    SpreadsheetApp.flush();

    // 3. Link tải
    var ss = D.ssBaoCao;
    var files = [];
    dsBaoCao.forEach(function (k) {
      LS_BAO_CAO[k].sheets.forEach(function (s) {
        files.push({ sheet: s, soDong: soDong[s] || 0, url: getSingleSheetDownloadUrl(ss, s) });
      });
    });
    var nd = _xacDinhNguoiDung_();
    var lanCuoi = {
      luc: new Date().toISOString(),
      boi: (nd && nd.email) || '',
      tuNgay: Utilities.formatDate(tuNgay, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      denNgay: Utilities.formatDate(denNgay, Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      baoCao: dsBaoCao,
      giay: Math.round((Date.now() - batDau) / 1000)
    };
    PropertiesService.getScriptProperties().setProperty(LS_CFG.PROP_LAN_CUOI, JSON.stringify(lanCuoi));
    return {
      files: files,
      urlBaoCao: ss.getUrl(),
      urlTaiCaFile: ss.getUrl().replace(/edit.*$/, '') + 'export?format=xlsx',
      nguon: D.soDong,
      lanCuoi: lanCuoi
    };
  } finally {
    lock.releaseLock();
  }
}

// =========================================================================
// API cho Portal (gọi qua api() trong Code.gs — đã kiểm tra đăng nhập)
// =========================================================================
function _lsLinkInfo_() {
  var props = PropertiesService.getScriptProperties();
  return LS_CFG.LINKS.map(function (f) {
    return { key: f.key, ten: f.ten, moTa: f.moTa, url: _lsUrl_(f.key), ghiDe: !!props.getProperty(f.key) };
  });
}
function _lsXlsxUrl_(url) {
  var m = String(url || '').match(/\/spreadsheets\/d\/([-\w]{25,})/);
  return m ? 'https://docs.google.com/spreadsheets/d/' + m[1] + '/export?format=xlsx' : '';
}

/** Trang "Quản lý lâm sản": tham số hiện tại (để tự điền form) + link. */
function _getLamSanInfo_() {
  var ts = null, loiThamSo = '';
  try { ts = _lsDocThamSo_(); } catch (e) { loiThamSo = String(e.message || e); }
  var lanCuoi = null;
  try { lanCuoi = JSON.parse(PropertiesService.getScriptProperties().getProperty(LS_CFG.PROP_LAN_CUOI) || 'null'); } catch (e) {}
  return {
    thamSo: ts,
    loiThamSo: loiThamSo,
    baoCao: Object.keys(LS_BAO_CAO).map(function (k) { return { key: k, ten: LS_BAO_CAO[k].ten, sheets: LS_BAO_CAO[k].sheets }; }),
    links: _lsLinkInfo_(),
    urlBaoCao: _lsUrl_('LS_URL_BAOCAO'),
    urlMauBaoCao: _lsXlsxUrl_(_lsUrl_('LS_URL_BAOCAO')),
    urlMauThamSo: _lsXlsxUrl_(_lsUrl_('LS_URL_THAMSO')),
    lanCuoi: lanCuoi
  };
}

function _lapBaoCaoLamSan_(p) {
  var kq = _lsLapBaoCao_(p || {});
  kq.info = _getLamSanInfo_();
  return kq;
}

/** Quản trị > Thông số BC lâm sản: link + thông số hàng hoá. */
function _getLamSanCauHinh_() {
  var ts = null, loi = '';
  try { ts = _lsDocThamSo_(); } catch (e) { loi = String(e.message || e); }
  return { links: _lsLinkInfo_(), thongSoHang: LS_CFG.THONG_SO_HANG, hang: ts ? ts.hang : null, dsMau: ts ? ts.dsMau : [], loi: loi };
}

function _luuLamSanLink_(key, url) {
  if (!LS_CFG.LINKS.some(function (f) { return f.key === key; })) throw new Error('Link không hợp lệ: ' + key);
  url = String(url || '').trim();
  var props = PropertiesService.getScriptProperties();
  if (!url) { props.deleteProperty(key); return _getLamSanCauHinh_(); }
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[-\w]{25,}/.test(url)) {
    throw new Error('Link phải có dạng https://docs.google.com/spreadsheets/d/<ID>/...');
  }
  try { SpreadsheetApp.openByUrl(url); } catch (e) {
    throw new Error('Không mở được file này — tài khoản chủ script cần có quyền chỉnh sửa.');
  }
  props.setProperty(key, url);
  return _getLamSanCauHinh_();
}

function _luuLamSanThongSoHang_(giaTri) {
  var ghi = {};
  LS_CFG.THONG_SO_HANG.forEach(function (k) {
    if (giaTri && Object.prototype.hasOwnProperty.call(giaTri, k)) {
      var v = giaTri[k];
      if (k === 'Tiêu hao SX') {
        var chuoi = String(v).trim().replace(',', '.');
        v = /%$/.test(chuoi) ? Number(chuoi.slice(0, -1)) / 100 : Number(chuoi); // "2,5%" = 0.025
        if (isNaN(v) || v < 0 || v >= 1) throw new Error('Tiêu hao SX là tỷ lệ từ 0 đến dưới 1 (ví dụ 0.025 = 2,5%).');
      } else {
        v = String(v || '').trim();
      }
      ghi[k] = v;
    }
  });
  if (!Object.keys(ghi).length) throw new Error('Không có thông số nào để lưu.');
  _lsGhiThamSo_(ghi, false);
  return _getLamSanCauHinh_();
}
