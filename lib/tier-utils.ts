import { CREDIT_TIERS, type TierId } from '@/app/account/page';

export const AFFIRMATION_CREDIT_COST = 20;

export function getTierInfo(tierId: string | null | undefined) {
  if (!tierId) return null;
  return CREDIT_TIERS.find((tier) => tier.id === tierId) ?? null;
}

export function canUsePersonalImage(
  tierId: string | null | undefined
): boolean {
  const tier = getTierInfo(tierId);
  return tier?.allowsPersonalImage ?? false;
}

export function canUsePersonalVoice(
  tierId: string | null | undefined
): boolean {
  const tier = getTierInfo(tierId);
  return tier?.allowsPersonalVoice ?? false;
}

export function getUpgradeMessage(
  feature: 'personal-image' | 'personal-voice'
): { title: string; description: string; requiredTier: string } {
  if (feature === 'personal-image') {
    return {
      title: 'Upgrade to Creator or Visionary',
      description:
        'Personal image generation is available in Creator ($9.99) and Visionary ($16.99) tiers. Upgrade to unlock this feature.',
      requiredTier: 'creator',
    };
  }
  return {
    title: 'Upgrade to Visionary',
    description:
      'Personal voice cloning is only available in the Visionary tier ($16.99). Upgrade to unlock this feature.',
    requiredTier: 'visionary',
  };
}
