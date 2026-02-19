import { useState, useEffect } from 'react';
import { Menu, Button, type ButtonProps } from '@mantine/core';
import { IconPrinter, IconFileTypePdf, IconEye } from '@tabler/icons-react';
import { usePrint } from '../../hooks/usePrint';
import type { PrintDocumentType, PrintSettingsConfig } from '../../../shared/types/print';
import { IpcChannel } from '../../../shared/types/ipc';

interface PrintButtonProps {
  documentType: PrintDocumentType;
  documentId: number;
  size?: ButtonProps['size'];
  variant?: ButtonProps['variant'];
}

export function PrintButton({ documentType, documentId, size = 'xs', variant = 'light' }: PrintButtonProps) {
  const { printDocument, isPrinting } = usePrint();
  const [isThermal, setIsThermal] = useState(false);

  useEffect(() => {
    window.electron.invoke(IpcChannel.GET_PRINT_SETTINGS).then((result: { success: boolean; data?: PrintSettingsConfig }) => {
      if (result.success && result.data) {
        setIsThermal(result.data.documentFormats[documentType] === 'thermal');
      }
    });
  }, [documentType]);

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
        {!isThermal && (
          <Menu.Item
            leftSection={<IconFileTypePdf size={16} />}
            onClick={() => printDocument(documentType, documentId, 'pdf')}
          >
            Save as PDF
          </Menu.Item>
        )}
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
