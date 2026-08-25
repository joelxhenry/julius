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

interface PricingTabProps {
  item: Inventory;
  formatCurrency: (amount: number | string, currency?: string) => string;
}

export function PricingTab({ item, formatCurrency }: PricingTabProps) {
  return (
    <Paper p="lg" radius="md" withBorder>
      <Stack gap="md">
        <Title order={4}>Pricing Information</Title>
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
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
  );
}
