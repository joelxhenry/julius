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
  IconPackageImport,
  IconCurrencyDollar,
} from '@tabler/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabParams } from '../../hooks/useTabParams';
import { IpcChannel } from '../../../shared/types/ipc';
import { useTabContext } from '../../contexts/TabContext';
import { VariantForm } from '../../components/forms/VariantForm';
import { AlternateForm } from '../../components/forms/AlternateForm';
import { OverviewTab, PricingTab, VariantsTab, AlternatesTab, TransactionsTab, SalesTab, ReceivingTab, InventoryEditModal, InventoryLookupTicketButton } from '../../components/inventory';
import { ProductThumbnail } from '../../components/common/ProductThumbnail';
import { PermissionGate, PermissionButton, RestrictedValue, usePermissions } from '../../permissions';
import { ProductImageModal } from '../../components/common/ProductImageModal';
import { CopyButton } from '../../components/common';
import { MarkButton } from '../../components/tray/MarkButton';

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
  location: string | null;
  attributes: Record<string, any>;
  description: string | null;
  quantity: number;
  cost: string | null;
  costCurrency: string;
  price: string | null;
  priceCurrency: string;
  wholesalePrice: string | null;
  isActive: boolean;
  isBase: boolean;
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
  variantSku: string | null;
  activity: string;
  reference: string | null;
  quantity: number;
  activityDate: string;
  createdAt: Date;
}

interface SaleRecord {
  id: number;
  invoiceId?: number;
  documentNumber: string;
  documentType: string;
  sku?: string;
  isVariant?: boolean;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  documentDate: string;
  clientName?: string;
}

interface SalesSummary {
  totalUnitsSold: number;
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
  const { updateTabTitle, replaceCurrentTab, openTab } = useTabContext();
  const { runWithPermission } = usePermissions();

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
  const [transactionsActivity, setTransactionsActivity] = useState<string | null>('all');
  const [transactionsVariant, setTransactionsVariant] = useState<string | null>('all');
  const [transactionsDateRange, setTransactionsDateRange] = useState<[string | null, string | null]>([null, null]);

  // Sales state
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [salesPage, setSalesPage] = useState(1);
  const [salesTotalPages, setSalesTotalPages] = useState(1);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [salesVariant, setSalesVariant] = useState<string | null>('all');
  const [salesDateRange, setSalesDateRange] = useState<[string | null, string | null]>([null, null]);

  // Stock adjustment modal
  const [stockAdjustOpen, setStockAdjustOpen] = useState(false);
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Image modal for header thumbnail (upload/replace/remove)
  const [headerImageOpen, setHeaderImageOpen] = useState(false);

  const itemId = id ? parseInt(id, 10) : null;

  const stockAdjustForm = useForm({
    initialValues: {
      variantSku: '',
      adjustmentType: 'set',
      quantity: 0,
      reason: '',
    },
  });

  // The variant currently targeted by the stock-adjustment form (null = base item)
  const selectedAdjustVariant = variants.find((v) => v.variantSku === stockAdjustForm.values.variantSku) ?? null;
  const adjustCurrentQuantity = selectedAdjustVariant ? selectedAdjustVariant.quantity : item?.quantity ?? 0;

  useEffect(() => {
    if (itemId) {
      loadInventoryItem(itemId);
    }
  }, [itemId]);

  // Load variants once the item is available. They're needed by the stock
  // adjustment form and the Activity/Sales variant filters, not just the
  // Variants and Gallery tabs.
  useEffect(() => {
    if (item?.id) {
      loadVariants(item.id);
    }
  }, [item?.id]);

  useEffect(() => {
    if (item?.sku && activeTab === 'alternates') {
      loadAlternates(item.sku);
    }
  }, [item?.sku, activeTab]);

  useEffect(() => {
    if (item?.sku && activeTab === 'transactions') {
      loadTransactions(item.sku, transactionsPage);
    }
  }, [item?.sku, activeTab, transactionsPage, transactionsActivity, transactionsVariant, transactionsDateRange]);

  // Reset to first page when transaction filters change
  useEffect(() => {
    setTransactionsPage(1);
  }, [transactionsActivity, transactionsVariant, transactionsDateRange]);

  useEffect(() => {
    if (item?.sku && activeTab === 'sales') {
      loadSales(item.sku, salesPage);
      loadSalesSummary(item.sku);
    }
  }, [item?.sku, activeTab, salesPage, salesVariant, salesDateRange]);

  // Reset to first page when sales filters change
  useEffect(() => {
    setSalesPage(1);
  }, [salesVariant, salesDateRange]);

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
      const [startDate, endDate] = transactionsDateRange;
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_TRANSACTIONS_BY_SKU, {
        sku,
        page,
        pageSize: 10,
        activity: transactionsActivity && transactionsActivity !== 'all' ? transactionsActivity : undefined,
        variantSku: transactionsVariant && transactionsVariant !== 'all' ? transactionsVariant : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
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
      const [startDate, endDate] = salesDateRange;
      const result = await window.electron.invoke(IpcChannel.GET_VARIANT_SALES, {
        sku,
        page,
        pageSize: 10,
        variantSku: salesVariant && salesVariant !== 'all' ? salesVariant : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (result.success && result.data) {
        const mapped: SaleRecord[] = result.data.data.map((row: any) => ({
          id: row.id,
          invoiceId: row.invoice?.id,
          documentNumber: row.documentNumber,
          documentType: row.documentType,
          sku: row.sku ?? undefined,
          isVariant: row.isVariant ?? false,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          lineTotal: row.amount,
          documentDate: row.invoice?.invDate ?? '',
          clientName: row.invoice?.clientName ?? undefined,
        }));
        setSales(mapped);
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
      const [startDate, endDate] = salesDateRange;
      const result = await window.electron.invoke(IpcChannel.GET_INVENTORY_SALES_SUMMARY, {
        sku,
        variantSku: salesVariant && salesVariant !== 'all' ? salesVariant : undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      if (result.success && result.data) {
        setSalesSummary(result.data);
      }
    } catch (err) {
      console.error('Failed to load sales summary:', err);
    }
  };

  // Open the related invoice document in a new tab
  const handleOpenSaleDocument = (sale: SaleRecord) => {
    if (sale.invoiceId) {
      openTab(`/invoices/${sale.invoiceId}`);
    } else {
      notifications.show({
        title: 'Document Unavailable',
        message: `Could not locate invoice ${sale.documentNumber}`,
        color: 'orange',
      });
    }
  };

  const handleStockAdjust = async (values: typeof stockAdjustForm.values) => {
    if (!item) return;
    setAdjustSubmitting(true);

    // Resolve the target: the base item or a specific variant.
    const targetVariant = values.variantSku
      ? variants.find((v) => v.variantSku === values.variantSku) ?? null
      : null;
    const currentQuantity = targetVariant ? targetVariant.quantity : item.quantity;

    try {
      let newQuantity: number;
      if (values.adjustmentType === 'set') {
        newQuantity = values.quantity;
      } else if (values.adjustmentType === 'add') {
        newQuantity = currentQuantity + values.quantity;
      } else {
        newQuantity = currentQuantity - values.quantity;
      }

      const result = targetVariant
        ? await window.electron.invoke(IpcChannel.SET_VARIANT_STOCK, {
            id: targetVariant.id,
            stockQty: newQuantity,
          })
        : await window.electron.invoke(IpcChannel.UPDATE_INVENTORY_STOCK, {
            id: item.id,
            quantity: newQuantity,
          });

      if (result.success) {
        const delta =
          values.adjustmentType === 'set'
            ? newQuantity - currentQuantity
            : values.adjustmentType === 'add'
            ? values.quantity
            : -values.quantity;

        // Create transaction record. For variants, sku stays the parent SKU and
        // variantSku carries the variant (matching the schema convention).
        await window.electron.invoke(IpcChannel.CREATE_INVENTORY_TRANSACTION, {
          sku: item.sku,
          variantSku: targetVariant ? targetVariant.variantSku : null,
          activity: 'ADJ',
          reference: values.reason || 'Manual adjustment',
          quantity: delta,
          activityDate: new Date().toISOString().split('T')[0],
        });

        notifications.show({
          title: 'Stock Adjusted',
          message: targetVariant
            ? `${targetVariant.variantSku} quantity updated to ${newQuantity}`
            : `Quantity updated to ${newQuantity} ${item.unit}`,
          color: 'green',
          icon: <IconCheck size={16} />,
        });

        if (targetVariant) {
          // Reflect the new variant quantity locally.
          setVariants((prev) =>
            prev.map((v) => (v.id === targetVariant.id ? { ...v, quantity: newQuantity } : v))
          );
        } else {
          setItem({ ...item, quantity: newQuantity });
        }
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
    location: string;
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
        location: values.location || null,
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

  // Handler for opening a transaction's referenced document in a new tab.
  // Reference activity labels are legacy/free-form, so resolve by looking the
  // reference number up as an invoice first, then as a credit note.
  const handleOpenReference = async (reference: string) => {
    const ref = reference?.trim();
    if (!ref) return;

    try {
      const invoiceResult = await window.electron.invoke(IpcChannel.GET_INVOICE_BY_NUMBER, { invNumber: ref });
      if (invoiceResult.success && invoiceResult.data) {
        openTab(`/invoices/${invoiceResult.data.id}`);
        return;
      }

      const creditNoteResult = await window.electron.invoke(IpcChannel.GET_CREDIT_NOTE_BY_NUMBER, { crNumber: ref });
      if (creditNoteResult.success && creditNoteResult.data) {
        openTab(`/credit-notes/${creditNoteResult.data.id}`);
        return;
      }

      notifications.show({
        title: 'Reference Not Found',
        message: `No invoice or credit note found for reference: ${ref}`,
        color: 'orange',
      });
    } catch (err) {
      console.error('Failed to open reference:', err);
      notifications.show({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Failed to open reference',
        color: 'red',
      });
    }
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
          message: `Could not find inventory item with part number: ${alternateSku}`,
          color: 'orange',
        });
      }
    } catch (err) {
      console.error('Failed to navigate to alternate:', err);
    }
  };

  // Category/model may be persisted as JSON array strings (e.g. '["HONDA ACURA"]').
  // Parse those back into a readable, comma-separated string; fall back to the raw
  // value if it isn't JSON.
  const formatListValue = (value: string | null): string => {
    if (!value) return '';
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean).join(', ');
    } catch {
      // Not JSON - use as-is.
    }
    return value;
  };

  // Options for the Activity/Sales variant filters: all, base item, then each variant.
  const variantFilterOptions = [
    { value: 'all', label: 'All variants' },
    { value: '__base__', label: 'Base item only' },
    ...variants.map((v) => ({
      value: v.variantSku,
      label: v.variantName ? `${v.variantSku} - ${v.variantName}` : v.variantSku,
    })),
  ];

  // Options for the stock-adjustment target - every product has at least one
  // variant, so there's no separate "base item" to adjust; only variants show.
  const adjustVariantOptions = variants.map((v) => ({
    value: v.variantSku,
    label: v.variantName ? `${v.variantSku} - ${v.variantName}` : v.variantSku,
  }));

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

  // Pricing is owned by the base variant, so display it (not the dormant
  // product-level columns) on the summary cards and Pricing tab. Falls back to
  // the product row while variants are still loading.
  const baseVariant = variants.find((v) => v.isBase);
  const displayCost = baseVariant?.cost ?? item.cost;
  const displayPrice = baseVariant?.price ?? item.price;
  const displayWholesale = baseVariant ? baseVariant.wholesalePrice : item.wholesalePrice;
  const displayCostCurrency = baseVariant?.costCurrency ?? item.costCurrency;
  const displayPriceCurrency = baseVariant?.priceCurrency ?? item.priceCurrency;
  const displayMargin = (() => {
    const c = parseFloat(displayCost || '0');
    const p = parseFloat(displayPrice || '0');
    if (!Number.isFinite(c) || c <= 0) return null;
    return (((p - c) / c) * 100).toFixed(1);
  })();
  const pricingItem = {
    ...item,
    cost: displayCost,
    price: displayPrice,
    wholesalePrice: displayWholesale,
    costCurrency: displayCostCurrency,
    priceCurrency: displayPriceCurrency,
    margin: displayMargin,
  };

  // Stock, cost and price live on the variants, not the parent row - so the
  // summary cards aggregate across them. Quantity sums, while cost/price/
  // wholesale/margin collapse to a single value when uniform or a min–max range
  // when they vary. Prefer active variants; fall back to all (then the product
  // row) so the cards still read while variants are loading or all inactive.
  const activeVariants = variants.filter((v) => v.isActive);
  const summaryVariants = activeVariants.length > 0 ? activeVariants : variants;

  const totalQuantity =
    summaryVariants.length > 0
      ? summaryVariants.reduce((sum, v) => sum + (v.quantity ?? 0), 0)
      : item.quantity;

  // Collapse a numeric field across the summary variants into a {min, max} span.
  // Returns null when no variant carries a usable value.
  const numericRange = (pick: (v: Variant) => string | null): { min: number; max: number } | null => {
    const nums = summaryVariants
      .map(pick)
      .map((val) => (val == null ? NaN : parseFloat(val)))
      .filter((n) => Number.isFinite(n));
    if (nums.length === 0) return null;
    return { min: Math.min(...nums), max: Math.max(...nums) };
  };

  const costRange = summaryVariants.length > 0 ? numericRange((v) => v.cost) : null;
  const priceRange = summaryVariants.length > 0 ? numericRange((v) => v.price) : null;
  const wholesaleRange = summaryVariants.length > 0 ? numericRange((v) => v.wholesalePrice) : null;

  // Margin derives from each variant's own cost/price pair, then we take the span.
  const marginValues = summaryVariants
    .map((v) => {
      const c = parseFloat(v.cost ?? '');
      const p = parseFloat(v.price ?? '');
      if (!Number.isFinite(c) || c <= 0 || !Number.isFinite(p)) return null;
      return ((p - c) / c) * 100;
    })
    .filter((m): m is number => m != null);
  const marginRange =
    marginValues.length > 0
      ? { min: Math.min(...marginValues), max: Math.max(...marginValues) }
      : null;

  // Render a currency range: a single formatted value when uniform, else min–max.
  // Falls back to the base-variant/product value when variants carry no figure.
  const renderCurrencyRange = (
    range: { min: number; max: number } | null,
    fallback?: string | null
  ) => {
    if (!range) {
      return fallback != null && fallback !== '' ? (
        <NumberFormatter value={fallback} prefix="$" thousandSeparator decimalScale={2} />
      ) : (
        '-'
      );
    }
    const fmt = (n: number) => (
      <NumberFormatter value={n} prefix="$" thousandSeparator decimalScale={2} />
    );
    return range.min === range.max ? (
      fmt(range.min)
    ) : (
      <>
        {fmt(range.min)} – {fmt(range.max)}
      </>
    );
  };

  const marginLabel = marginRange
    ? marginRange.min === marginRange.max
      ? `${marginRange.min.toFixed(1)}%`
      : `${marginRange.min.toFixed(1)}% – ${marginRange.max.toFixed(1)}%`
    : displayMargin
    ? `${displayMargin}%`
    : '-';

  const isLowStock = totalQuantity <= item.minLevel;

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
            onClick={() => setHeaderImageOpen(true)}
            showTooltip
          />
          <Stack gap={4}>
            <Group gap="sm">
              <Title order={2}>{item.sku}</Title>
              <CopyButton value={item.sku} size="sm" />
              <MarkButton mode="item" parentSku={item.sku} />
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
            {item.category && (
              <Text c="dimmed" size="sm">
                {formatListValue(item.category)}
              </Text>
            )}
            {item.model && (
              <Text c="dimmed" size="sm">
                {formatListValue(item.model)}
              </Text>
            )}
          </Stack>
        </Group>
        <Group>
          <InventoryLookupTicketButton
            inventoryId={item.id}
            parentSku={item.sku}
          />
          <PermissionButton
            permission="ADJUST_STOCK"
            whenDenied="elevate"
            actionLabel={`Adjust stock for ${item.sku}`}
            context={{ entity: 'inventory', id: item.id }}
            variant="outline"
            leftSection={<IconAdjustments size={16} />}
            onClick={() => {
              // Default the target to the base variant (falling back to the first
              // variant) so a real variant is always selected - there is no base item.
              const defaultVariant = variants.find((v) => v.isBase) ?? variants[0];
              stockAdjustForm.setValues({
                variantSku: defaultVariant?.variantSku ?? '',
                adjustmentType: 'set',
                quantity: 0,
                reason: '',
              });
              setStockAdjustOpen(true);
            }}
          >
            Adjust Stock
          </PermissionButton>
          <PermissionButton
            permission="EDIT_INVENTORY"
            whenDenied="elevate"
            actionLabel={`Edit item ${item.sku}`}
            context={{ entity: 'inventory', id: item.id }}
            leftSection={<IconEdit size={16} />}
            onClick={() => setEditModalOpen(true)}
          >
            Edit
          </PermissionButton>
        </Group>
      </Group>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="md">
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Quantity</Text>
          <Text size="xl" fw={700} c={isLowStock ? 'orange' : undefined}>
            {totalQuantity} {item.unit}
          </Text>
          <Text size="xs" c="dimmed">Min: {item.minLevel}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Cost</Text>
          <Text size="xl" fw={700}>
            <RestrictedValue permission="VIEW_COST">
              {renderCurrencyRange(costRange, displayCost)}
            </RestrictedValue>
          </Text>
          <Text size="xs" c="dimmed">{displayCostCurrency}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Price</Text>
          <Text size="xl" fw={700}>
            {renderCurrencyRange(priceRange, displayPrice)}
          </Text>
          <Text size="xs" c="dimmed">{displayPriceCurrency}</Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Wholesale</Text>
          <Text size="xl" fw={700}>
            {renderCurrencyRange(wholesaleRange, displayWholesale)}
          </Text>
        </Card>
        <Card withBorder radius="md" p="md">
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Margin</Text>
          <Text size="xl" fw={700}>
            <RestrictedValue permission="VIEW_COST">
              {marginLabel}
            </RestrictedValue>
          </Text>
        </Card>
      </SimpleGrid>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="overview" leftSection={<IconPackage size={16} />}>
            Overview
          </Tabs.Tab>
          <Tabs.Tab value="pricing" leftSection={<IconCurrencyDollar size={16} />}>
            Pricing
          </Tabs.Tab>
          <Tabs.Tab value="variants" leftSection={<IconVersions size={16} />}>
            Variants
          </Tabs.Tab>
          <Tabs.Tab value="alternates" leftSection={<IconExchange size={16} />}>
            Alternates
          </Tabs.Tab>
          <Tabs.Tab value="transactions" leftSection={<IconHistory size={16} />}>
            Activity
          </Tabs.Tab>
          <PermissionGate permission="VIEW_INVENTORY_SALES" mode="hide">
            <Tabs.Tab value="sales" leftSection={<IconChartLine size={16} />}>
              Sales
            </Tabs.Tab>
          </PermissionGate>
          <PermissionGate permission="RECEIVE_GOODS" mode="hide">
            <Tabs.Tab value="receiving" leftSection={<IconPackageImport size={16} />}>
              Receiving
            </Tabs.Tab>
          </PermissionGate>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="md">
          <OverviewTab item={item} />
        </Tabs.Panel>

        {/* Pricing Tab */}
        <Tabs.Panel value="pricing" pt="md">
          <PricingTab item={pricingItem} formatCurrency={formatCurrency} />
        </Tabs.Panel>

        {/* Variants Tab */}
        <Tabs.Panel value="variants" pt="md">
          <VariantsTab
            variants={variants}
            loading={variantsLoading}
            parentIsTaxable={item.isTaxable}
            onAddVariant={() =>
              runWithPermission(
                { permissionCode: 'MANAGE_VARIANTS', actionLabel: `Add variant to ${item.sku}`, context: { entity: 'inventory', id: item.id } },
                () => {
                  setEditingVariant(null);
                  setAddVariantOpen(true);
                }
              )
            }
            onEditVariant={(variant) =>
              runWithPermission(
                { permissionCode: 'MANAGE_VARIANTS', actionLabel: `Edit variant on ${item.sku}`, context: { entity: 'inventory', id: item.id } },
                () => {
                  setEditingVariant(variant);
                  setAddVariantOpen(true);
                }
              )
            }
            onDeleteVariant={(variantId) =>
              runWithPermission(
                { permissionCode: 'MANAGE_VARIANTS', actionLabel: 'Delete variant', context: { entity: 'variant', id: variantId } },
                () => handleDeleteVariant(variantId)
              )
            }
          />
        </Tabs.Panel>

        {/* Alternates Tab */}
        <Tabs.Panel value="alternates" pt="md">
          <AlternatesTab
            alternates={alternates}
            loading={alternatesLoading}
            currentSku={item.sku}
            onAddAlternate={() =>
              runWithPermission(
                { permissionCode: 'MANAGE_ALTERNATES', actionLabel: `Add alternate to ${item.sku}`, context: { entity: 'inventory', id: item.id } },
                () => setAddAlternateOpen(true)
              )
            }
            onDeleteAlternate={(alternateNo) =>
              runWithPermission(
                { permissionCode: 'MANAGE_ALTERNATES', actionLabel: 'Remove alternate', context: { entity: 'inventory', id: item.id } },
                () => handleDeleteAlternate(alternateNo)
              )
            }
            onNavigateToAlternate={handleNavigateToAlternate}
          />
        </Tabs.Panel>

        {/* Activity Tab */}
        <Tabs.Panel value="transactions" pt="md">
          <TransactionsTab
            transactions={transactions}
            loading={transactionsLoading}
            page={transactionsPage}
            totalPages={transactionsTotalPages}
            onPageChange={setTransactionsPage}
            activity={transactionsActivity}
            onActivityChange={setTransactionsActivity}
            variant={transactionsVariant}
            onVariantChange={setTransactionsVariant}
            variantOptions={variantFilterOptions}
            dateRange={transactionsDateRange}
            onDateRangeChange={setTransactionsDateRange}
            onOpenReference={handleOpenReference}
          />
        </Tabs.Panel>

        {/* Sales Tab */}
        <PermissionGate permission="VIEW_INVENTORY_SALES" mode="hide">
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
              variant={salesVariant}
              onVariantChange={setSalesVariant}
              variantOptions={variantFilterOptions}
              dateRange={salesDateRange}
              onDateRangeChange={setSalesDateRange}
              onOpenDocument={handleOpenSaleDocument}
            />
          </Tabs.Panel>
        </PermissionGate>

        {/* Receiving Tab */}
        <PermissionGate permission="RECEIVE_GOODS" mode="hide">
          <Tabs.Panel value="receiving" pt="md">
            <ReceivingTab sku={item.sku} />
          </Tabs.Panel>
        </PermissionGate>
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
            {variants.length > 0 && (
              <Select
                label="Variant"
                description="Select the variant to adjust"
                data={adjustVariantOptions}
                {...stockAdjustForm.getInputProps('variantSku')}
              />
            )}

            <Text size="sm" c="dimmed">
              Current quantity:{' '}
              <Text span fw={700}>
                {adjustCurrentQuantity} {item.unit}
              </Text>
              {selectedAdjustVariant && (
                <Text span c="dimmed">
                  {' '}
                  ({selectedAdjustVariant.variantSku})
                </Text>
              )}
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

      {/* Header Image Modal (upload / replace / remove) */}
      <ProductImageModal
        opened={headerImageOpen}
        onClose={() => setHeaderImageOpen(false)}
        sku={item.sku}
        isVariant={false}
        title={`${item.sku} - Image`}
      />
    </Stack>
  );
}
