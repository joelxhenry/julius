/**
 * Human-readable label for an employee.
 *
 * NEVER falls back to the access `code` — that is a secret credential, not an
 * identifier. Falls back to the username, then to "Employee #<id>".
 */
export function employeeDisplayName(emp: {
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  id?: number | null;
}): string {
  const name = `${emp.firstName ?? ''} ${emp.lastName ?? ''}`.trim();
  if (name) return name;
  if (emp.username) return emp.username;
  return emp.id != null ? `Employee #${emp.id}` : 'Employee';
}
