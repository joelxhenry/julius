import { IpcChannel } from '../../shared/types/ipc';

export interface BusinessExpenseQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string;
  isTaxDeductible?: boolean;
  startDate?: string;
  endDate?: string;
}

// Module-level (not re-created per render) so consumers can safely depend on
// these in useCallback/useEffect deps without causing re-render loops.
const getExpenses = (params: BusinessExpenseQuery = {}) =>
  window.electron.invoke(IpcChannel.GET_BUSINESS_EXPENSES, params);

const getExpense = (id: number) =>
  window.electron.invoke(IpcChannel.GET_BUSINESS_EXPENSE, { id });

const createExpense = (data: Record<string, unknown>) =>
  window.electron.invoke(IpcChannel.CREATE_BUSINESS_EXPENSE, data);

const updateExpense = (id: number, data: Record<string, unknown>) =>
  window.electron.invoke(IpcChannel.UPDATE_BUSINESS_EXPENSE, { id, data });

const deleteExpense = (id: number) =>
  window.electron.invoke(IpcChannel.DELETE_BUSINESS_EXPENSE, { id });

export function useBusinessExpenses() {
  return { getExpenses, getExpense, createExpense, updateExpense, deleteExpense };
}
