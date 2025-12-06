import { Paper, Stack, Title, SimpleGrid, Text, Badge } from '@mantine/core';

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

interface OverviewTabProps {
  item: Inventory;
  formatCurrency: (amount: number | string, currency?: string) => string;
}

export function OverviewTab({ item, formatCurrency }: OverviewTabProps) {
  return (
    <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
      <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Product Details</Title>
          <SimpleGrid cols={2}>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                SKU
              </Text>
              <Text fw={500}>{item.sku}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Category
              </Text>
              <Text fw={500}>{item.category || '-'}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Model
              </Text>
              <Text fw={500}>{item.model || '-'}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Unit
              </Text>
              <Text fw={500}>{item.unit}</Text>
            </Stack>
          </SimpleGrid>
          {item.description2 && (
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Additional Description
              </Text>
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
              <Text size="xs" c="dimmed">
                Cost
              </Text>
              <Text fw={500}>{formatCurrency(item.cost, item.costCurrency)}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Selling Price
              </Text>
              <Text fw={500}>{formatCurrency(item.price, item.priceCurrency)}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Wholesale Price
              </Text>
              <Text fw={500}>
                {item.wholesalePrice ? formatCurrency(item.wholesalePrice, item.priceCurrency) : '-'}
              </Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Margin
              </Text>
              <Text fw={500}>{item.margin ? `${parseFloat(item.margin).toFixed(2)}%` : '-'}</Text>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Taxable
              </Text>
              <Badge color={item.isTaxable ? 'green' : 'gray'} variant="light" size="sm">
                {item.isTaxable ? 'Yes' : 'No'}
              </Badge>
            </Stack>
          </SimpleGrid>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
}
