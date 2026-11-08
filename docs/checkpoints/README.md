# Ghi và cập nhật checkpoint

Mục tiêu: giúp phiên làm việc sau tìm lại quyết định và bằng chứng với ít lượt đọc. Điểm vào là [INDEX.md](INDEX.md).

## Khi nào ghi

Ghi khi một quyết định nghiệp vụ, phát hiện khó tìm, giới hạn hoặc việc chưa giải quyết có thể làm task sau chọn sai cách xử lý hay phải điều tra lại. Giữa các lần merge, không cần tạo ghi chú cho từng chỉnh sửa nhỏ.

Khởi tạo từ những nguồn đã kiểm chứng trong task. Không cần audit toàn dự án hoặc chép lại tài liệu kiến trúc để tạo checkpoint đầu tiên.

## Một file cho một chủ đề

Đặt tại `<nghiệp-vụ>/<chủ-đề>.md`, tên rõ và ổn định. Cập nhật file hiện có khi cùng chủ đề; chỉ tách file nếu nội dung phục vụ các task khác nhau. Mục tiêu là một ghi chú ngắn dễ đọc, nhưng phải giữ đủ điều kiện và giới hạn để tránh hiểu sai.

Mỗi ghi chú có:

- **Phạm vi và từ khóa:** lúc nào cần đọc.
- **Đối chiếu:** ngày, commit nguồn; trạng thái đã kiểm chứng hoặc cần kiểm tra lại.
- **Quyết định/phát hiện:** điều phải giữ và lý do nếu có bằng chứng; phần chưa rõ phải ghi rõ.
- **Đường dẫn:** file và tên hàm/schema/test để mở đúng nơi; ưu tiên đường dẫn tương đối, không phụ thuộc số dòng.
- **Kiểm chứng và việc còn mở:** lệnh, kết quả thực sự quan sát được, revision áp dụng và điều chưa kiểm tra.

Khi code thay đổi hành vi được ghi, cập nhật checkpoint liên quan và dòng mục lục trong cùng task. Quyết định đã thay thế phải được ghi rõ; chỉ giữ lịch sử cũ nếu còn cần cho tương thích hoặc điều tra. Dùng Git để tra lịch sử dài.

## Đọc và xác minh

Code, test và trạng thái Git hiện tại là nguồn để xác minh. Có thể dùng `git diff <commit-nguồn> -- <file-liên-quan>` để khoanh vùng thay đổi; không mặc định ghi chú vẫn đúng chỉ vì ghi chú chưa được sửa.

Chỉ ghi kết quả test cho đúng revision đã chạy. Chạy thêm test theo rủi ro của thay đổi ứng dụng; việc cập nhật tài liệu đơn thuần chỉ cần kiểm tra đường dẫn, nội dung và diff.

Không chép transcript, toàn bộ log, source code, dữ liệu khách hàng, thông tin bí mật hoặc facts đã có nguồn chuẩn. Dẫn tới nguồn thay vì sao chép. Không tự suy ra lý do kinh doanh từ code.

## Nguồn thiết kế

Đã tham khảo ngày 2026-11-08; đây là các nguyên tắc được áp dụng cho repo, không phải yêu cầu phải đọc lại web trong mỗi task.

- [OpenAI — Rethinking skills and prompts, 2026-09-11](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra): hướng dẫn ngắn, đọc tài liệu theo task.
- [OpenAI — Iterating Development Workflows, 2026-08-03](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex): giữ quyết định có ảnh hưởng về sau, dẫn bằng chứng và giới hạn.
- [Anthropic — Effective context engineering](https://www.anthropic.com/research/effective-context-engineering-for-ai-agents): dùng đường dẫn và tìm kiếm để nạp ngữ cảnh khi cần.
