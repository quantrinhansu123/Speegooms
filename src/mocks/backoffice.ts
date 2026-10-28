import users from "./users.json";
import leads from "./crm/leads.json";
import type { BackofficeSnapshot } from "@/types/backoffice";
import type { Department } from "@/types/role";

export function backofficeSeed(): BackofficeSnapshot {
  return {
    campaigns: [
      { id: "CD-001", name: "Nhập hàng Trung Quốc Q4", source: "ads", startOn: "2026-10-01", endOn: "2026-11-30", budget: 45000000, spent: 26000000, status: "dang-chay" },
      { id: "CD-002", name: "Vận chuyển Việt – Mỹ", source: "google", startOn: "2026-10-01", endOn: "2026-12-15", budget: 30000000, spent: 18500000, status: "dang-chay" },
      { id: "CD-003", name: "Cẩm nang logistics", source: "organic", startOn: "2026-09-01", endOn: "2026-11-30", budget: 12000000, spent: 6000000, status: "tam-dung" },
    ],
    feedback: leads.slice(0, 3).map((l, i) => ({ id: `PH-${i + 1}`, messId: l.mess_id, quality: i === 0 ? "Tốt" : "Cần bổ sung", note: i === 0 ? "Nhu cầu rõ ràng, khách phản hồi nhanh (mẫu)." : "Cần xác minh thời gian và ngân sách (mẫu).", by: l.owner_id, at: "2026-10-27T09:30" })),
    complaints: [
      { id: "KN-0001", orderId: "DH-2026-0001", title: "Bao bì móp khi nhận hàng", description: "Khách phản ánh hai thùng bị móp, cần đối chiếu biên bản giao nhận.", category: "Hư hỏng hàng", priority: "Cao", assigneeId: "u-vh", dueOn: "2026-10-29", status: "dang-xu-ly", evidence: ["Ảnh mẫu: hai thùng móp tại điểm giao (minh họa, chưa tải tệp)"], result: "", compensation: { amount: 0, reason: "", status: "chua" }, history: [{ id: "KN-LS-1", orderId: "DH-2026-0001", at: "2026-10-27T09:00", by: "u-sgl", text: "Tạo khiếu nại từ phản hồi khách (dữ liệu mẫu)" }, { id: "KN-LS-2", orderId: "DH-2026-0001", at: "2026-10-28T08:30", by: "u-vh", text: "Tiếp nhận, đang kiểm tra POD" }] },
      { id: "KN-0002", orderId: "DH-2026-0002", title: "Yêu cầu đối chiếu chứng từ", description: "Cần xác minh thông tin trên invoice với khách hàng.", category: "Sai chứng từ", priority: "Thường", assigneeId: "u-vh", dueOn: "2026-10-27", status: "moi", evidence: [], result: "", compensation: { amount: 0, reason: "", status: "chua" }, history: [{ id: "KN-LS-3", orderId: "DH-2026-0002", at: "2026-10-26T10:00", by: "u-svn", text: "Tạo yêu cầu đối chiếu (dữ liệu mẫu)" }] },
    ],
    employees: users.filter((u) => !["admin", "ban-gd"].includes(u.role)).map((u) => ({
      id: u.id, name: u.name, email: u.email, department: u.role as Department, position: u.title,
      managerId: "", joinedOn: "2025-06-01", status: "chinh-thuc", contractType: "Có thời hạn (mock)", contractEnd: "2027-06-01", documents: ["Hợp đồng lao động mẫu", "Thông tin nhân sự mẫu"],
    })),
    candidates: [
      { id: "UV-001", name: "Nguyễn Minh Anh", email: "minhanh@example.test", department: "marketing", position: "Content Executive", status: "phong-van", startOn: "2026-11-02", tasks: [] },
      { id: "UV-002", name: "Lê Hoàng Nam", email: "hoangnam@example.test", department: "van-hanh", position: "Điều phối Logistics", status: "onboarding", startOn: "2026-11-01", tasks: ["Hồ sơ lao động"] },
    ],
    attendance: [{ id: "CC-001", employeeId: "u-hr", date: "2026-10-28", checkIn: "08:25", checkOut: "" }],
    legal: [{ id: "PL-0001", title: "Rà soát trách nhiệm giao nhận", refId: "DH-2026-0001", refType: "hop-dong", request: "Xin ý kiến về điều khoản trách nhiệm khi bao bì hư hỏng.", assigneeId: "u-pc", dueOn: "2026-10-30", status: "dang-ra-soat", opinion: "", history: [{ id: "PL-LS-1", orderId: "DH-2026-0001", at: "2026-10-27T10:15", by: "u-pc", text: "Tiếp nhận rà soát hợp đồng mẫu" }] }],
  };
}
