import { Menu, Button, type ButtonProps } from '@mantine/core';
import { IconListSearch, IconPrinter, IconEye } from '@tabler/icons-react';
import { useLookupTicket } from '../../hooks/useLookupTicket';
import type { LookupTicketSource } from '../../../shared/types/lookupTicket';

interface LookupTicketButtonProps {
  source: LookupTicketSource;
  inventoryItem?: {
    sku: string;
    description1: string | null;
    description2: string | null;
    location: string | null;
    quantity: number;
  };
  invoiceId?: number;
  quotationId?: number;
  sourceReference?: string;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
}

export function LookupTicketButton({
  source,
  inventoryItem,
  invoiceId,
  quotationId,
  sourceReference,
  size = 'xs',
  variant = 'light',
}: LookupTicketButtonProps) {
  const { printLookupTicket, isPrinting } = useLookupTicket();

  const handleAction = (outputMode: 'print' | 'preview') => {
    printLookupTicket({
      source,
      outputMode,
      inventoryItem,
      invoiceId,
      quotationId,
      sourceReference,
    });
  };

  return (
    <Menu shadow="md" width={180}>
      <Menu.Target>
        <Button
          size={size}
          variant={variant}
          color="orange"
          leftSection={<IconListSearch size={14} />}
          loading={isPrinting}
        >
          Lookup Ticket
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconPrinter size={16} />}
          onClick={() => handleAction('print')}
        >
          Print
        </Menu.Item>
        <Menu.Item
          leftSection={<IconEye size={16} />}
          onClick={() => handleAction('preview')}
        >
          Preview
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
