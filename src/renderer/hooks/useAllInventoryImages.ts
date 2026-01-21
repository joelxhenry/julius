import { useState, useCallback, useEffect } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import { InventoryImage } from './useInventoryImages';

export interface AllProductImagesResult {
  main: InventoryImage[];
  variants: Record<string, InventoryImage[]>;
}

export interface UseAllInventoryImagesOptions {
  mainSku: string;
  variantSkus: string[];
  autoLoad?: boolean;
}

export interface UseAllInventoryImagesReturn {
  mainImages: InventoryImage[];
  variantImages: Record<string, InventoryImage[]>;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getTotalImageCount: () => number;
  getVariantImageCount: (variantSku: string) => number;
}

/**
 * Hook for loading all images for a product and its variants
 * Used in the Gallery tab to show a consolidated view of all images
 */
export function useAllInventoryImages({
  mainSku,
  variantSkus,
  autoLoad = true,
}: UseAllInventoryImagesOptions): UseAllInventoryImagesReturn {
  const [mainImages, setMainImages] = useState<InventoryImage[]>([]);
  const [variantImages, setVariantImages] = useState<Record<string, InventoryImage[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!mainSku) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electron.invoke(IpcChannel.GET_ALL_PRODUCT_IMAGES, {
        mainSku,
        variantSkus,
      });

      if (result.success && result.data) {
        const data = result.data as AllProductImagesResult;
        setMainImages(data.main);
        setVariantImages(data.variants);
      } else {
        setError(result.error || 'Failed to load images');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setIsLoading(false);
    }
  }, [mainSku, variantSkus]);

  // Auto-load when SKUs change
  useEffect(() => {
    if (autoLoad && mainSku) {
      refresh();
    }
  }, [autoLoad, mainSku, JSON.stringify(variantSkus), refresh]);

  const getTotalImageCount = useCallback((): number => {
    let total = mainImages.length;
    for (const sku of Object.keys(variantImages)) {
      total += variantImages[sku].length;
    }
    return total;
  }, [mainImages, variantImages]);

  const getVariantImageCount = useCallback((variantSku: string): number => {
    return variantImages[variantSku]?.length || 0;
  }, [variantImages]);

  return {
    mainImages,
    variantImages,
    isLoading,
    error,
    refresh,
    getTotalImageCount,
    getVariantImageCount,
  };
}
