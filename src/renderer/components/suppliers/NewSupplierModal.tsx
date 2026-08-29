import { useEffect, useState } from 'react';
import {
  Modal,
  Stack,
  Group,
  Text,
  TextInput,
  NumberInput,
  Button,
  Alert,
  SimpleGrid,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconTruck, IconDeviceFloppy, IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';

interface NewSupplierFormValues {
  company: string;
  contact1: string;
  phone1: string;
  email1: string;
  terms: string;
  discountPct: number | null;
}

const INITIAL: NewSupplierFormValues = {
  company: '',
  contact1: '',
  phone1: '',
  email1: '',
  terms: '',
  discountPct: null,
};

interface NewSupplierModalProps {
  opened: boolean;
  onClose: () => void;
  /** Fired after the supplier is created so the caller can select it. */
  onCreated?: (supplier: { id: number; company: string }) => void;
}

/**
 * Lightweight create-only supplier modal for inline creation (e.g. while
 * receiving). Captures just the essentials; the full record can be edited later
 * from the Suppliers area. Distinct from SupplierEditModal, which is update-only.
 */
export function NewSupplierModal({ opened, onClose, onCreated }: NewSupplierModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<NewSupplierFormValues>({
    initialValues: INITIAL,
    validate: {
      company: (v) => (!v.trim() ? 'Company name is required' : null),
      discountPct: (v) => (v !== null && (v < 0 || v > 100) ? 'Must be between 0 and 100' : null),
    },
  });

  useEffect(() => {
    if (opened) {
      form.setValues(INITIAL);
      form.resetDirty(INITIAL);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const handleSubmit = async (values: NewSupplierFormValues) => {
    setSubmitting(true);
    setError(null);
    try {
      const data = {
        company: values.company.trim(),
        contact1: values.contact1.trim() || null,
        phone1: values.phone1.trim() || null,
        email1: values.email1.trim() || null,
        terms: values.terms.trim() || null,
        discountPct: values.discountPct?.toString() || null,
        isTaxable: true,
        isActive: true,
      };
      const result = await window.electron.invoke(IpcChannel.CREATE_SUPPLIER, data);
      if (result.success) {
        notifications.show({
          title: 'Supplier Created',
          message: `${data.company} has been created`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        onCreated?.({ id: result.data?.id, company: result.data?.company || data.company });
        onClose();
      } else {
        setError(result.error || 'Failed to create supplier');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <IconTruck size={18} />
          <Text fw={600}>New Supplier</Text>
        </Group>
      }
      size="lg"
      centered
    >
      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
          {error}
        </Alert>
      )}
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Company Name"
            placeholder="Enter company name"
            required
            data-autofocus
            {...form.getInputProps('company')}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput label="Contact" placeholder="Primary contact" {...form.getInputProps('contact1')} />
            <TextInput label="Phone" placeholder="Phone number" {...form.getInputProps('phone1')} />
            <TextInput label="Email" placeholder="Email address" {...form.getInputProps('email1')} />
            <TextInput label="Terms" placeholder="e.g. Net 30" {...form.getInputProps('terms')} />
          </SimpleGrid>
          <NumberInput
            label="Discount %"
            placeholder="0"
            min={0}
            max={100}
            decimalScale={2}
            w={160}
            {...form.getInputProps('discountPct')}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={submitting}>
              Create Supplier
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
