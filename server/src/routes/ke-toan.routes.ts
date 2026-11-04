import { Router } from "express";
import { createInternalExpenseSchema, createPaymentRequestSchema, createPayrollSchema } from "@speego/shared";
import { asyncHandler } from "../lib/async-handler";
import { requirePermission } from "../middlewares/authorize";
import { validate } from "../middlewares/validate";
import type { AppContainer } from "../container";

export function keToanRoutes(container: AppContainer) {
  const router = Router();
  const keToan = container.keToanController;
  router.use(container.authenticate);

  router.get("/payment-orders", requirePermission("payment.create"), asyncHandler(keToan.listPaymentOrders));
  router.get("/payments", requirePermission("payment.read"), asyncHandler(keToan.listPayments));
  router.post("/payments", requirePermission("payment.create"), validate({ body: createPaymentRequestSchema }), asyncHandler(keToan.createPayment));

  router.get("/payroll", requirePermission("payroll.read"), asyncHandler(keToan.listPayroll));
  router.post("/payroll", requirePermission("payroll.write"), validate({ body: createPayrollSchema }), asyncHandler(keToan.createPayroll));

  router.get("/expenses", requirePermission("expense.read"), asyncHandler(keToan.listExpenses));
  router.post("/expenses", requirePermission("expense.write"), validate({ body: createInternalExpenseSchema }), asyncHandler(keToan.createExpense));
  return router;
}
