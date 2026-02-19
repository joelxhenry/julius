import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../shared/types/ipc';
import type { PrintDocumentType, PrintOutputMode } from '../../shared/types/print';

export function usePrint() {
  const [isPrinting, setIsPrinting] = useState(false);

  const printDocument = useCallback(
    async (documentType: PrintDocumentType, documentId: number, outputMode: PrintOutputMode) => {
      setIsPrinting(true);
      try {
        const result = await window.electron.invoke(IpcChannel.PRINT_DOCUMENT, {
          documentType,
          documentId,
          outputMode,
        });

        if (result.success) {
          if (outputMode === 'pdf') {
            notifications.show({
              title: 'PDF Saved',
              message: result.data?.filePath
                ? `Saved to ${result.data.filePath}`
                : 'PDF saved successfully',
              color: 'green',
            });
          } else if (outputMode === 'print') {
            notifications.show({
              title: 'Print Sent',
              message: 'Document sent to printer',
              color: 'green',
            });
          }
        } else {
          // User cancelled (e.g. save dialog) — don't show error
          if (result.error?.includes('cancelled') || result.error?.includes('canceled')) {
            return;
          }
          notifications.show({
            title: 'Print Error',
            message: result.error || 'Failed to print document',
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

  return { printDocument, isPrinting };
}
