import { ActionIcon, Indicator, Tooltip } from '@mantine/core';
import { IconShoppingBag } from '@tabler/icons-react';
import { useMarkedItems } from '../../hooks/useMarkedItems';

interface MarkedItemsLauncherProps {
  onOpen: () => void;
}

export function MarkedItemsLauncher({ onOpen }: MarkedItemsLauncherProps) {
  const { count } = useMarkedItems();

  return (
    <Tooltip label={count > 0 ? `Marked items (${count})` : 'Marked items'} position="left" withArrow>
      <Indicator
        label={count}
        size={18}
        offset={6}
        color="blue"
        disabled={count === 0}
        withBorder
        style={{
          position: 'fixed',
          bottom: 'var(--mantine-spacing-lg)',
          right: 'var(--mantine-spacing-lg)',
          zIndex: 200,
        }}
      >
        <ActionIcon
          aria-label="Open marked items tray"
          variant="filled"
          color="blue"
          size={56}
          radius="xl"
          onClick={onOpen}
          style={{
            boxShadow: 'var(--mantine-shadow-lg)',
          }}
        >
          <IconShoppingBag size={26} />
        </ActionIcon>
      </Indicator>
    </Tooltip>
  );
}
