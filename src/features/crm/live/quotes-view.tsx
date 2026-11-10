"use client";

import { isCombinedSourcing } from "@speego/shared";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileText, Pencil, Trash2 } from "lucide-react";
import { canEditQuoteDesk, quoteTemplateSchema, type CrmLane, type QuoteDesk, type UpdateQuoteInput } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/session-provider";
import { usePolling } from "@/lib/use-polling";
import { useNotificationRefresh } from "@/features/notifications/notifications-changed";
import { FOCUS_ROW_CLASS, useFocusRow } from "@/features/notifications/use-focus-row";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { AssignmentDialog } from "./assignment-dialog";
import { QuoteEditor } from "./quote-editor";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { QuoteLanguageDialog, quoteOutputText, type QuoteOutputAction } from "./quote-language-dialog";
import { quoteOutputRunners } from "./quote-output";
import { quoteRecordMissing } from "./quote-sheet";
import { RowMenu } from "./row-menu";
import { QuoteTracking } from "./quote-tracking";
import { TableHScroll } from "./table-h-scroll";
import { ContractStatusBadge, CustomerKindBadge, QuoteStatusBadge, ValidityBadge } from "./status-badges";
import {
  contractStatusOptions,
  customerKindOptions,
  quoteStatusOptions,
  type QuoteRecord,
  type QuoteTemplateRecord,
} from "./types";

const titles: Record<QuoteDesk, string> = {
  sourcing: "Sourcing – Báo giá",
  logistics: "Logistics – Báo giá",
};

type DeskQuote = QuoteRecord & { lane: CrmLane };

function shownDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

export function QuoteDeskView({ desk }: { desk: QuoteDesk }) {
  const user = useSession();
  const { lane, canPick, setLane } = useCrmLane();
  const canViewAllLanes = user.role === "admin" && desk === "logistics";
  const [allLanes, setAllLanes] = useState(true);
  const showAllLanes = canViewAllLanes && allLanes;
  const selectedLane = showAllLanes ? "all" : lane;
  const loadVersion = useRef(0);
  const canOps = canEditQuoteDesk(user.role, desk);
  /** Logistics xem bàn Sourcing (khách thuần sourcing) chỉ đọc; Sale sửa nội dung ở màn RFQ. */
  const editMode = canOps ? ("full" as const) : ("none" as const);
  const [rows, setRows] = useState<DeskQuote[]>([]);
  const [templates, setTemplates] = useState<QuoteTemplateRecord[]>([]);
  /** quoteId → người được chia đơn (chia xoay vòng giữa nhân sự Vận hành). */
  const [assignees, setAssignees] = useState<Record<string, { id: string; name: string }>>({});
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [pending, setPending] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateDraft, setTemplateDraft] = useState<{ id: string | null; name: string; content: string } | null>(null);
  const [templateError, setTemplateError] = useState<string>();
  const [removingTemplate, setRemovingTemplate] = useState<QuoteTemplateRecord | null>(null);
  const [editing, setEditing] = useState<DeskQuote | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const latest = editing ? rows.find((row) => row.id === editing.id && row.lane === editing.lane) : undefined;
  const [output, setOutput] = useState<{ action: QuoteOutputAction; row: QuoteRecord } | null>(null);
  const [quoteError, setQuoteError] = useState<string>();
  const [modeFilter, setModeFilter] = useState("");
  const filters = useAppliedSearch({ q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "" });
  const highlightId = useFocusRow(rows, lane, canPick, setLane, { refTypes: ["quote"] });

  const loadQuotes = useCallback(() => {
    const version = ++loadVersion.current;
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
    const lanes: CrmLane[] = selectedLane === "all" ? ["vn", "global"] : [selectedLane];
    Promise.all(lanes.map(async (quoteLane) => {
      const body = await api<{ quotes: QuoteRecord[] }>(`${crmPath(`/api/crm/quotes?desk=${desk}`, quoteLane)}${query}`);
      return body.quotes.map((row) => ({ ...row, lane: quoteLane }));
    }))
      .then((groups) => { if (version === loadVersion.current) setRows(groups.flat().sort((left, right) => right.createdAt.localeCompare(left.createdAt))); })
      .catch((err: unknown) => { if (version === loadVersion.current) setError(err instanceof ApiError ? err.message : "Không tải được báo giá"); });
    Promise.all(lanes.map((quoteLane) => api<{ assignees: Record<string, { id: string; name: string }> }>(`/api/chia-don/${desk}/assignees?lane=${quoteLane}`)))
      .then((bodies) => { if (version === loadVersion.current) setAssignees(Object.assign({}, ...bodies.map((body) => body.assignees))); })
      .catch(() => undefined); // cột người phụ trách chỉ là thông tin thêm, lỗi thì để trống
  }, [desk, filters.applied, selectedLane]);

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

  useNotificationRefresh(loadQuotes);
  usePolling(loadQuotes);

  const saveQuote = (input: UpdateQuoteInput, options?: { close?: boolean }) => {
    if (!editing) return Promise.resolve(false);
    setPending(true);
    setQuoteError(undefined);
    return api(crmPath(`/api/crm/quotes/${editing.id}?desk=${desk}`, editing.lane), { method: "PATCH", body: JSON.stringify(input) })
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
    return api<{ quote: QuoteRecord }>(crmPath(`/api/crm/quotes/${editing.id}/send?desk=${desk}`, editing.lane), { method: "POST", body: JSON.stringify(input) })
      .then((body) => {
        setEditing({ ...body.quote, lane: editing.lane });
        setNotice(isCombinedSourcing(body.quote) && desk === "sourcing"
          ? `Đã gửi báo giá ${body.quote.code} cho Sale và chuyển yêu cầu sang Logistics`
          : `Đã gửi báo giá ${body.quote.code} cho Sale`);
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

  const visibleRows = desk === "logistics" && modeFilter
    ? rows.filter((row) => (row.shippingMode === "AIR" ? "AIR" : row.logisticsClass) === modeFilter)
    : rows;
  const columnCount = 13 + (canViewAllLanes ? 1 : 0);

  return (
    <>
      <PageHeader
        title={titles[desk]}
        description={
          desk === "sourcing"
            ? "Sale điền ảnh/quy cách; mua hàng bổ sung chi tiết xưởng; vận hành báo giá. Sau khi gửi đơn hàng → chuyển Logistics."
            : showAllLanes
              ? "Tất cả báo giá vận chuyển tuyến Việt Nam và Global."
              : lane === "vn"
                ? "Báo giá vận chuyển tuyến Việt Nam."
                : "Báo giá vận chuyển tuyến Global."
        }
        actions={
          <>
            {canViewAllLanes && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allLanes} onChange={(event) => setAllLanes(event.target.checked)} />Tất cả tuyến</label>}
            {canPick && !showAllLanes ? <LaneSwitch lane={lane} onChange={setLane} /> : null}
            <Button type="button" variant="outline" onClick={() => setAssignmentOpen(true)}>Chia đơn</Button>
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
      {desk === "logistics" && <Field label="Tuyến Logistics" htmlFor="logistics-mode-filter" className="mb-4 max-w-56">
        <NativeSelect id="logistics-mode-filter" value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
          <option value="">Tất cả</option><option value="AIR">Đường bay</option><option value="LCL">Đường biển LCL</option><option value="FCL">Đường biển FCL</option>
        </NativeSelect>
      </Field>}
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
      <TableHScroll stickyIdentity>
        <table className="w-full min-w-[1250px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mã</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Khách</th>
              {canViewAllLanes && <th className="whitespace-nowrap px-3 py-2 font-medium">Thị trường</th>}
              <th className="whitespace-nowrap px-3 py-2 font-medium">Loại khách</th>
              {desk === "logistics" && <th className="whitespace-nowrap px-3 py-2 font-medium">Tuyến</th>}
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hàng hóa</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mẫu báo giá</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ghi chú VH</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Trạng thái báo giá</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hiệu lực</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hợp đồng</th>
              {desk === "sourcing" && <th className="whitespace-nowrap px-3 py-2 font-medium">Logistics</th>}
              <th className="whitespace-nowrap px-3 py-2 font-medium">Người phụ trách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngày</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr><td colSpan={columnCount} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có báo giá."}</td></tr>
            )}
            {visibleRows.map((row) => {
              const items: { key: string; label: string; onClick: () => void; icon?: React.ReactNode }[] = [
                { key: "quote", label: "Báo giá", icon: <FileText />, onClick: () => { setQuoteError(undefined); setEditing(row); } },
                { key: "pdf", label: "Tải PDF", icon: <Download />, onClick: () => setOutput({ action: "pdf", row }) },
                { key: "excel", label: "Tải Excel", icon: <Download />, onClick: () => setOutput({ action: "excel", row }) },
              ];
              return (
                <tr
                  key={`${row.lane}-${row.id}`}
                  data-row-id={row.id}
                  className={cn(
                    "border-b last:border-0",
                    highlightId === row.id ? FOCUS_ROW_CLASS : row.quoteStatus === "CHUA_CO_BAO_GIA_LAI" && "bg-amber-50",
                  )}
                >
                  <td className="px-3 py-3 font-medium"><QuoteTracking variant="code" code={row.code} potentialId={row.potentialId} lane={row.lane} /></td>
                  <td className="px-3 py-3" title={row.customerName || undefined}>
                    <p>{row.customerName || "—"}</p>
                    <p className="text-xs text-muted-foreground">{row.leadCode}</p>
                  </td>
                  {canViewAllLanes && <td className="whitespace-nowrap px-3 py-3">{row.lane === "vn" ? "Việt Nam" : "Global"}</td>}
                  <td className="px-3 py-3"><CustomerKindBadge value={row.customerKind} /></td>
                  {desk === "logistics" && <td className="px-3 py-3 whitespace-nowrap">{row.shippingMode === "AIR" ? "Đường bay" : row.logisticsClass === "FCL" ? "Đường biển FCL" : row.logisticsClass === "LCL" ? "Đường biển LCL" : "—"}</td>}
                  <td className="max-w-48 truncate px-3 py-3" title={row.goods ?? undefined}>{row.goods || "—"}</td>
                  <td className="px-3 py-3">{row.templateName || "—"}</td>
                  <td className="max-w-56 truncate px-3 py-3" title={row.opsNote ?? undefined}>{row.opsNote || "—"}</td>
                  <td className="px-3 py-3"><QuoteStatusBadge value={row.quoteStatus} /></td>
                  <td className="px-3 py-3">
                    {desk === "sourcing" && isCombinedSourcing(row) ? (
                      <div className="grid gap-1">
                        <p className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground">Sourcing</span><ValidityBadge sent={row.sentQuote} status={row.quoteStatus} /></p>
                        <p className="flex items-center gap-1.5"><span className="text-xs text-muted-foreground">Logistics</span><ValidityBadge sent={row.logisticsSheet?.sentQuote} status={row.logisticsSheet?.quoteStatus} /></p>
                      </div>
                    ) : <ValidityBadge sent={row.sentQuote} status={row.quoteStatus} />}
                  </td>
                  <td className="px-3 py-3"><ContractStatusBadge value={row.contractStatus} /></td>
                  {desk === "sourcing" && (
                    <td className="px-3 py-3">
                      {isCombinedSourcing(row)
                        ? <QuoteStatusBadge value={row.logisticsSheet?.quoteStatus} />
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  )}
                  <td className="px-3 py-3 whitespace-nowrap">{assignees[row.id]?.name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-3 py-3">{shownDate(row.createdAt)}</td>
                  <td className="px-3 py-3">
                    <RowMenu label={`Thao tác ${row.code}`} items={items} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableHScroll>

      {assignmentOpen && <AssignmentDialog desk={desk} onClose={() => setAssignmentOpen(false)} onChanged={loadQuotes} />}

      {editing && (
        <QuoteEditor
          key={`${editing.lane}-${editing.id}-${editorVersion}`}
          onReload={latest && JSON.stringify(latest) !== JSON.stringify(editing) ? () => { setEditing(latest); setEditorVersion((value) => value + 1); } : undefined}
          quote={editing}
          templates={templates}
          editMode={editMode}
          desk={desk}
          pending={pending}
          error={quoteError}
          onClose={() => setEditing(null)}
          onSave={saveQuote}
          onSend={canOps ? sendQuote : undefined}
          onContinueLogistics={desk === "sourcing" ? async () => {
            setPending(true);
            setQuoteError(undefined);
            try {
              await api(crmPath(`/api/crm/quotes/${editing.id}/logistics`, editing.lane), { method: "POST" });
              setNotice("Đã gửi thông tin đơn hàng và thông báo cho nhân sự Logistics.");
              loadQuotes();
              return true;
            } catch (error) {
              setQuoteError(error instanceof Error ? error.message : "Không gửi được qua Logistics");
              return false;
            } finally { setPending(false); }
          } : undefined}
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

      {output && (
        <QuoteLanguageDialog
          action={output.action}
          getMissing={(lang) => quoteRecordMissing(output.row, lang)}
          onClose={() => setOutput(null)}
          onConfirm={(lang) => {
            const { action, row } = output;
            setOutput(null);
            void quoteOutputRunners[action](row, lang).catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : quoteOutputText[action].failed);
            });
          }}
        />
      )}
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
