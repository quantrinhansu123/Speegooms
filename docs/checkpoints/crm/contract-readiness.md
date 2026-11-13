# Chuyển hợp đồng khi chưa có giá Logistics

- Phạm vi: Sale chuyển báo giá Sourcing thành hợp đồng trước khi Logistics báo giá lần đầu, cả Việt Nam và Global.
- Đối chiếu: 2026-11-13, nền `d3521d5`, nguồn `6605e52` trên nhánh `fix/sourcing-contract-before-logistics`; đích bàn giao main local theo yêu cầu, chưa push/deploy.

## Quyết định

- Báo giá Sourcing phải có bản đã gửi và không đang chờ báo giá lại. Phiếu Logistics chưa tồn tại hoặc chỉ có bản nháp không chặn tạo hợp đồng.
- Nếu Logistics đã từng gửi nhưng đang chờ báo giá lại thì vẫn chặn, tránh chốt theo giá vận chuyển đã bị trả lại. Khách thuần Logistics vẫn phải có báo giá Logistics đã gửi.
- Giao diện và API chỉ lấy cước từ bản Logistics đã gửi. Chưa có bản đã gửi thì phí vận chuyển là 0, tổng hợp đồng chỉ gồm tiền hàng Sourcing; bản nháp rỗng, có giá hoặc có phụ phí chưa hợp lệ đều không được cộng vào hợp đồng. API không dùng số phí vận chuyển tự gửi lên thay cho báo giá.
- Form tạo hợp đồng hiển thị rõ “Chưa có báo giá Logistics · tạm tính 0”. Quyền tạo vẫn chỉ Sale Việt Nam, Sale Global và Admin.
- Hợp đồng giữ số tiền tại thời điểm tạo. Thay đổi này chưa bổ sung tự động cộng cước khi Logistics gửi giá sau đó; không suy ra phí 0 là miễn phí vận chuyển.

## Nguồn

- `shared/src/contract-readiness.ts`: `contractQuoteProblems`, được cả `RfqQuotesView`, `QuoteEditor` và `CrmService.createContract` dùng.
- `src/features/crm/live/contract-create-dialog.tsx`: chọn bản Logistics đã gửi, tạm tính 0 và thông báo trên form.
- `server/src/adapters/postgres/crm.repository.ts`: `createContract`, tính và lưu số tiền hợp đồng.
- `server/src/config/contract-readiness.test.ts`, `server/src/config/quote-workflow.test.ts`: chính sách, service và số tiền lưu ở repository.

## Kiểm chứng và giới hạn

- Trước sửa, 3 test hồi quy thất bại đúng nguyên nhân: điều kiện giao diện/API đòi Logistics và repository dùng phí tự gửi khi chưa có giá. Sau sửa, 56/56 test trong hai file trên qua với `node ../../node_modules/tsx/dist/cli.mjs --tsconfig server/tsconfig.json --test server/src/config/contract-readiness.test.ts server/src/config/quote-workflow.test.ts` tại worktree.
- Bao phủ cả hai tuyến, Logistics chưa tồn tại/nháp rỗng/nháp có giá/nháp chưa hợp lệ, không cho vượt điều kiện Sourcing, giữ chặn báo giá lại và giữ nguyên cước đã gửi/khác loại tiền/khách thuần Logistics.
- Typecheck API (`tsc --noEmit --project server/tsconfig.json`), frontend (`next typegen`, `tsc --noEmit --incremental false`) và `git diff --check` qua. Worktree dùng lại thư viện server đã cài ở worktree main qua junction, không đổi dependency.
- Chưa thử trình duyệt hoặc API/DB thật, chưa chạy toàn bộ test/build và chưa xác nhận production.
- Trước tích hợp: `git pull --ff-only origin main` xác nhận main vẫn ở `d3521d5`, không phát sinh thay đổi code hay xung đột so với revision đã kiểm tra. Ghi chú bàn giao chỉ sửa tài liệu; không chạy lại test đã qua trên cùng code.
