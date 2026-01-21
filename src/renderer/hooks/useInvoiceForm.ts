import { useState, useCallback } from 'react';

interface LocationState {
  salespersonId?: number;
  salespersonName?: string;
}

export interface InvoiceFormState {
  invDate: Date;
  reference: string;
  clientId: number | null;
  isTaxable: boolean;
  pricing: string;
  creditTerms: string;
  salespersonId: number | null;
  salespersonName: string;
  originalInvNumber: string | null;
}

export interface InvoiceFormActions {
  setInvDate: (date: Date) => void;
  setReference: (ref: string) => void;
  setClientId: (id: number | null) => void;
  setIsTaxable: (taxable: boolean) => void;
  setPricing: (pricing: string) => void;
  setCreditTerms: (terms: string) => void;
  setSalespersonId: (id: number | null) => void;
  setSalespersonName: (name: string) => void;
  setOriginalInvNumber: (num: string | null) => void;
  resetForm: () => void;
  loadFromInvoice: (invoice: any) => void;
}

interface UseInvoiceFormOptions {
  locationState?: LocationState | null;
}

export function useInvoiceForm(options: UseInvoiceFormOptions = {}): [InvoiceFormState, InvoiceFormActions] {
  const { locationState } = options;

  const [invDate, setInvDate] = useState<Date>(new Date());
  const [reference, setReference] = useState('');
  const [clientId, setClientId] = useState<number | null>(null);
  const [isTaxable, setIsTaxable] = useState(true);
  const [pricing, setPricing] = useState('R'); // R = Retail, W = Wholesale
  const [creditTerms, setCreditTerms] = useState('');
  const [salespersonId, setSalespersonId] = useState<number | null>(locationState?.salespersonId ?? null);
  const [salespersonName, setSalespersonName] = useState<string>(locationState?.salespersonName ?? '');
  const [originalInvNumber, setOriginalInvNumber] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setInvDate(new Date());
    setReference('');
    setClientId(null);
    setIsTaxable(true);
    setPricing('R');
    setCreditTerms('');
    setSalespersonId(locationState?.salespersonId ?? null);
    setSalespersonName(locationState?.salespersonName ?? '');
    setOriginalInvNumber(null);
  }, [locationState]);

  const loadFromInvoice = useCallback((invoice: any) => {
    setInvDate(new Date(invoice.invDate));
    setReference(invoice.reference || '');
    setClientId(invoice.clientId);
    setIsTaxable(invoice.isTaxable);
    setPricing(invoice.pricing);
    setCreditTerms(invoice.creditTerms || '');
    setSalespersonId(invoice.salespersonId);
    setOriginalInvNumber(invoice.invNumber);
  }, []);

  const state: InvoiceFormState = {
    invDate,
    reference,
    clientId,
    isTaxable,
    pricing,
    creditTerms,
    salespersonId,
    salespersonName,
    originalInvNumber,
  };

  const actions: InvoiceFormActions = {
    setInvDate,
    setReference,
    setClientId,
    setIsTaxable,
    setPricing,
    setCreditTerms,
    setSalespersonId,
    setSalespersonName,
    setOriginalInvNumber,
    resetForm,
    loadFromInvoice,
  };

  return [state, actions];
}
