import { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Group,
  Select,
  NumberInput,
  Alert,
  Loader,
  Divider,
  Box,
  Badge,
} from '@mantine/core';
import { IconReceipt, IconAlertCircle } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';

interface CreditNote {
  id: number;
  crNumber: string;
  total: string;
  totalUsed: string;
  crDate: string;
}

export interface ApplyCreditNoteModalProps {
  opened: boolean;
  onClose: () => void;
  onApplied: (amount: number, crNumber: string) => void;
  invoiceId: number;
  invoiceNumber: string;
  clientId: number | null;
  clientName: string | null;
  maxAmount: number;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export function ApplyCreditNoteModal({
  opened,
  onClose,
  onApplied,
  invoiceId,
  invoiceNumber,
  clientId,
  clientName,
  maxAmount,
}: ApplyCreditNoteModalProps) {
  const { user } = useAuth();
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCN, setIsLoadingCN] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available credit notes for the client
  useEffect(() => {
    if (!opened || !clientId) return;

    const load = async () => {
      setIsLoadingCN(true);
      try {
        const result = await window.electron.invoke(IpcChannel.GET_CLIENT_AVAILABLE_CREDIT_NOTES, {
          clientId,
        });
        if (result.success && result.data) {
          setCreditNotes(result.data);
        }
      } catch {
        // ignore
      } finally {
        setIsLoadingCN(false);
      }
    };
    load();
  }, [opened, clientId]);

  // Reset when opened
  useEffect(() => {
    if (opened) {
      setSelectedId(null);
      setAmount('');
      setError(null);
    }
  }, [opened]);

  const selectedCN = creditNotes.find((cn) => cn.id.toString() === selectedId);
  const availableAmount = selectedCN
    ? parseFloat(selectedCN.total) - parseFloat(selectedCN.totalUsed)
    : 0;
  const applyMax = Math.min(availableAmount, maxAmount);

  const handleCNSelect = useCallback(
    (value: string | null) => {
      setSelectedId(value);
      if (value) {
        const cn = creditNotes.find((c) => c.id.toString() === value);
        if (cn) {
          const avail = parseFloat(cn.total) - parseFloat(cn.totalUsed);
          setAmount(Math.min(avail, maxAmount));
        }
      } else {
        setAmount('');
      }
    },
    [creditNotes, maxAmount]
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedCN || !user) return;

    const applyAmount =
      typeof amount === 'number' ? amount : parseFloat(amount as string) || 0;

    if (applyAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (applyAmount > availableAmount + 0.001) {
      setError(`Amount cannot exceed available credit (${formatCurrency(availableAmount)})`);
      return;
    }
    if (applyAmount > maxAmount + 0.001) {
      setError(`Amount cannot exceed balance due (${formatCurrency(maxAmount)})`);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.PROCESS_INVOICE_PAYMENT, {
        invoiceId,
        invoiceNumber,
        clientId,
        processedById: user.id,
        payerName: clientName || 'Client',
        entries: [
          {
            type: 'credit_note',
            creditNoteId: selectedCN.id,
            amount: applyAmount.toFixed(2),
            notes: `Applied from ${selectedCN.crNumber}`,
          },
        ],
      });

      if (result.success) {
        notifications.show({
          title: 'Credit Applied',
          message: `${formatCurrency(applyAmount)} from ${selectedCN.crNumber} applied to invoice ${invoiceNumber}`,
          color: 'teal',
        });
        onApplied(applyAmount, selectedCN.crNumber);
        onClose();
      } else {
        setError(result.error || 'Failed to apply credit note');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply credit note');
    } finally {
      setIsLoading(false);
    }
  }, [
    selectedCN,
    user,
    amount,
    availableAmount,
    maxAmount,
    invoiceId,
    invoiceNumber,
    clientId,
    clientName,
    onApplied,
    onClose,
  ]);

  const applyAmount =
    typeof amount === 'number' ? amount : parseFloat(amount as string) || 0;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconReceipt size={20} />
          <Text fw={600}>Apply Credit Note</Text>
        </Group>
      }
      size="md"
      closeOnClickOutside={false}
    >
      <Stack gap="md">
        {/* Invoice info */}
        <Box
          p="sm"
          style={{
            backgroundColor: 'var(--mantine-color-gray-light)',
            borderRadius: 'var(--mantine-radius-sm)',
          }}
        >
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Invoice</Text>
            <Text size="sm" fw={500}>{invoiceNumber}</Text>
          </Group>
          {clientName && (
            <Group justify="space-between">
              <Text size="sm" c="dimmed">Client</Text>
              <Text size="sm">{clientName}</Text>
            </Group>
          )}
          <Group justify="space-between" mt={4}>
            <Text size="sm" fw={500}>Balance Due</Text>
            <Text size="sm" fw={600} c="red">{formatCurrency(maxAmount)}</Text>
          </Group>
        </Box>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        {!clientId ? (
          <Alert color="yellow" variant="light">
            Credit notes can only be applied to invoices with a registered client.
          </Alert>
        ) : creditNotes.length === 0 && !isLoadingCN ? (
          <Alert color="blue" variant="light">
            No available credit notes found for this client.
          </Alert>
        ) : (
          <>
            <Select
              label="Select Credit Note"
              placeholder={isLoadingCN ? 'Loading...' : 'Choose a credit note'}
              value={selectedId}
              onChange={handleCNSelect}
              data={creditNotes.map((cn) => {
                const avail = parseFloat(cn.total) - parseFloat(cn.totalUsed);
                const date = new Date(cn.crDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                });
                return {
                  value: cn.id.toString(),
                  label: `${cn.crNumber} — ${formatCurrency(avail)} available (${date})`,
                };
              })}
              disabled={isLoading || isLoadingCN}
              rightSection={isLoadingCN ? <Loader size={14} /> : undefined}
            />

            {selectedCN && (
              <>
                <NumberInput
                  label={`Amount to Apply (max ${formatCurrency(applyMax)})`}
                  value={amount}
                  onChange={setAmount}
                  min={0.01}
                  max={applyMax}
                  decimalScale={2}
                  fixedDecimalScale
                  prefix="$"
                  thousandSeparator=","
                  disabled={isLoading}
                />

                <Divider />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Available on note</Text>
                  <Badge color="teal" variant="light">{formatCurrency(availableAmount)}</Badge>
                </Group>
              </>
            )}
          </>
        )}

        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="subtle" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            leftSection={<IconReceipt size={16} />}
            onClick={handleSubmit}
            loading={isLoading}
            disabled={!selectedCN || applyAmount <= 0}
            color="teal"
          >
            Apply Credit
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
