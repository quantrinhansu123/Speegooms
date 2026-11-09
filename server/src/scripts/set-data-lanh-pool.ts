import pg from "pg";
import { config } from "dotenv";
import { postgresSsl } from "../adapters/postgres/pool";
import { PostgresDataLanhRepository } from "../adapters/postgres/data-lanh.repository";
import { loadEnv } from "../config/env";

/**
 * Đặt danh sách người nhận chia vòng tròn data lạnh (theo thứ tự tên truyền vào), tùy chọn chia lại từ đầu.
 *   pnpm tsx src/scripts/set-data-lanh-pool.ts "Tên 1" "Tên 2" ...            chỉ đặt danh sách
 *   pnpm tsx src/scripts/set-data-lanh-pool.ts --redistribute "Tên 1" ...     đặt danh sách + gỡ giao cũ + chia lại
 * --redistribute từ chối chạy nếu đã có khách được cập nhật trạng thái / bàn giao Sale care (thêm --force để bỏ qua).
 */
config({ path: new URL("../../.env", import.meta.url) });

const args = process.argv.slice(2);
const redistribute = args.includes("--redistribute");
const force = args.includes("--force");
const names = args.filter((arg) => !arg.startsWith("--"));
if (names.length === 0) throw new Error("Thiếu tên người nhận");

const env = loadEnv();
const pool = new pg.Pool({ connectionString: env.DATABASE_URL, ssl: postgresSsl(env), max: 2 });
try {
  const ids: string[] = [];
  for (const name of names) {
    const found = (await pool.query<{ id: string }>(`select ma_nguoi_dung as id from public.nguoi_dung where lower(btrim(ho_ten)) = lower(btrim($1))`, [name])).rows;
    if (found.length !== 1) throw new Error(`"${name}": tìm thấy ${found.length} tài khoản, cần đúng 1`);
    ids.push(found[0]!.id);
  }
  if (new Set(ids).size !== ids.length) throw new Error("Danh sách có người trùng nhau");

  if (redistribute && !force) {
    const worked = (await pool.query<{ n: string }>(
      `select count(*) as n from crm.data_lanh where trang_thai_facebook is not null or trang_thai_telesale is not null or sale_care_id is not null`,
    )).rows[0]!.n;
    if (Number(worked) > 0) throw new Error(`Đã có ${worked} khách được cập nhật trạng thái hoặc bàn giao, không chia lại. Thêm --force nếu vẫn muốn.`);
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("delete from crm.data_lanh_nguoi_nhan");
    for (const [index, id] of ids.entries()) await client.query("insert into crm.data_lanh_nguoi_nhan (nguoi_dung_id, thu_tu) values ($1, $2)", [id, index + 1]);
    if (redistribute) await client.query("update crm.data_lanh set intern_id = null, giao_luc = null, cap_nhat_luc = now()");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
  console.log(`Danh sách người nhận: ${names.join(" → ")}`);

  const result = await new PostgresDataLanhRepository(pool).assignRoundRobin();
  console.log(`Đã chia ${result.assigned} khách vòng tròn cho ${result.interns} người`);
  const summary = await pool.query<{ name: string | null; n: string }>(
    `select u.ho_ten as name, count(*) as n from crm.data_lanh d left join public.nguoi_dung u on u.ma_nguoi_dung = d.intern_id group by 1 order by 2 desc, 1`,
  );
  for (const row of summary.rows) console.log(`  ${row.name ?? "(chưa giao)"}: ${row.n}`);
} finally {
  await pool.end();
}
