import { config } from "dotenv";
import { loadEnv } from "../config/env";
import { createRepositories } from "../repositories/create-repositories";
import { seedDemoUsers } from "../seeds/seed-demo-users";
import { ScryptPasswordHasher } from "../services/password.service";
import type { Role } from "@speego/shared";

config({ path: new URL("../../.env", import.meta.url) });
const env = loadEnv();
const url = new URL(env.DATABASE_URL ?? "http://invalid");
if (env.DB_PROVIDER !== "postgres" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== "/speego_local") {
  throw new Error("Seed chỉ được chạy với Postgres local /speego_local");
}
const repo = await createRepositories(env);
try {
  const hasher = new ScryptPasswordHasher();
  const password = env.SEED_USER_PASSWORD ?? "speego@demo";
  await seedDemoUsers(repo.users, hasher, password);
  const passwordHash = await hasher.hash(password);
  const members: {id:string;email:string;name:string;role:Role;title:string}[] = [
    {id:"local-mkt02",email:"mkt02@speegocorp.com",name:"Leader Marketing",role:"marketing-lead",title:"Leader Marketing"},
    {id:"local-mkt04",email:"mkt04@speegocorp.com",name:"Huy Content",role:"marketing-content",title:"Marketing Content"},
    {id:"local-mkt01",email:"mkt01@speegocorp.com",name:"Media 1",role:"marketing",title:"Media"},
  ];
  for (const member of members) await repo.users.upsert({...member,department:"Marketing",passwordHash});
  console.log("Local demo users and Marketing Leader/Content/Media accounts ready");
} finally { await repo.close(); }
