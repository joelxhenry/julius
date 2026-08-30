import React from 'react';
import { Anchor, Text } from '@mantine/core';
import { usePermissions } from './usePermissions';

interface RestrictedLinkProps {
  /** Permission code(s) required to follow the link (e.g. the target page's view code). */
  permission: string | string[];
  /** When multiple codes are given, require ANY instead of ALL. */
  requireAny?: boolean;
  /** Navigation handler — only invoked when permitted. */
  onClick: () => void;
  /** Link colour when permitted (Mantine colour). */
  color?: string;
  size?: string;
  /** Font weight (applied whether permitted or not). */
  fw?: number;
  /** Top margin (Mantine spacing), passed through for layout parity. */
  mt?: number;
  children: React.ReactNode;
}

/**
 * A cross-entity link that is only clickable when the viewer may open the target.
 *
 * When permitted it renders a normal <Anchor> (navigates on click); when not, it
 * renders the same label as plain, non-interactive text — so a user without
 * VIEW_EMPLOYEES can still see a salesperson's name but can't open their page.
 *
 *   <RestrictedLink permission="VIEW_EMPLOYEES" color="violet" onClick={openEmployee}>
 *     {salespersonName}
 *   </RestrictedLink>
 */
export function RestrictedLink({
  permission,
  requireAny = false,
  onClick,
  color = 'blue',
  size,
  fw,
  mt,
  children,
}: RestrictedLinkProps) {
  const { can, canAny, canAll } = usePermissions();
  const codes = Array.isArray(permission) ? permission : [permission];
  const allowed = codes.length === 1 ? can(codes[0]) : requireAny ? canAny(codes) : canAll(codes);

  if (allowed) {
    return (
      <Anchor size={size} c={color} fw={fw} mt={mt} onClick={onClick} style={{ cursor: 'pointer' }}>
        {children}
      </Anchor>
    );
  }

  return (
    <Text component="span" size={size} fw={fw} mt={mt} c="dimmed">
      {children}
    </Text>
  );
}
