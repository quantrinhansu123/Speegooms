import { config } from "dotenv";
import pg from "pg";

config();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});

await client.connect();

const { rows: tables } = await client.query(`
  select quote_ident(n.nspname) || '.' || quote_ident(c.relname) as fqname
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'crm' and c.relkind = 'r'
  order by c.relname
`);

if (tables.length === 0) {
  console.log("No crm tables found.");
  await client.end();
  process.exit(0);
}

const list = tables.map((row) => row.fqname).join(", ");
console.log("Truncating:", list);
await client.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);

const { rows: counts } = await client.query(`
  select c.relname as table_name,
         (xpath('//row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', n.nspname, c.relname), false, true, '')))[1]::text::int as rows
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'crm' and c.relkind = 'r'
  order by c.relname
`);
for (const row of counts) {
  console.log(`${row.table_name}\t${row.rows}`);
}

await client.end();
console.log("Done.");
