"use client";

import { useAccounting } from "@/features/accounting/hooks";
import { useBackoffice } from "@/features/backoffice/hooks";
import { useFulfillment } from "@/features/fulfillment/hooks";

/** Cùng các store nghiệp vụ đang dùng ở màn chi tiết; không có bộ dữ liệu báo cáo riêng. */
export function usePlatformData() {
  const accounting = useAccounting();
  const fulfillment = useFulfillment();
  const backoffice = useBackoffice();
  return { ...accounting, wh: fulfillment.wh, backoffice: backoffice.data, error: accounting.error ?? fulfillment.error ?? backoffice.error, ready: accounting.ready && fulfillment.ready && backoffice.ready };
}
