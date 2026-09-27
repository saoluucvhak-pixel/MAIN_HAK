/**
 * Menu Sheet cho các chức năng đồng bộ số liệu + sao lưu trong file này.
 * Dán đoạn onOpen() này (gộp vào onOpen() sẵn có nếu file đã có, không tạo
 * 2 hàm onOpen trùng tên — Apps Script chỉ chạy 1 trong 2, dễ gây tưởng
 * nhầm menu "không hoạt động").
 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('🚀 QUẢN LÝ HAK')
    .addItem('🔄 Đồng bộ dữ liệu toàn diện (V12)', 'dongBoDuLieuToanDienV12')
    .addItem('🌳 Đồng bộ Hồ sơ Rừng', 'dongBoDuLieuLamHoSoRung')
    .addItem('📍 Cập nhật thông minh Tọa độ Rừng', 'capNhatThongMinhToaDoRung')
    .addSeparator()
    .addItem('🧹 Xóa dòng lỗi Phiếu Cân', 'xoaDongNhanhNhatGiuDinhDang')
    .addItem('📏 Chuẩn hóa cột H/I/J (chia 1000)', 'chuanHoaDuLieuCotHIJ')
    .addSeparator()
    .addItem('💾 Sao lưu định kỳ (4 file)', 'saoLuuDinhKy')
    .addToUi();
}

function dongBoDuLieuToanDienV12() {
  // =========================================================================
  // CẤU HÌNH ĐỊA CHỈ (URL) CÁC FILE HỆ THỐNG - DIỄN GIẢI CHI TIẾT
  // =========================================================================
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
    urlFile3: "https://docs.google.com/spreadsheets/d/1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g/edit"
  };
  // =========================================================================

  // 1. Mở file đích hiện tại (Hồ sơ tổng hợp - HoSoKeo_DN) và chọn sheet đang mở
  var fileDich = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDich = fileDich.getActiveSheet();

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
  var ssFile1 = SpreadsheetApp.openByUrl(CAU_HINH_FILE.urlFile1);
  var danhSachSheetCanXoa = ["DNTT_GK_DN_CT", "DNTT_GK_DN", "DNTT_GK_DN_112"];

  for (var sName = 0; sName < danhSachSheetCanXoa.length; sName++) {
    var sheetNguon = ssFile1.getSheetByName(danhSachSheetCanXoa[sName]);
    if (sheetNguon) {
      var dongCuoiNguon = sheetNguon.getLastRow();
      if (dongCuoiNguon >= 2) {
        var duLieuCotA = sheetNguon.getRange(2, 1, dongCuoiNguon - 1, 1).getValues();
        // Duyệt lùi từ dưới lên trên để tránh lỗi lệch dòng khi xóa
        for (var rIndex = duLieuCotA.length - 1; rIndex >= 0; rIndex--) {
          var giaTriO = duLieuCotA[rIndex][0];
          if (giaTriO === "" || giaTriO === null) {
            sheetNguon.deleteRow(rIndex + 2);
          }
        }
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
  var dongCuoiFile1 = sheetFile1.getLastRow();
  if (dongCuoiFile1 < 2) return;

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
    var ssFile2 = SpreadsheetApp.openByUrl(CAU_HINH_FILE.urlFile2);
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
    var ssFile3 = SpreadsheetApp.openByUrl(CAU_HINH_FILE.urlFile3);
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
  if (dongCuoiToanBo < 2) return;

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
  for (var d = 0; d < danhSachDong.length; d++) {
    var item = danhSachDong[d];
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

  Logger.log("Hệ thống chạy ngầm: Đồng bộ thành công bản V12 kèm theo chú thích diễn giải!");
}


function dongBoDuLieuLamHoSoRung() {
  var ssDest = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDest = ssDest.getSheetByName("HoSoRung_DN");

  if (!sheetDest) {
    console.warn("Không tìm thấy sheet đích 'HoSoRung_DN' trong file hiện tại!");
    return;
  }

  // 1. Mở file nguồn bằng URL
  var sourceUrl = "https://docs.google.com/spreadsheets/d/1cv11ORWuAF3Sit4f-kA0xrP6-ab4SF-7LEdkCvGi_gI/edit?usp=sharing";
  var ssSource;
  try {
    ssSource = SpreadsheetApp.openByUrl(sourceUrl);
  } catch(e) {
    console.warn("Không thể mở file nguồn. Vui lòng kiểm tra lại quyền truy cập hoặc URL!");
    return;
  }

  // ================= BỔ SUNG: KIỂM TRA VÀ XÓA DÒNG TRỐNG TRƯỚC KHI CHẠY =================
  function colIndex(colLetter) {
    var base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var result = 0;
    for (var i = 0; i < colLetter.length; i++) {
      result = result * 26 + base.indexOf(colLetter[i].toUpperCase()) + 1;
    }
    return result - 1;
  }

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
      for (var r = values.length - 1; r >= 0; r--) {
        var cellValue = values[r][0];
        if (cellValue === "" || cellValue === undefined || cellValue === null || cellValue.toString().trim() === "") {
          var rowToDelete = r + 2;
          sheetObj.deleteRow(rowToDelete);
        }
      }
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
    console.warn("Không tìm thấy sheet 'HD_NCC' hoặc 'HD_RUNG' ở file nguồn!");
    return;
  }

  var dataNCC = sheetNCC.getDataRange().getValues();
  var dataRung = sheetRung.getDataRange().getValues();

  if (dataNCC.length <= 1) {
    console.warn("Sheet HD_NCC không có dữ liệu!");
    return;
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
  for (var i = 1; i < dataNCC.length; i++) {
    var keyC = dataNCC[i][colIndex("C")];
    if (keyC === "" || keyC === undefined) continue;
    if (!groupsNCC[keyC]) {
      groupsNCC[keyC] = [];
    }
    groupsNCC[keyC].push(dataNCC[i]);
  }

  var outputData = [];

  for (var keyC in groupsNCC) {
    var rows = groupsNCC[keyC];
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
  for (var i = 0; i < outputData.length; i++) {
    outputData[i][idxA] = i + 1;
  }

  if (outputData.length > 0) {
    var lastRow = sheetDest.getLastRow();
    sheetDest.getRange(2, 1, lastRow >= 2 ? lastRow : 1, outputData[0].length).clearContent();

    sheetDest.getRange(2, 2, outputData.length, 1).setNumberFormat("@");
    sheetDest.getRange(2, 13, outputData.length, 1).setNumberFormat("@");

    sheetDest.getRange(2, 1, outputData.length, outputData[0].length).setValues(outputData);

    // Thay alert thành log để an toàn khi chạy ngầm
    console.log("Đồng bộ dữ liệu thành công!");
  }
}


function xoaDongNhanhNhatGiuDinhDang() {
  var url = "https://docs.google.com/spreadsheets/d/1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g/edit";
  var ss = SpreadsheetApp.openByUrl(url);
  var sheet = ss.getSheetByName("PhieuCan_DN");
  if (!sheet) return;

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  // Đọc toàn bộ dữ liệu cột W và Y để check (chỉ đọc đúng 2 cột này để tăng tốc)
  var rangeW = sheet.getRange(1, 23, lastRow, 1).getValues(); // Cột 23 là W
  var rangeY = sheet.getRange(1, 25, lastRow, 1).getValues(); // Cột 25 là Y

  // Duyệt ngược để gom các dòng lỗi lại thành các "cặp dòng liên tiếp"
  var i = lastRow - 1;
  while (i >= 1) {
    var valW = rangeW[i][0].toString().trim();
    var valY = rangeY[i][0].toString().trim();

    if (valW === "" || valY === "Lỗi ĐK/Báo giá") {
      var numRowsToDelete = 1;
      // Kiểm tra xem dòng phía trên có lỗi tiếp không để gom cụm
      while (i - numRowsToDelete >= 1) {
        var nextW = rangeW[i - numRowsToDelete][0].toString().trim();
        var nextY = rangeY[i - numRowsToDelete][0].toString().trim();
        if (nextW === "" || nextY === "Lỗi ĐK/Báo giá") {
          numRowsToDelete++;
        } else {
          break;
        }
      }
      // Xóa cả cụm dòng lỗi cùng một lúc
      sheet.deleteRows(i - numRowsToDelete + 2, numRowsToDelete);
      i -= numRowsToDelete;
    } else {
      i--;
    }
  }
}


function chuanHoaDuLieuCotHIJ() {
  var url = "https://docs.google.com/spreadsheets/d/1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g/edit";

  var ss;
  try {
    ss = SpreadsheetApp.openByUrl(url);
  } catch(e) {
    Logger.log("Không thể mở file. Lỗi: " + e.message);
    return;
  }

  var sheet = ss.getSheetByName("PhieuCan_DN");
  if (!sheet) {
    Logger.log("Không tìm thấy sheet 'PhieuCan_DN'.");
    return;
  }

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) {
    Logger.log("Sheet trống hoặc chỉ có dòng tiêu đề.");
    return;
  }

  // 1. Xác định vùng chứa cột H, I, J (Cột H là cột số 8, lấy cụm 3 cột H-I-J)
  var startRow = 2; // Bắt đầu từ dòng 2 để bỏ qua tiêu đề
  var numRows = lastRow - 1;
  var targetRange = sheet.getRange(startRow, 8, numRows, 3);
  var values = targetRange.getValues();

  var isUpdated = false;

  // 2. Duyệt qua mảng dữ liệu của 3 cột để kiểm tra điều kiện > 70.000
  for (var r = 0; r < values.length; r++) {
    for (var c = 0; c < 3; c++) {
      var cellValue = values[r][c];

      // Kiểm tra nếu là số và lớn hơn 70000 thì chia cho 1000
      if (typeof cellValue === "number" && cellValue > 70000) {
        values[r][c] = cellValue / 1000;
        isUpdated = true;
      }
    }
  }

  // 3. Nếu có dữ liệu thay đổi, tiến hành ghi ngược lại xuống sheet đúng 1 lần duy nhất
  if (isUpdated) {
    targetRange.setValues(values);
    Logger.log("Đã chuẩn hóa và chia 1000 thành công cho các giá trị > 70.000 tại cột H, I, J.");
  } else {
    Logger.log("Không tìm thấy giá trị nào lớn hơn 70.000 ở các cột H, I, J.");
  }
}


// CẤU HÌNH THÔNG TIN FILE VÀ THƯ MỤC
var CAU_HINH_FILE = {
  // FILE 1: "DNTT_GK_DN"
  urlFile1: "https://docs.google.com/spreadsheets/d/1oUm87_gbDbnuPc_We0dyZ_e4kHXBHXs95AQAxp5okYo/edit",

  // FILE 2: "HD_NCC"
  urlFile2: "https://docs.google.com/spreadsheets/d/1cv11ORWuAF3Sit4f-kA0xrP6-ab4SF-7LEdkCvGi_gI/edit",

  // FILE 3: "PhieuCan_DN"
  urlFile3: "https://docs.google.com/spreadsheets/d/1vqMVxccBA7zlAMHrGsVBydGFwZJ6QuDZW10zJ74V29g/edit",

  // FILE 4 MỚI: "BaoGiaNhapGoKeo_DN"
  urlFile4: "https://docs.google.com/spreadsheets/d/1SIhfjP5-6ouRPDj265lAMmI5yWs1XcnedjqpzDwaIC0/edit?usp=sharing",

  // ID Thư mục BACKUP tổng
  backupFolderId: "1TMAjOkAew6m0vBM9KvLgPbODSUofFjrS"
};

function saoLuuDinhKy() {
  try {
    // 1. Lấy thư mục gốc BACKUP
    var rootFolder = DriveApp.getFolderById(CAU_HINH_FILE.backupFolderId);

    // 2. Tạo định dạng ngày giờ cho tên thư mục và tên file
    // Định dạng dùng cho thư mục: yyyy-MM-dd_HHmmss (đầy đủ giây)
    var timeFolder = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd_HHmmss");
    // Định dạng dùng đính kèm sau tên file: yyyy-MM-dd_HHmm (chỉ cần đến phút cho gọn)
    var timeFile = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd_HHmm");

    // Tạo thư mục mới trong thư mục BACKUP tổng
    var tenThuMucMoi = "BACKUP_" + timeFolder;
    var subFolder = rootFolder.createFolder(tenThuMucMoi);
    Logger.log("Đã tạo thư mục sao lưu mới: " + tenThuMucMoi);

    // 3. Tiến hành copy từng file vào thư mục mới kèm đổi tên thêm ngày giờ
    copyAndRenameFile(CAU_HINH_FILE.urlFile1, subFolder, timeFile);
    copyAndRenameFile(CAU_HINH_FILE.urlFile2, subFolder, timeFile);
    copyAndRenameFile(CAU_HINH_FILE.urlFile3, subFolder, timeFile);
    copyAndRenameFile(CAU_HINH_FILE.urlFile4, subFolder, timeFile);

    Logger.log("Hoàn thành sao lưu toàn bộ 4 file thành công!");
  } catch (error) {
    Logger.log("Lỗi trong quá trình sao lưu: " + error.toString());
  }
}

// Hàm phụ trách trích xuất file, sao lưu và đổi tên thêm ngày giờ
function copyAndRenameFile(urlFile, targetFolder, timeSuffix) {
  try {
    // Trích xuất ID từ URL của Google Sheets
    var fileId = urlFile.match(/[-\w]{25,}/);
    if (fileId) {
      var file = DriveApp.getFileById(fileId[0]);
      var tenFileGoc = file.getName();

      // Tạo tên mới dạng: Tên_File_Gốc_2026-06-27_0915
      var tenFileMoi = tenFileGoc + "_" + timeSuffix;

      // Tạo bản sao với tên mới vào thư mục sao lưu
      file.makeCopy(tenFileMoi, targetFolder);
      Logger.log("Đã sao lưu thành công file: " + tenFileMoi);
    } else {
      Logger.log("Không tìm thấy ID hợp lệ cho URL: " + urlFile);
    }
  } catch (e) {
    Logger.log("Không thể copy file từ URL " + urlFile + ". Lỗi: " + e.toString());
  }
}


function capNhatThongMinhToaDoRung() {
  var ssDest = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDest = ssDest.getSheetByName("ToaDoRung_DN");

  if (!sheetDest) {
    SpreadsheetApp.getUi().alert("Không tìm thấy sheet đích 'ToaDoRung_DN' trong file hiện tại!");
    return;
  }

  // 1. Mở file nguồn bằng URL
  var sourceUrl = "https://docs.google.com/spreadsheets/d/1cv11ORWuAF3Sit4f-kA0xrP6-ab4SF-7LEdkCvGi_gI/edit?usp=sharing";
  var ssSource;
  try {
    ssSource = SpreadsheetApp.openByUrl(sourceUrl);
  } catch(e) {
    SpreadsheetApp.getUi().alert("Không thể mở file nguồn. Vui lòng kiểm tra lại quyền truy cập hoặc URL!");
    return;
  }

  var sheetGPS = ssSource.getSheetByName("HD_GPS");
  var sheetRung = ssSource.getSheetByName("HD_RUNG");

  if (!sheetGPS || !sheetRung) {
    SpreadsheetApp.getUi().alert("Không tìm thấy sheet 'HD_GPS' hoặc 'HD_RUNG' ở file nguồn!");
    return;
  }

  // 2. Lấy dữ liệu từ sheet nguồn HD_GPS và HD_RUNG
  var lastRowGps = sheetGPS.getLastRow();
  if (lastRowGps <= 1) {
    SpreadsheetApp.getUi().alert("Sheet nguồn 'HD_GPS' không có dữ liệu!");
    return;
  }
  var dataGPS = sheetGPS.getRange(2, 1, lastRowGps - 1, 6).getValues();
  var dataRung = sheetRung.getDataRange().getValues();

  // Hàm chuyển đổi ký tự cột chữ sang chỉ số mảng
  function colIndex(colLetter) {
    var base = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var result = 0;
    for (var i = 0; i < colLetter.length; i++) {
      result = result * 26 + base.indexOf(colLetter[i].toUpperCase()) + 1;
    }
    return result - 1;
  }

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
    for (var i = 0; i < dataDest.length; i++) {
      var keyA_Dest = dataDest[i][0]; // Cột A đích
      if (keyA_Dest !== "" && keyA_Dest !== undefined) {
        mapDestRowIndex[keyA_Dest] = i; // Lưu lại chỉ số mảng của mã này
      }
    }
  }

  var countNew = 0;
  var countUpdate = 0;

  // 4. DUYỆT QUA DỮ LIỆU GPS NGUỒN ĐỂ XỬ LÝ LỌC
  for (var i = 0; i < dataGPS.length; i++) {
    var valA_Gps = dataGPS[i][0]; // Mã định danh (Cột A GPS)
    if (valA_Gps === "" || valA_Gps === undefined) continue;

    var destRow;
    var isExisting = mapDestRowIndex.hasOwnProperty(valA_Gps);

    if (isExisting) {
      // Nếu dòng đã có sẵn trên sheet đích, lấy dòng cũ ra để cập nhật làm mới thông tin
      var targetIdx = mapDestRowIndex[valA_Gps];
      destRow = dataDest[targetIdx];
      countUpdate++;
    } else {
      // Nếu là mã mới hoàn toàn, khởi tạo một dòng trống mới (17 cột)
      destRow = Array(17).fill("");
      countNew++;
    }

    // Ghi dữ liệu từ HD_GPS sang mảng dòng đích
    destRow[colIndex("A")] = dataGPS[i][0]; // Cột A GPS -> Cột A đích
    destRow[colIndex("B")] = dataGPS[i][1]; // Cột B GPS -> Cột B đích
    destRow[colIndex("N")] = dataGPS[i][2]; // Cột C GPS -> Cột N đích
    destRow[colIndex("O")] = dataGPS[i][3]; // Cột D GPS -> Cột O đích
    destRow[colIndex("P")] = dataGPS[i][4]; // Cột E GPS -> Cột P đích
    destRow[colIndex("Q")] = dataGPS[i][5]; // Cột F GPS -> Cột Q đích

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

    // Kiểm tra nếu đang chạy bằng tay (có giao diện) thì mới hiển thị Alert
    // Nếu chạy bằng Trigger ngầm thì chỉ ghi Log chứ không hiển thị giao diện để tránh lỗi
    try {
      SpreadsheetApp.getUi().alert(
        "Cập nhật thông minh hoàn tất!\n" +
        "- Thêm mới bổ sung: " + countNew + " dòng.\n" +
        "- Làm mới/Cập nhật thông tin: " + countUpdate + " dòng cũ."
      );
    } catch(e) {
      // Ghi lại kết quả vào Nhật ký kích hoạt (Execution Log) khi chạy ngầm
      Logger.log("Chạy ngầm hoàn tất - Thêm mới: " + countNew + " dòng, Cập nhật: " + countUpdate + " dòng.");
    }
  }
}
