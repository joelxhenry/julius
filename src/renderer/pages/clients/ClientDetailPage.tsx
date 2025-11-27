import { useParams, useNavigate } from 'react-router-dom';
import { Title, Tabs, Paper, Group, Button, LoadingOverlay, Text } from '@mantine/core';
import { IconArrowLeft, IconEdit, IconUser, IconFileInvoice, IconCash, IconReceipt } from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useClients } from '../../hooks';
import type { Client } from '../../../main/database/schema';

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById } = useClients();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadClient = async () => {
      if (!id) return;
      try {
        const data = await getById(parseInt(id));
        setClient(data);
      } catch (error) {
        console.error('Failed to load client:', error);
      } finally {
        setLoading(false);
      }
    };

    loadClient();
  }, [id, getById]);

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!client) {
    return (
      <Paper p="xl">
        <Text>Client not found</Text>
        <Button onClick={() => navigate('/clients')} mt="md">
          Back to Clients
        </Button>
      </Paper>
    );
  }

  return (
    <div>
      <Group mb="md">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/clients')}
        >
          Back
        </Button>
        <Title order={2}>{client.name}</Title>
        <Button
          ml="auto"
          leftSection={<IconEdit size={16} />}
          variant="light"
        >
          Edit
        </Button>
      </Group>

      <Tabs defaultValue="info">
        <Tabs.List>
          <Tabs.Tab value="info" leftSection={<IconUser size={16} />}>
            Information
          </Tabs.Tab>
          <Tabs.Tab value="invoices" leftSection={<IconFileInvoice size={16} />}>
            Invoices
          </Tabs.Tab>
          <Tabs.Tab value="payments" leftSection={<IconCash size={16} />}>
            Payments
          </Tabs.Tab>
          <Tabs.Tab value="credit" leftSection={<IconReceipt size={16} />}>
            Credit
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="info" pt="md">
          <Paper withBorder p="md">
            <Text fw={500} mb="xs">Contact Information</Text>
            <Text size="sm">Phone: {client.phone || 'N/A'}</Text>
            <Text size="sm">Email: {client.email || 'N/A'}</Text>
            <Text size="sm" mt="md" fw={500}>Address</Text>
            <Text size="sm">{client.address1 || 'N/A'}</Text>
            {client.address2 && <Text size="sm">{client.address2}</Text>}
            <Text size="sm" mt="md" fw={500}>Credit Details</Text>
            <Text size="sm">Credit Limit: ${client.creditLimit || '0.00'}</Text>
            <Text size="sm">Discount Rate: {client.discountRate || 0}%</Text>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="invoices" pt="md">
          <Paper withBorder p="md">
            <Text c="dimmed">Invoice history will be displayed here</Text>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="payments" pt="md">
          <Paper withBorder p="md">
            <Text c="dimmed">Payment history will be displayed here</Text>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="credit" pt="md">
          <Paper withBorder p="md">
            <Text c="dimmed">Credit balance and history will be displayed here</Text>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
