import { facebookStatuses, hasActiveTelesale, telesaleStatuses, type DataLanhRecord } from "@speego/shared";

export type StatusChannel = "" | "facebook" | "telesale";

export function matchesDataLanhStatus(row: Pick<DataLanhRecord, "facebookStatus" | "telesaleStatus">, channel: StatusChannel, status: string): boolean {
  if (!channel) return true;
  if (channel === "facebook" && row.facebookStatus === facebookStatuses[6] && hasActiveTelesale(row.telesaleStatus)) return false;
  const value = channel === "facebook" ? row.facebookStatus : row.telesaleStatus;
  if (!value || value === (channel === "facebook" ? facebookStatuses[0] : telesaleStatuses[0])) return false;
  return !status || value === status;
}
