import { QUOTE_VALIDITY_WARN_DAYS, formatQuoteDay, quoteValidity, type SentQuote } from "@speego/shared";
import { StatusBadge } from "@/components/shared/status-badge";
import type { StatusTone } from "@/types/status";
import {
  careChannelOptions,
  classificationOptions,
  contractStatusOptions,
  customerKindOptions,
  customerTypeOptions,
  demandOptions,
  labelOf,
  messageClassificationOptions,
  messageStatusLabels,
  potentialOptions,
  quoteStatusOptions,
} from "./types";

function optionBadge(
  options: readonly (readonly [string, string])[],
  value: string | null | undefined,
  tone: StatusTone,
) {
  const label = labelOf(options, value ?? null);
  if (!value || label === "—") return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={tone}>{label}</StatusBadge>;
}

function quoteTone(value: string | null | undefined): StatusTone {
  switch (value) {
    case "DA_CO_BAO_GIA":
    case "DA_CO_BAO_GIA_LAI":
      return "success";
    case "CHUA_CO_BAO_GIA_LAI":
      return "warning";
    case "CHUA_CO_BAO_GIA":
      return "neutral";
    default:
      return "neutral";
  }
}

function contractTone(value: string | null | undefined): StatusTone {
  switch (value) {
    case "DA_TAO":
      return "success";
    case "CHUA_TAO":
      return "warning";
    default:
      return "neutral";
  }
}

function messageTone(value: string | null | undefined): StatusTone {
  switch (value) {
    case "NEW":
      return "info";
    case "CONTACTED":
    case "QUALIFIED":
      return "warning";
    case "CONVERTED":
      return "success";
    case "LOST":
      return "danger";
    case "DORMANT":
      return "neutral";
    default:
      return "neutral";
  }
}

function potentialTone(value: string | null | undefined): StatusTone {
  switch (value) {
    case "DEPOSITED":
      return "success";
    case "CLOSING":
      return "warning";
    case "POTENTIAL":
      return "info";
    case "NOT_ORDERED":
      return "danger";
    default:
      return "neutral";
  }
}

function heatTone(value: string | null | undefined): StatusTone {
  switch (value) {
    case "HOT":
      return "danger";
    case "WARM":
      return "warning";
    case "COLD":
      return "info";
    case "DEAD":
      return "neutral";
    default:
      return "neutral";
  }
}

function demandTone(value: string | null | undefined): StatusTone {
  switch (value) {
    case "SHIPPING":
      return "info";
    case "SOURCING":
      return "warning";
    default:
      return "neutral";
  }
}

function customerKindTone(value: string | null | undefined): StatusTone {
  switch (value) {
    case "SOURCING":
      return "warning";
    case "LOGISTICS":
      return "info";
    default:
      return "neutral";
  }
}

function customerTypeTone(value: string | null | undefined): StatusTone {
  switch (value) {
    case "ENTERPRISE":
      return "info";
    case "PRINCIPAL":
      return "warning";
    case "INDIVIDUAL":
      return "neutral";
    default:
      return "neutral";
  }
}

export function QuoteStatusBadge({ value }: { value: string | null | undefined }) {
  const label = labelOf(quoteStatusOptions, value ?? null);
  if (!value || label === "—") return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={quoteTone(value)}>{label}</StatusBadge>;
}

/** Hạn báo giá: kể từ lần gửi gần nhất. Đang điều chỉnh (Sale trả về) thì chưa có hạn mới. */
export function ValidityBadge({ sent, status }: { sent: SentQuote | null | undefined; status: string | null | undefined }) {
  if (status === "CHUA_CO_BAO_GIA_LAI") return <StatusBadge tone="warning">Đang điều chỉnh</StatusBadge>;
  const validity = quoteValidity(sent);
  if (!validity) return <span className="text-muted-foreground">—</span>;
  const expires = formatQuoteDay(validity.expiresOn);
  const title = `Hiệu lực ${validity.days} ngày, hết hạn ${expires}`;
  if (validity.expired) return <span title={title}><StatusBadge tone="danger">Hết hạn {expires}</StatusBadge></span>;
  const tone: StatusTone = validity.remainingDays <= QUOTE_VALIDITY_WARN_DAYS ? "warning" : "neutral";
  const label = validity.remainingDays === 0 ? "Hết hạn hôm nay" : `Còn ${validity.remainingDays} ngày`;
  return <span title={title}><StatusBadge tone={tone}>{label}</StatusBadge></span>;
}

export function ContractStatusBadge({ value }: { value: string | null | undefined }) {
  const label = labelOf(contractStatusOptions, value ?? null);
  if (!value || label === "—") return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={contractTone(value)}>{label}</StatusBadge>;
}

export function MessageStatusBadge({
  status,
  leadCode,
}: {
  status: string | null | undefined;
  leadCode?: string | null;
}) {
  if (leadCode) {
    return <StatusBadge tone="success">Đã chuyển · {leadCode}</StatusBadge>;
  }
  const label = status ? messageStatusLabels[status] ?? status : null;
  if (!label) return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={messageTone(status)}>{label}</StatusBadge>;
}

export function PotentialStatusBadge({ value }: { value: string | null | undefined }) {
  const label = labelOf(potentialOptions, value ?? null);
  if (!value || label === "—") return <span className="text-muted-foreground">—</span>;
  return <StatusBadge tone={potentialTone(value)}>{label}</StatusBadge>;
}

export function HeatBadge({ value }: { value: string | null | undefined }) {
  return optionBadge(messageClassificationOptions, value, heatTone(value));
}

export function DemandBadge({ value }: { value: string | null | undefined }) {
  return optionBadge(demandOptions, value, demandTone(value));
}

export function CustomerKindBadge({ value }: { value: string | null | undefined }) {
  return optionBadge(customerKindOptions, value, customerKindTone(value));
}

export function CustomerTypeBadge({ value }: { value: string | null | undefined }) {
  return optionBadge(customerTypeOptions, value, customerTypeTone(value));
}

export function LogisticsClassBadge({ value }: { value: string | null | undefined }) {
  const tone: StatusTone = value === "FCL" ? "info" : value === "LCL" ? "warning" : "neutral";
  return optionBadge(classificationOptions, value, tone);
}

export function CareChannelBadge({ value }: { value: string | null | undefined }) {
  return optionBadge(careChannelOptions, value, "info");
}
