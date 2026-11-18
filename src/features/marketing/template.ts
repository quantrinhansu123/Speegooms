import { acceptanceOptions, contentStatuses, adsStatuses, seoStatuses, marketingChannels, marketingFormats, mediaStatuses, type MarketingKpiType, type MarketingReport } from "@speego/shared";

const mediaHeaders = ["Kịch bản số", "Tháng kế hoạch", "Kênh / Page", "Tên video / Chủ đề", "Nội dung order", "Định dạng", "Size", "Media phụ trách", "Content phối hợp", "Ngày giao việc", "Deadline bàn giao", "Ngày bàn giao thực tế", "Trạng thái", "Nghiệm thu", "KPI được giao", "KPI ghi nhận", "Đánh giá deadline", "Link video final", "Ghi chú / Vướng mắc", "Link bài đăng"];
const contentHeaders = ["STT content", "Tháng kế hoạch", "Kênh / Page", "Tên bài / Chủ đề", "Brief bài", "Định dạng bài", "Tuyến nội dung", "Content phụ trách", "Ngày giao việc", "Deadline hoàn thành", "Ngày hoàn thành thực tế", "Trạng thái", "Nghiệm thu", "KPI ghi nhận", "Đánh giá deadline", "File nội dung", "Ghi chú / Vướng mắc", "Link bài đăng"];

const adsHeaders = ["STT ads", "Tháng kế hoạch", "Kênh / Page", "Tên chiến dịch / Công việc", "Brief Ads", "Loại quảng cáo", "Tuyến nội dung", "Ads phụ trách", "Từ ngày", "Đến ngày", "Ngày hoàn thành thực tế", "Trạng thái", "Nghiệm thu", "KPI ghi nhận", "Đánh giá deadline", "Link chiến dịch", "Ghi chú / Vướng mắc", "Link bài đăng"];
const seoHeaders = ["STT seo", "Tháng kế hoạch", "Kênh / Page", "Tên hạng mục / Công việc", "Brief SEO", "Loại SEO", "Tuyến nội dung", "SEO phụ trách", "Từ ngày", "Đến ngày", "Ngày hoàn thành thực tế", "Trạng thái", "Nghiệm thu", "KPI ghi nhận", "Đánh giá deadline", "Link website / Báo cáo", "Ghi chú / Vướng mắc", "Link bài đăng"];
export async function buildTaskTemplate(types: MarketingKpiType[] = []) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  book.creator = "SpeeGo";
  book.calcProperties.fullCalcOnLoad = true;
  const media = book.addWorksheet("01 Giao việc Media");
  const content = book.addWorksheet("02 Giao việc Content");
  const ads = book.addWorksheet("03 Giao việc Ads");
  const seo = book.addWorksheet("04 Giao việc SEO");
  const guide = book.addWorksheet("Hướng dẫn");
  const lists = book.addWorksheet("DanhMuc", { state: "veryHidden" });
  const choices = [marketingChannels, marketingFormats.media, mediaStatuses, marketingFormats.content, contentStatuses, acceptanceOptions, marketingFormats.ads, adsStatuses, marketingFormats.seo, seoStatuses];
  const names = ["KenhMarketing", "DinhDangMedia", "TrangThaiMedia", "DinhDangContent", "TrangThaiContent", "NghiemThuMarketing", "DinhDangAds", "TrangThaiAds", "DinhDangSeo", "TrangThaiSeo"];
  choices.forEach((values, index) => {
    values.forEach((v, row) => { lists.getCell(row + 1, index + 1).value = v; });
    const col = lists.getColumn(index + 1).letter;
    book.definedNames.add(`DanhMuc!$${col}$1:$${col}$${values.length}`, names[index]);
  });

  for (const [sheet, baseHeaders, kind] of [[media, mediaHeaders, "media"], [content, contentHeaders, "content"], [ads, adsHeaders, "ads"], [seo, seoHeaders, "seo"]] as const) {
    const isMedia = kind === "media";
    const headers = [...baseHeaders].map(label => label === "Ngày giao việc" ? "Từ ngày" : label.startsWith("Deadline ") ? "Đến ngày" : label);
    const kpiTypes = types.filter(t => t.active && t.kind === kind);
    for (const type of kpiTypes) headers.push(`Chỉ tiêu: ${type.name} (${type.unit})`, `Thực hiện: ${type.name} (${type.unit})`, `Tỷ lệ: ${type.name}`);
    sheet.addRow(headers);
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: `${sheet.getColumn(headers.length).letter}501` };
    sheet.getRow(1).height = 44;
    const calculated = [...(isMedia ? [15, 16, 17] : [14, 15]), ...kpiTypes.map((_, i) => baseHeaders.length + i * 3 + 3)];
    headers.forEach((label, i) => {
      const col = sheet.getColumn(i + 1);
      col.width = /Chủ đề|order|Brief|Ghi chú|Link|File/.test(label) ? 42 : 23;
      col.alignment = { vertical: "top", wrapText: true };
      if (i === 1 || /Link|File/.test(label)) col.numFmt = "@";
      if (/Ngày|Deadline|Từ ngày|Đến ngày/.test(label)) col.numFmt = "yyyy-mm-dd";
      const cell = sheet.getCell(1, i + 1);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: calculated.includes(i + 1) ? "FF64748B" : "FF0F766E" } };
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      if (calculated.includes(i + 1)) cell.note = "Hệ thống tự tính; không cần nhập. Công thức Excel chỉ để tham khảo.";
    });
    sheet.getCell("A1").note = "Mỗi công việc là một dòng; điền số thứ tự để nhập dòng đó. File mẫu không có công việc ví dụ.";
    sheet.getCell("B1").note = "Nhập tháng kế hoạch dạng YYYY-MM, ví dụ 2026-11.";
    sheet.getCell(isMedia ? "N1" : "M1").note = "Admin/Leader Marketing nghiệm thu. Người không có quyền nghiệm thu nhập file sẽ chờ Leader duyệt lại.";
    sheet.getCell(isMedia ? "T1" : "R1").note = "Link bài đã đăng để ghép với báo cáo nền tảng. Khác link sản phẩm final.";
    const dropdowns: [string, string][] = isMedia
      ? [["C", names[0]], ["F", names[1]], ["M", names[2]], ["N", names[5]]]
      : [["C", names[0]], ["F", names[kind === "ads" ? 6 : kind === "seo" ? 8 : 3]], ["L", names[kind === "ads" ? 7 : kind === "seo" ? 9 : 4]], ["M", names[5]]];
    for (let row = 2; row <= 501; row++) {
      for (const [col, name] of dropdowns) sheet.getCell(`${col}${row}`).dataValidation = {
        type: "list", allowBlank: true, formulae: [name], showErrorMessage: true,
        errorStyle: "stop", errorTitle: "Giá trị không hợp lệ", error: "Chọn một giá trị trong danh sách.",
      };
      const status = `${isMedia ? "M" : "L"}${row}`;
      const acceptance = `${isMedia ? "N" : "M"}${row}`;
      const deadline = `${isMedia ? "K" : "J"}${row}`;
      const done = `${isMedia ? "L" : "K"}${row}`;
      if (isMedia) sheet.getCell(`O${row}`).value = { formula: `IF(A${row}="","",IF(${status}="Hủy",0,1))` };
      sheet.getCell(`${isMedia ? "P" : "N"}${row}`).value = { formula: `IF(A${row}="","",IF(AND(${acceptance}="Đạt",${status}<>"Hủy"),1,0))` };
      sheet.getCell(`${isMedia ? "Q" : "O"}${row}`).value = { formula: `IF(A${row}="","",IF(${status}="Hủy","Đã hủy",IF(${deadline}="","Thiếu deadline",IF(${done}<>"",IF(${done}<=${deadline},"Đúng hạn","Trễ hạn"),IF(${deadline}<TODAY(),"Quá hạn","Trong hạn")))))` };
      calculated.forEach(col => { sheet.getCell(row, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } }; });
      kpiTypes.forEach((type, i) => {
        const target = `${sheet.getColumn(baseHeaders.length + i * 3 + 1).letter}${row}`;
        const actual = `${sheet.getColumn(baseHeaders.length + i * 3 + 2).letter}${row}`;
        const ratio = sheet.getCell(row, baseHeaders.length + i * 3 + 3);
        ratio.value = { formula: `IF(OR(${target}="",${actual}="",${target}<=0),"",${type.direction === "at-most" ? `IF(${actual}=0,"",${target}/${actual})` : `${actual}/${target}`})` };
        ratio.numFmt = "0.00%";
        ratio.note = "KPI tối thiểu: thực hiện/chỉ tiêu. KPI tối đa: chỉ tiêu/thực hiện. Kết quả 0 của KPI tối đa đạt chỉ tiêu nhưng tỷ lệ không xác định, để trống. Kết quả chính thức chờ nghiệm thu.";
      });
    }
  }

  guide.getColumn(1).width = 110;
  guide.addRows([
    ["HƯỚNG DẪN NHẬP GIAO VIỆC MARKETING"],
    ["1. Điền sheet Media, Content, Ads hoặc SEO, mỗi công việc một dòng. Không đổi tên sheet và tiêu đề cột."],
    ["2. Điền số thứ tự ở cột A. Dòng không có số thứ tự sẽ bị bỏ qua khi import."],
    ["3. Bắt buộc: tháng kế hoạch (YYYY-MM), kênh, tên việc, định dạng, người phụ trách, Từ ngày và Đến ngày."],
    ["4. Kênh, định dạng, trạng thái, nghiệm thu có dropdown sẵn cho 500 dòng. Chọn đúng danh sách."],
    ["5. Ngày nhập theo YYYY-MM-DD hoặc nhập ngày Excel, ví dụ 2026-11-16. Deadline không trước ngày giao."],
    ["6. Có thể để trống trạng thái/nghiệm thu: hệ thống dùng Chưa bắt đầu/Chưa nghiệm thu. Nghiệm thu Đạt cần ngày hoàn thành."],
    ["7. Cột màu xám là công thức, không cần nhập. KPI chính thức được hệ thống tính lại khi import."],
    ["8. Mỗi việc không Hủy tính 1 số giao; nghiệm thu Đạt tính 1 hoàn thành. Tỷ lệ = hoàn thành / số giao × 100%."],
    ["9. Người phụ trách: nhập email tài khoản hoặc tên chính xác. Tên trùng/không khớp phải chọn tài khoản ở bản xem trước. Link sản phẩm và bài đăng dùng URL http/https."],
    ["10. Lưu file .xlsx, chọn Nhập file giao việc trên trang Giao việc, kiểm tra bản xem trước rồi lưu."],
    ["11. Marketing/Content nhập file sẽ chờ Leader nghiệm thu; Admin/Leader có thể nhập kết quả đã nghiệm thu từ Excel."],
    ["12. File mẫu để trống dữ liệu công việc, không có dòng ví dụ được tính KPI."],
    ["13. Cột Chỉ tiêu/Thực hiện lấy từ cấu hình KPI trong Cài đặt. Nhập chỉ tiêu dương để giao KPI; kết quả có thể để trống khi chưa thực hiện. KPI chi phí dùng điều kiện tối đa; KPI sản lượng dùng tối thiểu."],
  ]);
  guide.getRow(1).font = { bold: true, size: 14 };
  guide.eachRow(row => { row.alignment = { wrapText: true, vertical: "top" }; row.height = 36; });
  return book;
}

export async function downloadTaskTemplate(types: MarketingKpiType[] = []) {
  const { downloadBlob } = await import("@/lib/download");
  const book = await buildTaskTemplate(types);
  const buffer = await book.xlsx.writeBuffer();
  downloadBlob("SpeeGo_Mau_giao_viec_Marketing.xlsx", new Blob([new Uint8Array(buffer)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

export async function buildReportTemplate(platform: MarketingReport["platform"]) {
  const { default: ExcelJS } = await import("exceljs");
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Content");
  const headers = platform === "facebook"
    ? ["ID bài viết", "Tên Trang", "Liên kết vĩnh viễn", "Tiêu đề", "Loại bài viết", "Thời gian đăng", "Lượt xem", "Cảm xúc, bình luận và lượt chia sẻ"]
    : platform === "tiktok" ? ["Video title", "Video link", "Post time", "Total views", "Total likes", "Total comments", "Total shares"]
    : ["Post title", "Post URL", "Created date", "Content Type", "Impressions (organic)", "Likes (organic)", "Comments (organic)", "Reposts (organic)"];
  sheet.addRow(headers); sheet.views = [{ state:"frozen", ySplit:1 }];
  sheet.columns.forEach(col => { col.width = 30; col.numFmt = "@"; });
  sheet.getRow(1).font = { bold:true };
  const guide = book.addWorksheet("Hướng dẫn"); guide.getColumn(1).width = 120;
  guide.addRows([
    [`MẪU BÁO CÁO THỰC HIỆN · ${platform.toUpperCase()}`],
    ["Mỗi bài đăng một dòng trong sheet Content. Giữ nguyên tên cột. Không có dòng ví dụ trong dữ liệu."],
    ["Chọn đúng nền tảng, kênh và Ngày đo từ ngày / đến ngày trên trang Báo cáo thực hiện trước khi nhập file .xlsx này."],
    ["Ngày đăng dùng YYYY-MM-DD. Facebook cần Tên Trang đúng danh sách kênh. TikTok/LinkedIn dùng kênh được chọn trên màn hình."],
    ["Nhập ID và URL dạng văn bản để giữ nguyên số dài. Số liệu nhập dạng số không có dấu phân cách hàng nghìn. Ô trống nghĩa là thiếu số liệu; số 0 được giữ nguyên."],
    ["Số liệu lũy kế mới thay thế bản cũ; không cộng dồn. Ngày đo đến ngày không được trước ngày đăng."],
  ]);
  guide.eachRow(row => { row.alignment = { wrapText:true }; row.height = 34; });
  return book;
}

export async function downloadReportTemplate(platform: MarketingReport["platform"]) {
  const { downloadBlob } = await import("@/lib/download");
  const buffer = await (await buildReportTemplate(platform)).xlsx.writeBuffer();
  downloadBlob(`SpeeGo_Mau_bao_cao_${platform}.xlsx`, new Blob([new Uint8Array(buffer)], { type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}
