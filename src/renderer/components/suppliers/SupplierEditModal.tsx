import { useState, useEffect } from 'react';
import {
  Modal,
  Stack,
  Paper,
  Group,
  TextInput,
  Textarea,
  Button,
  Checkbox,
  NumberInput,
  Text,
  Alert,
  Title,
  ScrollArea,
  Select,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconTruck,
  IconPhone,
  IconCreditCard,
  IconMapPin,
  IconMail,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';

interface Supplier {
  id: number;
  company: string;
  address1: string | null;
  address2: string | null;
  address3: string | null;
  phone1: string | null;
  phone2: string | null;
  fax: string | null;
  email1: string | null;
  email2: string | null;
  contact1: string | null;
  contact2: string | null;
  notes: string | null;
  credit: string | null;
  creditDesc: string | null;
  isTaxable: boolean | null;
  discountPct: string | null;
  terms: string | null;
  isActive: boolean;
}

interface SupplierFormValues {
  company: string;
  address1: string;
  address2: string;
  address3: string;
  phone1: string;
  phone2: string;
  fax: string;
  email1: string;
  email2: string;
  contact1: string;
  contact2: string;
  notes: string;
  credit: number | null;
  creditDesc: string;
  isTaxable: boolean;
  discountPct: number | null;
  terms: string;
}

interface SupplierEditModalProps {
  opened: boolean;
  onClose: () => void;
  supplier: Supplier;
  onSave: () => void;
}

export function SupplierEditModal({ opened, onClose, supplier, onSave }: SupplierEditModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<SupplierFormValues>({
    initialValues: {
      company: '',
      address1: '',
      address2: '',
      address3: '',
      phone1: '',
      phone2: '',
      fax: '',
      email1: '',
      email2: '',
      contact1: '',
      contact2: '',
      notes: '',
      credit: null,
      creditDesc: '',
      isTaxable: true,
      discountPct: null,
      terms: '',
    },
    validate: {
      company: (value) => (!value ? 'Company name is required' : null),
      discountPct: (value) =>
        value !== null && (value < 0 || value > 100) ? 'Must be between 0 and 100' : null,
      credit: (value) => (value !== null && value < 0 ? 'Cannot be negative' : null),
    },
  });

  // Set form values when supplier changes or modal opens
  useEffect(() => {
    if (opened && supplier) {
      form.setValues({
        company: supplier.company || '',
        address1: supplier.address1 || '',
        address2: supplier.address2 || '',
        address3: supplier.address3 || '',
        phone1: supplier.phone1 || '',
        phone2: supplier.phone2 || '',
        fax: supplier.fax || '',
        email1: supplier.email1 || '',
        email2: supplier.email2 || '',
        contact1: supplier.contact1 || '',
        contact2: supplier.contact2 || '',
        notes: supplier.notes || '',
        credit: supplier.credit ? parseFloat(supplier.credit) : null,
        creditDesc: supplier.creditDesc || '',
        isTaxable: supplier.isTaxable ?? true,
        discountPct: supplier.discountPct ? parseFloat(supplier.discountPct) : null,
        terms: supplier.terms || '',
      });
      setError(null);
    }
  }, [opened, supplier]);

  const handleSubmit = async (values: SupplierFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const data = {
        company: values.company,
        address1: values.address1 || null,
        address2: values.address2 || null,
        address3: values.address3 || null,
        phone1: values.phone1 || null,
        phone2: values.phone2 || null,
        fax: values.fax || null,
        email1: values.email1 || null,
        email2: values.email2 || null,
        contact1: values.contact1 || null,
        contact2: values.contact2 || null,
        notes: values.notes || null,
        credit: values.credit?.toString() || null,
        creditDesc: values.creditDesc || null,
        isTaxable: values.isTaxable,
        discountPct: values.discountPct?.toString() || null,
        terms: values.terms || null,
      };

      const result = await window.electron.invoke(IpcChannel.UPDATE_SUPPLIER, {
        id: supplier.id,
        data,
      });

      if (result.success) {
        notifications.show({
          title: 'Supplier Updated',
          message: `${values.company} has been updated successfully`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        onSave();
        onClose();
      } else {
        setError(result.error || 'Failed to save supplier');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    form.reset();
    setError(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={
        <Group gap="xs">
          <IconTruck size={20} />
          <Text fw={600}>Edit Supplier: {supplier.company}</Text>
        </Group>
      }
      size="xl"
      centered
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <ScrollArea.Autosize mah="70vh">
          <Stack gap="lg" pr="xs">
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {error}
              </Alert>
            )}

            {/* Basic Information */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconTruck size={18} />
                  <Title order={5}>Basic Information</Title>
                </Group>

                <TextInput
                  label="Company Name"
                  placeholder="Enter company name"
                  required
                  {...form.getInputProps('company')}
                />

                <Group grow>
                  <TextInput
                    label="Contact 1"
                    placeholder="Primary contact"
                    {...form.getInputProps('contact1')}
                  />
                  <TextInput
                    label="Contact 2"
                    placeholder="Secondary contact"
                    {...form.getInputProps('contact2')}
                  />
                </Group>
              </Stack>
            </Paper>

            {/* Contact Information */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconPhone size={18} />
                  <Title order={5}>Contact Information</Title>
                </Group>

                <Group grow>
                  <TextInput
                    label="Phone 1"
                    placeholder="Primary phone"
                    {...form.getInputProps('phone1')}
                  />
                  <TextInput
                    label="Phone 2"
                    placeholder="Secondary phone"
                    {...form.getInputProps('phone2')}
                  />
                </Group>

                <TextInput label="Fax" placeholder="Fax number" {...form.getInputProps('fax')} />
              </Stack>
            </Paper>

            {/* Email */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconMail size={18} />
                  <Title order={5}>Email</Title>
                </Group>

                <Group grow>
                  <TextInput
                    label="Email 1"
                    placeholder="Primary email"
                    type="email"
                    {...form.getInputProps('email1')}
                  />
                  <TextInput
                    label="Email 2"
                    placeholder="Secondary email"
                    type="email"
                    {...form.getInputProps('email2')}
                  />
                </Group>
              </Stack>
            </Paper>

            {/* Address */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconMapPin size={18} />
                  <Title order={5}>Address</Title>
                </Group>

                <TextInput
                  label="Address Line 1"
                  placeholder="Street address"
                  {...form.getInputProps('address1')}
                />

                <TextInput
                  label="Address Line 2"
                  placeholder="Suite, unit, etc."
                  {...form.getInputProps('address2')}
                />

                <TextInput
                  label="Address Line 3"
                  placeholder="City, State, ZIP"
                  {...form.getInputProps('address3')}
                />
              </Stack>
            </Paper>

            {/* Credit & Terms */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconCreditCard size={18} />
                  <Title order={5}>Credit & Terms</Title>
                </Group>

                <Group grow>
                  <NumberInput
                    label="Credit Limit"
                    placeholder="0.00"
                    prefix="$"
                    min={0}
                    decimalScale={2}
                    fixedDecimalScale
                    thousandSeparator=","
                    {...form.getInputProps('credit')}
                  />
                  <TextInput
                    label="Credit Description"
                    placeholder="Credit terms description"
                    {...form.getInputProps('creditDesc')}
                  />
                </Group>

                <Group grow>
                  <Select
                    label="Payment Terms"
                    placeholder="Select terms"
                    data={[
                      { value: '', label: 'None' },
                      { value: 'Net 30', label: 'Net 30' },
                      { value: 'Net 60', label: 'Net 60' },
                      { value: 'Net 90', label: 'Net 90' },
                      { value: 'COD', label: 'COD (Cash on Delivery)' },
                      { value: 'CIA', label: 'CIA (Cash in Advance)' },
                    ]}
                    {...form.getInputProps('terms')}
                  />
                  <NumberInput
                    label="Discount Percentage"
                    placeholder="0.00"
                    suffix="%"
                    min={0}
                    max={100}
                    decimalScale={2}
                    {...form.getInputProps('discountPct')}
                  />
                </Group>

                <Checkbox
                  label="Taxable"
                  description="Check if purchases from this supplier are taxable"
                  {...form.getInputProps('isTaxable', { type: 'checkbox' })}
                />
              </Stack>
            </Paper>

            {/* Notes */}
            <Paper p="md" radius="md" withBorder>
              <Stack gap="md">
                <Title order={5}>Notes</Title>

                <Textarea
                  label="Notes"
                  placeholder="Enter any additional notes about this supplier"
                  rows={3}
                  {...form.getInputProps('notes')}
                />
              </Stack>
            </Paper>
          </Stack>
        </ScrollArea.Autosize>
        {/* Actions */}
        <Group justify="flex-end" pt={10}>
          <Button variant="subtle" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={submitting}>
            Save Changes
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
