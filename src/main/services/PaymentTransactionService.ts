import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import * as schema from '../database/schema';
import { PaymentService } from './PaymentService';
import { InvoiceService } from './InvoiceService';
import { CreditNoteService } from './CreditNoteService';
import { STORE_CREDIT_METHOD_CODE } from '../../shared/constants/payments';

export interface PaymentEntry {
  type: 'payment' | 'credit_note';
  paymentMethodCode?: string;
  creditNoteId?: number;
  amount: string;
  notes?: string;
  transactionReference?: string;
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

export type RefundMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD_VOID';

export interface RefundInvoiceParams {
  invoiceId: number;
  invoiceNumber: string;
  processedById: number;
  payerName?: string | null;
  amount: string; // positive refund amount
  method: RefundMethod;
  methodLabel: string; // human-readable label for the report (e.g. 'Cash')
  transactionReference?: string;
  notes?: string;
}

export interface RefundInvoiceResult {
  refundPayment: schema.Payment;
  invoice: schema.Invoice | null;
}

export interface VoidPaymentResult {
  originalPayment: schema.Payment;
  reversalPayment: schema.Payment;
  invoice: schema.Invoice | null;
  creditNoteRestored: schema.CreditNote | null;
}

/** An outstanding (active/partially-paid) invoice with its computed balance. */
export interface OutstandingInvoice {
  id: number;
  invNumber: string;
  invDate: string;
  total: string;
  totalPaid: string;
  balance: string; // total - totalPaid, always > 0
  status: string;
}

export interface ProcessClientBulkPaymentParams {
  clientId: number;
  processedById: number;
  payerName: string;
  amount: string; // total the client is paying
  paymentMethodCode: string;
  transactionReference?: string;
  notes?: string;
  // 'Select Payments' mode passes the chosen invoice ids; the amount is filled
  // across them FIFO (oldest first). Omitted/empty → 'Automatic Payments' mode:
  // apply FIFO across ALL of the client's outstanding invoices.
  invoiceIds?: number[];
}

export interface BulkPaymentAllocation {
  invoiceId: number;
  invoiceNumber: string;
  applied: string;
}

export interface ProcessClientBulkPaymentResult {
  allocations: BulkPaymentAllocation[];
  payments: schema.Payment[];
  totalApplied: string;
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
          // Notes only - do NOT fall back to the payment method code. If the
          // user leaves notes blank, paymentDesc stays blank (the method code
          // still lives in paymentDesc2).
          paymentDesc: entry.notes || undefined,
          paymentDesc2: entry.paymentMethodCode || undefined,
          transactionReference: entry.transactionReference || undefined,
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
   * Refund money on an invoice (return of funds to the customer).
   *
   * Records a negative INVOICE payment - mirroring the void reversal pattern -
   * and reduces the invoice's totalPaid so the sale's cash position stays
   * correct. Used by the "Process Return" flow when the operator refunds via
   * cash, bank transfer, or a card/credit void. Credit-note refunds do NOT come
   * through here (no money leaves; store credit is issued instead).
   */
  async refundInvoicePayment(params: RefundInvoiceParams): Promise<RefundInvoiceResult> {
    const { invoiceId, invoiceNumber, processedById, payerName, method, methodLabel, transactionReference, notes } = params;

    const refundAmount = parseFloat(params.amount || '0');
    if (refundAmount <= 0) {
      throw new Error('Refund amount must be greater than 0');
    }

    const invoice = await this.invoiceService.findById(invoiceId);
    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const currentPaid = parseFloat(invoice.totalPaid || '0');
    if (refundAmount > currentPaid + 0.01) {
      throw new Error(`Refund amount ($${refundAmount.toFixed(2)}) exceeds the amount paid ($${currentPaid.toFixed(2)})`);
    }

    const paymentDate = new Date().toISOString().split('T')[0];

    // Negative payment row so the refund nets against collected payments and
    // surfaces in the sales report. paymentDesc carries the human label (as the
    // void flow does); paymentDesc2 carries the method code.
    const refundPayment = await this.paymentService.create({
      documentType: 'INVOICE',
      documentNumber: invoiceNumber,
      invoiceNumber,
      amount: (-Math.abs(refundAmount)).toFixed(2),
      payerName: payerName ?? invoice.clientName ?? undefined,
      paymentDesc: `REFUND (${methodLabel})${notes ? ` - ${notes}` : ''}`,
      paymentDesc2: method,
      transactionReference: transactionReference || undefined,
      paymentDate,
      processedById,
    });

    const newTotalPaid = Math.max(0, currentPaid - refundAmount);
    const total = parseFloat(invoice.total || '0');

    let newStatus: string;
    if (total > 0 && newTotalPaid >= total) {
      newStatus = 'paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'partially_paid';
    } else {
      newStatus = 'active';
    }

    const updatedInvoice = await this.invoiceService.update(invoiceId, {
      totalPaid: newTotalPaid.toFixed(2),
      status: newStatus,
    });

    return { refundPayment, invoice: updatedInvoice };
  }

  /**
   * Get a client's outstanding invoices (any balance still due), ordered FIFO
   * - oldest invoice date first, then by id. Used both to populate the bulk
   * payment modal and, internally, as the target set for Automatic Payments.
   */
  async getClientOutstandingInvoices(clientId: number): Promise<OutstandingInvoice[]> {
    const invoices = await this.invoiceService.findByClient(clientId);

    return invoices
      .filter(inv => {
        if (inv.isArchived) return false;
        if (inv.status === 'cancelled' || inv.status === 'archived') return false;
        const balance = parseFloat(inv.total || '0') - parseFloat(inv.totalPaid || '0');
        return balance > 0.001;
      })
      .sort((a, b) => {
        // FIFO: oldest first by invoice date, tie-break on id.
        if (a.invDate !== b.invDate) return a.invDate < b.invDate ? -1 : 1;
        return a.id - b.id;
      })
      .map(inv => ({
        id: inv.id,
        invNumber: inv.invNumber,
        invDate: inv.invDate,
        total: inv.total,
        totalPaid: inv.totalPaid,
        balance: (parseFloat(inv.total || '0') - parseFloat(inv.totalPaid || '0')).toFixed(2),
        status: inv.status,
      }));
  }

  /**
   * Apply a single client payment across multiple outstanding invoices.
   *
   * The amount is filled FIFO (oldest invoice first) over the target set:
   *  - Automatic Payments: target set is ALL outstanding invoices.
   *  - Select Payments: target set is the invoiceIds the operator chose.
   *
   * Each invoice that receives money gets its own INVOICE payment row (mirroring
   * the single-invoice flow) and its totalPaid/status updated. Overpayment - an
   * amount larger than the target set's total balance - is rejected.
   *
   * When the payment method is Store Credit, the amount is instead drawn from
   * the client's credit notes (FIFO) and recorded as CREDIT applications -
   * see applyClientStoreCredit.
   */
  async processClientBulkPayment(params: ProcessClientBulkPaymentParams): Promise<ProcessClientBulkPaymentResult> {
    const { clientId, processedById, payerName, paymentMethodCode, transactionReference, notes, invoiceIds } = params;

    const totalAmount = parseFloat(params.amount || '0');
    if (totalAmount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }
    if (!paymentMethodCode) {
      throw new Error('A payment method is required');
    }

    const outstanding = await this.getClientOutstandingInvoices(clientId);

    // Restrict to the selected invoices (preserving FIFO order) when provided.
    let targets = outstanding;
    if (invoiceIds && invoiceIds.length > 0) {
      const idSet = new Set(invoiceIds);
      targets = outstanding.filter(inv => idSet.has(inv.id));
    }

    if (targets.length === 0) {
      throw new Error('There are no outstanding invoices to apply this payment to');
    }

    const totalOutstanding = targets.reduce((sum, inv) => sum + parseFloat(inv.balance), 0);
    if (totalAmount > totalOutstanding + 0.01) {
      throw new Error(
        `Payment amount ($${totalAmount.toFixed(2)}) exceeds the outstanding balance ($${totalOutstanding.toFixed(2)})`
      );
    }

    // Store credit is funded from the client's credit notes, not cash.
    if (paymentMethodCode === STORE_CREDIT_METHOD_CODE) {
      return this.applyClientStoreCredit(clientId, targets, totalAmount, payerName, processedById);
    }

    const paymentDate = new Date().toISOString().split('T')[0];
    const allocations: BulkPaymentAllocation[] = [];
    const createdPayments: schema.Payment[] = [];
    let remaining = totalAmount;

    for (const inv of targets) {
      if (remaining <= 0.001) break;
      const balance = parseFloat(inv.balance);
      const applied = Math.min(remaining, balance);
      const appliedStr = applied.toFixed(2);

      // One payment row per invoice - same shape as the single-invoice cash
      // payment path (notes → paymentDesc, method code → paymentDesc2).
      const payment = await this.paymentService.create({
        documentType: 'INVOICE',
        documentNumber: inv.invNumber,
        invoiceNumber: inv.invNumber,
        amount: appliedStr,
        payerName,
        paymentDesc: notes || undefined,
        paymentDesc2: paymentMethodCode,
        transactionReference: transactionReference || undefined,
        paymentDate,
        processedById,
      });
      createdPayments.push(payment);

      await this.invoiceService.recordPayment(inv.id, appliedStr);

      allocations.push({ invoiceId: inv.id, invoiceNumber: inv.invNumber, applied: appliedStr });
      remaining -= applied;
    }

    return {
      allocations,
      payments: createdPayments,
      totalApplied: (totalAmount - remaining).toFixed(2),
    };
  }

  /**
   * Fund a bulk payment from the client's credit notes (Store Credit).
   *
   * Draws the amount from available credit notes FIFO (oldest note first) and
   * applies it to the target invoices FIFO. Each (invoice, credit note) chunk
   * becomes a CREDIT payment row - matching the single-invoice "Apply Credit
   * Note" flow - and reduces the credit note's remaining balance. A single
   * invoice may be covered by more than one note, and one note may span several
   * invoices. Throws when the available store credit is less than the amount.
   */
  private async applyClientStoreCredit(
    clientId: number,
    targets: OutstandingInvoice[],
    totalAmount: number,
    payerName: string,
    processedById: number
  ): Promise<ProcessClientBulkPaymentResult> {
    // Available credit notes, oldest first (FIFO), each with its remaining balance.
    const creditNotes = (await this.getAvailableCreditNotes(clientId))
      .map(cn => ({ cn, available: parseFloat(cn.total || '0') - parseFloat(cn.totalUsed || '0') }))
      .filter(entry => entry.available > 0.001)
      .sort((a, b) => {
        if (a.cn.crDate !== b.cn.crDate) return a.cn.crDate < b.cn.crDate ? -1 : 1;
        return a.cn.id - b.cn.id;
      });

    const totalCredit = creditNotes.reduce((sum, entry) => sum + entry.available, 0);
    if (totalAmount > totalCredit + 0.01) {
      throw new Error(
        `Available store credit ($${totalCredit.toFixed(2)}) is less than the payment amount ($${totalAmount.toFixed(2)})`
      );
    }

    const paymentDate = new Date().toISOString().split('T')[0];
    const allocations: BulkPaymentAllocation[] = [];
    const createdPayments: schema.Payment[] = [];

    let cnIndex = 0;
    let remainingTotal = totalAmount;

    for (const inv of targets) {
      if (remainingTotal <= 0.001) break;
      let invNeed = Math.min(remainingTotal, parseFloat(inv.balance));
      let invApplied = 0;

      // Fill this invoice from credit notes in FIFO order.
      while (invNeed > 0.001 && cnIndex < creditNotes.length) {
        const entry = creditNotes[cnIndex];
        if (entry.available <= 0.001) {
          cnIndex++;
          continue;
        }
        const chunk = Math.min(invNeed, entry.available);
        const chunkStr = chunk.toFixed(2);

        // CREDIT payment row tying this invoice to the funding credit note.
        const payment = await this.paymentService.create({
          documentType: 'CREDIT',
          documentNumber: inv.invNumber,
          invoiceNumber: inv.invNumber,
          creditNoteNumber: entry.cn.crNumber,
          amount: chunkStr,
          payerName,
          paymentDesc: `Applied credit note ${entry.cn.crNumber}`,
          paymentDate,
          processedById,
        });
        createdPayments.push(payment);

        await this.creditNoteService.recordUsage(entry.cn.id, chunkStr);

        entry.available -= chunk;
        invApplied += chunk;
        invNeed -= chunk;
        remainingTotal -= chunk;
      }

      if (invApplied > 0.001) {
        await this.invoiceService.recordPayment(inv.id, invApplied.toFixed(2));
        allocations.push({ invoiceId: inv.id, invoiceNumber: inv.invNumber, applied: invApplied.toFixed(2) });
      }
    }

    return {
      allocations,
      payments: createdPayments,
      totalApplied: (totalAmount - remainingTotal).toFixed(2),
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
