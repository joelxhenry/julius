import { useState } from 'react';
import {
  Paper,
  Stack,
  Text,
  Group,
  Badge,
  ActionIcon,
  Collapse,
  Transition,
  Alert,
  Box,
} from '@mantine/core';
import { IconAlertTriangle, IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-react';
import type { InventoryWarning } from './InventoryWarningModal';

interface CreditIssue {
  type: string;
  message: string;
}

interface CreditCheckResult {
  requiresAdminOverride: boolean;
  reasons: CreditIssue[];
}

interface FloatingAlertsProps {
  creditCheck: CreditCheckResult | null;
  inventoryWarnings: InventoryWarning[];
}

export function FloatingAlerts({ creditCheck, inventoryWarnings }: FloatingAlertsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const hasCreditIssues = creditCheck?.requiresAdminOverride;
  const hasInventoryWarnings = inventoryWarnings.length > 0;
  const hasAlerts = hasCreditIssues || hasInventoryWarnings;

  // Don't render if no alerts or dismissed
  if (!hasAlerts || isDismissed) {
    return null;
  }

  const totalAlerts = (hasCreditIssues ? 1 : 0) + (hasInventoryWarnings ? 1 : 0);

  return (
    <Box
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        zIndex: 100,
        maxWidth: 400,
      }}
    >
      <Transition mounted={true} transition="slide-up" duration={200}>
        {(styles) => (
          <Paper
            shadow="lg"
            radius="md"
            withBorder
            style={{
              ...styles,
              borderColor: 'var(--mantine-color-orange-5)',
            }}
          >
            {/* Collapsed Header - Always Visible */}
            <Group
              justify="space-between"
              p="sm"
              style={{ cursor: 'pointer' }}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <Group gap="xs">
                <IconAlertTriangle size={18} color="var(--mantine-color-orange-6)" />
                <Text size="sm" fw={500}>
                  {totalAlerts} Warning{totalAlerts > 1 ? 's' : ''}
                </Text>
                {hasCreditIssues && (
                  <Badge size="xs" color="orange" variant="light">
                    Credit
                  </Badge>
                )}
                {hasInventoryWarnings && (
                  <Badge size="xs" color="orange" variant="light">
                    Stock ({inventoryWarnings.length})
                  </Badge>
                )}
              </Group>
              <Group gap={4}>
                <ActionIcon
                  variant="subtle"
                  size="sm"
                  color="gray"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDismissed(true);
                  }}
                >
                  <IconX size={14} />
                </ActionIcon>
                <ActionIcon variant="subtle" size="sm" color="gray">
                  {isExpanded ? <IconChevronDown size={16} /> : <IconChevronUp size={16} />}
                </ActionIcon>
              </Group>
            </Group>

            {/* Expanded Content */}
            <Collapse in={isExpanded}>
              <Stack gap="xs" p="sm" pt={0}>
                {/* Credit Warning */}
                {hasCreditIssues && creditCheck && (
                  <Alert
                    icon={<IconAlertTriangle size={16} />}
                    color="orange"
                    title="Credit Issues"
                    variant="light"
                    p="xs"
                  >
                    <Stack gap={2}>
                      {creditCheck.reasons.map((reason, idx) => (
                        <Text key={idx} size="xs">
                          {reason.message}
                        </Text>
                      ))}
                      <Text size="xs" fw={500} mt={4}>
                        Admin override required to issue.
                      </Text>
                    </Stack>
                  </Alert>
                )}

                {/* Inventory Warning */}
                {hasInventoryWarnings && (
                  <Alert
                    icon={<IconAlertTriangle size={16} />}
                    color="orange"
                    title="Inventory Availability"
                    variant="light"
                    p="xs"
                  >
                    <Stack gap={2}>
                      <Text size="xs">
                        {inventoryWarnings.length} item(s) have insufficient stock.
                      </Text>
                      {inventoryWarnings.slice(0, 3).map((w, idx) => (
                        <Text key={idx} size="xs" c="dimmed">
                          {w.sku}: need {w.requestedQty}, have {w.availableQty}
                        </Text>
                      ))}
                      {inventoryWarnings.length > 3 && (
                        <Text size="xs" c="dimmed" fs="italic">
                          +{inventoryWarnings.length - 3} more...
                        </Text>
                      )}
                    </Stack>
                  </Alert>
                )}
              </Stack>
            </Collapse>
          </Paper>
        )}
      </Transition>
    </Box>
  );
}
