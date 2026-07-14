import { canAccess, HOME_ROUTE_BY_ROLE, Resource } from '@/constants/permissions';
import { useAuth } from '@/hooks/use-auth';

export function usePermissions() {
  const { profile, loading } = useAuth();
  const role = profile?.role;

  return {
    role,
    loading,
    can: (resource: Resource) => canAccess(role, resource),
    homeRoute: role ? HOME_ROUTE_BY_ROLE[role] : '/dashboard',
  };
}
