# Tổ chức checkpoint dự án

- Từ khóa: checkpoint, context, mục lục, token, tra cứu, tài liệu dùng chung.
- Nguồn: commit khởi tạo `9b17d04`; người dùng chốt phạm vi chia sẻ ngày 2026-11-08.
- Phạm vi: tổ chức tài liệu; chưa đo mức giảm token trong các task thực tế.

## Quyết định

- Lưu ghi chú trong `docs/checkpoints/`, có [INDEX.md](../INDEX.md) ngắn dẫn tới chủ đề phù hợp. Chỉ đọc chủ đề liên quan và đối chiếu code tại revision hiện tại.
- Ghi quyết định, phát hiện, đường dẫn code/test, commit nguồn và giới hạn. Khởi tạo từ nguồn đã kiểm chứng, không quét toàn dự án để tạo tài liệu.
- Checkpoint được Git theo dõi để mọi người xem được. Các quy tắc Git cá nhân của chủ workspace được giữ trong `AGENTS.md` local đang ignore; không áp đặt thành yêu cầu merge chung cho người khác.
- Mục bắt buộc trước merge từng được thêm trong `03e1431` đã được bỏ khỏi hướng dẫn chia sẻ theo quyết định trên. Quy tắc local vẫn được giữ.

## Nguồn cần mở

- [Hướng dẫn ghi chú](../README.md): định dạng, cách cập nhật, nguồn online đã tham khảo.
- [README dự án](../../../README.md): liên kết vào mục lục cho người đọc repo.
- [.gitignore](../../../.gitignore): `/AGENTS.md` là tệp hướng dẫn local; thư mục checkpoint được theo dõi.

## Kiểm chứng và giới hạn

Đã kiểm tra các liên kết nội bộ tồn tại, `git diff --check` và việc ignore `AGENTS.md`. Không chạy lại test ứng dụng cho thay đổi tài liệu. Ghi chú CRM đầu tiên có mốc commit và kết quả test riêng; không suy rộng kết quả đó cho mọi nhánh.
