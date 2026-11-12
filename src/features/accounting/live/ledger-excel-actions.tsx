"use client";

import { useRef, useState } from "react";
import { Download, FileDown, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InlineAlert } from "@/components/shared/form-fields";
import { api, ApiError } from "@/lib/api";
import { downloadBlob } from "@/lib/download";
import { buildLedgerWorkbook, readLedgerWorkbook, unchangedLedgerRow, type ExcelLedgerEntry, type LedgerImportRow } from "./ledger-excel";

export function LedgerExcelActions({ rows, canWrite, loading, onDone }: {
  rows: ExcelLedgerEntry[]; canWrite: boolean; loading: boolean; onDone: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<LedgerImportRow[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string>();
  const [progress, setProgress] = useState("");
  const download = async (template: boolean) => {
    setBusy(true); setMessage(undefined);
    try {
      const workbook = await buildLedgerWorkbook(template ? [] : rows);
      const buffer = await workbook.xlsx.writeBuffer();
      downloadBlob(template ? "mau-thu-chi.xlsx" : "thu-chi.xlsx", new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }));
    } catch { setMessage("Không tạo được file Excel. Vui lòng thử lại."); }
    finally { setBusy(false); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true); setMessage(undefined); setErrors([]); setProgress("");
    try {
      if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Chọn file Excel .xlsx.");
      if (file.size > 10 * 1024 * 1024) throw new Error("File tối đa 10 MB.");
      const result = await readLedgerWorkbook(await file.arrayBuffer());
      setPending(result.rows); setErrors(result.errors); setFileErrors(result.errors);
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Không đọc được file Excel."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  };
  const save = async () => {
    if (!pending?.length) return;
    setBusy(true); setProgress("");
    let created = 0, updated = 0, skipped = 0;
    const remaining: LedgerImportRow[] = [];
    const failures: string[] = [];
    try {
      const current = await api<{ entries: ExcelLedgerEntry[] }>("/api/ke-toan/ledger");
      const accounts = await api<{ accounts: string[] }>("/api/ke-toan/receiving-accounts");
      const accountNames = new Set(accounts.accounts);
      const byId = new Map(current.entries.map((entry) => [entry.id, entry]));
      for (const [index, item] of pending.entries()) {
        setProgress(`Đang nhập ${index + 1}/${pending.length}…`);
        try {
          const existing = byId.get(item.id);
          if (existing && unchangedLedgerRow(item.input, existing)) { skipped++; continue; }
          if (item.id && !existing) throw new Error("Không tìm thấy khoản thu chi cần cập nhật");
          if (existing?.reconciled) throw new Error("Dòng đã đối soát, không thể sửa");
          if (item.input.receivingAccount && !accountNames.has(item.input.receivingAccount)) {
            await api("/api/ke-toan/receiving-accounts", { method: "POST", body: JSON.stringify({ name: item.input.receivingAccount }) });
            accountNames.add(item.input.receivingAccount);
          }
          await api(`/api/ke-toan/ledger${item.id ? `/${item.id}` : ""}`, {
            method: item.id ? "PATCH" : "POST", body: JSON.stringify(item.input),
          });
          if (item.id) updated++; else created++;
        } catch (cause) {
          remaining.push(item);
          failures.push(`Dòng ${item.row}: ${cause instanceof Error ? cause.message : "Không lưu được"}`);
          if (!(cause instanceof ApiError) || cause.status === 401 || cause.status === 403 || cause.status >= 500) {
            remaining.push(...pending.slice(index + 1));
            failures.push("Đã dừng nhập. Nếu kết nối bị gián đoạn, kiểm tra sổ thu chi trước khi thử lại để tránh thêm trùng.");
            break;
          }
        }
      }
      setPending(remaining);
      setErrors([...fileErrors, ...failures]);
      setProgress(`Đã thêm ${created}, cập nhật ${updated}, giữ nguyên ${skipped}. Còn ${remaining.length} dòng chưa xác nhận lưu.`);
    } catch (cause) { setErrors([cause instanceof Error ? cause.message : "Không tải được dữ liệu hiện tại."]); }
    finally { setBusy(false); onDone(); }
  };
  return <>
    <Button variant="outline" title="Tải toàn bộ thu chi khớp bộ lọc hiện tại" disabled={busy || loading || !rows.length} onClick={() => void download(false)}>
      <Download aria-hidden /> Xuất Excel ({rows.length})
    </Button>
    {canWrite && <>
      <Button variant="outline" disabled={busy} onClick={() => void download(true)}><FileDown aria-hidden /> Tải mẫu Excel</Button>
      <Button variant="outline" disabled={busy || loading} onClick={() => input.current?.click()}><FileUp aria-hidden /> Import Excel</Button>
      <input ref={input} type="file" className="hidden" accept=".xlsx" aria-label="Chọn file Excel thu chi"
        onChange={(event) => void upload(event.target.files?.[0])} />
    </>}
    {message && <p role="alert" className="w-full text-sm text-destructive">{message}</p>}
    <Dialog open={pending !== null} onOpenChange={(open) => { if (!open && !busy) setPending(null); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle>Import thu chi từ Excel</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{pending?.length ?? 0} dòng hợp lệ đang chờ nhập. Mã dòng trống sẽ thêm mới; có mã sẽ cập nhật khoản cũ.
          Dòng đã đối soát chỉ được giữ nguyên. Thành tiền VND và trạng thái đối soát được hệ thống quản lý.</p>
        <p className="text-sm text-muted-foreground">Ngày và Ngày giao dịch nhập riêng. Tài khoản nhận chưa có sẽ được thêm vào danh sách dùng chung khi nhập.</p>
        {!!pending?.length && <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b text-left">{["Dòng", "Thao tác", "Ngày", "Ngày giao dịch", "Tài khoản nhận", "Loại", "Đối tượng", "Đơn hàng", "Số tiền", "Tiền tệ", "Tỷ giá"].map((title) => <th key={title} className="p-2 whitespace-nowrap">{title}</th>)}</tr></thead>
          <tbody>{pending.slice(0, 10).map((item) => <tr key={item.row} className="border-b">
            <td className="p-2">{item.row}</td><td className="p-2">{item.id ? "Cập nhật" : "Thêm mới"}</td>
            <td className="p-2 whitespace-nowrap">{item.input.date}</td><td className="p-2 whitespace-nowrap">{item.input.transactionDate ?? "—"}</td><td className="p-2">{item.input.receivingAccount ?? "—"}</td><td className="p-2">{item.input.kind === "THU" ? "Thu" : "Chi"}</td><td className="p-2">{item.input.counterparty}</td><td className="p-2">{item.input.orderCode || "—"}</td>
            <td className="p-2">{item.input.amount.toLocaleString("vi-VN")}</td><td className="p-2">{item.input.currency}</td><td className="p-2">{(item.input.exchangeRate ?? 1).toLocaleString("vi-VN")}</td>
          </tr>)}</tbody>
        </table>{pending.length > 10 && <p className="mt-2 text-xs text-muted-foreground">Hiển thị 10/{pending.length} dòng.</p>}</div>}
        {!!errors.length && <InlineAlert tone="warning"><div className="max-h-40 overflow-y-auto">
          {errors.map((error, index) => <p key={index}>{error}</p>)}
          <p>Chỉ sửa và tải lại những dòng lỗi; nhập lại dòng mới đã lưu sẽ tạo bản ghi trùng.</p>
        </div></InlineAlert>}
        {progress && <p role="status" className="text-sm">{progress}</p>}
        <DialogFooter className="mt-0">
          <Button variant="outline" disabled={busy} onClick={() => setPending(null)}>Đóng</Button>
          <Button disabled={busy || !pending?.length} onClick={() => void save()}>{busy ? "Đang nhập…" : `Nhập ${pending?.length ?? 0} dòng hợp lệ`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
