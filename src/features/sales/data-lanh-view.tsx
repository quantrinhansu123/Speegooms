"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Search, Shuffle, Trash2 } from "lucide-react";
import { customerClasses, facebookStatuses, hasActiveTelesale, telesaleStatuses, type DataLanhRecord } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/session-provider";
import { FOCUS_ROW_CLASS, useFocusRow } from "@/features/notifications/use-focus-row";
import { usePagination } from "@/features/crm/hooks";
import { FilterSelect } from "@/features/crm/live/list-search-bar";
import { TableHScroll } from "@/features/crm/live/table-h-scroll";
import { ApiError, api } from "@/lib/api";
import { matchesDataLanhStatus, type StatusChannel } from "./data-lanh-filters";

const UNASSIGNED = "__none";
const PAGE_SIZE = 50;
// Phải là hằng cố định: useFocusRow đăng ký lại mỗi khi tham số đổi, hàm/obj tạo mới mỗi lần render gây vòng lặp.
const noop = () => undefined;
const FOCUS_OPTIONS = { refTypes: ["data-lanh"] };

const editFields = ["fullName", "company", "phone", "facebookLink", "market", "segment", "address", "interest", "customerClass", "history", "note"] as const;
type EditField = (typeof editFields)[number];
/** id = null là đang thêm khách mới. */
type EditDraft = { id: string | null; name: string } & Record<EditField, string>;

/** Data khách hàng: khách cũ chia vòng tròn cho từng người; mỗi người chỉ thấy khách của mình, Admin và Ban GĐ thấy tất cả. */
export function DataLanhView() {
  const user = useSession();
  const canAssign = user.role === "admin";
  const canDelete = user.role === "admin";
  const canWork = user.role !== "ban-gd";
  const seesAll = user.role === "admin" || user.role === "ban-gd";
  const [rows, setRows] = useState<DataLanhRecord[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [assigning, setAssigning] = useState(false);
  const [sales, setSales] = useState<{ id: string; name: string }[]>([]);
  const [removing, setRemoving] = useState<DataLanhRecord | null>(null);
  const [editing, setEditing] = useState<EditDraft | null>(null);
  const [editError, setEditError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [transfer, setTransfer] = useState<{ row: DataLanhRecord; status: string } | null>(null);
  const [filters, setFilters] = useState({ q: "", intern: "", channel: "" as StatusChannel, status: "" });
  const statusOptions = (filters.channel === "facebook" ? facebookStatuses : telesaleStatuses).slice(1);

  const load = useCallback(() => {
    api<{ rows: DataLanhRecord[] }>("/api/data-lanh")
      .then((body) => setRows(body.rows))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được data khách hàng"));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    if (!canWork) return;
    api<{ sales: { id: string; name: string }[] }>("/api/data-lanh/sales").then((body) => setSales(body.sales)).catch(() => undefined);
  }, [canWork]);

  const interns = useMemo(() => [...new Map(rows.filter((r) => r.internId).map((r) => [r.internId!, r.internName ?? r.internId!])).entries()], [rows]);
  const unassigned = rows.filter((r) => !r.internId).length;

  const statusRows = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && ![r.fullName, r.company, r.phone, r.facebookLink, r.market, r.saleCareName].some((v) => v?.toLowerCase().includes(q))) return false;
      if (filters.intern === UNASSIGNED ? r.internId : filters.intern && r.internId !== filters.intern) return false;
      return matchesDataLanhStatus(r, filters.channel, "");
    });
  }, [rows, filters.q, filters.intern, filters.channel]);
  const shown = useMemo(() => statusRows.filter((r) => matchesDataLanhStatus(r, filters.channel, filters.status)), [statusRows, filters.channel, filters.status]);

  // Đổi bộ lọc thì về trang 1.
  const paging = usePagination(shown, PAGE_SIZE, JSON.stringify(filters));

  // Bấm thông báo trên chuông: tô vàng khách được bàn giao và nhảy tới đúng trang.
  const highlightId = useFocusRow(rows, "vn", false, noop, FOCUS_OPTIONS);
  const setPage = paging.setPage;
  useEffect(() => {
    if (!highlightId) return;
    const index = shown.findIndex((r) => r.id === highlightId);
    if (index >= 0) setPage(Math.floor(index / PAGE_SIZE) + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ nhảy trang khi có dòng mới cần tô
  }, [highlightId]);

  const handover = (row: DataLanhRecord, saleId: string) => {
    if (!saleId) return;
    setError(undefined);
    api<{ row: DataLanhRecord }>(`/api/data-lanh/${row.id}/handover`, { method: "POST", body: JSON.stringify({ saleId }) })
      .then((res) => {
        setRows((current) => current.map((r) => (r.id === res.row.id ? res.row : r)));
        setNotice(`Đã bàn giao ${res.row.fullName ?? `STT ${res.row.stt}`} cho ${res.row.saleCareName}. Thông báo đã gửi lên chuông của Sale.`);
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không bàn giao được"));
  };

  const assign = () => {
    setAssigning(true);
    setError(undefined);
    api<{ assigned: number; interns: number }>("/api/data-lanh/assign", { method: "POST", body: JSON.stringify({}) })
      .then((res) => {
        setNotice(res.assigned ? `Đã chia ${res.assigned} khách vòng tròn cho ${res.interns} người` : "Không còn khách nào chưa giao");
        load();
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không chia được data"))
      .finally(() => setAssigning(false));
  };

  const setStatus = async (row: DataLanhRecord, patch: { facebookStatus?: string | null; telesaleStatus?: string | null }) => {
    setError(undefined);
    setStatusSaving(true);
    try {
      const res = await api<{ row: DataLanhRecord }>(`/api/data-lanh/${row.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setRows((current) => current.map((r) => (r.id === row.id ? res.row : r)));
      if (patch.facebookStatus === facebookStatuses[6]) setNotice(`Đã chuyển ${row.fullName ?? `STT ${row.stt}`} sang Telesale.`);
      return true;
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Không lưu được trạng thái");
      return false;
    } finally {
      setStatusSaving(false);
    }
  };

  const openEdit = (row: DataLanhRecord) => {
    setEditError(undefined);
    setEditing({ id: row.id, name: row.fullName ?? `STT ${row.stt}`, ...Object.fromEntries(editFields.map((key) => [key, row[key] ?? ""])) } as EditDraft);
  };

  const openCreate = () => {
    setEditError(undefined);
    setEditing({ id: null, name: "", ...Object.fromEntries(editFields.map((key) => [key, ""])) } as EditDraft);
  };

  const saveEdit = () => {
    if (!editing) return;
    setSaving(true);
    setEditError(undefined);
    const creating = editing.id === null;
    api<{ row: DataLanhRecord }>(creating ? "/api/data-lanh" : `/api/data-lanh/${editing.id}`, {
      method: creating ? "POST" : "PATCH",
      // Ô trống gửi null (xóa trường); riêng Phân loại là danh sách chọn nên "" không hợp lệ.
      body: JSON.stringify(Object.fromEntries(editFields.map((key) => [key, editing[key] || null]))),
    })
      .then((res) => {
        setEditing(null);
        if (creating) {
          setNotice(`Đã thêm khách STT ${res.row.stt}. Khách chưa giao, bấm "Chia vòng tròn" để giao cho người phụ trách.`);
          load();
        } else {
          setRows((current) => current.map((r) => (r.id === res.row.id ? res.row : r)));
        }
      })
      .catch((err: unknown) => setEditError(err instanceof ApiError ? err.message : "Không lưu được thông tin"))
      .finally(() => setSaving(false));
  };

  const remove = () => {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    api(`/api/data-lanh/${id}`, { method: "DELETE" })
      .then(() => setRows((current) => current.filter((r) => r.id !== id)))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không xóa được khách"));
  };

  const statusSelect = (row: DataLanhRecord, kind: "facebook" | "telesale") => {
    const list = kind === "facebook" ? facebookStatuses : telesaleStatuses;
    const value = (kind === "facebook" ? row.facebookStatus : row.telesaleStatus) ?? "";
    return (
      <NativeSelect
        aria-label={`${kind === "facebook" ? "Trạng thái chăm Facebook" : "Trạng thái Telesale"} · ${row.fullName ?? row.stt}`}
        value={value}
        disabled={!canWork || !row.internId || statusSaving}
        onChange={(event) => {
          const next = event.target.value || null;
          if (kind === "facebook" && next === facebookStatuses[6] && !hasActiveTelesale(row.telesaleStatus)) {
            setError(undefined);
            setTransfer({ row, status: "" });
            return;
          }
          setStatus(row, kind === "facebook" ? { facebookStatus: next } : { telesaleStatus: next });
        }}
      >
        <option value="" disabled={kind === "telesale" && row.facebookStatus === facebookStatuses[6] && hasActiveTelesale(row.telesaleStatus)}>Chưa cập nhật</option>
        {list.map((item) => <option key={item} value={item} disabled={kind === "telesale" && row.facebookStatus === facebookStatuses[6] && hasActiveTelesale(row.telesaleStatus) && item === telesaleStatuses[0]}>{item}</option>)}
      </NativeSelect>
    );
  };

  return (
    <>
      <PageHeader
        title="Data khách hàng"
        description={seesAll ? "Khách cũ chia vòng tròn cho từng người. Mỗi người cập nhật trạng thái chăm Facebook và Telesale cho khách của mình." : "Khách cũ được giao hoặc bàn giao cho bạn. Cập nhật trạng thái chăm Facebook và Telesale sau khi liên hệ."}
        actions={canAssign && (
          <>
            <Button variant="outline" onClick={openCreate}><Plus /> Thêm khách</Button>
            <Button onClick={assign} disabled={assigning || unassigned === 0} title={unassigned === 0 ? "Không còn khách chưa giao" : undefined}>
              <Shuffle /> Chia vòng tròn{unassigned > 0 ? ` (${unassigned})` : ""}
            </Button>
          </>
        )}
      />
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
      <div className="mb-4 flex flex-wrap items-end gap-x-3 gap-y-4">
        <div className="w-full shrink-0 sm:w-64">
          <label htmlFor="dl-q" className="mb-1.5 block text-sm font-medium">Tìm kiếm</label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input id="dl-q" className="pl-9" value={filters.q} placeholder="Tên, tiệm, SĐT, Facebook…" onChange={(event) => setFilters({ ...filters, q: event.target.value })} />
          </div>
        </div>
        {seesAll && (
          <div className="w-fit max-w-full [&_select]:block [&_select]:w-auto [&_select]:max-w-full">
            <FilterSelect id="dl-intern" label="Phụ trách" value={filters.intern} onChange={(intern) => setFilters({ ...filters, intern })} options={[[UNASSIGNED, "Chưa giao"], ...interns]} />
          </div>
        )}
        <div className="w-fit max-w-full">
          <Field label="Trạng thái" htmlFor="dl-channel">
            <NativeSelect id="dl-channel" className="block w-auto max-w-full" value={filters.channel} onChange={(event) => setFilters({ ...filters, channel: event.target.value as StatusChannel, status: "" })}>
              <option value="">Tất cả</option>
              <option value="facebook">Trạng thái Facebook</option>
              <option value="telesale">Trạng thái Telesale</option>
            </NativeSelect>
          </Field>
        </div>
      </div>
      {filters.channel && (
        <div role="group" aria-label={filters.channel === "facebook" ? "Lọc trạng thái Facebook" : "Lọc trạng thái Telesale"} className="mb-4 flex gap-2 overflow-x-auto pb-2">
          {["", ...statusOptions].map((status) => (
            <Button key={status} type="button" variant={filters.status === status ? "default" : "outline"} aria-pressed={filters.status === status} onClick={() => setFilters({ ...filters, status })}>
              {status || "Tất cả"} ({statusRows.filter((r) => matchesDataLanhStatus(r, filters.channel, status)).length})
            </Button>
          ))}
        </div>
      )}
      <p className="mb-2 text-sm text-muted-foreground">
        {shown.length}/{rows.length} khách
        {seesAll && ` · Chưa giao: ${unassigned}`}
        {seesAll && interns.map(([id, name]) => ` · ${name}: ${rows.filter((r) => r.internId === id).length}`).join("")}
      </p>
      <TableHScroll>
        <table className="w-full min-w-[2150px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              {["STT", "Khách hàng", "Tiệm / Công ty", "SĐT", "Facebook", "Thị trường", "Mảng KD", "Phân loại", "Lịch sử CSKH", "Phụ trách", "Trạng thái chăm Facebook", "Trạng thái Telesale", "Bàn giao Sale care", "Thao tác"].map((head) => (
                <th key={head} className="whitespace-nowrap px-3 py-2 font-medium">{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={14} className="px-3 py-8 text-center text-muted-foreground">{rows.length ? "Không có kết quả." : "Chưa có data khách hàng."}</td></tr>}
            {paging.slice.map((row) => {
              const history = [row.history, row.note].filter(Boolean).join(" · ");
              return (
                <tr key={row.id} data-row-id={row.id} className={`border-b align-top last:border-0${highlightId === row.id ? ` ${FOCUS_ROW_CLASS}` : ""}`}>
                  <td className="px-3 py-3 whitespace-nowrap">{row.stt}</td>
                  <td className="px-3 py-3 font-medium">{row.fullName || "—"}</td>
                  <td className="px-3 py-3">{row.company || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.phone || "—"}</td>
                  <td className="max-w-48 truncate px-3 py-3" title={row.facebookLink ?? undefined}>
                    {row.facebookLink ? (/^https?:\/\//i.test(row.facebookLink) ? <a href={row.facebookLink} target="_blank" rel="noreferrer" className="text-primary hover:underline">{row.facebookLink}</a> : row.facebookLink) : "—"}
                  </td>
                  <td className="px-3 py-3">{row.market || "—"}</td>
                  <td className="max-w-44 truncate px-3 py-3" title={row.segment ?? undefined}>{row.segment || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.customerClass || "—"}</td>
                  <td className="max-w-64 truncate px-3 py-3" title={history || undefined}>{history || "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{row.internName ?? <span className="text-muted-foreground">Chưa giao</span>}</td>
                  <td className="min-w-64 px-3 py-2">{statusSelect(row, "facebook")}</td>
                  <td className="min-w-64 px-3 py-2">{statusSelect(row, "telesale")}</td>
                  <td className="min-w-48 px-3 py-2">
                    <NativeSelect
                      aria-label={`Bàn giao Sale care · ${row.fullName ?? row.stt}`}
                      value={row.saleCareId ?? ""}
                      disabled={!canWork}
                      onChange={(event) => handover(row, event.target.value)}
                    >
                      <option value="" disabled>Chưa bàn giao</option>
                      {sales.map((sale) => <option key={sale.id} value={sale.id}>{sale.name}</option>)}
                    </NativeSelect>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {canWork && (
                        <Button variant="outline" size="icon-lg" aria-label={`Sửa thông tin · ${row.fullName ?? row.stt}`} title="Sửa thông tin khách" onClick={() => openEdit(row)}>
                          <Pencil />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="outline" size="icon-lg" aria-label={`Xóa · ${row.fullName ?? row.stt}`} title="Xóa khách" onClick={() => setRemoving(row)}>
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableHScroll>
      <Dialog open={transfer !== null} onOpenChange={(open) => { if (!open && !statusSaving) setTransfer(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chuyển khách sang Telesale</DialogTitle>
            <DialogDescription>Chọn kết quả gọi cho {transfer?.row.fullName ?? `STT ${transfer?.row.stt}`}. Sau khi lưu, khách sẽ rời nhóm Facebook và hiện trong nhóm Telesale.</DialogDescription>
          </DialogHeader>
          {error && <InlineAlert>{error}</InlineAlert>}
          <Field label="Kết quả gọi" htmlFor="dl-transfer-status">
            <NativeSelect id="dl-transfer-status" value={transfer?.status ?? ""} disabled={statusSaving} onChange={(event) => setTransfer((current) => current ? { ...current, status: event.target.value } : null)}>
              <option value="">Chọn kết quả gọi</option>
              {telesaleStatuses.slice(1).map((status) => <option key={status} value={status}>{status}</option>)}
            </NativeSelect>
          </Field>
          <DialogFooter>
            <Button variant="outline" disabled={statusSaving} onClick={() => setTransfer(null)}>Hủy</Button>
            <Button disabled={statusSaving || !hasActiveTelesale(transfer?.status)} onClick={async () => {
              if (transfer && hasActiveTelesale(transfer.status) && await setStatus(transfer.row, { facebookStatus: facebookStatuses[6], telesaleStatus: transfer.status })) setTransfer(null);
            }}>{statusSaving ? "Đang chuyển…" : "Chuyển sang Telesale"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing?.id === null ? "Thêm khách" : `Sửa thông tin · ${editing?.name}`}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid max-h-[min(70vh,720px)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
              {editError && <InlineAlert className="sm:col-span-2">{editError}</InlineAlert>}
              <Field label="Họ và tên khách" htmlFor="dl-edit-fullName">
                <Input id="dl-edit-fullName" value={editing.fullName} onChange={(event) => setEditing({ ...editing, fullName: event.target.value })} />
              </Field>
              <Field label="Tên tiệm / Công ty" htmlFor="dl-edit-company">
                <Input id="dl-edit-company" value={editing.company} onChange={(event) => setEditing({ ...editing, company: event.target.value })} />
              </Field>
              <Field label="Số điện thoại" htmlFor="dl-edit-phone">
                <Input id="dl-edit-phone" value={editing.phone} onChange={(event) => setEditing({ ...editing, phone: event.target.value })} />
              </Field>
              <Field label="Link Facebook" htmlFor="dl-edit-facebookLink" hint="Dán link trang Facebook của khách">
                <Input id="dl-edit-facebookLink" value={editing.facebookLink} onChange={(event) => setEditing({ ...editing, facebookLink: event.target.value })} />
              </Field>
              <Field label="Thị trường" htmlFor="dl-edit-market">
                <Input id="dl-edit-market" value={editing.market} onChange={(event) => setEditing({ ...editing, market: event.target.value })} />
              </Field>
              <Field label="Phân loại khách" htmlFor="dl-edit-customerClass">
                <NativeSelect id="dl-edit-customerClass" value={editing.customerClass} onChange={(event) => setEditing({ ...editing, customerClass: event.target.value })}>
                  <option value="">Chưa chọn</option>
                  {customerClasses.map((item) => <option key={item} value={item}>{item}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Mảng kinh doanh" htmlFor="dl-edit-segment" className="sm:col-span-2">
                <Input id="dl-edit-segment" value={editing.segment} onChange={(event) => setEditing({ ...editing, segment: event.target.value })} />
              </Field>
              <Field label="Địa chỉ" htmlFor="dl-edit-address" className="sm:col-span-2">
                <Input id="dl-edit-address" value={editing.address} onChange={(event) => setEditing({ ...editing, address: event.target.value })} />
              </Field>
              <Field label="Mặt hàng quan tâm" htmlFor="dl-edit-interest" className="sm:col-span-2">
                <Input id="dl-edit-interest" value={editing.interest} onChange={(event) => setEditing({ ...editing, interest: event.target.value })} />
              </Field>
              <Field label="Lịch sử CSKH" htmlFor="dl-edit-history" className="sm:col-span-2">
                <Textarea id="dl-edit-history" rows={4} value={editing.history} onChange={(event) => setEditing({ ...editing, history: event.target.value })} />
              </Field>
              <Field label="Ghi chú" htmlFor="dl-edit-note" className="sm:col-span-2">
                <Textarea id="dl-edit-note" rows={3} value={editing.note} onChange={(event) => setEditing({ ...editing, note: event.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
            <Button onClick={saveEdit} disabled={saving}>Lưu</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        destructive
        title="Xóa khách?"
        description={removing ? `${removing.fullName ?? `STT ${removing.stt}`}${removing.company ? ` · ${removing.company}` : ""} sẽ bị xóa khỏi data khách hàng và không khôi phục được. Nếu chỉ là khách sai số, hãy chọn trạng thái "Sai tệp" thay vì xóa.` : ""}
        confirmLabel="Xóa"
        onConfirm={remove}
      />

      <div className="mt-4">
        <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
      </div>
    </>
  );
}
