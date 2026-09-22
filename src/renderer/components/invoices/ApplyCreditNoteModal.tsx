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
  TextInput,
} from '@mantine/core';
import { useDebouncedCallback } from '@mantine/hooks';
import { IconReceipt, IconAlertCircle, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { IpcChannel } from '../../../shared/types/ipc';
import { useAuth } from '../../contexts/AuthContext';

interface CreditNote {
  id: number;
  crNumber: string;
  invNumber: string | null;
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingCN, setIsLoadingCN] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load available credit notes for a registered client
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

  // Search for redeemable credit notes by CR# or invoice# (walk-in notes have no client)
  const runSearch = useDebouncedCallback(async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      // Cleared: fall back to the registered client's notes, or an empty list for walk-ins.
      if (clientId) {
        try {
          const result = await window.electron.invoke(IpcChannel.GET_CLIENT_AVAILABLE_CREDIT_NOTES, {
            clientId,
          });
          setCreditNotes(result.success && result.data ? result.data : []);
        } catch {
          setCreditNotes([]);
        }
      } else {
        setCreditNotes([]);
      }
      setIsLoadingCN(false);
      return;
    }
    setIsLoadingCN(true);
    try {
      const result = await window.electron.invoke(IpcChannel.SEARCH_AVAILABLE_CREDIT_NOTES, {
        query: trimmed,
      });
      if (result.success && result.data) {
        setCreditNotes(result.data);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingCN(false);
    }
  }, 300);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      setSelectedId(null);
      setAmount('');
      setIsLoadingCN(true);
      runSearch(value);
    },
    [runSearch]
  );

  // Reset when opened
  useEffect(() => {
    if (opened) {
      setSelectedId(null);
      setAmount('');
      setSearchQuery('');
      setError(null);
      if (!clientId) setCreditNotes([]);
    }
  }, [opened, clientId]);

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

        <TextInput
          label="Find by credit note # or invoice #"
          placeholder="e.g. CR0042 or INV1023"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
          rightSection={isLoadingCN ? <Loader size={14} /> : undefined}
          disabled={isLoading}
          description={
            clientId
              ? 'Showing this client’s credit notes. Search to apply a note by number.'
              : 'This invoice has no registered client. Search for a credit note by its number or its originating invoice number.'
          }
        />

        {creditNotes.length === 0 && !isLoadingCN ? (
          <Alert color="blue" variant="light">
            {searchQuery.trim()
              ? 'No available credit notes match that number.'
              : clientId
                ? 'No available credit notes found for this client.'
                : 'Enter a credit note or invoice number to find a credit note.'}
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
                const inv = cn.invNumber ? ` · ${cn.invNumber}` : '';
                return {
                  value: cn.id.toString(),
                  label: `${cn.crNumber}${inv} - ${formatCurrency(avail)} available (${date})`,
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
