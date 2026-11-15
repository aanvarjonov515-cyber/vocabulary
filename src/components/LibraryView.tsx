import { ChangeEvent, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Award,
  CheckCircle2,
  Download,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { OriginalVocabSnapshot, UserMetaState, VocabRecord, WordStatus } from '../types';
import {
  BADGE_TIERS,
  formatNextReviewUz,
  getEffectiveWordStatus,
  getStatusLabelUz,
  isWordDueForReview,
} from '../utils/gamification';
import {
  createBackupPayload,
  parseAndValidateBackupJson,
} from '../utils/db';
import {
  detectSuspiciousRecord,
  splitSentenceWithHighlightedWord,
} from '../utils/parser';

interface LibraryViewProps {
  vocabList: VocabRecord[];
  meta: UserMetaState;
  onUpdateRecord: (id: string, updated: OriginalVocabSnapshot) => void;
  onDeleteRecord: (id: string) => void;
  onStartLearnWord: (id: string) => void;
  onStartReviewWord: (id: string) => void;
  onStartDueReviewQueue: () => void;
  onRestoreBackup: (vocabulary: VocabRecord[], meta: UserMetaState) => void;
}

type StatusFilter = 'all' | WordStatus;

export function LibraryView({
  vocabList,
  meta,
  onUpdateRecord,
  onDeleteRecord,
  onStartLearnWord,
  onStartReviewWord,
  onStartDueReviewQueue,
  onRestoreBackup,
}: LibraryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBuffer, setEditBuffer] = useState<OriginalVocabSnapshot | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [backupFeedback, setBackupFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const now = Date.now();

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      all: vocabList.length,
      needs_review: 0,
      practiced: 0,
      mastered: 0,
      new: 0,
    };
    for (const item of vocabList) {
      const eff = getEffectiveWordStatus(item, now);
      counts[eff]++;
    }
    return counts;
  }, [vocabList, now]);

  const dueCount = useMemo(
    () => vocabList.filter((item) => isWordDueForReview(item, now)).length,
    [vocabList, now]
  );

  const masteredTotal = useMemo(
    () => vocabList.filter((item) => item.mastered).length,
    [vocabList]
  );

  const suspiciousMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of vocabList) {
      const reasons = detectSuspiciousRecord(item);
      if (reasons.length > 0) {
        map.set(item.id, reasons);
      }
    }
    return map;
  }, [vocabList]);

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vocabList.filter((item) => {
      const eff = getEffectiveWordStatus(item, now);
      if (statusFilter !== 'all' && eff !== statusFilter) return false;
      if (!q) return true;
      return (
        item.word.toLowerCase().includes(q) ||
        item.uzbekTranslation.toLowerCase().includes(q) ||
        item.russianTranslation.toLowerCase().includes(q) ||
        item.exampleSentence.toLowerCase().includes(q)
      );
    });
  }, [vocabList, searchQuery, statusFilter, now]);

  const handleStartEdit = (item: VocabRecord) => {
    setConfirmDeleteId(null);
    setEditingId(item.id);
    setEditBuffer({
      word: item.word,
      partOfSpeech: item.partOfSpeech,
      pronunciation: item.pronunciation,
      exampleSentence: item.exampleSentence,
      russianTranslation: item.russianTranslation,
      uzbekTranslation: item.uzbekTranslation,
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editBuffer || !editBuffer.word.trim()) return;
    onUpdateRecord(id, {
      word: editBuffer.word.trim(),
      partOfSpeech: editBuffer.partOfSpeech.trim(),
      pronunciation: editBuffer.pronunciation.trim(),
      exampleSentence: editBuffer.exampleSentence.trim(),
      russianTranslation: editBuffer.russianTranslation.trim(),
      uzbekTranslation: editBuffer.uzbekTranslation.trim(),
    });
    setEditingId(null);
    setEditBuffer(null);
  };

  const handleExportJson = () => {
    const payload = createBackupPayload(vocabList, meta);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `wordmem-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setBackupFeedback({
      type: 'success',
      text: `${vocabList.length} ta so‘z va o‘quv natijalari JSON faylga eksport qilindi.`,
    });
  };

  const handleImportJsonFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      const result = parseAndValidateBackupJson(content);
      if (result.ok === false) {
        setBackupFeedback({ type: 'error', text: result.error });
        return;
      }
      onRestoreBackup(result.vocabulary, result.meta);
      setBackupFeedback({
        type: 'success',
        text: `${result.vocabulary.length} ta so‘z va barcha o‘quv natijalari zaxira fayldan tiklandi.`,
      });
    };
    reader.onerror = () => {
      setBackupFeedback({
        type: 'error',
        text: 'Faylni o‘qishda xatolik yuz berdi.',
      });
    };
    reader.readAsText(file);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10 space-y-8">
      {/* Header & Actions */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            Mening lug‘atim
          </h1>
          <p className="text-sm text-slate-600 tabular-nums">
            Jami {vocabList.length} ta so‘z · Yodlandi: {masteredTotal} · Takrorlash kerak: {statusCounts.needs_review}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {dueCount > 0 && (
            <button
              type="button"
              onClick={onStartDueReviewQueue}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Takrorlashni boshlash ({dueCount})</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportJson}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Download className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>JSON eksport</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs sm:text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span>JSON import</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportJsonFile}
            className="hidden"
          />
        </div>
      </div>

      {backupFeedback && (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${
            backupFeedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {backupFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <span>{backupFeedback.text}</span>
        </div>
      )}

      {/* Achievement Tiers (compact, based on verified mastery only) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Award className="h-4 w-4 text-amber-600" aria-hidden="true" />
            <span>Yutuq darajalari</span>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            Mustaqil yodlangan so‘zlar: {masteredTotal} ta
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {BADGE_TIERS.map((badge) => {
            const unlocked = masteredTotal >= badge.threshold;
            return (
              <div
                key={badge.id}
                className={`rounded-lg border px-3 py-2 text-xs transition-colors ${
                  unlocked
                    ? 'border-blue-200 bg-blue-50/70 text-slate-900'
                    : 'border-slate-200 bg-slate-50/60 text-slate-400'
                }`}
              >
                <p className="font-semibold truncate">{badge.name}</p>
                <p className="font-mono tabular-nums mt-0.5">
                  {badge.threshold} ta so‘z
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="So‘z, tarjima yoki gap bo‘yicha qidirish..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { key: 'all', label: `Barchasi (${statusCounts.all})` },
              { key: 'needs_review', label: `Takrorlash kerak (${statusCounts.needs_review})` },
              { key: 'practiced', label: `Mashq qilindi (${statusCounts.practiced})` },
              { key: 'mastered', label: `Yodlandi (${statusCounts.mastered})` },
              { key: 'new', label: `Yangi (${statusCounts.new})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {suspiciousMap.size > 0 && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span>
            Diqqat: avvalgi importdan qolgan <strong>{suspiciousMap.size}</strong> ta yozuvda aralashgan yoki shubhali ma’lumot aniqlandi. Ularni tahrirlang yoki o‘chirib qayta import qiling.
          </span>
        </div>
      )}

      {/* Vocabulary List */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-xs">
        {filteredList.length === 0 ? (
          <div className="px-6 py-12 text-center space-y-2">
            <p className="text-sm font-medium text-slate-700">
              {vocabList.length === 0
                ? 'Lug‘atingizda hali so‘zlar yo‘q.'
                : 'Qidiruv yoki filtr bo‘yicha so‘z topilmadi.'}
            </p>
            <p className="text-xs text-slate-500">
              {vocabList.length === 0
                ? '«So‘z qo‘shish» bo‘limidan yangi so‘zlarni kiriting yoki JSON zaxira faylni import qiling.'
                : 'Boshqa kalit so‘z yoki filtrni tanlab ko‘ring.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-200">
            {filteredList.map((item) => {
              const effectiveStatus = getEffectiveWordStatus(item, now);
              const suspiciousReasons = suspiciousMap.get(item.id) || [];
              const isEditing = editingId === item.id && editBuffer !== null;
              const isConfirmingDelete = confirmDeleteId === item.id;
              const sentenceParts = item.exampleSentence
                ? splitSentenceWithHighlightedWord(item.exampleSentence, item.word)
                : [];

              if (isEditing && editBuffer) {
                return (
                  <li key={item.id} className="p-5 sm:p-6 space-y-3 bg-slate-50/50">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={editBuffer.word}
                        onChange={(e) =>
                          setEditBuffer({ ...editBuffer, word: e.target.value })
                        }
                        placeholder="Inglizcha so‘z"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium"
                      />
                      <input
                        type="text"
                        value={editBuffer.partOfSpeech}
                        onChange={(e) =>
                          setEditBuffer({ ...editBuffer, partOfSpeech: e.target.value })
                        }
                        placeholder="So‘z turkumi"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        value={editBuffer.pronunciation}
                        onChange={(e) =>
                          setEditBuffer({ ...editBuffer, pronunciation: e.target.value })
                        }
                        placeholder="Talaffuzi"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        value={editBuffer.uzbekTranslation}
                        onChange={(e) =>
                          setEditBuffer({
                            ...editBuffer,
                            uzbekTranslation: e.target.value,
                          })
                        }
                        placeholder="O‘zbekcha tarjimasi"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                      <input
                        type="text"
                        value={editBuffer.russianTranslation}
                        onChange={(e) =>
                          setEditBuffer({
                            ...editBuffer,
                            russianTranslation: e.target.value,
                          })
                        }
                        placeholder="Ruscha tarjimasi"
                        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <input
                      type="text"
                      value={editBuffer.exampleSentence}
                      onChange={(e) =>
                        setEditBuffer({
                          ...editBuffer,
                          exampleSentence: e.target.value,
                        })
                      }
                      placeholder="Misol gap"
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditBuffer(null);
                        }}
                        className="rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Bekor qilish
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(item.id)}
                        className="rounded-md bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Saqlash
                      </button>
                    </div>
                  </li>
                );
              }

              return (
                <li key={item.id} className="p-5 sm:p-6 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                        <span className="font-display text-lg sm:text-xl font-bold text-slate-900 break-words">
                          {item.word}
                        </span>
                        {item.pronunciation && (
                          <span className="font-mono text-xs sm:text-sm text-slate-500">
                            {item.pronunciation}
                          </span>
                        )}
                        {item.partOfSpeech && (
                          <span className="text-xs font-medium text-slate-500">
                            {item.partOfSpeech}
                          </span>
                        )}
                      </div>

                      <p className="text-sm sm:text-base text-slate-800 break-words">
                        <span className="font-medium">{item.uzbekTranslation || '—'}</span>
                        {item.russianTranslation && (
                          <>
                            <span className="mx-1.5 text-slate-300" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-slate-600">
                              {item.russianTranslation}
                            </span>
                          </>
                        )}
                      </p>

                      {item.exampleSentence && (
                        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed break-words">
                          {sentenceParts.map((part, idx) =>
                            part.isTarget ? (
                              <strong key={idx} className="font-semibold text-slate-900">
                                {part.text}
                              </strong>
                            ) : (
                              <span key={idx}>{part.text}</span>
                            )
                          )}
                        </p>
                      )}

                      {suspiciousReasons.length > 0 && (
                        <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
                          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                          <span>
                            <strong>Tekshirish kerak:</strong> {suspiciousReasons.join(' · ')}
                          </span>
                        </div>
                      )}

                      {/* Unboxed metadata row: status, next review, attempts */}
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pt-1 text-xs text-slate-500 tabular-nums">
                        <span
                          className={`font-semibold ${
                            effectiveStatus === 'mastered'
                              ? 'text-emerald-700'
                              : effectiveStatus === 'needs_review'
                                ? 'text-amber-700'
                                : effectiveStatus === 'practiced'
                                  ? 'text-blue-700'
                                  : 'text-slate-600'
                          }`}
                        >
                          {getStatusLabelUz(effectiveStatus)}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          Keyingi takrorlash: {formatNextReviewUz(item.nextReviewAt, now)}
                        </span>
                        <span className="text-slate-300" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          To‘g‘ri: {item.correctAttempts} / Xato: {item.incorrectAttempts}
                        </span>
                      </div>
                    </div>

                    {/* Row Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => onStartReviewWord(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                      >
                        <RotateCcw className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                        <span>Takrorlash</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onStartLearnWord(item.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                      >
                        <Play className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        <span>6 bosqich</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(item)}
                        aria-label={`${item.word} so‘zini tahrirlash`}
                        className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>

                      {!isConfirmingDelete ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(item.id)}
                          aria-label={`${item.word} so‘zini o‘chirish`}
                          className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteRecord(item.id);
                              setConfirmDeleteId(null);
                            }}
                            className="font-semibold text-red-700 hover:underline"
                          >
                            O‘chirish
                          </button>
                          <span className="text-red-300">/</span>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-slate-600 hover:underline"
                          >
                            Bekor
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-xs text-slate-400 text-center">
        Ma’lumotlar ushbu brauzerning lokal xotirasida (IndexedDB) saqlanadi. Qurilmalar o‘rtasida bulutli sinxronizatsiya mavjud emas — ko‘chirish uchun JSON eksportdan foydalaning.
      </p>
    </div>
  );
}
