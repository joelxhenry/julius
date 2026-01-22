import { useState, useCallback } from 'react';
import { ActionIcon, Tooltip, CopyButton as MantineCopyButton } from '@mantine/core';
import { IconCopy, IconCheck } from '@tabler/icons-react';

interface CopyButtonProps {
  value: string;
  size?: 'xs' | 'sm' | 'md';
  tooltip?: string;
}

export function CopyButton({ value, size = 'xs', tooltip = 'Copy SKU' }: CopyButtonProps) {
  return (
    <MantineCopyButton value={value} timeout={1500}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? 'Copied!' : tooltip} withArrow position="top">
          <ActionIcon
            variant="subtle"
            color={copied ? 'teal' : 'gray'}
            onClick={(e) => {
              e.stopPropagation();
              copy();
            }}
            size={size}
          >
            {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
          </ActionIcon>
        </Tooltip>
      )}
    </MantineCopyButton>
  );
}
