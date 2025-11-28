import { Title, SimpleGrid, Stack, Group, Button, Alert, Paper, Text, UnstyledButton, ThemeIcon } from '@mantine/core';
import {
  IconFileInvoice,
  IconAlertCircle,
  IconPackage,
  IconCash,
  IconPlus,
  IconUsers,
  IconFileText,
  IconUserPlus,
  IconBox,
} from '@tabler/icons-react';
import { StatCard } from '../../components/widgets/StatCard';
import { RecentInvoicesWidget } from '../../components/widgets/RecentInvoicesWidget';
import { useInvoices } from '../../hooks';
import { usePartVariants } from '../../hooks';
import { useTabManager } from '../../contexts/TabManagerContext';
import { useMemo } from 'react';
import numeral from 'numeral';

export function DashboardPage() {
  const { openTab } = useTabManager();
  const { invoices, loading: invoicesLoading } = useInvoices();
  const { variants, loading: variantsLoading } = usePartVariants();

  // Calculate stats
  const stats = useMemo(() => {
    const unpaidInvoices = invoices.filter((inv) => inv.status !== 'PAID' && inv.status !== 'CANCELLED');
    const todaySales = invoices
      .filter((inv) => {
        const createdDate = new Date(inv.createdAt || '');
        const today = new Date();
        return createdDate.toDateString() === today.toDateString();
      })
      .reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);

    const lowStockItems = variants.filter((v) => v.stockQty <= v.reorderLevel);

    // Calculate outstanding amount as total - amountPaid
    const unpaidAmount = unpaidInvoices.reduce((sum, inv) => {
      const total = parseFloat(inv.total) || 0;
      const paid = parseFloat(inv.amountPaid) || 0;
      return sum + (total - paid);
    }, 0);

    return {
      unpaidCount: unpaidInvoices.length,
      unpaidAmount,
      todaySales,
      lowStockCount: lowStockItems.length,
    };
  }, [invoices, variants]);

  // Quick action items
  const quickActions = [
    {
      label: 'New Invoice',
      icon: IconFileInvoice,
      color: 'blue',
      onClick: () => openTab({ type: 'invoice-editor', path: '/invoices/new', title: 'New Invoice', entityId: 'new' }),
    },
    {
      label: 'New Quotation',
      icon: IconFileText,
      color: 'teal',
      onClick: () => openTab({ type: 'quotation-editor', path: '/quotations/new', title: 'New Quotation', entityId: 'new' }),
    },
    {
      label: 'New Client',
      icon: IconUserPlus,
      color: 'violet',
      onClick: () => openTab({ type: 'client-detail', path: '/clients/new', title: 'New Client', entityId: 'new' }),
    },
    {
      label: 'New Part',
      icon: IconBox,
      color: 'orange',
      onClick: () => openTab({ type: 'part-detail', path: '/parts/new', title: 'New Part', entityId: 'new' }),
    },
    {
      label: 'View Clients',
      icon: IconUsers,
      color: 'cyan',
      onClick: () => openTab({ type: 'clients-list', path: '/clients', title: 'Clients' }),
    },
    {
      label: 'View Inventory',
      icon: IconPackage,
      color: 'green',
      onClick: () => openTab({ type: 'parts-list', path: '/parts', title: 'Inventory' }),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Dashboard</Title>
        <Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => openTab({ type: 'client-detail', path: '/clients/new', title: 'New Client', entityId: 'new' })}
            variant="light"
          >
            New Client
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => openTab({ type: 'invoice-editor', path: '/invoices/new', title: 'New Invoice', entityId: 'new' })}
          >
            New Invoice
          </Button>
        </Group>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <StatCard
          title="Today's Sales"
          value={ numeral(stats.todaySales).format('$0,0.00') }
          icon={<IconCash size={24} />}
          color="green"
          loading={invoicesLoading}
        />
        <StatCard
          title="Pending Invoices"
          value={ numeral(stats.unpaidCount).format('0,0') }
          icon={<IconFileInvoice size={24} />}
          color="blue"
          loading={invoicesLoading}
        />
        <StatCard
          title="Outstanding Amount"
          value={ numeral(stats.unpaidAmount).format('$0,0.00') }
          icon={<IconCash size={24} />}
          color="orange"
          loading={invoicesLoading}
        />
        <StatCard
          title="Low Stock Items"
          value={stats.lowStockCount}
          icon={<IconPackage size={24} />}
          color="red"
          loading={variantsLoading}
        />
      </SimpleGrid>

      {stats.lowStockCount > 0 && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Low Stock Alert"
          color="red"
          variant="light"
        >
          {stats.lowStockCount} item{stats.lowStockCount > 1 ? 's are' : ' is'} running low on stock.
          <Button
            variant="subtle"
            size="xs"
            ml="md"
            onClick={() => openTab({ type: 'parts-list', path: '/parts', title: 'Inventory' })}
          >
            View Inventory
          </Button>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <RecentInvoicesWidget invoices={invoices} loading={invoicesLoading} />

        <Paper p="md" radius="md" withBorder>
          <Text fw={600} size="lg" mb="md">Quick Actions</Text>
          <SimpleGrid cols={2}>
            {quickActions.map((action) => (
              <UnstyledButton
                key={action.label}
                onClick={action.onClick}
                p="md"
                style={{
                  borderRadius: 'var(--mantine-radius-md)',
                  transition: 'background-color 150ms ease',
                }}
                styles={{
                  root: {
                    '&:hover': {
                      backgroundColor: 'var(--mantine-color-gray-light-hover)',
                    },
                  },
                }}
              >
                <Group>
                  <ThemeIcon size="lg" radius="md" variant="light" color={action.color}>
                    <action.icon size={20} />
                  </ThemeIcon>
                  <Text size="sm" fw={500}>{action.label}</Text>
                </Group>
              </UnstyledButton>
            ))}
          </SimpleGrid>
        </Paper>
      </SimpleGrid>
    </Stack>
  );
}
