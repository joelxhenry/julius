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
  Table,
  Loader,
  Alert,
  Card,
  SimpleGrid,
  Pagination,
  Skeleton,
  NumberFormatter,
  Modal,
  TextInput,
  NumberInput,
  Select,
  ActionIcon,
  Menu,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconEdit,
  IconAlertCircle,
  IconPackage,
  IconVersions,
  IconAdjustments,
  IconExchange,
  IconHistory,
  IconChartLine,
  IconAlertTriangle,
  IconPlus,
  IconTrash,
  IconCheck,
  IconDotsVertical,
} from '@tabler/icons-react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { IpcChannel } from '../../../shared/types/ipc';
import { useTabContext } from '../../contexts/TabContext';
import { VariantForm } from '../../components/forms/VariantForm';
import { AlternateForm } from '../../components/forms/AlternateForm';

interface Inventory {
  id: number;
  sku: string;
  location: string | null;
  description1: string | null;
  description2: string | null;
  quantity: number;
  minLevel: number;
  isTaxable: boolean;
  cost: string;
  costCurrency: string;
  price: string;
  priceCurrency: string;
  margin: string | null;
  unit: string;
  category: string | null;
  model: string | null;
  wholesalePrice: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Variant {
  id: number;
  parentSku: string;
  variantSku: string;
  variantName: string | null;
  variantType: string | null;
  attributes: Record<string, any>;
  description: string | null;
  quantity: number;
  cost: string | null;
  costCurrency: string;
  price: string | null;
  priceCurrency: string;
  wholesalePrice: string | null;
  isActive: boolean;
}

interface InventoryAlternate {
  id: number;
  partNo: string;
  alternateNo: string;
  supplier: string | null;
}

interface InventoryTransaction {
  id: number;
  sku: string;
  activity: string;
  reference: string | null;
  quantity: number;
  activityDate: string;
  createdAt: Date;
}

interface SaleRecord {
  id: number;
  documentNumber: string;
  documentType: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  documentDate: string;
  clientName?: string;
}

interface SalesSummary {
  totalQuantitySold: number;
  totalRevenue: number;
  averagePrice: number;
  transactionCount: number;
}

interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const ACTIVITY_LABELS: Record<string, string> = {
  'IN': 'Received',
  'OUT': 'Sold',
  'ADJ': 'Adjustment',
  'RET': 'Return',
  'TRF': 'Transfer',
};

const ACTIVITY_COLORS: Record<string, string> = {
  'IN': 'green',
  'OUT': 'red',
  'ADJ': 'blue',
  'RET': 'orange',
  'TRF': 'violet',
};

export function InventoryDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const { updateTabTitle } = useTabContext();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Inventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  // Update tab title when item loads
  useEffect(() => {
    if (item) {
      updateTabTitle(location.pathname, `${item.sku} - ${item.description1 || 'Inventory Item'}`);
    }
  }, [item, location.pathname, updateTabTitle]);

  // Variants state
  const [variants, setVariants] = useState<Variant[]>([]);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [addVariantOpen, setAddVariantOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [variantSubmitting, setVariantSubmitting] = useState(false);

  // Alternates state
  const [alternates, setAlternates] = useState<InventoryAlternate[]>([]);
  const [alternatesLoading, setAlternatesLoading] = useState(false);
  const [addAlternateOpen, setAddAlternateOpen] = useState(false);
  const [alternateSubmitting, setAlternateSubmitting] = useState(false);

  // Transactions state
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactionsTotalPages, setTransactionsTotalPages] = useState(1);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Sales state
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotalPages, setSalesTotalPages] = useState(1);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);

  // Stock adjustment modal
  const [stockAdjustOpen, setStockAdjustOpen] = useState(false);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  const itemId = id ? parseInt(id, 10) : null;

  const stockAdjustForm = useForm({
    initialValues: {
      adjustmentType: 'set',
      quantity: 0,
      reason: '',
    },
  });

  useEffect(() => {
    if (itemId) {
      loadInventoryItem(itemId);
    }
  }, [itemId]);

  useEffect(() => {
    if (item?.id && activeTab === 'variants') {
      loadVariants(item.id);
    }
  }, [item?.id, activeTab]);

  useEffect(() => {
    if (item?.sku && activeTab === 'alternates') {
      loadAlternates(item.sku);
    }
  }, [item?.sku, activeTab]);

  useEffect(() => {
    if (item?.sku && activeTab === 'transactions') {
      loadTransactions(item.sku, transactionsPage);
    }
  }, [item?.sku, activeTab, transactionsPage]);

  useEffect(() => {
    if (item?.sku && activeTab === 'sales') {
      loadSales(item.sku, salesPage);
      loadSalesSummary(item.sku);
    }
  }, [item?.sku, activeTab, salesPage]);

  const loadInventoryItem = async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_ITEM, { id });
      if (result.success && result.data) {
        setItem(result.data);
      } else {
        setError(result.error || 'Failed to load inventory item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const loadVariants = async (inventoryId: number) => {
    setVariantsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_VARIANTS_BY_INVENTORY, { inventoryId });
      if (result.success && result.data) {
        setVariants(result.data);
      }
    } catch (err) {
      console.error('Failed to load variants:', err);
    } finally {
      setVariantsLoading(false);
    }
  };

  const loadAlternates = async (sku: string) => {
    setAlternatesLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_ALTERNATES_BY_PART, { partNo: sku });
      if (result.success && result.data) {
        setAlternates(result.data);
      }
    } catch (err) {
      console.error('Failed to load alternates:', err);
    } finally {
      setAlternatesLoading(false);
    }
  };

  const loadTransactions = async (sku: string, page: number) => {
    setTransactionsLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_TRANSACTIONS_BY_SKU, { sku, page, pageSize: 10 });
      if (result.success && result.data) {
        setTransactions(result.data.data);
        setTransactionsTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setTransactionsLoading(false);
    }
  };

  const loadSales = async (sku: string, page: number) => {
    setSalesLoading(true);
    try {
      const result = await window.electron.invoke(IpcChannel.GET_VARIANT_SALES, { sku, page, pageSize: 10 });
      if (result.success && result.data) {
        setSales(result.data.data);
        setSalesTotalPages(result.data.totalPages);
      }
    } catch (err) {
      console.error('Failed to load sales:', err);
    } finally {
      setSalesLoading(false);
    }
  };

  const loadSalesSummary = async (sku: string) => {
    try {
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_SALES_SUMMARY, { sku });
      if (result.success && result.data) {
        setSalesSummary(result.data);
      }
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    }
  };

  const handleStockAdjust = async (values: typeof stockAdjustForm.values) => {
    if (!item) return;
    setAdjustSubmitting(true);

    try {
      let newQuantity: number;
      if (values.adjustmentType === 'set') {
        newQuantity = values.quantity;
      } else if (values.adjustmentType === 'add') {
        newQuantity = item.quantity + values.quantity;
      } else {
        newQuantity = item.quantity - values.quantity;
      }

      const result = await window.electron.invoke(IpcChannel.UPDATE_INVENTORY_STOCK, {
        id: item.id,
        quantity: newQuantity,
      });

      if (result.success) {
        // Create transaction record
        await window.electron.invoke(IpcChannel.CREATE_INVENTORY_TRANSACTION, {
          sku: item.sku,
          activity: 'ADJ',
          reference: values.reason || 'Manual adjustment',
          quantity: values.adjustmentType === 'set' ? newQuantity - item.quantity : (values.adjustmentType === 'add' ? values.quantity : -values.quantity),
          activityDate: new Date().toISOString().split('T')[0],
        });

        notifications.show({
          title: 'Stock Adjusted',
          message: `Quantity updated to ${newQuantity} ${item.unit}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        setItem({ ...item, quantity: newQuantity });
        setStockAdjustOpen(false);
        stockAdjustForm.reset();

        // Refresh transactions if on that tab
        if (activeTab === 'transactions') {
          loadTransactions(item.sku, transactionsPage);
        }
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to adjust stock',
          color: 'red',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'An error occurred',
        color: 'red',
      });
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleAddVariant = async (values: {
    variantSku: string;
    variantName: string;
    variantType: string;
    description: string;
    quantity: number;
    cost: string;
    costCurrency: string;
    price: string;
    priceCurrency: string;
    wholesalePrice: string;
    isActive: boolean;
  }) => {
    if (!item) return;

    setVariantSubmitting(true);
    try {
      const data = {
        parentSku: item.sku,
        variantSku: values.variantSku,
        variantName: values.variantName || null,
        variantType: values.variantType || null,
        description: values.description || null,
        quantity: values.quantity,
        cost: values.cost || null,
        costCurrency: values.costCurrency,
        price: values.price || null,
        priceCurrency: values.priceCurrency,
        wholesalePrice: values.wholesalePrice || null,
        isActive: values.isActive,
        attributes: {},
      };

      let result;
      if (editingVariant) {
        result = await window.electron.invoke(IpcChannel.UPDATE_VARIANT, {
          id: editingVariant.id,
          data,
        });
      } else {
        result = await window.electron.invoke(IpcChannel.CREATE_VARIANT, data);
      }

      if (result.success) {
        notifications.show({
          title: editingVariant ? 'Variant Updated' : 'Variant Created',
          message: `${values.variantSku} has been ${editingVariant ? 'updated' : 'created'}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        setAddVariantOpen(false);
        setEditingVariant(null);
        loadVariants(item.id);
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to save variant',
          color: 'red',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'An error occurred',
        color: 'red',
      });
    } finally {
      setVariantSubmitting(false);
    }
  };

  const handleDeleteVariant = async (variantId: number) => {
    if (!item) return;

    try {
      const result = await window.electron.invoke(IpcChannel.DELETE_VARIANT, { id: variantId });

      if (result.success) {
        notifications.show({
          title: 'Variant Deleted',
          message: 'Variant has been removed',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        loadVariants(item.id);
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to delete variant',
          color: 'red',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'An error occurred',
        color: 'red',
      });
    }
  };

  const handleAddAlternate = async (values: { alternateNo: string; supplier: string }) => {
    if (!item) return;

    setAlternateSubmitting(true);
    try {
      const result = await window.electron.invoke(IpcChannel.CREATE_INVENTORY_ALTERNATE, {
        partNo: item.sku,
        alternateNo: values.alternateNo,
        supplier: values.supplier || undefined,
      });

      if (result.success) {
        notifications.show({
          title: 'Alternate Added',
          message: `${values.alternateNo} has been linked as an alternate`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        setAddAlternateOpen(false);
        loadAlternates(item.sku);
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to add alternate',
          color: 'red',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'An error occurred',
        color: 'red',
      });
    } finally {
      setAlternateSubmitting(false);
    }
  };

  const handleDeleteAlternate = async (alternateNo: string) => {
    if (!item) return;

    try {
      const result = await window.electron.invoke(IpcChannel.DELETE_INVENTORY_ALTERNATE, {
        partNo: item.sku,
        alternateNo,
      });

      if (result.success) {
        notifications.show({
          title: 'Alternate Removed',
          message: `${alternateNo} has been unlinked`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });
        loadAlternates(item.sku);
      } else {
        notifications.show({
          title: 'Error',
          message: result.error || 'Failed to remove alternate',
          color: 'red',
        });
      }
    } catch (err) {
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'An error occurred',
        color: 'red',
      });
    }
  };

  const formatCurrency = (amount: number | string, currency = 'JMD') => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-JM', {
      style: 'currency',
      currency: currency === 'US' ? 'USD' : 'JMD',
    }).format(numAmount);
  };

  const isLowStock = item && item.quantity <= item.minLevel;

  if (loading) {
    return (
      <Stack p="xl" align="center" justify="center" h={400}>
        <Loader size="lg" />
        <Text c="dimmed">Loading inventory item...</Text>
      </Stack>
    );
  }

  if (error || !item) {
    return (
      <Stack p="xl" gap="lg">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => navigate('/inventory')}
        >
          Back to Inventory
        </Button>
        <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
          {error || 'Inventory item not found'}
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack p="xl" gap="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/inventory')}
          >
            Back
          </Button>
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={2}>{item.sku}</Title>
              {isLowStock && (
                <Badge color="orange" variant="light" leftSection={<IconAlertTriangle size={12} />}>
                  Low Stock
                </Badge>
              )}
              {item.isTaxable && (
                <Badge color="blue" variant="light" size="sm">
                  Taxable
                </Badge>
              )}
            </Group>
            <Text c="dimmed" size="sm">
              {item.description1}
            </Text>
          </Stack>
        </Group>
        <Group>
          <Button
            variant="outline"
            leftSection={<IconAdjustments size={16} />}
            onClick={() => setStockAdjustOpen(true)}
          >
            Adjust Stock
          </Button>
          <Button
            leftSection={<IconEdit size={16} />}
            onClick={() => navigate(`/inventory/${item.id}/edit`)}
          >
            Edit
          </Button>
        </Group>
      </Group>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md">
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Quantity</Text>
          <Text size="xl" fw={700} c={isLowStock ? 'orange' : undefined}>
            {item.quantity} {item.unit}
          </Text>
          <Text size="xs" c="dimmed">Min: {item.minLevel}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Cost</Text>
          <Text size="xl" fw={700}>
            <NumberFormatter value={item.cost} prefix="$" thousandSeparator decimalScale={2} />
          </Text>
          <Text size="xs" c="dimmed">{item.costCurrency}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Price</Text>
          <Text size="xl" fw={700}>
            <NumberFormatter value={item.price} prefix="$" thousandSeparator decimalScale={2} />
          </Text>
          <Text size="xs" c="dimmed">{item.priceCurrency}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Wholesale</Text>
          <Text size="xl" fw={700}>
            {item.wholesalePrice ? (
              <NumberFormatter value={item.wholesalePrice} prefix="$" thousandSeparator decimalScale={2} />
            ) : '-'}
          </Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Margin</Text>
          <Text size="xl" fw={700}>
            {item.margin ? `${parseFloat(item.margin).toFixed(1)}%` : '-'}
          </Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Location</Text>
          <Text size="xl" fw={700}>{item.location || '-'}</Text>
        </Card>
      </SimpleGrid>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconPackage size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="variants" leftSection={<IconVersions size={16} />}>
            Variants
          </Tabs.Tab>
          <Tabs.Tab value="alternates" leftSection={<IconExchange size={16} />}>
            Alternates
          </Tabs.Tab>
          <Tabs.Tab value="transactions" leftSection={<IconHistory size={16} />}>
            Transactions
          </Tabs.Tab>
          <Tabs.Tab value="sales" leftSection={<IconChartLine size={16} />}>
            Sales
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="md">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Title order={4}>Product Details</Title>
                <SimpleGrid cols={2}>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">SKU</Text>
                    <Text fw={500}>{item.sku}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Category</Text>
                    <Text fw={500}>{item.category || '-'}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Model</Text>
                    <Text fw={500}>{item.model || '-'}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Unit</Text>
                    <Text fw={500}>{item.unit}</Text>
                  </Stack>
                </SimpleGrid>
                {item.description2 && (
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Additional Description</Text>
                    <Text>{item.description2}</Text>
                  </Stack>
                )}
              </Stack>
            </Paper>

            <Paper p="lg" radius="md" withBorder>
              <Stack gap="md">
                <Title order={4}>Pricing Information</Title>
                <SimpleGrid cols={2}>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Cost</Text>
                    <Text fw={500}>{formatCurrency(item.cost, item.costCurrency)}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Selling Price</Text>
                    <Text fw={500}>{formatCurrency(item.price, item.priceCurrency)}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Wholesale Price</Text>
                    <Text fw={500}>{item.wholesalePrice ? formatCurrency(item.wholesalePrice, item.priceCurrency) : '-'}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Margin</Text>
                    <Text fw={500}>{item.margin ? `${parseFloat(item.margin).toFixed(2)}%` : '-'}</Text>
                  </Stack>
                  <Stack gap={2}>
                    <Text size="xs" c="dimmed">Taxable</Text>
                    <Badge color={item.isTaxable ? 'green' : 'gray'} variant="light" size="sm">
                      {item.isTaxable ? 'Yes' : 'No'}
                    </Badge>
                  </Stack>
                </SimpleGrid>
              </Stack>
            </Paper>
          </SimpleGrid>
        </Tabs.Panel>

        {/* Variants Tab */}
        <Tabs.Panel value="variants" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={500}>Product Variants</Text>
                <Button
                  leftSection={<IconPlus size={16} />}
                  size="sm"
                  variant="light"
                  onClick={() => {
                    setEditingVariant(null);
                    setAddVariantOpen(true);
                  }}
                >
                  Add Variant
                </Button>
              </Group>
              <Table.ScrollContainer minWidth={600}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Variant SKU</Table.Th>
                      <Table.Th>Name</Table.Th>
                      <Table.Th>Type</Table.Th>
                      <Table.Th>Quantity</Table.Th>
                      <Table.Th>Price</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {variantsLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Table.Tr key={i}>
                          {Array.from({ length: 7 }).map((_, j) => (
                            <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                          ))}
                        </Table.Tr>
                      ))
                    ) : variants.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={7}>
                          <Text c="dimmed" ta="center" py="xl">No variants found</Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      variants.map((variant) => (
                        <Table.Tr key={variant.id}>
                          <Table.Td><Text fw={500}>{variant.variantSku}</Text></Table.Td>
                          <Table.Td>{variant.variantName || '-'}</Table.Td>
                          <Table.Td>
                            {variant.variantType && (
                              <Badge variant="light" size="sm">{variant.variantType}</Badge>
                            )}
                          </Table.Td>
                          <Table.Td>{variant.quantity}</Table.Td>
                          <Table.Td>
                            {variant.price ? (
                              <NumberFormatter value={variant.price} prefix="$" thousandSeparator decimalScale={2} />
                            ) : '-'}
                          </Table.Td>
                          <Table.Td>
                            <Badge color={variant.isActive ? 'green' : 'gray'} variant="light" size="sm">
                              {variant.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Menu position="bottom-end" shadow="md">
                              <Menu.Target>
                                <ActionIcon variant="subtle">
                                  <IconDotsVertical size={16} />
                                </ActionIcon>
                              </Menu.Target>
                              <Menu.Dropdown>
                                <Menu.Item
                                  leftSection={<IconEdit size={14} />}
                                  onClick={() => {
                                    setEditingVariant(variant);
                                    setAddVariantOpen(true);
                                  }}
                                >
                                  Edit
                                </Menu.Item>
                                <Menu.Item
                                  leftSection={<IconTrash size={14} />}
                                  color="red"
                                  onClick={() => handleDeleteVariant(variant.id)}
                                >
                                  Delete
                                </Menu.Item>
                              </Menu.Dropdown>
                            </Menu>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* Alternates Tab */}
        <Tabs.Panel value="alternates" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Stack gap="md">
              <Group justify="space-between">
                <Text fw={500}>Alternative Part Numbers</Text>
                <Button leftSection={<IconPlus size={16} />} size="sm" variant="light" onClick={() => setAddAlternateOpen(true)}>
                  Add Alternate
                </Button>
              </Group>
              <Table.ScrollContainer minWidth={400}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Alternate SKU</Table.Th>
                      <Table.Th>Supplier</Table.Th>
                      <Table.Th>Actions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {alternatesLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <Table.Tr key={i}>
                          {Array.from({ length: 3 }).map((_, j) => (
                            <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                          ))}
                        </Table.Tr>
                      ))
                    ) : alternates.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={3}>
                          <Text c="dimmed" ta="center" py="xl">No alternates found</Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      alternates.map((alt) => {
                      const alternateSku = alt.partNo === item.sku ? alt.alternateNo : alt.partNo;
                      return (
                        <Table.Tr key={alt.id}>
                          <Table.Td>
                            <Text
                              fw={500}
                              c="blue"
                              style={{ cursor: 'pointer' }}
                              onClick={async () => {
                                try {
                                  const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_BY_SKU, { sku: alternateSku });
                                  if (result.success && result.data) {
                                    navigate(`/inventory/${result.data.id}`);
                                  } else {
                                    notifications.show({
                                      title: 'Item Not Found',
                                      message: `Could not find inventory item with SKU: ${alternateSku}`,
                                      color: 'orange',
                                    });
                                  }
                                } catch (err) {
                                  console.error('Failed to navigate to alternate:', err);
                                }
                              }}
                            >
                              {alternateSku}
                            </Text>
                          </Table.Td>
                          <Table.Td>{alt.supplier || '-'}</Table.Td>
                          <Table.Td>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => handleDeleteAlternate(alternateSku)}
                              title="Remove alternate"
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* Transactions Tab */}
        <Tabs.Panel value="transactions" pt="md">
          <Paper p="md" radius="md" withBorder>
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Date</Table.Th>
                    <Table.Th>Activity</Table.Th>
                    <Table.Th>Quantity</Table.Th>
                    <Table.Th>Reference</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {transactionsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <Table.Tr key={i}>
                        {Array.from({ length: 4 }).map((_, j) => (
                          <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                        ))}
                      </Table.Tr>
                    ))
                  ) : transactions.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={4}>
                        <Text c="dimmed" ta="center" py="xl">No transactions found</Text>
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    transactions.map((trans) => (
                      <Table.Tr key={trans.id}>
                        <Table.Td>{trans.activityDate}</Table.Td>
                        <Table.Td>
                          <Badge color={ACTIVITY_COLORS[trans.activity] || 'gray'} variant="light" size="sm">
                            {ACTIVITY_LABELS[trans.activity] || trans.activity}
                          </Badge>
                        </Table.Td>
                        <Table.Td>
                          <Text c={trans.quantity > 0 ? 'green' : trans.quantity < 0 ? 'red' : undefined}>
                            {trans.quantity > 0 ? '+' : ''}{trans.quantity}
                          </Text>
                        </Table.Td>
                        <Table.Td>{trans.reference || '-'}</Table.Td>
                      </Table.Tr>
                    ))
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
            {transactionsTotalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={transactionsTotalPages} value={transactionsPage} onChange={setTransactionsPage} size="sm" />
              </Group>
            )}
          </Paper>
        </Tabs.Panel>

        {/* Sales Tab */}
        <Tabs.Panel value="sales" pt="md">
          <Stack gap="md">
            {/* Sales Summary */}
            {salesSummary && (
              <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
                <Card withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Sold</Text>
                  <Text size="xl" fw={700}>{salesSummary.totalQuantitySold} {item.unit}</Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Revenue</Text>
                  <Text size="xl" fw={700}>{formatCurrency(salesSummary.totalRevenue)}</Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Avg. Price</Text>
                  <Text size="xl" fw={700}>{formatCurrency(salesSummary.averagePrice)}</Text>
                </Card>
                <Card withBorder radius="md" p="md">
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Transactions</Text>
                  <Text size="xl" fw={700}>{salesSummary.transactionCount}</Text>
                </Card>
              </SimpleGrid>
            )}

            {/* Sales List */}
            <Paper p="md" radius="md" withBorder>
              <Table.ScrollContainer minWidth={700}>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Date</Table.Th>
                      <Table.Th>Document</Table.Th>
                      <Table.Th>Customer</Table.Th>
                      <Table.Th>Quantity</Table.Th>
                      <Table.Th>Unit Price</Table.Th>
                      <Table.Th>Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {salesLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <Table.Tr key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <Table.Td key={j}><Skeleton height={20} /></Table.Td>
                          ))}
                        </Table.Tr>
                      ))
                    ) : sales.length === 0 ? (
                      <Table.Tr>
                        <Table.Td colSpan={6}>
                          <Text c="dimmed" ta="center" py="xl">No sales records found</Text>
                        </Table.Td>
                      </Table.Tr>
                    ) : (
                      sales.map((sale) => (
                        <Table.Tr key={sale.id}>
                          <Table.Td>{sale.documentDate}</Table.Td>
                          <Table.Td>
                            <Group gap="xs">
                              <Badge variant="light" size="sm">{sale.documentType}</Badge>
                              <Text size="sm">{sale.documentNumber}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>{sale.clientName || '-'}</Table.Td>
                          <Table.Td>{sale.quantity}</Table.Td>
                          <Table.Td>
                            <NumberFormatter value={sale.unitPrice} prefix="$" thousandSeparator decimalScale={2} />
                          </Table.Td>
                          <Table.Td>
                            <Text fw={500}>
                              <NumberFormatter value={sale.lineTotal} prefix="$" thousandSeparator decimalScale={2} />
                            </Text>
                          </Table.Td>
                        </Table.Tr>
                      ))
                    )}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {salesTotalPages > 1 && (
                <Group justify="center" mt="md">
                  <Pagination total={salesTotalPages} value={salesPage} onChange={setSalesPage} size="sm" />
                </Group>
              )}
            </Paper>
          </Stack>
        </Tabs.Panel>
      </Tabs>

      {/* Stock Adjustment Modal */}
      <Modal
        opened={stockAdjustOpen}
        onClose={() => setStockAdjustOpen(false)}
        title="Adjust Stock"
        size="md"
      >
        <form onSubmit={stockAdjustForm.onSubmit(handleStockAdjust)}>
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Current quantity: <Text span fw={700}>{item.quantity} {item.unit}</Text>
            </Text>

            <Select
              label="Adjustment Type"
              data={[
                { value: 'set', label: 'Set to specific quantity' },
                { value: 'add', label: 'Add to current quantity' },
                { value: 'subtract', label: 'Subtract from current quantity' },
              ]}
              {...stockAdjustForm.getInputProps('adjustmentType')}
            />

            <NumberInput
              label="Quantity"
              min={0}
              required
              {...stockAdjustForm.getInputProps('quantity')}
            />

            <TextInput
              label="Reason"
              placeholder="e.g., Physical count, damaged goods, etc."
              {...stockAdjustForm.getInputProps('reason')}
            />

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => setStockAdjustOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={adjustSubmitting}>
                Adjust Stock
              </Button>
            </Group>
          </Stack>
        </form>
      </Modal>

      {/* Add/Edit Variant Modal */}
      <Modal
        opened={addVariantOpen}
        onClose={() => {
          setAddVariantOpen(false);
          setEditingVariant(null);
        }}
        title={editingVariant ? 'Edit Variant' : 'Add Variant'}
        size="lg"
      >
        <VariantForm
          parentSku={item.sku}
          variant={editingVariant}
          onSubmit={handleAddVariant}
          onCancel={() => {
            setAddVariantOpen(false);
            setEditingVariant(null);
          }}
          loading={variantSubmitting}
        />
      </Modal>

      {/* Add Alternate Modal */}
      <Modal
        opened={addAlternateOpen}
        onClose={() => setAddAlternateOpen(false)}
        title="Add Alternate Part"
        size="md"
      >
        <AlternateForm
          partNo={item.sku}
          onSubmit={handleAddAlternate}
          onCancel={() => setAddAlternateOpen(false)}
          loading={alternateSubmitting}
        />
      </Modal>
    </Stack>
  );
}
