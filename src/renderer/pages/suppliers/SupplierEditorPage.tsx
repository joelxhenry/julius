import { useState } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  TextInput,
  Textarea,
  Button,
  Select,
  Checkbox,
  NumberInput,
  Text,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconTruck,
  IconPhone,
  IconCreditCard,
  IconMapPin,
  IconMail,
} from '@tabler/icons-react';
import { useTabContext } from '../../contexts/TabContext';
import { IpcChannel } from '../../../shared/types/ipc';

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

export function SupplierEditorPage() {
  const { replaceCurrentTab, closeCurrentTab } = useTabContext();

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
        isActive: true,
      };

      const result = await window.electron.invoke(IpcChannel.CREATE_SUPPLIER, data);

      if (result.success) {
        notifications.show({
          title: 'Supplier Created',
          message: `${values.company} has been created successfully`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        const supplierId = result.data?.id;
        replaceCurrentTab(supplierId ? `/suppliers/${supplierId}` : '/suppliers');
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
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="center">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => closeCurrentTab()}>
            Back
          </Button>
          <Title order={2}>Add Supplier</Title>
        </Group>
      </Group>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="lg">
          {/* Basic Information */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconTruck size={20} />
                <Title order={4}>Basic Information</Title>
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
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconPhone size={20} />
                <Title order={4}>Contact Information</Title>
              </Group>

              <Group grow>
                <TextInput label="Phone 1" placeholder="Primary phone" {...form.getInputProps('phone1')} />
                <TextInput label="Phone 2" placeholder="Secondary phone" {...form.getInputProps('phone2')} />
              </Group>

              <TextInput label="Fax" placeholder="Fax number" {...form.getInputProps('fax')} />
            </Stack>
          </Paper>

          {/* Email */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconMail size={20} />
                <Title order={4}>Email</Title>
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
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconMapPin size={20} />
                <Title order={4}>Address</Title>
              </Group>

              <TextInput label="Address Line 1" placeholder="Street address" {...form.getInputProps('address1')} />

              <TextInput label="Address Line 2" placeholder="Suite, unit, etc." {...form.getInputProps('address2')} />

              <TextInput label="Address Line 3" placeholder="City, State, ZIP" {...form.getInputProps('address3')} />
            </Stack>
          </Paper>

          {/* Credit & Terms */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconCreditCard size={20} />
                <Title order={4}>Credit & Terms</Title>
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
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={4}>Notes</Title>

              <Textarea
                label="Notes"
                placeholder="Enter any additional notes about this supplier"
                rows={4}
                {...form.getInputProps('notes')}
              />
            </Stack>
          </Paper>

          {/* Actions */}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => closeCurrentTab()}>
              Cancel
            </Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={submitting}>
              Save Supplier
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
