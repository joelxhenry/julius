import { Title, Group, Button, Modal, Stack } from '@mantine/core';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconPlus } from '@tabler/icons-react';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { ClientForm } from '../../components/forms/ClientForm';
import { useClients } from '../../hooks';
import type { Client } from '../../../main/database/schema';
import { ClientFormData } from '../../utils/schemas';

export function ClientsListPage() {
  const navigate = useNavigate();
  const { clients, loading, create } = useClients();
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const columns: ColumnDef<Client>[] = [
    { key: 'id', title: 'ID', sortable: true, width: 80 },
    { key: 'name', title: 'Name', sortable: true },
    { key: 'phone', title: 'Phone' },
    { key: 'email', title: 'Email' },
    {
      key: 'creditLimit',
      title: 'Credit Limit',
      sortable: true,
      render: (value) => `$${(value || 0)}`,
    },
    {
      key: 'discountRate',
      title: 'Discount %',
      sortable: true,
      render: (value) => `${value || 0}%`,
    },
  ];

  const handleCreate = async (data: ClientFormData) => {
    setIsCreating(true);
    try {
      await create(data);
      setCreateModalOpened(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Clients</Title>
        <Button
          leftSection={<IconPlus size={16} />}
          onClick={() => setCreateModalOpened(true)}
        >
          New Client
        </Button>
      </Group>

      <DataTable
        data={clients}
        columns={columns}
        loading={loading}
        onRowClick={(client) => navigate(`/clients/${client.id}`)}
        searchable
        pagination
        keyboardNav
      />

      <Modal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        title="Create New Client"
        size="lg"
      >
        <ClientForm
          onSubmit={handleCreate}
          onCancel={() => setCreateModalOpened(false)}
          loading={isCreating}
        />
      </Modal>
    </Stack>
  );
}
