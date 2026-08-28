import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  Stack,
  Text,
  Button,
  Alert,
  Group,
  Loader,
  Table,
  Badge,
  NumberInput,
  ThemeIcon,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconShieldCheck, IconCheck, IconPackage } from '@tabler/icons-react';
import { PINInput } from '../auth/PINInput';
import { IpcChannel } from '../../../shared/types/ipc';
import type { AdminOverrideResult } from './AdminOverrideModal';

export interface StockShortItem {
  sku: string;
  description: string;
  requestedQty: number;
  availableQty: number;
}

interface StockOverrideModalProps {
  opened: boolean;
  onClose: () => void;
  shortItems: StockShortItem[];
  onApproved: (result: AdminOverrideResult) => void;
}

/**
 * Blocks issuing an invoice that would drive stock negative. An administrator
 * must authorise the bypass (recorded on the invoice). Optionally the admin can
 * correct the on-hand quantity for a short item inline — e.g. stock that
 * physically arrived but was never booked in. Any item still short after
 * adjustments will go negative on issue, which is called out clearly.
 */
export function StockOverrideModal({ opened, onClose, shortItems, onApproved }: StockOverrideModalProps) {
  const [accessCode, setAccessCode] = useState('');
  const [admin, setAdmin] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [adjustingSku, setAdjustingSku] = useState<string | null>(null);
  // Live on-hand per SKU (updated as the admin corrects stock)
  const [onHand, setOnHand] = useState<Record<string, number>>({});
  const [inputQty, setInputQty] = useState<Record<string, number | string>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset local state whenever the modal opens with a fresh set of short items.
  useEffect(() => {
    if (opened) {
      setAccessCode('');
      setAdmin(null);
      setError(null);
      setAdjustingSku(null);
      setOnHand(Object.fromEntries(shortItems.map((i) => [i.sku, i.availableQty])));
      setInputQty(Object.fromEntries(shortItems.map((i) => [i.sku, i.requestedQty])));
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    // shortItems is captured on open; it does not change while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const handleVerify = useCallback(async () => {
    if (!accessCode.trim()) {
      setError('Please enter admin access code');
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await window.electron.invoke(IpcChannel.VERIFY_ACCESS_CODE, {
        accessCode: accessCode.trim(),
      });

      if (!result.success) {
        setError(result.error || 'Verification failed');
        setAccessCode('');
        inputRef.current?.focus();
        return;
      }

      const permissions = result.data.permissions as Record<string, boolean> | null;
      const hasPermission =
        permissions?.ADMIN === true ||
        permissions?.admin === true ||
        permissions?.ADJUST_STOCK === true ||
        permissions?.adjust_stock === true ||
        // Legacy admin accounts have no explicit permission map
        (!permissions || Object.keys(permissions).length === 0);

      if (!hasPermission) {
        setError('This action requires admin privileges (ADMIN or ADJUST_STOCK permission)');
        setAccessCode('');
        inputRef.current?.focus();
        return;
      }

      setAdmin({ id: result.data.employeeId, name: result.data.employeeName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setAccessCode('');
      inputRef.current?.focus();
    } finally {
      setIsVerifying(false);
    }
  }, [accessCode]);

  const handleAdjust = useCallback(
    async (sku: string) => {
      if (!admin) return;
      const raw = inputQty[sku];
      const qty = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      if (!Number.isFinite(qty)) {
        notifications.show({ title: 'Invalid quantity', message: 'Enter a valid on-hand quantity', color: 'red' });
        return;
      }

      setAdjustingSku(sku);
      try {
        const result = await window.electron.invoke(IpcChannel.ADJUST_STOCK_BY_SKU, {
          sku,
          quantity: qty,
          employeeId: admin.id,
        });
        if (result.success) {
          setOnHand((prev) => ({ ...prev, [sku]: result.data.onHand }));
          notifications.show({
            title: 'Stock updated',
            message: `${sku} on-hand set to ${result.data.onHand}`,
            color: 'green',
          });
        } else {
          notifications.show({ title: 'Adjustment failed', message: result.error, color: 'red' });
        }
      } catch (err) {
        notifications.show({
          title: 'Adjustment failed',
          message: err instanceof Error ? err.message : 'Failed to adjust stock',
          color: 'red',
        });
      } finally {
        setAdjustingSku(null);
      }
    },
    [admin, inputQty]
  );

  // Items that will still go negative once the invoice is issued.
  const negativeItems = useMemo(
    () =>
      shortItems
        .map((i) => ({ ...i, current: onHand[i.sku] ?? i.availableQty }))
        .filter((i) => i.current < i.requestedQty),
    [shortItems, onHand]
  );

  const handleApprove = useCallback(() => {
    if (!admin) return;
    onApproved({ adminId: admin.id, adminName: admin.name, notes: '' });
    onClose();
  }, [admin, onApproved, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleVerify();
      } else if (e.key === 'Escape') {
        onClose();
      }
    },
    [handleVerify, onClose]
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconPackage size={20} color="orange" />
          <Text fw={600}>Insufficient Stock — Admin Override Required</Text>
        </Group>
      }
      centered
      size="lg"
      closeOnClickOutside={false}
      closeOnEscape
    >
      <Stack gap="md">
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
          <Text size="sm">
            The following items do not have enough stock for this order. An administrator must approve issuing
            it. Optionally, correct the on-hand quantity for any item that has physically arrived but was not yet
            booked in.
          </Text>
        </Alert>

        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Part</Table.Th>
              <Table.Th ta="center">Ordered</Table.Th>
              <Table.Th ta="center">On hand</Table.Th>
              <Table.Th>Correct on-hand</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {shortItems.map((item) => {
              const current = onHand[item.sku] ?? item.availableQty;
              const willBeNegative = current < item.requestedQty;
              return (
                <Table.Tr key={item.sku}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {item.sku}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {item.description}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Text size="sm">{item.requestedQty}</Text>
                  </Table.Td>
                  <Table.Td ta="center">
                    <Badge color={willBeNegative ? 'orange' : 'green'} variant="light">
                      {current}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <NumberInput
                        value={inputQty[item.sku] ?? item.requestedQty}
                        onChange={(v) => setInputQty((prev) => ({ ...prev, [item.sku]: v }))}
                        min={0}
                        w={90}
                        size="xs"
                        disabled={!admin || adjustingSku !== null}
                      />
                      <Button
                        size="xs"
                        variant="light"
                        leftSection={<IconCheck size={14} />}
                        loading={adjustingSku === item.sku}
                        disabled={!admin || adjustingSku !== null}
                        onClick={() => handleAdjust(item.sku)}
                      >
                        Update
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              );
            })}
          </Table.Tbody>
        </Table>

        {negativeItems.length > 0 && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light" title="Stock will go negative">
            <Text size="sm" mb={4}>
              Issuing this invoice without further adjustment will leave negative stock for:
            </Text>
            <Stack gap={2}>
              {negativeItems.map((i) => (
                <Text key={i.sku} size="sm">
                  • {i.sku} —{' '}
                  <Text span fw={600} c="red">
                    {i.current - i.requestedQty}
                  </Text>
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        <Divider />

        {admin ? (
          <Alert icon={<IconShieldCheck size={16} />} color="green" variant="light">
            <Text size="sm">
              Authorised by <strong>{admin.name}</strong>. This override will be recorded on the invoice.
            </Text>
          </Alert>
        ) : (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              <Group gap={6} align="center">
                <ThemeIcon color="orange" size={18} radius="xl" variant="light">
                  <IconShieldCheck size={12} />
                </ThemeIcon>
                Admin authorisation
              </Group>
            </Text>
            {error && (
              <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
                {error}
              </Alert>
            )}
            <Group gap="xs" wrap="nowrap" align="flex-start">
              <PINInput
                ref={inputRef}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isVerifying}
                error={!!error}
                placeholder="Admin Access Code"
                style={{ flex: 1 }}
              />
              <Button size="lg" onClick={handleVerify} disabled={isVerifying || !accessCode.trim()} color="orange">
                {isVerifying ? <Loader size="xs" color="white" /> : 'Verify'}
              </Button>
            </Group>
          </Stack>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose}>
            Cancel
          </Button>
          <Button
            color={negativeItems.length > 0 ? 'red' : 'green'}
            disabled={!admin}
            onClick={handleApprove}
          >
            {negativeItems.length > 0 ? 'Approve & Issue (allow negative stock)' : 'Approve & Issue'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
