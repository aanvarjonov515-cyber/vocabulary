/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { AddVocabularyView } from './components/AddVocabularyView';
import { Header } from './components/Header';
import { LibraryView } from './components/LibraryView';
import { MemorizationView } from './components/MemorizationView';
import { StatsStrip } from './components/StatsStrip';
import {
  ActiveSessionState,
  AppSection,
  LearningStage,
  OriginalVocabSnapshot,
  UserMetaState,
  VocabRecord,
} from './types';
import {
  createDefaultMeta,
  createVocabRecord,
  loadInitialAppState,
  persistMetaState,
  persistVocabularyList,
} from './utils/db';
import {
  calculateUnlockedBadges,
  computeNextReviewTimestamp,
  getTodayDateString,
  isWordDueForReview,
} from './utils/gamification';

export default function App() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [vocabList, setVocabList] = useState<VocabRecord[]>([]);
  const [meta, setMeta] = useState<UserMetaState>(() => createDefaultMeta());

  const persistReadyRef = useRef(false);

  useEffect(() => {
    let active = true;
    loadInitialAppState().then(({ vocabulary, meta: loadedMeta }) => {
      if (!active) return;
      setVocabList(vocabulary);
      setMeta(loadedMeta);
      persistReadyRef.current = true;
      setIsLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!persistReadyRef.current) return;
    void persistVocabularyList(vocabList);
  }, [vocabList]);

  useEffect(() => {
    if (!persistReadyRef.current) return;
    void persistMetaState(meta);
  }, [meta]);

  const dueCount = useMemo(
    () => vocabList.filter((item) => isWordDueForReview(item)).length,
    [vocabList]
  );

  const recordDailyPractice = (
    prevMeta: UserMetaState,
    wordId: string,
    nextVocabList: VocabRecord[],
    xpToAdd: number
  ): UserMetaState => {
    const today = getTodayDateString();
    const prevIds =
      prevMeta.dailyProgress.date === today
        ? prevMeta.dailyProgress.practicedWordIds
        : [];
    const nextIds = prevIds.includes(wordId) ? prevIds : [...prevIds, wordId];
    const masteredCount = nextVocabList.filter((v) => v.mastered).length;
    const unlocked = Array.from(
      new Set([...prevMeta.unlockedBadges, ...calculateUnlockedBadges(masteredCount)])
    );

    return {
      ...prevMeta,
      xp: prevMeta.xp + xpToAdd,
      unlockedBadges: unlocked,
      dailyProgress: {
        date: today,
        practicedWordIds: nextIds,
      },
    };
  };

  const handleAddItems = (items: OriginalVocabSnapshot[]) => {
    const now = Date.now();
    const newRecords = items.map((item, idx) => createVocabRecord(item, now, idx));
    setVocabList((prev) => [...prev, ...newRecords]);
  };

  const handleUpdateItem = (id: string, updated: OriginalVocabSnapshot) => {
    setVocabList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updated } : item))
    );
  };

  const handleDeleteItem = (id: string) => {
    setVocabList((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setMeta((curr) => {
        if (!curr.activeSession) {
          return {
            ...curr,
            activeSection:
              next.length === 0 && curr.activeSection === 'memorize'
                ? 'add'
                : curr.activeSection,
          };
        }
        const remainingQueue = curr.activeSession.queueIds.filter((qId) => qId !== id);
        if (remainingQueue.length === 0) {
          return {
            ...curr,
            activeSection: next.length === 0 ? 'add' : curr.activeSection,
            activeSession: null,
          };
        }
        return {
          ...curr,
          activeSession: {
            ...curr.activeSession,
            queueIds: remainingQueue,
            currentQueueIndex: Math.min(
              curr.activeSession.currentQueueIndex,
              remainingQueue.length - 1
            ),
          },
        };
      });
      return next;
    });
  };

  const startLearn6Session = (queueIds: string[], resetStagesForWords = false) => {
    if (queueIds.length === 0) return;
    if (resetStagesForWords) {
      const queueSet = new Set(queueIds);
      setVocabList((prev) =>
        prev.map((item) =>
          queueSet.has(item.id)
            ? {
                ...item,
                currentStage: 1,
                hadHelpInCurrentCycle: false,
                xpClaimedInCurrentCycle: [],
              }
            : item
        )
      );
    }

    const session: ActiveSessionState = {
      mode: 'learn6',
      phase: 'words',
      queueIds,
      currentQueueIndex: 0,
      completedInSession: 0,
      sessionComplete: false,
    };

    setMeta((curr) => ({
      ...curr,
      activeSection: 'memorize',
      activeSession: session,
    }));
  };

  const startReviewSession = (queueIds: string[]) => {
    if (queueIds.length === 0) return;
    const session: ActiveSessionState = {
      mode: 'review',
      phase: 'practice',
      queueIds,
      currentQueueIndex: 0,
      completedInSession: 0,
      sessionComplete: false,
    };
    setMeta((curr) => ({
      ...curr,
      activeSection: 'memorize',
      activeSession: session,
    }));
  };

  const handleStartMemorization = (restart = false, explicitQueueIds?: string[]) => {
    if (vocabList.length === 0) return;

    if (!restart && !explicitQueueIds && meta.activeSession && !meta.activeSession.sessionComplete) {
      setMeta((curr) => ({ ...curr, activeSection: 'memorize' }));
      return;
    }

    if (explicitQueueIds && explicitQueueIds.length > 0) {
      startLearn6Session(explicitQueueIds, true);
      return;
    }

    // Prioritize unmastered or due words first, then remaining words
    const unmastered = vocabList.filter((v) => !v.mastered);
    const orderedIds =
      unmastered.length > 0
        ? unmastered.map((v) => v.id)
        : vocabList.map((v) => v.id);

    startLearn6Session(orderedIds, true);
  };

  const handleStartDueReview = () => {
    const dueIds = vocabList
      .filter((v) => isWordDueForReview(v))
      .map((v) => v.id);
    if (dueIds.length > 0) {
      startReviewSession(dueIds);
    } else if (vocabList.length > 0) {
      startReviewSession(vocabList.map((v) => v.id));
    }
  };

  const handleStartLearnSingleWord = (id: string) => {
    startLearn6Session([id], true);
  };

  const handleStartReviewSingleWord = (id: string) => {
    startReviewSession([id]);
  };

  const advanceSessionQueue = (
    prevMeta: UserMetaState,
    incrementCompleted: boolean
  ): UserMetaState => {
    const sess = prevMeta.activeSession;
    if (!sess) return prevMeta;
    const nextCompleted = incrementCompleted
      ? sess.completedInSession + 1
      : sess.completedInSession;
    const nextIdx = sess.currentQueueIndex + 1;
    if (nextIdx < sess.queueIds.length) {
      return {
        ...prevMeta,
        activeSession: {
          ...sess,
          currentQueueIndex: nextIdx,
          completedInSession: nextCompleted,
        },
      };
    }
    return {
      ...prevMeta,
      activeSession: {
        ...sess,
        phase: 'complete',
        completedInSession: nextCompleted,
        sessionComplete: true,
      },
    };
  };

  const handleAdvancePhase = (nextPhase: 'words' | 'examples' | 'practice') => {
    setMeta((curr) => {
      if (!curr.activeSession) return curr;
      return {
        ...curr,
        activeSession: {
          ...curr.activeSession,
          phase: nextPhase,
        },
      };
    });
  };

  const handleStage1Complete = (wordId: string, skipped: boolean) => {
    setVocabList((prev) =>
      prev.map((item) => {
        if (item.id !== wordId) return item;
        return {
          ...item,
          currentStage: 2,
          status: item.status === 'new' ? 'practiced' : item.status,
          skippedCount: skipped ? item.skippedCount + 1 : item.skippedCount,
          hadHelpInCurrentCycle: item.hadHelpInCurrentCycle || skipped,
        };
      })
    );
  };

  const handleRecordIncorrectAttempt = (wordId: string) => {
    setVocabList((prev) =>
      prev.map((item) =>
        item.id === wordId
          ? { ...item, incorrectAttempts: item.incorrectAttempts + 1 }
          : item
      )
    );
  };

  const handleRecordReveal = (wordId: string) => {
    setVocabList((prev) =>
      prev.map((item) =>
        item.id === wordId
          ? {
              ...item,
              revealedCount: item.revealedCount + 1,
              hadHelpInCurrentCycle: true,
            }
          : item
      )
    );
  };

  const handleStageExerciseComplete = (
    wordId: string,
    stage: 2 | 3 | 4 | 5 | 6,
    result: { independentSuccess: boolean; revealedOrSkipped: boolean }
  ) => {
    const now = Date.now();
    let xpEarned = 0;
    let finishedWordCycle = false;

    const nextVocab = vocabList.map((item) => {
      if (item.id !== wordId) return item;

      const hadHelp = item.hadHelpInCurrentCycle || result.revealedOrSkipped;
      const alreadyClaimedStage = item.xpClaimedInCurrentCycle.includes(stage);

      // Award +5 XP only for independent correct answer, never for mastered replays or repeated stage claims
      if (
        result.independentSuccess &&
        !result.revealedOrSkipped &&
        !alreadyClaimedStage &&
        !item.mastered
      ) {
        xpEarned += 5;
      }

      const nextClaimedStages =
        result.independentSuccess && !alreadyClaimedStage
          ? [...item.xpClaimedInCurrentCycle, stage]
          : item.xpClaimedInCurrentCycle;

      const nextCorrect = result.independentSuccess
        ? item.correctAttempts + 1
        : item.correctAttempts;
      const nextSkipped =
        result.revealedOrSkipped && !result.independentSuccess
          ? item.skippedCount + 1
          : item.skippedCount;

      if (stage < 6) {
        return {
          ...item,
          currentStage: (stage + 1) as LearningStage,
          status: item.mastered ? item.status : 'practiced',
          correctAttempts: nextCorrect,
          skippedCount: nextSkipped,
          xpClaimedInCurrentCycle: nextClaimedStages,
          hadHelpInCurrentCycle: hadHelp,
        };
      }

      // Stage 6 finished -> evaluate verified independent mastery!
      finishedWordCycle = true;
      const verifiedMastery = result.independentSuccess && !hadHelp;

      if (verifiedMastery) {
        if (!item.bonusClaimedForMastery) {
          xpEarned += 10;
        }
        const nextStep = Math.max(1, item.repetitionStep || 1);
        const nextReviewAt = computeNextReviewTimestamp(nextStep, now);
        return {
          ...item,
          currentStage: 1 as LearningStage,
          status: 'mastered' as const,
          mastered: true,
          correctAttempts: nextCorrect,
          skippedCount: nextSkipped,
          repetitionStep: nextStep,
          lastReviewedAt: now,
          nextReviewAt,
          xpClaimedInCurrentCycle: [],
          bonusClaimedForMastery: true,
          hadHelpInCurrentCycle: false,
          reviewHistory: [
            ...item.reviewHistory,
            {
              timestamp: now,
              mode: 'learn6' as const,
              outcome: 'mastered' as const,
              xpEarned,
            },
          ],
        };
      }

      // Skipped or revealed during 6-step run -> does NOT count as mastered; schedule retry sooner!
      return {
        ...item,
        currentStage: 1 as LearningStage,
        status: 'needs_review' as const,
        mastered: false,
        correctAttempts: nextCorrect,
        skippedCount: nextSkipped,
        repetitionStep: 0,
        lastReviewedAt: now,
        nextReviewAt: now,
        xpClaimedInCurrentCycle: [],
        hadHelpInCurrentCycle: false,
        reviewHistory: [
          ...item.reviewHistory,
          {
            timestamp: now,
            mode: 'learn6' as const,
            outcome: 'needs_review' as const,
            xpEarned,
          },
        ],
      };
    });

    setVocabList(nextVocab);

    setMeta((prevMeta) => {
      let updatedMeta = recordDailyPractice(prevMeta, wordId, nextVocab, xpEarned);
      if (finishedWordCycle) {
        updatedMeta = advanceSessionQueue(updatedMeta, true);
      }
      return updatedMeta;
    });
  };

  const handleSpacedReviewComplete = (
    wordId: string,
    result: { independentSuccess: boolean; revealedOrSkipped: boolean }
  ) => {
    const now = Date.now();
    let xpEarned = 0;

    const nextVocab = vocabList.map((item) => {
      if (item.id !== wordId) return item;

      const wasDue = isWordDueForReview(item, now);
      const independentWin = result.independentSuccess && !result.revealedOrSkipped;

      if (independentWin) {
        if (wasDue) {
          xpEarned = 10;
        }
        const nextStep = Math.min(5, Math.max(1, item.repetitionStep + 1));
        const nextReviewAt = computeNextReviewTimestamp(nextStep, now);
        return {
          ...item,
          status: 'mastered' as const,
          mastered: true,
          correctAttempts: item.correctAttempts + 1,
          repetitionStep: nextStep,
          lastReviewedAt: now,
          nextReviewAt,
          reviewHistory: [
            ...item.reviewHistory,
            {
              timestamp: now,
              mode: 'review' as const,
              outcome: 'mastered' as const,
              xpEarned,
            },
          ],
        };
      }

      // Skipped or revealed -> reset interval & appear again sooner
      return {
        ...item,
        status: 'needs_review' as const,
        mastered: false,
        skippedCount: item.skippedCount + 1,
        repetitionStep: 0,
        lastReviewedAt: now,
        nextReviewAt: now,
        reviewHistory: [
          ...item.reviewHistory,
          {
            timestamp: now,
            mode: 'review' as const,
            outcome: 'needs_review' as const,
            xpEarned: 0,
          },
        ],
      };
    });

    setVocabList(nextVocab);

    setMeta((prevMeta) => {
      const withXp = recordDailyPractice(prevMeta, wordId, nextVocab, xpEarned);
      return advanceSessionQueue(withXp, true);
    });
  };

  const handleSkipEntireWord = (wordId: string) => {
    setVocabList((prev) =>
      prev.map((item) =>
        item.id === wordId
          ? {
              ...item,
              currentStage: 1,
              skippedCount: item.skippedCount + 1,
              hadHelpInCurrentCycle: true,
              status: item.status === 'new' ? 'needs_review' : item.status,
              nextReviewAt: item.nextReviewAt ?? Date.now(),
            }
          : item
      )
    );
    setMeta((prevMeta) => advanceSessionQueue(prevMeta, false));
  };

  const handleSelectSection = (section: AppSection) => {
    if (section === 'memorize') {
      if (vocabList.length === 0) return;
      if (!meta.activeSession || meta.activeSession.sessionComplete) {
        handleStartMemorization(true);
        return;
      }
    }
    setMeta((curr) => ({ ...curr, activeSection: section }));
  };

  const handlePrimaryHeaderAction = () => {
    if (meta.activeSection === 'memorize') {
      setMeta((curr) => ({ ...curr, activeSection: 'add' }));
      return;
    }
    if (dueCount > 0) {
      handleStartDueReview();
    } else {
      handleStartMemorization(false);
    }
  };

  const handleRestoreBackup = (
    restoredVocab: VocabRecord[],
    restoredMeta: UserMetaState
  ) => {
    setVocabList(restoredVocab);
    setMeta({
      ...restoredMeta,
      activeSection: 'library',
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-sm font-medium text-slate-500">Yuklanmoqda...</p>
      </div>
    );
  }

  const hasActiveSession = Boolean(
    meta.activeSession &&
      !meta.activeSession.sessionComplete &&
      meta.activeSession.queueIds.length > 0
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header
        activeSection={meta.activeSection}
        vocabCount={vocabList.length}
        dueCount={dueCount}
        onSelectSection={handleSelectSection}
        onPrimaryAction={handlePrimaryHeaderAction}
      />

      <StatsStrip
        vocabList={vocabList}
        meta={meta}
        onChangeDailyTarget={(target) =>
          setMeta((curr) => ({ ...curr, dailyTarget: target }))
        }
      />

      <main className="flex-1">
        {meta.activeSection === 'add' && (
          <AddVocabularyView
            vocabList={vocabList}
            hasActiveSession={hasActiveSession}
            onAddItems={handleAddItems}
            onStartMemorization={handleStartMemorization}
            onStartDueReview={handleStartDueReview}
            onOpenLibrary={() => handleSelectSection('library')}
          />
        )}

        {meta.activeSection === 'memorize' && meta.activeSession && (
          <MemorizationView
            vocabList={vocabList}
            session={meta.activeSession}
            onAdvancePhase={handleAdvancePhase}
            onStage1Complete={handleStage1Complete}
            onStageExerciseComplete={handleStageExerciseComplete}
            onSpacedReviewComplete={handleSpacedReviewComplete}
            onRecordIncorrectAttempt={handleRecordIncorrectAttempt}
            onRecordReveal={handleRecordReveal}
            onSkipEntireWord={handleSkipEntireWord}
            onRestartSession={() => {
              if (meta.activeSession?.mode === 'review') {
                startReviewSession(meta.activeSession.queueIds);
              } else if (meta.activeSession) {
                startLearn6Session(meta.activeSession.queueIds, true);
              }
            }}
            onGoToLibrary={() => handleSelectSection('library')}
            onGoToAdd={() => handleSelectSection('add')}
          />
        )}

        {meta.activeSection === 'library' && (
          <LibraryView
            vocabList={vocabList}
            meta={meta}
            onUpdateRecord={handleUpdateItem}
            onDeleteRecord={handleDeleteItem}
            onStartLearnWord={handleStartLearnSingleWord}
            onStartReviewWord={handleStartReviewSingleWord}
            onStartDueReviewQueue={handleStartDueReview}
            onRestoreBackup={handleRestoreBackup}
          />
        )}
      </main>
    </div>
  );
}
