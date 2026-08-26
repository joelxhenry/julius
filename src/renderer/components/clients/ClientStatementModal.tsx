import { useState } from 'react';
import {
  Modal,
  Stack,
  SegmentedControl,
  Group,
  Button,
  Text,
} from '@mantine/core';
import { IconEye, IconPrinter, IconFileTypePdf } from '@tabler/icons-react';
import { DateRangeFilter, DateRangeValue, getLastNDaysRange } from '../common/DateRangeFilter';
import { useClientStatementPrint } from '../../hooks';
import type { PrintOutputMode } from '../../../shared/types/print';

interface ClientStatementModalProps {
  opened: boolean;
  onClose: () => void;
  clientId: number;
}

type PeriodMode = 'all' | 'range';

export function ClientStatementModal({ opened, onClose, clientId }: ClientStatementModalProps) {
  const [periodMode, setPeriodMode] = useState<PeriodMode>('all');
  const [range, setRange] = useState<DateRangeValue>(getLastNDaysRange(30));
  const [activeMode, setActiveMode] = useState<PrintOutputMode | null>(null);
  const { printClientStatement, isPrinting } = useClientStatementPrint();

  const [start, end] = range;
  const rangeIncomplete = periodMode === 'range' && (!start || !end);

  const handleGenerate = async (outputMode: PrintOutputMode) => {
    setActiveMode(outputMode);
    try {
      await printClientStatement(
        {
          clientId,
          startDate: periodMode === 'range' ? start : null,
          endDate: periodMode === 'range' ? end : null,
        },
        outputMode,
      );
      if (outputMode !== 'preview') {
        onClose();
      }
    } finally {
      setActiveMode(null);
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Generate Balance Statement" size="md">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Produce a statement of account with all purchases, payments and available credit for this client.
        </Text>

        <SegmentedControl
          value={periodMode}
          onChange={(value) => setPeriodMode(value as PeriodMode)}
          data={[
            { label: 'All Time', value: 'all' },
            { label: 'Date Range', value: 'range' },
          ]}
          fullWidth
        />

        {periodMode === 'range' && (
          <DateRangeFilter value={range} onChange={setRange} label="Statement Period" />
        )}

        <Group justify="flex-end" mt="sm">
          <Button
            variant="default"
            leftSection={<IconEye size={16} />}
            loading={activeMode === 'preview'}
            disabled={rangeIncomplete || (isPrinting && activeMode !== 'preview')}
            onClick={() => handleGenerate('preview')}
          >
            Preview
          </Button>
          <Button
            variant="light"
            leftSection={<IconFileTypePdf size={16} />}
            loading={activeMode === 'pdf'}
            disabled={rangeIncomplete || (isPrinting && activeMode !== 'pdf')}
            onClick={() => handleGenerate('pdf')}
          >
            Save PDF
          </Button>
          <Button
            leftSection={<IconPrinter size={16} />}
            loading={activeMode === 'print'}
            disabled={rangeIncomplete || (isPrinting && activeMode !== 'print')}
            onClick={() => handleGenerate('print')}
          >
            Print
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
