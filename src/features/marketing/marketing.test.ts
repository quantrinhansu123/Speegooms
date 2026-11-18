import assert from "node:assert/strict";
import { test } from "node:test";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { taskKpi, deadlineLabel, contentEffect, canonicalPostUrl, marketingTaskSchema, marketingKpiMet, marketingKpiSettingsSchema } from "@speego/shared";
import { blankTask, importTasks, importReports } from "./import";
import { buildTaskTemplate, buildReportTemplate } from "./template";
test("downloaded template preserves dropdowns and filled rows import with post links",async()=>{
 const book=await buildTaskTemplate();
 const media=book.getWorksheet("01 Giao việc Media")!, content=book.getWorksheet("02 Giao việc Content")!;
 assert.equal(book.getWorksheet("DanhMuc")!.state,"veryHidden");
 assert.equal(media.getCell("C501").dataValidation.type,"list");
 assert.deepEqual(content.getCell("F2").dataValidation.formulae,["DinhDangContent"]);
 media.getCell("A2").value=1; media.getCell("B2").value="2026-11"; media.getCell("C2").value="SpeeGo Sourcing";
 media.getCell("D2").value="Video kiểm tra hàng"; media.getCell("F2").value="Video"; media.getCell("H2").value="Media 1";
 media.getCell("J2").value=new Date(Date.UTC(2026,10,16)); media.getCell("K2").value=new Date(Date.UTC(2026,10,20));
 media.getCell("T2").value="https://www.facebook.com/reel/123/";
 content.getCell("A2").value=1; content.getCell("B2").value="2026-11"; content.getCell("C2").value="SpeeGo Sourcing";
 content.getCell("D2").value="Bài kiểm tra hàng"; content.getCell("F2").value="Bài ảnh"; content.getCell("H2").value="Content 1";
 content.getCell("I2").value="2026-11-16"; content.getCell("J2").value="2026-11-20";
 content.getCell("R2").value="https://www.facebook.com/posts/456/";
 const buffer=await book.xlsx.writeBuffer();
 const result=await importTasks(new File([new Uint8Array(buffer)],"mau-giao-viec.xlsx"));
 assert.deepEqual(result.errors,[]); assert.equal(result.rows.length,2);
 assert.equal(result.rows[0].assignedOn,"2026-11-16"); assert.equal(result.rows[0].status,"Chưa bắt đầu");
 assert.equal(result.rows[0].postUrl,"https://www.facebook.com/reel/123/"); assert.equal(result.rows[1].postUrl,"https://www.facebook.com/posts/456/");
});
test("KPI excludes cancelled work and uses accepted tasks, including late completions",()=>{
 const base={...blankTask("media"),title:"Video",assignee:"Media 1",assignedOn:"2026-11-01",deadline:"2026-11-10"};
 const done={...base,acceptance:"Đạt" as const,completedOn:"2026-11-11"};
 assert.deepEqual(taskKpi([done,base,{...base,status:"Hủy"}]),{assigned:2,done:1,rate:50});
 assert.equal(taskKpi([]).rate,null); assert.equal(deadlineLabel(done,"2026-11-16"),"Trễ hạn"); assert.equal(deadlineLabel(base,"2026-11-16"),"Quá hạn");
 assert.equal(marketingTaskSchema.safeParse({...done,completedOn:""}).success,false);
});
test("baseline requires both metrics and canonical links ignore tracking",()=>{
 const report={platform:"facebook" as const,channel:"SpeeGo Sourcing" as const,postId:"1",postUrl:"https://facebook.com/1",title:"",format:"Video",publishedOn:"2026-11-01",observedOn:"2026-11-16",views:610,interactions:0};
 assert.equal(contentEffect(report),"Chưa đạt"); assert.equal(contentEffect({...report,interactions:1}),"Đạt hiệu quả"); assert.equal(contentEffect({...report,views:null}),"Thiếu số liệu");
 assert.equal(canonicalPostUrl("https://www.tiktok.com/@abc/video/123?utm_source=share"),"https://www.tiktok.com/@abc/video/123");
});

function workbook(rows: Record<string, unknown>[], sheet = "Content") {
 const book = XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(rows), sheet);
 return book;
}
function workbookFile(book: XLSX.WorkBook, name: string, bookType: "xlsx" | "biff8" = "xlsx") {
 return new File([XLSX.write(book, { type: "array", bookType })], name);
}

test("task workbooks import both sheets and ignore sample and formula-only rows",async()=>{
 const common = { "Tháng kế hoạch":"2026-11", "Kênh / Page":"SpeeGo Sourcing", "Ngày giao việc":"2026-11-01" };
 const media = [1,2].map(n=>({ ...common, "Kịch bản số":String(n), "Tên video / Chủ đề":`Fixture video ${n}`, "Định dạng":"Video", "Media phụ trách":"Fixture Media", "Deadline bàn giao":"2026-11-10" }));
 const content = [1,2].map(n=>({ ...common, "STT content":String(n), "Tên bài / Chủ đề":`Fixture post ${n}`, "Định dạng bài":"Bài ảnh", "Content phụ trách":"Fixture Content", "Deadline hoàn thành":"2026-11-10" }));
 const book = workbook([...media, { ...media[0], "Kịch bản số":"VD-1" }], "01 Media");
 XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(content), "02 Content");
 book.Sheets["01 Media"].P501 = { t:"n", f:'COUNTIF(A2:A500,"<>")', v:2 };
 book.Sheets["01 Media"]["!ref"] = "A1:P501";
 const result=await importTasks(workbookFile(book,"fixture-tasks.xlsx"));
 assert.deepEqual(result.errors,[]); assert.equal(result.rows.length,4); assert.equal(result.rows.filter(t=>t.kind==="media").length,2);
});

test("synthetic CSV, XLS and ZIP reports preserve post IDs, metrics and date formats",async()=>{
 const facebook = workbook([{ "ID bài viết":"9000000000000001", "Tên Trang":"SpeeGo Sourcing", "Liên kết vĩnh viễn":"https://www.facebook.com/9000000000000001", "Tiêu đề":"Fixture Facebook post", "Loại bài viết":"Video", "Thời gian đăng":"11/09/2026 10:00", "Lượt xem":"1,234", "Cảm xúc, bình luận và lượt chia sẻ":"12" }]);
 const facebookFile = new File([XLSX.utils.sheet_to_csv(facebook.Sheets.Content)], "fixture-facebook.csv");
 const linkedinFile = workbookFile(workbook([{ "Post title":"Fixture LinkedIn post", "Post URL":"https://www.linkedin.com/feed/update/urn:li:activity:9000000000000003/", "Created date":"11/09/2026", "Content Type":"Video", "Impressions (organic)":1234, "Likes (organic)":2, "Comments (organic)":3, "Reposts (organic)":4 }]), "fixture-linkedin.xls", "biff8");
 const tiktok = workbook([{ "Video title":"Fixture TikTok video", "Video link":"https://www.tiktok.com/@fixture/video/9000000000000002", "Post time":"26 tháng Mười", "Total views":1234, "Total likes":2, "Total comments":3, "Total shares":4 }]);
 const zip = new JSZip();
 zip.file("Content_fixture.xlsx", XLSX.write(tiktok,{type:"array",bookType:"xlsx"}));
 zip.file("Overview_fixture.xlsx", XLSX.write(workbook([{Date:"2026-10-26",Views:9999}],"Overview"),{type:"array",bookType:"xlsx"}));
 const tiktokFile = new File([await zip.generateAsync({type:"arraybuffer"})], "fixture-tiktok.zip");
 const cases = [
  { file:facebookFile, platform:"facebook", channel:"SpeeGo Sourcing", date:"2026-11-09", id:"9000000000000001", interactions:12 },
  { file:linkedinFile, platform:"linkedin", channel:"LinkedIn SpeeGo", date:"2026-11-09", id:"9000000000000003", interactions:9 },
  { file:tiktokFile, platform:"tiktok", channel:"TikTok Anh Phúc", date:"2026-10-26", id:"9000000000000002", interactions:9 },
 ] as const;
 for(const item of cases){
  const result=await importReports(item.file,item.platform,item.channel,"2026-11-16","2026");
  assert.deepEqual(result.errors,[],`${item.platform}: ${result.errors.slice(0,3).join(";")}`);
  assert.equal(result.rows.length,1,item.platform);
  assert.equal(result.rows[0].publishedOn,item.date);
  assert.equal(result.rows[0].postId,item.id);
  assert.equal(result.rows[0].views,1234);
  assert.equal(result.rows[0].interactions,item.interactions);
 }
});

test("Ads template round trips date range and configured KPI targets/results",async()=>{
 const type={id:"956415bc-a231-4a37-8f3a-1c8e04a7e003",kind:"ads" as const,name:"Lead",unit:"lead",direction:"at-least" as const,defaultTarget:10,active:true};
 const book=await buildTaskTemplate([type]);
 const sheet=book.getWorksheet("03 Giao việc Ads")!;
 sheet.addRow([]);
 const values=[1,"2026-11","SpeeGo Sourcing","Test Ads","Brief","Facebook Ads","","Media 1","2026-11-01","2026-12-10","","Đang chạy","Chưa nghiệm thu","","","https://example.com/campaign","","",25,0];
 values.forEach((v,i)=>sheet.getCell(2,i+1).value=v);
 assert.deepEqual(sheet.getCell("F501").dataValidation.formulae,["DinhDangAds"]);
 const bytes=await book.xlsx.writeBuffer();
 const imported=await importTasks(new File([new Uint8Array(bytes)],"tasks.xlsx"),[type]);
 assert.deepEqual(imported.errors,[]);assert.equal(imported.rows.length,1);
 assert.equal(imported.rows[0].kind,"ads");assert.equal(imported.rows[0].assignedOn,"2026-11-01");assert.equal(imported.rows[0].deadline,"2026-12-10");
 assert.deepEqual(imported.rows[0].kpis,[{id:type.id,name:"Lead",unit:"lead",direction:"at-least",target:25,actual:0}]);
 assert.equal(marketingTaskSchema.safeParse({...imported.rows[0],deadline:"2026-10-31"}).success,false);
 assert.equal(marketingKpiSettingsSchema.safeParse({version:1,types:[type,type]}).success,false);
 const kpi=imported.rows[0].kpis[0];
 assert.equal(marketingKpiMet({...kpi,actual:25}),true);assert.equal(marketingKpiMet({...kpi,actual:24}),false);
 assert.equal(marketingKpiMet({...kpi,direction:"at-most",actual:0}),true);assert.equal(marketingKpiMet({...kpi,direction:"at-most",actual:null}),false);
});

test("downloaded report templates import for all platforms and retain measurement period",async()=>{
 const cases=[
  {platform:"facebook",channel:"SpeeGo Sourcing",values:["9000000000000001","SpeeGo Sourcing","https://facebook.com/9000000000000001","Post","Video","2026-11-09",0,0]},
  {platform:"tiktok",channel:"TikTok Anh Phúc",values:["Video","https://www.tiktok.com/@test/video/9000000000000002","2026-11-09",100,0,0,0]},
  {platform:"linkedin",channel:"LinkedIn SpeeGo",values:["Post","https://www.linkedin.com/feed/update/urn:li:activity:9000000000000003/","2026-11-09","Video",100,1,2,3]},
 ] as const;
 for(const item of cases){
  const book=await buildReportTemplate(item.platform);const sheet=book.getWorksheet("Content")!;
  assert.equal(sheet.rowCount,1);sheet.addRow([...item.values]);
  const bytes=await book.xlsx.writeBuffer();const file=new File([new Uint8Array(bytes)],"report.xlsx");
  const result=await importReports(file,item.platform,item.channel,"2026-11-16","2026","2026-11-01");
  assert.deepEqual(result.errors,[]);assert.equal(result.rows.length,1);assert.equal(result.rows[0].observedFrom,"2026-11-01");assert.equal(result.rows[0].observedOn,"2026-11-16");
  await assert.rejects(()=>importReports(file,item.platform,item.channel,"2026-11-01","2026","2026-11-16"),/khoảng ngày đo/);
 }
});

test("SEO template preserves several KPIs and uses increasing completion ratios",async()=>{
 const types=[
  {id:"956415bc-a231-4a37-8f3a-1c8e04a7e005",kind:"seo" as const,name:"Search",unit:"lượt",direction:"at-least" as const,defaultTarget:250,active:true},
  {id:"956415bc-a231-4a37-8f3a-1c8e04a7e006",kind:"seo" as const,name:"Top 20",unit:"từ khóa",direction:"at-least" as const,defaultTarget:140000,active:true},
 ];
 const book=await buildTaskTemplate(types), sheet=book.getWorksheet("04 Giao việc SEO")!;
 [1,"2026-11","Khác","Test SEO","Brief","SEO website","","Content 1","2026-11-01","2026-11-30"].forEach((v,i)=>sheet.getCell(2,i+1).value=v);
 sheet.getCell("S2").value=250;sheet.getCell("T2").value=270;sheet.getCell("V2").value=140000;sheet.getCell("W2").value=130000;
 assert.match((sheet.getCell("X2").value as {formula:string}).formula,/W2\/V2/);
 assert.deepEqual(sheet.getCell("F501").dataValidation.formulae,["DinhDangSeo"]);
 const buffer=await book.xlsx.writeBuffer();
 const imported=await importTasks(new File([new Uint8Array(buffer)],"seo.xlsx"),types);
 assert.deepEqual(imported.errors,[]);assert.equal(imported.rows[0].kind,"seo");assert.equal(imported.rows[0].kpis.length,2);
 assert.equal(marketingKpiMet(imported.rows[0].kpis[1]),false);
 const incomplete=workbookFile(workbook([{ "Từ ngày":"", "Đến ngày":"", "KPI_1_A_MKT giao (số mess)":250 }],"03 Giao việc Ads"),"incomplete.xlsx");
 const invalid=await importTasks(incomplete,types);assert.match(invalid.errors[0],/thiếu cột STT ads/);
});
