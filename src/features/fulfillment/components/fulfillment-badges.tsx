import { StatusBadge } from "@/components/shared/status-badge";
import { deliveryStatusMeta, inquiryStatusMeta, outboundStatusMeta, packageStatusMeta, receiptStatusMeta } from "@/config/fulfillment";
import type { DeliveryStatus, InquiryStatus, OutboundStatus, PackageStatus, ReceiptStatus } from "@/types/fulfillment";

export const ReceiptBadge = ({ value }: { value: ReceiptStatus }) => <StatusBadge tone={receiptStatusMeta[value].tone}>{receiptStatusMeta[value].label}</StatusBadge>;
export const PackageBadge = ({ value }: { value: PackageStatus }) => <StatusBadge tone={packageStatusMeta[value].tone}>{packageStatusMeta[value].label}</StatusBadge>;
export const OutboundBadge = ({ value }: { value: OutboundStatus }) => <StatusBadge tone={outboundStatusMeta[value].tone}>{outboundStatusMeta[value].label}</StatusBadge>;
export const DeliveryBadge = ({ value }: { value: DeliveryStatus }) => <StatusBadge tone={deliveryStatusMeta[value].tone}>{deliveryStatusMeta[value].label}</StatusBadge>;
export const InquiryBadge = ({ value }: { value: InquiryStatus }) => <StatusBadge tone={inquiryStatusMeta[value].tone}>{inquiryStatusMeta[value].label}</StatusBadge>;
