import type { Request, Response } from "express";
import type pg from "pg";
import { z } from "zod";
import { marketingTaskSchema, marketingReportSchema, canonicalPostUrl, marketingTeamRoles, isMarketingLeader, canOrderMarketing, type MarketingMember, type MarketingTask, type MarketingReport } from "@speego/shared";
import { AppError } from "../lib/errors";
import { queryPage, readPagination } from "../lib/pagination";

export class MarketingController {
  constructor(private readonly pool: pg.Pool | null) {}
  private db() { if (!this.pool) throw new AppError(503, "UNAVAILABLE", "Marketing cần kết nối Postgres"); return this.pool; }
  private actor(req: Request, write = false) {
    const u = req.user;
    if (!u || !(write ? marketingTeamRoles : [...marketingTeamRoles,"ban-gd"]).includes(u.role)) throw new AppError(403, "FORBIDDEN", "Không có quyền Marketing");
    return u;
  }
  list = async (req: Request, res: Response) => {
    const actor = this.actor(req);
    const parsed = z.object({
      view: z.enum(["tasks", "reports", "kpi"]).default("tasks"), kind: z.enum(["", "media", "content"]).default(""),
      month: z.string().regex(/^$|^\d{4}-(0[1-9]|1[0-2])$/).default(""), channel: z.string().max(200).default(""),
      owner: z.string().max(200).default(""), q: z.string().max(200).default(""),
      groupBy: z.enum(["assignee", "channel", "kind"]).default("assignee"), drill: z.string().max(200).default(""),
      today: z.iso.date().default(new Date().toISOString().slice(0, 10)),
      mine: z.enum(["", "true"]).default(""),
    }).safeParse(req.query);
    if (!parsed.success) throw new AppError(400, "INVALID", "Bộ lọc Marketing không hợp lệ");
    const f = parsed.data;
    const page = readPagination(req);
    const values = [f.month, f.channel, f.owner, f.q, f.kind, f.today, f.drill, f.mine === "true" ? actor.id : ""];
    const group = f.groupBy === "kind" ? "case when data->>'kind' = 'media' then 'Media' else 'Content' end" : f.groupBy === "assignee" ? "coalesce(nullif(data->>'assigneeId',''),data->>'assignee')" : "data->>'channel'";
    const source = `select id::text, data || jsonb_build_object('version', version) as data, updated_at
      from app.marketing_tasks where ($1 = '' or data->>'month' = $1) and ($2 = '' or data->>'channel' = $2)
        and ($3 = '' or data->>'assigneeId' = $3 or (coalesce(data->>'assigneeId','') = '' and data->>'assignee' = $3))
        and ($4 = '' or strpos(lower(concat_ws(' ', data->>'title', data->>'brief', data->>'note')), lower($4)) > 0)
        and ($5 = '' or data->>'kind' = $5) and ($8::text = '' or data->>'assigneeId' = $8)
        and $6::text is not null and $7::text is not null`;
    const summary = `jsonb_build_object('assigned', count(*) filter (where data->>'status' <> 'Hủy'),
      'done', count(*) filter (where data->>'status' <> 'Hủy' and data->>'acceptance' = 'Đạt'))`;
    const [users, owners] = await Promise.all([
      this.db().query("select ma_nguoi_dung as id, ho_ten as name, thu_dien_tu as email, vai_tro as role from public.nguoi_dung where vai_tro = any($1::text[]) order by ho_ten", [marketingTeamRoles]),
      this.db().query<{ name: string }>("select distinct data->>'assignee' as name from app.marketing_tasks order by name"),
    ]);
    const common = { users: users.rows, owners: owners.rows.map(row => row.name) };
    if (f.view === "reports") {
      const result = await queryPage<{ id: string; data: MarketingReport }>(this.db(),
        `select concat_ws(':', platform, channel, post_id) as id, data, updated_at from app.marketing_reports
         where ($1 = '' or starts_with(data->>'publishedOn', $1)) and ($2 = '' or channel = $2)
           and ($3 = '' or strpos(lower(data->>'title'), lower($3)) > 0)`, [f.month, f.channel, f.q], page, { orderBy: "updated_at desc, id" });
      const urls = new Set(result.rows.map(row => canonicalPostUrl(row.data.postUrl)));
      const links = urls.size ? (await this.db().query<{ data: Pick<MarketingTask, "kind" | "title" | "postUrl"> }>(
        "select jsonb_build_object('kind', data->>'kind', 'title', data->>'title', 'postUrl', data->>'postUrl') as data from app.marketing_tasks where coalesce(data->>'postUrl', '') <> ''",
      )).rows.filter(row => urls.has(canonicalPostUrl(row.data.postUrl))).map(row => row.data) : [];
      res.json({ ...common, tasks: links, reports: result.rows.map(row => row.data), groups: [], pagination: result.pagination });
      return;
    }
    if (f.view === "kpi") {
      const grouped = `select ${group} as id, ${f.groupBy === "assignee" ? "min(data->>'assignee')" : group} as key,
        (count(*) filter (where data->>'status' <> 'Hủy'))::int as assigned,
        (count(*) filter (where data->>'status' <> 'Hủy' and data->>'acceptance' = 'Đạt'))::int as done,
        (count(*) filter (where data->>'status' <> 'Hủy' and nullif(data->>'completedOn', '') > data->>'deadline'))::int as late,
        (count(*) filter (where data->>'status' <> 'Hủy' and coalesce(data->>'completedOn', '') = '' and data->>'deadline' < $6))::int as overdue,
        (count(*) filter (where data->>'status' <> 'Hủy' and data->>'acceptance' = 'Đạt' and nullif(data->>'completedOn', '') <= data->>'deadline'))::int as ontime
        from (${source}) tasks group by ${group}`;
      const result = await queryPage<{ id: string; key: string; assigned: number; done: number }>(this.db(), grouped, values, page, {
        orderBy: "key", summary: "jsonb_build_object('assigned', coalesce(sum(assigned), 0), 'done', coalesce(sum(done), 0))",
      });
      res.json({ ...common, tasks: [], reports: [], groups: result.rows.map(row => ({ ...row, rate: row.assigned ? row.done / row.assigned * 100 : null })), pagination: result.pagination });
      return;
    }
    const result = await queryPage<{ id: string; data: MarketingTask }>(this.db(), `${source} and ($7 = '' or ${group} = $7)`, values, page, { orderBy: "updated_at desc, id", summary });
    res.json({ ...common, tasks: result.rows.map(row => row.data), reports: [], groups: [], pagination: result.pagination });
  };
  task = async (req: Request, res: Response) => {
    this.actor(req);
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) throw new AppError(404,"NOT_FOUND","Không tìm thấy giao việc");
    const result = await this.db().query("select data || jsonb_build_object('version',version) as data from app.marketing_tasks where id=$1",[id.data]);
    if (!result.rows[0]) throw new AppError(404,"NOT_FOUND","Không tìm thấy giao việc");
    res.json({ row: result.rows[0].data });
  };
  saveTasks = async (req: Request, res: Response) => {
    const actor = this.actor(req, true);
    const parsed = z.array(marketingTaskSchema).min(1).max(500).safeParse(req.body.rows);
    if (!parsed.success) throw new AppError(400, "INVALID", parsed.error.issues[0]!.message);
    if (new Set(parsed.data.map(t => t.id)).size !== parsed.data.length) throw new AppError(400, "INVALID", "Trùng mã giao việc");
    const c = await this.db().connect();
    try {
      await c.query("begin");
      const members = (await c.query<MarketingMember>("select ma_nguoi_dung as id, ho_ten as name, thu_dien_tu as email, vai_tro as role from public.nguoi_dung where vai_tro = any($1::text[])",[marketingTeamRoles])).rows;
      for (const t of parsed.data) {
        await c.query("select pg_advisory_xact_lock(hashtext($1))", [t.id]);
        const old = await c.query<{data: MarketingTask; version: number}>("select data, version from app.marketing_tasks where id=$1 for update", [t.id]);
        const existing = old.rows[0];
        if (!existing && t.version !== 0) throw new AppError(409, "CONFLICT", "Không tìm thấy bản giao việc đang sửa");
        if (existing && existing.version !== t.version) throw new AppError(409, "CONFLICT", "Dữ liệu đã thay đổi; tải lại trước khi sửa");
        if (!isMarketingLeader(actor.role) && t.acceptance !== (existing?.data.acceptance ?? "Chưa nghiệm thu")) throw new AppError(403, "FORBIDDEN", "Chỉ Admin/Leader được nghiệm thu");
        const oldTask = existing?.data;
        const author = oldTask?.createdById;
        const isOrderer = canOrderMarketing(actor.role) && (!oldTask || author === actor.id);
        if (!isMarketingLeader(actor.role) && !isOrderer) {
          if (!oldTask || oldTask.assigneeId !== actor.id) throw new AppError(403,"FORBIDDEN","Chỉ được cập nhật việc được giao cho bạn");
          const progress = new Set(["version","status","completedOn","assetUrl","postUrl","note"]);
          for (const key of Object.keys(t) as (keyof MarketingTask)[]) {
            if (!progress.has(key) && (t[key] ?? "") !== (oldTask[key] ?? "")) throw new AppError(403,"FORBIDDEN","Người nhận chỉ được cập nhật tiến độ, sản phẩm và ghi chú");
          }
        }
        if (actor.role === "marketing-content" && isOrderer && t.kind === "media" && t.format !== "Video") throw new AppError(403,"FORBIDDEN","Content được order Media định dạng Video");
        const matched = members.filter(u => t.assigneeId ? u.id === t.assigneeId : [u.name,u.email].some(v=>v.trim().toLowerCase()===t.assignee.trim().toLowerCase()));
        if (matched.length !== 1) throw new AppError(400,"INVALID",`Chọn tài khoản nhận việc cụ thể cho: ${t.title}. Tên/email không tồn tại hoặc bị trùng.`);
        const member = matched[0]!;
        t.assigneeId = member.id; t.assignee = member.name;
        t.createdById = oldTask?.createdById || (!oldTask ? actor.id : "");
        t.createdByName = oldTask?.createdByName || (!oldTask ? actor.name : "");
        await c.query(`insert into app.marketing_tasks(id,data,updated_by) values($1,$2,$3)
          on conflict(id) do update set data=excluded.data, version=marketing_tasks.version+1, updated_by=excluded.updated_by,updated_at=now()`, [t.id, t, actor.id]);
        if (!oldTask || oldTask.assigneeId !== t.assigneeId) await c.query(
          `insert into app.thong_bao(nguoi_nhan_id,nguoi_gui_id,loai,tieu_de,noi_dung,duong_dan,tham_chieu_loai,tham_chieu_id,da_xem)
           values($1,$2,'marketing.assignment','Bạn được giao việc Marketing',$3,$4,'marketing-task',$5,false)`,
          [t.assigneeId,actor.id,`${actor.name} giao: ${t.title}. Deadline: ${t.deadline}.`,`/marketing/giao-viec?task=${t.id}`,t.id]);
      }
      await c.query("commit"); res.json({ count: parsed.data.length });
    } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
  };
  saveReports = async (req: Request, res: Response) => {
    const actor = this.actor(req, true);
    if (actor.role === "marketing-content") throw new AppError(403,"FORBIDDEN","Content chỉ được order và cập nhật công việc; không quản lý báo cáo kênh");
    const parsed = z.array(marketingReportSchema).min(1).max(1500).safeParse(req.body.rows);
    if (!parsed.success) throw new AppError(400, "INVALID", parsed.error.issues[0]!.message);
    const c = await this.db().connect();
    try {
      await c.query("begin");
      for (const item of parsed.data) {
        const r: MarketingReport = { ...item, postUrl: canonicalPostUrl(item.postUrl) };
        await c.query(`insert into app.marketing_reports(platform,channel,post_id,data,updated_by) values($1,$2,$3,$4,$5)
          on conflict(platform,channel,post_id) do update set data=excluded.data,updated_by=excluded.updated_by,updated_at=now()
          where excluded.data->>'observedOn' >= marketing_reports.data->>'observedOn'`, [r.platform,r.channel,r.postId,r,actor.id]);
      }
      await c.query("commit"); res.json({ count: parsed.data.length });
    } catch (e) { await c.query("rollback"); throw e; } finally { c.release(); }
  };
}
