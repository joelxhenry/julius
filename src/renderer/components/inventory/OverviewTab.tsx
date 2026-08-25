import { Paper, Stack, Title, SimpleGrid, Text, Badge, Group } from '@mantine/core';
import { CopyButton } from '../common';
import { normalizeToArray } from '../../../shared/utils/arrayFields';

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
}

export function OverviewTab({ item }: OverviewTabProps) {
  return (
    <Paper p="lg" radius="md" withBorder>
        <Stack gap="md">
          <Title order={4}>Product Details</Title>
          <SimpleGrid cols={2}>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Part Number
              </Text>
              <Group gap="xs">
                <Text fw={500}>{item.sku}</Text>
                <CopyButton value={item.sku} />
              </Group>
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Categories
              </Text>
              {(() => {
                const categories = normalizeToArray(item.category);
                return categories.length > 0 ? (
                  <Group gap={6} wrap="wrap">
                    {categories.map((cat, idx) => (
                      <Badge key={idx} variant="filled" size="md" radius="sm">
                        {cat}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text fw={500}>-</Text>
                );
              })()}
            </Stack>
            <Stack gap={2}>
              <Text size="xs" c="dimmed">
                Models
              </Text>
              {(() => {
                const models = normalizeToArray(item.model);
                return models.length > 0 ? (
                  <Group gap={6} wrap="wrap">
                    {models.map((model, idx) => (
                      <Badge key={idx} variant="light" color="gray" size="md" radius="sm">
                        {model}
                      </Badge>
                    ))}
                  </Group>
                ) : (
                  <Text fw={500}>-</Text>
                );
              })()}
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
  );
}
