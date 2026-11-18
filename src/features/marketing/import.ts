import * as XLSX from "xlsx";
import JSZip from "jszip";
import { marketingChannels, marketingFormats, marketingTaskSchema, marketingReportSchema, type MarketingKpiType, type MarketingTask, type MarketingReport } from "@speego/shared";

type Row = Record<string, unknown>;
const str = (v: unknown) => v == null ? "" : String(v).trim();
export function dateValue(v: unknown): string {
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    return d ? `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}` : "";
  }
  if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth()+1).padStart(2,"0")}-${String(v.getDate()).padStart(2,"0")}`;
  const s = str(v); if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/); if (m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  return "";
}
export function channelValue(s: string) {
  const aliases: Record<string,string> = { "SpeeGo Logistics Trung - Mỹ":"SpeeGo Trung – Mỹ", "SpeeGo Logistics Trung - Úc":"SpeeGo Trung – Úc", "SpeeGo Logistics Business":"SpeeGo Business", "SpeeGo LinkedIn":"LinkedIn SpeeGo", "Anh Phúc Sourcing":"TikTok Anh Phúc" };
  return (aliases[s] ?? s) as MarketingTask["channel"];
}
export function blankTask(kind: MarketingTask["kind"]): MarketingTask {
  const today = dateValue(new Date());
  return { id: crypto.randomUUID(), version: 0, kind, kpis:[], month: today.slice(0,7), channel: marketingChannels[0], title:"", brief:"", format:marketingFormats[kind][0], size:"", pillar:"", assignee:"", assigneeId:"", createdById:"", createdByName:"", collaborator:"", assignedOn:today, deadline:today, completedOn:"", status:"Chưa bắt đầu", acceptance:"Chưa nghiệm thu", assetUrl:"", postUrl:"", note:"" };
}
export async function readWorkbooks(file: File) {
  if (file.size > 20*1024*1024) throw new Error("File tối đa 20 MB");
  const data = await file.arrayBuffer();
  if (/\.zip$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(data); const files = Object.values(zip.files).filter(f => !f.dir && /\.xlsx?$/i.test(f.name) && !f.name.startsWith("__MACOSX"));
    if (files.length > 20) throw new Error("ZIP có quá nhiều file");
    const books = [];
    for (const f of files) { if ((f as unknown as { _data?: {uncompressedSize?:number} })._data?.uncompressedSize! > 30*1024*1024) throw new Error("File giải nén quá lớn"); books.push(XLSX.read(await f.async("arraybuffer"), {type:"array", cellDates:false})); }
    return books;
  }
  return [XLSX.read(data, {type:"array", cellDates:false, codepage:65001, raw:true})];
}
export async function importTasks(file: File, types: MarketingKpiType[] = []) {
  const rows: MarketingTask[] = [], errors: string[] = [];
  for (const book of await readWorkbooks(file)) for (const name of book.SheetNames) {
    const kind = /media/i.test(name) ? "media" : /content/i.test(name) ? "content" : /ads/i.test(name) ? "ads" : /seo/i.test(name) ? "seo" : null;
    if (!kind) continue;
    const values = XLSX.utils.sheet_to_json<Row>(book.Sheets[name], {defval:""});
    const sequenceHeader = kind === "media" ? "Kịch bản số" : `STT ${kind}`;
    const header = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], {header:1})[0] ?? [];
    if (!header.includes(sequenceHeader)) { errors.push(`${name}: thiếu cột ${sequenceHeader}. Dùng mẫu tải từ hệ thống; cần tên việc, kênh, người nhận, Từ ngày và Đến ngày.`); continue; }
    values.forEach((r,i) => {
      const first = str(r[sequenceHeader]); if (!first || /^VD-/i.test(first)) return;
      const t = { ...blankTask(kind), month:str(r["Tháng kế hoạch"]), channel:channelValue(str(r["Kênh / Page"])), title:str(r[kind === "media" ? "Tên video / Chủ đề" : "Tên bài / Chủ đề"]), brief:str(r[kind === "media" ? "Nội dung order" : "Brief bài"]), format:str(r[kind === "media" ? "Định dạng" : "Định dạng bài"]), size:str(r.Size), pillar:str(r["Tuyến nội dung"]), assignee:str(r[kind === "media" ? "Media phụ trách" : "Content phụ trách"]), collaborator:str(r["Content phối hợp"]), assignedOn:dateValue(r["Ngày giao việc"]), deadline:dateValue(r[kind === "media" ? "Deadline bàn giao" : "Deadline hoàn thành"]), completedOn:dateValue(r[kind === "media" ? "Ngày bàn giao thực tế" : "Ngày hoàn thành thực tế"]), status:str(r["Trạng thái"]) || "Chưa bắt đầu", acceptance:str(r["Nghiệm thu"]) || "Chưa nghiệm thu", assetUrl:str(r[kind === "media" ? "Link video final" : "File nội dung"]), note:str(r["Ghi chú / Vướng mắc"]) };
      t.postUrl = str(r["Link bài đăng"]);
      t.assignedOn = dateValue(r["Từ ngày"]) || t.assignedOn;
      t.deadline = dateValue(r["Đến ngày"]) || t.deadline;
      if (kind === "ads") { t.title = str(r["Tên chiến dịch / Công việc"]); t.brief = str(r["Brief Ads"]); t.format = str(r["Loại quảng cáo"]); t.assignee = str(r["Ads phụ trách"]); t.assetUrl = str(r["Link chiến dịch"]); }
      if (kind === "seo") { t.title = str(r["Tên hạng mục / Công việc"]); t.brief = str(r["Brief SEO"]); t.format = str(r["Loại SEO"]); t.assignee = str(r["SEO phụ trách"]); t.assetUrl = str(r["Link website / Báo cáo"]); }
      for (const type of types.filter(type => type.kind === kind)) {
        const target = str(r[`Chỉ tiêu: ${type.name} (${type.unit})`]);
        const actual = str(r[`Thực hiện: ${type.name} (${type.unit})`]);
        if (!target && !actual) continue;
        t.kpis.push({ id:type.id, name:type.name, unit:type.unit, direction:type.direction, target:Number(target), actual:actual ? Number(actual) : null });
      }
      const p = marketingTaskSchema.safeParse(t); if(p.success) rows.push(p.data); else errors.push(`${name}, dòng ${i+2}: ${p.error.issues[0].message}`);
    });
  }
  if (!rows.length && !errors.length) errors.push("Không tìm thấy dòng giao việc Media/Content/Ads/SEO. Mẫu trống cần điền công việc trước khi nhập.");
  return { rows, errors };
}
const number = (v: unknown) => str(v) === "" || str(v) === "--" ? null : Number(str(v).replace(/,/g,""));
export async function importReports(file: File, platform: MarketingReport["platform"], channel: MarketingReport["channel"], observedOn: string, year: string, observedFrom = observedOn) {
  if (!observedFrom || !observedOn || observedFrom > observedOn) throw new Error("Chọn khoảng ngày đo hợp lệ: từ ngày không sau đến ngày");
  const rows: MarketingReport[] = [], errors: string[] = [];
  for (const book of await readWorkbooks(file)) for (const name of book.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], {header:1, defval:""});
    const header = platform === "facebook" ? "ID bài viết" : platform === "tiktok" ? "Video title" : "Post title";
    const h = grid.findIndex(r => r.some(v => str(v).toLowerCase() === header.toLowerCase()));
    if (h < 0) continue;
    const records = XLSX.utils.sheet_to_json<Row>(book.Sheets[name], {range:h,defval:"",raw:true});
    records.forEach((r,i) => {
      const get = (...keys:string[]) => { for(const k of keys) if(str(r[k]) !== "") return r[k]; return ""; };
      const url = str(get("Liên kết vĩnh viễn","Video link","Post link","Post URL")); if(!url) return;
      let publishedOn = dateValue(get("Thời gian đăng","Post time","Created date","Post date"));
      if (platform === "linkedin" || platform === "facebook") { const m=str(platform === "linkedin" ? r["Created date"] : r["Thời gian đăng"]).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m) publishedOn=`${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`; }
      if (!publishedOn && platform === "tiktok") { const m = str(r["Post time"]).match(/^(\d+) tháng (.+)$/i); const months = ["Một","Hai","Ba","Tư","Năm","Sáu","Bảy","Tám","Chín","Mười","Mười Một","Mười Hai"]; const month = m ? months.findIndex(v=>v.toLowerCase()===m[2].toLowerCase())+1 : 0; if(m&&month) publishedOn=`${year}-${String(month).padStart(2,"0")}-${m[1].padStart(2,"0")}`; }
      const likes=number(get("Total likes","Likes (organic)","Likes")), comments=number(get("Total comments","Comments (organic)","Comments")), shares=number(get("Total shares","Reposts (organic)","Reposts"));
      const t = {platform, channel:platform === "facebook" ? channelValue(str(r["Tên Trang"])) : channel, postId:str(get("ID bài viết")) || url.match(/(?:video\/|activity:)(\d+)/)?.[1] || url, postUrl:url, title:str(get("Tiêu đề","Video title","Post title")).slice(0,4000), format:str(get("Loại bài viết","Content Type")) || (platform === "tiktok" ? "Video" : ""), publishedOn, observedOn, views:number(get("Lượt xem","Total views","Impressions (organic)","Impressions")), interactions:platform === "facebook" ? number(get("Cảm xúc, bình luận và lượt chia sẻ")) : likes === null || comments === null || shares === null ? null : likes+comments+shares};
      const p=marketingReportSchema.safeParse({...t, observedFrom}); if(p.success) rows.push(p.data); else errors.push(`${name}, dòng ${h+i+2}: ${p.error.issues[0].message}`);
    });
  }
  if(!rows.length&&!errors.length) errors.push("Không tìm thấy bảng nội dung có link bài; Overview/Followers/Viewers không dùng để ghép giao việc");
  return {rows,errors};
}
export function exportExcel(name: string, rows: object[]) {
  const book=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book,XLSX.utils.json_to_sheet(rows),"Dữ liệu"); XLSX.writeFile(book,`${name}.xlsx`);
}
