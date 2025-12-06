import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '../database/schema';
import { PaymentService } from './PaymentService';
import { InvoiceService } from './InvoiceService';
import { CreditNoteService } from './CreditNoteService';

export interface PaymentEntry {
  type: 'payment' | 'credit_note';
  paymentMethodCode?: string;
  creditNoteId?: number;
  amount: string;
  notes?: string;
}

export interface ProcessInvoicePaymentParams {
  invoiceId: number;
  invoiceNumber: string;
  clientId: number | null;
  processedById: number;
  payerName: string;
  entries: PaymentEntry[];
}

export interface ProcessInvoicePaymentResult {
  payments: schema.Payment[];
  invoice: schema.Invoice;
  creditNotesUpdated: schema.CreditNote[];
}

export interface VoidPaymentParams {
  paymentId: number;
  voidedById: number;
  voidReason: string;
}

export interface VoidPaymentResult {
  originalPayment: schema.Payment;
  reversalPayment: schema.Payment;
  invoice: schema.Invoice | null;
  creditNoteRestored: schema.CreditNote | null;
}

export class PaymentTransactionService {
  constructor(
    private db: NodePgDatabase<typeof schema>,
    private paymentService: PaymentService,
    private invoiceService: InvoiceService,
    private creditNoteService: CreditNoteService
  ) {}

  /**
   * Process a full payment transaction for an invoice
   * Supports multiple payment methods and credit note applications
   */
  async processInvoicePayment(params: ProcessInvoicePaymentParams): Promise<ProcessInvoicePaymentResult> {
    const { invoiceId, invoiceNumber, clientId, processedById, payerName, entries } = params;

    // Validate entries
    if (!entries || entries.length === 0) {
      throw new Error('At least one payment entry is required');
    }

    // Calculate total payment amount
    const totalAmount = entries.reduce((sum, entry) => sum + parseFloat(entry.amount || '0'), 0);
    if (totalAmount <= 0) {
      throw new Error('Total payment amount must be greater than 0');
    }

    // Get current invoice to validate
    const invoice = await this.invoiceService.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const balanceDue = parseFloat(invoice.total) - parseFloat(invoice.totalPaid);
    if (totalAmount > balanceDue + 0.01) { // Small tolerance for floating point
      throw new Error(`Payment amount ($${totalAmount.toFixed(2)}) exceeds balance due ($${balanceDue.toFixed(2)})`);
    }

    // Validate credit notes if any
    for (const entry of entries) {
      if (entry.type === 'credit_note' && entry.creditNoteId) {
        const creditNote = await this.creditNoteService.findById(entry.creditNoteId);
        if (!creditNote) {
          throw new Error('Credit note not found');
        }
        if (creditNote.clientId !== clientId) {
          throw new Error('Credit note belongs to a different client');
        }
        const available = parseFloat(creditNote.total) - parseFloat(creditNote.totalUsed);
        if (parseFloat(entry.amount) > available + 0.01) {
          throw new Error(`Credit note ${creditNote.crNumber} has insufficient balance`);
        }
      }
    }

    const paymentDate = new Date().toISOString().split('T')[0];
    const createdPayments: schema.Payment[] = [];
    const updatedCreditNotes: schema.CreditNote[] = [];

    // Process each payment entry
    for (const entry of entries) {
      if (entry.type === 'payment') {
        // Regular payment (cash, card, etc.)
        const payment = await this.paymentService.create({
          documentType: 'INVOICE',
          documentNumber: invoiceNumber,
          invoiceNumber,
          amount: entry.amount,
          payerName,
          paymentDesc: entry.notes || entry.paymentMethodCode || undefined,
          paymentDesc2: entry.paymentMethodCode || undefined,
          paymentDate,
          processedById,
        });
        createdPayments.push(payment);
      } else if (entry.type === 'credit_note' && entry.creditNoteId) {
        // Credit note application
        const creditNote = await this.creditNoteService.findById(entry.creditNoteId);
        if (!creditNote) continue;

        // Create payment record for the credit note application
        const payment = await this.paymentService.create({
          documentType: 'CREDIT',
          documentNumber: invoiceNumber,
          invoiceNumber,
          creditNoteNumber: creditNote.crNumber,
          amount: entry.amount,
          payerName,
          paymentDesc: `Applied credit note ${creditNote.crNumber}`,
          paymentDate,
          processedById,
        });
        createdPayments.push(payment);

        // Update credit note usage
        const updatedCreditNote = await this.creditNoteService.recordUsage(entry.creditNoteId, entry.amount);
        if (updatedCreditNote) {
          updatedCreditNotes.push(updatedCreditNote);
        }
      }
    }

    // Update invoice totalPaid
    const updatedInvoice = await this.invoiceService.recordPayment(invoiceId, totalAmount.toFixed(2));
    if (!updatedInvoice) {
      throw new Error('Failed to update invoice payment');
    }

    return {
      payments: createdPayments,
      invoice: updatedInvoice,
      creditNotesUpdated: updatedCreditNotes,
    };
  }

  /**
   * Void/reverse a payment
   * Creates a reversal record and updates invoice balance
   */
  async voidPayment(params: VoidPaymentParams): Promise<VoidPaymentResult> {
    const { paymentId, voidedById, voidReason } = params;

    // Get original payment
    const originalPayment = await this.paymentService.findById(paymentId);
    if (!originalPayment) {
      throw new Error('Payment not found');
    }

    // Check if already voided (look for a reversal payment)
    const existingPayments = await this.db
      .select()
      .from(schema.payments)
      .where(
        and(
          eq(schema.payments.documentNumber, originalPayment.documentNumber),
          eq(schema.payments.documentType, originalPayment.documentType)
        )
      );

    const hasReversal = existingPayments.some(p =>
      parseFloat(p.amount) < 0 &&
      p.paymentDesc?.includes('VOID') &&
      Math.abs(parseFloat(p.amount)) === Math.abs(parseFloat(originalPayment.amount))
    );

    if (hasReversal) {
      throw new Error('This payment has already been voided');
    }

    const paymentDate = new Date().toISOString().split('T')[0];

    // Create reversal payment (negative amount)
    const reversalPayment = await this.paymentService.create({
      documentType: originalPayment.documentType as 'INVOICE' | 'CREDIT' | 'BILL',
      documentNumber: originalPayment.documentNumber,
      invoiceNumber: originalPayment.invoiceNumber,
      creditNoteNumber: originalPayment.creditNoteNumber,
      billNumber: originalPayment.billNumber,
      amount: (-Math.abs(parseFloat(originalPayment.amount))).toFixed(2),
      payerName: originalPayment.payerName,
      paymentDesc: `VOID: ${voidReason}`,
      paymentDate,
      processedById: voidedById,
    });

    let updatedInvoice: schema.Invoice | null = null;
    let restoredCreditNote: schema.CreditNote | null = null;

    // Update invoice if this was an invoice payment
    if (originalPayment.invoiceNumber) {
      const invoice = await this.invoiceService.findByInvNumber(originalPayment.invoiceNumber);
      if (invoice) {
        // Decrease totalPaid
        const currentPaid = parseFloat(invoice.totalPaid || '0');
        const reversalAmount = Math.abs(parseFloat(originalPayment.amount));
        const newTotalPaid = Math.max(0, currentPaid - reversalAmount);
        const total = parseFloat(invoice.total || '0');

        // Determine new status
        let newStatus: string;
        if (newTotalPaid >= total) {
          newStatus = 'paid';
        } else if (newTotalPaid > 0) {
          newStatus = 'partially_paid';
        } else {
          newStatus = 'active';
        }

        updatedInvoice = await this.invoiceService.update(invoice.id, {
          totalPaid: newTotalPaid.toFixed(2),
          status: newStatus,
        });
      }
    }

    // Restore credit note balance if this was a credit note application
    if (originalPayment.documentType === 'CREDIT' && originalPayment.creditNoteNumber) {
      const creditNote = await this.db
        .select()
        .from(schema.creditNotes)
        .where(eq(schema.creditNotes.crNumber, originalPayment.creditNoteNumber))
        .limit(1);

      if (creditNote[0]) {
        const currentUsed = parseFloat(creditNote[0].totalUsed || '0');
        const restoreAmount = Math.abs(parseFloat(originalPayment.amount));
        const newTotalUsed = Math.max(0, currentUsed - restoreAmount);
        const total = parseFloat(creditNote[0].total || '0');

        // Determine new status
        const newStatus = newTotalUsed >= total ? 'U' : 'A';

        const [updated] = await this.db
          .update(schema.creditNotes)
          .set({
            totalUsed: newTotalUsed.toFixed(2),
            status: newStatus,
          })
          .where(eq(schema.creditNotes.id, creditNote[0].id))
          .returning();

        restoredCreditNote = updated;
      }
    }

    return {
      originalPayment,
      reversalPayment,
      invoice: updatedInvoice,
      creditNoteRestored: restoredCreditNote,
    };
  }

  /**
   * Get available credit notes for a client
   */
  async getAvailableCreditNotes(clientId: number): Promise<schema.CreditNote[]> {
    const creditNotes = await this.db
      .select()
      .from(schema.creditNotes)
      .where(
        and(
          eq(schema.creditNotes.clientId, clientId),
          eq(schema.creditNotes.status, 'A'),
          eq(schema.creditNotes.isArchived, false)
        )
      );

    // Filter to only those with available balance
    return creditNotes.filter(cn => {
      const total = parseFloat(cn.total || '0');
      const used = parseFloat(cn.totalUsed || '0');
      return total > used;
    });
  }
}
