import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useEffect,
  KeyboardEvent,
} from 'react';
import {
  Grid,
  TextInput,
  Autocomplete,
  Loader,
  Paper,
  ScrollArea,
  UnstyledButton,
  Text,
  Center,
} from '@mantine/core';
import { IconSearch, IconTag, IconCar } from '@tabler/icons-react';
import { ProductDisplay } from '../common';
import type { ProductSearchItem } from '../../hooks/useProductSearch';

export interface ProductSearchPanelHandle {
  /** Move keyboard focus to the first filter field (part number / description). */
  focus: () => void;
}

interface ProductSearchPanelProps {
  query: string;
  setQuery: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  model: string;
  setModel: (value: string) => void;
  results: ProductSearchItem[];
  isSearching: boolean;
  categoryOptions: string[];
  modelOptions: string[];
  /** Called when a product is chosen (Enter on the highlighted row or click). */
  onSelectProduct: (item: ProductSearchItem) => void;
  compact?: boolean;
}

/**
 * Multi-field product search used to add invoice/quotation line items.
 *
 * Three filter fields (part#/description, category, model) drive a live list of
 * matching parts rendered with the shared {@link ProductDisplay}. The part field
 * doubles as the results combobox: Arrow Down/Up move the highlight, Enter adds
 * the highlighted part. Category/model are autocompletes of real values.
 */
export const ProductSearchPanel = forwardRef<ProductSearchPanelHandle, ProductSearchPanelProps>(
  function ProductSearchPanel(
    {
      query,
      setQuery,
      category,
      setCategory,
      model,
      setModel,
      results,
      isSearching,
      categoryOptions,
      modelOptions,
      onSelectProduct,
      compact = false,
    },
    ref
  ) {
    const queryInputRef = useRef<HTMLInputElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    useImperativeHandle(ref, () => ({
      focus: () => {
        queryInputRef.current?.focus();
        queryInputRef.current?.select();
      },
    }));

    const size = compact ? 'xs' : 'sm';

    // Scroll the highlighted row into view.
    useEffect(() => {
      if (highlightedIndex < 0) return;
      const el = itemRefs.current[highlightedIndex];
      el?.scrollIntoView({ block: 'nearest' });
    }, [highlightedIndex]);

    const selectAt = (index: number) => {
      const item = results[index];
      if (item) onSelectProduct(item);
    };

    // Arrow/Enter handling lives on the part-number input, which acts as the
    // combobox controller for the results list below it.
    const handleQueryKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (results.length === 0) return;
        setHighlightedIndex((prev) => {
          // Clamp against the current result set (it may have shrunk).
          const cur = prev < 0 ? -1 : Math.min(prev, results.length - 1);
          return cur < results.length - 1 ? cur + 1 : 0;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (results.length === 0) return;
        setHighlightedIndex((prev) => {
          const cur = prev < 0 ? results.length : Math.min(prev, results.length - 1);
          return cur > 0 ? cur - 1 : results.length - 1;
        });
      } else if (e.key === 'Enter') {
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          e.preventDefault();
          selectAt(highlightedIndex);
        }
      }
    };

    return (
      <Paper withBorder p={compact ? 'xs' : 'sm'} radius="md">
        <Grid gutter="xs" align="flex-end">
          <Grid.Col span={{ base: 12, sm: 6 }}>
            <TextInput
              ref={queryInputRef}
              label={compact ? undefined : 'Part number / description'}
              placeholder="Search part number or description..."
              value={query}
              onChange={(e) => setQuery(e.currentTarget.value)}
              onKeyDown={handleQueryKeyDown}
              leftSection={<IconSearch size={16} />}
              rightSection={isSearching ? <Loader size={16} /> : null}
              size={size}
              autoComplete="off"
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Autocomplete
              label={compact ? undefined : 'Category'}
              placeholder="Category"
              value={category}
              onChange={setCategory}
              data={categoryOptions}
              leftSection={<IconTag size={16} />}
              size={size}
              clearable
              limit={30}
            />
          </Grid.Col>
          <Grid.Col span={{ base: 6, sm: 3 }}>
            <Autocomplete
              label={compact ? undefined : 'Model'}
              placeholder="Model"
              value={model}
              onChange={setModel}
              data={modelOptions}
              leftSection={<IconCar size={16} />}
              size={size}
              clearable
              limit={30}
            />
          </Grid.Col>
        </Grid>

        {(query.trim().length >= 2 || category.trim() || model.trim()) && (
          <ScrollArea.Autosize mah={280} mt="xs" viewportRef={viewportRef}>
            {results.length > 0 ? (
              <div role="listbox" aria-label="Matching parts">
                {results.map((item, index) => {
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <UnstyledButton
                      key={`${item.sku}-${item.id}-${index}`}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      role="option"
                      tabIndex={-1}
                      aria-selected={isHighlighted}
                      onClick={() => onSelectProduct(item)}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      style={{
                        display: 'block',
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: 6,
                        backgroundColor: isHighlighted
                          ? 'var(--mantine-color-blue-light)'
                          : undefined,
                      }}
                    >
                      <ProductDisplay
                        product={{
                          sku: item.sku,
                          category: item.category,
                          model: item.model,
                          price: item.price,
                        }}
                        size={size}
                        showCopyButton={false}
                      />
                      {(item.variantName || item.description1) && (
                        <Text size="xs" c="dimmed" mt={2} lineClamp={1}>
                          {item.variantName || item.description1}
                        </Text>
                      )}
                    </UnstyledButton>
                  );
                })}
              </div>
            ) : (
              !isSearching && (
                <Center py="md">
                  <Text size="sm" c="dimmed">
                    No matching parts.
                  </Text>
                </Center>
              )
            )}
          </ScrollArea.Autosize>
        )}
      </Paper>
    );
  }
);
