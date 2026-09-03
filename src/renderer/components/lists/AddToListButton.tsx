import { useState } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconListPlus } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { resolveBaseVariant } from '../../utils/resolveBaseVariant';
import { AddToListModal } from './AddToListModal';
import type { AddListItemInput } from '../../../shared/types/productList';

interface AddToListButtonBaseProps {
  size?: number;
  iconSize?: number;
  withTooltip?: boolean;
}

interface VariantAddProps extends AddToListButtonBaseProps {
  /** Attach a specific variant/product directly. */
  mode: 'variant';
  item: AddListItemInput;
  parentSku?: never;
}

interface ItemAddProps extends AddToListButtonBaseProps {
  /**
   * Attach a base inventory item. Resolves the item's base variant on click so
   * the stored SKU matches what invoices/quotations reference (see MarkButton).
   */
  mode: 'item';
  parentSku: string;
  item?: never;
}

export type AddToListButtonProps = VariantAddProps | ItemAddProps;

export function AddToListButton(props: AddToListButtonProps) {
  const { size, iconSize = 16, withTooltip = true } = props;
  const [opened, setOpened] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [item, setItem] = useState<AddListItemInput | null>(null);

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    if (props.mode === 'variant') {
      setItem(props.item);
      setOpened(true);
      return;
    }

    if (resolving) return;
    setResolving(true);
    try {
      const resolved = await resolveBaseVariant(props.parentSku);
      if (!resolved) {
        notifications.show({
          title: 'Could not add item',
          message: `${props.parentSku} has no base variant. Open the item and add one first.`,
          color: 'red',
        });
        return;
      }
      setItem({
        sku: resolved.partNumber,
        isVariant: resolved.isVariant,
        description: resolved.description,
      });
      setOpened(true);
    } catch (error) {
      notifications.show({
        title: 'Could not add item',
        message: error instanceof Error ? error.message : 'Unknown error.',
        color: 'red',
      });
    } finally {
      setResolving(false);
    }
  };

  const button = (
    <ActionIcon
      variant="subtle"
      color="gray"
      size={size}
      aria-label="Add to list"
      loading={resolving}
      onClick={handleClick}
    >
      <IconListPlus size={iconSize} />
    </ActionIcon>
  );

  return (
    <>
      {withTooltip ? (
        <Tooltip label="Add to list" withArrow position="left">
          {button}
        </Tooltip>
      ) : (
        button
      )}
      <AddToListModal opened={opened} onClose={() => setOpened(false)} item={item} />
    </>
  );
}
