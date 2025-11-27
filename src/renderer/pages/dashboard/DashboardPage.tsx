import { Title, SimpleGrid, Stack, Group, Button, Alert } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import {
  IconFileInvoice,
  IconAlertCircle,
  IconPackage,
  IconCash,
  IconPlus,
  IconUsers,
} from '@tabler/icons-react';
import { StatCard } from '../../components/widgets/StatCard';
import { RecentInvoicesWidget } from '../../components/widgets/RecentInvoicesWidget';
import { useInvoices } from '../../hooks';
import { usePartVariants } from '../../hooks';
import { useMemo } from 'react';
import numeral from 'numeral';

export function DashboardPage() {
  const navigate = useNavigate();
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

    const lowStockItems = variants.filter((v) => v.stockQty <= v.reorderLevel && v.active);

    return {
      unpaidCount: unpaidInvoices.length,
      unpaidAmount: unpaidInvoices.reduce((sum, inv) => sum + (parseFloat(inv.balance) || 0), 0),
      todaySales,
      lowStockCount: lowStockItems.length,
    };
  }, [invoices, variants]);

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Dashboard</Title>
        <Group>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/clients/new')}
            variant="light"
          >
            New Client
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate('/invoices/new')}
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
            onClick={() => navigate('/inventory/parts')}
          >
            View Inventory
          </Button>
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <RecentInvoicesWidget invoices={invoices} loading={invoicesLoading} />

        <StatCard
          title="Quick Actions"
          value=""
          icon={<IconUsers size={24} />}
          color="violet"
        />
      </SimpleGrid>
    </Stack>
  );
}
