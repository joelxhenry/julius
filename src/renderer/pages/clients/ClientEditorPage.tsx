import { useState, useEffect } from 'react';
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
  Divider,
  Text,
  Loader,
  Alert,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconDeviceFloppy,
  IconAlertCircle,
  IconCheck,
  IconUser,
  IconPhone,
  IconBuildingStore,
  IconCreditCard,
  IconRefresh,
  IconMapPin,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { IpcChannel } from '../../../shared/types/ipc';

interface ClientFormValues {
  clNumber: string;
  clientName: string;
  contact: string;
  phone: string;
  address1: string;
  address2: string;
  notes: string;
  isTaxable: boolean;
  discountPct: number;
  creditLimit: number;
  creditTerms: string;
  isBadCredit: boolean;
  custom1: string;
  custom2: string;
  lbDisc: number | null;
}

export function ClientEditorPage() {
  const navigate = useNavigate();
  const { id } = useTabParams<{ id: string }>();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ClientFormValues>({
    initialValues: {
      clNumber: '',
      clientName: '',
      contact: '',
      phone: '',
      address1: '',
      address2: '',
      notes: '',
      isTaxable: true,
      discountPct: 0,
      creditLimit: 0,
      creditTerms: '',
      isBadCredit: false,
      custom1: '',
      custom2: '',
      lbDisc: null,
    },
    validate: {
      clientName: (value) => (!value ? 'Client name is required' : null),
      discountPct: (value) =>
        value < 0 || value > 100 ? 'Must be between 0 and 100' : null,
      creditLimit: (value) => (value < 0 ? 'Cannot be negative' : null),
    },
  });

  useEffect(() => {
    if (isEditing && id) {
      loadClient(parseInt(id, 10));
    } else {
      // Generate a new client code for new clients
      generateClientCode();
    }
  }, [id, isEditing]);

  const generateClientCode = async (isInitialLoad = true) => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setGeneratingCode(true);
    }
    setError(null);
    try {
      // Generate client code with pattern: CL-{timestamp}
      const code = `CL-${Date.now()}`;
      form.setFieldValue('clNumber', code);
    } catch (err) {
      console.error('Failed to generate client code:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate client code');
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      } else {
        setGeneratingCode(false);
      }
    }
  };

  const loadClient = async (clientId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CLIENT, { id: clientId });
      if (result.success && result.data) {
        const client = result.data;
        form.setValues({
          clNumber: client.clNumber || '',
          clientName: client.clientName || '',
          contact: client.contact || '',
          phone: client.phone || '',
          address1: client.address1 || '',
          address2: client.address2 || '',
          notes: client.notes || '',
          isTaxable: client.isTaxable ?? true,
          discountPct: client.discountPct ? parseFloat(client.discountPct) : 0,
          creditLimit: client.creditLimit ? parseFloat(client.creditLimit) : 0,
          creditTerms: client.creditTerms || '',
          isBadCredit: client.isBadCredit || false,
          custom1: client.custom1 || '',
          custom2: client.custom2 || '',
          lbDisc: client.lbDisc ? parseFloat(client.lbDisc) : null,
        });
      } else {
        setError(result.error || 'Failed to load client');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: ClientFormValues) => {
    setSubmitting(true);
    setError(null);

    try {
      const data = {
        clNumber: values.clNumber || null,
        clientName: values.clientName,
        contact: values.contact || null,
        phone: values.phone || null,
        address1: values.address1 || null,
        address2: values.address2 || null,
        notes: values.notes || null,
        isTaxable: values.isTaxable,
        discountPct: values.discountPct.toString(),
        creditLimit: values.creditLimit.toString(),
        creditTerms: values.creditTerms || null,
        isBadCredit: values.isBadCredit,
        custom1: values.custom1 || null,
        custom2: values.custom2 || null,
        lbDisc: values.lbDisc?.toString() || null,
      };

      let result;
      if (isEditing && id) {
        result = await window.electron.invoke(IpcChannel.UPDATE_CLIENT, {
          id: parseInt(id, 10),
          data,
        });
      } else {
        result = await window.electron.invoke(IpcChannel.CREATE_CLIENT, data);
      }

      if (result.success) {
        notifications.show({
          title: isEditing ? 'Client Updated' : 'Client Created',
          message: `${values.clientName} has been ${isEditing ? 'updated' : 'created'} successfully`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        navigate('/clients');
      } else {
        setError(result.error || 'Failed to save client');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Stack p="xl" align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading client...</Text>
      </Stack>
    );
  }

  return (
    <Stack p="xl" gap="lg">
      <Group justify="space-between" align="center">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/clients')}
          >
            Back
          </Button>
          <Title order={2}>{isEditing ? 'Edit Client' : 'Add Client'}</Title>
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
                <IconUser size={20} />
                <Title order={4}>Basic Information</Title>
              </Group>

              <TextInput
                label="Client Name"
                placeholder="Enter client name"
                required
                {...form.getInputProps('clientName')}
              />

              <Group grow>
                <TextInput
                  label="Client Number"
                  placeholder="e.g., CL-123456"
                  description={isEditing ? undefined : 'Auto-generated'}
                  rightSection={
                    !isEditing && (
                      <Tooltip label="Generate new code">
                        <ActionIcon
                          variant="subtle"
                          onClick={() => generateClientCode(false)}
                          loading={generatingCode}
                        >
                          <IconRefresh size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )
                  }
                  {...form.getInputProps('clNumber')}
                />
                <TextInput
                  label="Contact Person"
                  placeholder="Enter contact person"
                  {...form.getInputProps('contact')}
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

              <TextInput
                label="Phone"
                placeholder="Enter phone number"
                {...form.getInputProps('phone')}
              />
            </Stack>
          </Paper>

          {/* Address */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconMapPin size={20} />
                <Title order={4}>Address</Title>
              </Group>

              <TextInput
                label="Address Line 1"
                placeholder="Enter street address"
                {...form.getInputProps('address1')}
              />

              <TextInput
                label="Address Line 2"
                placeholder="Enter apartment, suite, etc."
                {...form.getInputProps('address2')}
              />
            </Stack>
          </Paper>

          {/* Credit & Pricing */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconCreditCard size={20} />
                <Title order={4}>Credit & Pricing</Title>
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
                  {...form.getInputProps('creditLimit')}
                />
                <Select
                  label="Credit Terms"
                  placeholder="Select credit terms"
                  data={[
                    { value: '', label: 'None' },
                    { value: 'Net 30', label: 'Net 30' },
                    { value: 'Net 60', label: 'Net 60' },
                    { value: 'COD', label: 'COD (Cash on Delivery)' },
                    { value: 'Custom', label: 'Custom' },
                  ]}
                  {...form.getInputProps('creditTerms')}
                />
              </Group>

              <Group grow>
                <NumberInput
                  label="Discount Percentage"
                  placeholder="0.00"
                  suffix="%"
                  min={0}
                  max={100}
                  decimalScale={2}
                  {...form.getInputProps('discountPct')}
                />
                <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: '8px' }}>
                  <Checkbox
                    label="Bad Credit"
                    description="Mark client as bad credit"
                    {...form.getInputProps('isBadCredit', { type: 'checkbox' })}
                  />
                </div>
              </Group>
            </Stack>
          </Paper>

          {/* Tax & Settings */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Group gap="xs">
                <IconBuildingStore size={20} />
                <Title order={4}>Tax & Settings</Title>
              </Group>

              <Checkbox
                label="Taxable"
                description="Check if this client is taxable"
                {...form.getInputProps('isTaxable', { type: 'checkbox' })}
              />
            </Stack>
          </Paper>

          {/* Additional Information */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={4}>Additional Information</Title>

              <Group grow>
                <TextInput
                  label="Custom Field 1"
                  placeholder="Custom field 1"
                  {...form.getInputProps('custom1')}
                />
                <TextInput
                  label="Custom Field 2"
                  placeholder="Custom field 2"
                  {...form.getInputProps('custom2')}
                />
              </Group>

              <NumberInput
                label="LB Disc"
                placeholder="0.00"
                suffix="%"
                min={0}
                max={100}
                decimalScale={2}
                {...form.getInputProps('lbDisc')}
              />
            </Stack>
          </Paper>

          {/* Notes */}
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <Title order={4}>Notes</Title>

              <Textarea
                label="Notes"
                placeholder="Enter any additional notes about this client"
                rows={4}
                {...form.getInputProps('notes')}
              />
            </Stack>
          </Paper>

          {/* Actions */}
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => navigate('/clients')}>
              Cancel
            </Button>
            <Button type="submit" leftSection={<IconDeviceFloppy size={16} />} loading={submitting}>
              {isEditing ? 'Save Changes' : 'Create Client'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
