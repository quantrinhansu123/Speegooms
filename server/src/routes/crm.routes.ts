import { exchangeRate } from "../services/exchange-rate.service";
import express, { Router } from "express";
import { accountingContractSchema, convertMessageSchema, createContractSchema, createMessageSchema, opsContractSchema, quoteTemplateSchema, reassignQuoteSchema, saleContractPaymentSchema, updateMessageSchema, updatePotentialSchema, updateQuoteOutcomeSchema, updateQuoteSchema } from "@speego/shared";
import { asyncHandler } from "../lib/async-handler";
import { requireAnyPermission, requirePermission } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import type { AppContainer } from "../container";
import { crmActor } from "../lib/crm-actor";

export function crmRoutes(container: AppContainer) {
  const router = Router();
  const crm = container.crmController;
  router.use(container.authenticate);
  router.use((req, _res, next) => req.user ? crmActor.run(req.user, next) : next());
  router.get("/sales", requireAnyPermission(["message.convert", "potential.write"]), asyncHandler(crm.listSales));
  router.get("/potentials/:id/history", requirePermission("potential.read"), asyncHandler(crm.potentialHistory));
  router.get("/exchange-rate", requireAnyPermission(["quote.read", "quote.rfq"]), asyncHandler(async (req, res) => {
    const currency = typeof req.query.currency === "string" ? req.query.currency.toUpperCase() : "";
    res.json(await exchangeRate(currency));
  }));
  router.get("/messages", requirePermission("message.read"), asyncHandler(crm.listMessages));
  router.post("/messages", requirePermission("message.write"), validate({ body: createMessageSchema }), asyncHandler(crm.createMessage));
  router.patch("/messages/:id", requirePermission("message.write"), validate({ body: updateMessageSchema }), asyncHandler(crm.updateMessage));
  router.delete("/messages/:id", requirePermission("message.write"), asyncHandler(crm.deleteMessage));
  router.post("/messages/:id/convert", requirePermission("message.convert"), validate({ body: convertMessageSchema }), asyncHandler(crm.convertMessage));
  router.get("/potentials", requirePermission("potential.read"), asyncHandler(crm.listPotentials));
  router.patch("/potentials/:id", requirePermission("potential.write"), validate({ body: updatePotentialSchema }), asyncHandler(crm.updatePotential));
  router.delete("/potentials/:id", requirePermission("potential.write"), asyncHandler(crm.deletePotential));
  router.get("/potentials/:id/tracking", requireAnyPermission(["quote.read", "quote.rfq"]), asyncHandler(crm.getQuoteTracking));
  router.post("/potentials/:id/quotes", requirePermission("quote.request"), asyncHandler(crm.requestQuote));
  router.get("/potentials/:id/logistics-quote", requirePermission("quote.read"), asyncHandler(crm.potentialLogisticsQuote));
  router.get("/quotes", requirePermission("quote.read"), asyncHandler(crm.listQuotes));
  router.get("/quotes/:id/contract-source", requirePermission("contract.create"), asyncHandler(crm.contractSource));
  router.get("/rfq-quotes", requirePermission("quote.rfq"), asyncHandler(crm.listRfqQuotes));
  router.patch("/rfq-quotes/:id", requirePermission("quote.request"), validate({ body: reassignQuoteSchema }), asyncHandler(crm.reassignRfqQuote));
  router.delete("/rfq-quotes/:id", requirePermission("quote.request"), asyncHandler(crm.deleteRfqQuote));
  router.post("/quotes/:id/logistics", requirePermission("quote.logistics"), asyncHandler(crm.requestLogisticsQuote));
  router.post("/quotes/:id/handoff-logistics", requirePermission("quote.request"), asyncHandler(crm.handoffLogisticsOrder));
  router.post("/quotes/:id/handoff-sourcing", requirePermission("quote.request"), asyncHandler(crm.handoffSourcingOrder));
  router.patch("/quotes/:id/outcome", requirePermission("quote.request"), validate({ body: updateQuoteOutcomeSchema }), asyncHandler(crm.updateQuoteOutcome));
  router.patch("/quotes/:id", requireAnyPermission(["quote.ops", "quote.content"]), validate({ body: updateQuoteSchema }), asyncHandler(crm.updateQuote));
  router.post("/quotes/:id/send", requirePermission("quote.ops"), validate({ body: updateQuoteSchema }), asyncHandler(crm.sendQuote));
  router.post("/quotes/:id/return", requirePermission("quote.return"), asyncHandler(crm.returnQuote));
  router.get("/quote-templates", requirePermission("quote.read"), asyncHandler(crm.listQuoteTemplates));
  router.post("/quote-templates", requirePermission("quote.ops"), validate({ body: quoteTemplateSchema }), asyncHandler(crm.createQuoteTemplate));
  router.patch("/quote-templates/:id", requirePermission("quote.ops"), validate({ body: quoteTemplateSchema }), asyncHandler(crm.updateQuoteTemplate));
  router.delete("/quote-templates/:id", requirePermission("quote.ops"), asyncHandler(crm.deleteQuoteTemplate));
  router.get("/contracts", requirePermission("contract.read"), asyncHandler(crm.listContracts));
  router.post("/quotes/:id/contract", requirePermission("contract.create"), validate({ body: createContractSchema }), asyncHandler(crm.createContract));
  router.patch("/contracts/:id/ops", requirePermission("contract.ops"), validate({ body: opsContractSchema }), asyncHandler(crm.updateOpsContract));
  router.patch("/contracts/:id/accounting", requirePermission("contract.accounting"), validate({ body: accountingContractSchema }), asyncHandler(crm.updateAccountingContract));
  router.patch("/contracts/:id/commercial", requirePermission("contract.create"), validate({ body: saleContractPaymentSchema }), asyncHandler(crm.updateCommercialContract));
  router.post("/contracts/:id/resend", requirePermission("contract.resend"), asyncHandler(crm.resendContract));
  router.delete("/contracts/:id", requirePermission("contract.delete"), asyncHandler(crm.deleteContract));
  router.get("/import/:kind/template", asyncHandler(crm.importTemplate));
  router.post(
    "/import/:kind",
    express.raw({
      type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"],
      limit: "20mb",
    }),
    asyncHandler(crm.importWorkbook),
  );
  return router;
}
