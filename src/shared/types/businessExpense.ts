export interface BusinessExpense {
  id: number;
  expenseDate: string;
  payee: string;
  category: string;
  description: string | null;
  amount: string;
  tax: string;
  total: string;
  paymentMethod: string | null;
  isTaxDeductible: boolean;
  referenceNo: string | null;
  authorizedById: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessExpenseFormValues {
  expenseDate: string;
  payee: string;
  category: string;
  description: string;
  amount: number | string;
  tax: number | string;
  paymentMethod: string | null;
  isTaxDeductible: boolean;
  referenceNo: string;
}
