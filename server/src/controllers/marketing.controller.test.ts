import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import type pg from "pg";
import { MarketingController } from "./marketing.controller";
import type { MarketingTask, MarketingKpiSettings } from "@speego/shared";
const kpiType = { id:"956415bc-a231-4a37-8f3a-1c8e04a7e003",kind:"ads" as const,name:"Lead",unit:"lead",direction:"at-least" as const,defaultTarget:10,active:true };
const settings: MarketingKpiSettings = { version:1, types:[kpiType] };
const goal = { id:kpiType.id,name:kpiType.name,unit:kpiType.unit,direction:kpiType.direction,target:10,actual:null as number|null };
const task:MarketingTask={id:"d56d673d-1748-42ed-8231-0274fa3cce7d",version:0,kind:"media",kpis:[],month:"2026-11",channel:"SpeeGo Sourcing",title:"Test",brief:"",format:"Video",size:"",pillar:"",assignee:"Media 1",assigneeId:"u-media",createdById:"",createdByName:"",collaborator:"",assignedOn:"2026-11-01",deadline:"2026-11-10",completedOn:"",status:"Chưa bắt đầu",acceptance:"Chưa nghiệm thu",assetUrl:"",postUrl:"",note:""};
const request=(role:string,rows:unknown[])=>({user:{id:"u-test",name:"Người giao",role},body:{rows}} as Request);
const response={json:()=>undefined} as unknown as Response;
function db(existing?:{data:MarketingTask;version:number}, config = settings) {
 const queries:string[]=[];let released=false;
 const writes:unknown[][]=[];
 const c={query:async(sql:string,values:unknown[]=[])=>{queries.push(sql);if(sql.startsWith("insert into app.marketing_tasks"))writes.push(values);return {rows:sql.startsWith("select version, types")?[config]:sql.startsWith("update app.marketing_kpi_settings")?[{version:config.version+1,types:JSON.parse(String(values[0]))}]:sql.startsWith("select data,")&&existing?[existing]:sql.startsWith("select ma_nguoi_dung")?[{id:"u-media",name:"Media 1",email:"media@example.com",role:"marketing"},{id:"u-test",name:"Người giao",email:"content@example.com",role:"marketing-content"}]:[]};},release:()=>{released=true;}};
 return {pool:{connect:async()=>c} as unknown as pg.Pool,queries,writes,released:()=>released};
}
test("readers and unrelated roles cannot write Marketing",async()=>{
 for(const role of ["ban-gd","sale-vn","hcns"])await assert.rejects(()=>new MarketingController(null).saveTasks(request(role,[task]),response),/Không có quyền/);
});
test("Marketing cannot self-accept, rejected batch rolls back",async()=>{
 const d=db();await assert.rejects(()=>new MarketingController(d.pool).saveTasks(request("marketing",[{...task,completedOn:"2026-11-09",acceptance:"Đạt"}]),response),/nghiệm thu/);
 assert.ok(d.queries.includes("rollback"));assert.equal(d.queries.some(q=>q.startsWith("insert")),false);assert.equal(d.released(),true);
});
test("stale task version is rejected before update",async()=>{
 const d=db({data:task,version:2});await assert.rejects(()=>new MarketingController(d.pool).saveTasks(request("admin",[{...task,version:1}]),response),/đã thay đổi/);assert.ok(d.queries.includes("rollback"));
});
test("report upsert preserves newer observation instead of adding cumulative values",async()=>{
 const d=db();await new MarketingController(d.pool).saveReports(request("marketing",[{platform:"facebook",channel:"SpeeGo Sourcing",postId:"123",postUrl:"https://facebook.com/123",title:"",format:"Video",publishedOn:"2026-11-01",observedOn:"2026-11-16",views:610,interactions:1}]),response);
 const sql=d.queries.find(q=>q.startsWith("insert"))!;assert.match(sql,/excluded.data->>'observedOn' >=/);assert.match(sql,/data=excluded.data/);assert.ok(d.queries.includes("commit"));
});
test("Content can order video to a concrete account, creates an assignment notification",async()=>{
 const d=db();await new MarketingController(d.pool).saveTasks(request("marketing-content",[task]),response);
 assert.ok(d.queries.some(q=>q.startsWith("insert into app.thong_bao")));assert.ok(d.queries.includes("commit"));
});
test("leader can accept any task; regular staff cannot create assignments",async()=>{
 const d=db();await new MarketingController(d.pool).saveTasks(request("marketing-lead",[{...task,completedOn:"2026-11-09",acceptance:"Đạt"}]),response);assert.ok(d.queries.includes("commit"));
 await assert.rejects(()=>new MarketingController(db().pool).saveTasks(request("marketing",[task]),response),/được giao/);
});
test("receiver can report progress but cannot reassign or change deadline",async()=>{
 const old={...task,version:1,assigneeId:"u-test",assignee:"Người giao",createdById:"u-order",createdByName:"Content"};
 const d=db({data:old,version:1});await new MarketingController(d.pool).saveTasks(request("marketing",[{...old,status:"Đang dựng"}]),response);
 assert.equal(d.queries.some(q=>q.startsWith("insert into app.thong_bao")),false);
 await assert.rejects(()=>new MarketingController(db({data:old,version:1}).pool).saveTasks(request("marketing",[{...old,deadline:"2026-11-20"}]),response),/chỉ được cập nhật/);
 await assert.rejects(()=>new MarketingController(db({data:old,version:1}).pool).saveTasks(request("marketing-content",[{...old,assigneeId:"u-media"}]),response),/chỉ được cập nhật/);
});
test("unknown recipient and Content non-video orders are rejected",async()=>{
 await assert.rejects(()=>new MarketingController(db().pool).saveTasks(request("marketing-lead",[{...task,assigneeId:"not-a-user"}]),response),/tài khoản nhận việc/);
 await assert.rejects(()=>new MarketingController(db().pool).saveTasks(request("marketing-content",[{...task,format:"Ảnh"}]),response),/định dạng Video/);
});

test("Ads accepts configured KPIs; wrong kind, inactive and missing results are rejected",async()=>{
 const ads={...task,kind:"ads",format:"Facebook Ads",kpis:[{...goal,name:"Forged",unit:"Forged"}]};
 const d=db();await new MarketingController(d.pool).saveTasks(request("marketing-lead",[ads]),response);
 assert.equal((d.writes[0][1] as MarketingTask).kpis[0].name,"Lead");
 assert.equal((d.writes[0][1] as MarketingTask).kpis[0].unit,"lead");
 await assert.rejects(()=>new MarketingController(db().pool).saveTasks(request("admin",[{...task,kpis:[goal]}]),response),/không thuộc nhóm/);
 await assert.rejects(()=>new MarketingController(db(undefined,{...settings,types:[{...kpiType,active:false}]}).pool).saveTasks(request("admin",[ads]),response),/ngừng sử dụng/);
 await assert.rejects(()=>new MarketingController(db().pool).saveTasks(request("admin",[{...ads,acceptance:"Đạt",completedOn:"2026-11-09"}]),response),/Nhập kết quả/);
});

test("receiver edits KPI results, cannot change goals, and changes require renewed acceptance",async()=>{
 const old:MarketingTask={...task,version:1,kind:"ads",format:"Facebook Ads",assigneeId:"u-test",assignee:"Người giao",createdById:"u-order",kpis:[{...goal,actual:10}],acceptance:"Đạt",completedOn:"2026-11-09"};
 const d=db({data:old,version:1});
 await new MarketingController(d.pool).saveTasks(request("marketing",[{...old,kpis:[{...goal,actual:12}]}]),response);
 assert.equal((d.writes[0][1] as MarketingTask).acceptance,"Chưa nghiệm thu");
 await assert.rejects(()=>new MarketingController(db({data:old,version:1}).pool).saveTasks(request("marketing",[{...old,kpis:[{...goal,target:1,actual:10}]}]),response),/không được sửa chỉ tiêu/);
 await assert.rejects(()=>new MarketingController(db({data:old,version:1}).pool).saveTasks(request("marketing",[{...old,kpis:[]}]),response),/không được sửa chỉ tiêu/);
});

test("settings require Admin, version match and immutable historical units",async()=>{
 const req=(role:string,body:unknown)=>({...request(role,[]),body} as Request);
 for(const role of ["marketing","marketing-lead","marketing-content","ban-gd"])await assert.rejects(()=>new MarketingController(null).saveSettings(req(role,settings),response),/Admin|Không có quyền/);
 const d=db();await new MarketingController(d.pool).saveSettings(req("admin",{...settings,types:[{...kpiType,defaultTarget:20,active:false}]}),response);assert.ok(d.queries.includes("commit"));
 await assert.rejects(()=>new MarketingController(db().pool).saveSettings(req("admin",{...settings,version:0}),response),/đã thay đổi/);
 await assert.rejects(()=>new MarketingController(db().pool).saveSettings(req("admin",{...settings,types:[{...kpiType,unit:"VND"}]}),response),/giữ nguyên/);
});

test("reports reject a reversed measurement interval",async()=>{
 await assert.rejects(()=>new MarketingController(db().pool).saveReports(request("marketing",[{platform:"facebook",channel:"SpeeGo Sourcing",postId:"123",postUrl:"https://facebook.com/123",title:"",format:"Video",publishedOn:"2026-11-01",observedFrom:"2026-11-17",observedOn:"2026-11-16",views:0,interactions:0}]),response),/từ ngày/);
});
