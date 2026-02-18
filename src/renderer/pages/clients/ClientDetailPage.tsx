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
  Card,
  SimpleGrid,
  Divider,
  ActionIcon,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconAlertCircle,
  IconUser,
  IconPhone,
  IconMapPin,
  IconCreditCard,
  IconBuildingStore,
  IconFileInvoice,
  IconFileDescription,
  IconReceipt,
  IconCash,
} from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { IpcChannel } from '../../../shared/types/ipc';
import { ClientInvoicesTab, ClientQuotationsTab, ClientPaymentsTab, ClientCreditNotesTab, ClientEditModal } from '../../components/clients';
import { useTabContext } from '../../contexts/TabContext';

interface Client {
  id: number;
  clNumber: string | null;
  clientName: string;
  contact: string | null;
  address1: string | null;
  address2: string | null;
  phone: string | null;
  notes: string | null;
  credit: string;
  creditDesc: string | null;
  isTaxable: boolean;
  discountPct: string;
  creditLimit: string;
  creditTerms: string | null;
  custom1: string | null;
  custom2: string | null;
  lbDisc: string | null;
  isBadCredit: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export function ClientDetailPage() {
  const location = useLocation();
  const { updateTabTitle, replaceCurrentTab } = useTabContext();
  const { id } = useTabParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState<Client | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('summary');
  const [editModalOpen, setEditModalOpen] = useState(false);

  const clientId = id ? parseInt(id, 10) : null;

  useEffect(() => {
    if (clientId) {
      loadClient(clientId);
    }
  }, [clientId]);


  // Update tab title (only when this tab is active)
  useEffect(() => {
    if (location.pathname === `/clients/${id}`) {
      if (client) {
        updateTabTitle(location.pathname, `Client: ${client.clientName}`);
      } else {
        updateTabTitle(location.pathname, 'Client Detail');
      }
    }
  }, [client, id, location.pathname, updateTabTitle]);

  const loadClient = async (cId: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_CLIENT, { id: cId });
      if (result.success && result.data) {
        setClient(result.data);
      } else {
        setError(result.error || 'Failed to load client');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: string | number): string => {
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
        <Text c="dimmed">Loading client...</Text>
      </Stack>
    );
  }

  if (error || !client) {
    return (
      <Stack p="xl" gap="lg">
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error || 'Client not found'}
        </Alert>
        <Button leftSection={<IconArrowLeft size={16} />} onClick={() => replaceCurrentTab('/clients')}>
          Back to Clients
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
            onClick={() => replaceCurrentTab('/clients')}
            title="Back to Clients"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <Stack gap={0}>
            <Title order={2}>{client.clientName}</Title>
            {client.clNumber && (
              <Text size="sm" c="dimmed">
                {client.clNumber}
              </Text>
            )}
          </Stack>
        </Group>
        <Group>
          <Button
            leftSection={<IconEdit size={16} />}
            onClick={() => setEditModalOpen(true)}
          >
            Edit Client
          </Button>
        </Group>
      </Group>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="summary" leftSection={<IconUser size={16} />}>
            Summary
          </Tabs.Tab>
          <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={16} />}>
            Invoices
          </Tabs.Tab>
          <Tabs.Tab value="quotations" leftSection={<IconFileDescription size={16} />}>
            Quotations
          </Tabs.Tab>
          <Tabs.Tab value="creditNotes" leftSection={<IconReceipt size={16} />}>
            Credit Notes
          </Tabs.Tab>
          <Tabs.Tab value="payments" leftSection={<IconCash size={16} />}>
            Payments
          </Tabs.Tab>
        </Tabs.List>

        {/* Summary Tab */}
        <Tabs.Panel value="summary" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            {/* Client Information */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconUser size={20} />
                  <Title order={4}>Client Information</Title>
                </Group>
                <Divider />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Client Name
                  </Text>
                  <Text size="sm" fw={500}>
                    {client.clientName}
                  </Text>
                </Group>

                {client.clNumber && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Client Number
                    </Text>
                    <Badge variant="light">{client.clNumber}</Badge>
                  </Group>
                )}

                {client.contact && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Contact Person
                    </Text>
                    <Text size="sm" fw={500}>
                      {client.contact}
                    </Text>
                  </Group>
                )}

                {client.phone && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Phone
                    </Text>
                    <Text size="sm" fw={500}>
                      {client.phone}
                    </Text>
                  </Group>
                )}

                {(client.address1 || client.address2) && (
                  <>
                    <Divider />
                    <Stack gap="xs">
                      <Group gap="xs">
                        <IconMapPin size={16} />
                        <Text size="sm" fw={500}>
                          Address
                        </Text>
                      </Group>
                      {client.address1 && (
                        <Text size="sm" pl="md">
                          {client.address1}
                        </Text>
                      )}
                      {client.address2 && (
                        <Text size="sm" pl="md">
                          {client.address2}
                        </Text>
                      )}
                    </Stack>
                  </>
                )}

                {client.notes && (
                  <>
                    <Divider />
                    <Stack gap="xs">
                      <Text size="sm" fw={500}>
                        Notes
                      </Text>
                      <Text size="sm" c="dimmed">
                        {client.notes}
                      </Text>
                    </Stack>
                  </>
                )}
              </Stack>
            </Paper>

            {/* Credit & Pricing */}
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Group gap="xs">
                  <IconCreditCard size={20} />
                  <Title order={4}>Credit & Pricing</Title>
                </Group>
                <Divider />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Credit Limit
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatCurrency(client.creditLimit)}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Current Credit
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatCurrency(client.credit)}
                  </Text>
                </Group>

                {client.creditTerms && (
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Credit Terms
                    </Text>
                    <Badge variant="light">{client.creditTerms}</Badge>
                  </Group>
                )}

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Credit Status
                  </Text>
                  <Badge color={client.isBadCredit ? 'red' : 'green'} variant="light">
                    {client.isBadCredit ? 'Bad Credit' : 'Good Standing'}
                  </Badge>
                </Group>

                <Divider />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Discount Percentage
                  </Text>
                  <Text size="sm" fw={500}>
                    {parseFloat(client.discountPct).toFixed(2)}%
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Taxable
                  </Text>
                  <Badge color={client.isTaxable ? 'blue' : 'gray'} variant="light">
                    {client.isTaxable ? 'Taxable' : 'Non-Taxable'}
                  </Badge>
                </Group>
              </Stack>
            </Paper>

            {/* Custom Fields */}
            {(client.custom1 || client.custom2 || client.lbDisc) && (
              <Paper p="lg" radius="md" withBorder>
                <Stack gap="md">
                  <Title order={4}>Custom Fields</Title>
                  <Divider />

                  {client.custom1 && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Custom Field 1
                      </Text>
                      <Text size="sm" fw={500}>
                        {client.custom1}
                      </Text>
                    </Group>
                  )}

                  {client.custom2 && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Custom Field 2
                      </Text>
                      <Text size="sm" fw={500}>
                        {client.custom2}
                      </Text>
                    </Group>
                  )}

                  {client.lbDisc && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        LB Disc
                      </Text>
                      <Text size="sm" fw={500}>
                        {parseFloat(client.lbDisc).toFixed(2)}%
                      </Text>
                    </Group>
                  )}
                </Stack>
              </Paper>
            )}

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
                    {formatDate(client.createdAt)}
                  </Text>
                </Group>

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    Last Updated
                  </Text>
                  <Text size="sm" fw={500}>
                    {formatDate(client.updatedAt)}
                  </Text>
                </Group>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>

        {/* Other Tabs */}
        <Tabs.Panel value="invoices" pt="md">
          <ClientInvoicesTab clientId={client.id} />
        </Tabs.Panel>

        <Tabs.Panel value="quotations" pt="md">
          <ClientQuotationsTab clientId={client.id} />
        </Tabs.Panel>

        <Tabs.Panel value="creditNotes" pt="md">
          <ClientCreditNotesTab clientId={client.id} />
        </Tabs.Panel>

        <Tabs.Panel value="payments" pt="md">
          <ClientPaymentsTab clientId={client.id} />
        </Tabs.Panel>
      </Tabs>

      {/* Edit Modal */}
      <ClientEditModal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        client={client}
        onSave={() => loadClient(client.id)}
      />
    </Stack>
  );
}
