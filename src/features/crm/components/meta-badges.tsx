import { StatusBadge } from "@/components/shared/status-badge";
import {
  approvalMeta,
  careStatusMeta,
  contractStatusMeta,
  depositMeta,
  quoteStatusMeta,
  rfqStatusMeta,
  sourceLabels,
  temperatureMeta,
} from "@/config/crm";
import type {
  ApprovalState,
  CareStatus,
  ContractStatus,
  DepositStatus,
  LeadSource,
  QuoteStatus,
  RfqStatus,
  Temperature,
} from "@/types/crm";

export const TemperatureBadge = ({ value }: { value: Temperature }) => (
  <StatusBadge tone={temperatureMeta[value].tone}>{temperatureMeta[value].label}</StatusBadge>
);
export const CareBadge = ({ value }: { value: CareStatus }) => (
  <StatusBadge tone={careStatusMeta[value].tone}>{careStatusMeta[value].label}</StatusBadge>
);
export const RfqBadge = ({ value }: { value: RfqStatus }) => (
  <StatusBadge tone={rfqStatusMeta[value].tone}>{rfqStatusMeta[value].label}</StatusBadge>
);
export const QuoteBadge = ({ value }: { value: QuoteStatus }) => (
  <StatusBadge tone={quoteStatusMeta[value].tone}>{quoteStatusMeta[value].label}</StatusBadge>
);
export const ContractBadge = ({ value }: { value: ContractStatus }) => (
  <StatusBadge tone={contractStatusMeta[value].tone}>{contractStatusMeta[value].label}</StatusBadge>
);
export const DepositBadge = ({ value }: { value: DepositStatus }) => (
  <StatusBadge tone={depositMeta[value].tone}>{depositMeta[value].label}</StatusBadge>
);

export function ApprovalText({ value }: { value: ApprovalState }) {
  return <span>{approvalMeta[value]}</span>;
}

/** Nhãn nguồn dạng chữ; Affiliate gắn thêm "đề xuất" vì chưa kích hoạt. */
export function SourceTag({ source }: { source: LeadSource }) {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
      {sourceLabels[source]}
    </span>
  );
}
