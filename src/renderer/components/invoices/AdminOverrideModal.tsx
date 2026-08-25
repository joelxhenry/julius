import { useState, useCallback, useEffect, useRef } from 'react';
import { Modal, Stack, Text, Button, Alert, Group, Loader, Textarea, List, ThemeIcon, Badge } from '@mantine/core';
import { IconAlertTriangle, IconShieldCheck, IconX } from '@tabler/icons-react';
import { PINInput } from '../auth/PINInput';
import { IpcChannel } from '../../../shared/types/ipc';

export interface CreditIssue {
  type: 'overdue_invoices' | 'exceeded_credit_limit' | 'bad_credit_flag' | 'credit_disabled';
  message: string;
  severity: 'warning' | 'block';
}

export interface AdminOverrideResult {
  adminId: number;
  adminName: string;
  notes: string;
}

interface AdminOverrideModalProps {
  opened: boolean;
  onClose: () => void;
  onApproved: (result: AdminOverrideResult) => void;
  clientName: string;
  creditIssues: CreditIssue[];
}

export function AdminOverrideModal({
  opened,
  onClose,
  onApproved,
  clientName,
  creditIssues,
}: AdminOverrideModalProps) {
  const [accessCode, setAccessCode] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear state when modal opens/closes
  useEffect(() => {
    if (opened) {
      setAccessCode('');
      setNotes('');
      setError(null);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [opened]);

  const handleSubmit = useCallback(async () => {
    if (!accessCode.trim()) {
      setError('Please enter admin access code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Verify the access code and check for admin permission
      const result = await window.electron.invoke(IpcChannel.VERIFY_ACCESS_CODE, {
        accessCode: accessCode.trim(),
      });


      console.log('[AdminOverrideModal] Access code verification result:', result);

      if (!result.success) {
        setError(result.error || 'Verification failed');
        setAccessCode('');
        inputRef.current?.focus();
        return;
      }

      // Check for admin permission
      const permissions = result.data.permissions as Record<string, boolean> | null;
      console.log('[AdminOverrideModal] Received permissions:', permissions);

      // Check for admin-level permissions (case-insensitive check)
      const hasAdminPermission =
        permissions?.ADMIN === true ||
        permissions?.admin === true ||
        permissions?.OVERRIDE_CREDIT === true ||
        permissions?.override_credit === true ||
        // Allow if permissions object is empty (legacy admin accounts)
        (!permissions || Object.keys(permissions).length === 0);

      if (!hasAdminPermission) {
        setError('This action requires admin privileges (ADMIN or OVERRIDE_CREDIT permission)');
        setAccessCode('');
        inputRef.current?.focus();
        return;
      }

      onApproved({
        adminId: result.data.employeeId,
        adminName: result.data.employeeName,
        notes: notes.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
      setAccessCode('');
      inputRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [accessCode, notes, onApproved, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconShieldCheck size={20} color="orange" />
          <Text fw={600}>Admin Override Required</Text>
        </Group>
      }
      centered
      size="md"
      closeOnClickOutside={false}
      closeOnEscape
    >
      <Stack gap="md">
        <Alert icon={<IconAlertTriangle size={16} />} color="orange" variant="light">
          <Text size="sm" fw={500} mb="xs">
            Credit issues detected for {clientName}
          </Text>
          <List size="sm" spacing="xs">
            {creditIssues.map((issue, index) => (
              <List.Item
                key={index}
                icon={
                  <ThemeIcon color={issue.severity === 'block' ? 'red' : 'yellow'} size={16} radius="xl">
                    <IconX size={10} />
                  </ThemeIcon>
                }
              >
                <Group gap="xs">
                  <Text size="sm">{issue.message}</Text>
                  <Badge size="xs" color={issue.severity === 'block' ? 'red' : 'yellow'}>
                    {issue.type.replace(/_/g, ' ')}
                  </Badge>
                </Group>
              </List.Item>
            ))}
          </List>
        </Alert>

        <Text size="sm" c="dimmed">
          An administrator must approve this invoice to bypass the credit restrictions.
        </Text>

        {error && (
          <Alert icon={<IconAlertTriangle size={16} />} color="red" variant="light">
            {error}
          </Alert>
        )}

        <PINInput
          ref={inputRef}
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          error={!!error}
          placeholder="Admin Access Code"
        />

        <Textarea
          label="Override Notes (optional)"
          placeholder="Reason for approving this override..."
          value={notes}
          onChange={(e) => setNotes(e.currentTarget.value)}
          minRows={2}
          disabled={isLoading}
        />

        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            color="orange"
            onClick={handleSubmit}
            disabled={isLoading || !accessCode.trim()}
          >
            {isLoading ? <Loader size="xs" color="white" /> : 'Approve Override'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
