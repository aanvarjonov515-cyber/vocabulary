import { BadgeDefinition, VocabRecord, WordStatus } from '../types';

export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30] as const;

export const DAY_MS = 24 * 60 * 60 * 1000;

export const BADGE_TIERS: BadgeDefinition[] = [
  { id: 'boshlovchi', name: 'Boshlovchi', threshold: 10 },
  { id: 'bronza', name: 'Bronza', threshold: 50 },
  { id: 'kumush', name: 'Kumush', threshold: 100 },
  { id: 'oltin', name: 'Oltin', threshold: 300 },
  { id: 'olmos', name: 'Olmos', threshold: 500 },
  { id: 'usta', name: 'Usta', threshold: 1000 },
];

export function getTodayDateString(now = Date.now()): string {
  const d = new Date(now);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function getEffectiveWordStatus(record: VocabRecord, now = Date.now()): WordStatus {
  if (record.status === 'needs_review') return 'needs_review';
  if (record.mastered) {
    if (record.nextReviewAt !== null && record.nextReviewAt <= now) {
      return 'needs_review';
    }
    return 'mastered';
  }
  return record.status;
}

export function getStatusLabelUz(status: WordStatus): string {
  switch (status) {
    case 'mastered':
      return 'Yodlandi';
    case 'needs_review':
      return 'Takrorlash kerak';
    case 'practiced':
      return 'Mashq qilindi';
    case 'new':
    default:
      return 'Yangi';
  }
}

export function isWordDueForReview(record: VocabRecord, now = Date.now()): boolean {
  if (record.status === 'needs_review') return true;
  if (record.mastered && record.nextReviewAt !== null && record.nextReviewAt <= now) {
    return true;
  }
  return false;
}

export function computeNextReviewTimestamp(
  nextStep: number,
  now = Date.now()
): number {
  const clampedIdx = Math.min(
    Math.max(0, nextStep - 1),
    REVIEW_INTERVAL_DAYS.length - 1
  );
  const days = REVIEW_INTERVAL_DAYS[clampedIdx];
  return now + days * DAY_MS;
}

export function formatNextReviewUz(nextReviewAt: number | null, now = Date.now()): string {
  if (nextReviewAt === null) return 'Rejalashtirilmagan';
  const diffMs = nextReviewAt - now;
  if (diffMs <= 0) return 'Hozir takrorlash kerak';

  const diffHours = Math.ceil(diffMs / (60 * 60 * 1000));
  if (diffHours < 24) {
    return `${diffHours} soatdan keyin`;
  }
  const diffDays = Math.round(diffMs / DAY_MS);
  if (diffDays <= 1) return 'Ertaga';
  return `${diffDays} kundan keyin`;
}

export function calculateUnlockedBadges(masteredCount: number): string[] {
  return BADGE_TIERS.filter((b) => masteredCount >= b.threshold).map((b) => b.id);
}

export function getHighestBadge(masteredCount: number): BadgeDefinition | null {
  let highest: BadgeDefinition | null = null;
  for (const badge of BADGE_TIERS) {
    if (masteredCount >= badge.threshold) {
      highest = badge;
    }
  }
  return highest;
}

export function getNextBadge(masteredCount: number): BadgeDefinition | null {
  return BADGE_TIERS.find((b) => masteredCount < b.threshold) ?? null;
}
