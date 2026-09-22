import { useState } from 'react';
import {
  Box,
  NavLink,
  Text,
  Stack,
  ThemeIcon,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Button,
} from '@mantine/core';
import {
  IconFileInvoice,
  IconFileText,
  IconReceipt,
  IconReceiptDollar,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconArrowLeft,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { InvoicesPage } from '../invoices';
import { QuotationsPage } from '../quotations';
import { CreditNotesPage } from '../credit-notes';
import { usePermissions } from '../../permissions';

interface SalesSection {
  key: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  permission: string;
  component: React.ReactNode;
}

const salesSections: SalesSection[] = [
  {
    key: 'invoices',
    label: 'Invoices',
    description: 'View and search all invoices',
    icon: <IconFileInvoice size={20} />,
    color: 'teal',
    permission: 'VIEW_INVOICES',
    component: <InvoicesPage />,
  },
  {
    key: 'quotations',
    label: 'Quotations',
    description: 'View and search all quotations',
    icon: <IconFileText size={20} />,
    color: 'blue',
    permission: 'VIEW_QUOTATIONS',
    component: <QuotationsPage />,
  },
  {
    key: 'credit-notes',
    label: 'Credit Notes',
    description: 'View and manage issued credit notes',
    icon: <IconReceipt size={20} />,
    color: 'green',
    permission: 'VIEW_CREDIT_NOTES',
    component: <CreditNotesPage />,
  },
];

export function SalesManagementPage() {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const [selected, setSelected] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Only show the sub-sections this user is allowed to view.
  const visibleSections = salesSections.filter((s) => can(s.permission));
  const activeSection = visibleSections.find((s) => s.key === selected);

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
        <Box
          p="xs"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
        >
          {!collapsed && (
            <Text fw={700} size="sm" tt="uppercase" c="dimmed" pl={4}>
              Sales Management
            </Text>
          )}
          <ActionIcon variant="subtle" size="sm" onClick={() => setCollapsed((c) => !c)}>
            {collapsed ? (
              <IconLayoutSidebarLeftExpand size={18} />
            ) : (
              <IconLayoutSidebarLeftCollapse size={18} />
            )}
          </ActionIcon>
        </Box>
        <Box px={collapsed ? 4 : 'sm'} pb="xs">
          {collapsed ? (
            <Tooltip label="Back to Dashboard" position="right" withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="lg"
                onClick={() => navigate('/dashboard')}
                style={{ width: '100%' }}
                aria-label="Back to Dashboard"
              >
                <IconArrowLeft size={18} />
              </ActionIcon>
            </Tooltip>
          ) : (
            <Button
              variant="subtle"
              color="gray"
              size="sm"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate('/dashboard')}
              fullWidth
              justify="flex-start"
            >
              Back to Dashboard
            </Button>
          )}
        </Box>
        <ScrollArea style={{ flex: 1 }} px={collapsed ? 4 : 'sm'} pb="sm">
          <Stack gap={2}>
            {visibleSections.map((section) =>
              collapsed ? (
                <Tooltip key={section.key} label={section.label} position="right" withArrow>
                  <ActionIcon
                    variant={selected === section.key ? 'light' : 'subtle'}
                    color={selected === section.key ? section.color : 'gray'}
                    size="lg"
                    onClick={() => setSelected(section.key)}
                    style={{ width: '100%' }}
                  >
                    <ThemeIcon size={28} variant="light" color={section.color} radius="md">
                      {section.icon}
                    </ThemeIcon>
                  </ActionIcon>
                </Tooltip>
              ) : (
                <NavLink
                  key={section.key}
                  label={section.label}
                  description={section.description}
                  leftSection={
                    <ThemeIcon size={28} variant="light" color={section.color} radius="md">
                      {section.icon}
                    </ThemeIcon>
                  }
                  active={selected === section.key}
                  onClick={() => setSelected(section.key)}
                  variant="light"
                  styles={{
                    root: { borderRadius: 'var(--mantine-radius-md)' },
                  }}
                />
              )
            )}
          </Stack>
        </ScrollArea>
      </Box>

      {/* Content */}
      <Box p="md" style={{ flex: 1, overflow: 'auto' }}>
        {activeSection ? (
          activeSection.component
        ) : (
          <Stack align="center" justify="center" h="100%" gap="md">
            <ThemeIcon size={64} variant="light" color="gray" radius="xl">
              <IconReceiptDollar size={32} />
            </ThemeIcon>
            <Text size="lg" fw={500} c="dimmed">
              Select a tool from the sidebar
            </Text>
            <Text size="sm" c="dimmed" maw={320} ta="center">
              Browse and manage invoices, quotations, and credit notes.
            </Text>
          </Stack>
        )}
      </Box>
    </Box>
  );
}
