"use client";

import type { PageInfo } from "@speego/shared";
import { ServerPagination, useServerPagination } from "@/components/shared/server-pagination";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { canHandleCrm, messageProcessingOptions, createMessageSchema, industryCategoryOptions, updateMessageSchema, type CrmLane } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Field, InlineAlert, NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useSession } from "@/features/auth/session-provider";
import { useNotificationRefresh } from "@/features/notifications/notifications-changed";
import { ApiError, api } from "@/lib/api";
import { usePolling } from "@/lib/use-polling";
import { formatDate } from "@/lib/format";
import type { Role } from "@/types/role";
import { useExcelImport } from "./excel-import";
import { crmPath, LaneSwitch, useCrmLane } from "./lane";
import { MultiCombobox } from "@/components/shared/multi-combobox";
import { saleFilterOptions } from "./sale-filter-options";
import { CustomerKindTabs, dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { dateInputFromIso, draftFrom, emptyDraft, marketPresets, messFieldIds, MessFormDialog, todayInput, uniqueSuggestions, type MessDraft } from "./mess-form";
import { useMessConvert } from "./mess-convert";
import { RowMenu } from "./row-menu";
import { zodFieldErrors } from "@/lib/zod-errors";
import { TableHScroll } from "./table-h-scroll";
import { CustomerTypeBadge, DemandBadge, HeatBadge, MessageStatusBadge } from "./status-badges";
import { brandOptions, customerTypeOptions, labelOf, messageClassificationOptions, messageStatusLabels, type MessageRecord } from "./types";

const writeRoles: Role[] = ["admin", "marketing", "sale-vn", "sale-global", "sale-global-lead"];
const convertRoles: Role[] = ["admin", "sale-vn", "sale-global", "sale-global-lead"];

export function MessView({ lane: fixedLane }: { lane?: CrmLane }) {
  const user = useSession();
  const { lane, canPick, setLane } = useCrmLane(fixedLane);
  const canWrite = writeRoles.includes(user.role);
  const canConvert = convertRoles.includes(user.role);
  const loadVersion = useRef(0);
  const loadedListPath = useRef<string | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [rows, setRows] = useState<MessageRecord[]>([]);
  const [processingFilter, setProcessingFilter] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [draft, setDraft] = useState<MessDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<MessageRecord | null>(null);
  const [knownMarkets, setKnownMarkets] = useState<string[]>(marketPresets);
  const filters = useAppliedSearch({ q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "", market: "", saleName: "" });
  const paging = useServerPagination(lane + JSON.stringify(filters.applied) + processingFilter, "");
  const { query: pageQuery, receive: receivePage } = paging;
  const shown = listLoading ? [] : rows;
  const statusCounts = (paging.summary.statusCounts ?? {}) as Record<string, number>;
  const saleOptions = saleFilterOptions((paging.summary.staff ?? []) as string[], (paging.summary.sales ?? []) as string[], (paging.summary.otherStaff ?? []) as string[]);
  // Chọn nhiều người: giá trị lọc là mọi dạng tên của những người đã chọn, ngăn cách bằng "|".
  const pickedNames = new Set(filters.draft.saleName.split("|").map((name) => name.trim().toLowerCase()).filter(Boolean));
  const pickedSales = saleOptions.filter((option) => option.value.split("|").every((name) => pickedNames.has(name.toLowerCase()))).map((option) => option.label);

  const load = useCallback(() => {
    const version = ++loadVersion.current;
    const rangeError = dateRangeError(filters.applied.from, filters.applied.to);
    if (rangeError) {
      setListLoading(false);
      setError(rangeError);
      return;
    }
    setError(undefined);
    const query = searchParams(filters.applied, {
      status: filters.applied.status,
      classification: filters.applied.classification,
      demand: filters.applied.demand,
      customerType: filters.applied.customerType,
      market: filters.applied.market,
      saleName: filters.applied.saleName,
      processingStatus: processingFilter,
    });
    const path = `${crmPath("/api/crm/messages", lane)}${query}${pageQuery}`;
    // Keep the current records visible when refreshing the same list.
    setListLoading(loadedListPath.current !== path);
    api<{ messages: MessageRecord[]; pagination: PageInfo }>(path)
      .then((body) => {
        if (version !== loadVersion.current) return;
        loadedListPath.current = path;
        setRows(body.messages);
        receivePage(body.pagination);
        setKnownMarkets((current) => uniqueSuggestions([...current, ...((body.pagination.summary.markets ?? []) as string[])]));
      })
      .catch((err: unknown) => { if (version === loadVersion.current) setError(err instanceof ApiError ? err.message : "Không tải được mess"); })
      .finally(() => { if (version === loadVersion.current) setListLoading(false); });
  }, [filters.applied, lane, processingFilter, pageQuery, receivePage]);
  const { openConvert, convertPending, dialogs: convertDialogs } = useMessConvert({ lane, load, error, setError, setNotice });

  const excel = useExcelImport({ kind: "messages", lane, allLanes: canPick, enabled: canWrite, onDone: load });

  useEffect(() => {
    load();
  }, [load]);

  /** Bàn khác chuyển hoặc sửa mess: tải lại mỗi 30 giây và ngay khi có thông báo mới. */
  usePolling(load);
  useNotificationRefresh(load);

  useEffect(() => {
    setKnownMarkets(marketPresets);
  }, [lane]);

  const marketOptions = uniqueSuggestions([...knownMarkets, ...rows.map((row) => row.market)], marketPresets)
    .map((market) => [market, market] as const);
  const goodsOptions = uniqueSuggestions(rows.map((row) => row.goods));

  const openCreate = () => {
    setEditingId(null);
    setFormError(undefined);
    setFieldErrors({});
    setDraft({ ...emptyDraft, receivedOn: todayInput(), saleName: user.name });
  };

  const save = () => {
    if (!draft) return;
    const payload = {
      ...draft,
      saleName: editingId ? draft.saleName : user.name,
      receivedOn: draft.receivedOn || undefined,
      demand: draft.demand || undefined,
      industry: draft.industry || undefined,
      customerType: draft.customerType || undefined,
      classification: draft.classification || undefined,
      brand: draft.brand || undefined,
      // Chỉ Sale/Admin ghi nháp đơn hàng; vai trò khác không gửi để server giữ nguyên nháp cũ.
      order: canConvert ? draft.order : undefined,
    };
    const parsed = (editingId ? updateMessageSchema : createMessageSchema).safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(zodFieldErrors(parsed.error, messFieldIds));
      setFormError(undefined);
      return;
    }
    setPending(true);
    setFieldErrors({});
    setFormError(undefined);
    const request = editingId
      ? api(crmPath(`/api/crm/messages/${editingId}`, lane), { method: "PATCH", body: JSON.stringify(parsed.data) })
      : api(crmPath("/api/crm/messages", lane), { method: "POST", body: JSON.stringify(parsed.data) });
    void request
      .then(() => {
        setDraft(null);
        load();
      })
      .catch((err: unknown) => setFormError(err instanceof ApiError ? err.message : "Không lưu được mess"))
      .finally(() => setPending(false));
  };


  const setProcessingStatus = async (row: MessageRecord, processingStatus: string) => {
    setStatusSaving(true);
    setError(undefined);
    try {
      const result = await api<{ message: MessageRecord }>(crmPath(`/api/crm/messages/${row.id}/processing-status`, lane), {
        method: "PATCH", body: JSON.stringify({ processingStatus }),
      });
      setRows((current) => current.map((item) => item.id === row.id ? result.message : item));
      load();
    } catch (err: unknown) {
      setError(err instanceof ApiError ? err.message : "Không lưu được trạng thái xử lý");
    } finally {
      setStatusSaving(false);
    }
  };

  const remove = () => {
    if (!removing) return;
    const id = removing.id;
    setRemoving(null);
    void api(crmPath(`/api/crm/messages/${id}`, lane), { method: "DELETE" })
      .then(load)
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không xóa được mess"));
  };

  return (
    <>
      <PageHeader
        title="Mess"
        description={lane === "vn" ? "Mess tuyến Việt Nam. Sale chuyển mess thành khách hàng tiềm năng." : "Mess tuyến Global. Sale chuyển mess thành khách hàng tiềm năng."}
        actions={
          <>
            {canPick && <LaneSwitch lane={lane} onChange={setLane} />}
            {excel.buttons}
            {canWrite && <Button onClick={openCreate}><Plus /> Tạo mess</Button>}
          </>
        }
      />
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}
      {excel.banner}
      <ListSearchBar
        tabs={<CustomerKindTabs value={filters.applied.demand === "SHIPPING" ? "LOGISTICS" : filters.applied.demand} onChange={(value) => filters.select("demand", value === "LOGISTICS" ? "SHIPPING" : value)} />}
        activeCount={filters.activeCount - Number(!!filters.applied.demand)}
        q={filters.draft.q}
        from={filters.draft.from}
        to={filters.draft.to}
        onQ={(value) => filters.set("q", value)}
        onFrom={(value) => filters.set("from", value)}
        onTo={(value) => filters.set("to", value)}
        onSearch={filters.search}
        onReset={() => { filters.reset(); setProcessingFilter(""); }}
        dateLabel="Từ ngày"
      >
        <FilterSelect id="mess-classification" label="Phân loại" value={filters.draft.classification} onChange={(value) => filters.set("classification", value)} options={messageClassificationOptions} />
        <FilterSelect id="mess-market" label="Thị trường" value={filters.draft.market} onChange={(value) => filters.set("market", value)} options={marketOptions} />
        <Field label="Nhân viên sale" htmlFor="mess-sale-filter">
          <MultiCombobox id="mess-sale-filter" options={saleOptions.map((option) => option.label)} value={pickedSales} placeholder="Tất cả nhân viên" searchPlaceholder="Tìm nhân viên…"
            onChange={(labels) => filters.set("saleName", saleOptions.filter((option) => labels.includes(option.label)).map((option) => option.value).join("|"))} />
        </Field>
        <FilterSelect id="mess-customer-type" label="Đối tượng" value={filters.draft.customerType} onChange={(value) => filters.set("customerType", value)} options={customerTypeOptions} />
        <FilterSelect id="mess-status" label="Trạng thái mess" value={filters.draft.status} onChange={(value) => filters.set("status", value)} options={Object.entries(messageStatusLabels)} />
      </ListSearchBar>
      <div role="group" aria-label="Lọc trạng thái xử lý" className="mb-4 flex gap-2 overflow-x-auto pb-2">
        {[["", "Tất cả"], ...messageProcessingOptions].map(([status, label]) => (
          <Button key={status} type="button" variant={processingFilter === status ? "default" : "outline"} aria-pressed={processingFilter === status} onClick={() => setProcessingFilter(status)}>
            {label} ({statusCounts[status] ?? 0})
          </Button>
        ))}
      </div>
      <TableHScroll stickyIdentity>
        <table className="w-full min-w-[1800px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mã</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Tên khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngày</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thị trường</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Nguồn</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Trạng thái xử lý</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Phân loại</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Đối tượng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Nhu cầu</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hàng hóa</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngành hàng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Nhân viên sale</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Pain-Point của KH</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Link mess</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ghi chú Sale</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Trạng thái chuyển</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {listLoading && <tr><td colSpan={17} role="status" className="px-3 py-8 text-center text-muted-foreground">Đang tải…</td></tr>}
            {!listLoading && shown.length === 0 && <tr><td colSpan={17} className="px-3 py-8 text-center text-muted-foreground">{filters.active || processingFilter ? "Không có kết quả." : "Chưa có mess."}</td></tr>}
            {shown.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{row.messCode}</td>
                <td className="px-3 py-3" title={row.customerName ?? undefined}>{row.customerName}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.receivedAt ? formatDate(dateInputFromIso(row.receivedAt)) : "—"}</td>
                <td className="px-3 py-3">{row.market || "—"}</td>
                <td className="whitespace-nowrap px-3 py-3">{brandOptions.find(([value]) => value === row.brand)?.[1] ?? "—"}</td>
                <td className="min-w-64 px-3 py-3">
                  <NativeSelect aria-label={`Trạng thái xử lý · ${row.messCode}`} value={row.processingStatus} disabled={!canWrite || !canHandleCrm(user, row) || statusSaving} onChange={(event) => void setProcessingStatus(row, event.target.value)}>
                    {messageProcessingOptions.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
                  </NativeSelect>
                </td>
                <td className="px-3 py-3"><HeatBadge value={row.classification} /></td>
                <td className="px-3 py-3"><CustomerTypeBadge value={row.customerType} /></td>
                <td className="px-3 py-3"><DemandBadge value={row.demand} /></td>
                <td className="px-3 py-3">{row.goods || "—"}</td>
                <td className="max-w-56 truncate px-3 py-3" title={labelOf(industryCategoryOptions, row.industry)}>{labelOf(industryCategoryOptions, row.industry)}</td>
                <td className="px-3 py-3">{row.saleName || "—"}</td>
                <td className="max-w-48 truncate px-3 py-3" title={row.painPoint ?? undefined}>{row.painPoint || "—"}</td>
                <td className="max-w-56 truncate px-3 py-3" title={row.linkMess ?? undefined}>
                  {row.linkMess ? (
                    /^https?:\/\//i.test(row.linkMess) ? (
                      <a href={row.linkMess} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {row.linkMess}
                      </a>
                    ) : row.linkMess
                  ) : "—"}
                </td>
                <td className="max-w-48 truncate px-3 py-3" title={row.note ?? undefined}>{row.note || "—"}</td>
                <td className="px-3 py-3"><MessageStatusBadge status={row.status} leadCode={row.leadCode} /></td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    {canConvert && canHandleCrm(user, row) && row.status !== "LOST" && (
                      <Button
                        size="sm"
                        title="Điền thông tin báo giá"
                        aria-label={`Chuyển sang Khách tiềm năng · ${row.messCode}`}
                        disabled={convertPending}
                        onClick={() => openConvert(row)}
                      >
                        <UserPlus />
                        Chuyển
                      </Button>
                    )}
                    <RowMenu
                      label={`Thao tác ${row.messCode}`}
                      items={[
                        ...(canWrite && canHandleCrm(user, row)
                          ? [
                              { key: "edit", label: "Sửa", icon: <Pencil />, onClick: () => {
                                setEditingId(row.id);
                                setFieldErrors({});
                                setFormError(undefined);
                                const next = draftFrom(row);
                                setDraft({ ...next, saleName: next.saleName.trim() || user.name });
                              } },
                              { key: "delete", label: "Xóa", icon: <Trash2 />, destructive: true, onClick: () => setRemoving(row) },
                            ]
                          : []),
                      ]}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableHScroll>
      <ServerPagination paging={paging} loading={listLoading} />

      <MessFormDialog
        draft={draft}
        setDraft={setDraft}
        title={editingId ? "Sửa mess" : "Tạo mess"}
        submitLabel="Lưu"
        formError={formError}
        fieldErrors={fieldErrors}
        pending={pending}
        onSave={save}
        onClose={() => setDraft(null)}
        marketOptions={marketOptions}
        goodsOptions={goodsOptions}
        canConvert={canConvert}
      />

      {convertDialogs}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => { if (!open) setRemoving(null); }}
        destructive
        title="Xóa mess?"
        description={removing ? `${removing.messCode} sẽ bị xóa. Mess đã chuyển sang khách hàng tiềm năng cần xóa bản tiềm năng trước.` : ""}
        confirmLabel="Xóa"
        onConfirm={remove}
      />
    </>
  );
}
