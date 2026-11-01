import express from "express";
import { createApp } from "./src/app";
import { loadEnv } from "./src/config/env";
import { createContainer } from "./src/container";

// Vercel supplies process.env and manages the HTTP listener and process lifecycle.
// Keep standalone startup and local dotenv loading in src/main.ts.
const env = loadEnv();
const container = await createContainer(env);
const app = createApp(env, container, express());

export default app;
