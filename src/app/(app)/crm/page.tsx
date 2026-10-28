import { redirect } from "next/navigation";

// Shell của phân hệ chỉ render trang sau khi dữ liệu client sẵn sàng, nên không validate được instant navigation.
export const instant = false;

export default function CrmIndex() {
  redirect("/crm/leads");
}
