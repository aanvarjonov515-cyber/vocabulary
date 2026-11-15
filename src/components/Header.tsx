import { AppSection } from '../types';

interface HeaderProps {
  activeSection: AppSection;
  vocabCount: number;
  dueCount: number;
  onSelectSection: (section: AppSection) => void;
  onPrimaryAction: () => void;
}

export function Header({
  activeSection,
  vocabCount,
  dueCount,
  onSelectSection,
  onPrimaryAction,
}: HeaderProps) {
  const primaryLabel =
    activeSection === 'memorize'
      ? 'So‘z qo‘shish'
      : dueCount > 0
        ? `Takrorlash (${dueCount})`
        : 'Yodlashni boshlash';

  const primaryDisabled = activeSection !== 'memorize' && vocabCount === 0;

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-6">
        <button
          type="button"
          onClick={() => onSelectSection('add')}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 rounded"
        >
          WordMem
        </button>

        <nav className="flex items-center gap-4 sm:gap-7 overflow-x-auto" aria-label="Asosiy bo‘limlar">
          <button
            type="button"
            onClick={() => onSelectSection('add')}
            className={`text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-t ${
              activeSection === 'add'
                ? 'border-blue-600 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            So‘z qo‘shish
          </button>

          <button
            type="button"
            onClick={() => {
              if (vocabCount > 0) onSelectSection('memorize');
            }}
            disabled={vocabCount === 0}
            className={`text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-t ${
              activeSection === 'memorize'
                ? 'border-blue-600 text-slate-900'
                : vocabCount === 0
                  ? 'border-transparent text-slate-300 cursor-not-allowed'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Yodlash
          </button>

          <button
            type="button"
            onClick={() => onSelectSection('library')}
            className={`text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-t ${
              activeSection === 'library'
                ? 'border-blue-600 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            Mening lug‘atim
          </button>
        </nav>

        <div className="hidden sm:block shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={primaryDisabled}
            className={`rounded-lg px-3.5 py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${
              activeSection === 'memorize'
                ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                : 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed'
            }`}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
