import { useQuery } from '@tanstack/react-query';

import * as usersApi from '@/lib/queries/users';

/** Generic wrapper around `listUsersByRole` — previously only wrapped ad-hoc per module (e.g.
 * `useTechnicians()`), this is the same query, just reusable for any role/picker. */
export function useUsersByRole(role: usersApi.UserRole) {
  return useQuery({ queryKey: ['users', role], queryFn: () => usersApi.listUsersByRole(role) });
}
