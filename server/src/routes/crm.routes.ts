import { Router } from "express";
import { createMessageSchema, quoteTemplateSchema, reassignQuoteSchema, updateMessageSchema, updatePotentialSchema, updateQuoteSchema } from "@speego/shared";
import { asyncHandler } from "../lib/async-handler";
import { requirePermission } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import type { AppContainer } from "../container";

export function crmRoutes(container: AppContainer) {
  const router = Router();
  const crm = container.crmController;
  router.use(container.authenticate);
  router.get("/messages", requirePermission("message.read"), asyncHandler(crm.listMessages));
  router.post("/messages", requirePermission("message.write"), validate({ body: createMessageSchema }), asyncHandler(crm.createMessage));
  router.patch("/messages/:id", requirePermission("message.write"), validate({ body: updateMessageSchema }), asyncHandler(crm.updateMessage));
  router.delete("/messages/:id", requirePermission("message.write"), asyncHandler(crm.deleteMessage));
  router.post("/messages/:id/convert", requirePermission("message.convert"), asyncHandler(crm.convertMessage));
  router.get("/potentials", requirePermission("potential.read"), asyncHandler(crm.listPotentials));
  router.patch("/potentials/:id", requirePermission("potential.write"), validate({ body: updatePotentialSchema }), asyncHandler(crm.updatePotential));
  router.delete("/potentials/:id", requirePermission("potential.write"), asyncHandler(crm.deletePotential));
  router.post("/potentials/:id/quotes", requirePermission("quote.request"), asyncHandler(crm.requestQuote));
  router.get("/quotes", requirePermission("quote.read"), asyncHandler(crm.listQuotes));
  router.get("/rfq-quotes", requirePermission("quote.rfq"), asyncHandler(crm.listRfqQuotes));
  router.patch("/rfq-quotes/:id", requirePermission("quote.request"), validate({ body: reassignQuoteSchema }), asyncHandler(crm.reassignRfqQuote));
  router.delete("/rfq-quotes/:id", requirePermission("quote.request"), asyncHandler(crm.deleteRfqQuote));
  router.post("/quotes/:id/logistics", requirePermission("quote.logistics"), asyncHandler(crm.requestLogisticsQuote));
  router.patch("/quotes/:id", requirePermission("quote.ops"), validate({ body: updateQuoteSchema }), asyncHandler(crm.updateQuote));
  router.post("/quotes/:id/send", requirePermission("quote.ops"), validate({ body: updateQuoteSchema }), asyncHandler(crm.sendQuote));
  router.post("/quotes/:id/return", requirePermission("quote.return"), asyncHandler(crm.returnQuote));
  router.get("/quote-templates", requirePermission("quote.read"), asyncHandler(crm.listQuoteTemplates));
  router.post("/quote-templates", requirePermission("quote.ops"), validate({ body: quoteTemplateSchema }), asyncHandler(crm.createQuoteTemplate));
  router.patch("/quote-templates/:id", requirePermission("quote.ops"), validate({ body: quoteTemplateSchema }), asyncHandler(crm.updateQuoteTemplate));
  router.delete("/quote-templates/:id", requirePermission("quote.ops"), asyncHandler(crm.deleteQuoteTemplate));
  return router;
}
