/**
 * Permissions module — reusable functions and views for permission enforcement.
 *
 * - usePermissions(): can/canAny/canAll checks + one-time override helpers
 * - <PermissionGate>: show/hide a view or tab panel, or a clear "restricted" state
 * - <PermissionButton>: hide, disable, or elevate-by-another-user for actions
 * - <RestrictedValue>: mask a sensitive value inline (e.g. cost on a card)
 * - <RestrictedLink>: cross-entity link that's only clickable when permitted
 * - <AccessDeniedView>: standalone "you don't have permission" panel
 * - AccessOverrideProvider / useAccessOverride: grant → record → revert plumbing
 *
 * All override grants are transient and consumed after the action, so the
 * effective identity always reverts to the logged-in user. Every grant is
 * recorded to the access_overrides audit table.
 */
export { usePermissions } from './usePermissions';
export type { UsePermissions } from './usePermissions';
export { PermissionGate } from './PermissionGate';
export { PermissionButton } from './PermissionButton';
export { RestrictedValue } from './RestrictedValue';
export { RestrictedLink } from './RestrictedLink';
export { AccessDeniedView } from './AccessDeniedView';
export {
  AccessOverrideProvider,
  useAccessOverride,
} from './AccessOverrideContext';
export type { OverrideGrant, RequestOverrideOptions } from './AccessOverrideContext';
export { RequestAccessModal } from './RequestAccessModal';
