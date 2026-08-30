import React from 'react';
import { usePermissions } from './usePermissions';

interface RestrictedValueProps {
  /** Permission code(s) required to see the value. */
  permission: string | string[];
  /** When multiple codes are given, require ANY instead of ALL. */
  requireAny?: boolean;
  /** What to show when not permitted (default: a masked placeholder). */
  mask?: React.ReactNode;
  /** The sensitive value to display when permitted. */
  children: React.ReactNode;
}

/**
 * Inline gate for a single sensitive value inside a card/row/label.
 *
 * Renders `children` when permitted, otherwise a masked placeholder — without
 * wrapping the content in any block element, so it drops straight into a
 * <Text>, table cell, or badge.
 *
 *   <Text fw={700}><RestrictedValue permission="VIEW_COST">{cost}</RestrictedValue></Text>
 */
export function RestrictedValue({
  permission,
  requireAny = false,
  mask = '••••',
  children,
}: RestrictedValueProps) {
  const { can, canAny, canAll } = usePermissions();
  const codes = Array.isArray(permission) ? permission : [permission];
  const allowed = codes.length === 1 ? can(codes[0]) : requireAny ? canAny(codes) : canAll(codes);

  return <>{allowed ? children : mask}</>;
}
