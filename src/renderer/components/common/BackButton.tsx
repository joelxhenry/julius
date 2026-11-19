import { ActionIcon, Button } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useTabContext } from '../../contexts/TabContext';
import { useProtectedTabNavigation } from '../../hooks/useProtectedTabNavigation';

interface BackButtonProps {
  // Where to go when the active tab has no recorded history (e.g. it was
  // opened directly rather than navigated to from another page).
  fallbackPath: string;
  // Accessible name / tooltip for the icon-only form.
  title?: string;
  // Renders as a labelled Button (for empty/not-found states) instead of
  // an icon-only ActionIcon (for page headers).
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

// Single back action used across all tabbed detail pages: goes to the page
// the active tab actually came from when one is recorded, otherwise falls
// back to the given parent route.
export function BackButton({ fallbackPath, title = 'Back', label, size = 'lg' }: BackButtonProps) {
  const { goBack, canGoBack } = useTabContext();
  const { bind } = useProtectedTabNavigation();

  const iconSize = size === 'sm' ? 16 : size === 'md' ? 18 : 20;

  if (label) {
    return canGoBack ? (
      <Button variant="subtle" leftSection={<IconArrowLeft size={iconSize} />} onClick={goBack}>
        {label}
      </Button>
    ) : (
      <Button variant="subtle" leftSection={<IconArrowLeft size={iconSize} />} {...bind(fallbackPath)}>
        {label}
      </Button>
    );
  }

  return canGoBack ? (
    <ActionIcon variant="subtle" size={size} onClick={goBack} title={title} aria-label={title}>
      <IconArrowLeft size={iconSize} />
    </ActionIcon>
  ) : (
    <ActionIcon variant="subtle" size={size} {...bind(fallbackPath)} title={title} aria-label={title}>
      <IconArrowLeft size={iconSize} />
    </ActionIcon>
  );
}
