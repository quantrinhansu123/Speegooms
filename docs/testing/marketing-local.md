# Test Marketing với PostgreSQL local

- Web: http://127.0.0.1:3000/marketing/giao-viec
- API: http://127.0.0.1:4000
- DB: `postgresql://postgres@127.0.0.1:55443/speego_local`, SSL tắt.
- PostgreSQL chỉ lắng nghe loopback. Dữ liệu được giữ tại `.local/postgres/data`, không commit Git.
- Cấu hình backend trước khi chuyển local được giữ tại `.local/server-env-before-local.env`.

Mật khẩu chung cho các tài khoản test: `speego@demo`.

| Tài khoản | Vai trò |
| --- | --- |
| mkt02@speegocorp.com | Leader Marketing |
| mkt04@speegocorp.com | Marketing Content |
| mkt01@speegocorp.com | Marketing / Media nhận video |
| admin@speego.vn | Admin |

DB local dùng dữ liệu demo, không sao chép dữ liệu thật. Đăng nhập lại sau khi chuyển DB vì phiên đăng nhập cũ không tồn tại trong DB mới.

Khởi động DB sau khi mở lại máy:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/start-local-postgres.ps1
pnpm dev:stack
```

Migration mới vẫn chạy bằng `pnpm --filter @speego/server migrate`.

Tạo lại/cập nhật các tài khoản demo local: `pnpm exec tsx server/src/scripts/seed-marketing-local.ts`. Script chỉ chạy trên DB loopback tên `speego_local` và đặt lại mật khẩu tài khoản demo theo `SEED_USER_PASSWORD`.

Test: Content tạo Order video, chọn Media 1; Media đăng nhập xem Việc của tôi, cập nhật tiến độ/nộp link; Leader nghiệm thu và kiểm tra Tổng hợp KPI. Có thể đổi vai trò trong các cửa sổ riêng để kiểm tra thông báo.

Chuyển lại cấu hình trước đó khi cần: sao chép `.local/server-env-before-local.env` về `server/.env`, rồi khởi động lại API.
