# Deploy backend Express lên Vercel

Tạo project riêng cho BE từ cùng repository với FE:

- Root Directory: `server`.
- Framework Preset: **Express** (`server/vercel.json` đã khai báo).
- Bật **Include source files outside of the Root Directory in the Build Step** vì BE dùng workspace `../shared`.
- Giữ Install Command, Build Command và Output Directory theo mặc định Express. Không dùng `next build` hay chọn thư mục `db`.
- Thêm `ENABLE_EXPERIMENTAL_COREPACK=1` để cài pnpm theo `packageManager` ở gốc repository.
- Import env BE vào **Production**. Chỉ dùng cùng env cho Preview nếu chủ đích dùng chung database.

Entry `index.ts` tạo container một lần khi module được nạp và export Express app, không mở port hay đăng ký xử lý tắt process. `src/main.ts` vẫn dùng cho local/server Node chạy thường. Trên Vercel, env được lấy từ Project Settings; entry không đọc `server/.env`.

## Env BE

- `NODE_ENV=production`
- `DB_PROVIDER=postgres`
- `DATABASE_URL`: URL PostgreSQL/pooler của database đã chuẩn bị.
- `DATABASE_SSL=true` nếu database cloud yêu cầu TLS.
- `SESSION_SECRET`, `CSRF_SECRET`: hai secret riêng, mỗi secret ít nhất 32 ký tự.
- `CORS_ORIGINS`: origin HTTPS của FE; nhiều origin cách nhau bằng dấu phẩy, không dùng `*`.
- `TRUST_PROXY=true`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: cần đủ cả ba để upload ảnh.
- `CLOUDINARY_UPLOAD_FOLDER=speego`
- `SEED_USER_PASSWORD`: chỉ cần khi chủ động chạy seed; không đổi mật khẩu tài khoản đã có.

Không cần tự đặt `PORT`, `HOST`, `VERCEL` hay `VERCEL_URL` cho entry Vercel. Không commit file env hay key vào Git. Production cấm `DB_PROVIDER=memory`; dùng `postgres` để có đầy đủ CRM và thông báo.

## Kiểm tra sau deploy

1. Mở `https://<ten-be>.vercel.app/api/health`; cần HTTP 200 và `{"status":"ok"}`. Endpoint này kiểm tra kết nối database.
2. Nếu database mới, chạy migration và tạo tài khoản theo quy trình quản trị; deployment không tự chạy migration hay seed.
3. Cập nhật `CORS_ORIGINS` theo tên miền FE thực tế và redeploy BE.
4. FE cần rewrite `/api/:path*` sang `https://<ten-be>.vercel.app/api/:path*`. Deploy BE không tự thêm rewrite vào FE.
5. Kiểm tra đăng nhập, tải lại trang, đăng xuất, ghi dữ liệu và upload qua tên miền FE.

Tài liệu: [Express trên Vercel](https://vercel.com/docs/frameworks/backend/express), [workspace ngoài Root Directory](https://vercel.com/docs/monorepos/monorepo-faq).
