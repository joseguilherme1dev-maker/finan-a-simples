/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  type: 'income' | 'expense' | 'savings';
  date: string;
}

export interface FinancialState {
  balance: number;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  goal: number;
  transactions: Transaction[];
}

export type RepeatRule = 'none' | 'monthly';

export interface Bill {
  id: string;
  title: string;
  amount: number;
  /**
   * Base date for the bill (YYYY-MM-DD).
   * - For repeat=none: the bill only exists in this date/month.
   * - For repeat=monthly: this date provides the preferred day-of-month.
   */
  date: string;
  repeat: RepeatRule;
  /**
   * List of instance dates (YYYY-MM-DD) marked as paid.
   * For monthly bills, each month has its own instance date.
   */
  paidDates: string[];
}

export interface BillsState {
  bills: Bill[];
}
