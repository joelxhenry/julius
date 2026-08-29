import { useState, useEffect } from 'react';
import {
  Stack,
  Title,
  Paper,
  Group,
  Text,
  Badge,
  Button,
  Tabs,
  Loader,
  Alert,
  SimpleGrid,
  Divider,
  ActionIcon,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconAlertCircle,
  IconTruck,
  IconPhone,
  IconMapPin,
  IconCreditCard,
  IconPackageImport,
  IconReceipt,
  IconMail,
} from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { IpcChannel } from '../../../shared/types/ipc';
import { SupplierEditModal, SupplierReceivingTab, SupplierBillsTab } from '../../components/suppliers';
import { useTabContext } from '../../contexts/TabContext';

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
  createdAt: string;
  updatedAt: string;
}

export function SupplierDetailPage() {
  const location = useLocation();
  const { updateTabTitle, replaceCurrentTab } = useTabContext();
  const { id } = useTabParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('summary');
  const [editModalOpen, setEditModalOpen] = useState(false);

  const supplierId = id ? parseInt(id, 10) : null;

  useEffect(() => {
    if (supplierId) {
      loadSupplier(supplierId);
    }
  }, [supplierId]);

  // Update tab title (only when this tab is active)
  useEffect(() => {
    if (location.pathname === `/suppliers/${id}`) {
      if (supplier) {
        updateTabTitle(location.pathname, `Supplier: ${supplier.company}`);
      } else {
        updateTabTitle(location.pathname, 'Supplier Detail');
      }
    }
  }, [supplier, id, location.pathname, updateTabTitle]);

  const loadSupplier = async (sId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_SUPPLIER, { id: sId });
      if (result.success && result.data) {
        setSupplier(result.data);
      } else {
        setError(result.error || 'Failed to load supplier');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string | number | null): string => {
    if (value === null) return '-';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  const formatDate = (date: Date | string): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <Stack p="xl" align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading supplier...</Text>
      </Stack>
    );
  }

  if (error || !supplier) {
    return (
      <Stack p="xl" gap="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error || 'Supplier not found'}
        </Alert>
        <Button leftSection={<IconArrowLeft size={16} />} onClick={() => replaceCurrentTab('/suppliers')}>
          Back to Suppliers
        </Button>
      </Stack>
    );
  }

  return (
    <Stack p="xl" gap="lg">
      {/* Header */}
      <Group justify="space-between" align="center">
        <Group>
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => replaceCurrentTab('/suppliers')}
            title="Back to Suppliers"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Stack gap={0}>
            <Group gap="sm">
              <Title order={2}>{supplier.company}</Title>
              <Badge color={supplier.isActive ? 'green' : 'gray'} variant="light">
                {supplier.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </Group>
          </Stack>
        </Group>
        <Group>
          <Button leftSection={<IconEdit size={16} />} onClick={() => setEditModalOpen(true)}>
            Edit Supplier
          </Button>
        </Group>
      </Group>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="summary" leftSection={<IconTruck size={16} />}>
            Summary
          </Tabs.Tab>
          <Tabs.Tab value="receiving" leftSection={<IconPackageImport size={16} />}>
            Receiving
          </Tabs.Tab>
          <Tabs.Tab value="bills" leftSection={<IconReceipt size={16} />}>
            Bills
          </Tabs.Tab>
        </Tabs.List>

        {/* Summary Tab */}
        <Tabs.Panel value="summary" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {/* Supplier Information */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconTruck size={20} />
                  <Title order={4}>Supplier Information</Title>
                </Group>
                <Divider />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Company Name
                  </Text>
                  <Text size="sm" fw={500}>
                    {supplier.company}
                  </Text>
                </Group>

                {supplier.contact1 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Contact 1
                    </Text>
                    <Text size="sm" fw={500}>
                      {supplier.contact1}
                    </Text>
                  </Group>
                )}

                {supplier.contact2 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Contact 2
                    </Text>
                    <Text size="sm" fw={500}>
                      {supplier.contact2}
                    </Text>
                  </Group>
                )}

                {supplier.notes && (
                  <>
                    <Divider />
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>
                        Notes
                      </Text>
                      <Text size="sm" c="dimmed">
                        {supplier.notes}
                      </Text>
                    </Stack>
                  </>
                )}
              </Stack>
            </Paper>

            {/* Contact Information */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconPhone size={20} />
                  <Title order={4}>Contact Information</Title>
                </Group>
                <Divider />

                {supplier.phone1 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Phone 1
                    </Text>
                    <Text size="sm" fw={500}>
                      {supplier.phone1}
                    </Text>
                  </Group>
                )}

                {supplier.phone2 && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Phone 2
                    </Text>
                    <Text size="sm" fw={500}>
                      {supplier.phone2}
                    </Text>
                  </Group>
                )}

                {supplier.fax && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Fax
                    </Text>
                    <Text size="sm" fw={500}>
                      {supplier.fax}
                    </Text>
                  </Group>
                )}

                {(supplier.email1 || supplier.email2) && (
                  <>
                    <Divider />
                    <Group gap="xs">
                      <IconMail size={16} />
                      <Text size="sm" fw={500}>
                        Email
                      </Text>
                    </Group>

                    {supplier.email1 && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Email 1
                        </Text>
                        <Text size="sm" fw={500}>
                          {supplier.email1}
                        </Text>
                      </Group>
                    )}

                    {supplier.email2 && (
                      <Group justify="space-between">
                        <Text size="sm" c="dimmed">
                          Email 2
                        </Text>
                        <Text size="sm" fw={500}>
                          {supplier.email2}
                        </Text>
                      </Group>
                    )}
                  </>
                )}
              </Stack>
            </Paper>

            {/* Address */}
            {(supplier.address1 || supplier.address2 || supplier.address3) && (
              <Paper p="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Group gap="xs">
                    <IconMapPin size={20} />
                    <Title order={4}>Address</Title>
                  </Group>
                  <Divider />

                  {supplier.address1 && <Text size="sm">{supplier.address1}</Text>}
                  {supplier.address2 && <Text size="sm">{supplier.address2}</Text>}
                  {supplier.address3 && <Text size="sm">{supplier.address3}</Text>}
                </Stack>
              </Paper>
            )}

            {/* Credit & Terms */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconCreditCard size={20} />
                  <Title order={4}>Credit & Terms</Title>
                </Group>
                <Divider />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Credit Limit
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatCurrency(supplier.credit)}
                  </Text>
                </Group>

                {supplier.creditDesc && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Credit Description
                    </Text>
                    <Text size="sm" fw={500}>
                      {supplier.creditDesc}
                    </Text>
                  </Group>
                )}

                {supplier.terms && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Payment Terms
                    </Text>
                    <Badge variant="light">{supplier.terms}</Badge>
                  </Group>
                )}

                <Divider />

                {supplier.discountPct && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Discount Percentage
                    </Text>
                    <Text size="sm" fw={500}>
                      {parseFloat(supplier.discountPct).toFixed(2)}%
                    </Text>
                  </Group>
                )}

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Taxable
                  </Text>
                  <Badge color={supplier.isTaxable ? 'blue' : 'gray'} variant="light">
                    {supplier.isTaxable ? 'Taxable' : 'Non-Taxable'}
                  </Badge>
                </Group>
              </Stack>
            </Paper>

            {/* Dates */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Title order={4}>Dates</Title>
                <Divider />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Created
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatDate(supplier.createdAt)}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Last Updated
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatDate(supplier.updatedAt)}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>

        {/* Other Tabs */}
        <Tabs.Panel value="receiving" pt="md">
          <SupplierReceivingTab supplierId={supplier.id} />
        </Tabs.Panel>

        <Tabs.Panel value="bills" pt="md">
          <SupplierBillsTab supplierId={supplier.id} />
        </Tabs.Panel>
      </Tabs>

      {/* Edit Modal */}
      <SupplierEditModal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        supplier={supplier}
        onSave={() => loadSupplier(supplier.id)}
      />
    </Stack>
  );
}
