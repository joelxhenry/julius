import { useState, useEffect, useCallback } from 'react';
import { Box, Image, Skeleton, ThemeIcon, Tooltip, UnstyledButton } from '@mantine/core';
import { IconPhoto, IconPhotoOff } from '@tabler/icons-react';
import { imageCache } from '../../utils/imageCache';

interface ProductThumbnailProps {
  sku: string;
  isVariant?: boolean;
  size?: number;
  onClick?: () => void;
  showTooltip?: boolean;
  preloadedImage?: string | null;
}

/**
 * Displays a product thumbnail image from cache or fetches it
 * Used in data tables and lists
 */
export function ProductThumbnail({
  sku,
  isVariant = false,
  size = 40,
  onClick,
  showTooltip = true,
  preloadedImage,
}: ProductThumbnailProps) {
  const [imageData, setImageData] = useState<string | null>(preloadedImage ?? null);
  const [isLoading, setIsLoading] = useState(!preloadedImage);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // If preloaded image is provided, use it
    if (preloadedImage !== undefined) {
      setImageData(preloadedImage);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cached = imageCache.get(sku, isVariant);
    if (cached) {
      setImageData(cached);
      setIsLoading(false);
      return;
    }

    // Load from backend
    setIsLoading(true);
    setHasError(false);

    imageCache.loadThumbnail(sku, isVariant).then((data) => {
      setImageData(data);
      setIsLoading(false);
    }).catch(() => {
      setHasError(true);
      setIsLoading(false);
    });
  }, [sku, isVariant, preloadedImage]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onClick?.();
  }, [onClick]);

  const content = (
    <Box
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--mantine-radius-sm)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {isLoading ? (
        <Skeleton width={size} height={size} />
      ) : imageData ? (
        <Image
          src={imageData}
          alt={`${sku} thumbnail`}
          width={size}
          height={size}
          fit="cover"
          style={{ cursor: onClick ? 'pointer' : 'default' }}
        />
      ) : (
        <ThemeIcon
          variant="light"
          color="gray"
          size={size}
          radius="sm"
          style={{ cursor: onClick ? 'pointer' : 'default' }}
        >
          {hasError ? (
            <IconPhotoOff size={size * 0.5} />
          ) : (
            <IconPhoto size={size * 0.5} />
          )}
        </ThemeIcon>
      )}
    </Box>
  );

  if (onClick) {
    const wrapped = (
      <UnstyledButton onClick={handleClick}>
        {content}
      </UnstyledButton>
    );

    if (showTooltip && imageData) {
      return (
        <Tooltip label="View image" position="right" withArrow>
          {wrapped}
        </Tooltip>
      );
    }

    if (showTooltip && !imageData && !isLoading) {
      return (
        <Tooltip label="Add image" position="right" withArrow>
          {wrapped}
        </Tooltip>
      );
    }

    return wrapped;
  }

  return content;
}

/**
 * Placeholder for when no SKU is available
 */
export function ProductThumbnailPlaceholder({ size = 40 }: { size?: number }) {
  return (
    <ThemeIcon
      variant="light"
      color="gray"
      size={size}
      radius="sm"
    >
      <IconPhoto size={size * 0.5} />
    </ThemeIcon>
  );
}
