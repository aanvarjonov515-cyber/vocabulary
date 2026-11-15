import {
  AppSection,
  LearningStage,
  MemorizePhase,
  OriginalVocabSnapshot,
  ReviewHistoryEntry,
  UserMetaState,
  VocabRecord,
  WordMemBackupV2,
  WordStatus,
} from '../types';
import { calculateUnlockedBadges, getTodayDateString } from './gamification';

const DB_NAME = 'wordmem_db';
const DB_VERSION = 1;
const STORE_VOCAB = 'vocabulary';
const STORE_META = 'meta';
const META_KEY = 'profile_v2';

// Legacy v1 LocalStorage keys for safe migration
const V1_VOCAB_KEY = 'wordmem_vocabulary_v1';
const V1_PROGRESS_KEY = 'wordmem_progress_v1';

// Fallback LocalStorage keys if IndexedDB is unavailable in restricted contexts
const V2_FALLBACK_VOCAB_KEY = 'wordmem_v2_vocab_fallback';
const V2_FALLBACK_META_KEY = 'wordmem_v2_meta_fallback';

export function createDefaultMeta(now = Date.now()): UserMetaState {
  return {
    schemaVersion: 2,
    xp: 0,
    unlockedBadges: [],
    dailyTarget: 10,
    dailyProgress: {
      date: getTodayDateString(now),
      practicedWordIds: [],
    },
    activeSection: 'add',
    activeSession: null,
    migratedFromV1: false,
  };
}

export function createVocabRecord(
  input: OriginalVocabSnapshot,
  now = Date.now(),
  indexOffset = 0
): VocabRecord {
  const snapshot: OriginalVocabSnapshot = {
    word: input.word.trim(),
    partOfSpeech: input.partOfSpeech.trim(),
    pronunciation: input.pronunciation.trim(),
    exampleSentence: input.exampleSentence.trim(),
    russianTranslation: input.russianTranslation.trim(),
    uzbekTranslation: input.uzbekTranslation.trim(),
  };

  return {
    id: `vocab-${now}-${indexOffset}-${Math.random().toString(36).slice(2, 7)}`,
    ...snapshot,
    createdAt: now + indexOffset,
    originalEntry: { ...snapshot },
    currentStage: 1,
    status: 'new',
    mastered: false,
    correctAttempts: 0,
    incorrectAttempts: 0,
    skippedCount: 0,
    revealedCount: 0,
    repetitionStep: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    xpClaimedInCurrentCycle: [],
    bonusClaimedForMastery: false,
    hadHelpInCurrentCycle: false,
    reviewHistory: [],
  };
}

function sanitizeVocabRecord(raw: Partial<VocabRecord>, index = 0): VocabRecord | null {
  if (!raw || typeof raw.word !== 'string' || !raw.word.trim()) return null;

  const snapshot: OriginalVocabSnapshot = raw.originalEntry && typeof raw.originalEntry.word === 'string'
    ? {
        word: String(raw.originalEntry.word || raw.word),
        partOfSpeech: String(raw.originalEntry.partOfSpeech ?? raw.partOfSpeech ?? ''),
        pronunciation: String(raw.originalEntry.pronunciation ?? raw.pronunciation ?? ''),
        exampleSentence: String(raw.originalEntry.exampleSentence ?? raw.exampleSentence ?? ''),
        russianTranslation: String(raw.originalEntry.russianTranslation ?? raw.russianTranslation ?? ''),
        uzbekTranslation: String(raw.originalEntry.uzbekTranslation ?? raw.uzbekTranslation ?? ''),
      }
    : {
        word: String(raw.word),
        partOfSpeech: String(raw.partOfSpeech || ''),
        pronunciation: String(raw.pronunciation || ''),
        exampleSentence: String(raw.exampleSentence || ''),
        russianTranslation: String(raw.russianTranslation || ''),
        uzbekTranslation: String(raw.uzbekTranslation || ''),
      };

  const validStages: LearningStage[] = [1, 2, 3, 4, 5, 6];
  const stage: LearningStage = validStages.includes(raw.currentStage as LearningStage)
    ? (raw.currentStage as LearningStage)
    : 1;

  const validStatuses: WordStatus[] = ['new', 'practiced', 'mastered', 'needs_review'];
  const status: WordStatus = validStatuses.includes(raw.status as WordStatus)
    ? (raw.status as WordStatus)
    : raw.mastered
      ? 'mastered'
      : 'new';

  const history: ReviewHistoryEntry[] = Array.isArray(raw.reviewHistory)
    ? raw.reviewHistory.filter(
        (h): h is ReviewHistoryEntry =>
          Boolean(h && typeof h.timestamp === 'number' && typeof h.outcome === 'string')
      )
    : [];

  return {
    id: String(raw.id || `vocab-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`),
    word: String(raw.word),
    partOfSpeech: String(raw.partOfSpeech || ''),
    pronunciation: String(raw.pronunciation || ''),
    exampleSentence: String(raw.exampleSentence || ''),
    russianTranslation: String(raw.russianTranslation || ''),
    uzbekTranslation: String(raw.uzbekTranslation || ''),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now() + index,
    originalEntry: snapshot,
    currentStage: stage,
    status,
    mastered: Boolean(raw.mastered),
    correctAttempts: typeof raw.correctAttempts === 'number' ? Math.max(0, raw.correctAttempts) : 0,
    incorrectAttempts: typeof raw.incorrectAttempts === 'number' ? Math.max(0, raw.incorrectAttempts) : 0,
    skippedCount: typeof raw.skippedCount === 'number' ? Math.max(0, raw.skippedCount) : 0,
    revealedCount: typeof raw.revealedCount === 'number' ? Math.max(0, raw.revealedCount) : 0,
    repetitionStep: typeof raw.repetitionStep === 'number' ? Math.max(0, raw.repetitionStep) : 0,
    lastReviewedAt: typeof raw.lastReviewedAt === 'number' ? raw.lastReviewedAt : null,
    nextReviewAt: typeof raw.nextReviewAt === 'number' ? raw.nextReviewAt : null,
    xpClaimedInCurrentCycle: Array.isArray(raw.xpClaimedInCurrentCycle)
      ? raw.xpClaimedInCurrentCycle.filter((n): n is number => typeof n === 'number')
      : [],
    bonusClaimedForMastery: Boolean(raw.bonusClaimedForMastery),
    hadHelpInCurrentCycle: Boolean(raw.hadHelpInCurrentCycle),
    reviewHistory: history,
  };
}

function sanitizeMeta(raw: Partial<UserMetaState> | null | undefined, vocab: VocabRecord[]): UserMetaState {
  const today = getTodayDateString();
  const base = createDefaultMeta();
  if (!raw) return base;

  const masteredCount = vocab.filter((v) => v.mastered).length;
  const computedBadges = calculateUnlockedBadges(masteredCount);

  const validSections: AppSection[] = ['add', 'memorize', 'library'];
  const activeSection: AppSection = validSections.includes(raw.activeSection as AppSection)
    ? (raw.activeSection as AppSection)
    : 'add';

  const dailyProgress =
    raw.dailyProgress && raw.dailyProgress.date === today && Array.isArray(raw.dailyProgress.practicedWordIds)
      ? {
          date: today,
          practicedWordIds: raw.dailyProgress.practicedWordIds.filter((id): id is string => typeof id === 'string'),
        }
      : { date: today, practicedWordIds: [] };

  let activeSession = raw.activeSession ?? null;
  if (activeSession) {
    const validIds = new Set(vocab.map((v) => v.id));
    const filteredQueue = Array.isArray(activeSession.queueIds)
      ? activeSession.queueIds.filter((id) => validIds.has(id))
      : [];
    if (filteredQueue.length === 0 && !activeSession.sessionComplete) {
      activeSession = null;
    } else {
      const validPhases: MemorizePhase[] = ['words', 'examples', 'practice', 'complete'];
      const rawPhase = activeSession.phase;
      const phase: MemorizePhase = validPhases.includes(rawPhase as MemorizePhase)
        ? (rawPhase as MemorizePhase)
        : activeSession.sessionComplete
          ? 'complete'
          : 'practice';
      activeSession = {
        mode: activeSession.mode === 'review' ? 'review' : 'learn6',
        phase,
        queueIds: filteredQueue,
        currentQueueIndex: Math.min(
          Math.max(0, activeSession.currentQueueIndex || 0),
          Math.max(0, filteredQueue.length - 1)
        ),
        completedInSession: Math.max(0, activeSession.completedInSession || 0),
        sessionComplete: Boolean(activeSession.sessionComplete),
      };
    }
  }

  return {
    schemaVersion: 2,
    xp: typeof raw.xp === 'number' ? Math.max(0, raw.xp) : 0,
    unlockedBadges: Array.from(new Set([...(Array.isArray(raw.unlockedBadges) ? raw.unlockedBadges : []), ...computedBadges])),
    dailyTarget: typeof raw.dailyTarget === 'number' ? Math.max(0, raw.dailyTarget) : 10,
    dailyProgress,
    activeSection: vocab.length === 0 && activeSection === 'memorize' ? 'add' : activeSection,
    activeSession,
    migratedFromV1: Boolean(raw.migratedFromV1),
  };
}

function openDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      resolve(null);
      return;
    }
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_VOCAB)) {
          db.createObjectStore(STORE_VOCAB, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbGetAllVocab(db: IDBDatabase): Promise<VocabRecord[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_VOCAB, 'readonly');
      const store = tx.objectStore(STORE_VOCAB);
      const req = store.getAll();
      req.onsuccess = () => {
        const list = Array.isArray(req.result)
          ? req.result
              .map((item, idx) => sanitizeVocabRecord(item, idx))
              .filter((x): x is VocabRecord => x !== null)
          : [];
        list.sort((a, b) => a.createdAt - b.createdAt);
        resolve(list);
      };
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

function idbGetMeta(db: IDBDatabase): Promise<Partial<UserMetaState> | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_META, 'readonly');
      const store = tx.objectStore(STORE_META);
      const req = store.get(META_KEY);
      req.onsuccess = () => resolve((req.result as Partial<UserMetaState>) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function idbPutAllVocab(db: IDBDatabase, items: VocabRecord[]): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_VOCAB, 'readwrite');
      const store = tx.objectStore(STORE_VOCAB);
      store.clear();
      for (const item of items) {
        store.put(item);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function idbPutMeta(db: IDBDatabase, meta: UserMetaState): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_META, 'readwrite');
      const store = tx.objectStore(STORE_META);
      store.put(meta, META_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function readLegacyV1FromLocalStorage(): {
  v1Vocab: VocabRecord[];
  v1Section: AppSection;
  v1WordIndex: number;
  v1Stage: LearningStage;
} {
  try {
    const rawVocab = window.localStorage.getItem(V1_VOCAB_KEY);
    const parsedVocab = rawVocab ? JSON.parse(rawVocab) : [];
    const v1Vocab: VocabRecord[] = Array.isArray(parsedVocab)
      ? parsedVocab
          .map((item, idx) => {
            if (!item || typeof item.word !== 'string' || !item.word.trim()) return null;
            const rec = createVocabRecord(
              {
                word: String(item.word),
                partOfSpeech: String(item.partOfSpeech || ''),
                pronunciation: String(item.pronunciation || ''),
                exampleSentence: String(item.exampleSentence || ''),
                russianTranslation: String(item.russianTranslation || ''),
                uzbekTranslation: String(item.uzbekTranslation || ''),
              },
              typeof item.createdAt === 'number' ? item.createdAt : Date.now(),
              idx
            );
            if (item.id) rec.id = String(item.id);
            return rec;
          })
          .filter((r): r is VocabRecord => r !== null)
      : [];

    const rawProg = window.localStorage.getItem(V1_PROGRESS_KEY);
    const prog = rawProg ? JSON.parse(rawProg) : null;
    const v1Section: AppSection =
      prog?.view === 'memorize' && v1Vocab.length > 0 ? 'memorize' : 'add';
    const v1WordIndex =
      typeof prog?.currentWordIndex === 'number' && v1Vocab.length > 0
        ? Math.min(Math.max(0, prog.currentWordIndex), v1Vocab.length - 1)
        : 0;
    const stageRaw = Number(prog?.currentStage);
    const v1Stage: LearningStage =
      stageRaw >= 1 && stageRaw <= 6 ? (stageRaw as LearningStage) : 1;

    return { v1Vocab, v1Section, v1WordIndex, v1Stage };
  } catch {
    return { v1Vocab: [], v1Section: 'add', v1WordIndex: 0, v1Stage: 1 };
  }
}

export async function loadInitialAppState(): Promise<{
  vocabulary: VocabRecord[];
  meta: UserMetaState;
}> {
  const db = await openDatabase();
  let vocab: VocabRecord[] = [];
  let rawMeta: Partial<UserMetaState> | null = null;

  if (db) {
    vocab = await idbGetAllVocab(db);
    rawMeta = await idbGetMeta(db);
    db.close();
  } else {
    try {
      const fbVocabRaw = window.localStorage.getItem(V2_FALLBACK_VOCAB_KEY);
      const fbMetaRaw = window.localStorage.getItem(V2_FALLBACK_META_KEY);
      if (fbVocabRaw) {
        const parsed = JSON.parse(fbVocabRaw);
        if (Array.isArray(parsed)) {
          vocab = parsed
            .map((item, idx) => sanitizeVocabRecord(item, idx))
            .filter((x): x is VocabRecord => x !== null);
        }
      }
      if (fbMetaRaw) {
        rawMeta = JSON.parse(fbMetaRaw) as Partial<UserMetaState>;
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Safe non-destructive migration from WordMem v1 LocalStorage if not yet migrated
  if (!rawMeta?.migratedFromV1) {
    const { v1Vocab, v1Section, v1WordIndex, v1Stage } = readLegacyV1FromLocalStorage();
    if (v1Vocab.length > 0) {
      // Back up pre-migration state safely before migrating
      try {
        window.localStorage.setItem(
          'wordmem_pre_migration_backup_v2',
          JSON.stringify({
            backedUpAt: Date.now(),
            legacyV1: window.localStorage.getItem(V1_VOCAB_KEY),
            legacyProgress: window.localStorage.getItem(V1_PROGRESS_KEY),
            existingV2Vocab: vocab,
            existingV2Meta: rawMeta,
          })
        );
      } catch {
        // Ignore quota limits for backup snapshot
      }

      const existingWords = new Set(vocab.map((v) => v.word.trim().toLowerCase()));
      const merged = [...vocab];
      for (const legacyItem of v1Vocab) {
        if (!existingWords.has(legacyItem.word.trim().toLowerCase())) {
          merged.push(legacyItem);
          existingWords.add(legacyItem.word.trim().toLowerCase());
        }
      }

      // Preserve stage of the active legacy word
      if (v1Vocab[v1WordIndex]) {
        const activeId = v1Vocab[v1WordIndex].id;
        const target = merged.find((m) => m.id === activeId);
        if (target) {
          target.currentStage = v1Stage;
          if (v1Stage > 1) target.status = 'practiced';
        }
      }

      vocab = merged;
      const migratedMeta = sanitizeMeta(
        {
          ...(rawMeta || {}),
          migratedFromV1: true,
          activeSection: v1Section,
          activeSession:
            v1Section === 'memorize'
              ? {
                  mode: 'learn6',
                  phase: 'practice',
                  queueIds: vocab.map((v) => v.id),
                  currentQueueIndex: v1WordIndex,
                  completedInSession: 0,
                  sessionComplete: false,
                }
              : null,
        },
        vocab
      );

      await persistFullAppState(vocab, migratedMeta);
      return { vocabulary: vocab, meta: migratedMeta };
    } else {
      const cleanMeta = sanitizeMeta({ ...(rawMeta || {}), migratedFromV1: true }, vocab);
      await persistMetaState(cleanMeta);
      return { vocabulary: vocab, meta: cleanMeta };
    }
  }

  const finalMeta = sanitizeMeta(rawMeta, vocab);
  return { vocabulary: vocab, meta: finalMeta };
}

export async function persistVocabularyList(items: VocabRecord[]): Promise<void> {
  try {
    window.localStorage.setItem(V2_FALLBACK_VOCAB_KEY, JSON.stringify(items));
  } catch {
    // Ignore fallback quota error
  }
  const db = await openDatabase();
  if (db) {
    await idbPutAllVocab(db, items);
    db.close();
  }
}

export async function persistMetaState(meta: UserMetaState): Promise<void> {
  try {
    window.localStorage.setItem(V2_FALLBACK_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignore fallback quota error
  }
  const db = await openDatabase();
  if (db) {
    await idbPutMeta(db, meta);
    db.close();
  }
}

export async function persistFullAppState(
  vocabulary: VocabRecord[],
  meta: UserMetaState
): Promise<void> {
  await Promise.all([persistVocabularyList(vocabulary), persistMetaState(meta)]);
}

export function createBackupPayload(
  vocabulary: VocabRecord[],
  meta: UserMetaState
): WordMemBackupV2 {
  return {
    app: 'WordMem',
    schemaVersion: 2,
    exportedAt: Date.now(),
    vocabulary,
    meta,
  };
}

export function parseAndValidateBackupJson(jsonString: string): {
  ok: true;
  vocabulary: VocabRecord[];
  meta: UserMetaState;
} | {
  ok: false;
  error: string;
} {
  try {
    const parsed = JSON.parse(jsonString) as Partial<WordMemBackupV2>;
    if (!parsed || typeof parsed !== 'object') {
      return { ok: false, error: 'JSON fayl tuzilishi noto‘g‘ri.' };
    }
    if (!Array.isArray(parsed.vocabulary)) {
      return { ok: false, error: 'Zaxira faylda so‘zlar ro‘yxati topilmadi.' };
    }

    const sanitizedVocab = parsed.vocabulary
      .map((item, idx) => sanitizeVocabRecord(item, idx))
      .filter((x): x is VocabRecord => x !== null);

    if (parsed.vocabulary.length > 0 && sanitizedVocab.length === 0) {
      return { ok: false, error: 'Zaxira fayldagi so‘z yozuvlari yaroqsiz.' };
    }

    const sanitizedMeta = sanitizeMeta(
      { ...(parsed.meta || {}), migratedFromV1: true },
      sanitizedVocab
    );

    return {
      ok: true,
      vocabulary: sanitizedVocab,
      meta: sanitizedMeta,
    };
  } catch {
    return { ok: false, error: 'JSON faylni o‘qib bo‘lmadi. Iltimos, yaroqli zaxira fayl tanlang.' };
  }
}
