import { Modal, TextInput, Stack, Group, Text, Badge, Loader, Kbd, Paper, UnstyledButton, Box, Center } from '@mantine/core';
import { IconSearch, IconFileInvoice, IconUser, IconPackage, IconFileText } from '@tabler/icons-react';
import { useSpotlight, SpotlightResult } from '../../contexts/SpotlightContext';

const typeIcons: Record<SpotlightResult['type'], React.ReactNode> = {
  invoice: <IconFileInvoice size={20} />,
  client: <IconUser size={20} />,
  inventory: <IconPackage size={20} />,
  quotation: <IconFileText size={20} />,
};

const typeColors: Record<SpotlightResult['type'], string> = {
  invoice: 'blue',
  client: 'green',
  inventory: 'orange',
  quotation: 'purple',
};

const statusColors: Record<string, string> = {
  draft: 'gray',
  active: 'blue',
  partially_paid: 'yellow',
  paid: 'green',
  archived: 'gray',
  pending: 'yellow',
  accepted: 'green',
  expired: 'red',
};

interface SpotlightResultItemProps {
  result: SpotlightResult;
  isSelected: boolean;
  onClick: () => void;
}

function SpotlightResultItem({ result, isSelected, onClick }: SpotlightResultItemProps) {
  return (
    <UnstyledButton
      onClick={onClick}
      w="100%"
      p="sm"
      style={{
        borderRadius: 'var(--mantine-radius-md)',
        backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : 'transparent',
      }}
    >
      <Group gap="sm" wrap="nowrap">
        <Box c={typeColors[result.type]}>
          {typeIcons[result.type]}
        </Box>
        <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
          <Group gap="xs" wrap="nowrap">
            <Text size="sm" fw={500} truncate>
              {result.title}
            </Text>
            {result.status && (
              <Badge size="xs" variant="light" color={statusColors[result.status] || 'gray'}>
                {result.status.replace('_', ' ')}
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed" truncate>
            {result.subtitle}
          </Text>
        </Stack>
        <Badge size="xs" variant="outline" color={typeColors[result.type]}>
          {result.type}
        </Badge>
      </Group>
    </UnstyledButton>
  );
}

export function Spotlight() {
  const {
    isOpen,
    close,
    query,
    setQuery,
    results,
    isLoading,
    selectedIndex,
    setSelectedIndex,
    navigateToResult,
  } = useSpotlight();

  return (
    <Modal
      opened={isOpen}
      onClose={close}
      size="lg"
      padding={0}
      withCloseButton={false}
      centered
      overlayProps={{ backgroundOpacity: 0.4 }}
      transitionProps={{ transition: 'pop', duration: 150 }}
    >
      <Paper>
        <TextInput
          placeholder="Search invoices, clients, inventory..."
          leftSection={isLoading ? <Loader size={16} /> : <IconSearch size={16} />}
          rightSection={
            <Group gap={4}>
              <Kbd size="xs">Esc</Kbd>
            </Group>
          }
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          size="lg"
          variant="unstyled"
          autoFocus
          styles={{
            input: {
              border: 'none',
              padding: 'var(--mantine-spacing-md)',
            },
            section: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            },
          }}
        />

        {query.length >= 2 && (
          <Box
            style={{
              borderTop: '1px solid var(--mantine-color-default-border)',
              maxHeight: 400,
              overflowY: 'auto',
            }}
            p="xs"
          >
            {results.length > 0 ? (
              <Stack gap={2}>
                {results.map((result, index) => (
                  <SpotlightResultItem
                    key={`${result.type}-${result.id}`}
                    result={result}
                    isSelected={index === selectedIndex}
                    onClick={() => {
                      // Navigate directly using the clicked result
                      // Don't rely on selectedIndex state which updates asynchronously
                      navigateToResult(result);
                    }}
                  />
                ))}
              </Stack>
            ) : !isLoading ? (
              <Center py="xl">
                <Text c="dimmed" size="sm">
                  No results found for "{query}"
                </Text>
              </Center>
            ) : null}
          </Box>
        )}

        {query.length < 2 && (
          <Box
            style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
            p="md"
          >
            <Text size="sm" c="dimmed" ta="center">
              Type at least 2 characters to search
            </Text>
            <Group justify="center" mt="md" gap="lg">
              <Group gap="xs">
                <Kbd size="xs">↑</Kbd>
                <Kbd size="xs">↓</Kbd>
                <Text size="xs" c="dimmed">to navigate</Text>
              </Group>
              <Group gap="xs">
                <Kbd size="xs">Enter</Kbd>
                <Text size="xs" c="dimmed">to select</Text>
              </Group>
              <Group gap="xs">
                <Kbd size="xs">Esc</Kbd>
                <Text size="xs" c="dimmed">to close</Text>
              </Group>
            </Group>
          </Box>
        )}
      </Paper>
    </Modal>
  );
}
