import { useMemo } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, RotateCcw, SkipForward } from 'lucide-react';
import {
  ActiveSessionState,
  LearningStage,
  VocabRecord,
} from '../types';
import { splitSentenceWithHighlightedWord } from '../utils/parser';
import { SpacedReviewStage } from './stages/SpacedReviewStage';
import { Stage1Familiarize } from './stages/Stage1Familiarize';
import { Stage2Recall } from './stages/Stage2Recall';
import { Stage3WordTyping } from './stages/Stage3WordTyping';
import { Stage4ContextPractice } from './stages/Stage4ContextPractice';
import { Stage5LetterPractice } from './stages/Stage5LetterPractice';
import { Stage6FinalRecall } from './stages/Stage6FinalRecall';

interface MemorizationViewProps {
  vocabList: VocabRecord[];
  session: ActiveSessionState;
  onAdvancePhase: (nextPhase: 'words' | 'examples' | 'practice') => void;
  onStage1Complete: (wordId: string, skipped: boolean) => void;
  onStageExerciseComplete: (
    wordId: string,
    stage: 2 | 3 | 4 | 5 | 6,
    result: { independentSuccess: boolean; revealedOrSkipped: boolean }
  ) => void;
  onSpacedReviewComplete: (
    wordId: string,
    result: { independentSuccess: boolean; revealedOrSkipped: boolean }
  ) => void;
  onRecordIncorrectAttempt: (wordId: string) => void;
  onRecordReveal: (wordId: string) => void;
  onSkipEntireWord: (wordId: string) => void;
  onRestartSession: () => void;
  onGoToLibrary: () => void;
  onGoToAdd: () => void;
}

const STAGE_LABELS: Record<LearningStage, string> = {
  1: '1. Tanishish',
  2: '2. Xotirlash',
  3: '3. So‘z yozish',
  4: '4. Kontekst',
  5: '5. Harfma-harf',
  6: '6. Yakuniy',
};

export function MemorizationView({
  vocabList,
  session,
  onAdvancePhase,
  onStage1Complete,
  onStageExerciseComplete,
  onSpacedReviewComplete,
  onRecordIncorrectAttempt,
  onRecordReveal,
  onSkipEntireWord,
  onRestartSession,
  onGoToLibrary,
  onGoToAdd,
}: MemorizationViewProps) {
  const queueItems = useMemo(() => {
    const map = new Map(vocabList.map((v) => [v.id, v]));
    return session.queueIds
      .map((id) => map.get(id))
      .filter((v): v is VocabRecord => v !== undefined);
  }, [vocabList, session.queueIds]);

  if (session.sessionComplete || session.phase === 'complete') {
    return (
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 sm:p-10 text-center shadow-xs space-y-6">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              {session.mode === 'review'
                ? 'Takrorlash sessiyasi yakunlandi!'
                : 'Mashg‘ulot yakunlandi!'}
            </h1>
            <p className="text-base sm:text-lg font-medium text-slate-700 tabular-nums">
              Ushbu sessiyada{' '}
              <strong className="font-bold text-blue-700">
                {session.completedInSession}
              </strong>{' '}
              ta so‘z mashq qilindi
            </p>
            <p className="text-sm text-slate-500">
              Natijalaringiz, XP va takrorlash jadvallari saqlandi. Mustaqil bajarilmagan so‘zlar «Takrorlash kerak» bo‘limida qoladi.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onRestartSession}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Qaytadan boshlash</span>
            </button>

            <button
              type="button"
              onClick={onGoToLibrary}
              className="w-full sm:w-auto rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              Mening lug‘atim
            </button>

            <button
              type="button"
              onClick={onGoToAdd}
              className="w-full sm:w-auto rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              So‘z qo‘shish
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PHASE A — LEARN ALL WORDS
  if (session.mode === 'learn6' && session.phase === 'words') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-blue-700">
              1-qadam / 3 · Barcha so‘zlar bilan tanishish
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Barcha so‘zlarni o‘qib chiqing ({queueItems.length} ta)
            </h1>
            <p className="text-sm text-slate-600">
              Testlardan oldin barcha so‘zlar, talaffuz va tarjimalarni ko‘rib chiqing.
            </p>
          </div>

          <button
            type="button"
            onClick={() => onAdvancePhase('examples')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <span>Misollarni ko‘rish</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-200">
          {queueItems.map((item, idx) => (
            <div
              key={item.id}
              className="px-5 py-4 sm:px-6 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-slate-400 tabular-nums w-7 shrink-0">
                  {idx + 1}.
                </span>
                <span className="font-display text-lg font-bold text-slate-900 break-words">
                  {item.word}
                </span>
                {item.pronunciation && (
                  <span className="font-mono text-sm text-slate-500">
                    {item.pronunciation}
                  </span>
                )}
                {item.partOfSpeech && (
                  <span className="text-xs text-slate-400">{item.partOfSpeech}</span>
                )}
              </div>

              <div className="pl-7 sm:pl-0 text-sm sm:text-base sm:text-right">
                <span className="font-semibold text-slate-900 break-words">
                  {item.uzbekTranslation || '—'}
                </span>
                {item.russianTranslation && (
                  <span className="block sm:inline sm:ml-2 text-xs sm:text-sm text-slate-500 break-words">
                    ({item.russianTranslation})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={() => onAdvancePhase('examples')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm sm:text-base font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <span>Misollarni ko‘rish</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // PHASE B — LEARN EXAMPLES
  if (session.mode === 'learn6' && session.phase === 'examples') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-blue-700">
              2-qadam / 3 · Misol gaplar bilan tanishish
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
              Har bir so‘zning misol gapini ko‘rib chiqing ({queueItems.length} ta)
            </h1>
            <p className="text-sm text-slate-600">
              So‘zlarning gap ichida qo‘llanilishini o‘qing, so‘ng 6 bosqichli yodlashga o‘ting.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onAdvancePhase('words')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span>So‘zlar</span>
            </button>

            <button
              type="button"
              onClick={() => onAdvancePhase('practice')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span>Yodlashni boshlash</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-xs divide-y divide-slate-200">
          {queueItems.map((item, idx) => {
            const parts = item.exampleSentence
              ? splitSentenceWithHighlightedWord(item.exampleSentence, item.word)
              : [];

            return (
              <div key={item.id} className="px-5 py-5 sm:px-6 space-y-2">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="font-mono text-xs text-slate-400 tabular-nums">
                    {idx + 1}.
                  </span>
                  <span className="font-display text-base sm:text-lg font-bold text-slate-900">
                    {item.word}
                  </span>
                  <span className="text-slate-300" aria-hidden="true">
                    —
                  </span>
                  <span className="text-sm sm:text-base font-medium text-blue-700">
                    {item.uzbekTranslation || '—'}
                  </span>
                </div>

                {item.exampleSentence ? (
                  <p className="text-base sm:text-lg leading-relaxed text-slate-800 pl-6 break-words">
                    {parts.map((part, pIdx) =>
                      part.isTarget ? (
                        <strong
                          key={pIdx}
                          className="font-bold text-slate-950 underline decoration-blue-300 decoration-2 underline-offset-4"
                        >
                          {part.text}
                        </strong>
                      ) : (
                        <span key={pIdx}>{part.text}</span>
                      )
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-slate-400 italic pl-6">
                    Misol gap kiritilmagan
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={() => onAdvancePhase('words')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>So‘zlar ro‘yxatiga qaytish</span>
          </button>

          <button
            type="button"
            onClick={() => onAdvancePhase('practice')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm sm:text-base font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <span>Yodlashni boshlash</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // PHASE C — SIX MEMORIZATION STAGES (or Spaced Review)
  const currentWordId = session.queueIds[session.currentQueueIndex];
  const currentItem = vocabList.find((v) => v.id === currentWordId);

  if (!currentItem) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center space-y-4">
        <p className="text-base font-medium text-slate-700">
          Yodlash uchun so‘z topilmadi.
        </p>
        <button
          type="button"
          onClick={onGoToAdd}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          So‘z qo‘shishga o‘tish
        </button>
      </div>
    );
  }

  const totalWords = session.queueIds.length;
  const wordPos = session.currentQueueIndex + 1;

  if (session.mode === 'review') {
    const reviewPct = Math.round(((wordPos - 1) / Math.max(1, totalWords)) * 100);
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700 tabular-nums">
              <span>
                So‘z {wordPos}/{totalWords}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-blue-700">Interval takrorlash</span>
            </div>

            <button
              type="button"
              onClick={() => onSkipEntireWord(currentItem.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
            >
              <span>Keyingi so‘z</span>
              <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={reviewPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
              style={{ width: `${Math.max(4, reviewPct)}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <SpacedReviewStage
            key={`review-${currentItem.id}-${session.currentQueueIndex}`}
            item={currentItem}
            onAttemptIncorrect={() => onRecordIncorrectAttempt(currentItem.id)}
            onRevealAnswer={() => onRecordReveal(currentItem.id)}
            onComplete={(res) => onSpacedReviewComplete(currentItem.id, res)}
          />
        </div>
      </div>
    );
  }

  const stage = currentItem.currentStage;
  const totalSteps = totalWords * 6;
  const completedSteps = session.currentQueueIndex * 6 + (stage - 1);
  const progressPct = Math.round((completedSteps / Math.max(1, totalSteps)) * 100);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10 space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700 tabular-nums">
            <span>
              So‘z {wordPos}/{totalWords}
            </span>
            <span className="text-slate-300" aria-hidden="true">
              ·
            </span>
            <span className="text-blue-700">Bosqich {stage}/6</span>
          </div>

          <button
            type="button"
            onClick={() => onSkipEntireWord(currentItem.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs sm:text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <span>Keyingi so‘z</span>
            <SkipForward className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-blue-600 transition-[width] duration-300 ease-out"
            style={{ width: `${Math.max(4, progressPct)}%` }}
          />
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 pt-1">
          {([1, 2, 3, 4, 5, 6] as LearningStage[]).map((stageNum) => {
            const isActive = stageNum === stage;
            const isDone = stageNum < stage;
            return (
              <div
                key={stageNum}
                className={`border-b-2 pb-1.5 text-xs font-medium truncate transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-700'
                    : isDone
                      ? 'border-emerald-500 text-emerald-700'
                      : 'border-slate-200 text-slate-400'
                }`}
              >
                {STAGE_LABELS[stageNum]}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        {stage === 1 && (
          <Stage1Familiarize
            key={`${currentItem.id}-1`}
            item={currentItem}
            onContinue={() => onStage1Complete(currentItem.id, false)}
            onSkip={() => onStage1Complete(currentItem.id, true)}
          />
        )}
        {stage === 2 && (
          <Stage2Recall
            key={`${currentItem.id}-2`}
            item={currentItem}
            onComplete={(res) => onStageExerciseComplete(currentItem.id, 2, res)}
          />
        )}
        {stage === 3 && (
          <Stage3WordTyping
            key={`${currentItem.id}-3`}
            item={currentItem}
            onAttemptIncorrect={() => onRecordIncorrectAttempt(currentItem.id)}
            onRevealAnswer={() => onRecordReveal(currentItem.id)}
            onComplete={(res) => onStageExerciseComplete(currentItem.id, 3, res)}
          />
        )}
        {stage === 4 && (
          <Stage4ContextPractice
            key={`${currentItem.id}-4`}
            item={currentItem}
            onAttemptIncorrect={() => onRecordIncorrectAttempt(currentItem.id)}
            onRevealAnswer={() => onRecordReveal(currentItem.id)}
            onComplete={(res) => onStageExerciseComplete(currentItem.id, 4, res)}
          />
        )}
        {stage === 5 && (
          <Stage5LetterPractice
            key={`${currentItem.id}-5`}
            item={currentItem}
            onAttemptIncorrect={() => onRecordIncorrectAttempt(currentItem.id)}
            onRevealAnswer={() => onRecordReveal(currentItem.id)}
            onComplete={(res) => onStageExerciseComplete(currentItem.id, 5, res)}
          />
        )}
        {stage === 6 && (
          <Stage6FinalRecall
            key={`${currentItem.id}-6`}
            item={currentItem}
            hadHelpEarlier={currentItem.hadHelpInCurrentCycle}
            onAttemptIncorrect={() => onRecordIncorrectAttempt(currentItem.id)}
            onRevealAnswer={() => onRecordReveal(currentItem.id)}
            onComplete={(res) => onStageExerciseComplete(currentItem.id, 6, res)}
          />
        )}
      </div>
    </div>
  );
}
