import { useParams, useNavigate } from 'react-router-dom';
import {
  Title,
  Paper,
  Group,
  Button,
  Stack,
  Tabs,
  Text,
  LoadingOverlay,
  Badge,
  SimpleGrid,
  ActionIcon,
  Modal,
} from '@mantine/core';
import {
  IconArrowLeft,
  IconEdit,
  IconPackage,
  IconHistory,
  IconPlus,
  IconAdjustments,
} from '@tabler/icons-react';
import { useEffect, useState } from 'react';
import { useParts, usePartVariants } from '../../hooks';
import { DataTable, ColumnDef } from '../../components/common/DataTable/DataTable';
import { PartVariantForm } from '../../components/forms/PartVariantForm';
import type { Part, PartVariant } from '../../../main/database/schema';
import type { PartVariantFormData } from '../../utils/schemas';
import { notifications } from '@mantine/notifications';
import numeral from 'numeral';

export function PartDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getById } = useParts();
  const { variants: allVariants, create: createVariant, update: updateVariant } = usePartVariants();

  const [part, setPart] = useState<Part | null>(null);
  const [variants, setVariants] = useState<PartVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [variantModalOpened, setVariantModalOpened] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<PartVariant | null>(null);
  const [savingVariant, setSavingVariant] = useState(false);

  useEffect(() => {
    const loadPart = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const data = await getById(parseInt(id));
        setPart(data);

        // Filter variants for this part
        const partVariants = allVariants.filter((v) => v.partId === parseInt(id));
        setVariants(partVariants);
      } catch (error) {
        console.error('Failed to load part:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPart();
  }, [id, getById, allVariants]);

  if (loading) {
    return <LoadingOverlay visible />;
  }

  if (!part) {
    return (
      <Paper p="xl">
        <Text>Part not found</Text>
        <Button onClick={() => navigate('/inventory/parts')} mt="md">
          Back to Parts
        </Button>
      </Paper>
    );
  }

  const variantColumns: ColumnDef<PartVariant>[] = [
    {
      key: 'sku',
      title: 'SKU',
      sortable: true,
      width: 120,
    },
    {
      key: 'variantName',
      title: 'Variant',
      sortable: true,
    },
    {
      key: 'price',
      title: 'Price',
      sortable: true,
      render: (value) => numeral(parseFloat(value) || 0).format('$0,0.00'),
    },
    {
      key: 'stockQty',
      title: 'Stock',
      sortable: true,
      render: (value, row) => {
        const stock = Number(value) || 0;
        const reorderLevel = Number(row.reorderLevel) || 0;
        const isLow = stock <= reorderLevel;

        return (
          <Badge color={isLow ? 'red' : stock === 0 ? 'gray' : 'green'} size="sm">
            {stock}
          </Badge>
        );
      },
    },
    {
      key: 'reorderLevel',
      title: 'Reorder Level',
      sortable: true,
    },
    {
      key: 'location',
      title: 'Location',
      render: (value) => value || '-',
    },
    {
      key: 'active',
      title: 'Status',
      render: (value) => (
        <Badge color={value ? 'green' : 'gray'} size="sm">
          {value ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  return (
    <Stack>
      <Group justify="space-between">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => navigate('/inventory/parts')}
          >
            Back
          </Button>
          <Title order={2}>{part.name}</Title>
          {part.taxable && (
            <Badge color="blue" size="lg">
              Taxable
            </Badge>
          )}
        </Group>
        <Button leftSection={<IconEdit size={16} />} variant="light">
          Edit Part
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, md: 3 }}>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            SKU
          </Text>
          <Text fw={500}>{part.sku}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Category
          </Text>
          <Text fw={500}>{part.category || 'N/A'}</Text>
        </Paper>
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Base Price
          </Text>
          <Text fw={500}>{numeral(parseFloat(part.price) || 0).format('$0,0.00')}</Text>
        </Paper>
      </SimpleGrid>

      {part.description && (
        <Paper withBorder p="md">
          <Text size="sm" c="dimmed" mb="xs">
            Description
          </Text>
          <Text>{part.description}</Text>
        </Paper>
      )}

      <Tabs defaultValue="variants">
        <Tabs.List>
          <Tabs.Tab value="variants" leftSection={<IconPackage size={16} />}>
            Variants ({variants.length})
          </Tabs.Tab>
          <Tabs.Tab value="history" leftSection={<IconHistory size={16} />}>
            History
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="variants" pt="md">
          <Group justify="space-between" mb="md">
            <Text fw={500}>Part Variants</Text>
            <Button
              leftSection={<IconPlus size={16} />}
              size="sm"
              onClick={() => {
                setSelectedVariant(null);
                setVariantModalOpened(true);
              }}
            >
              Add Variant
            </Button>
          </Group>

          {variants.length === 0 ? (
            <Paper withBorder p="xl">
              <Stack align="center" gap="md">
                <IconPackage size={48} stroke={1.5} color="gray" />
                <Text c="dimmed">No variants for this part</Text>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => setVariantModalOpened(true)}
                >
                  Add First Variant
                </Button>
              </Stack>
            </Paper>
          ) : (
            <DataTable
              data={variants}
              columns={variantColumns}
              onRowClick={(variant) => {
                setSelectedVariant(variant);
                setVariantModalOpened(true);
              }}
              keyboardNav
            />
          )}
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="md">
          <Paper withBorder p="md">
            <Text c="dimmed">Stock adjustment history will be displayed here</Text>
          </Paper>
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={variantModalOpened}
        onClose={() => {
          setVariantModalOpened(false);
          setSelectedVariant(null);
        }}
        title={selectedVariant ? 'Edit Variant' : 'Add Variant'}
        size="lg"
      >
        <PartVariantForm
          partId={parseInt(id!)}
          variant={selectedVariant}
          onSubmit={async (data) => {
            setSavingVariant(true);
            try {
              if (selectedVariant) {
                await updateVariant(selectedVariant.id, data);
              } else {
                await createVariant(data);
              }
              setVariantModalOpened(false);
              setSelectedVariant(null);

              // Reload variants
              const updated = allVariants.filter((v) => v.partId === parseInt(id!));
              setVariants(updated);
            } finally {
              setSavingVariant(false);
            }
          }}
          onCancel={() => {
            setVariantModalOpened(false);
            setSelectedVariant(null);
          }}
          loading={savingVariant}
        />
      </Modal>
    </Stack>
  );
}
