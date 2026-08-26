import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../shared/types/ipc';
import type { PrintOutputMode } from '../../shared/types/print';

export interface ClientStatementParams {
  clientId: number;
  startDate?: string | null;
  endDate?: string | null;
}

export function useClientStatementPrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const printClientStatement = useCallback(
    async (params: ClientStatementParams, outputMode: PrintOutputMode) => {
      setIsPrinting(true);
      try {
        const result = await window.electron.invoke(IpcChannel.PRINT_CLIENT_STATEMENT, {
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
              message: 'Statement sent to printer',
              color: 'green',
            });
          }
        } else {
          if (result.error?.includes('cancelled') || result.error?.includes('canceled')) {
            return;
          }
          notifications.show({
            title: 'Print Error',
            message: result.error || 'Failed to generate statement',
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

  return { printClientStatement, isPrinting };
}
