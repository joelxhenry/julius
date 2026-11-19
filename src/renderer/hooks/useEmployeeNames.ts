import { useEffect, useState } from 'react';
import { IpcChannel } from '../../shared/types/ipc';
import { employeeDisplayName } from '../utils/employeeName';

/**
 * Resolves a list of employee ids to display names, for tables/lists that
 * can reference several different employees at once (e.g. payment history,
 * credit note usage). Returns a map of resolved names; an id missing from
 * the map is either null/undefined or still in flight - callers should
 * supply their own fallback (e.g. `Employee #<id>`) for that case.
 */
export function useEmployeeNames(ids: Array<number | null | undefined>): Map<number, string> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is number => id != null))).sort(
    (a, b) => a - b
  );
  const key = uniqueIds.join(',');
  const [names, setNames] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    if (!key) {
      setNames(new Map());
      return;
    }
    let cancelled = false;
    Promise.all(
      key.split(',').map(async (idStr) => {
        const id = Number(idStr);
        const res = await window.electron.invoke(IpcChannel.GET_EMPLOYEE, { id });
        return res.success && res.data ? ([id, employeeDisplayName(res.data)] as const) : null;
      })
    ).then((results) => {
      if (cancelled) return;
      const map = new Map<number, string>();
      for (const entry of results) {
        if (entry) map.set(entry[0], entry[1]);
      }
      setNames(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return names;
}
