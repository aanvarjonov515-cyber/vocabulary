import { FormEvent, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Eye } from 'lucide-react';
import { VocabRecord } from '../../types';
import { normalizeComparisonChars } from '../../utils/parser';

interface Stage6FinalRecallProps {
  item: VocabRecord;
  hadHelpEarlier: boolean;
  onAttemptIncorrect: () => void;
  onRevealAnswer: () => void;
  onComplete: (result: { independentSuccess: boolean; revealedOrSkipped: boolean }) => void;
}

export function Stage6FinalRecall({
  item,
  hadHelpEarlier,
  onAttemptIncorrect,
  onRevealAnswer,
  onComplete,
}: Stage6FinalRecallProps) {
  const [answer, setAnswer] = useState('');
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [wasRevealed, setWasRevealed] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const finishBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [item.id]);

  useEffect(() => {
    if (status === 'correct') {
      finishBtnRef.current?.focus();
    }
  }, [status]);

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

    const expected = normalizeComparisonChars(item.word).trim().toLowerCase();
    const typed = normalizeComparisonChars(answer).trim().toLowerCase();

    if (typed.length > 0 && typed === expected) {
      setStatus('correct');
    } else {
      setStatus('wrong');
      setShakeKey((k) => k + 1);
      onAttemptIncorrect();
      inputRef.current?.focus();
    }
  };

  const willMaster = !wasRevealed && !hadHelpEarlier;

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">
          6-bosqich · Yakuniy tekshiruv — yordamsiz mustaqil yozing
        </p>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
          So‘zni mustaqil ravishda yozing
        </h2>
      </div>

      {/* Zero English hints — Uzbek & Russian translations only */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-200 pt-6">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">O‘zbekcha tarjimasi</p>
          <p className="text-xl sm:text-2xl font-semibold text-slate-900 break-words">
            {item.uzbekTranslation || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">Ruscha tarjimasi</p>
          <p className="text-xl sm:text-2xl font-medium text-slate-700 break-words">
            {item.russianTranslation || '—'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="stage6-final-input" className="sr-only">
            Inglizcha so‘zni mustaqil yozing
          </label>
          <input
            key={shakeKey}
            ref={inputRef}
            id="stage6-final-input"
            type="text"
            value={answer}
            disabled={status === 'correct'}
            onChange={(e) => {
              setAnswer(e.target.value);
              if (status === 'wrong') setStatus('idle');
            }}
            placeholder="Inglizcha so‘zni yozing..."
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
          <div className="flex items-start gap-2 text-sm font-medium text-emerald-700" role="status">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {willMaster
                ? 'Ajoyib! So‘z mustaqil yodlandi (+5 XP va +10 bonus XP). Keyingi takrorlash ertaga rejalashtiriladi.'
                : wasRevealed
                  ? 'To‘g‘ri! Javob ko‘rilgani uchun so‘z «Takrorlash kerak» holatida qoladi.'
                  : 'To‘g‘ri! Oldingi bosqichlarda yordam ishlatilgani uchun so‘z «Takrorlash kerak» sifatida qayta mashq uchun belgilanadi.'}
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
            {item.pronunciation && (
              <span className="ml-2 font-mono text-xs text-slate-500">{item.pronunciation}</span>
            )}
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
              ref={finishBtnRef}
              type="button"
              onClick={() =>
                onComplete({
                  independentSuccess: !wasRevealed,
                  revealedOrSkipped: wasRevealed,
                })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <span>Yakunlash</span>
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
