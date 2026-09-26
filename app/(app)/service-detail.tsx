import { useLocalSearchParams } from 'expo-router';

import { ServiceDetailScreen } from '@/src/features/services/components/ServiceDetailScreen';

export default function ServiceDetailRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ServiceDetailScreen serviceId={id ?? ''} />;
}
