import type { Role } from "@speego/shared";

/** Khớp src/mocks/users.json. Mật khẩu không nằm ở đây. */
export const demoUsers: {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  title: string;
}[] = [
  { id: "u-admin", name: "Nguyễn Văn An", email: "admin@speego.vn", role: "admin", department: "Quản trị hệ thống", title: "Quản trị viên" },
  { id: "u-bgd", name: "Trần Thế Tài", email: "bangiamdoc@speego.vn", role: "ban-gd", department: "Ban Giám đốc", title: "Giám đốc điều hành" },
  { id: "u-mkt", name: "Đỗ Hải Yến", email: "marketing@speego.vn", role: "marketing", department: "Marketing", title: "Trưởng nhóm Ads" },
  { id: "u-svn", name: "Trần Thị Bình", email: "salevn@speego.vn", role: "sale-vn", department: "Sale Việt Nam", title: "Trưởng phòng" },
  { id: "u-sgl", name: "Lê Minh Châu", email: "saleglobal@speego.vn", role: "sale-global", department: "Sale Global", title: "Trưởng nhóm Tư vấn" },
  { id: "u-vh", name: "Phạm Quốc Dũng", email: "vanhanh@speego.vn", role: "van-hanh", department: "Vận hành", title: "Trưởng nhóm Logistics" },
  { id: "u-kt", name: "Hoàng Thu Hà", email: "ketoan@speego.vn", role: "ke-toan", department: "Kế toán", title: "Kế toán đối soát" },
  { id: "u-hr", name: "Đinh Ngọc Lan", email: "hcns@speego.vn", role: "hcns", department: "HCNS", title: "Chuyên viên nhân sự" },
  { id: "u-pc", name: "Trương Văn Khoa", email: "phapche@speego.vn", role: "phap-che", department: "Pháp chế", title: "Chuyên viên pháp chế" },
];
