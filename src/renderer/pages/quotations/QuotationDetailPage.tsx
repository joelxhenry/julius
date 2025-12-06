import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTabContext } from '../../contexts/TabContext';
import { useTabParams } from '../../hooks/useTabParams';
import {
  Stack,
  Title,
  Text,
  Paper,
  Group,
  Button,
  Badge,
  Loader,
  Center,
  Grid,
  Table,
  ActionIcon,
  Menu,
  Divider,
  Card,
  Modal,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import {
  IconArrowLeft,
  IconEdit,
  IconFileInvoice,
  IconUser,
  IconChevronLeft,
  IconChevronRight,
  IconDotsVertical,
  IconArchive,
  IconPackage,
  IconClock,
} from '@tabler/icons-react';
import { IpcChannel } from '../../../shared/types/ipc';

interface Quotation {
  id: number;
  quoteNum: string;
  quoteDate: string;
  salespersonId: number | null;
  clientId: number | null;
  clientName: string | null;
  clientAddress1: string | null;
  clientAddress2: string | null;
  clientPhone: string | null;
  reference: string | null;
  subTotal: string;
  tax: string;
  total: string;
  isTaxable: boolean;
  pricing: string;
  isArchived: boolean;
  createdAt: string;
}

interface LineItem {
  id: number;
  sku: string;
  description: string | null;
  quantity: number;
  unitPrice: string;
  discount: string;
  amount: string;
  isTaxable: boolean;
  isVariant: boolean;
}

export function QuotationDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useTabParams<{ id: string }>();
  const { updateTabTitle, replaceCurrentTab } = useTabContext();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adjacentIds, setAdjacentIds] = useState<{ previousId: number | null; nextId: number | null }>({
    previousId: null,
    nextId: null,
  });

  // Convert to invoice modal
  const [convertModalOpen, { open: openConvertModal, close: closeConvertModal }] = useDisclosure(false);
  const [isConverting, setIsConverting] = useState(false);

  // Update tab title when quotation loads (only when this tab is active)
  useEffect(() => {
    if (quotation && location.pathname === `/quotations/${id}`) {
      updateTabTitle(location.pathname, `Quotation ${quotation.quoteNum}`);
    }
  }, [quotation, id, location.pathname, updateTabTitle]);

  // Load quotation data
  useEffect(() => {
    const loadQuotation = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        // Load quotation
        const quoteResult = await window.electron.invoke(IpcChannel.GET_QUOTATION, { id: parseInt(id, 10) });
        if (!quoteResult.success || !quoteResult.data) {
          notifications.show({
            title: 'Error',
            message: 'Quotation not found',
            color: 'red',
          });
          navigate('/quotations');
          return;
        }

        setQuotation(quoteResult.data);

        // Load line items
        const itemsResult = await window.electron.invoke(IpcChannel.GET_DOCUMENT_LINE_ITEMS_BY_QUOTATION, {
          quoteNum: quoteResult.data.quoteNum,
        });
        if (itemsResult.success && itemsResult.data) {
          setLineItems(itemsResult.data);
        }

        // Load adjacent quotations (for navigation)
        // Note: Using paginated query to get surrounding quotations
        const paginatedResult = await window.electron.invoke(IpcChannel.GET_QUOTATIONS_PAGINATED, {
          page: 1,
          limit: 100,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        if (paginatedResult.success && paginatedResult.data?.data) {
          const quotes = paginatedResult.data.data;
          const currentIndex = quotes.findIndex((q: any) => q.id === parseInt(id, 10));
          setAdjacentIds({
            previousId: currentIndex > 0 ? quotes[currentIndex - 1].id : null,
            nextId: currentIndex < quotes.length - 1 ? quotes[currentIndex + 1].id : null,
          });
        }
      } catch (error) {
        console.error('Failed to load quotation:', error);
        notifications.show({
          title: 'Error',
          message: 'Failed to load quotation',
          color: 'red',
        });
      } finally {
        setIsLoading(false);
      }
    };
    loadQuotation();
  }, [id, navigate]);

  // Format currency
  const formatCurrency = (value: string | null) => {
    const num = parseFloat(value || '0');
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Navigate to previous/next quotation
  const handleNavigateAdjacent = useCallback(
    (targetId: number | null) => {
      if (targetId) {
        replaceCurrentTab(`/quotations/${targetId}`);
      }
    },
    [replaceCurrentTab]
  );

  // Convert quotation to invoice draft
  const handleConvertToInvoice = useCallback(async () => {
    if (!quotation) return;

    setIsConverting(true);
    try {
      // Create a new invoice as draft with quotation data
      const invoiceData = {
        invDate: new Date().toISOString().split('T')[0],
        salespersonId: quotation.salespersonId,
        clientId: quotation.clientId,
        clientName: quotation.clientName,
        clientAddress1: quotation.clientAddress1,
        clientAddress2: quotation.clientAddress2,
        clientPhone: quotation.clientPhone,
        reference: `Quote #${quotation.quoteNum}`,
        subTotal: quotation.subTotal,
        tax: quotation.tax,
        total: quotation.total,
        totalPaid: '0',
        status: 'draft',
        isTaxable: quotation.isTaxable,
        pricing: quotation.pricing,
      };

      // Create the invoice
      const invoiceResult = await window.electron.invoke(IpcChannel.CREATE_INVOICE, invoiceData);
      if (!invoiceResult.success) {
        throw new Error(invoiceResult.error || 'Failed to create invoice');
      }

      const newInvoice = invoiceResult.data;

      // Copy line items to the new invoice
      for (let i = 0; i < lineItems.length; i++) {
        const item = lineItems[i];
        await window.electron.invoke(IpcChannel.CREATE_DOCUMENT_LINE_ITEM, {
          documentType: 'INVOICE',
          documentNumber: newInvoice.invNumber,
          lineNumber: i + 1,
          sku: item.sku || null,
          isVariant: item.isVariant || false,
          description: item.description,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice,
          discount: item.discount,
          isTaxable: item.isTaxable,
          amount: item.amount,
        });
      }

      // Archive the quotation (mark as converted)
      await window.electron.invoke(IpcChannel.ARCHIVE_QUOTATION, { id: quotation.id });

      notifications.show({
        title: 'Success',
        message: `Invoice ${newInvoice.invNumber} created from quotation`,
        color: 'green',
      });

      closeConvertModal();

      // Navigate to the new invoice
      navigate(`/invoices/${newInvoice.id}`);
    } catch (error) {
      console.error('Failed to convert quotation:', error);
      notifications.show({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Failed to convert quotation to invoice',
        color: 'red',
      });
    } finally {
      setIsConverting(false);
    }
  }, [quotation, lineItems, navigate, closeConvertModal]);

  // Archive quotation
  const handleArchive = useCallback(async () => {
    if (!quotation) return;

    try {
      const result = await window.electron.invoke(IpcChannel.ARCHIVE_QUOTATION, { id: quotation.id });
      if (result.success) {
        notifications.show({
          title: 'Quotation Archived',
          message: `Quotation ${quotation.quoteNum} has been archived`,
          color: 'green',
        });
        navigate('/quotations');
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to archive quotation',
        color: 'red',
      });
    }
  }, [quotation, navigate]);

  // Mark as expired
  const handleExpire = useCallback(async () => {
    if (!quotation) return;

    try {
      const result = await window.electron.invoke(IpcChannel.EXPIRE_QUOTATION, { id: quotation.id });
      if (result.success) {
        notifications.show({
          title: 'Quotation Expired',
          message: `Quotation ${quotation.quoteNum} has been marked as expired`,
          color: 'orange',
        });
        // Reload to show updated status
        const updatedResult = await window.electron.invoke(IpcChannel.GET_QUOTATION, { id: quotation.id });
        if (updatedResult.success && updatedResult.data) {
          setQuotation(updatedResult.data);
        }
      }
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to expire quotation',
        color: 'red',
      });
    }
  }, [quotation]);

  // Navigate to client
  const handleViewClient = useCallback(() => {
    if (quotation?.clientId) {
      navigate(`/clients/${quotation.clientId}`);
    }
  }, [quotation, navigate]);

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (!quotation) {
    return null;
  }

  return (
    <>
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <Stack gap={4}>
              <Group gap="sm">
                <Title order={2}>Quotation {quotation.quoteNum}</Title>
                <Badge color={quotation.isArchived ? 'gray' : 'violet'} variant="light" size="lg">
                  {quotation.isArchived ? 'Archived' : 'Active'}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                Created {formatDate(quotation.createdAt)}
              </Text>
            </Stack>
          </Group>

          <Group gap="sm">
            {/* Navigation */}
            <Group gap={4}>
              <ActionIcon
                variant="subtle"
                disabled={!adjacentIds.previousId}
                onClick={() => handleNavigateAdjacent(adjacentIds.previousId)}
              >
                <IconChevronLeft size={16} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                disabled={!adjacentIds.nextId}
                onClick={() => handleNavigateAdjacent(adjacentIds.nextId)}
              >
                <IconChevronRight size={16} />
              </ActionIcon>
            </Group>

            {/* Quick Actions */}
            {!quotation.isArchived && (
              <>
                <Button
                  leftSection={<IconFileInvoice size={16} />}
                  color="green"
                  onClick={openConvertModal}
                >
                  Convert to Invoice
                </Button>
                <Button
                  variant="light"
                  leftSection={<IconEdit size={16} />}
                  onClick={() => navigate(`/quotations/${quotation.id}/edit`)}
                >
                  Edit
                </Button>
              </>
            )}

            <Menu shadow="md" width={200}>
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <IconDotsVertical size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                {quotation.clientId && (
                  <Menu.Item leftSection={<IconUser size={16} />} onClick={handleViewClient}>
                    View Client
                  </Menu.Item>
                )}
                {!quotation.isArchived && (
                  <>
                    <Menu.Item leftSection={<IconClock size={16} />} color="orange" onClick={handleExpire}>
                      Mark as Expired
                    </Menu.Item>
                    <Menu.Divider />
                    <Menu.Item leftSection={<IconArchive size={16} />} color="red" onClick={handleArchive}>
                      Archive Quotation
                    </Menu.Item>
                  </>
                )}
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>

        <Grid>
          {/* Quotation Details */}
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Paper withBorder p="md" radius="md">
              <Stack gap="md">
                <Text fw={600}>Quotation Details</Text>
                <Grid>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      Quotation Number
                    </Text>
                    <Text fw={500}>{quotation.quoteNum}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      Quotation Date
                    </Text>
                    <Text fw={500}>{formatDate(quotation.quoteDate)}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      Reference
                    </Text>
                    <Text fw={500}>{quotation.reference || '-'}</Text>
                  </Grid.Col>
                  <Grid.Col span={6}>
                    <Text size="sm" c="dimmed">
                      Pricing Type
                    </Text>
                    <Text fw={500}>{quotation.pricing === 'W' ? 'Wholesale' : 'Retail'}</Text>
                  </Grid.Col>
                </Grid>

                <Divider />

                <Text fw={600}>Client Information</Text>
                <Grid>
                  <Grid.Col span={12}>
                    <Text size="sm" c="dimmed">
                      Client Name
                    </Text>
                    <Group gap="xs">
                      <Text fw={500}>{quotation.clientName || 'Walk-in Customer'}</Text>
                      {quotation.clientId && (
                        <ActionIcon variant="subtle" size="sm" onClick={handleViewClient}>
                          <IconUser size={14} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Grid.Col>
                  {(quotation.clientAddress1 || quotation.clientAddress2) && (
                    <Grid.Col span={12}>
                      <Text size="sm" c="dimmed">
                        Address
                      </Text>
                      <Text fw={500}>
                        {[quotation.clientAddress1, quotation.clientAddress2].filter(Boolean).join(', ')}
                      </Text>
                    </Grid.Col>
                  )}
                  {quotation.clientPhone && (
                    <Grid.Col span={6}>
                      <Text size="sm" c="dimmed">
                        Phone
                      </Text>
                      <Text fw={500}>{quotation.clientPhone}</Text>
                    </Grid.Col>
                  )}
                </Grid>
              </Stack>
            </Paper>

            {/* Line Items */}
            <Paper withBorder p="md" radius="md" mt="md">
              <Stack gap="md">
                <Text fw={600}>Line Items</Text>
                <Table>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>SKU</Table.Th>
                      <Table.Th>Description</Table.Th>
                      <Table.Th ta="center">Qty</Table.Th>
                      <Table.Th ta="right">Unit Price</Table.Th>
                      <Table.Th ta="right">Discount</Table.Th>
                      <Table.Th ta="right">Amount</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {lineItems.map((item) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>
                          <Group gap="xs">
                            <Text size="sm" fw={500}>
                              {item.sku}
                            </Text>
                            <IconPackage size={12} style={{ color: 'var(--mantine-color-dimmed)' }} />
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" truncate maw={200}>
                            {item.description || '-'}
                          </Text>
                        </Table.Td>
                        <Table.Td ta="center">{item.quantity}</Table.Td>
                        <Table.Td ta="right">{formatCurrency(item.unitPrice)}</Table.Td>
                        <Table.Td ta="right">{parseFloat(item.discount || '0').toFixed(1)}%</Table.Td>
                        <Table.Td ta="right">{formatCurrency(item.amount)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Stack>
            </Paper>
          </Grid.Col>

          {/* Summary */}
          <Grid.Col span={{ base: 12, md: 4 }}>
            <Card withBorder p="md" radius="md">
              <Stack gap="md">
                <Text fw={600}>Summary</Text>
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      Subtotal
                    </Text>
                    <Text size="sm">{formatCurrency(quotation.subTotal)}</Text>
                  </Group>
                  {quotation.isTaxable && (
                    <Group justify="space-between">
                      <Text size="sm" c="dimmed">
                        Tax
                      </Text>
                      <Text size="sm">{formatCurrency(quotation.tax)}</Text>
                    </Group>
                  )}
                  <Divider />
                  <Group justify="space-between">
                    <Text fw={600}>Total</Text>
                    <Text fw={600} size="lg">
                      {formatCurrency(quotation.total)}
                    </Text>
                  </Group>
                </Stack>
              </Stack>
            </Card>

            {/* Quick Actions Card */}
            {!quotation.isArchived && (
              <Card withBorder p="md" radius="md" mt="md">
                <Stack gap="sm">
                  <Text fw={600}>Quick Actions</Text>
                  <Button
                    fullWidth
                    color="green"
                    leftSection={<IconFileInvoice size={16} />}
                    onClick={openConvertModal}
                  >
                    Convert to Invoice
                  </Button>
                  <Button
                    fullWidth
                    variant="light"
                    leftSection={<IconEdit size={16} />}
                    onClick={() => navigate(`/quotations/${quotation.id}/edit`)}
                  >
                    Edit Quotation
                  </Button>
                  {quotation.clientId && (
                    <Button fullWidth variant="subtle" leftSection={<IconUser size={16} />} onClick={handleViewClient}>
                      View Client
                    </Button>
                  )}
                </Stack>
              </Card>
            )}
          </Grid.Col>
        </Grid>
      </Stack>

      {/* Convert to Invoice Modal */}
      <Modal
        opened={convertModalOpen}
        onClose={closeConvertModal}
        title="Convert to Invoice"
        centered
      >
        <Stack gap="md">
          <Text>
            This will create a new <strong>draft invoice</strong> from this quotation with:
          </Text>
          <Stack gap="xs">
            <Text size="sm">• Client: {quotation.clientName || 'Walk-in Customer'}</Text>
            <Text size="sm">• {lineItems.length} line items</Text>
            <Text size="sm">• Total: {formatCurrency(quotation.total)}</Text>
          </Stack>
          <Text size="sm" c="dimmed">
            The quotation will be archived after conversion. You can edit the invoice before issuing it.
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeConvertModal}>
              Cancel
            </Button>
            <Button
              color="green"
              leftSection={<IconFileInvoice size={16} />}
              onClick={handleConvertToInvoice}
              loading={isConverting}
            >
              Create Invoice Draft
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
