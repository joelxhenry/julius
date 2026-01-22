import { useState, useEffect } from 'react';
import {
  Stack,
  Title,
  Group,
  Text,
  Badge,
  Button,
  Tabs,
  Loader,
  Alert,
  Card,
  SimpleGrid,
  NumberFormatter,
  Modal,
  TextInput,
  NumberInput,
  Select,
  ActionIcon,
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
  IconCheck,
  IconPhoto,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { IpcChannel } from '../../../shared/types/ipc';
import { useTabContext } from '../../contexts/TabContext';
import { VariantForm } from '../../components/forms/VariantForm';
import { AlternateForm } from '../../components/forms/AlternateForm';
import { OverviewTab, VariantsTab, AlternatesTab, TransactionsTab, SalesTab, GalleryTab, InventoryEditModal } from '../../components/inventory';
import { ProductThumbnail } from '../../components/common/ProductThumbnail';
import { ImageGalleryModal } from '../../components/common/ImageGalleryModal';

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

export function InventoryDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useTabParams<{ id: string }>();
  const { updateTabTitle, replaceCurrentTab } = useTabContext();

  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Inventory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  // Update tab title when item loads (only when this tab is active)
  useEffect(() => {
    if (item && location.pathname === `/inventory/${id}`) {
      updateTabTitle(location.pathname, `${item.sku} - ${item.description1 || 'Inventory Item'}`);
    }
  }, [item, id, location.pathname, updateTabTitle]);

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

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Gallery modal for header image
  const [headerGalleryOpen, setHeaderGalleryOpen] = useState(false);

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
    if (item?.id && (activeTab === 'variants' || activeTab === 'gallery')) {
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

  // Handler for navigating to alternate SKU
  const handleNavigateToAlternate = async (alternateSku: string) => {
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
        <Group gap="md">
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => replaceCurrentTab('/inventory')}
            title="Back to Inventory"
          >
            <IconArrowLeft size={20} />
          </ActionIcon>
          <ProductThumbnail
            sku={item.sku}
            isVariant={false}
            size={100}
            onClick={() => setHeaderGalleryOpen(true)}
            showTooltip
          />
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
            onClick={() => setEditModalOpen(true)}
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
          <Tabs.Tab value="gallery" leftSection={<IconPhoto size={16} />}>
            Gallery
          </Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="md">
          <OverviewTab item={item} formatCurrency={formatCurrency} />
        </Tabs.Panel>

        {/* Variants Tab */}
        <Tabs.Panel value="variants" pt="md">
          <VariantsTab
            variants={variants}
            loading={variantsLoading}
            onAddVariant={() => {
              setEditingVariant(null);
              setAddVariantOpen(true);
            }}
            onEditVariant={(variant) => {
              setEditingVariant(variant);
              setAddVariantOpen(true);
            }}
            onDeleteVariant={handleDeleteVariant}
          />
        </Tabs.Panel>

        {/* Alternates Tab */}
        <Tabs.Panel value="alternates" pt="md">
          <AlternatesTab
            alternates={alternates}
            loading={alternatesLoading}
            currentSku={item.sku}
            onAddAlternate={() => setAddAlternateOpen(true)}
            onDeleteAlternate={handleDeleteAlternate}
            onNavigateToAlternate={handleNavigateToAlternate}
          />
        </Tabs.Panel>

        {/* Transactions Tab */}
        <Tabs.Panel value="transactions" pt="md">
          <TransactionsTab
            transactions={transactions}
            loading={transactionsLoading}
            page={transactionsPage}
            totalPages={transactionsTotalPages}
            onPageChange={setTransactionsPage}
          />
        </Tabs.Panel>

        {/* Sales Tab */}
        <Tabs.Panel value="sales" pt="md">
          <SalesTab
            sales={sales}
            salesSummary={salesSummary}
            loading={salesLoading}
            page={salesPage}
            totalPages={salesTotalPages}
            unit={item.unit}
            onPageChange={setSalesPage}
            formatCurrency={formatCurrency}
          />
        </Tabs.Panel>

        {/* Gallery Tab */}
        <Tabs.Panel value="gallery" pt="md">
          <GalleryTab
            item={item}
            variants={variants}
          />
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

      {/* Edit Inventory Modal */}
      <InventoryEditModal
        opened={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        item={item}
        onSave={() => {
          if (itemId) {
            loadInventoryItem(itemId);
          }
        }}
      />

      {/* Header Image Gallery Modal */}
      <ImageGalleryModal
        opened={headerGalleryOpen}
        onClose={() => setHeaderGalleryOpen(false)}
        sku={item.sku}
        isVariant={false}
        title={`${item.sku} - Images`}
      />
    </Stack>
  );
}
