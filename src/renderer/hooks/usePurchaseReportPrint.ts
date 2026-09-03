import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../shared/types/ipc';
import type { PrintOutputMode } from '../../shared/types/print';

export interface PurchaseReportPrintParams {
  year: number;
}

export function usePurchaseReportPrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const printPurchaseReport = useCallback(
    async (params: PurchaseReportPrintParams, outputMode: PrintOutputMode) => {
      setIsPrinting(true);
      try {
        const result = await window.electron.invoke(IpcChannel.PRINT_PURCHASE_REPORT, {
          ...params,
          outputMode,
        });

        if (result.success) {
          if (outputMode === 'pdf' && result.data?.pdfPath) {
            notifications.show({
              title: 'PDF Saved',
              message: `Saved to ${result.data.pdfPath}`,
              color: 'green',
            });
          } else if (outputMode === 'print') {
            notifications.show({
              title: 'Print Sent',
              message: 'Purchase report sent to printer',
              color: 'green',
            });
          }
        } else {
          if (result.error?.includes('cancelled') || result.error?.includes('canceled')) {
            return;
          }
          notifications.show({
            title: 'Print Error',
            message: result.error || 'Failed to generate purchase report',
            color: 'red',
          });
        }
      } catch (error) {
        notifications.show({
          title: 'Print Error',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          color: 'red',
        });
      } finally {
        setIsPrinting(false);
      }
    },
    [],
  );

  return { printPurchaseReport, isPrinting };
}
