import { useEffect, useRef } from 'react';
import { ArrowRight } from 'lucide-react';
import { VocabRecord } from '../../types';
import { splitSentenceWithHighlightedWord } from '../../utils/parser';

interface Stage1FamiliarizeProps {
  item: VocabRecord;
  onContinue: () => void;
  onSkip: () => void;
}

export function Stage1Familiarize({
  item,
  onContinue,
  onSkip,
}: Stage1FamiliarizeProps) {
  const continueBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    continueBtnRef.current?.focus();
  }, [item.id]);

  const sentenceParts = item.exampleSentence
    ? splitSentenceWithHighlightedWord(item.exampleSentence, item.word)
    : [];

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <p className="text-xs font-medium text-slate-500">
          1-bosqich · Tanishish — so‘z, talaffuz va ma’noni ko‘rib chiqing
        </p>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 break-words">
            {item.word}
          </h2>
          {item.pronunciation && (
            <span className="font-mono text-base sm:text-lg text-slate-500">
              {item.pronunciation}
            </span>
          )}
          {item.partOfSpeech && (
            <span className="text-sm font-medium text-blue-700">
              {item.partOfSpeech}
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">O‘zbekcha</p>
          <p className="text-lg sm:text-xl font-semibold text-slate-900 break-words">
            {item.uzbekTranslation || '—'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1.5">Ruscha</p>
          <p className="text-lg sm:text-xl font-medium text-slate-700 break-words">
            {item.russianTranslation || '—'}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6">
        <p className="text-xs font-medium text-slate-500 mb-2">Misol gap</p>
        {item.exampleSentence ? (
          <p className="text-lg sm:text-xl leading-relaxed text-slate-800 break-words">
            {sentenceParts.map((part, idx) =>
              part.isTarget ? (
                <strong
                  key={idx}
                  className="font-bold text-slate-950 underline decoration-blue-300 decoration-2 underline-offset-4"
                >
                  {part.text}
                </strong>
              ) : (
                <span key={idx}>{part.text}</span>
              )
            )}
          </p>
        ) : (
          <p className="text-base text-slate-400 italic">Misol gap kiritilmagan</p>
        )}
      </div>

      <div className="border-t border-slate-200 pt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          O‘tkazib yuborish
        </button>

        <button
          ref={continueBtnRef}
          type="button"
          onClick={onContinue}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm sm:text-base font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <span>Davom etish</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
