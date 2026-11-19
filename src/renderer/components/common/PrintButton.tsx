import { useState, useEffect } from 'react';
import { Menu, Button, Modal, Stack, Checkbox, Group, type ButtonProps } from '@mantine/core';
import { IconPrinter, IconFileTypePdf, IconEye } from '@tabler/icons-react';
import { usePrint } from '../../hooks/usePrint';
import type { PrintDocumentType, PrintOutputMode, PrintSettingsConfig } from '../../../shared/types/print';
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
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<PrintOutputMode | null>(null);
  const [hidePartNumbers, setHidePartNumbers] = useState(false);

  useEffect(() => {
    window.electron.invoke(IpcChannel.GET_PRINT_SETTINGS).then((result: { success: boolean; data?: PrintSettingsConfig }) => {
      if (result.success && result.data) {
        setIsThermal(result.data.documentFormats[documentType] === 'thermal');
      }
    });
  }, [documentType]);

  const isQuotation = documentType === 'quotation';

  const handleAction = (outputMode: PrintOutputMode) => {
    if (isQuotation) {
      setPendingMode(outputMode);
      setOptionsOpen(true);
      return;
    }
    printDocument(documentType, documentId, outputMode);
  };

  const handleConfirm = () => {
    if (!pendingMode) return;
    printDocument(documentType, documentId, pendingMode, { hidePartNumbers });
    setOptionsOpen(false);
  };

  return (
    <>
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
            onClick={() => handleAction('print')}
          >
            Print
          </Menu.Item>
          {!isThermal && (
            <Menu.Item
              leftSection={<IconFileTypePdf size={16} />}
              onClick={() => handleAction('pdf')}
            >
              Save as PDF
            </Menu.Item>
          )}
          <Menu.Item
            leftSection={<IconEye size={16} />}
            onClick={() => handleAction('preview')}
          >
            Preview
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {isQuotation && (
        <Modal opened={optionsOpen} onClose={() => setOptionsOpen(false)} title="Quotation Options" size="sm">
          <Stack gap="md">
            <Checkbox
              label="Hide part numbers"
              description="Show only the description for each line item"
              checked={hidePartNumbers}
              onChange={(e) => setHidePartNumbers(e.currentTarget.checked)}
            />
            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setOptionsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} loading={isPrinting}>
                Continue
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </>
  );
}
