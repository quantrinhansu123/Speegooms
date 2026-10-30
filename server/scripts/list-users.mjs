import { config } from "dotenv";
import pg from "pg";

config();
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
const { rows } = await client.query(`
  select ma_nguoi_dung, thu_dien_tu, ho_ten, vai_tro,
         (mat_khau_bam is not null and length(mat_khau_bam) > 0) as has_password
  from nguoi_dung
  order by vai_tro, thu_dien_tu
`);
for (const row of rows) {
  console.log(`${row.vai_tro}\t${row.thu_dien_tu}\t${row.ho_ten}\thas_pw=${row.has_password}`);
}
console.log(`count=${rows.length}`);
await client.end();
