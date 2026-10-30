import assert from "node:assert/strict";
import { test } from "node:test";
import { loadEnv } from "./env";

const productionSecrets = {
  NODE_ENV: "production",
  SESSION_SECRET: "x".repeat(40),
  CSRF_SECRET: "y".repeat(40),
  CORS_ORIGINS: "https://app.speego.vn",
};

test("development defaults to the memory adapter", () => {
  const env = loadEnv({ NODE_ENV: "development" });
  assert.equal(env.DB_PROVIDER, "memory");
  assert.equal(env.HOST, "127.0.0.1");
  assert.equal(env.PORT, 4000);
  assert.equal(env.SEED_USER_PASSWORD, "speego@demo");
  assert.equal(env.TRUST_PROXY, false);
  assert.equal(env.PG_POOL_MAX, 10);
});

test("vercel trusts the proxy, shrinks the pool, and allows its own origin", () => {
  const env = loadEnv({
    ...productionSecrets,
    DB_PROVIDER: "postgres",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/speego",
    VERCEL: "1",
    VERCEL_URL: "speego-abc.vercel.app",
  });
  assert.equal(env.TRUST_PROXY, true);
  assert.equal(env.PG_POOL_MAX, 1);
  assert.deepEqual(env.CORS_ORIGINS, ["https://app.speego.vn", "https://speego-abc.vercel.app"]);
});

test("explicit trust proxy false is kept on vercel", () => {
  const env = loadEnv({
    NODE_ENV: "development",
    VERCEL: "1",
    TRUST_PROXY: "false",
  });
  assert.equal(env.TRUST_PROXY, false);
  assert.equal(env.PG_POOL_MAX, 1);
});

test("vercel origin is not duplicated", () => {
  const env = loadEnv({
    NODE_ENV: "development",
    CORS_ORIGINS: "https://speego-abc.vercel.app",
    VERCEL_URL: "speego-abc.vercel.app",
  });
  assert.deepEqual(env.CORS_ORIGINS, ["https://speego-abc.vercel.app"]);
  assert.equal(env.PG_POOL_MAX, 10);
});

test("production rejects the memory adapter", () => {
  assert.throws(
    () => loadEnv({ ...productionSecrets, DB_PROVIDER: "memory" }),
    /memory/,
  );
});

test("postgres requires a postgresql url", () => {
  assert.throws(() => loadEnv({ ...productionSecrets, DB_PROVIDER: "postgres" }), /DATABASE_URL/);
  assert.throws(
    () => loadEnv({ ...productionSecrets, DB_PROVIDER: "postgres", DATABASE_URL: "mysql://localhost/speego" }),
    /DATABASE_URL/,
  );
});

test("cors rejects a wildcard", () => {
  assert.throws(
    () => loadEnv({ NODE_ENV: "development", CORS_ORIGINS: "*" }),
    /CORS/,
  );
});

test("cloudinary requires all three credential keys together", () => {
  assert.throws(
    () => loadEnv({ NODE_ENV: "development", CLOUDINARY_CLOUD_NAME: "demo" }),
    /CLOUDINARY_CLOUD_NAME/,
  );
  const env = loadEnv({
    NODE_ENV: "development",
    CLOUDINARY_CLOUD_NAME: "demo",
    CLOUDINARY_API_KEY: "123456789012345",
    CLOUDINARY_API_SECRET: "secret-value-here",
    CLOUDINARY_UPLOAD_FOLDER: "speego",
  });
  assert.equal(env.CLOUDINARY_CLOUD_NAME, "demo");
  assert.equal(env.CLOUDINARY_API_KEY, "123456789012345");
  assert.equal(env.CLOUDINARY_API_SECRET, "secret-value-here");
  assert.equal(env.CLOUDINARY_UPLOAD_FOLDER, "speego");
});

test("cloudinary upload folder defaults to speego", () => {
  const env = loadEnv({
    NODE_ENV: "development",
    CLOUDINARY_CLOUD_NAME: "demo",
    CLOUDINARY_API_KEY: "123456789012345",
    CLOUDINARY_API_SECRET: "secret-value-here",
  });
  assert.equal(env.CLOUDINARY_UPLOAD_FOLDER, "speego");
});
