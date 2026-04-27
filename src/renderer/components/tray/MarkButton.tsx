import { useMemo, useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconBookmark, IconBookmarkFilled } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useMarkedItems, MarkInput } from '../../hooks/useMarkedItems';
import { resolveBaseVariant } from '../../utils/resolveBaseVariant';

export type MarkButtonItem = Omit<MarkInput, 'key' | 'quantity'>;

export function makeMarkKey(partNumber: string, isVariant: boolean): string {
  return `${isVariant ? 'v' : 'i'}::${partNumber}`;
}

interface MarkButtonBaseProps {
  size?: number;
  iconSize?: number;
  withTooltip?: boolean;
}

interface VariantMarkButtonProps extends MarkButtonBaseProps {
  /** Mark a specific variant directly. Used in VariantsTab rows. */
  mode: 'variant';
  item: MarkButtonItem;
  parentSku?: never;
}

interface ItemMarkButtonProps extends MarkButtonBaseProps {
  /**
   * Mark a base inventory item. The button resolves the item's base variant on click and
   * stores that in the tray. The "marked" indicator is true when ANY variant of this
   * parent SKU is in the tray (so marking a non-base variant via VariantsTab also lights
   * up the parent item's button). Unmark removes every tray entry for this parent.
   */
  mode: 'item';
  parentSku: string;
  item?: never;
}

export type MarkButtonProps = VariantMarkButtonProps | ItemMarkButtonProps;

export function MarkButton(props: MarkButtonProps) {
  const { size, iconSize = 16, withTooltip = true } = props;
  const { items, isMarked, mark, unmark } = useMarkedItems();
  const [resolving, setResolving] = useState(false);

  const marked = useMemo(() => {
    if (props.mode === 'variant') {
      return isMarked(makeMarkKey(props.item.partNumber, props.item.isVariant));
    }
    return items.some((i) => i.parentPartNumber === props.parentSku);
  }, [props, items, isMarked]);

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    if (props.mode === 'variant') {
      const key = makeMarkKey(props.item.partNumber, props.item.isVariant);
      if (marked) {
        unmark(key);
      } else {
        mark({ key, ...props.item });
      }
      return;
    }

    // mode === 'item': clicking a base-item button.
    if (marked) {
      // Remove every tray entry for this parent so the indicator flips off.
      const matches = items.filter((i) => i.parentPartNumber === props.parentSku);
      for (const m of matches) unmark(m.key);
      return;
    }

    if (resolving) return;
    setResolving(true);
    try {
      const resolved = await resolveBaseVariant(props.parentSku);
      if (!resolved) {
        notifications.show({
          title: 'Could not mark item',
          message: `${props.parentSku} has no base variant. Open the item and add one first.`,
          color: 'red',
        });
        return;
      }
      const key = makeMarkKey(resolved.partNumber, resolved.isVariant);
      mark({ key, ...resolved });
    } catch (error) {
      notifications.show({
        title: 'Could not mark item',
        message: error instanceof Error ? error.message : 'Unknown error.',
        color: 'red',
      });
    } finally {
      setResolving(false);
    }
  };

  const button = (
    <ActionIcon
      variant={marked ? 'filled' : 'subtle'}
      color={marked ? 'blue' : 'gray'}
      size={size}
      aria-label={marked ? 'Remove from marked items' : 'Mark item'}
      aria-pressed={marked}
      loading={resolving}
      onClick={handleClick}
    >
      {marked ? <IconBookmarkFilled size={iconSize} /> : <IconBookmark size={iconSize} />}
    </ActionIcon>
  );

  if (!withTooltip) return button;
  return (
    <Tooltip label={marked ? 'Marked' : 'Mark item'} withArrow position="left">
      {button}
    </Tooltip>
  );
}
