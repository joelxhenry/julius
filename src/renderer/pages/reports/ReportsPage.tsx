import { useState } from 'react';
import { Box, NavLink, Text, Stack, ThemeIcon, ScrollArea, ActionIcon, Tooltip } from '@mantine/core';
import {
  IconCash,
  IconClockDollar,
  IconCreditCard,
  IconChartBar,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from '@tabler/icons-react';
import { SalesSummaryReport } from './SalesSummaryReport';
import { ReceivablesAgingReport } from './ReceivablesAgingReport';
import { PaymentCollectionReport } from './PaymentCollectionReport';

interface ReportEntry {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  component: React.ReactNode;
}

const reports: ReportEntry[] = [
  {
    key: 'sales',
    label: 'Sales Summary',
    description: 'Revenue, tax, payments & outstanding',
    icon: <IconCash size={20} />,
    color: 'teal',
    component: <SalesSummaryReport />,
  },
  {
    key: 'receivables',
    label: 'Receivables Aging',
    description: 'Outstanding invoices by age bucket',
    icon: <IconClockDollar size={20} />,
    color: 'orange',
    component: <ReceivablesAgingReport />,
  },
  {
    key: 'payments',
    label: 'Payment Collection',
    description: 'Payments by method and processor',
    icon: <IconCreditCard size={20} />,
    color: 'green',
    component: <PaymentCollectionReport />,
  },
];

export function ReportsPage() {
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const activeReport = reports.find((r) => r.key === selected);

  return (
    <Box style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <Box
        style={{
          width: collapsed ? 56 : 260,
          minWidth: collapsed ? 56 : 260,
          borderRight: '1px solid var(--mantine-color-default-border)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 200ms ease, min-width 200ms ease',
        }}
      >
        <Box p="xs" style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between' }}>
          {!collapsed && (
            <Text fw={700} size="sm" tt="uppercase" c="dimmed" pl={4}>
              Reports
            </Text>
          )}
          <ActionIcon variant="subtle" size="sm" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? <IconLayoutSidebarLeftExpand size={18} /> : <IconLayoutSidebarLeftCollapse size={18} />}
          </ActionIcon>
        </Box>
        <ScrollArea style={{ flex: 1 }} px={collapsed ? 4 : 'sm'} pb="sm">
          <Stack gap={2}>
            {reports.map((report) =>
              collapsed ? (
                <Tooltip key={report.key} label={report.label} position="right" withArrow>
                  <ActionIcon
                    variant={selected === report.key ? 'light' : 'subtle'}
                    color={selected === report.key ? report.color : 'gray'}
                    size="lg"
                    onClick={() => setSelected(report.key)}
                    style={{ width: '100%' }}
                  >
                    <ThemeIcon size={28} variant="light" color={report.color} radius="md">
                      {report.icon}
                    </ThemeIcon>
                  </ActionIcon>
                </Tooltip>
              ) : (
                <NavLink
                  key={report.key}
                  label={report.label}
                  description={report.description}
                  leftSection={
                    <ThemeIcon size={28} variant="light" color={report.color} radius="md">
                      {report.icon}
                    </ThemeIcon>
                  }
                  active={selected === report.key}
                  onClick={() => setSelected(report.key)}
                  variant="light"
                  styles={{
                    root: { borderRadius: 'var(--mantine-radius-md)' },
                  }}
                />
              ),
            )}
          </Stack>
        </ScrollArea>
      </Box>

      {/* Content */}
      <Box style={{ flex: 1, overflow: 'auto' }}>
        {activeReport ? (
          activeReport.component
        ) : (
          <Stack align="center" justify="center" h="100%" gap="md">
            <ThemeIcon size={64} variant="light" color="gray" radius="xl">
              <IconChartBar size={32} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="dimmed">
              Select a report from the sidebar
            </Text>
            <Text size="sm" c="dimmed" maw={300} ta="center">
              Choose one of the available reports to generate and view your business data.
            </Text>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
