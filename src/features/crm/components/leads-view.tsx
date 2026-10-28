"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KanbanSquare, List, Plus, Search, Info } from "lucide-react";
import { DataTable, type Column } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { NativeSelect } from "@/components/shared/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CRM_TODAY, careStatusMeta, originLabels, sourceLabels, temperatureMeta } from "@/config/crm";
import { formatDate, formatDayMonth } from "@/lib/format";
import { matchesQuery } from "@/lib/text";
import { cn } from "@/lib/utils";
import { routeFromOrigin } from "@/services/crm/rules";
import type { CareStatus, Lead, LeadSource, Temperature } from "@/types/crm";
import { useCrm, usePagination } from "../hooks";
import { LeadFormDialog } from "./lead-form-dialog";
import { LeadKanban } from "./lead-kanban";
import { LostReasonDialog } from "./lost-reason-dialog";
import { CareBadge, SourceTag, TemperatureBadge } from "./meta-badges";

type View = "list" | "kanban";

export function LeadsView() {
  const { data, all, can, staffName, scope } = useCrm();
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [query, setQuery] = useState("");
  const [temp, setTemp] = useState<Temperature | "">("");
  const [source, setSource] = useState<LeadSource | "">("");
  const [care, setCare] = useState<CareStatus | "">("");
  const [owner, setOwner] = useState("");
  const [route, setRoute] = useState<"" | "vn" | "global">("");
  const [creating, setCreating] = useState(false);
  const [lostFor, setLostFor] = useState<string>();

  const filtered = useMemo(
    () =>
      [...data.leads]
        // mới nhất lên đầu; cùng ngày giữ thứ tự (lead vừa tạo ở đầu mảng)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .filter(
        (l) =>
          (!temp || l.temperature === temp) &&
          (!source || l.source === source) &&
          (!care || l.careStatus === care) &&
          (!owner || l.ownerId === owner) &&
          (!route || routeFromOrigin(l.goodsOrigin) === route) &&
          matchesQuery(query, l.contactName, l.company, l.phone, l.messId, l.email),
      ),
    [data.leads, temp, source, care, owner, route, query],
  );
  const paging = usePagination(filtered, 15);
  const owners = all.staff.filter((s) => s.team === "sale-vn" || s.team === "sale-global");
  const filtering = !!(query || temp || source || care || owner || route);

  const columns: Column<Lead>[] = [
    {
      key: "customer",
      header: "Khách hàng",
      cell: (l) => (
        <div className="min-w-0">
          <Link href={`/crm/leads/${l.messId}`} className="font-medium text-foreground hover:text-primary hover:underline">
            {l.contactName}
          </Link>
          <p className="max-w-56 truncate text-xs text-muted-foreground">{l.company}</p>
        </div>
      ),
    },
    { key: "mess", header: "mess_id", cell: (l) => <span className="font-mono text-xs text-muted-foreground">{l.messId}</span>, className: "hidden xl:table-cell" },
    { key: "source", header: "Nguồn", cell: (l) => <SourceTag source={l.source} /> },
    { key: "temp", header: "Phân loại", cell: (l) => <TemperatureBadge value={l.temperature} /> },
    { key: "care", header: "Trạng thái", cell: (l) => <CareBadge value={l.careStatus} /> },
    { key: "owner", header: "Phụ trách", cell: (l) => staffName(l.ownerId), className: "hidden lg:table-cell" },
    {
      key: "next",
      header: "Việc tiếp theo",
      className: "hidden xl:table-cell",
      cell: (l) =>
        l.nextTask && !l.nextTask.done ? (
          <span className={cn("text-xs", l.nextTask.dueOn < CRM_TODAY ? "font-medium text-danger" : "text-muted-foreground")}>
            {formatDayMonth(l.nextTask.dueOn)} · {l.nextTask.title}
            {l.nextTask.dueOn < CRM_TODAY && <span className="sr-only"> (quá hạn)</span>}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
    { key: "created", header: "Ngày tạo", cell: (l) => <span className="tabular text-muted-foreground">{formatDate(l.createdAt)}</span>, className: "hidden md:table-cell" },
  ];

  return (
    <>
      <PageHeader
        title="Quản lý Lead"
        description="Lead từ Ads, Google, Organic. Phân loại Hot / Warm / Cold, phân công và theo dõi chăm sóc."
        actions={
          can("lead.write") && (
            <Button size="lg" onClick={() => setCreating(true)}>
              <Plus /> Tạo lead
            </Button>
          )
        }
      />

      <p className="mb-4 flex items-start gap-2 rounded-lg border bg-surface px-3 py-2.5 text-sm text-muted-foreground">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
        <span>
          <strong className="font-medium text-foreground">Affiliate: đề xuất, chưa kích hoạt.</strong> Chưa có quy trình, mã nguồn và dữ liệu nên chưa nhận lead từ kênh này.
        </span>
      </p>

      <div className="mb-4 rounded-xl border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-60 flex-1">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Tìm lead theo tên, công ty, số điện thoại, mess_id" placeholder="Tìm tên, công ty, SĐT, mess_id…" value={query} onChange={(e) => setQuery(e.target.value)} className="h-9 pl-8" />
          </div>
          <NativeSelect aria-label="Lọc phân loại" className="w-36" value={temp} onChange={(e) => setTemp(e.target.value as Temperature | "")}>
            <option value="">Mọi phân loại</option>
            {(Object.keys(temperatureMeta) as Temperature[]).map((t) => (
              <option key={t} value={t}>
                {temperatureMeta[t].label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Lọc nguồn lead" className="w-40" value={source} onChange={(e) => setSource(e.target.value as LeadSource | "")}>
            <option value="">Mọi nguồn</option>
            {(["ads", "google", "organic"] as LeadSource[]).map((s) => (
              <option key={s} value={s}>
                {sourceLabels[s]}
              </option>
            ))}
            <option value="affiliate" disabled>
              {sourceLabels.affiliate} (chưa kích hoạt)
            </option>
          </NativeSelect>
          <NativeSelect aria-label="Lọc trạng thái chăm sóc" className="w-40" value={care} onChange={(e) => setCare(e.target.value as CareStatus | "")}>
            <option value="">Mọi trạng thái</option>
            {(Object.keys(careStatusMeta) as CareStatus[]).map((c) => (
              <option key={c} value={c}>
                {careStatusMeta[c].label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Lọc người phụ trách" className="w-44" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="">Mọi nhân viên</option>
            {owners
              .filter((s) => !scope || s.team === (scope === "vn" ? "sale-vn" : "sale-global"))
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </NativeSelect>
          {!scope && (
            <NativeSelect aria-label="Lọc tuyến theo xuất xứ hàng" className="w-44" value={route} onChange={(e) => setRoute(e.target.value as "" | "vn" | "global")}>
              <option value="">Cả hai tuyến</option>
              <option value="vn">{originLabels.vn} (Sale VN)</option>
              <option value="global">{originLabels.cn} (Sale Global)</option>
            </NativeSelect>
          )}
          <div role="group" aria-label="Chế độ xem" className="ml-auto inline-flex rounded-lg bg-muted p-0.5">
            {(
              [
                ["list", "Danh sách", List],
                ["kanban", "Kanban", KanbanSquare],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                aria-pressed={view === key}
                onClick={() => setView(key)}
                className={cn("flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-medium", view === key ? "bg-surface text-primary shadow-xs" : "text-muted-foreground hover:text-foreground")}
              >
                <Icon aria-hidden className="size-4" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === "list" ? (
        <div className="space-y-4">
          <DataTable
            columns={columns}
            rows={paging.slice}
            getRowId={(l) => l.messId}
            empty={
              <EmptyState
                title={filtering ? "Không có lead phù hợp" : "Chưa có lead"}
                description={filtering ? "Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm." : "Tạo lead đầu tiên để bắt đầu."}
              />
            }
          />
          <Pagination page={paging.page} pages={paging.pages} total={paging.total} pageSize={paging.pageSize} onPageChange={paging.setPage} />
        </div>
      ) : (
        <LeadKanban leads={filtered} onLost={setLostFor} />
      )}

      <LeadFormDialog open={creating} onOpenChange={setCreating} onCreated={(id) => router.push(`/crm/leads/${id}`)} />
      {lostFor && <LostReasonDialog messId={lostFor} open onOpenChange={(o) => !o && setLostFor(undefined)} />}
    </>
  );
}
