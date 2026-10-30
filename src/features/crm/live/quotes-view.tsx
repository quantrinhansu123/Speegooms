"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Pencil, Trash2 } from "lucide-react";
import { quoteTemplateSchema, type QuoteDesk, type UpdateQuoteInput } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/session-provider";
import { FOCUS_ROW_CLASS, useFocusRow } from "@/features/notifications/use-focus-row";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/role";
import { QuoteEditor } from "./quote-editor";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { downloadQuoteRecordPdf } from "./quote-print";
import { RowMenu } from "./row-menu";
import { ContractStatusBadge, CustomerKindBadge, QuoteStatusBadge } from "./status-badges";
import {
  contractStatusOptions,
  customerKindOptions,
  quoteStatusOptions,
  type QuoteRecord,
  type QuoteTemplateRecord,
} from "./types";

const deskOpsRoles: Record<QuoteDesk, Role[]> = {
  sourcing: ["admin", "van-hanh", "sourcing"],
  logistics: ["admin", "van-hanh", "logistics"],
};

const titles: Record<QuoteDesk, string> = {
  sourcing: "Sourcing – Báo giá",
  logistics: "Logistics – Báo giá",
};

function canOpsOnDesk(role: Role, desk: QuoteDesk): boolean {
  return deskOpsRoles[desk].includes(role);
}

function shownDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

export function QuoteDeskView({ desk }: { desk: QuoteDesk }) {
  const user = useSession();
  const router = useRouter();
  const { lane, canPick, setLane } = useCrmLane();
  const canOps = canOpsOnDesk(user.role, desk);
  /** Logistics xem bàn Sourcing (khách thuần sourcing) chỉ đọc; Sale sửa nội dung ở màn RFQ. */
  const editMode = canOps ? ("full" as const) : ("none" as const);
  const [rows, setRows] = useState<QuoteRecord[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplateRecord[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<{ id: string | null; name: string; content: string } | null>(null);
  const [templateError, setTemplateError] = useState<string>();
  const [removingTemplate, setRemovingTemplate] = useState<QuoteTemplateRecord | null>(null);
  const [editing, setEditing] = useState<QuoteRecord | null>(null);
  const [quoteError, setQuoteError] = useState<string>();
  const filters = useAppliedSearch({ q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "" });
  const highlightId = useFocusRow(rows, lane, canPick, setLane, { refTypes: ["quote"] });

  const loadQuotes = useCallback(() => {
    const rangeError = dateRangeError(filters.applied.from, filters.applied.to);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    setError(undefined);
    const query = searchParams(filters.applied, {
      quoteStatus: filters.applied.quoteStatus,
      contractStatus: filters.applied.contractStatus,
      customerKind: filters.applied.customerKind,
    });
    api<{ quotes: QuoteRecord[] }>(`${crmPath(`/api/crm/quotes?desk=${desk}`, lane)}${query}`)
      .then((body) => setRows(body.quotes))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được báo giá"));
  }, [desk, filters.applied, lane]);

  const loadTemplates = useCallback(() => {
    if (!canOps) return;
    api<{ templates: QuoteTemplateRecord[] }>(`/api/crm/quote-templates?desk=${desk}`)
      .then((body) => setTemplates(body.templates))
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được mẫu báo giá"));
  }, [canOps, desk]);

  useEffect(() => {
    loadQuotes();
    loadTemplates();
  }, [loadQuotes, loadTemplates]);

  const saveQuote = (input: UpdateQuoteInput, options?: { close?: boolean }) => {
    if (!editing) return Promise.resolve(false);
    setPending(true);
    setQuoteError(undefined);
    return api(crmPath(`/api/crm/quotes/${editing.id}?desk=${desk}`, lane), { method: "PATCH", body: JSON.stringify(input) })
      .then(() => {
        if (options?.close !== false) setEditing(null);
        loadQuotes();
        return true;
      })
      .catch((err: unknown) => {
        setQuoteError(err instanceof ApiError ? err.message : "Không lưu được báo giá");
        return false;
      })
      .finally(() => setPending(false));
  };

  const sendQuote = (input: UpdateQuoteInput) => {
    if (!editing) return Promise.resolve(null);
    setPending(true);
    setQuoteError(undefined);
    return api<{ quote: QuoteRecord }>(crmPath(`/api/crm/quotes/${editing.id}/send?desk=${desk}`, lane), { method: "POST", body: JSON.stringify(input) })
      .then((body) => {
        setEditing(body.quote);
        setNotice(`Đã gửi báo giá ${body.quote.code} cho Sale`);
        loadQuotes();
        return body.quote.quoteStatus;
      })
      .catch((err: unknown) => {
        setQuoteError(err instanceof ApiError ? err.message : "Không gửi được báo giá");
        return null;
      })
      .finally(() => setPending(false));
  };

  const saveTemplate = () => {
    if (!templateDraft) return;
    const parsed = quoteTemplateSchema.safeParse({ name: templateDraft.name, content: templateDraft.content });
    if (!parsed.success) {
      setTemplateError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setPending(true);
    const path = templateDraft.id
      ? `/api/crm/quote-templates/${templateDraft.id}?desk=${desk}`
      : `/api/crm/quote-templates?desk=${desk}`;
    void api(path, { method: templateDraft.id ? "PATCH" : "POST", body: JSON.stringify(parsed.data) })
      .then(() => {
        setTemplateDraft(null);
        loadTemplates();
        loadQuotes();
      })
      .catch((err: unknown) => setTemplateError(err instanceof ApiError ? err.message : "Không lưu được mẫu"))
      .finally(() => setPending(false));
  };

  const removeTemplate = () => {
    if (!removingTemplate) return;
    const id = removingTemplate.id;
    setRemovingTemplate(null);
    void api(`/api/crm/quote-templates/${id}?desk=${desk}`, { method: "DELETE" })
      .then(() => loadTemplates())
      .catch((err: unknown) => setTemplateError(err instanceof ApiError ? err.message : "Không xóa được mẫu"));
  };

  const columnCount = desk === "sourcing" ? 11 : 10;

  return (
    <>
      <PageHeader
        title={titles[desk]}
        description={
          desk === "sourcing"
            ? "Sale điền ảnh/quy cách; mua hàng bổ sung chi tiết xưởng; vận hành báo giá. Sau khi gửi đơn hàng → chuyển Logistics."
            : lane === "vn"
              ? "Báo giá vận chuyển tuyến Việt Nam."
              : "Báo giá vận chuyển tuyến Global."
        }
        actions={
          <>
            {canPick ? <LaneSwitch lane={lane} onChange={setLane} /> : null}
            {canOps ? <Button type="button" onClick={() => { setTemplatesOpen(true); setTemplateError(undefined); }}>Mẫu báo giá</Button> : null}
          </>
        }
      />
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
      {rows.some((row) => row.quoteStatus === "CHUA_CO_BAO_GIA_LAI") && (
        <InlineAlert className="mb-4">
          Sale đã gửi lại báo giá {rows.filter((row) => row.quoteStatus === "CHUA_CO_BAO_GIA_LAI").map((row) => row.code).join(", ")}. Hãy tạo mẫu mới rồi bấm Gửi báo giá.
        </InlineAlert>
      )}
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      <ListSearchBar
        q={filters.draft.q}
        from={filters.draft.from}
        to={filters.draft.to}
        onQ={(value) => filters.set("q", value)}
        onFrom={(value) => filters.set("from", value)}
        onTo={(value) => filters.set("to", value)}
        onSearch={filters.search}
        onReset={filters.reset}
        dateLabel="Từ ngày"
      >
        <FilterSelect id={`${desk}-quote-status`} label="Trạng thái báo giá" value={filters.draft.quoteStatus} onChange={(value) => filters.set("quoteStatus", value)} options={quoteStatusOptions} />
        <FilterSelect id={`${desk}-quote-contract`} label="Hợp đồng" value={filters.draft.contractStatus} onChange={(value) => filters.set("contractStatus", value)} options={contractStatusOptions} />
        <FilterSelect id={`${desk}-quote-kind`} label="Loại khách" value={filters.draft.customerKind} onChange={(value) => filters.set("customerKind", value)} options={customerKindOptions} />
      </ListSearchBar>
      <div className="overflow-x-auto rounded-xl border bg-card [&_th]:whitespace-nowrap">
        <table className="w-full min-w-[1100px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mã</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Loại khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hàng hóa</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mẫu báo giá</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ghi chú VH</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Trạng thái báo giá</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hợp đồng</th>
              {desk === "sourcing" && <th className="whitespace-nowrap px-3 py-2 font-medium">Logistics</th>}
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngày</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={columnCount} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có báo giá."}</td></tr>
            )}
            {rows.map((row) => {
              const items: { key: string; label: string; onClick: () => void; icon?: React.ReactNode }[] = [
                { key: "quote", label: "Báo giá", icon: <FileText />, onClick: () => { setQuoteError(undefined); setEditing(row); } },
                {
                  key: "pdf",
                  label: "Tải PDF",
                  icon: <Download />,
                  onClick: () => {
                    void downloadQuoteRecordPdf(row).catch((cause: unknown) => {
                      setError(cause instanceof Error ? cause.message : "Không tải được PDF báo giá");
                    });
                  },
                },
              ];
              return (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  className={cn(
                    "border-b last:border-0",
                    highlightId === row.id ? FOCUS_ROW_CLASS : row.quoteStatus === "CHUA_CO_BAO_GIA_LAI" && "bg-amber-50",
                  )}
                >
                  <td className="px-3 py-3 font-medium">{row.code}</td>
                  <td className="px-3 py-3">
                    <p>{row.customerName || "—"}</p>
                    <p className="text-xs text-muted-foreground">{row.leadCode}</p>
                  </td>
                  <td className="px-3 py-3"><CustomerKindBadge value={row.customerKind} /></td>
                  <td className="max-w-48 truncate px-3 py-3" title={row.goods ?? undefined}>{row.goods || "—"}</td>
                  <td className="px-3 py-3">{row.templateName || "—"}</td>
                  <td className="max-w-56 truncate px-3 py-3" title={row.opsNote ?? undefined}>{row.opsNote || "—"}</td>
                  <td className="px-3 py-3"><QuoteStatusBadge value={row.quoteStatus} /></td>
                  <td className="px-3 py-3"><ContractStatusBadge value={row.contractStatus} /></td>
                  {desk === "sourcing" && (
                    <td className="px-3 py-3">
                      {row.customerKind === "SOURCING_LOGISTICS"
                        ? <QuoteStatusBadge value={row.logisticsSheet?.quoteStatus} />
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                  <td className="px-3 py-3">{shownDate(row.createdAt)}</td>
                  <td className="px-3 py-3">
                    <RowMenu label={`Thao tác ${row.code}`} items={items} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <QuoteEditor
          key={editing.id}
          quote={editing}
          templates={templates}
          editMode={editMode}
          desk={desk}
          pending={pending}
          error={quoteError}
          onClose={() => setEditing(null)}
          onSave={saveQuote}
          onSend={canOps ? sendQuote : undefined}
          onContinueLogistics={
            desk === "sourcing"
              ? () => {
                  setEditing(null);
                  setNotice("Đã chuyển sang Logistics – Báo giá. Mở phiếu để báo giá vận chuyển.");
                  router.push("/van-hanh/logistics-bao-gia");
                }
              : undefined
          }
        />
      )}

      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Mẫu báo giá</DialogTitle></DialogHeader>
          {templateError && <InlineAlert>{templateError}</InlineAlert>}
          <div className="max-h-64 overflow-y-auto rounded-lg border">
            {templates.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Chưa có mẫu.</p>}
            {templates.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 border-b px-3 py-2 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium">{item.name}</p>
                  {item.content && <p className="truncate text-xs text-muted-foreground">{item.content}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Sửa ${item.name}`} onClick={() => { setTemplateDraft({ id: item.id, name: item.name, content: item.content ?? "" }); setTemplateError(undefined); }}>
                    <Pencil />
                  </Button>
                  <Button type="button" size="icon-sm" variant="ghost" aria-label={`Xóa ${item.name}`} onClick={() => setRemovingTemplate(item)}>
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" onClick={() => { setTemplateDraft({ id: null, name: "", content: "" }); setTemplateError(undefined); }}>Thêm mẫu</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={templateDraft !== null} onOpenChange={(open) => { if (!open) setTemplateDraft(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{templateDraft?.id ? "Sửa mẫu báo giá" : "Thêm mẫu báo giá"}</DialogTitle></DialogHeader>
          {templateDraft && (
            <div className="grid gap-3">
              {templateError && <InlineAlert>{templateError}</InlineAlert>}
              <Field label="Tên mẫu" htmlFor="template-name" required>
                <Input id="template-name" value={templateDraft.name} onChange={(event) => setTemplateDraft({ ...templateDraft, name: event.target.value })} />
              </Field>
              <Field label="Nội dung" htmlFor="template-content">
                <Textarea id="template-content" value={templateDraft.content} onChange={(event) => setTemplateDraft({ ...templateDraft, content: event.target.value })} />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTemplateDraft(null)}>Hủy</Button>
            <Button type="button" disabled={pending} onClick={saveTemplate}>{pending ? "Đang lưu…" : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removingTemplate !== null}
        onOpenChange={(open) => { if (!open) setRemovingTemplate(null); }}
        destructive
        title="Xóa mẫu báo giá?"
        description={removingTemplate ? `${removingTemplate.name} sẽ bị xóa nếu chưa gắn với báo giá nào.` : ""}
        confirmLabel="Xóa"
        onConfirm={removeTemplate}
      />
    </>
  );
}
