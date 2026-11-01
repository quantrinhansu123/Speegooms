import express from "express";
import { createVercelApp } from "./dist/vercel-app.js";

// Vercel manages the listener; runtime imports only built JavaScript.
export default await createVercelApp(express());
