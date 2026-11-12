import type { Request, Response } from "express";
import { AppError } from "../lib/errors";
import { readExpenseSearch, readPaymentSearch, readPayrollSearch } from "../search/parse-list-search";
import type { KeToanService } from "../services/ke-toan.service";

function actorName(req: Request): string {
  const user = req.user;
  if (!user) throw new AppError(401, "UNAUTHENTICATED", "Chưa đăng nhập");
  return user.name;
}

export class KeToanController {
  constructor(private readonly keToan: KeToanService) {}

  listReceivingAccounts = async (_req: Request, res: Response) => {
    res.status(200).json({ accounts: await this.keToan.listReceivingAccounts() });
  };
  createReceivingAccount = async (req: Request, res: Response) => {
    res.status(201).json({ account: await this.keToan.createReceivingAccount(req.body.name) });
  };
  listLedger = async (_req: Request, res: Response) => {
    res.status(200).json({ entries: await this.keToan.listLedger() });
  };
  listStatements = async (_req: Request, res: Response) => {
    res.status(200).json({ statements: await this.keToan.listStatements() });
  };
  listLedgerOrders = async (_req: Request, res: Response) => {
    res.status(200).json({ orders: await this.keToan.listLedgerOrders() });
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
    res.status(200).json({ payments: await this.keToan.listPayments(readPaymentSearch(req)) });
  };

  createPayment = async (req: Request, res: Response) => {
    res.status(201).json({ payment: await this.keToan.createPayment(req.body, actorName(req)) });
  };

  listPayroll = async (req: Request, res: Response) => {
    res.status(200).json({ payroll: await this.keToan.listPayroll(readPayrollSearch(req)) });
  };

  createPayroll = async (req: Request, res: Response) => {
    res.status(201).json({ payroll: await this.keToan.createPayroll(req.body) });
  };

  listExpenses = async (req: Request, res: Response) => {
    res.status(200).json({ expenses: await this.keToan.listExpenses(readExpenseSearch(req)) });
  };

  createExpense = async (req: Request, res: Response) => {
    res.status(201).json({ expense: await this.keToan.createExpense(req.body) });
  };
}
