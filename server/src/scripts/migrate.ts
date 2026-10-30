import { readFile } from "node:fs/promises";
import pg from "pg";
import { config } from "dotenv";
import { postgresSsl } from "../adapters/postgres/pool";
import { loadEnv } from "../config/env";
import { logger } from "../lib/logger";

config({ path: new URL("../../.env", import.meta.url) });

const env = loadEnv();
if (env.DB_PROVIDER !== "postgres" || !env.DATABASE_URL) {
  throw new Error("Migrate cần DB_PROVIDER=postgres và DATABASE_URL");
}

const client = new pg.Client({
  connectionString: env.DATABASE_URL,
  ssl: postgresSsl(env),
  connectionTimeoutMillis: 20_000,
  statement_timeout: 120_000,
  application_name: "speego-migrate",
});

const files = [
  "001_users.sql",
  "002_authz.sql",
  "003_crm_message.sql",
  "004_crm_lead.sql",
  "005_lead_mess_unique.sql",
  "006_crm_uuid_ids.sql",
  "007_viet_hoa_ten_bang_cot.sql",
  "008_chuan_hoa_ten_rang_buoc.sql",
  "009_bo_sung_sale_mess.sql",
  "010_tach_tuyen_mess.sql",
  "011_xoa_bang_cu.sql",
  "012_bao_gia.sql",
  "013_bao_gia_chi_tiet.sql",
  "014_ban_bao_gia_da_gui.sql",
  "015_mot_don_hai_bao_gia.sql",
  "016_hop_dong.sql",
  "017_hop_dong_tu_bao_gia.sql",
  "018_khoa_chinh_ten_id.sql",
  "019_hop_dong_gui_lai.sql",
  "020_hop_dong_ban_da_gui.sql",
  "021_mess_link_mess.sql",
  "022_thong_bao.sql",
  "023_hop_dong_loai_tien.sql",
  "024_hop_dong_dong_thanh_toan.sql",
  "025_hop_dong_anh_bill_theo_lan.sql",
  "026_hop_dong_dong_xac_nhan.sql",
  "027_tiem_nang_yeu_cau_chuyen.sql",
  "028_doi_chu_nhiem_thanh_chu_tiem.sql",
];

await client.connect();
try {
  await client.query("create extension if not exists pgcrypto");
  await client.query("create schema if not exists app");
  // Bảng theo dõi cũ tên tiếng Anh: đổi sang tiếng Việt nếu còn.
  await client.query(`do $$
  begin
    if to_regclass('app.schema_migrations') is not null
       and to_regclass('app.lich_su_cap_nhat_cau_truc') is null then
      alter table app.schema_migrations rename to lich_su_cap_nhat_cau_truc;
      alter table app.lich_su_cap_nhat_cau_truc rename column ten_file to ten_tep;
    end if;
  end $$`);
  await client.query(`create table if not exists app.lich_su_cap_nhat_cau_truc (
    ten_tep text primary key,
    ap_dung_luc timestamptz not null default now()
  )`);

  const applied = new Set(
    (
      await client.query<{ ten_tep: string }>("select ten_tep from app.lich_su_cap_nhat_cau_truc")
    ).rows.map((row) => row.ten_tep),
  );

  // DB cũ đã chạy 001-005 nhưng chưa có bảng theo dõi: ghi nhận baseline,
  // không chạy lại DDL cũ (sẽ tạo bảng tiếng Anh rỗng sau khi đã đổi tên).
  if (applied.size === 0) {
    const state = await client.query<{ co_users: boolean; co_nguoi_dung: boolean }>(
      `select to_regclass('public.users') is not null as co_users,
              to_regclass('public.nguoi_dung') is not null as co_nguoi_dung`,
    );
    const row = state.rows[0];
    // Chỉ baseline 001-005. 006 (đổi id sang uuid) idempotent nên chạy lại an toàn,
    // còn 007 chỉ chạy khi schema chưa được Việt hoá.
    const baseline = row?.co_users ? files.slice(0, 5) : row?.co_nguoi_dung ? files : [];
    for (const file of baseline) {
      await client.query("insert into app.lich_su_cap_nhat_cau_truc (ten_tep) values ($1) on conflict do nothing", [file]);
      applied.add(file);
    }
    if (baseline.length > 0) logger.info("migration baseline", { count: baseline.length });
  }

  for (const file of files) {
    if (applied.has(file)) {
      logger.info("migration skipped", { file });
      continue;
    }
    const sql = await readFile(new URL(`../../db/migrations/${file}`, import.meta.url), "utf8");
    await client.query(sql);
    await client.query("insert into app.lich_su_cap_nhat_cau_truc (ten_tep) values ($1) on conflict do nothing", [file]);
    logger.info("migration applied", { file });
  }
} catch (err) {
  logger.error("migration failed", { err });
  process.exitCode = 1;
} finally {
  await client.end();
}
