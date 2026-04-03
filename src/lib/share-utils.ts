/**
 * Share link utilities — ensures all public share URLs use the custom domain
 * instead of the preview/lovable domain.
 */

export const SHARE_BASE_URL = 'https://portal.snaponbraces.in';

export function getShareUrl(path: string, token: string): string {
  return `${SHARE_BASE_URL}/${path}/${token}`;
}
