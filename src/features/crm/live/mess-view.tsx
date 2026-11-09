"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { canHandleCrm, createMessageSchema, industryCategoryOptions, updateMessageSchema, type CrmLane } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InlineAlert } from "@/components/shared/form-fields";
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
import { dateRangeError, FilterSelect, ListSearchBar, searchParams, useAppliedSearch } from "./list-search-bar";
import { dateInputFromIso, draftFrom, emptyDraft, marketPresets, messFieldIds, MessFormDialog, todayInput, uniqueSuggestions, type MessDraft } from "./mess-form";
import { useMessConvert } from "./mess-convert";
import { RowMenu } from "./row-menu";
import { zodFieldErrors } from "@/lib/zod-errors";
import { TableHScroll } from "./table-h-scroll";
import { CustomerTypeBadge, DemandBadge, HeatBadge, MessageStatusBadge } from "./status-badges";
import { brandOptions, customerTypeOptions, demandOptions, labelOf, messageClassificationOptions, messageStatusLabels, type MessageRecord } from "./types";

const writeRoles: Role[] = ["admin", "marketing", "sale-vn", "sale-global"];
const convertRoles: Role[] = ["admin", "sale-vn", "sale-global"];

export function MessView({ lane: fixedLane }: { lane?: CrmLane }) {
  const user = useSession();
  const { lane, canPick, setLane } = useCrmLane(fixedLane);
  const canWrite = writeRoles.includes(user.role);
  const canConvert = convertRoles.includes(user.role);
  const [rows, setRows] = useState<MessageRecord[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [draft, setDraft] = useState<MessDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);
  const [removing, setRemoving] = useState<MessageRecord | null>(null);
  const [knownMarkets, setKnownMarkets] = useState<string[]>(marketPresets);
  const filters = useAppliedSearch({ q: "", from: "", to: "", status: "", classification: "", demand: "", customerType: "", market: "" });

  const load = useCallback(() => {
    const rangeError = dateRangeError(filters.applied.from, filters.applied.to);
    if (rangeError) {
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
    });
    api<{ messages: MessageRecord[] }>(`${crmPath("/api/crm/messages", lane)}${query}`)
      .then((body) => {
        setRows(body.messages);
        setKnownMarkets((current) => uniqueSuggestions([...current, ...body.messages.map((row) => row.market)]));
      })
      .catch((err: unknown) => setError(err instanceof ApiError ? err.message : "Không tải được mess"));
  }, [filters.applied, lane]);
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
        <FilterSelect id="mess-classification" label="Phân loại" value={filters.draft.classification} onChange={(value) => filters.set("classification", value)} options={messageClassificationOptions} />
        <FilterSelect id="mess-market" label="Thị trường" value={filters.draft.market} onChange={(value) => filters.set("market", value)} options={marketOptions} />
        <FilterSelect id="mess-demand" label="Nhu cầu" value={filters.draft.demand} onChange={(value) => filters.set("demand", value)} options={demandOptions} />
        <FilterSelect id="mess-customer-type" label="Đối tượng" value={filters.draft.customerType} onChange={(value) => filters.set("customerType", value)} options={customerTypeOptions} />
        <FilterSelect id="mess-status" label="Trạng thái" value={filters.draft.status} onChange={(value) => filters.set("status", value)} options={Object.entries(messageStatusLabels)} />
      </ListSearchBar>
      <TableHScroll stickyIdentity>
        <table className="w-full min-w-[1800px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="whitespace-nowrap px-3 py-2 font-medium">Mã</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Tên khách</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngày</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thị trường</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Nguồn</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Phân loại</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Đối tượng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Nhu cầu</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Hàng hóa</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ngành hàng</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Sales - hot & warm</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Pain-Point của KH</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Link mess</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Ghi chú Sale</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Trạng thái</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={16} className="px-3 py-8 text-center text-muted-foreground">{filters.active ? "Không có kết quả." : "Chưa có mess."}</td></tr>}
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-3 font-medium">{row.messCode}</td>
                <td className="px-3 py-3" title={row.customerName ?? undefined}>{row.customerName}</td>
                <td className="px-3 py-3 whitespace-nowrap">{row.receivedAt ? formatDate(dateInputFromIso(row.receivedAt)) : "—"}</td>
                <td className="px-3 py-3">{row.market || "—"}</td>
                <td className="whitespace-nowrap px-3 py-3">{brandOptions.find(([value]) => value === row.brand)?.[1] ?? "—"}</td>
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
