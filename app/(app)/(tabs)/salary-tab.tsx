import { Redirect } from 'expo-router';
import { useAuthStore } from '@/src/stores/auth-store';

export default function SalaryTabRedirect() {
  const accessControl = useAuthStore((state) => state.accessControl);
  const user = useAuthStore((state) => state.user);
  const membershipId = accessControl?.membershipId || '';
  const name = user?.name || '';
  return <Redirect href={`/(app)/staff-salary?membershipId=${membershipId}&name=${encodeURIComponent(name)}` as any} />;
}
