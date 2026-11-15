export type AppSection = 'add' | 'memorize' | 'library';

export type LearningStage = 1 | 2 | 3 | 4 | 5 | 6;

export type WordStatus = 'new' | 'practiced' | 'mastered' | 'needs_review';

export type MemorizeMode = 'learn6' | 'review';

export type MemorizePhase = 'words' | 'examples' | 'practice' | 'complete';

export interface OriginalVocabSnapshot {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  exampleSentence: string;
  russianTranslation: string;
  uzbekTranslation: string;
}

export interface ReviewHistoryEntry {
  timestamp: number;
  mode: MemorizeMode;
  outcome: 'mastered' | 'practiced' | 'needs_review';
  xpEarned: number;
}

export interface VocabRecord {
  id: string;
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  exampleSentence: string;
  russianTranslation: string;
  uzbekTranslation: string;
  createdAt: number;
  originalEntry: OriginalVocabSnapshot;

  // Learning & Spaced Repetition state
  currentStage: LearningStage;
  status: WordStatus;
  mastered: boolean;
  correctAttempts: number;
  incorrectAttempts: number;
  skippedCount: number;
  revealedCount: number;
  repetitionStep: number; // 0 = unscheduled/reset, 1=1d, 2=3d, 3=7d, 4=14d, 5=30d
  lastReviewedAt: number | null;
  nextReviewAt: number | null;
  xpClaimedInCurrentCycle: number[]; // Stage numbers (2..6) already awarded XP in this cycle
  bonusClaimedForMastery: boolean;
  hadHelpInCurrentCycle: boolean; // True if any stage in current 6-step run was skipped/revealed/failed
  reviewHistory: ReviewHistoryEntry[];
}

export interface ParsedVocabDraft {
  tempId: string;
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  exampleSentence: string;
  russianTranslation: string;
  uzbekTranslation: string;
  warnings: string[];
  correctionReasons: string[];
  needsCorrection: boolean;
  confirmedByUser: boolean;
  isDuplicate: boolean;
  importMode: 'structured' | 'unstructured';
}

export interface BadgeDefinition {
  id: string;
  name: string;
  threshold: number;
}

export interface DailyProgress {
  date: string; // YYYY-MM-DD
  practicedWordIds: string[];
}

export interface ActiveSessionState {
  mode: MemorizeMode;
  phase: MemorizePhase;
  queueIds: string[];
  currentQueueIndex: number;
  completedInSession: number;
  sessionComplete: boolean;
}

export interface UserMetaState {
  schemaVersion: number;
  xp: number;
  unlockedBadges: string[];
  dailyTarget: number; // 0 = disabled, otherwise e.g. 5, 10, 15, 20
  dailyProgress: DailyProgress;
  activeSection: AppSection;
  activeSession: ActiveSessionState | null;
  migratedFromV1: boolean;
}

export interface WordMemBackupV2 {
  app: 'WordMem';
  schemaVersion: 2;
  exportedAt: number;
  vocabulary: VocabRecord[];
  meta: UserMetaState;
}
