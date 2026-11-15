import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ArrowRight, CheckCircle2, Eye } from 'lucide-react';
import { VocabRecord } from '../../types';
import {
  advancePastSpaces,
  buildCharStream,
  CharSlot,
  normalizeComparisonChars,
} from '../../utils/parser';

interface Stage5LetterPracticeProps {
  item: VocabRecord;
  onAttemptIncorrect: () => void;
  onRevealAnswer: () => void;
  onComplete: (result: { independentSuccess: boolean; revealedOrSkipped: boolean }) => void;
}

export function Stage5LetterPractice({
  item,
  onAttemptIncorrect,
  onRevealAnswer,
  onComplete,
}: Stage5LetterPracticeProps) {
  const slots = useMemo(() => buildCharStream(item.word || ''), [item.word]);

  const wordGroups = useMemo(() => {
    const groups: CharSlot[][] = [];
    let current: CharSlot[] = [];
    for (const slot of slots) {
      if (slot.isSpace) {
        if (current.length > 0) {
          groups.push(current);
          current = [];
        }
      } else {
        current.push(slot);
      }
    }
    if (current.length > 0) groups.push(current);
    return groups;
  }, [slots]);

  const initialCursor = useMemo(() => advancePastSpaces(slots, 0), [slots]);

  const [cursorIndex, setCursorIndex] = useState(initialCursor);
  const [inputBuffer, setInputBuffer] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [wasRevealed, setWasRevealed] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const nextBtnRef = useRef<HTMLButtonElement>(null);

  const nonSpaceTotal = useMemo(
    () => slots.filter((s) => !s.isSpace).length,
    [slots]
  );
  const completedNonSpace = useMemo(
    () => slots.slice(0, cursorIndex).filter((s) => !s.isSpace).length,
    [slots, cursorIndex]
  );

  const isFinished = slots.length > 0 && cursorIndex >= slots.length;

  useEffect(() => {
    if (isFinished) {
      nextBtnRef.current?.focus();
    } else {
      inputRef.current?.focus();
    }
  }, [isFinished, item.id]);

  const activeSlot = !isFinished ? slots[cursorIndex] : null;

  const handleReveal = () => {
    if (!wasRevealed) {
      setWasRevealed(true);
      onRevealAnswer();
    }
    inputRef.current?.focus();
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    if (isFinished || !rawValue) return;

    const chars = Array.from(rawValue);
    let nextCursor = cursorIndex;
    let hadMismatch = false;

    for (const ch of chars) {
      if (nextCursor >= slots.length) break;
      const expectedSlot = slots[nextCursor];

      const justPassedSpace = nextCursor > 0 && slots[nextCursor - 1]?.isSpace;
      if (ch === ' ' && justPassedSpace) {
        continue;
      }

      const typedNormalized = normalizeComparisonChars(ch).toLowerCase();
      if (typedNormalized === expectedSlot.expectedNormalized) {
        nextCursor = advancePastSpaces(slots, nextCursor + 1);
      } else {
        hadMismatch = true;
        break;
      }
    }

    if (nextCursor !== cursorIndex) {
      setCursorIndex(nextCursor);
      setErrorMessage('');
    }

    if (hadMismatch) {
      setErrorMessage('Qayta urinib ko‘ring');
      setShakeKey((k) => k + 1);
      onAttemptIncorrect();
    }

    setInputBuffer('');
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">
          5-bosqich · Harfma-harf yozish — so‘zni bitta-bitta harf bilan kiriting
        </p>
        <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
          So‘zni harfma-harf yozing
        </h2>
        <p className="text-sm text-slate-600 pt-1">
          O‘zbekcha:{' '}
          <strong className="font-semibold text-slate-900">
            {item.uzbekTranslation || '—'}
          </strong>
          {item.russianTranslation && (
            <>
              <span className="mx-1.5 text-slate-300" aria-hidden="true">
                ·
              </span>
              <span>{item.russianTranslation}</span>
            </>
          )}
        </p>
      </div>

      {/* Letter-by-letter display */}
      <div
        onClick={() => {
          if (!isFinished) inputRef.current?.focus();
        }}
        className="cursor-text rounded-xl border border-slate-200 bg-slate-50/70 p-5 sm:p-6 transition-colors hover:border-slate-300"
      >
        <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
          <span>Harflarni ketma-ket kiriting</span>
          <span className="font-mono tabular-nums">
            {completedNonSpace} / {nonSpaceTotal} harf
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 font-mono text-2xl sm:text-3xl">
          {wordGroups.map((group, gIdx) => (
            <span key={gIdx} className="inline-flex flex-wrap items-center gap-1.5">
              {group.map((slot) => {
                const isDone = slot.index < cursorIndex;
                const isCurrent = slot.index === cursorIndex;

                if (isDone) {
                  return (
                    <span
                      key={slot.index}
                      className="inline-flex h-11 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 font-bold text-slate-900"
                    >
                      {slot.char}
                    </span>
                  );
                }

                if (isCurrent) {
                  return (
                    <span
                      key={slot.index}
                      className="inline-flex h-11 w-9 items-center justify-center rounded-lg border-2 border-blue-600 bg-white font-bold text-blue-700"
                      aria-label="Keyingi harf o‘rni"
                    >
                      {slot.isPunctuation ? slot.char : '_'}
                    </span>
                  );
                }

                return (
                  <span
                    key={slot.index}
                    className="inline-flex h-11 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-300 select-none"
                    aria-hidden="true"
                  >
                    ·
                  </span>
                );
              })}
            </span>
          ))}
        </div>
      </div>

      {!isFinished && (
        <div className="space-y-2">
          <label
            htmlFor="stage5-letter-input"
            className="block text-xs font-medium text-slate-600"
          >
            {activeSlot?.isPunctuation
              ? `Keyingi belgi (${activeSlot.char === '’' || activeSlot.char === '‘' ? "'" : activeSlot.char}) ni kiriting:`
              : 'Keyingi harfni kiriting:'}
          </label>
          <input
            key={shakeKey}
            ref={inputRef}
            id="stage5-letter-input"
            type="text"
            value={inputBuffer}
            onChange={handleInputChange}
            placeholder="Harf kiriting..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className={`w-full rounded-lg border px-4 py-3 text-base sm:text-lg font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 ${
              errorMessage
                ? 'animate-gentle-shake border-red-400 bg-red-50/40 focus:ring-red-500'
                : 'border-slate-300 bg-white focus:border-blue-600 focus:ring-blue-600/20'
            }`}
          />
        </div>
      )}

      {errorMessage && !isFinished && (
        <div className="flex items-center gap-2 text-sm font-medium text-red-700" role="status">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isFinished && (
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-700" role="status">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {wasRevealed
              ? 'To‘g‘ri! (Javob ko‘rilgani sababli 0 XP)'
              : 'To‘g‘ri! Barcha harflar to‘liq kiritildi (+5 XP)'}
          </span>
        </div>
      )}

      {wasRevealed && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          <span className="text-slate-500">To‘g‘ri so‘z: </span>
          <strong className="font-semibold text-slate-900">{item.word}</strong>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {!isFinished && (
            <button
              type="button"
              onClick={handleReveal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <Eye className="h-4 w-4 text-slate-500" aria-hidden="true" />
              <span>Javobni ko‘rish</span>
            </button>
          )}

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

        {isFinished && (
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
        )}
      </div>
    </div>
  );
}
