"use client";

import { useListTools } from "@/components/shared/list-tools";
import { useState } from "react";
import Link from "next/link";
import { Plus, Search, X } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { countryLabels, supplierCategories, supplierStatusMeta } from "@/config/operations";
import { usePagination } from "@/features/crm/hooks";
import { matchesQuery } from "@/lib/text";
import type { Supplier, SupplierCountry, SupplierStatus } from "@/types/ops";
import { useOps } from "../hooks";
import { Rating, SupplierBadge } from "./ops-badges";

function AddSupplierDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { actions } = useOps();
  const [f, setF] = useState({ name: "", country: "VN" as SupplierCountry, city: "", contactName: "", phone: "", moq: "100 sản phẩm", leadTimeDays: 20 });
  const [cats, setCats] = useState<string[]>([]);
  const [error, setError] = useState<string>();

  const submit = () => {
    if (!f.name.trim() || !f.city.trim()) return setError("Nhập tên và thành phố");
    if (cats.length === 0) return setError("Chọn ít nhất một loại hàng");
    const r = actions.addSupplier({ ...f, name: f.name.trim(), city: f.city.trim(), categories: cats });
    if (r.ok && r.id) onCreated(r.id);
    else if (!r.ok) setError(r.error);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Thêm nhà cung cấp / xưởng</DialogTitle>
          <DialogDescription>Nhà cung cấp mới ở trạng thái “Cần theo dõi” cho tới khi có đánh giá thực tế.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tên xưởng" htmlFor="as-name" required className="sm:col-span-2"><Input id="as-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label="Quốc gia" htmlFor="as-country">
            <NativeSelect id="as-country" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value as SupplierCountry })}>
              <option value="VN">Việt Nam</option>
              <option value="CN">Trung Quốc</option>
            </NativeSelect>
          </Field>
          <Field label="Thành phố" htmlFor="as-city" required><Input id="as-city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
          <Field label="Người liên hệ" htmlFor="as-contact"><Input id="as-contact" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} /></Field>
          <Field label="Điện thoại" htmlFor="as-phone"><Input id="as-phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label="MOQ" htmlFor="as-moq"><Input id="as-moq" value={f.moq} onChange={(e) => setF({ ...f, moq: e.target.value })} /></Field>
          <Field label="Thời gian sản xuất (ngày)" htmlFor="as-lead"><Input id="as-lead" type="number" min={1} value={f.leadTimeDays} onChange={(e) => setF({ ...f, leadTimeDays: Number(e.target.value) })} /></Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Loại hàng <span className="text-danger">*</span></legend>
            <div className="flex flex-wrap gap-2">
              {supplierCategories.map((c) => (
                <label key={c} className="flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs has-[:checked]:border-primary has-[:checked]:bg-accent">
                  <input type="checkbox" className="sr-only" checked={cats.includes(c)} onChange={(e) => setCats(e.target.checked ? [...cats, c] : cats.filter((x) => x !== c))} />
                  {c}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        {error && <InlineAlert>{error}</InlineAlert>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X /> Hủy</Button>
          <Button onClick={submit}>Tạo mới</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SuppliersView() {
  const { ops, can } = useOps();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<SupplierCountry | "">("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<SupplierStatus | "">("");
  const [minRating, setMinRating] = useState(0);

  const filtered = ops.suppliers.filter(
    (s) =>
      (!country || s.country === country) &&
      (!category || s.categories.includes(category)) &&
      (!status || s.status === status) &&
      s.rating >= minRating &&
      matchesQuery(query, s.name, s.city, s.supplierId, s.contactName),
  );
  const listTools = useListTools(filtered, { filename: "speego-suppliers.csv", name: (r) => r.name,  columns: [{ label: "Mã", value: (r) => r.supplierId }, { label: "Tên / nội dung", value: (r) => r.name }, { label: "country", value: (r) => r.country }, { label: "rating", value: (r) => r.rating }, { label: "on_time_rate_mock", value: (r) => r.onTimeRate }, { label: "status", value: (r) => r.status }] });
  const paging = usePagination(listTools.rows, 15, listTools.resetKey);

  const columns: Column<Supplier>[] = [
    {
      key: "name",
      header: "Nhà cung cấp",
      cell: (s) => (
        <div className="min-w-0">
          <Link href={`/van-hanh/nha-cung-cap/${s.supplierId}`} className="font-medium hover:text-primary hover:underline">{s.name}</Link>
          <p className="font-mono text-xs text-muted-foreground">{s.supplierId}</p>
        </div>
      ),
    },
    { key: "place", header: "Quốc gia", cell: (s) => `${countryLabels[s.country]} · ${s.city}` },
    { key: "cats", header: "Loại hàng", cell: (s) => <span className="line-clamp-2 max-w-60 text-xs text-muted-foreground">{s.categories.join(", ")}</span>, className: "hidden lg:table-cell" },
    { key: "rating", header: "Đánh giá", cell: (s) => <Rating value={s.rating} /> },
    { key: "ontime", header: "Đúng hạn", align: "right", cell: (s) => `${s.onTimeRate}%`, className: "hidden md:table-cell" },
    { key: "lead", header: "Sản xuất", align: "right", cell: (s) => `${s.leadTimeDays} ngày`, className: "hidden xl:table-cell" },
    { key: "status", header: "Trạng thái", cell: (s) => <SupplierBadge value={s.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Nhà cung cấp / xưởng"
        description="Hồ sơ xưởng Việt Nam và Trung Quốc, loại hàng và đánh giá. Điểm đánh giá và tỷ lệ đúng hạn là dữ liệu demo."
        actions={can() && <Button size="lg" onClick={() => setAdding(true)}><Plus /> Thêm nhà cung cấp</Button>}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4 shadow-xs">
        <div className="relative min-w-60 flex-1">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Tìm nhà cung cấp" placeholder="Tìm tên, thành phố, mã, người liên hệ…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
        </div>
        <NativeSelect aria-label="Lọc quốc gia" className="w-40" value={country} onChange={(e) => setCountry(e.target.value as SupplierCountry | "")}>
          <option value="">Mọi quốc gia</option>
          <option value="VN">Việt Nam</option>
          <option value="CN">Trung Quốc</option>
        </NativeSelect>
        <NativeSelect aria-label="Lọc loại hàng" className="w-48" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Mọi loại hàng</option>
          {supplierCategories.map((c) => <option key={c} value={c}>{c}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Lọc trạng thái" className="w-44" value={status} onChange={(e) => setStatus(e.target.value as SupplierStatus | "")}>
          <option value="">Mọi trạng thái</option>
          {(Object.keys(supplierStatusMeta) as SupplierStatus[]).map((s) => <option key={s} value={s}>{supplierStatusMeta[s].label}</option>)}
        </NativeSelect>
        <NativeSelect aria-label="Đánh giá tối thiểu" className="w-40" value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
          <option value={0}>Mọi đánh giá</option>
          <option value={3.5}>Từ 3,5 sao</option>
          <option value={4}>Từ 4 sao</option>
          <option value={4.5}>Từ 4,5 sao</option>
        </NativeSelect>
      </div>
      {listTools.toolbar}
      <div className="space-y-4">
        <DataTable columns={columns} rows={paging.slice} getRowId={(s) => s.supplierId} empty={<EmptyState title="Không có nhà cung cấp phù hợp" />} />
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
      {adding && <AddSupplierDialog onClose={() => setAdding(false)} onCreated={() => setAdding(false)} />}
    </>
  );
}
