import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Eye, RotateCcw } from 'lucide-react';
import { VocabRecord } from '../../types';

interface Stage2RecallProps {
  item: VocabRecord;
  onComplete: (result: { independentSuccess: boolean; revealedOrSkipped: boolean }) => void;
}

export function Stage2Recall({ item, onComplete }: Stage2RecallProps) {
  const [revealed, setRevealed] = useState(false);
  const checkBtnRef = useRef<HTMLButtonElement>(null);
  const rememberedBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    checkBtnRef.current?.focus();
  }, [item.id]);

  useEffect(() => {
    if (revealed) {
      rememberedBtnRef.current?.focus();
    }
  }, [revealed]);

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">
          2-bosqich · Xotirlash — inglizcha so‘zni eslab ko‘ring
        </p>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
          O‘zbekcha tarjimasiga qarab so‘zni eslang
        </h2>
      </div>

      <div className="border-t border-slate-200 pt-6 space-y-4">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">O‘zbekcha tarjimasi</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 break-words">
            {item.uzbekTranslation || item.russianTranslation || '—'}
          </p>
        </div>

        {item.partOfSpeech && (
          <p className="text-xs text-slate-500">
            So‘z turkumi: <span className="font-medium text-slate-700">{item.partOfSpeech}</span>
          </p>
        )}
      </div>

      {!revealed ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 text-center space-y-4">
          <p className="text-sm text-slate-600">
            Inglizcha so‘zni ichingizda eslang, so‘ng tekshirish uchun tugmani bosing.
          </p>
          <button
            ref={checkBtnRef}
            type="button"
            onClick={() => setRevealed(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            <span>Javobni tekshirish</span>
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-2xl sm:text-3xl font-bold text-slate-900 break-words">
              {item.word}
            </span>
            {item.pronunciation && (
              <span className="font-mono text-sm sm:text-base text-slate-500">
                {item.pronunciation}
              </span>
            )}
          </div>
          {item.russianTranslation && (
            <p className="text-sm text-slate-600">
              Ruscha: <span className="font-medium text-slate-800">{item.russianTranslation}</span>
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              ref={rememberedBtnRef}
              type="button"
              onClick={() =>
                onComplete({ independentSuccess: true, revealedOrSkipped: false })
              }
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>To‘g‘ri esladim (+5 XP)</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onComplete({ independentSuccess: false, revealedOrSkipped: true })
              }
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <RotateCcw className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>Eslay olmadim</span>
            </button>
          </div>
        </div>
      )}

      <div className="border-t border-slate-200 pt-4 flex items-center justify-between gap-3">
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
    </div>
  );
}
