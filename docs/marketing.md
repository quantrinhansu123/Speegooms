# Giao việc và KPI Marketing

- `/marketing/giao-viec`: hai tab Media/Content, tạo/sửa việc và nhập workbook giao việc gốc.
  Nút **Tải mẫu giao việc** tải Excel trống gồm hai sheet Media/Content, dropdown cho 500 dòng, công thức KPI/deadline và sheet hướng dẫn. Điền mẫu rồi import lại; cột Link bài đăng dùng ghép báo cáo.
- `/marketing/bao-cao-thuc-hien`: nhập CSV Facebook, ZIP Content TikTok, XLS/XLSX LinkedIn; phân loại lại định dạng nếu export thiếu.
- `/marketing/tong-hop-kpi`: lọc tháng/kênh/người; nhóm theo người, kênh hoặc Media/Content; bấm nhóm để xem việc; xuất Excel.

Mỗi dòng giao việc không Hủy là 1 KPI giao. Chỉ nghiệm thu Đạt mới ghi nhận 1 KPI thực hiện. Tỷ lệ = tổng ghi nhận / tổng giao. Không có số giao thì để trống tỷ lệ. Deadline hoàn thành khác ngày đăng; báo cáo nền tảng không tự nghiệm thu công việc.

Leader Marketing và Admin có toàn quyền module Marketing, bao gồm giao lại việc và nghiệm thu. Marketing Content được tạo order video, sửa các order do mình tạo, cập nhật việc mình nhận; không được nghiệm thu hoặc sửa order của người khác. Marketing thường chỉ cập nhật tiến độ, link sản phẩm và ghi chú của việc được giao cho mình; được nhập báo cáo kênh. Ban GĐ chỉ xem. Tài khoản nhận việc phải thuộc nhóm Marketing/Admin. Khi import phải chọn tài khoản nhận cụ thể; tên/email khớp duy nhất được ghép tự động. Người không có quyền nghiệm thu nhập Excel sẽ chờ Leader duyệt lại.

Import hiển thị lỗi theo dòng và cho bỏ dòng ví dụ trước khi lưu. Những việc có cùng nhóm/tháng/kênh/tên/người được bỏ qua khi nhập lại. Hai người sửa cùng một việc được kiểm tra phiên bản để tránh ghi đè. Báo cáo được cập nhật theo nền tảng/kênh/ID bài; bản có ngày đo cũ hơn không ghi đè số liệu mới. Không cộng các bản lũy kế. Ghép công việc qua link bài đăng; link sản phẩm final là trường riêng.

Facebook và LinkedIn xuất ngày theo tháng/ngày/năm. TikTok thiếu năm nên người nhập phải chọn năm đăng và kênh. Overview/Followers/Viewers TikTok không thay thế báo cáo từng bài. LinkedIn dùng Impressions, không gọi là unique reach. Chưa có định dạng hoặc baseline thì không tự kết luận đạt/chưa đạt. Baseline lấy từ workbook Organic trong docs/resources; điều kiện xem 3 giây chưa dùng do nguồn chưa có số liệu.

Lưu dữ liệu dùng Postgres. Chạy `pnpm --filter @speego/server migrate` để áp dụng `069_marketing.sql` trên mỗi môi trường. Không có Postgres, API trả lỗi rõ ràng, không lưu tạm trong trình duyệt.

Kiểm tra: `pnpm check:marketing`, `pnpm typecheck:api`, `pnpm exec tsc --noEmit --incremental false`, `pnpm build`. Các kiểm thử import tự tạo workbook và báo cáo giả lập, không cần dữ liệu nội bộ. File tham khảo gốc trong `docs/resources` chỉ lưu cục bộ và được Git bỏ qua.

Migration 070_marketing_assignment_roles.sql bổ sung marketing-lead/marketing-content, index assigneeId và cập nhật mkt02/mkt04 theo yêu cầu. Người giao/Order và người nhận được lưu bằng ID; tên hiển thị là bản chụp. Bộ lọc Việc của tôi và KPI nhóm theo ID người nhận để không gộp nhầm người trùng tên. Giao mới/giao lại tạo thông báo nội bộ trong cùng transaction với công việc; thông báo mở trực tiếp form chi tiết.
