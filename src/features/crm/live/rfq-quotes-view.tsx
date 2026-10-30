"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Eye, FilePlus, Plus, Printer, RotateCcw, Trash2 } from "lucide-react";
import { reassignQuoteSchema, type CrmLane, type UpdateQuoteInput } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/features/auth/session-provider";
import { ApiError, api } from "@/lib/api";
import type { Role } from "@/types/role";
import { ContractCreateDialog } from "./contract-create-dialog";
import { QuoteEditor } from "./quote-editor";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { downloadQuoteRecordPdf, orderForQuotePdf, printQuoteRecord } from "./quote-print";
import { RowMenu } from "./row-menu";
import { contractStatusOptions, customerKindOptions, labelOf, quoteStatusOptions, type PotentialRecord, type RfqQuoteRecord } from "./types";

const writeRoles: Role[] = ["admin", "sale-vn", "sale-global"];
const contractRoles: Role[] = ["admin", "sale-vn", "sale-global"];

const deskLabels = {
  sourcing: "Sourcing",
  logistics: "Logistics",
} as const;

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
    orders: sheet.orders,
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
  if (kind === "SOURCING" || kind === "SOURCING_LOGISTICS") return "sourcing";
  return null;
}

function matchesDesk(kind: string | null, desk: RfqQuoteRecord["desk"]): boolean {
  if (desk === "logistics") return kind === "LOGISTICS" || kind === "SOURCING_LOGISTICS";
  return kind === "SOURCING" || kind === "SOURCING_LOGISTICS";
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
  const [potentials, setPotentials] = useState<PotentialRecord[]>([]);
  const [error, setError] = useState<string>();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<RfqQuoteRecord | null>(null);
  const [viewing, setViewing] = useState<RfqQuoteRecord | null>(null);
  const [contractQuote, setContractQuote] = useState<RfqQuoteRecord | null>(null);
  const [returning, setReturning] = useState<RfqQuoteRecord | null>(null);
  const requestId = useRef(0);
  const filters = useAppliedSearch({ q: "", from: "", to: "", quoteStatus: "", contractStatus: "", customerKind: "", deskFilter: "" });

  const load = useCallback(() => {
    const rangeError = dateRangeError(filters.applied.from, filters.applied.to);
    if (rangeError) {
      setError(rangeError);
      return;
    }
    const id = ++requestId.current;
    setError(undefined);
    const query = searchParams(filters.applied, {
      quoteStatus: filters.applied.quoteStatus,
      contractStatus: filters.applied.contractStatus,
      customerKind: filters.applied.customerKind,
      deskFilter: filters.applied.deskFilter,
    });
    api<{ quotes: RfqQuoteRecord[] }>(`${crmPath("/api/crm/rfq-quotes", lane)}${query}`)
      .then((body) => { if (requestId.current === id) setRows(body.quotes); })
      .catch((err: unknown) => { if (requestId.current === id) setError(err instanceof ApiError ? err.message : "Không tải được báo giá"); });
    api<{ potentials: PotentialRecord[] }>(crmPath("/api/crm/potentials", lane))
      .then((body) => { if (requestId.current === id) setPotentials(body.potentials); })
      .catch((err: unknown) => { if (requestId.current === id) setError(err instanceof ApiError ? err.message : "Không tải được khách hàng tiềm năng"); });
  }, [filters.applied, lane]);

  useEffect(() => {
    setRows([]);
    setPotentials([]);
    setDraft(null);
    setRemoving(null);
    setError(undefined);
    load();
  }, [load]);

  const choices = potentials.filter((row) => {
    if (!draft) return false;
    if (draft.desk) {
      if (row.id === draft.potentialId) return true;
      if (!matchesDesk(row.customerKind, draft.desk)) return false;
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
    if (draft.desk && !matchesDesk(chosen.customerKind, draft.desk)) {
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
          if (row.desk === "logistics" && current.customerKind === "SOURCING_LOGISTICS") {
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
            {canWrite ? <Button type="button" onClick={openCreate}><Plus /> Thêm báo giá</Button> : null}
          </>
        }
      />
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
        <FilterSelect id="rfq-desk" label="Bàn" value={filters.draft.deskFilter} onChange={(value) => filters.set("deskFilter", value)} options={Object.entries(deskLabels)} />
        <FilterSelect id="rfq-status" label="Trạng thái" value={filters.draft.quoteStatus} onChange={(value) => filters.set("quoteStatus", value)} options={quoteStatusOptions} />
        <FilterSelect id="rfq-contract" label="Hợp đồng" value={filters.draft.contractStatus} onChange={(value) => filters.set("contractStatus", value)} options={contractStatusOptions} />
        <FilterSelect id="rfq-kind" label="Loại khách" value={filters.draft.customerKind} onChange={(value) => filters.set("customerKind", value)} options={customerKindOptions} />
      </ListSearchBar>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Khách</th>
              <th className="px-3 py-2 font-medium">Loại khách</th>
              <th className="px-3 py-2 font-medium">Hàng hóa</th>
              <th className="px-3 py-2 font-medium">Bàn</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2 font-medium">Hợp đồng</th>
              <th className="px-3 py-2 font-medium">Ngày</th>
              <th className="px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : `Chưa có báo giá trên tuyến ${laneName(lane)}.`}</td></tr>
            )}
            {rows.map((row) => {
              const logistics = row.customerKind === "SOURCING_LOGISTICS" ? logisticsQuote(row) : null;
              const printSource = printableQuote(row) ?? (logistics ? printableQuote(logistics) : null);
              return (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{row.code}</td>
                <td className="px-3 py-3">
                  <p>{row.customerName || "—"}</p>
                  <p className="text-xs text-muted-foreground">{row.leadCode}</p>
                </td>
                <td className="px-3 py-3">{labelOf(customerKindOptions, row.customerKind)}</td>
                <td className="max-w-56 truncate px-3 py-3" title={row.goods ?? undefined}>{row.goods || "—"}</td>
                <td className="px-3 py-3">{row.customerKind === "SOURCING_LOGISTICS" ? "Sourcing + Logistics" : deskLabels[row.desk]}</td>
                <td className="px-3 py-3">
                  {row.customerKind === "SOURCING_LOGISTICS" ? (
                    <div>
                      <p>Sourcing: {labelOf(quoteStatusOptions, row.quoteStatus)}</p>
                      <p>Logistics: {labelOf(quoteStatusOptions, logistics?.quoteStatus ?? null)}</p>
                    </div>
                  ) : labelOf(quoteStatusOptions, row.quoteStatus)}
                </td>
                <td className="px-3 py-3">{labelOf(contractStatusOptions, row.contractStatus)}</td>
                <td className="px-3 py-3">{shownDate(row.createdAt)}</td>
                <td className="px-3 py-3">
                  <RowMenu
                    label={`Thao tác ${row.code}`}
                    items={[
                      { key: "view", label: canContent ? "Xem / điền thông tin đơn" : "Xem báo giá", icon: <Eye />, onClick: () => { setError(undefined); setViewing(row); } },
                      {
                        key: "print",
                        label: "In báo giá",
                        icon: <Printer />,
                        onClick: () => {
                          if (!printSource) {
                            setError("Chưa có mẫu báo giá để in");
                            return;
                          }
                          void printQuoteRecord(printSource).catch((cause: unknown) => {
                            setError(cause instanceof Error ? cause.message : "Không in được báo giá");
                          });
                        },
                      },
                      {
                        key: "pdf",
                        label: "Tải PDF",
                        icon: <Download />,
                        onClick: () => {
                          if (!printSource) {
                            setError("Chưa có mẫu báo giá để tải PDF");
                            return;
                          }
                          void downloadQuoteRecordPdf(printSource).catch((cause: unknown) => {
                            setError(cause instanceof Error ? cause.message : "Không tải được PDF báo giá");
                          });
                        },
                      },
                      ...(canCreateContract && row.contractStatus !== "DA_TAO"
                        ? [{ key: "contract", label: "Chuyển Hợp đồng", icon: <FilePlus />, onClick: () => setContractQuote(row) }]
                        : []),
                      ...(row.customerKind === "SOURCING_LOGISTICS"
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
      </div>

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

      {viewing && viewing.customerKind === "SOURCING_LOGISTICS" && (
        <Dialog open onOpenChange={(open) => { if (!open) setViewing(null); }}>
          <DialogContent className="sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle>Báo giá {viewing.customerName || viewing.leadCode}</DialogTitle>
            </DialogHeader>
            <div className="grid max-h-[72vh] gap-4 overflow-y-auto pr-1">
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

      {viewing && viewing.customerKind !== "SOURCING_LOGISTICS" && (
        <QuoteEditor
          key={`${viewing.id}-${viewing.sentQuote?.sentAt ?? viewing.quoteStatus}`}
          quote={canContent ? viewing : viewableQuote(viewing)}
          templates={[]}
          editMode={contentEditMode}
          desk={viewing.desk}
          pending={pending}
          onClose={() => setViewing(null)}
          onSave={(input, options) => saveQuoteContent(viewing, input, options)}
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

      <ConfirmDialog
        open={returning !== null}
        onOpenChange={(open) => { if (!open) setReturning(null); }}
        title="Gửi lại báo giá"
        description={returning ? `Vận hành sẽ thấy ${returning.code}${returning.customerKind === "SOURCING_LOGISTICS" ? ` (${deskTitles[returning.desk]})` : ""} cần tạo báo giá mới.` : ""}
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
