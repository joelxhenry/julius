import { Menu, Button, type ButtonProps } from '@mantine/core';
import { IconPrinter, IconFileTypePdf, IconEye } from '@tabler/icons-react';
import { usePrint } from '../../hooks/usePrint';
import type { PrintDocumentType } from '../../../shared/types/print';

interface PrintButtonProps {
  documentType: PrintDocumentType;
  documentId: number;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
}

export function PrintButton({ documentType, documentId, size = 'xs', variant = 'light' }: PrintButtonProps) {
  const { printDocument, isPrinting } = usePrint();

  return (
    <Menu shadow="md" width={180}>
      <Menu.Target>
        <Button
          size={size}
          variant={variant}
          leftSection={<IconPrinter size={14} />}
          loading={isPrinting}
        >
          Print
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconPrinter size={16} />}
          onClick={() => printDocument(documentType, documentId, 'print')}
        >
          Print
        </Menu.Item>
        <Menu.Item
          leftSection={<IconFileTypePdf size={16} />}
          onClick={() => printDocument(documentType, documentId, 'pdf')}
        >
          Save as PDF
        </Menu.Item>
        <Menu.Item
          leftSection={<IconEye size={16} />}
          onClick={() => printDocument(documentType, documentId, 'preview')}
        >
          Preview
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
