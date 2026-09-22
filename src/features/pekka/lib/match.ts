import type { PekkaMatch } from '@/src/api/pekka';

/** Below this, a match is a guess; Pekka says it couldn't find the name instead. */
export const MIN_MATCH_SCORE = 0.6;

export function pickMatch(matches: PekkaMatch[] | undefined): PekkaMatch | null {
  const top = matches?.[0];
  return top && Number(top.score) >= MIN_MATCH_SCORE ? top : null;
}
