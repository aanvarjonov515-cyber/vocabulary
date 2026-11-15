import { Award, Flame, Target } from 'lucide-react';
import { UserMetaState, VocabRecord } from '../types';
import {
  BADGE_TIERS,
  getHighestBadge,
  getNextBadge,
  getTodayDateString,
} from '../utils/gamification';

interface StatsStripProps {
  vocabList: VocabRecord[];
  meta: UserMetaState;
  onChangeDailyTarget: (target: number) => void;
}

export function StatsStrip({
  vocabList,
  meta,
  onChangeDailyTarget,
}: StatsStripProps) {
  const masteredCount = vocabList.filter((v) => v.mastered).length;
  const highestBadge = getHighestBadge(masteredCount);
  const nextBadge = getNextBadge(masteredCount);

  const today = getTodayDateString();
  const practicedToday =
    meta.dailyProgress.date === today ? meta.dailyProgress.practicedWordIds.length : 0;
  const dailyPct =
    meta.dailyTarget > 0
      ? Math.min(100, Math.round((practicedToday / meta.dailyTarget) * 100))
      : 0;

  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2.5 px-4 py-2.5 sm:px-6 text-xs sm:text-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          {/* XP */}
          <div className="inline-flex items-center gap-1.5 font-medium text-slate-800 tabular-nums">
            <Flame className="h-4 w-4 text-blue-600 shrink-0" aria-hidden="true" />
            <span>{meta.xp} XP</span>
          </div>

          <span className="text-slate-300" aria-hidden="true">
            ·
          </span>

          {/* Verified Mastery & Badge */}
          <div className="inline-flex items-center gap-1.5 text-slate-700 tabular-nums">
            <Award className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
            <span>
              Yodlandi: <strong className="font-semibold text-slate-900">{masteredCount}</strong>
            </span>
            {highestBadge ? (
              <span className="text-slate-500">
                ({highestBadge.name})
              </span>
            ) : nextBadge ? (
              <span className="hidden md:inline text-slate-400">
                · {nextBadge.name} uchun {nextBadge.threshold} ta
              </span>
            ) : null}
          </div>
        </div>

        {/* Optional Daily Target Progress */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-1.5 text-slate-600">
            <Target className="h-3.5 w-3.5 text-slate-400 shrink-0" aria-hidden="true" />
            <label htmlFor="daily-target-select" className="text-xs text-slate-500 whitespace-nowrap">
              Kunlik maqsad:
            </label>
            <select
              id="daily-target-select"
              value={meta.dailyTarget}
              onChange={(e) => onChangeDailyTarget(Number(e.target.value))}
              className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
            >
              <option value={0}>O‘chiq</option>
              <option value={5}>5 so‘z</option>
              <option value={10}>10 so‘z</option>
              <option value={15}>15 so‘z</option>
              <option value={20}>20 so‘z</option>
            </select>
          </div>

          {meta.dailyTarget > 0 && (
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 w-20 sm:w-24 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuenow={dailyPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Kunlik maqsad bajarilishi"
              >
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                  style={{ width: `${dailyPct}%` }}
                />
              </div>
              <span className="font-mono text-xs font-medium text-slate-700 tabular-nums whitespace-nowrap">
                {practicedToday}/{meta.dailyTarget}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Subtle achievement milestone summary only if user wants to see badge tiers? Keep compact inside library! */}
      <span className="sr-only">
        Darajalar: {BADGE_TIERS.map((b) => `${b.name} (${b.threshold})`).join(', ')}
      </span>
    </div>
  );
}
