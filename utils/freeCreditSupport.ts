export const SUPPORT_EMAIL = 'jonathan@moodboard-lab.com';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;

export const FREE_CREDITS_BLOCKED_FOR_NETWORK_CODE = 'FREE_CREDITS_BLOCKED_FOR_NETWORK';
export const FREE_CREDITS_BLOCKED_FOR_DEVICE_CODE = 'FREE_CREDITS_BLOCKED_FOR_DEVICE';
export const FREE_CREDITS_THROTTLED_NETWORK_RISK_CODE = 'FREE_CREDITS_THROTTLED_NETWORK_RISK';

const FREE_CREDITS_BLOCKED_SIGNATURES = [
  'free credits have already been claimed from this device this month',
  'free credits have already been claimed from this network this month',
  'free credits are temporarily limited for this network due to unusually high sign-up activity',
];

export function isFreeCreditsBlockedForNetwork(value: {
  code?: string | null;
  message?: string | null;
  freeCreditsBlocked?: boolean | null;
}): boolean {
  if (value.freeCreditsBlocked) {
    return true;
  }

  const code = typeof value.code === 'string' ? value.code.trim() : '';
  if (
    code === FREE_CREDITS_BLOCKED_FOR_NETWORK_CODE
    || code === FREE_CREDITS_BLOCKED_FOR_DEVICE_CODE
    || code === FREE_CREDITS_THROTTLED_NETWORK_RISK_CODE
  ) {
    return true;
  }

  const message = typeof value.message === 'string' ? value.message.toLowerCase() : '';
  return FREE_CREDITS_BLOCKED_SIGNATURES.some((signature) => message.includes(signature));
}

export function getFreeCreditsBlockedMessage(): string {
  return 'Free credits have already been claimed from this device this month. Unfortunately, some people use multiple emails to claim extra free credits, which is not sustainable for a small business like Moodboard-Lab. Purchase credits to continue.';
}

export function getFreeCreditsNetworkRiskMessage(): string {
  return 'Free credits are temporarily limited for this network due to unusually high sign-up activity. Unfortunately, some people use multiple emails to claim extra free credits, which is not sustainable for a small business like Moodboard-Lab. Purchase credits to continue or try again later.';
}
