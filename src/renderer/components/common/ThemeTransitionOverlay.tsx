import { Loader } from '@mantine/core';
import { useTheme } from '../../contexts/ThemeContext';

export function ThemeTransitionOverlay() {
  const { isTransitioning, colorScheme } = useTheme();

  if (!isTransitioning) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colorScheme === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(4px)',
        transition: 'opacity 150ms ease-in-out',
        opacity: isTransitioning ? 1 : 0,
        pointerEvents: isTransitioning ? 'all' : 'none',
      }}
    >
      <Loader size="lg" type="dots" />
    </div>
  );
}
