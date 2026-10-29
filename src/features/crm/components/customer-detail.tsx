"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Field } from "@/components/shared/form-fields";
import { SectionCard } from "@/components/shared/section-card";
import { routeLabels } from "@/config/crm";
import { formatDate, formatVnd } from "@/lib/format";
import type { Contract, Lead, Rfq } from "@/types/crm";
import { useCrm } from "../hooks";
import { DuplicateAlert } from "./customers-view";
import { CareBadge, ContractBadge, DepositBadge, RfqBadge, TemperatureBadge } from "./meta-badges";

const leadCols: Column<Lead>[] = [
  { key: "m", header: "mess_id", cell: (l) => <Link href={`/crm/leads/${l.messId}`} className="font-mono text-xs text-primary hover:underline">{l.messId}</Link> },
  { key: "d", header: "Ngày", cell: (l) => <span className="tabular">{formatDate(l.createdAt)}</span> },
  { key: "t", header: "Phân loại", cell: (l) => <TemperatureBadge value={l.temperature} /> },
  { key: "c", header: "Trạng thái", cell: (l) => <CareBadge value={l.careStatus} /> },
];
const rfqCols: Column<Rfq>[] = [
  { key: "r", header: "rfq_id", cell: (r) => <Link href={`/crm/rfq/${r.rfqId}`} className="font-mono text-xs text-primary hover:underline">{r.rfqId}</Link> },
  { key: "g", header: "Hàng hóa", cell: (r) => r.goodsName },
  { key: "m", header: "mess_id", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.messId}</span>, className: "hidden lg:table-cell" },
  { key: "s", header: "Trạng thái", cell: (r) => <RfqBadge value={r.status} /> },
];
const contractCols: Column<Contract>[] = [
  { key: "o", header: "order_id", cell: (c) => <Link href={`/crm/hop-dong/${c.orderId}`} className="font-mono text-xs text-primary hover:underline">{c.orderId}</Link> },
  { key: "n", header: "Hợp đồng", cell: (c) => c.contractNo, className: "hidden md:table-cell" },
  { key: "v", header: "Giá trị", align: "right", cell: (c) => formatVnd(c.value) },
  { key: "s", header: "Hợp đồng", cell: (c) => <ContractBadge value={c.status} /> },
  { key: "d", header: "Cọc", cell: (c) => <DepositBadge value={c.deposit.status} /> },
];

export function CustomerDetail({ customerId }: { customerId: string }) {
  const { data, all, actions, can, staffName } = useCrm();
  const customer = data.customers.find((c) => c.customerId === customerId);
  const [edit, setEdit] = useState<{ contactName: string; phone: string; email: string }>();
  const [saved, setSaved] = useState(false);

  if (!customer) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState title="Không tìm thấy khách hàng" description="Khách không tồn tại hoặc không thuộc phạm vi tuyến của bạn." />
      </div>
    );
  }

  const leads = all.leads.filter((l) => l.customerId === customerId);
  const rfqs = all.rfqs.filter((r) => r.customerId === customerId);
  const contracts = all.contracts.filter((c) => c.customerId === customerId);
  const form = edit ?? { contactName: customer.contactName, phone: customer.phone, email: customer.email };
  const dirty = !!edit;

  return (
    <>
      <Link href="/crm/khach-hang" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Danh sách khách hàng
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-primary">{customer.name}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          <span className="font-mono">{customer.customerId}</span> · {routeLabels[customer.route]} · {customer.country}
        </p>
      </div>

      <DuplicateAlert customers={all.customers} focusId={customerId} />

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="Hồ sơ" className="lg:col-span-1">
          <div className="space-y-3">
            <Field label="Người liên hệ" htmlFor="cd-name">
              <Input id="cd-name" disabled={!can("lead.write")} value={form.contactName} onChange={(e) => { setSaved(false); setEdit({ ...form, contactName: e.target.value }); }} />
            </Field>
            <Field label="Điện thoại" htmlFor="cd-phone">
              <Input id="cd-phone" type="tel" disabled={!can("lead.write")} value={form.phone} onChange={(e) => { setSaved(false); setEdit({ ...form, phone: e.target.value }); }} />
            </Field>
            <Field label="Email" htmlFor="cd-email">
              <Input id="cd-email" type="email" disabled={!can("lead.write")} value={form.email} onChange={(e) => { setSaved(false); setEdit({ ...form, email: e.target.value }); }} />
            </Field>
            <p className="text-sm text-muted-foreground">Phụ trách: {staffName(customer.ownerId)}</p>
            {customer.note && <p className="text-sm text-muted-foreground">Ghi chú: {customer.note}</p>}
            {can("lead.write") && (
              <div className="flex items-center justify-end gap-3">
                {saved && <span role="status" className="text-sm text-success">Đã lưu</span>}
                <Button
                  disabled={!dirty}
                  onClick={() => {
                    if (edit && actions.updateCustomer(customerId, edit).ok) {
                      setEdit(undefined);
                      setSaved(true);
                    }
                  }}
                >
                  <RefreshCw aria-hidden /> Lưu
                </Button>
              </div>
            )}
          </div>
        </SectionCard>

        <div className="space-y-6 lg:col-span-2">
          <SectionCard title={`Lịch sử lead (${leads.length})`} bodyClassName="p-0 pt-3">
            <DataTable columns={leadCols} rows={leads.slice(0, 10)} getRowId={(l) => l.messId} className="rounded-none border-x-0 border-b-0 shadow-none" footer={leads.length > 10 ? `Hiển thị 10/${leads.length} lead gần nhất` : undefined} empty={<EmptyState title="Chưa có lead" className="py-8" />} />
          </SectionCard>
          <SectionCard title={`RFQ (${rfqs.length})`} bodyClassName="p-0 pt-3">
            <DataTable columns={rfqCols} rows={rfqs.slice(0, 10)} getRowId={(r) => r.rfqId} className="rounded-none border-x-0 border-b-0 shadow-none" footer={rfqs.length > 10 ? `Hiển thị 10/${rfqs.length} RFQ gần nhất` : undefined} empty={<EmptyState title="Chưa có RFQ" className="py-8" />} />
          </SectionCard>
          <SectionCard title={`Hợp đồng và đơn hàng (${contracts.length})`} bodyClassName="p-0 pt-3">
            <DataTable columns={contractCols} rows={contracts.slice(0, 10)} getRowId={(c) => c.orderId} className="rounded-none border-x-0 border-b-0 shadow-none" footer={contracts.length > 10 ? `Hiển thị 10/${contracts.length} đơn gần nhất` : undefined} empty={<EmptyState title="Chưa có hợp đồng" className="py-8" />} />
          </SectionCard>
        </div>
      </div>
    </>
  );
}
