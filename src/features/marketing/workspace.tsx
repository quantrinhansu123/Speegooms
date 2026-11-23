"use client";

import { MarketingTargetReport } from "./target-report";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PageInfo } from "@speego/shared";
import { ServerPagination, useServerPagination } from "@/components/shared/server-pagination";
import { useListData } from "@/features/accounting/live/list-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Download, Upload, Pencil } from "lucide-react";
import { marketingChannels, marketingFormats, marketingKinds, marketingKindLabels, marketingStatuses, acceptanceOptions, marketingTaskSchema, canonicalPostUrl, deadlineLabel, contentEffect, isMarketingLeader, canOrderMarketing, manageableTargetDepartments, type MarketingKpiSettings, type MarketingMember, type MarketingTask, type MarketingReport } from "@speego/shared";
import { useSession } from "@/features/auth/session-provider";
import { api, fetchListPages } from "@/lib/api";
import { DataTable, type Column } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Field, NativeSelect, InlineAlert } from "@/components/shared/form-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { blankTask, dateValue } from "./import";
import { TaskKpiEditor } from "./task-kpi-editor";

type KpiGroup = { id: string; key: string; assigned: number; done: number; rate: number | null; late: number; overdue: number; ontime: number; unit?: string; direction?: string; tasks?: number; measured?: number; achieved?: number };
type Snapshot = { tasks: MarketingTask[]; reports: MarketingReport[]; users: MarketingMember[]; owners: string[]; groups: KpiGroup[] };
type Preview = { kind:"tasks"; rows:MarketingTask[]; errors:string[] } | {kind:"reports";rows:MarketingReport[];errors:string[]};
const message = (e:unknown) => e instanceof Error ? e.message : "Không thực hiện được";
const rate = (n:number|null) => n === null ? "Chưa giao KPI" : `${n.toLocaleString("vi-VN",{maximumFractionDigits:2})}%`;
export function MarketingWorkspace({ page }: {page:"tasks"|"reports"|"kpi"}) {
  const user=useSession(), writable=["admin","marketing","marketing-content","marketing-lead"].includes(user.role), approver=isMarketingLeader(user.role);
  const canOrder=canOrderMarketing(user.role), canReports=writable&&user.role!=="marketing-content";
  const [mine,setMine]=useState(false);
  const [settings,setSettings]=useState<MarketingKpiSettings>({version:0,types:[]});
  const [from,setFrom]=useState(""), [to,setTo]=useState("");
  const taskId=useSearchParams().get("task");
  const [data,setData]=useState<Snapshot>({tasks:[],reports:[],users:[],owners:[],groups:[]});
  const [ready,setReady]=useState(false), [error,setError]=useState(""), [notice,setNotice]=useState(""), [busy,setBusy]=useState(false);
  const [kind,setKind]=useState<MarketingTask["kind"]>("media"), [month,setMonth]=useState(""), [channel,setChannel]=useState(""), [owner,setOwner]=useState(""), [query,setQuery]=useState("");
  const [editing,setEditing]=useState<MarketingTask|null>(null), [preview,setPreview]=useState<Preview|null>(null);
  const [editingReport,setEditingReport]=useState<MarketingReport|null>(null);
  const [platform,setPlatform]=useState<MarketingReport["platform"]>("facebook"), [reportChannel,setReportChannel]=useState<MarketingReport["channel"]>(marketingChannels[0]), [observedOn,setObservedOn]=useState(dateValue(new Date())), [observedFrom,setObservedFrom]=useState(dateValue(new Date()));
  const [year,setYear]=useState(String(new Date().getFullYear())), [groupBy,setGroupBy]=useState("assignee"), [drill,setDrill]=useState<string|null>(null);
  const today=dateValue(new Date());
  const filterQuery = useMemo(() => new URLSearchParams({ view: page, kind: page === "tasks" ? kind : "", month, channel, owner, from, to, q: query, groupBy, today, mine:mine?"true":"" }).toString(), [page, kind, month, channel, owner, from, to, query, groupBy, today, mine]);
  const paging = useServerPagination(filterQuery);
  const { query: pageQuery, receive: receivePage } = paging;
  const requestVersion = useRef(0);
  const load=useCallback(async()=>{
    const version = ++requestVersion.current;
    setReady(false);
    try {
      const [body, config] = await Promise.all([api<Snapshot & { pagination: PageInfo }>(`/api/marketing?${filterQuery}${pageQuery}`), api<MarketingKpiSettings>("/api/marketing/settings")]);
      if (version === requestVersion.current) { setData({...body,tasks:body.tasks.map(t=>({...t,kpis:t.kpis??[]}))}); setSettings(config); receivePage(body.pagination); setError(""); }
    } catch(e) { if (version === requestVersion.current) setError(message(e)); }
    finally { if (version === requestVersion.current) setReady(true); }
  },[filterQuery,pageQuery,receivePage]);
  useEffect(()=>{
    let cancelled = false;
    queueMicrotask(()=>{if(!cancelled)void load();});
    return ()=>{cancelled=true;};
  },[load]);
  useEffect(()=>{
    if(!taskId||page!=="tasks")return;
    let live=true;
    api<{row:MarketingTask}>(`/api/marketing/tasks/${encodeURIComponent(taskId)}`).then(({row})=>{if(live){setKind(row.kind);setEditing({...row,kpis:row.kpis??[]});}}).catch(e=>{if(live)setError(message(e));});
    return ()=>{live=false;};
  },[taskId,page]);
  const run=async(fn:()=>Promise<void>)=>{setBusy(true);setError("");setNotice("");try{await fn();}catch(e){setError(message(e));}finally{setBusy(false);}};
  const tasks=data.tasks;
  const reports=data.reports;
  const groups=data.groups;
  const drillData = useListData<MarketingTask>("/api/marketing", "tasks", { view: "tasks", month, channel, owner, from, to, q: query, groupBy, drill: drill ?? "", today, mine:mine?"true":"" }, "Không tải được chi tiết KPI", true, page === "kpi" && Boolean(drill));
  const editable=(t:MarketingTask)=>approver||(canOrder&&t.createdById===user.id)||t.assigneeId===user.id;
  const canEditOrder=approver||(canOrder&&(!editing?.version||editing.createdById===user.id));
  const createTask=()=>{const t=blankTask(kind);if(user.role==="marketing-content"&&kind==="media")t.format="Video";setEditing({...t,createdById:user.id,createdByName:user.name});};
  const saveTask=()=>void run(async()=>{if(!editing)return;const parsed=marketingTaskSchema.safeParse(editing);if(!parsed.success)throw new Error(parsed.error.issues[0].message);await api("/api/marketing/tasks",{method:"POST",body:JSON.stringify({rows:[parsed.data]})});setEditing(null);await load();setNotice("Đã lưu giao việc");});
  const upload=(file:File, target:"tasks"|"reports")=>void run(async()=>{
    const m=await import("./import");
    if(target==="tasks"){
      const result=await m.importTasks(file,settings.types);
      const existing = await fetchListPages<MarketingTask>("/api/marketing?view=tasks", "tasks");
      const keys=new Set(existing.map(t=>[t.kind,t.month,t.channel,t.title,t.assignee,t.assignedOn,t.deadline].join("|")));
      const unique=result.rows.filter(t=>{const key=[t.kind,t.month,t.channel,t.title,t.assignee,t.assignedOn,t.deadline].join("|");if(keys.has(key))return false;keys.add(key);return true;});
      const mapped=unique.map(t=>{const matches=data.users.filter(u=>[u.email,u.name].some(s=>s.trim().toLowerCase()===t.assignee.trim().toLowerCase()));return {...t,assigneeId:matches.length===1?matches[0].id:"",assignee:matches.length===1?matches[0].name:t.assignee,acceptance:approver?t.acceptance:"Chưa nghiệm thu" as const};});
      setPreview({kind:target,rows:mapped,errors:result.errors});
      setNotice(`Đọc ${result.rows.length} dòng; bỏ qua ${result.rows.length-unique.length} việc đã tồn tại. Bỏ các dòng ví dụ trước khi lưu.${approver?"":" Kết quả nghiệm thu từ Excel sẽ chờ Admin duyệt lại."}`);
    }else {
      if((platform==="linkedin"&&reportChannel!=="LinkedIn SpeeGo")||(platform==="tiktok"&&!reportChannel.startsWith("TikTok"))) throw new Error("Chọn kênh phù hợp với nền tảng trước khi nhập");
      setPreview({kind:target,...await m.importReports(file,platform,reportChannel,observedOn,year,observedFrom)});
    }
  });
  const commitImport=()=>void run(async()=>{
    if(!preview?.rows.length)return;
    if(preview.kind==="tasks"&&preview.rows.some(t=>!t.assigneeId))throw new Error("Chọn tài khoản người nhận cho tất cả các dòng trước khi lưu");
    let remaining=preview.rows;
    while(remaining.length){
      await api(`/api/marketing/${preview.kind}`,{method:"POST",body:JSON.stringify({rows:remaining.slice(0,100)})});
      remaining=remaining.slice(100);
      setPreview({...preview,rows:remaining} as Preview);
    }
    setPreview(null);await load();setNotice("Đã nhập dữ liệu");
  });
  const exportRows=()=>void run(async()=>{
    const {exportExcel}=await import("./import");
    const url = `/api/marketing?${filterQuery}`;
    const exported = page === "kpi"
      ? (await fetchListPages<KpiGroup>(url, "groups")).map(g=>groupBy==="kpi"?{Nhóm:g.key,"Đơn vị":g.unit,"Điều kiện":g.direction==="at-most"?"Tối đa (trung bình)":"Tối thiểu (tổng)","Chỉ tiêu":g.assigned,"Kết quả đã nghiệm thu":g.done,"Số việc":g.tasks,"Có kết quả đã nghiệm thu":g.measured,"Đạt chỉ tiêu":g.achieved}:{Nhóm:g.key,"Số giao":g.assigned,"Nghiệm thu đạt":g.done,"Hoàn thành (%)":g.rate,"Đúng hạn":g.ontime,"Trễ hạn":g.late,"Quá hạn":g.overdue})
      : page === "reports"
        ? (await fetchListPages<MarketingReport>(url, "reports")).map(r=>({...r,"Đánh giá":contentEffect(r)}))
        : (await fetchListPages<MarketingTask>(url, "tasks")).map(t=>({...t,kpis:JSON.stringify(t.kpis??[]),"KPI được giao":t.status==="Hủy"?0:1,"KPI ghi nhận":t.status!=="Hủy"&&t.acceptance==="Đạt"?1:0,"Đánh giá deadline":deadlineLabel(t,today)}));
    exportExcel(`Marketing-${page}`, exported);
  });
  const columns:Column<MarketingTask>[]=[
    {key:"title",header:"Công việc",cell:t=><div className="min-w-56"><p className="font-medium">{t.title}</p><p className="text-xs text-muted-foreground">{t.month} · {t.channel} · {t.format}</p></div>},
    {key:"owner",header:"Phụ trách",cell:t=><div>{t.assignee}{t.collaborator&&<p className="text-xs text-muted-foreground">Phối hợp: {t.collaborator}</p>}</div>},
    {key:"orderer",header:"Người giao / Order",cell:t=>t.createdByName||"Chưa ghi nhận"},
    {key:"deadline",header:"Từ ngày – Đến ngày",cell:t=><div>{t.assignedOn} → {t.deadline}<p className={deadlineLabel(t,today).includes("hạn")&&["Trễ hạn","Quá hạn"].includes(deadlineLabel(t,today))?"text-red-600":"text-muted-foreground"}>{deadlineLabel(t,today)}</p></div>},
    {key:"status",header:"Trạng thái",cell:t=>t.status}, {key:"acceptance",header:"Nghiệm thu",cell:t=>t.acceptance},
    {key:"kpi",header:"KPI thực hiện / chỉ tiêu",cell:t=>(t.kpis??[]).length?<div className="min-w-48 space-y-1">{t.kpis.map(k=><p key={k.id} className="text-xs">{k.name}: {k.actual??"—"} / {k.direction==="at-most"?"≤":"≥"} {k.target} {k.unit}</p>)}</div>:"Chưa giao chỉ tiêu KPI"},
    {key:"links",header:"Sản phẩm",cell:t=><div className="flex flex-col gap-1">{t.assetUrl&&<a className="text-primary underline" href={t.assetUrl} target="_blank" rel="noreferrer">File final</a>}{t.postUrl&&<a className="text-primary underline" href={t.postUrl} target="_blank" rel="noreferrer">Bài đăng</a>}</div>},
    {key:"action",header:"Chi tiết",cell:t=><Button variant="outline" size="sm" disabled={busy} onClick={()=>setEditing(t)}><Pencil/> {writable&&editable(t)?"Cập nhật":"Xem"}</Button>},
  ];
  const metricColumns:Column<KpiGroup>[]=[
    {key:"key",header:"Loại KPI",cell:g=><button className="text-primary underline" onClick={()=>setDrill(g.id)}>{g.key}</button>},
    {key:"unit",header:"Đơn vị / Điều kiện",cell:g=>g.unit+" · "+(g.direction==="at-most"?"Tối đa · trung bình":"Tối thiểu · tổng")},
    {key:"target",header:"Chỉ tiêu",cell:g=>g.assigned.toLocaleString("vi-VN")},
    {key:"actual",header:"Kết quả đã nghiệm thu",cell:g=>g.measured?g.done.toLocaleString("vi-VN"):"Chưa có kết quả"},
    {key:"measured",header:"Có kết quả / Số việc",cell:g=>g.measured+" / "+g.tasks},
    {key:"achieved",header:"Việc đạt chỉ tiêu",cell:g=>g.achieved+" / "+g.tasks},
  ];
  const assigned = Number(paging.summary.assigned ?? 0), done = Number(paging.summary.done ?? 0);
  const total = { assigned, done, rate: assigned ? done / assigned * 100 : null };
  const downloadTemplate=()=>void run(async()=>{const {downloadTaskTemplate}=await import("./template");await downloadTaskTemplate(settings.types);});
  return <>
    <PageHeader title={page==="tasks"?"Giao việc Marketing":page==="reports"?"Báo cáo thực hiện":"Tổng hợp KPI Marketing"} description={page==="tasks"?"Giao việc theo khoảng ngày cho Media, Content, Ads và SEO; chọn loại KPI, chỉ tiêu và cập nhật kết quả thực tế.":page==="reports"?"Đối chiếu bài đăng qua link/ID, cập nhật số liệu lũy kế và đánh giá theo baseline.":"Hoàn thành theo nghiệm thu, tổng hợp từ file giao việc gốc."}/>
    <nav className="mb-5 flex flex-wrap gap-2">{[["tasks","giao-viec","Giao việc"],["reports","bao-cao-thuc-hien","Báo cáo thực hiện"],["kpi","tong-hop-kpi","Tổng hợp KPI"]].map(([id,url,label])=><Button key={id} nativeButton={false} variant={page===id?"default":"outline"} render={<Link href={`/marketing/${url}`}/>}>{label}</Button>)}{manageableTargetDepartments(user.role).includes("marketing")&&<Button nativeButton={false} variant="outline" render={<Link href="/giao-muc-tieu"/>}>Giao mục tiêu tháng, tuần</Button>}</nav>
    {page==="kpi"&&<MarketingTargetReport/>}
    {page!=="reports"&&<div className="mb-4 flex gap-2"><Button variant={mine?"outline":"default"} onClick={()=>setMine(false)}>Tất cả công việc</Button><Button variant={mine?"default":"outline"} onClick={()=>{setMine(true);setOwner("");}}>Việc của tôi</Button></div>}
    {error&&<div className="mb-4"><InlineAlert>{error} <Button variant="outline" size="sm" onClick={()=>void load()}>Tải lại</Button></InlineAlert></div>}{notice&&<p role="status" className="mb-4 rounded-lg border bg-muted p-3 text-sm">{notice}</p>}
    <div className="mb-5 flex flex-wrap items-end gap-3"><Field label={page==="reports"?"Ngày đo từ ngày":"Thực hiện từ ngày"} htmlFor="mk-from"><Input id="mk-from" type="date" max={to||undefined} value={from} onChange={e=>{setFrom(e.target.value);setDrill(null);}}/></Field><Field label="Đến ngày" htmlFor="mk-to"><Input id="mk-to" type="date" min={from||undefined} value={to} onChange={e=>{setTo(e.target.value);setDrill(null);}}/></Field><Field label="Tháng" htmlFor="mk-month"><Input id="mk-month" type="month" value={month} onChange={e=>{setMonth(e.target.value);setDrill(null);}}/></Field><Field label="Kênh / Page" htmlFor="mk-channel"><NativeSelect id="mk-channel" value={channel} onChange={e=>setChannel(e.target.value)}><option value="">Tất cả kênh</option>{marketingChannels.map(v=><option key={v}>{v}</option>)}</NativeSelect></Field>{page!=="reports"&&<Field label="Phụ trách" htmlFor="mk-owner"><NativeSelect id="mk-owner" value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Tất cả nhân sự</option>{data.users.map(u=><option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}{data.owners.filter(v=>!data.users.some(u=>u.name===v)).map(v=><option key={v} value={v}>{v} (chưa gán tài khoản)</option>)}</NativeSelect></Field>}<Field label="Tìm kiếm" htmlFor="mk-q"><Input id="mk-q" placeholder="Tên công việc, nội dung…" value={query} onChange={e=>setQuery(e.target.value)}/></Field><Button disabled={!ready||busy} variant="outline" onClick={exportRows}><Download/> Xuất Excel</Button></div>
    {page==="tasks"&&<div className="mb-4 flex flex-wrap gap-2">{marketingKinds.map(v=><Button key={v} variant={kind===v?"default":"outline"} onClick={()=>setKind(v)}>{marketingKindLabels[v]}</Button>)}<Button variant="outline" disabled={busy} onClick={downloadTemplate}><Download/> Tải mẫu giao việc</Button>{canOrder&&<><Button disabled={busy||!ready} onClick={createTask}><Plus/> {user.role==="marketing-content"&&kind==="media"?"Order video":"Tạo giao việc"}</Button><label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"><Upload size={16}/> Nhập file giao việc<input aria-label="Nhập file giao việc" className="hidden" type="file" accept=".xlsx" disabled={busy||!ready} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f,"tasks");e.target.value="";}}/></label></>}</div>}
    {page==="reports"&&canReports&&<div className="mb-5 space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="font-medium">Nhập báo cáo nội dung</p><Button variant="outline" disabled={busy} onClick={()=>void run(async()=>{const {downloadReportTemplate}=await import("./template");await downloadReportTemplate(platform);})}><Download/> Tải mẫu báo cáo</Button></div><div className="flex flex-wrap items-end gap-3"><Field label="Nền tảng" htmlFor="mk-platform"><NativeSelect id="mk-platform" value={platform} onChange={e=>{const v=e.target.value as typeof platform;setPlatform(v);setReportChannel(v==="linkedin"?"LinkedIn SpeeGo":v==="tiktok"?"TikTok Anh Phúc":marketingChannels[0]);}}>{["facebook","tiktok","linkedin"].map(v=><option key={v}>{v}</option>)}</NativeSelect></Field><Field label="Kênh (TikTok / LinkedIn)" htmlFor="mk-rc"><NativeSelect id="mk-rc" value={reportChannel} onChange={e=>setReportChannel(e.target.value as typeof reportChannel)}>{marketingChannels.map(v=><option key={v}>{v}</option>)}</NativeSelect></Field><Field label="Ngày đo từ ngày" htmlFor="mk-observed-from"><Input id="mk-observed-from" type="date" required max={observedOn||undefined} value={observedFrom} onChange={e=>setObservedFrom(e.target.value)}/></Field><Field label="Ngày đo đến ngày" htmlFor="mk-date"><Input id="mk-date" type="date" required min={observedFrom||undefined} value={observedOn} onChange={e=>setObservedOn(e.target.value)}/></Field><Field label="Năm đăng (TikTok thiếu năm)" htmlFor="mk-year"><Input id="mk-year" type="number" min="2000" max="2100" value={year} onChange={e=>setYear(e.target.value)}/></Field><Input aria-label="Chọn báo cáo nền tảng" type="file" accept=".csv,.xls,.xlsx,.zip" disabled={busy||!ready} className="max-w-72" onChange={e=>{const f=e.target.files?.[0];if(f)upload(f,"reports");e.target.value="";}}/></div><p className="text-sm text-muted-foreground">Facebook dùng kênh trong file. TikTok dùng Content.xlsx trong ZIP; Overview/Followers/Viewers không dùng để tính số việc. Số lũy kế mới thay thế bản cũ, không cộng dồn.</p></div>}
    {page==="tasks"&&<DataTable rows={tasks} loading={!ready} columns={columns} getRowId={t=>t.id}/>}
    {page==="reports"&&<DataTable rows={reports} loading={!ready} getRowId={r=>`${r.platform}:${r.channel}:${r.postId}`} columns={[
      {key:"title",header:"Bài đăng",cell:r=><div className="max-w-80"><a className="text-primary underline" href={r.postUrl} target="_blank" rel="noreferrer">{r.title.slice(0,100)||r.postId}</a><p className="text-xs">{r.channel} · {r.format||"Chưa phân loại"}</p></div>},
      {key:"date",header:"Ngày đăng / đo",cell:r=><div>{r.publishedOn}<p className="text-xs text-muted-foreground">Đo: {r.observedFrom||r.observedOn} → {r.observedOn}</p></div>},
      {key:"views",header:"Lượt xem / Impressions",cell:r=>r.views?.toLocaleString("vi-VN")??"Thiếu số liệu"}, {key:"interactions",header:"Tương tác",cell:r=>r.interactions??"Thiếu số liệu"},
      {key:"effect",header:"Baseline",cell:r=>contentEffect(r)},
      {key:"edit",header:"Phân loại",cell:r=>canReports?<Button size="sm" variant="outline" onClick={()=>setEditingReport(r)}>Sửa định dạng</Button>:r.format},
      {key:"match",header:"Giao việc liên kết",cell:r=>{const matched=data.tasks.filter(t=>t.postUrl&&canonicalPostUrl(t.postUrl)===canonicalPostUrl(r.postUrl));return matched.length?matched.map(t=>`${marketingKindLabels[t.kind]}: ${t.title}`).join("; "):"Chưa ghép — cập nhật link bài trong giao việc";}},
    ]}/>}
    {page==="kpi"&&<>{groupBy!=="kpi"&&<div className="mb-5 grid gap-3 sm:grid-cols-4">{[["Số giao",total.assigned],["Nghiệm thu đạt",total.done],["Còn thiếu",total.assigned-total.done],["Hoàn thành",rate(total.rate)]].map(([label,value])=><div className="rounded-xl border bg-card p-4" key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>}<div className="mb-4 flex flex-wrap items-end gap-3"><Field label="Nhóm theo" htmlFor="mk-group"><NativeSelect id="mk-group" value={groupBy} onChange={e=>{setGroupBy(e.target.value);setDrill(null);}}><option value="assignee">Nhân sự</option><option value="channel">Kênh</option><option value="kind">Media / Content / Ads / SEO</option><option value="kpi">Loại KPI</option></NativeSelect></Field><p className="text-sm text-muted-foreground">Bấm vào nhóm để xem công việc. Loại KPI tổng hợp riêng từng đơn vị; KPI tối đa hiển thị trung bình, KPI tối thiểu hiển thị tổng.</p></div><DataTable rows={groups} loading={!ready} getRowId={g=>g.id} columns={groupBy==="kpi"?metricColumns:[
      {key:"key",header:"Nhóm",cell:g=><button className="text-primary underline" onClick={()=>setDrill(g.id)}>{g.key}</button>}, {key:"assigned",header:"Số giao",cell:g=>g.assigned},{key:"done",header:"Nghiệm thu đạt",cell:g=>g.done},{key:"rate",header:"Hoàn thành",cell:g=>rate(g.rate)},{key:"ontime",header:"Đạt & đúng hạn",cell:g=>g.ontime},{key:"late",header:"Trễ hạn",cell:g=>g.late},{key:"overdue",header:"Quá hạn",cell:g=>g.overdue},
    ]}/>{drill&&<div className="mt-6"><h2 className="mb-3 text-lg font-semibold">Chi tiết: {groups.find(g=>g.id===drill)?.key||drill}</h2><DataTable rows={drillData.rows} loading={drillData.loading} columns={columns} getRowId={t=>t.id}/><ServerPagination paging={drillData.paging} loading={drillData.loading}/>{drillData.error&&<InlineAlert>{drillData.error}</InlineAlert>}</div>}</>}
    <ServerPagination paging={paging} loading={!ready}/>
    {editingReport&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setEditingReport(null);}}><DialogContent><DialogHeader><DialogTitle>Phân loại nội dung</DialogTitle><DialogDescription>LinkedIn có thể không xuất định dạng. Chọn đúng định dạng để so với baseline.</DialogDescription></DialogHeader><p className="text-sm">{editingReport.title.slice(0,160)}</p><Field label="Định dạng" htmlFor="report-format"><NativeSelect id="report-format" value={editingReport.format} onChange={e=>setEditingReport({...editingReport,format:e.target.value})}>{[...new Set([editingReport.format,"Ảnh","Video","Bài text","Carousel","Infographic","Khác"])].map(v=><option key={v} value={v}>{v||"Chưa phân loại"}</option>)}</NativeSelect></Field><Button disabled={busy} onClick={()=>void run(async()=>{await api("/api/marketing/reports",{method:"POST",body:JSON.stringify({rows:[editingReport]})});setEditingReport(null);await load();setNotice("Đã cập nhật định dạng");})}>Lưu phân loại</Button></DialogContent></Dialog>}
    {preview&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setPreview(null);}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Xem trước import · {preview.rows.length} dòng</DialogTitle><DialogDescription>Kiểm tra dữ liệu trước khi lưu. Bỏ dòng ví dụ hoặc dòng không cần nhập.</DialogDescription></DialogHeader>{preview.errors.length>0&&<InlineAlert>{preview.errors.slice(0,15).map((s,i)=><p key={i}>{s}</p>)}{preview.errors.length>15&&<p>Và {preview.errors.length-15} lỗi khác. Sửa file để nhập đủ dữ liệu.</p>}</InlineAlert>}<div className="max-h-80 overflow-auto">{preview.rows.map((r,i)=><div key={"id" in r?r.id:`${r.channel}:${r.postId}:${i}`} className="flex items-start gap-3 border-b py-2 text-sm"><Button variant="outline" size="sm" disabled={busy} onClick={()=>setPreview({...preview,rows:preview.rows.filter((_,j)=>j!==i)} as Preview)}>Bỏ dòng</Button><div>{r.title} · {r.channel}<br/>{"assignee" in r?<><p>{r.assignee} · {r.deadline} · {r.acceptance}</p><NativeSelect aria-label={`Người nhận: ${r.title}`} disabled={busy} value={r.assigneeId||""} onChange={e=>{if(preview.kind!=="tasks")return;const member=data.users.find(u=>u.id===e.target.value);setPreview({...preview,rows:preview.rows.map((t,j)=>j===i?{...t,assigneeId:member?.id||"",assignee:member?.name||t.assignee}:t)});}}><option value="">Chọn tài khoản nhận việc</option>{data.users.map(u=><option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}</NativeSelect></>:`${r.publishedOn} · ${r.views??"?"} lượt xem`}</div></div>)}</div>{error&&<InlineAlert>{error}</InlineAlert>}<Button disabled={busy||!preview.rows.length} onClick={commitImport}>{busy?"Đang lưu…":"Lưu các dòng đã chọn"}</Button></DialogContent></Dialog>}
    {editing&&<Dialog open onOpenChange={open=>{if(!open&&!busy)setEditing(null);}}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{editing.version?"Chi tiết giao việc":"Tạo giao việc"} · {marketingKindLabels[editing.kind]}</DialogTitle><DialogDescription>Chọn tài khoản người nhận. Giao mới/giao lại sẽ gửi thông báo nội bộ. Admin/Leader Marketing được nghiệm thu.</DialogDescription></DialogHeader><form onSubmit={e=>{e.preventDefault();saveTask();}} className="space-y-4"><fieldset disabled={!writable||busy||(Boolean(editing.version)&&!editable(editing))} className="grid gap-4 sm:grid-cols-2">{([
      ["month","Tháng kế hoạch","month"],["title",editing.kind==="media"?"Tên video / Chủ đề":editing.kind==="ads"?"Tên chiến dịch / Công việc":editing.kind==="seo"?"Tên hạng mục / Công việc":"Tên bài / Chủ đề","text"],["assignedOn","Từ ngày","date"],["deadline","Đến ngày","date"],["completedOn",editing.kind==="media"?"Ngày bàn giao thực tế":"Ngày hoàn thành thực tế","date"],["assetUrl",editing.kind==="media"?"Link video final":editing.kind==="ads"?"Link chiến dịch":editing.kind==="seo"?"Link website / Báo cáo":"File nội dung (link)","url"],["postUrl","Link bài đăng để ghép báo cáo","url"],...(editing.kind==="media"?[["size","Size","text"],["collaborator","Content phối hợp","text"]]:[["pillar","Tuyến nội dung","text"]])
    ] as [keyof MarketingTask,string,string][]).map(([key,label,type])=><Field key={key} label={label} htmlFor={`edit-${key}`}><Input id={`edit-${key}`} disabled={!canEditOrder&&!["completedOn","assetUrl","postUrl"].includes(key)} type={type} required={["month","title","assignedOn","deadline"].includes(key)} min={key==="deadline"||key==="completedOn"?editing.assignedOn:undefined} max={key==="assignedOn"?editing.deadline:undefined} value={String(editing[key])} onChange={e=>setEditing({...editing,[key]:e.target.value})}/></Field>)}<Field label="Kênh / Page" htmlFor="edit-channel"><NativeSelect id="edit-channel" disabled={!canEditOrder} value={editing.channel} onChange={e=>setEditing({...editing,channel:e.target.value as MarketingTask["channel"]})}>{marketingChannels.map(v=><option key={v}>{v}</option>)}</NativeSelect></Field><Field label="Định dạng" htmlFor="edit-format"><NativeSelect id="edit-format" disabled={!canEditOrder} value={editing.format} onChange={e=>setEditing({...editing,format:e.target.value})}>{(user.role==="marketing-content"&&editing.kind==="media"?["Video"]:marketingFormats[editing.kind]).map(v=><option key={v}>{v}</option>)}</NativeSelect></Field><Field label="Giao cho" htmlFor="edit-owner" required><NativeSelect id="edit-owner" required disabled={!canEditOrder} value={editing.assigneeId||""} onChange={e=>{const member=data.users.find(u=>u.id===e.target.value);setEditing({...editing,assigneeId:member?.id||"",assignee:member?.name||""});}}><option value="">{editing.assignee&&!editing.assigneeId?`${editing.assignee} — cần chọn tài khoản`:"Chọn người nhận việc"}</option>{data.users.map(u=><option key={u.id} value={u.id}>{u.name} · {u.email}</option>)}</NativeSelect></Field><Field label="Trạng thái" htmlFor="edit-status"><NativeSelect id="edit-status" value={editing.status} onChange={e=>setEditing({...editing,status:e.target.value})}>{marketingStatuses[editing.kind].map(v=><option key={v}>{v}</option>)}</NativeSelect></Field><Field label="Nghiệm thu" htmlFor="edit-acceptance"><NativeSelect id="edit-acceptance" disabled={!approver} value={editing.acceptance} onChange={e=>setEditing({...editing,acceptance:e.target.value as MarketingTask["acceptance"]})}>{acceptanceOptions.map(v=><option key={v}>{v}</option>)}</NativeSelect></Field>{([['brief',editing.kind==="media"?"Nội dung order":editing.kind==="ads"?"Brief Ads":editing.kind==="seo"?"Brief SEO":"Brief bài"],['note','Ghi chú / Vướng mắc']] as const).map(([key,label])=><Field key={key} label={label} htmlFor={`edit-${key}`}><Textarea id={`edit-${key}`} disabled={key==="brief"&&!canEditOrder} rows={3} maxLength={4000} value={editing[key]} onChange={e=>setEditing({...editing,[key]:e.target.value})}/></Field>)}<div className="sm:col-span-2"><TaskKpiEditor task={editing} types={settings.types} canEditOrder={canEditOrder} onChange={setEditing}/>{user.role==="admin"&&<Link className="text-sm text-primary underline" href="/cai-dat">Cấu hình loại KPI trong Cài đặt</Link>}</div></fieldset>{error&&<InlineAlert>{error}</InlineAlert>}{writable&&(!editing.version||editable(editing))&&<Button disabled={busy} type="submit">{busy?"Đang lưu…":editing.version?"Lưu cập nhật":"Giao việc"}</Button>}</form></DialogContent></Dialog>}
  </>;
}
