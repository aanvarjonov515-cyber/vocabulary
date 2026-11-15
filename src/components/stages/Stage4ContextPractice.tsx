import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Eye } from 'lucide-react';
import { VocabRecord } from '../../types';
import {
  maskTargetWordInSentence,
  normalizeComparisonChars,
} from '../../utils/parser';

interface Stage4ContextPracticeProps {
  item: VocabRecord;
  onAttemptIncorrect: () => void;
  onRevealAnswer: () => void;
  onComplete: (result: { independentSuccess: boolean; revealedOrSkipped: boolean }) => void;
}

export function Stage4ContextPractice({
  item,
  onAttemptIncorrect,
  onRevealAnswer,
  onComplete,
}: Stage4ContextPracticeProps) {
  const masked = useMemo(
    () => maskTargetWordInSentence(item.exampleSentence || '', item.word),
    [item.exampleSentence, item.word]
  );

  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [wasRevealed, setWasRevealed] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [item.id]);

  useEffect(() => {
    if (status === 'correct') {
      nextBtnRef.current?.focus();
    }
  }, [status]);

  const acceptedAnswers = useMemo(() => {
    const set = new Set<string>();
    const base = normalizeComparisonChars(item.word).trim().toLowerCase();
    if (base) set.add(base);
    if (masked.found) {
      for (const p of masked.parts) {
        if (p.isBlank) {
          set.add(normalizeComparisonChars(p.answer).trim().toLowerCase());
        }
      }
    }
    return set;
  }, [item.word, masked]);

  const handleReveal = () => {
    if (!wasRevealed) {
      setWasRevealed(true);
      onRevealAnswer();
    }
    inputRef.current?.focus();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (status === 'correct') {
      onComplete({
        independentSuccess: !wasRevealed,
        revealedOrSkipped: wasRevealed,
      });
      return;
    }

    const typed = normalizeComparisonChars(answer).trim().toLowerCase();
    if (typed.length > 0 && acceptedAnswers.has(typed)) {
      setStatus('correct');
    } else {
      setStatus('wrong');
      setShakeKey((k) => k + 1);
      onAttemptIncorrect();
      inputRef.current?.focus();
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">
          4-bosqich · Kontekstda qo‘llash — gapdagi tushirib qoldirilgan so‘zni yozing
        </p>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
          Gapni mos so‘z bilan to‘ldiring
        </h2>
        <p className="text-sm text-slate-600 pt-1">
          O‘zbekcha ma’nosi:{' '}
          <strong className="font-semibold text-slate-900">
            {item.uzbekTranslation || '—'}
          </strong>
        </p>
      </div>

      {/* Masked sentence context box */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
        {masked.found ? (
          <p className="text-lg sm:text-xl leading-relaxed text-slate-800 break-words">
            {masked.parts.map((part, idx) => {
              if (!part.isBlank) {
                return <span key={idx}>{part.text}</span>;
              }
              if (status === 'correct') {
                return (
                  <strong
                    key={idx}
                    className="mx-0.5 inline-block rounded bg-emerald-100 px-2 py-0.5 font-bold text-emerald-900"
                  >
                    {part.answer}
                  </strong>
                );
              }
              return (
                <span
                  key={idx}
                  className="mx-1 inline-block min-w-[6.5rem] border-b-2 border-blue-600 px-2 text-center font-mono text-sm font-medium text-blue-700"
                >
                  ______
                </span>
              );
            })}
          </p>
        ) : (
          <div className="space-y-1">
            <p className="text-sm text-slate-600">
              {item.exampleSentence
                ? 'Ushbu misol gapda asosiy so‘z shakli farq qilgani uchun tarjima bo‘yicha so‘zni kiriting:'
                : 'Misol gap kiritilmagan. Tarjima bo‘yicha so‘zni kiriting:'}
            </p>
            {item.russianTranslation && (
              <p className="text-sm text-slate-500">
                Ruscha: <span className="font-medium text-slate-700">{item.russianTranslation}</span>
              </p>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="stage4-context-input" className="sr-only">
            Gapdagi yetishmayotgan so‘zni yozing
          </label>
          <input
            key={shakeKey}
            ref={inputRef}
            id="stage4-context-input"
            type="text"
            value={answer}
            disabled={status === 'correct'}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (status === 'wrong') setStatus('idle');
            }}
            placeholder="Tushirib qoldirilgan so‘zni yozing..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className={`w-full rounded-lg border px-4 py-3.5 text-lg font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
              status === 'correct'
                ? 'border-emerald-500 bg-emerald-50/60 focus:ring-emerald-500'
                : status === 'wrong'
                  ? 'animate-gentle-shake border-red-400 bg-red-50/40 focus:ring-red-500'
                  : 'border-slate-300 bg-white focus:border-blue-600 focus:ring-blue-600/20'
            }`}
          />
        </div>

        {status === 'correct' && (
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-700" role="status">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {wasRevealed
                ? 'To‘g‘ri! (Javob ko‘rilgani sababli 0 XP)'
                : 'To‘g‘ri! (+5 XP)'}
            </span>
          </div>
        )}

        {status === 'wrong' && (
          <div className="flex items-center gap-2 text-sm font-medium text-red-700" role="status">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Qayta urinib ko‘ring</span>
          </div>
        )}

        {wasRevealed && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            <span className="text-slate-500">To‘g‘ri javob: </span>
            <strong className="font-semibold text-slate-900">{item.word}</strong>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleReveal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Eye className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>Javobni ko‘rish</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onComplete({ independentSuccess: false, revealedOrSkipped: true })
              }
              className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              O‘tkazib yuborish
            </button>
          </div>

          {status === 'correct' ? (
            <button
              ref={nextBtnRef}
              type="button"
              onClick={() =>
                onComplete({
                  independentSuccess: !wasRevealed,
                  revealedOrSkipped: wasRevealed,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span>Davom etish</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              Tekshirish
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
