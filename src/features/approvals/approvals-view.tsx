"use client";

import { ServerPagination, useServerPagination } from "@/components/shared/server-pagination";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCircle2, Eye, Inbox, Paperclip, Plus, Search, Trash2 } from "lucide-react";
import type { PageInfo, ProposalDecision, ProposalRecord, ProposalTemplateRecord, ProposalUser } from "@speego/shared";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { InlineAlert } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/features/auth/session-provider";
import { clearOpenContractParams, OPEN_CONTRACT_EVENT, readOpenContractFromUrl, type OpenContractDetail } from "@/features/notifications/open-contract";
import { ApiError, api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ApprovalCreate } from "./approval-create";
import { ApprovalDetail } from "./approval-detail";
import { Avatar, formatDay, formatDateTime, isMyTurn, statusMeta, summaryChip } from "./approval-shared";
import { ApprovalStats } from "./approval-stats";
import { ApprovalTemplates } from "./approval-templates";

type Tab = "inbox" | "sent" | "admin" | "templates" | "stats";
type Screen = { name: "list" } | { name: "create"; templateId: string } | { name: "detail"; id: string };

// Khớp quyền "proposal.review" / "proposal.template" ở server (server/src/config/permissions.ts); server vẫn là nơi kiểm tra thật.
const REVIEW_ROLES = ["admin", "ban-gd", "hcns"];
const TEMPLATE_ROLES = ["admin", "hcns"];

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** Đề xuất & yêu cầu công việc: chấm công, đi muộn/về sớm, thanh toán, nghỉ phép... qua tối đa 4 bước duyệt. */
export function ApprovalsView() {
  const user = useSession();
  const canReview = REVIEW_ROLES.includes(user.role);
  const canManageTemplates = TEMPLATE_ROLES.includes(user.role);
  const [rows, setRows] = useState<ProposalRecord[]>([]);
  const [templates, setTemplates] = useState<ProposalTemplateRecord[]>([]);
  const [users, setUsers] = useState<ProposalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [tab, setTab] = useState<Tab>("inbox");
  const [filter, setFilter] = useState<"todo" | "watch" | "done">("todo");
  const [screen, setScreen] = useState<Screen>({ name: "list" });
  const [search, setSearch] = useState("");
  const [deciding, setDeciding] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pendingOpen, setPendingOpen] = useState<string | null>(() => readOpenContractFromUrl()?.id ?? null);

  const paging = useServerPagination(JSON.stringify({ tab, filter, search }));
  const { query: pageQuery, receive: receivePage } = paging;
  const rowRequest = useRef(0);
  const [detailRow, setDetailRow] = useState<ProposalRecord | null>(null);
  const loadRows = useCallback(async () => {
    if (tab === "stats" || tab === "templates") return;
    const request = ++rowRequest.current;
    const query = new URLSearchParams({ tab, filter, q: search });
    const body = await api<{ rows: ProposalRecord[]; pagination: PageInfo }>(`/api/de-xuat?${query}${pageQuery}`);
    if (request === rowRequest.current) { setRows(body.rows); receivePage(body.pagination); }
  }, [tab, filter, search, pageQuery, receivePage]);
  const loadTemplates = useCallback(() => api<{ templates: ProposalTemplateRecord[] }>("/api/de-xuat/templates").then((b) => setTemplates(b.templates)), []);

  useEffect(() => {
    Promise.all([loadTemplates(), api<{ users: ProposalUser[] }>("/api/de-xuat/users").then((b) => setUsers(b.users))])
      .catch((err: unknown) => setError(errorText(err, "Không tải được dữ liệu đề xuất")))
      .finally(() => setLoading(false));
  }, [loadTemplates]);
  useEffect(() => {
    let active = true;
    void loadRows().catch((err: unknown) => { if (active) setError(errorText(err, "Không tải được danh sách đề xuất")); });
    return () => { active = false; };
  }, [loadRows]);

  // Bấm thông báo trên chuông (hoặc mở link ?id=): vào thẳng chi tiết đề xuất đó.
  useEffect(() => {
    const onOpen = (event: Event) => {
      const detail = (event as CustomEvent<OpenContractDetail>).detail;
      if (detail?.id && (!detail.refType || detail.refType === "de-xuat")) setPendingOpen(detail.id);
    };
    window.addEventListener(OPEN_CONTRACT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CONTRACT_EVENT, onOpen);
  }, []);
  useEffect(() => {
    if (pendingOpen) clearOpenContractParams();
  }, [pendingOpen]);

  const detailId = pendingOpen ?? (screen.name === "detail" ? screen.id : null);
  const loadDetail = useCallback(async () => {
    if (!detailId) return;
    const body = await api<{ row: ProposalRecord }>(`/api/de-xuat/${detailId}`);
    setDetailRow(body.row);
  }, [detailId]);
  useEffect(() => {
    let active = true;
    if (detailId) api<{ row: ProposalRecord }>(`/api/de-xuat/${detailId}`)
      .then(body => { if (active) setDetailRow(body.row); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { active = false; };
  }, [detailId]);

  const go = (next: Screen) => { setPendingOpen(null); setScreen(next); };

  const reload = () => Promise.all([loadRows(), loadDetail()]).catch((err: unknown) => setError(errorText(err, "Không tải lại được danh sách")));

  const active = rows;
  const counts = paging.summary;
  const canDelete = filter === "done" && (tab === "sent" || (tab === "admin" && user.role === "admin"));

  const decide = (row: ProposalRecord, decision: ProposalDecision, comment = "") => {
    setDeciding(true);
    setError(undefined);
    api(`/api/de-xuat/${row.id}/decision`, { method: "POST", body: JSON.stringify({ decision, comment }) })
      .then(() => { setNotice(decision === "da-duyet" ? "Đã đồng ý" : "Đã từ chối"); return reload(); })
      .catch((err: unknown) => setError(errorText(err, "Có lỗi xảy ra")))
      .finally(() => setDeciding(false));
  };

  const removeSelected = () => {
    const ids = active.filter((r) => selected.has(r.id)).map((r) => r.id);
    setConfirmDelete(false);
    api<{ removed: number }>("/api/de-xuat/delete", { method: "POST", body: JSON.stringify({ ids }) })
      .then((res) => { setNotice(`Đã xóa ${res.removed} đề xuất`); setSelected(new Set()); return reload(); })
      .catch((err: unknown) => setError(errorText(err, "Không xóa được đề xuất đã chọn")));
  };

  const switchTab = (next: Tab) => { setTab(next); setFilter("todo"); setSelected(new Set()); setSearch(""); setError(undefined); setNotice(undefined); };
  const openCreate = (templateId = "chung") => { setError(undefined); setNotice(undefined); go({ name: "create", templateId }); };
  const back = () => { go({ name: "list" }); setError(undefined); };

  if (loading) return <p className="py-10 text-center text-muted-foreground">Đang tải dữ liệu...</p>;

  // Mở từ thông báo: hiện chi tiết ngay khi danh sách đã có đề xuất đó.
  const shownScreen: Screen = pendingOpen ? { name: "detail", id: pendingOpen } : screen;

  if (shownScreen.name === "create") {
    const template = templates.find((t) => t.id === shownScreen.templateId) ?? templates[0];
    if (template) {
      return (
        <ApprovalCreate
          template={template} templates={templates} users={users} me={user}
          onBack={back}
          onCreated={() => { setNotice("Đã nộp yêu cầu"); setTab("sent"); setFilter("todo"); go({ name: "list" }); void reload(); }}
        />
      );
    }
  }
  if (shownScreen.name === "detail") {
    const row = detailRow?.id === shownScreen.id ? detailRow : rows.find((r) => r.id === shownScreen.id);
    if (row) return <ApprovalDetail row={row} me={user} onBack={back} onChanged={() => void reload()} deciding={deciding} error={error} onDecide={(decision, comment) => decide(row, decision, comment)} />;
    return <div className="space-y-4"><Button variant="outline" onClick={back}>Quay lại</Button>{error ? <InlineAlert>{error}</InlineAlert> : <p role="status">Đang tải đề xuất…</p>}</div>;
  }

  const tabs: [Tab, string][] = [["inbox", "Gửi đến"], ["sent", "Gửi đi"], ...(canReview ? [["admin", "Quản trị"] as [Tab, string]] : []), ["templates", "Mẫu yêu cầu"], ...(canReview ? [["stats", "Thống kê"] as [Tab, string]] : [])];

  return (
    <>
      <PageHeader
        title="Đề xuất"
        description={tab === "templates" ? "Chọn mẫu để tạo yêu cầu mới" : tab === "stats" ? "Theo mã nhân viên · Tuần / Tháng / Năm" : "Đề xuất & yêu cầu công việc"}
        actions={<Button onClick={() => openCreate()}><Plus /> Tạo đề xuất</Button>}
      />
      {error && <InlineAlert className="mb-4">{error}</InlineAlert>}
      {notice && <InlineAlert tone="success" className="mb-4">{notice}</InlineAlert>}

      <div className="relative mb-4 max-w-xl">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label="Tìm kiếm" className="pl-9" value={search} maxLength={200} placeholder={tab === "stats" ? "Tìm theo mã NV, họ tên..." : "Tìm kiếm"} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div role="tablist" aria-label="Đề xuất" className="no-scrollbar mb-4 flex gap-1 overflow-x-auto overflow-y-hidden border-b">
        {tabs.map(([key, label]) => (
          <button key={key} role="tab" type="button" aria-selected={tab === key} onClick={() => switchTab(key)}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-semibold whitespace-nowrap", tab === key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {label}
          </button>
        ))}
      </div>

      {tab === "templates" ? (
        <ApprovalTemplates templates={templates} users={users} search={search} canManage={canManageTemplates} onUse={(t) => openCreate(t.id)} onChanged={() => void loadTemplates()} />
      ) : tab === "stats" ? (
        <ApprovalStats search={search} onOpen={(id) => go({ name: "detail", id })} />
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button variant={filter === "todo" ? "default" : "outline"} onClick={() => setFilter("todo")}><Inbox /> {tab === "inbox" ? "Cần làm" : "Đang xử lý"} ({Number(counts.todo ?? 0)})</Button>
            {tab === "inbox" && <Button variant={filter === "watch" ? "default" : "outline"} onClick={() => setFilter("watch")}><Eye /> Theo dõi ({Number(counts.watch ?? 0)})</Button>}
            <Button variant={filter === "done" ? "default" : "outline"} onClick={() => setFilter("done")}><CheckCircle2 /> {tab === "admin" ? "Đã xong" : "Hoàn thành"} ({Number(counts.done ?? 0)})</Button>
            {canDelete && active.length > 0 && (
              <div className="ml-auto flex items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={active.every((r) => selected.has(r.id))} onChange={(e) => setSelected(e.target.checked ? new Set(active.map((r) => r.id)) : new Set())} />
                  Chọn tất cả
                </label>
                <Button variant="destructive" disabled={!active.some((r) => selected.has(r.id))} onClick={() => setConfirmDelete(true)}>
                  <Trash2 /> Xóa đã chọn ({active.filter((r) => selected.has(r.id)).length})
                </Button>
              </div>
            )}
          </div>

          {active.length === 0 ? (
            <EmptyState title="Không có yêu cầu nào" icon={Inbox} />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {active.map((r) => {
                const status = statusMeta[r.status];
                const last = r.steps.filter((s) => s.decidedAt).at(-1);
                const chip = summaryChip(r);
                const myTurn = isMyTurn(r, user.id);
                const canQuick = r.status === "cho-duyet" && (tab === "inbox" || tab === "admin") && (myTurn || user.role === "admin");
                return (
                  <li key={r.id}>
                    <article className="flex h-full cursor-pointer flex-col gap-2 rounded-xl border bg-card p-4 shadow-xs hover:border-primary/40" onClick={() => go({ name: "detail", id: r.id })}>
                      <div className="flex items-start gap-2">
                        {canDelete && (
                          <input type="checkbox" aria-label={`Chọn đề xuất ${r.code}`} checked={selected.has(r.id)} className="mt-1"
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => setSelected((cur) => { const next = new Set(cur); if (!next.delete(r.id)) next.add(r.id); return next; })} />
                        )}
                        <div className="min-w-0 flex-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{r.templateTitle}</span> · #{r.code}</div>
                        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                      </div>
                      <h3 className="font-semibold">{r.subject}</h3>
                      <p className="line-clamp-2 text-sm text-muted-foreground">{r.content}</p>
                      <div className="flex flex-wrap gap-2 text-xs">
                        {r.attachments.length > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5"><Paperclip aria-hidden className="size-3" />{r.attachments.length} tệp</span>}
                        {chip && <span className="rounded-full bg-muted px-2 py-0.5">{chip}</span>}
                        {(tab === "admin" || (tab === "inbox" && !myTurn)) && r.status === "cho-duyet" && <span className="rounded-full bg-muted px-2 py-0.5">Chờ {r.steps[r.currentStep]?.approverName ?? "người duyệt"}</span>}
                      </div>
                      {last && <p className={cn("text-xs", last.decision === "tu-choi" ? "text-danger" : "text-success")}>{last.decision === "tu-choi" ? "Từ chối" : "Đã duyệt"} bởi {last.decidedByName ?? last.approverName} · {formatDateTime(last.decidedAt)}</p>}
                      <div className="mt-auto flex items-center gap-2 border-t pt-2 text-xs text-muted-foreground">
                        <Avatar name={r.requesterName} size={22} /><span className="flex-1 truncate">{r.requesterName}</span><span>{formatDay(r.createdAt)}</span>
                      </div>
                      {canQuick && (
                        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                          <Button size="sm" disabled={deciding} onClick={() => decide(r, "da-duyet")}><Check /> Duyệt</Button>
                        </div>
                      )}
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
          <ServerPagination paging={paging} />
        </>
      )}
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Xóa đề xuất đã chọn?" description={`Xóa ${active.filter((r) => selected.has(r.id)).length} đề xuất đã hoàn thành. Không hoàn tác được.`} confirmLabel="Xóa" destructive onConfirm={removeSelected} />
    </>
  );
}
