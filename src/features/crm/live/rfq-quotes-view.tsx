"use client";

import { quoteAmount } from "@speego/shared";

import { isCombinedSourcing, logisticsOrderFromSourcing } from "@speego/shared";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eye, FilePlus, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { industryCategoryOptions, reassignQuoteSchema, updateQuoteOutcomeSchema, type CrmLane, type UpdatePotentialInput, type UpdateQuoteInput } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/features/auth/session-provider";
import { useNotificationRefresh } from "@/features/notifications/notifications-changed";
import { FOCUS_ROW_CLASS, useFocusRow } from "@/features/notifications/use-focus-row";
import { ApiError, api } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Role } from "@/types/role";
import { ContractCreateDialog } from "./contract-create-dialog";
import { QuoteEditor, quoteFieldsFromPotential } from "./quote-editor";
import { useExcelImport } from "./excel-import";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { QuoteLanguageDialog, quoteOutputActions, quoteOutputIcon, quoteOutputText, type QuoteOutputAction } from "./quote-language-dialog";
import { quoteOutputRunners } from "./quote-output";
import { orderForQuotePdf, quoteRecordMissing, type QuotePdfSource } from "./quote-sheet";
import { RowMenu } from "./row-menu";
import { QuoteTracking } from "./quote-tracking";
import { TableHScroll } from "./table-h-scroll";
import { ContractStatusBadge, CustomerKindBadge, QuoteStatusBadge } from "./status-badges";
import { contractStatusOptions, customerKindOptions, deskLabels, labelOf, quoteStatusOptions, type PotentialRecord, type RfqQuoteRecord } from "./types";

const writeRoles: Role[] = ["admin", "sale-vn", "sale-global"];
const contractRoles: Role[] = ["admin", "sale-vn", "sale-global"];

const deskTitles = {
  sourcing: "Sourcing – Báo giá",
  logistics: "Logistics – Báo giá",
} as const;

function logisticsQuote(row: RfqQuoteRecord): RfqQuoteRecord | null {
  const sheet = row.logisticsSheet;
  if (!sheet) return null;
  return {
    ...row,
    desk: "logistics",
    templateId: sheet.templateId,
    templateName: sheet.templateName,
    opsNote: sheet.opsNote,
    quoteStatus: sheet.quoteStatus,
    contractStatus: sheet.contractStatus,
    orders: sheet.orders.length === 0 && !sheet.sentQuote && row.sentQuote
      ? [logisticsOrderFromSourcing(row.sentQuote.order)] : sheet.orders,
    sourcingContext: row.sentQuote ? { order: row.sentQuote.order, opsNote: row.opsNote } : null,
    notes: sheet.notes,
    bank: sheet.bank,
    sentQuote: sheet.sentQuote,
  };
}

type Draft = {
  id: string | null;
  potentialId: string;
  desk: RfqQuoteRecord["desk"] | null;
};

function laneName(lane: CrmLane): string {
  return lane === "vn" ? "Việt Nam" : "Global";
}

function shownDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("vi-VN");
}

function primaryDesk(kind: string | null): RfqQuoteRecord["desk"] | null {
  if (kind === "LOGISTICS") return "logistics";
  if (kind === "SOURCING") return "sourcing";
  return null;
}

function matchesDesk(row: PotentialRecord, desk: RfqQuoteRecord["desk"]): boolean {
  const kind = row.customerKind;
  if (desk === "logistics") return kind === "LOGISTICS" || isCombinedSourcing(row);
  return kind === "SOURCING";
}

function optionLabel(row: PotentialRecord): string {
  const company = row.companyName ? ` · ${row.companyName}` : "";
  return `${row.leadCode} — ${row.fullName || "Chưa có tên"}${company}`;
}

/** Ưu tiên bản đã gửi cho Sale; không có thì lấy mẫu đơn hàng hiện có để xem/in. */
function printableQuote(row: RfqQuoteRecord): RfqQuoteRecord | null {
  if (row.sentQuote) {
    return {
      ...row,
      orders: [{ ...row.sentQuote.order, selected: true }],
      notes: row.sentQuote.notes,
      bank: row.sentQuote.bank,
    };
  }
  return orderForQuotePdf(row.orders) ? row : null;
}

function viewableQuote(row: RfqQuoteRecord): RfqQuoteRecord {
  return printableQuote(row) ?? row;
}

export function RfqQuotesView({ lane: fixedLane }: { lane?: CrmLane }) {
  const user = useSession();
  const { lane, canPick, setLane } = useCrmLane(fixedLane);
  const canWrite = writeRoles.includes(user.role);
  const canContent = writeRoles.includes(user.role);
  const canCreateContract = contractRoles.includes(user.role);
  const contentEditMode = canContent ? "content" as const : "none" as const;
  const [rows, setRows] = useState<RfqQuoteRecord[]>([]);
  const rowsWithTotals = useMemo(() => rows.map((row) => ({
    row,
    sourcingTotal: quoteAmount(row, "sourcing"),
    logisticsTotal: quoteAmount(row.logisticsSheet, "logistics"),
  })), [rows]);
  const [potentials, setPotentials] = useState<PotentialRecord[]>([]);
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<RfqQuoteRecord | null>(null);
  const [viewing, setViewing] = useState<RfqQuoteRecord | null>(null);
  const [output, setOutput] = useState<{ action: QuoteOutputAction; source: QuotePdfSource } | null>(null);
  const [contractQuote, setContractQuote] = useState<RfqQuoteRecord | null>(null);
  const [outcomeQuote, setOutcomeQuote] = useState<RfqQuoteRecord | null>(null);
  const [outcomeDraft, setOutcomeDraft] = useState("");
  const [outcomeError, setOutcomeError] = useState<string>();
  const [outcomePending, setOutcomePending] = useState(false);
  const [returning, setReturning] = useState<RfqQuoteRecord | null>(null);
  const quoteRequest = useRef(0);
  const potentialRequest = useRef(0);
  const filters = useAppliedSearch({ q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "", deskFilter: "" });
  const highlightId = useFocusRow(rows, lane, canPick, setLane, { refTypes: ["quote"] });

  const loadQuotes = useCallback(() => {
    const rangeError = dateRangeError(filters.applied.from, filters.applied.to);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    const id = ++quoteRequest.current;
    setError(undefined);
    const query = searchParams(filters.applied, {
      quoteStatus: filters.applied.quoteStatus,
      contractStatus: filters.applied.contractStatus,
      customerKind: filters.applied.customerKind,
      deskFilter: filters.applied.deskFilter,
    });
    api<{ quotes: RfqQuoteRecord[] }>(`${crmPath("/api/crm/rfq-quotes", lane)}${query}`)
      .then((body) => { if (quoteRequest.current === id) setRows(body.quotes); })
      .catch((err: unknown) => { if (quoteRequest.current === id) setError(err instanceof ApiError ? err.message : "Không tải được báo giá"); });
  }, [filters.applied, lane]);

  const loadPotentials = useCallback(() => {
    const id = ++potentialRequest.current;
    api<{ potentials: PotentialRecord[] }>(crmPath("/api/crm/potentials", lane))
      .then((body) => { if (potentialRequest.current === id) setPotentials(body.potentials); })
      .catch((err: unknown) => { if (potentialRequest.current === id) setError(err instanceof ApiError ? err.message : "Không tải được khách hàng tiềm năng"); });
  }, [lane]);

  const load = useCallback(() => {
    loadQuotes();
    loadPotentials();
  }, [loadQuotes, loadPotentials]);

  const excel = useExcelImport({ kind: "quotes", lane, allLanes: canPick, enabled: canWrite, onDone: load });

  useEffect(() => {
    setRows([]);
    setDraft(null);
    setRemoving(null);
    setOutcomeQuote(null);
    setError(undefined);
    loadQuotes();
  }, [loadQuotes]);

  useEffect(() => {
    setPotentials([]);
    loadPotentials();
  }, [loadPotentials]);

  useNotificationRefresh(loadQuotes);

  const choices = potentials.filter((row) => {
    if (!draft) return false;
    if (draft.desk) {
      if (row.id === draft.potentialId) return true;
      if (!matchesDesk(row, draft.desk)) return false;
      const current = rows.find((quote) => quote.id === draft.id);
      if (current && draft.desk === "sourcing" && current.quoteWorkflow !== row.quoteWorkflow) return false;
      if (draft.desk === "logistics" && row.customerKind !== "LOGISTICS") return false;
      return !rows.some((quote) => quote.potentialId === row.id && quote.desk === draft.desk);
    }
    const desk = primaryDesk(row.customerKind);
    if (!desk) return false;
    return !rows.some((quote) => quote.potentialId === row.id && quote.desk === desk);
  });
  const selected = potentials.find((row) => row.id === draft?.potentialId);

  const openCreate = () => {
    setDraft({ id: null, potentialId: "", desk: null });
    setFormError(undefined);
  };

  const save = () => {
    if (!draft) return;
    const chosen = potentials.find((row) => row.id === draft.potentialId);
    if (!chosen || !choices.some((row) => row.id === chosen.id)) {
      setFormError(`Chọn khách hàng tiềm năng tuyến ${laneName(lane)}`);
      return;
    }
    if (draft.desk && !matchesDesk(chosen, draft.desk)) {
      setFormError("Khách này không cùng bàn báo giá trên tuyến đang chọn");
      return;
    }
    const parsed = reassignQuoteSchema.safeParse({ potentialId: draft.potentialId });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setPending(true);
    const request = draft.id
      ? api<{ quote: { id: string } }>(crmPath(`/api/crm/rfq-quotes/${draft.id}`, lane), { method: "PATCH", body: JSON.stringify(parsed.data) })
      : api<{ created: boolean }>(crmPath(`/api/crm/potentials/${parsed.data.potentialId}/quotes`, lane), { method: "POST" });
    void request
      .then((body) => {
        if (body && "created" in body && !body.created) {
          setFormError("Khách này đã có báo giá trên tuyến này");
          load();
          return;
        }
        setDraft(null);
        load();
      })
      .catch((err: unknown) => setFormError(err instanceof ApiError ? err.message : "Không lưu được báo giá"))
      .finally(() => setPending(false));
  };

  const handoffLogistics = (row: RfqQuoteRecord) => {
    setPending(true);
    setError(undefined);
    return api(crmPath(`/api/crm/quotes/${row.id}/handoff-logistics`, lane), { method: "POST" })
      .then(() => {
        loadQuotes();
        return true;
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Không chuyển được cho Logistics");
        return false;
      })
      .finally(() => setPending(false));
  };

  const sentToSale = (status: string) => status === "DA_CO_BAO_GIA" || status === "DA_CO_BAO_GIA_LAI";

  const saveQuoteContent = (row: RfqQuoteRecord, input: UpdateQuoteInput, options?: { close?: boolean }) => {
    setPending(true);
    setError(undefined);
    return api<{ quote: RfqQuoteRecord }>(crmPath(`/api/crm/quotes/${row.id}?desk=${row.desk}`, lane), {
      method: "PATCH",
      body: JSON.stringify(input),
    })
      .then((body) => {
        setViewing((current) => {
          if (!current || current.id !== row.id) return current;
          if (row.desk === "logistics" && isCombinedSourcing(current)) {
            return {
              ...current,
              logisticsSheet: {
                templateId: body.quote.templateId,
                templateName: body.quote.templateName,
                opsNote: body.quote.opsNote,
                quoteStatus: body.quote.quoteStatus,
                contractStatus: body.quote.contractStatus,
                orders: body.quote.orders,
                notes: body.quote.notes,
                bank: body.quote.bank,
                sentQuote: body.quote.sentQuote,
              },
            };
          }
          return { ...current, ...body.quote, desk: current.desk, logisticsSheet: current.logisticsSheet };
        });
        if (options?.close !== false) setViewing(null);
        load();
        return true;
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Không lưu được thông tin đơn hàng");
        return false;
      })
      .finally(() => setPending(false));
  };

  const saveSaleLead = (row: RfqQuoteRecord, input: UpdatePotentialInput) => {
    setError(undefined);
    return api<{ potential: PotentialRecord }>(crmPath(`/api/crm/potentials/${row.potentialId}`, lane), {
      method: "PATCH",
      body: JSON.stringify(input),
    })
      .then((body) => {
        const patch = quoteFieldsFromPotential(input, body.potential.requirementImages ?? input.requirementImages ?? []);
        setViewing((current) => (current && current.id === row.id ? { ...current, ...patch } : current));
        setRows((current) => current.map((item) => (item.id === row.id ? { ...item, ...patch } : item)));
        load();
        return patch;
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Không lưu được thông tin khách tiềm năng");
        return null;
      });
  };

  const openOutcomeEditor = (row: RfqQuoteRecord) => {
    setOutcomeError(undefined);
    setOutcomeDraft(row.nonCloseReason ?? "");
    setOutcomeQuote(row);
  };

  const saveOutcome = () => {
    if (!outcomeQuote) return;
    const parsed = updateQuoteOutcomeSchema.safeParse({ nonCloseReason: outcomeDraft });
    if (!parsed.success) {
      setOutcomeError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    setOutcomePending(true);
    setOutcomeError(undefined);
    void api<{ quote: RfqQuoteRecord }>(
      crmPath(`/api/crm/quotes/${outcomeQuote.id}/outcome?desk=${outcomeQuote.desk}`, lane),
      { method: "PATCH", body: JSON.stringify(parsed.data) },
    )
      .then(() => {
        setOutcomeQuote(null);
        loadQuotes();
      })
      .catch((err: unknown) => setOutcomeError(err instanceof ApiError ? err.message : "Không lưu được lý do"))
      .finally(() => setOutcomePending(false));
  };

  const returnQuote = (row: RfqQuoteRecord) => {
    setPending(true);
    setError(undefined);
    return api<{ quote: RfqQuoteRecord }>(crmPath(`/api/crm/quotes/${row.id}/return?desk=${row.desk}`, lane), { method: "POST" })
      .then((body) => {
        setViewing((current) => {
          if (!current || current.id !== row.id) return current;
          if (row.desk === "logistics" && current.logisticsSheet) {
            return { ...current, logisticsSheet: { ...current.logisticsSheet, quoteStatus: body.quote.quoteStatus } };
          }
          return { ...current, quoteStatus: body.quote.quoteStatus };
        });
        load();
        return body.quote.quoteStatus;
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Không gửi lại được báo giá");
        return null;
      })
      .finally(() => setPending(false));
  };

  const remove = () => {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    void api(crmPath(`/api/crm/rfq-quotes/${id}`, lane), { method: "DELETE" })
      .then(load)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không xóa được báo giá"));
  };

  return (
    <>
      <PageHeader
        title="Báo giá (RFQ)"
        description={`Điền thông tin đơn hàng (ảnh, quy cách) rồi chờ VH báo giá · tuyến ${laneName(lane)}. Tạo hợp đồng sẽ lấy sẵn số lượng và giá từ báo giá.`}
        actions={
          <>
            {canPick ? <LaneSwitch lane={lane} onChange={setLane} /> : null}
            {excel.buttons}
            {canWrite ? <Button type="button" onClick={openCreate}><Plus /> Thêm báo giá</Button> : null}
          </>
        }
      />
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      {excel.banner}
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
        <FilterSelect id="rfq-desk" label="Bàn" value={filters.draft.deskFilter} onChange={(value) => filters.set("deskFilter", value)} options={Object.entries(deskLabels)} />
        <FilterSelect id="rfq-status" label="Trạng thái" value={filters.draft.quoteStatus} onChange={(value) => filters.set("quoteStatus", value)} options={quoteStatusOptions} />
        <FilterSelect id="rfq-contract" label="Hợp đồng" value={filters.draft.contractStatus} onChange={(value) => filters.set("contractStatus", value)} options={contractStatusOptions} />
        <FilterSelect id="rfq-kind" label="Loại khách" value={filters.draft.customerKind} onChange={(value) => filters.set("customerKind", value)} options={customerKindOptions} />
      </ListSearchBar>
      <TableHScroll stickyIdentity>
        <table className="w-full min-w-[1480px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mã</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Loại khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hàng hóa</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngành hàng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Bàn</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Trạng thái</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Tổng tiền Sourcing</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Tổng tiền Logistics</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hợp đồng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Lý do không/chưa chốt</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngày</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={13} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : `Chưa có báo giá trên tuyến ${laneName(lane)}.`}</td></tr>
            )}
            {rowsWithTotals.map(({ row, sourcingTotal, logisticsTotal }) => {
              const logistics = isCombinedSourcing(row) ? logisticsQuote(row) : null;
              const printSource = printableQuote(row) ?? (logistics ? printableQuote(logistics) : null);
              return (
              <tr
                key={row.id}
                data-row-id={row.id}
                className={cn("border-b last:border-0", highlightId === row.id && FOCUS_ROW_CLASS)}
              >
                <td className="px-3 py-3 font-medium"><QuoteTracking variant="code" code={row.code} potentialId={row.potentialId} lane={lane} /></td>
                <td className="px-3 py-3" title={row.customerName || undefined}>
                  <p>{row.customerName || "—"}</p>
                  <p className="text-xs text-muted-foreground">{row.leadCode}</p>
                </td>
                <td className="px-3 py-3"><CustomerKindBadge value={row.customerKind} /></td>
                <td className="max-w-56 truncate px-3 py-3" title={row.goods ?? undefined}>{row.goods || "—"}</td>
                <td className="max-w-56 truncate px-3 py-3" title={labelOf(industryCategoryOptions, row.industry)}>{labelOf(industryCategoryOptions, row.industry)}</td>
                <td className="px-3 py-3">{isCombinedSourcing(row) ? "Sourcing" : deskLabels[row.desk]}</td>
                <td className="px-3 py-3">
                  {isCombinedSourcing(row) ? (
                    <div className="grid gap-1">
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Sourcing</span>
                        <QuoteStatusBadge value={row.quoteStatus} />
                      </p>
                      <p className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Logistics</span>
                        <QuoteStatusBadge value={logistics?.quoteStatus} />
                      </p>
                    </div>
                  ) : <QuoteStatusBadge value={row.quoteStatus} />}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">{sourcingTotal.amount == null ? "—" : formatMoney(sourcingTotal.amount, sourcingTotal.currency)}</td>
                <td className="px-3 py-3 whitespace-nowrap">{logisticsTotal.amount == null ? "Chưa đủ số tiền" : formatMoney(logisticsTotal.amount, logisticsTotal.currency)}</td>
                <td className="px-3 py-3"><ContractStatusBadge value={row.contractStatus} /></td>
                <td className="max-w-72 px-3 py-3">
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate" title={row.contractStatus === "DA_TAO" ? undefined : row.nonCloseReason ?? undefined}>
                      {row.contractStatus === "DA_TAO" ? "—" : row.nonCloseReason || "—"}
                    </span>
                    {canWrite && row.contractStatus !== "DA_TAO" && (
                      <Button type="button" size="sm" variant="ghost" className="shrink-0" onClick={() => openOutcomeEditor(row)} aria-label={`Sửa lý do chưa chốt ${row.code}`}>
                        <Pencil /> Sửa
                      </Button>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">{shownDate(row.createdAt)}</td>
                <td className="px-3 py-3">
                  <RowMenu
                    label={`Thao tác ${row.code}`}
                    items={[
                      { key: "view", label: canContent ? "Xem / điền thông tin đơn" : "Xem báo giá", icon: <Eye />, onClick: () => { setError(undefined); setViewing(row); } },
                      ...quoteOutputActions.map((action) => {
                        const Icon = quoteOutputIcon[action];
                        return {
                          key: action,
                          label: quoteOutputText[action].menu,
                          icon: <Icon />,
                          onClick: () => {
                            if (!printSource) {
                              setError(quoteOutputText[action].noSheet);
                              return;
                            }
                            setOutput({ action, source: printSource });
                          },
                        };
                      }),
                      ...(canCreateContract && row.contractStatus !== "DA_TAO"
                        ? [{ key: "contract", label: "Chuyển Hợp đồng", icon: <FilePlus />, onClick: () => setContractQuote(row) }]
                        : []),
                      ...(isCombinedSourcing(row)
                        ? [
                          ...(canWrite && sentToSale(row.quoteStatus) ? [{ key: "return-sourcing", label: "Gửi lại Sourcing", icon: <RotateCcw />, onClick: () => setReturning(row) }] : []),
                          ...(canWrite && logistics && sentToSale(logistics.quoteStatus) ? [{ key: "return-logistics", label: "Gửi lại Logistics", icon: <RotateCcw />, onClick: () => setReturning(logistics) }] : []),
                        ]
                        : canWrite && sentToSale(row.quoteStatus)
                          ? [{ key: "return", label: "Gửi lại báo giá", icon: <RotateCcw />, onClick: () => setReturning(row) }]
                          : []),
                      ...(canWrite ? [
                        { key: "delete", label: "Xóa", icon: <Trash2 />, destructive: true, onClick: () => setRemoving(row) },
                      ] : []),
                    ]}
                  />
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </TableHScroll>

      <Dialog open={draft !== null} onOpenChange={(open) => { if (!open) setDraft(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm báo giá</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              {formError && <InlineAlert>{formError}</InlineAlert>}
              <Field
                label="Khách hàng tiềm năng"
                htmlFor="rfq-potential"
                required
                hint={`Chỉ khách tuyến ${laneName(lane)}${draft.desk ? `, cùng bàn ${deskLabels[draft.desk]}` : ""}.`}
              >
                <NativeSelect id="rfq-potential" value={draft.potentialId} onChange={(event) => setDraft({ ...draft, potentialId: event.target.value })}>
                  <option value="">Chọn khách</option>
                  {choices.map((row) => <option key={row.id} value={row.id}>{optionLabel(row)}</option>)}
                </NativeSelect>
              </Field>
              {choices.length === 0 && (
                <p className="text-sm text-muted-foreground">Chưa có khách hàng tiềm năng phù hợp trên tuyến {laneName(lane)}.</p>
              )}
              {selected && (
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <p>{labelOf(customerKindOptions, selected.customerKind)}</p>
                  <p className="text-muted-foreground">{selected.productInterest || "Chưa có hàng hóa"} · {selected.phone || selected.email || "Chưa có liên hệ"}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDraft(null)}>Hủy</Button>
            <Button type="button" disabled={pending} onClick={save}>{pending ? "Đang lưu…" : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={outcomeQuote !== null} onOpenChange={(open) => { if (!open && !outcomePending) setOutcomeQuote(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Lý do không/chưa chốt{outcomeQuote ? ` · ${outcomeQuote.code}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            {outcomeError && <InlineAlert>{outcomeError}</InlineAlert>}
            <Field label="Lý do" htmlFor="quote-non-close-reason" hint="Tối đa 2.000 ký tự">
              <Textarea
                id="quote-non-close-reason"
                rows={5}
                maxLength={2000}
                value={outcomeDraft}
                placeholder="Ví dụ: khách đang cân nhắc giá hoặc chưa xác nhận nhu cầu…"
                onChange={(event) => setOutcomeDraft(event.target.value)}
              />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={outcomePending} onClick={() => setOutcomeQuote(null)}>Hủy</Button>
            <Button type="button" disabled={outcomePending} onClick={saveOutcome}>{outcomePending ? "Đang lưu…" : "Lưu"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {viewing && isCombinedSourcing(viewing) && (
        <Dialog open onOpenChange={(open) => { if (!open) setViewing(null); }}>
          <DialogContent className="max-h-[96dvh] w-[min(98vw,120rem)] max-w-none sm:max-w-none">
            <DialogHeader>
              <DialogTitle>Báo giá {viewing.customerName || viewing.leadCode}</DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[80dvh] gap-4 overflow-y-auto pr-1">
              {([
                { desk: "sourcing" as const, quote: viewing },
                { desk: "logistics" as const, quote: logisticsQuote(viewing) },
              ]).map(({ desk, quote }) => {
                const title = deskTitles[desk];
                if (!quote) {
                  return (
                    <section key={desk} className="rounded-xl border p-3">
                      <h3 className="font-medium">{title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">Chưa có bản báo giá.</p>
                    </section>
                  );
                }
                // Khi điền nội dung dùng bản đơn hàng hiện tại; chỉ xem bản đã gửi khi chỉ đọc.
                const source = canContent ? quote : viewableQuote(quote);
                const rowForSave: RfqQuoteRecord = desk === "logistics"
                  ? { ...viewing, ...source, id: viewing.id, desk: "logistics" }
                  : viewing;
                return (
                  <QuoteEditor
                    key={`${viewing.id}-${desk}-${quote.sentQuote?.sentAt ?? quote.quoteStatus}`}
                    embedded
                    heading={`${title} · ${viewing.code}`}
                    quote={{ ...source, id: viewing.id }}
                    templates={[]}
                    editMode={contentEditMode}
                    desk={desk}
                    pending={pending}
                    onClose={() => setViewing(null)}
                    onSave={(input, options) => saveQuoteContent(rowForSave, input, options)}
                    onSaveSale={canWrite ? (input) => saveSaleLead(viewing, input) : undefined}
                    onReturn={quote.sentQuote ? () => returnQuote(desk === "logistics" ? { ...viewing, desk } : viewing) : undefined}
                  />
                );
              })}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setViewing(null)}>Đóng</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {viewing && !isCombinedSourcing(viewing) && (
        <QuoteEditor
          key={`${viewing.id}-${viewing.sentQuote?.sentAt ?? viewing.quoteStatus}`}
          quote={canContent ? viewing : viewableQuote(viewing)}
          templates={[]}
          editMode={contentEditMode}
          desk={viewing.desk}
          pending={pending}
          onClose={() => setViewing(null)}
          onSave={(input, options) => saveQuoteContent(viewing, input, options)}
          onSaveSale={canWrite ? (input) => saveSaleLead(viewing, input) : undefined}
          onHandoffLogistics={canWrite && viewing.customerKind === "LOGISTICS" ? () => handoffLogistics(viewing) : undefined}
          onReturn={viewing.sentQuote ? () => returnQuote(viewing) : undefined}
        />
      )}

      {contractQuote && (
        <ContractCreateDialog
          lane={lane}
          quote={contractQuote}
          onClose={() => setContractQuote(null)}
          onCreated={() => {
            setViewing((current) => current && current.id === contractQuote.id ? { ...current, contractStatus: "DA_TAO" } : current);
            setContractQuote(null);
            load();
          }}
        />
      )}

      {output && (
        <QuoteLanguageDialog
          action={output.action}
          getMissing={(lang) => quoteRecordMissing(output.source, lang)}
          onClose={() => setOutput(null)}
          onConfirm={(lang) => {
            const { action, source } = output;
            setOutput(null);
            void quoteOutputRunners[action](source, lang).catch((cause: unknown) => {
              setError(cause instanceof Error ? cause.message : quoteOutputText[action].failed);
            });
          }}
        />
      )}
      <ConfirmDialog
        open={returning !== null}
        onOpenChange={(open) => { if (!open) setReturning(null); }}
        title="Gửi lại báo giá"
        description={returning ? `Vận hành sẽ thấy ${returning.code}${isCombinedSourcing(returning) ? ` (${deskTitles[returning.desk]})` : ""} cần tạo báo giá mới.` : ""}
        confirmLabel="Gửi lại"
        onConfirm={() => { if (returning) void returnQuote(returning); }}
      />

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        destructive
        title="Xóa báo giá?"
        description={removing ? `${removing.code} của ${removing.customerName || removing.leadCode} sẽ được gỡ khỏi tuyến ${laneName(lane)}.` : ""}
        confirmLabel="Xóa"
        onConfirm={remove}
      />
    </>
  );
}
