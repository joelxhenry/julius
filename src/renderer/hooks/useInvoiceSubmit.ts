import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../shared/types/ipc';
import { Client } from './useClientSearch';
import { LineItem } from './useLineItems';
import { AdminOverrideResult, PaymentEntry, CreditCheckResult } from '../components/invoices';

interface InvoiceTotals {
  subTotal: number;
  tax: number;
  total: number;
}

interface InvoiceFormData {
  invDate: Date;
  reference: string;
  clientId: number | null;
  isTaxable: boolean;
  pricing: string;
  creditTerms: string;
  salespersonId: number | null;
}

interface UseInvoiceSubmitOptions {
  formData: InvoiceFormData;
  client: Client | null;
  lineItems: LineItem[];
  totals: InvoiceTotals;
  creditCheck: CreditCheckResult | null;
}

export function useInvoiceSubmit({
  formData,
  client,
  lineItems,
  totals,
  creditCheck,
}: UseInvoiceSubmitOptions) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isPaymentFlow, setIsPaymentFlow] = useState(false);
  const [adminOverride, setAdminOverride] = useState<AdminOverrideResult | undefined>(undefined);

  // Modals
  const [overrideModalOpen, { open: openOverrideModal, close: closeOverrideModal }] = useDisclosure(false);
  const [issueModalOpen, { open: openIssueModal, close: closeIssueModal }] = useDisclosure(false);
  const [paymentEntryModalOpen, { open: openPaymentEntryModal, close: closePaymentEntryModal }] = useDisclosure(false);

  // Issue invoice directly
  const handleIssueInvoice = useCallback(() => {
    if (creditCheck?.requiresAdminOverride) {
      openOverrideModal();
      return;
    }
    openIssueModal();
  }, [creditCheck, openOverrideModal, openIssueModal]);

  // Handle save & process payment - initiates the flow
  const handleSaveAndProcessPayment = useCallback(() => {
    if (creditCheck?.requiresAdminOverride) {
      setIsPaymentFlow(true);
      openOverrideModal();
      return;
    }
    setIsPaymentFlow(true);
    openIssueModal();
  }, [creditCheck, openOverrideModal, openIssueModal]);

  // Show payment entry modal (after verification)
  const handleShowPaymentEntry = useCallback(
    (override?: AdminOverrideResult) => {
      if (lineItems.length === 0) {
        notifications.show({
          title: 'Error',
          message: 'Please add at least one line item',
          color: 'red',
        });
        return;
      }
      setAdminOverride(override);
      openPaymentEntryModal();
    },
    [lineItems, openPaymentEntryModal]
  );

  // Handle create invoice with payment (atomic transaction)
  const handleCreateInvoiceWithPayment = useCallback(
    async (paymentEntries: PaymentEntry[]) => {
      setIsSaving(true);
      try {
        const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE_WITH_PAYMENT, {
          invoiceData: {
            invDate: formData.invDate.toISOString().split('T')[0],
            salespersonId: formData.salespersonId,
            clientId: formData.clientId,
            clientName: client?.clientName || null,
            clientAddress1: client?.address1 || null,
            clientAddress2: client?.address2 || null,
            clientPhone: client?.phone || null,
            reference: formData.reference || null,
            subTotal: totals.subTotal.toFixed(2),
            tax: totals.tax.toFixed(2),
            total: totals.total.toFixed(2),
            isTaxable: formData.isTaxable,
            pricing: formData.pricing,
            creditTerms: formData.creditTerms || null,
            issuedAt: new Date(),
            issuedById: formData.salespersonId,
            ...(adminOverride && {
              adminOverrideById: adminOverride.adminId,
              adminOverrideNotes: adminOverride.notes,
              adminOverrideAt: new Date(),
            }),
          },
          lineItems: lineItems.map((item, i) => ({
            lineNumber: i + 1,
            sku: item.sku || null,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toFixed(2),
            discount: item.discount.toFixed(2),
            isTaxable: item.isTaxable,
            amount: item.amount.toFixed(2),
          })),
          paymentEntries,
          processedById: formData.salespersonId!,
          payerName: client?.clientName || 'Cash Customer',
        });

        if (result.success) {
          const { invoice, warnings } = result.data;

          notifications.show({
            title: 'Success',
            message: `Invoice ${invoice.invNumber} created and ${invoice.status === 'paid' ? 'paid' : 'partially paid'}`,
            color: 'green',
          });

          if (warnings.length > 0) {
            warnings.forEach((w: string) =>
              notifications.show({ message: w, color: 'yellow' })
            );
          }

          navigate(`/invoices/${invoice.id}`);
        } else {
          notifications.show({
            title: 'Error',
            message: result.error,
            color: 'red',
          });
        }
      } catch (error) {
        notifications.show({
          title: 'Error',
          message: error instanceof Error ? error.message : 'Failed to create invoice',
          color: 'red',
        });
      } finally {
        setIsSaving(false);
        closePaymentEntryModal();
      }
    },
    [formData, client, totals, lineItems, navigate, closePaymentEntryModal, adminOverride]
  );

  // Handle issue after verification
  const handleIssueVerified = useCallback(
    async (override?: AdminOverrideResult) => {
      if (lineItems.length === 0) {
        notifications.show({
          title: 'Error',
          message: 'Please add at least one line item',
          color: 'red',
        });
        return;
      }

      setIsSaving(true);
      try {
        const invoiceData = {
          invDate: formData.invDate.toISOString().split('T')[0],
          salespersonId: formData.salespersonId,
          clientId: formData.clientId,
          clientName: client?.clientName || null,
          clientAddress1: client?.address1 || null,
          clientAddress2: client?.address2 || null,
          clientPhone: client?.phone || null,
          reference: formData.reference || null,
          subTotal: totals.subTotal.toFixed(2),
          tax: totals.tax.toFixed(2),
          total: totals.total.toFixed(2),
          totalPaid: '0',
          status: 'active',
          isTaxable: formData.isTaxable,
          pricing: formData.pricing,
          creditTerms: formData.creditTerms || null,
          issuedAt: new Date(),
          issuedById: formData.salespersonId,
          ...(override && {
            adminOverrideById: override.adminId,
            adminOverrideNotes: override.notes,
            adminOverrideAt: new Date(),
          }),
        };

        const result = await window.electron.invoke(IpcChannel.CREATE_INVOICE, invoiceData);
        if (!result.success) {
          throw new Error(result.error || 'Failed to create invoice');
        }

        const invoiceId = result.data.id;
        const invNumber = result.data.invNumber;

        // Save line items
        for (let i = 0; i < lineItems.length; i++) {
          const item = lineItems[i];
          await window.electron.invoke(IpcChannel.CREATE_DOCUMENT_LINE_ITEM, {
            documentType: 'INVOICE',
            documentNumber: invNumber,
            lineNumber: i + 1,
            sku: item.sku || null,
            description: item.description,
            quantity: item.quantity.toString(),
            unitPrice: item.unitPrice.toFixed(2),
            discount: item.discount.toFixed(2),
            isTaxable: item.isTaxable,
            amount: item.amount.toFixed(2),
          });
        }

        // Create inventory transactions (reduce stock)
        const transactionResult = await window.electron.invoke(IpcChannel.CREATE_INVOICE_TRANSACTIONS, {
          invNumber,
          lineItems: lineItems.map(item => ({ sku: item.sku, quantity: item.quantity })),
          invDate: formData.invDate.toISOString().split('T')[0],
        });

        if (!transactionResult.success) {
          console.error('Warning: Failed to create inventory transactions:', transactionResult.error);
          notifications.show({
            title: 'Warning',
            message: 'Invoice created but inventory may not have been updated',
            color: 'yellow',
          });
        }

        notifications.show({
          title: 'Success',
          message: `Invoice ${invNumber} created and issued`,
          color: 'green',
        });

        navigate(`/invoices/${invoiceId}`);
      } catch (error) {
        console.error('Failed to issue invoice:', error);
        notifications.show({
          title: 'Error',
          message: error instanceof Error ? error.message : 'Failed to issue invoice',
          color: 'red',
        });
      } finally {
        setIsSaving(false);
      }
    },
    [formData, client, totals, lineItems, navigate]
  );

  // Handle override modal close
  const handleOverrideClose = useCallback(() => {
    closeOverrideModal();
    setIsPaymentFlow(false);
  }, [closeOverrideModal]);

  // Handle override approved
  const handleOverrideApproved = useCallback(
    (result: AdminOverrideResult) => {
      closeOverrideModal();
      if (isPaymentFlow) {
        handleShowPaymentEntry(result);
        setIsPaymentFlow(false);
      } else {
        handleIssueVerified(result);
      }
    },
    [closeOverrideModal, isPaymentFlow, handleShowPaymentEntry, handleIssueVerified]
  );

  // Handle issue modal close
  const handleIssueModalClose = useCallback(() => {
    closeIssueModal();
    setIsPaymentFlow(false);
  }, [closeIssueModal]);

  // Handle issue modal verified
  const handleIssueModalVerified = useCallback(() => {
    closeIssueModal();
    if (isPaymentFlow) {
      handleShowPaymentEntry();
      setIsPaymentFlow(false);
    } else {
      handleIssueVerified();
    }
  }, [closeIssueModal, isPaymentFlow, handleShowPaymentEntry, handleIssueVerified]);

  return {
    isSaving,
    // Actions
    handleIssueInvoice,
    handleSaveAndProcessPayment,
    handleCreateInvoiceWithPayment,
    handleIssueVerified,
    // Modal states
    overrideModalOpen,
    issueModalOpen,
    paymentEntryModalOpen,
    // Modal handlers
    handleOverrideClose,
    handleOverrideApproved,
    handleIssueModalClose,
    handleIssueModalVerified,
    closePaymentEntryModal,
  };
}
