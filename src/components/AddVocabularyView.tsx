import { ClipboardEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { OriginalVocabSnapshot, ParsedVocabDraft, VocabRecord } from '../types';
import { isWordDueForReview } from '../utils/gamification';
import {
  extractTableFromHtml,
  parseVocabularyText,
  revalidateDraftList,
  SAMPLE_VOCABULARY_TEXT,
} from '../utils/parser';

interface AddVocabularyViewProps {
  vocabList: VocabRecord[];
  hasActiveSession: boolean;
  onAddItems: (items: OriginalVocabSnapshot[]) => void;
  onStartMemorization: (restart?: boolean, queueIds?: string[]) => void;
  onStartDueReview: () => void;
  onOpenLibrary: () => void;
}

export function AddVocabularyView({
  vocabList,
  hasActiveSession,
  onAddItems,
  onStartMemorization,
  onStartDueReview,
  onOpenLibrary,
}: AddVocabularyViewProps) {
  const [rawText, setRawText] = useState('');
  const [drafts, setDrafts] = useState<ParsedVocabDraft[]>([]);
  const [feedback, setFeedback] = useState<{
    type: 'error' | 'success' | 'warning';
    text: string;
  } | null>(null);

  const dueCount = useMemo(
    () => vocabList.filter((item) => isWordDueForReview(item)).length,
    [vocabList]
  );

  // Re-evaluate duplicates whenever saved vocabList updates
  useEffect(() => {
    setDrafts((prev) => {
      if (prev.length === 0) return prev;
      return revalidateDraftList(prev, vocabList);
    });
  }, [vocabList]);

  const handleRawTextChange = (nextText: string) => {
    setRawText(nextText);
    setFeedback(null);
    if (!nextText.trim()) {
      setDrafts([]);
      return;
    }
    setDrafts(parseVocabularyText(nextText, vocabList));
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const html = e.clipboardData?.getData('text/html');
    if (html) {
      const tableTsv = extractTableFromHtml(html);
      if (tableTsv) {
        e.preventDefault();
        const el = e.currentTarget;
        const start = el.selectionStart ?? rawText.length;
        const end = el.selectionEnd ?? rawText.length;
        const nextText =
          rawText.slice(0, start) +
          (start > 0 && !rawText.slice(0, start).endsWith('\n') ? '\n' : '') +
          tableTsv +
          rawText.slice(end);
        handleRawTextChange(nextText);
      }
    }
  };

  const handleLoadSample = () => {
    setRawText(SAMPLE_VOCABULARY_TEXT);
    setFeedback(null);
    setDrafts(parseVocabularyText(SAMPLE_VOCABULARY_TEXT, vocabList));
  };

  const handleClearInput = () => {
    setRawText('');
    setDrafts([]);
    setFeedback(null);
  };

  const updateDraftField = (
    tempId: string,
    field: 'word' | 'partOfSpeech' | 'pronunciation' | 'exampleSentence' | 'russianTranslation' | 'uzbekTranslation',
    value: string
  ) => {
    setDrafts((prev) => {
      const updated = prev.map((d) =>
        d.tempId === tempId ? { ...d, [field]: value } : d
      );
      return revalidateDraftList(updated, vocabList);
    });
  };

  const confirmDraftRow = (tempId: string) => {
    setDrafts((prev) => {
      const updated = prev.map((d) =>
        d.tempId === tempId ? { ...d, confirmedByUser: true } : d
      );
      return revalidateDraftList(updated, vocabList);
    });
  };

  const removeDraft = (tempId: string) => {
    setDrafts((prev) => {
      const filtered = prev.filter((d) => d.tempId !== tempId);
      return revalidateDraftList(filtered, vocabList);
    });
  };

  const previewStats = useMemo(() => {
    let validCount = 0;
    let correctionCount = 0;
    let duplicateCount = 0;

    for (const d of drafts) {
      if (d.isDuplicate) duplicateCount++;
      else if (d.needsCorrection) correctionCount++;
      else validCount++;
    }

    return { validCount, correctionCount, duplicateCount };
  }, [drafts]);

  const handleConfirmImport = () => {
    if (!rawText.trim() && drafts.length === 0) {
      setFeedback({
        type: 'error',
        text: 'Iltimos, avval so‘z matnini kiriting.',
      });
      return;
    }

    const readyItems = drafts.filter(
      (d) => !d.isDuplicate && !d.needsCorrection && d.word.trim().length > 0
    );

    if (readyItems.length === 0) {
      if (previewStats.correctionCount > 0) {
        setFeedback({
          type: 'error',
          text: `${previewStats.correctionCount} ta qator «Tekshirish kerak» holatida. Avval xatolarni tuzating yoki tasdiqlang.`,
        });
      } else if (previewStats.duplicateCount > 0) {
        setFeedback({
          type: 'warning',
          text: 'Barcha kiritilgan so‘zlar lug‘atingizda allaqachon mavjud. Takroriy so‘zlar qo‘shilmadi.',
        });
      } else {
        setFeedback({
          type: 'error',
          text: 'Import qilish uchun yaroqli so‘z topilmadi.',
        });
      }
      return;
    }

    onAddItems(
      readyItems.map((d) => ({
        word: d.word.trim(),
        partOfSpeech: d.partOfSpeech.trim(),
        pronunciation: d.pronunciation.trim(),
        exampleSentence: d.exampleSentence.trim(),
        russianTranslation: d.russianTranslation.trim(),
        uzbekTranslation: d.uzbekTranslation.trim(),
      }))
    );

    // Keep unimported rows that still need correction in the preview so nothing is silently lost!
    const remainingCorrection = drafts.filter(
      (d) => !d.isDuplicate && d.needsCorrection
    );

    if (remainingCorrection.length > 0) {
      setDrafts(revalidateDraftList(remainingCorrection, vocabList));
      setRawText('');
      setFeedback({
        type: 'warning',
        text: `${readyItems.length} ta tayyor so‘z qo‘shildi. Qolgan ${remainingCorrection.length} ta qatorni tekshirib tuzating.`,
      });
    } else {
      setRawText('');
      setDrafts([]);
      setFeedback({
        type: 'success',
        text:
          previewStats.duplicateCount > 0
            ? `${readyItems.length} ta yangi so‘z import qilindi (${previewStats.duplicateCount} ta takroriy so‘z o‘tkazib yuborildi).`
            : `${readyItems.length} ta yangi so‘z muvaffaqiyatli import qilindi.`,
      });
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
      {/* Top Intro & Quick Launch Strip */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="max-w-2xl space-y-2">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            So‘zlarni import qilish va tayyorlash
          </h1>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
            PDF jadval yoki matn ko‘rinishidagi lug‘atni joylang, 5 ustunli jadvalda tekshiring va tasdiqlang.
          </p>
        </div>

        {vocabList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onStartMemorization(false)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              <span>
                {hasActiveSession
                  ? 'Mashqni davom ettirish'
                  : `Yodlashni boshlash (${vocabList.length})`}
              </span>
            </button>

            {hasActiveSession && (
              <button
                type="button"
                onClick={() => onStartMemorization(true)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Qaytadan</span>
              </button>
            )}

            {dueCount > 0 && (
              <button
                type="button"
                onClick={onStartDueReview}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-blue-700 hover:bg-blue-100 whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Takrorlash ({dueCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onOpenLibrary}
              className="inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 px-2 py-2 whitespace-nowrap"
            >
              <span>Mening lug‘atim</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        )}
      </div>

      {/* Paste Box */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="vocab-paste-input"
            className="text-sm font-semibold text-slate-900"
          >
            Lug‘at matnini yoki jadvalini joylang
          </label>
          <button
            type="button"
            onClick={handleLoadSample}
            className="text-xs font-medium text-blue-700 hover:text-blue-800 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
          >
            Namuna matnni joylash
          </button>
        </div>

        <textarea
          id="vocab-paste-input"
          rows={7}
          value={rawText}
          onPaste={handlePaste}
          onChange={(e) => handleRawTextChange(e.target.value)}
          placeholder={`PDF yoki jadvaldan nusxalangan matnni shu yerga joylang (HTML jadval, TSV, CSV yoki oddiy matn):\n\nadvertisement\t/ədˈvɜːtɪsmənt/\tI want to sell my guitar so I've put an advertisement in a newspaper.\tреклама\treklama\nafford\t/əˈfɔːrd/\tThe family was very poor and couldn't afford piano lessons.\tпозволить себе\tqurbi yetmoq`}
          className="w-full rounded-lg border border-slate-300 bg-slate-50/50 px-3.5 py-3 text-sm text-slate-900 placeholder:text-slate-400 leading-relaxed focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600/20"
        />

        {feedback && (
          <div
            role="status"
            className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm ${
              feedback.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-800'
                : feedback.type === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {feedback.type === 'error' && (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            {feedback.type === 'warning' && (
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            {feedback.type === 'success' && (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <span>{feedback.text}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={handleClearInput}
            disabled={!rawText && drafts.length === 0}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
          >
            Tozalash
          </button>

          <button
            type="button"
            onClick={handleConfirmImport}
            disabled={drafts.length === 0 && !rawText.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>
              {drafts.length > 0
                ? `Importni tasdiqlash (${previewStats.validCount} ta)`
                : 'So‘zlarni qo‘shish'}
            </span>
          </button>
        </div>
      </section>

      {/* Mandatory 5-Column Import Preview Table */}
      {drafts.length > 0 && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Import jadvali (tasdiqlashdan oldin tekshiring)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                Tayyor: <strong className="text-emerald-700">{previewStats.validCount}</strong>
                <span className="mx-2 text-slate-300">·</span>
                Tekshirish kerak:{' '}
                <strong className={previewStats.correctionCount > 0 ? 'text-amber-700' : 'text-slate-700'}>
                  {previewStats.correctionCount}
                </strong>
                <span className="mx-2 text-slate-300">·</span>
                Takroriy:{' '}
                <strong className="text-slate-700">{previewStats.duplicateCount}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={previewStats.validCount === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs sm:text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              <span>Tayyorlarini saqlash ({previewStats.validCount})</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="px-3 py-3 w-10 text-center">#</th>
                  <th className="px-3 py-3 w-44">So‘z</th>
                  <th className="px-3 py-3 w-40">Talaffuz</th>
                  <th className="px-3 py-3 min-w-[240px]">Misol gap</th>
                  <th className="px-3 py-3 w-44">Ruscha</th>
                  <th className="px-3 py-3 w-44">O‘zbekcha</th>
                  <th className="px-3 py-3 w-44">Holat</th>
                  <th className="px-3 py-3 w-12 text-right">Amal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {drafts.map((draft, idx) => {
                  const rowBg = draft.isDuplicate
                    ? 'bg-slate-50/70'
                    : draft.needsCorrection
                      ? 'bg-amber-50/40'
                      : 'bg-white';

                  const canQuickConfirm =
                    draft.needsCorrection &&
                    draft.word.trim().length > 0 &&
                    draft.uzbekTranslation.trim().length > 0 &&
                    !draft.correctionReasons.some(
                      (r) =>
                        r.includes('aralashgan') ||
                        r.includes('gapga o‘xshaydi') ||
                        r.includes('kirill')
                    );

                  return (
                    <tr key={draft.tempId} className={rowBg}>
                      <td className="px-3 py-3 text-center text-xs font-mono text-slate-400 tabular-nums align-top">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-2.5 align-top space-y-1">
                        <input
                          type="text"
                          value={draft.word}
                          onChange={(e) =>
                            updateDraftField(draft.tempId, 'word', e.target.value)
                          }
                          aria-label={`${idx + 1}-qator inglizcha so‘z`}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                        {draft.partOfSpeech && (
                          <input
                            type="text"
                            value={draft.partOfSpeech}
                            onChange={(e) =>
                              updateDraftField(draft.tempId, 'partOfSpeech', e.target.value)
                            }
                            placeholder="turkum"
                            className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600 focus:border-blue-600 focus:bg-white focus:outline-none"
                          />
                        )}
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <input
                          type="text"
                          value={draft.pronunciation}
                          onChange={(e) =>
                            updateDraftField(draft.tempId, 'pronunciation', e.target.value)
                          }
                          placeholder="/.../"
                          aria-label={`${idx + 1}-qator talaffuz`}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 font-mono text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <textarea
                          rows={2}
                          value={draft.exampleSentence}
                          onChange={(e) =>
                            updateDraftField(draft.tempId, 'exampleSentence', e.target.value)
                          }
                          aria-label={`${idx + 1}-qator misol gap`}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs sm:text-sm text-slate-800 leading-snug focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <input
                          type="text"
                          value={draft.russianTranslation}
                          onChange={(e) =>
                            updateDraftField(
                              draft.tempId,
                              'russianTranslation',
                              e.target.value
                            )
                          }
                          aria-label={`${idx + 1}-qator ruscha tarjima`}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-2 py-2.5 align-top">
                        <input
                          type="text"
                          value={draft.uzbekTranslation}
                          onChange={(e) =>
                            updateDraftField(
                              draft.tempId,
                              'uzbekTranslation',
                              e.target.value
                            )
                          }
                          aria-label={`${idx + 1}-qator o‘zbekcha tarjima`}
                          className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top text-xs space-y-1.5">
                        {draft.isDuplicate ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>Takroriy (o‘tkaziladi)</span>
                          </span>
                        ) : draft.needsCorrection ? (
                          <div className="space-y-1.5">
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-800">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                              <span>Tekshirish kerak</span>
                            </span>
                            <p className="text-[11px] leading-snug text-amber-800">
                              {draft.correctionReasons.join(' · ')}
                            </p>
                            {canQuickConfirm && (
                              <button
                                type="button"
                                onClick={() => confirmDraftRow(draft.tempId)}
                                className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
                              >
                                Tasdiqlash
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>Tayyor</span>
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 align-top text-right">
                        <button
                          type="button"
                          onClick={() => removeDraft(draft.tempId)}
                          aria-label={`${idx + 1}-qatorni olib tashlash`}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
