import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID } from "node:crypto";
import pg from "pg";
import type { Request, Response } from "express";
import { MarketingController } from "./marketing.controller";
import type { MarketingKpiSettings, MarketingTask } from "@speego/shared";

const connectionString = process.env.MARKETING_TEST_DATABASE_URL;
test("Postgres Marketing: date overlap, Ads/SEO, per-type aggregation and newest report", { skip: !connectionString }, async () => {
  const url = new URL(connectionString!);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname) && url.pathname === "/speego_local", "Use the dedicated local demo DB");
  const pool = new pg.Pool({ connectionString, ssl: false });
  const ids: string[] = [];
  const tag = `Marketing integration ${randomUUID()}`;
  const reportId = randomUUID();
  try {
    const actor = (await pool.query("select ma_nguoi_dung as id, ho_ten as name, vai_tro as role from public.nguoi_dung where vai_tro='admin' limit 1")).rows[0];
    assert.ok(actor, "Local demo Admin must exist");
    const controller = new MarketingController(pool);
    const request = (body = {}, query = {}) => ({ user: actor, body, query } as unknown as Request);
    const call = async (handler: (req: Request, res: Response) => Promise<void>, body = {}, query = {}) => {
      let output: any;
      await handler(request(body, query), { json: (value: unknown) => { output = value; } } as Response);
      return output;
    };
    const settings: MarketingKpiSettings = await call(controller.settings);
    const countType = settings.types.find(t => t.kind === "ads" && t.direction === "at-least")!;
    const costType = settings.types.find(t => t.kind === "ads" && t.direction === "at-most")!;
    const seoType = settings.types.find(t => t.kind === "seo")!;
    assert.ok(countType && costType && seoType);
    const goal = (type: typeof countType, target: number, actual: number | null) => ({ id:type.id, name:type.name, unit:type.unit, direction:type.direction, target, actual });
    const create = (patch: Partial<MarketingTask>): MarketingTask => {
      const id = randomUUID(); ids.push(id);
      return { id, version:0, kind:"ads", month:"2026-11", channel:"Khác", title:tag, brief:"", format:"Facebook Ads", size:"", pillar:"", assignee:actor.name, assigneeId:actor.id, createdById:"", createdByName:"", collaborator:"", assignedOn:"2026-11-01", deadline:"2026-11-20", completedOn:"", status:"Đang chạy", acceptance:"Chưa nghiệm thu", assetUrl:"", postUrl:"", note:"", kpis:[], ...patch };
    };
    await call(controller.saveTasks, { rows:[
      create({ acceptance:"Đạt", completedOn:"2026-11-19", kpis:[goal(countType,4,5),goal(costType,100,0)] }),
      create({ assignedOn:"2026-11-21", deadline:"2026-12-02", kpis:[goal(countType,6,20),goal(costType,80,60)] }),
      create({ status:"Hủy", kpis:[goal(countType,100,100)] }),
      create({ kind:"seo", format:"SEO website", status:"Đang thực hiện", kpis:[goal(seoType,10,null)] }),
    ] });
    const filtered = await call(controller.list, {}, { view:"tasks",q:tag,from:"2026-11-20",to:"2026-11-20" });
    assert.equal(filtered.tasks.length,3);
    assert.ok(filtered.tasks.every((t: MarketingTask) => t.assignedOn <= "2026-11-20" && t.deadline >= "2026-11-20"));
    const metrics = await call(controller.list, {}, { view:"kpi",groupBy:"kpi",q:tag });
    const counts = metrics.groups.find((g: any) => g.id === countType.id);
    assert.equal(counts.assigned,10); assert.equal(counts.done,5); assert.equal(counts.tasks,2); assert.equal(counts.measured,1); assert.equal(counts.achieved,1);
    const costs = metrics.groups.find((g: any) => g.id === costType.id);
    assert.equal(costs.assigned,90); assert.equal(costs.done,0); assert.equal(costs.measured,1); assert.equal(costs.achieved,1);
    const drill = await call(controller.list, {}, { view:"tasks",groupBy:"kpi",drill:countType.id,q:tag });
    assert.equal(drill.tasks.length,2); assert.ok(drill.tasks.every((t: MarketingTask) => t.status !== "Hủy"));
    const kinds = await call(controller.list, {}, { view:"kpi",groupBy:"kind",q:tag });
    assert.deepEqual(kinds.groups.map((g: any) => g.key),["Ads","SEO"]);
    const report = { platform:"facebook", channel:"Khác", postId:reportId, postUrl:`https://facebook.com/${reportId}`, title:tag, format:"Video", publishedOn:"2026-10-01", observedFrom:"2026-11-01", observedOn:"2026-11-16", views:10, interactions:0 };
    await call(controller.saveReports,{rows:[report]});
    await call(controller.saveReports,{rows:[{...report, observedOn:"2026-11-15",views:999}]});
    const reports = await call(controller.list, {}, {view:"reports",q:tag,from:"2026-11-05",to:"2026-11-05"});
    assert.equal(reports.reports.length,1);assert.equal(reports.reports[0].observedFrom,"2026-11-01");assert.equal(reports.reports[0].views,10);
    const outside = await call(controller.list, {}, {view:"reports",q:tag,from:"2026-11-17",to:"2026-11-18"});
    assert.equal(outside.reports.length,0);
    await assert.rejects(() => call(controller.list,{}, {from:"2026-11-20",to:"2026-11-01"}),/Từ ngày/);
    const stored = filtered.tasks.find((t: MarketingTask) => t.acceptance === "Đạt") as MarketingTask;
    assert.ok(stored);
    await controller.saveTasks({ ...request({ rows:[{...stored,kpis:stored.kpis.map(k=>({...k,actual:null}))}] }), user:{...actor,role:"marketing"} } as Request, {json:()=>undefined} as unknown as Response);
    const reread = await call(controller.list,{}, {view:"tasks",q:tag});
    assert.equal(reread.tasks.find((t:MarketingTask)=>t.id===stored.id).acceptance,"Chưa nghiệm thu");
  } finally {
    await pool.query("delete from app.thong_bao where tham_chieu_loai='marketing-task' and tham_chieu_id = any($1::text[])",[ids]);
    await pool.query("delete from app.marketing_tasks where id = any($1::uuid[])",[ids]);
    await pool.query("delete from app.marketing_reports where post_id=$1",[reportId]);
    await pool.end();
  }
});
