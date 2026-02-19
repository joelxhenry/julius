import { useState, useCallback } from 'react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../shared/types/ipc';
import type { LookupTicketRequest } from '../../shared/types/lookupTicket';

export function useLookupTicket() {
  const [isPrinting, setIsPrinting] = useState(false);

  const printLookupTicket = useCallback(async (request: LookupTicketRequest) => {
    setIsPrinting(true);
    try {
      const result = await window.electron.invoke(IpcChannel.PRINT_LOOKUP_TICKET, request);

      if (result.success) {
        if (request.outputMode === 'print') {
          notifications.show({
            title: 'Print Sent',
            message: 'Lookup ticket sent to printer',
            color: 'green',
          });
        }
      } else {
        if (result.error?.includes('cancelled') || result.error?.includes('canceled')) {
          return;
        }
        notifications.show({
          title: 'Print Error',
          message: result.error || 'Failed to print lookup ticket',
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
  }, []);

  return { printLookupTicket, isPrinting };
}
