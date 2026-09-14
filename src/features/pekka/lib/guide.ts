import type MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export interface PekkaGuideTopic {
  id: string;
  titleKey: string;
  bodyKey: string;
  icon: IconName;
  /** Optional expo-router path Pekka can jump to. */
  route?: string;
  /** Shop-only topics are hidden in Personal workspaces. */
  scope: 'all' | 'shop';
}

export const PEKKA_GUIDE: PekkaGuideTopic[] = [
  {
    id: 'sale',
    titleKey: 'pekka.guide.sale.title',
    bodyKey: 'pekka.guide.sale.body',
    icon: 'point-of-sale',
    route: '/(app)/(tabs)/pos',
    scope: 'shop',
  },
  {
    id: 'stock',
    titleKey: 'pekka.guide.stock.title',
    bodyKey: 'pekka.guide.stock.body',
    icon: 'package-variant-closed',
    route: '/(app)/(tabs)/inventory',
    scope: 'shop',
  },
  {
    id: 'money',
    titleKey: 'pekka.guide.money.title',
    bodyKey: 'pekka.guide.money.body',
    icon: 'wallet',
    route: '/(app)/(tabs)/expenses',
    scope: 'all',
  },
  {
    id: 'party',
    titleKey: 'pekka.guide.party.title',
    bodyKey: 'pekka.guide.party.body',
    icon: 'account-group',
    route: '/(app)/(tabs)/parties',
    scope: 'shop',
  },
];

export function guideForWorkspace(isPersonal: boolean): PekkaGuideTopic[] {
  return PEKKA_GUIDE.filter((topic) => (isPersonal ? topic.scope === 'all' : true));
}
