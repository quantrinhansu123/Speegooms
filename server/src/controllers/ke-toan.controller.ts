import type { Request, Response } from "express";
import { AppError } from "../lib/errors";
import { readPagination } from "../lib/pagination";
import { readExpenseSearch, readPaymentSearch, readPayrollSearch, readLedgerSearch, readLedgerOrderQuery, readLedgerReportGroup } from "../search/parse-list-search";
import type { KeToanService } from "../services/ke-toan.service";

function actorName(req: Request): string {
  const user = req.user;
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
  return user.name;
}

export class KeToanController {
  constructor(private readonly keToan: KeToanService) {}

  listLedgerCounterparties = async (_req: Request, res: Response) => {
    res.status(200).json({ counterparties: await this.keToan.listLedgerCounterparties() });
  };

  listReceivingAccounts = async (_req: Request, res: Response) => {
    res.status(200).json({ accounts: await this.keToan.listReceivingAccounts() });
  };
  createReceivingAccount = async (req: Request, res: Response) => {
    res.status(201).json({ account: await this.keToan.createReceivingAccount(req.body.name) });
  };
  listLedger = async (req: Request, res: Response) => {
    const result = await this.keToan.pageLedger(readLedgerSearch(req), readPagination(req));
    res.status(200).json({ entries: result.rows, pagination: result.pagination });
  };
  listLedgerReport = async (req: Request, res: Response) => {
    const result = await this.keToan.pageLedgerReport(readLedgerSearch(req), readLedgerReportGroup(req), readPagination(req));
    res.status(200).json({ report: result.rows, pagination: result.pagination });
  };
  listStatements = async (req: Request, res: Response) => {
    const candidateFor = req.query.candidateFor;
    if (candidateFor !== undefined && (typeof candidateFor !== "string" || !/^[0-9a-f-]{36}$/i.test(candidateFor))) throw new AppError(400, "VALIDATION_ERROR", "Khoản thu chi không hợp lệ");
    const result = await this.keToan.pageStatements(readPagination(req), candidateFor);
    res.status(200).json({ statements: result.rows, pagination: result.pagination });
  };
  listLedgerOrders = async (req: Request, res: Response) => {
    const result = await this.keToan.pageLedgerOrders(readLedgerOrderQuery(req), readPagination(req));
    res.status(200).json({ orders: result.rows, pagination: result.pagination });
  };
  createStatement = async (req: Request, res: Response) => {
    res.status(201).json({ statement: await this.keToan.createStatement(req.body) });
  };
  createLedger = async (req: Request, res: Response) => {
    res.status(201).json({ entry: await this.keToan.createLedger(req.body) });
  };
  updateLedger = async (req: Request, res: Response) => {
    res.status(200).json({ entry: await this.keToan.updateLedger(String(req.params.id), req.body) });
  };
  deleteLedger = async (req: Request, res: Response) => {
    await this.keToan.deleteLedger(String(req.params.id));
    res.status(204).end();
  };
  reconcileLedger = async (req: Request, res: Response) => {
    res.status(200).json({ entry: await this.keToan.reconcileLedger(String(req.params.id), req.body.statementId) });
  };

  listPaymentOrders = async (_req: Request, res: Response) => {
    res.status(200).json({ orders: await this.keToan.listPaymentOrders() });
  };

  listPaymentEmployees = async (_req: Request, res: Response) => {
    res.status(200).json({ employees: await this.keToan.listPaymentEmployees() });
  };

  listPayments = async (req: Request, res: Response) => {
    const result = await this.keToan.pagePayments(readPaymentSearch(req), readPagination(req));
    res.status(200).json({ payments: result.rows, pagination: result.pagination });
  };

  createPayment = async (req: Request, res: Response) => {
    res.status(201).json({ payment: await this.keToan.createPayment(req.body, actorName(req)) });
  };

  listPayroll = async (req: Request, res: Response) => {
    const result = await this.keToan.pagePayroll(readPayrollSearch(req), readPagination(req));
    res.status(200).json({ payroll: result.rows, pagination: result.pagination });
  };

  createPayroll = async (req: Request, res: Response) => {
    res.status(201).json({ payroll: await this.keToan.createPayroll(req.body) });
  };

  listExpenses = async (req: Request, res: Response) => {
    const result = await this.keToan.pageExpenses(readExpenseSearch(req), readPagination(req));
    res.status(200).json({ expenses: result.rows, pagination: result.pagination });
  };

  createExpense = async (req: Request, res: Response) => {
    res.status(201).json({ expense: await this.keToan.createExpense(req.body) });
  };
}
