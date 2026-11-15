import { OriginalVocabSnapshot, ParsedVocabDraft } from '../types';

export const SAMPLE_VOCABULARY_TEXT = `advertisement	/ədˈvɜːtɪsmənt/	I want to sell my guitar so I've put an advertisement in a newspaper.	реклама	reklama
afford	/əˈfɔːrd/	The family was very poor and couldn't afford piano lessons.	позволить себе	qurbi yetmoq
classical music	/ˈklæsɪkəl ˈmjuːzɪk/	Do you like classical music?	классическая музыка	klassik musiqa`;

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

const POS_MAP: Record<string, string> = {
  n: 'noun',
  noun: 'noun',
  v: 'verb',
  verb: 'verb',
  adj: 'adjective',
  adjective: 'adjective',
  adv: 'adverb',
  adverb: 'adverb',
  prep: 'preposition',
  preposition: 'preposition',
  conj: 'conjunction',
  conjunction: 'conjunction',
  pron: 'pronoun',
  pronoun: 'pronoun',
  num: 'numeral',
  numeral: 'numeral',
  int: 'interjection',
  interj: 'interjection',
  interjection: 'interjection',
  det: 'determiner',
  determiner: 'determiner',
  art: 'article',
  article: 'article',
  phr: 'phrase',
  phrase: 'phrase',
  'phr v': 'phrasal verb',
  'phr. v': 'phrasal verb',
  'phr/v': 'phrasal verb',
  'phrasal verb': 'phrasal verb',
  'n/v': 'noun / verb',
  'n, v': 'noun / verb',
  'v/n': 'verb / noun',
  'adj/adv': 'adjective / adverb',
  idiom: 'idiom',
  pl: 'plural noun',
  'n pl': 'plural noun',
};

const KNOWN_POS_KEYS = new Set(Object.keys(POS_MAP));

const TABLE_HEADER_KEYWORDS = new Set([
  'word',
  'words',
  'transcript',
  'transcription',
  'pronunciation',
  'ipa',
  'example',
  'examples',
  'example sentence',
  'russian',
  'russian translation',
  'uzbek',
  'uzbek translation',
  'translation',
  'part of speech',
  'pos',
]);

export function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : '';
    })
    .replace(/&([a-zA-Z]+);/g, (match, name: string) => {
      const lower = name.toLowerCase();
      return lower in NAMED_ENTITIES ? NAMED_ENTITIES[lower] : match;
    });
}

export function normalizeRawInput(raw: string): string {
  let text = decodeHtmlEntities(raw);

  // Convert literal escaped newlines/tabs when pasted from escaped sources
  text = text.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t');

  // Convert common block HTML breaks into newlines and strip inline HTML tags
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, '\t')
    .replace(/<\/?(p|div|span|b|strong|i|em|u|ul|ol|li|h[1-6]|table|thead|tbody|tr|td|th)(?:\s[^>]*)?>/gi, '');

  // Replace unusual Unicode whitespace characters with standard space
  text = text
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '')
    .replace(/\r\n?/g, '\n');

  return text;
}

export function stripMarkdownFormatting(line: string): string {
  return line
    .replace(/\*\*([^*\n]+)\*\*/g, '$1')
    .replace(/__([^_\n]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/g, '$1$2')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function extractTableFromHtml(html: string): string | null {
  if (!/<table[\s>]/i.test(html) || !/<tr[\s>]/i.test(html)) {
    return null;
  }

  const rows: string[][] = [];

  if (typeof DOMParser !== 'undefined') {
    try {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const trNodes = Array.from(doc.querySelectorAll('tr'));
      for (const tr of trNodes) {
        const cellNodes = Array.from(tr.querySelectorAll('th, td'));
        if (cellNodes.length === 0) continue;
        const cells = cellNodes.map((cell) =>
          (cell.textContent || '')
            .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
            .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        );
        if (cells.some((c) => c.length > 0)) {
          rows.push(cells);
        }
      }
    } catch {
      // Fallback below
    }
  }

  if (rows.length === 0) {
    const trMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const tr of trMatches) {
      const cellMatches = tr.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || [];
      if (cellMatches.length === 0) continue;
      const cells = cellMatches.map((c) =>
        decodeHtmlEntities(c.replace(/<[^>]+>/g, ' '))
          .replace(/[\u00A0\u2000-\u200A\u202F\u205F\u3000]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      );
      if (cells.some((c) => c.length > 0)) {
        rows.push(cells);
      }
    }
  }

  const hasMultiColRow = rows.some((r) => r.length >= 2);
  if (!hasMultiColRow) return null;

  return rows.map((r) => r.join('\t')).join('\n');
}

function normalizePos(rawPos: string): string {
  const cleaned = stripMarkdownFormatting(rawPos)
    .replace(/[()[\].]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned) return '';
  return POS_MAP[cleaned] ?? cleaned;
}

function containsCyrillic(text: string): boolean {
  return /[\u0400-\u04FF]/.test(text);
}

function isSeparatorLine(line: string): boolean {
  return /^[-=*_]{3,}$/.test(line.trim());
}

function isHeaderKeywordLine(line: string): boolean {
  const cleaned = stripMarkdownFormatting(line)
    .replace(/[|/\t,;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!cleaned) return false;
  if (TABLE_HEADER_KEYWORDS.has(cleaned)) return true;

  // Check if line is a combination of header keywords like "WORDS TRANSCRIPT EXAMPLE RUSSIAN TRANSLATION UZBEK TRANSLATION"
  const remaining = cleaned
    .replace(/\b(words?|transcript(ion)?|pronunciation|ipa|examples?(\s+sentence)?|russian(\s+translation)?|uzbek(\s+translation)?|translation|part\s+of\s+speech)\b/g, '')
    .trim();
  if (remaining.length === 0 && cleaned.split(/\s+/).length >= 2) {
    return true;
  }
  return false;
}

function isPdfPageNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (isHeaderKeywordLine(trimmed)) return true;
  if (/^page\s+\d+(?:\s*(?:of|\/)\s*\d+)?$/i.test(trimmed)) return true;
  if (/^\d+\s*\/\s*\d+$/.test(trimmed)) return true;
  if (/^-\s*\d+\s*-$/.test(trimmed)) return true;
  if (/^\d{1,3}$/.test(trimmed)) return true;
  if (/^(?:©|copyright)\b/i.test(trimmed)) return true;
  return false;
}

function stripRepeatedPdfBanners(lines: string[]): string[] {
  const isCandidateBanner = (idx: number, t: string): boolean => {
    if (!t || t.length < 15) return false;
    const words = t.split(/\s+/);
    if (words.length < 2) return false;
    // Never strip a word immediately followed by IPA, or an example immediately following IPA
    const prevLine = idx > 0 ? lines[idx - 1] : '';
    const nextLine = idx + 1 < lines.length ? lines[idx + 1] : '';
    if (prevLine && findIpaInLine(prevLine)) return false;
    if (nextLine && findIpaInLine(nextLine)) return false;
    // Never strip lines with IPA, Cyrillic, or sentence-ending punctuation
    if (/\/[^/\n]+\//.test(t) || containsCyrillic(t) || /[.!?]$/.test(t)) return false;
    // Must start with uppercase/number/copyright and look like a Title-Case or ALL-CAPS PDF header/footer
    if (!/^[A-Z0-9©]/.test(t)) return false;
    const capitalizedCount = words.filter((w) => /^[A-Z0-9©—–-]/.test(w)).length;
    return capitalizedCount >= 2 && capitalizedCount / words.length >= 0.65;
  };

  const freq = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    const t = stripMarkdownFormatting(lines[i]);
    if (isCandidateBanner(i, t)) {
      freq.set(t, (freq.get(t) || 0) + 1);
    }
  }

  const repeatedTitles = new Set<string>();
  for (const [text, count] of freq.entries()) {
    if (count >= 2) {
      repeatedTitles.add(text);
    }
  }

  return lines.filter((raw, idx) => {
    const t = stripMarkdownFormatting(raw);
    if (isPdfPageNoiseLine(t)) return false;
    if (repeatedTitles.has(t) && isCandidateBanner(idx, t)) return false;
    return true;
  });
}

function looksLikeIpaContent(inner: string): boolean {
  if (!inner || inner.length > 90) return false;
  if (/^https?:\/\//i.test(inner) || inner.includes('://')) return false;
  if (containsCyrillic(inner)) return false;
  return (
    /[a-zəɪʊɔɑæɜʌʃʒθðŋɡɒɛ]/i.test(inner) &&
    !/[A-Z]{4,}/.test(inner)
  );
}

function rejoinSplitIpaLines(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    let curr = lines[i];

    // Check if curr ends with an unclosed IPA slash: e.g. "advertisement /ədˈvɜːtɪs" or "/ˈklæsɪkəl"
    const unclosedSlash = curr.match(/(?:^|\s)(\/[^/\n]{1,65})$/);
    if (
      unclosedSlash &&
      !/^https?:/i.test(unclosedSlash[1]) &&
      !curr.slice(0, curr.length - unclosedSlash[1].length).includes('http') &&
      i + 1 < lines.length
    ) {
      const next = lines[i + 1].trim();
      const closingSlash = next.match(/^([^/\n]{1,65}\/)(?:\s+(.*))?$/);
      if (closingSlash && looksLikeIpaContent(unclosedSlash[1].slice(1) + closingSlash[1].slice(0, -1))) {
        const startsWithNewWordStress = /^[ˈˌ]/.test(closingSlash[1]);
        const joiner = startsWithNewWordStress ? ' ' : '';
        const combined = `${curr}${joiner}${closingSlash[1]}${closingSlash[2] ? ' ' + closingSlash[2] : ''}`;
        result.push(combined);
        i += 2;
        continue;
      }
    }

    // Check unclosed [ipa]
    const unclosedBracket = curr.match(/(?:^|\s)(\[[^\][\n]{1,65})$/);
    if (unclosedBracket && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      const closingBracket = next.match(/^([^\][\n]{1,65}\])(?:\s+(.*))?$/);
      if (closingBracket && looksLikeIpaContent(unclosedBracket[1].slice(1) + closingBracket[1].slice(0, -1))) {
        const startsWithNewWordStress = /^[ˈˌ]/.test(closingBracket[1]);
        const joiner = startsWithNewWordStress ? ' ' : '';
        const combined = `${curr}${joiner}${closingBracket[1]}${closingBracket[2] ? ' ' + closingBracket[2] : ''}`;
        result.push(combined);
        i += 2;
        continue;
      }
    }

    result.push(curr);
    i++;
  }

  return result;
}

const IPA_REGEX = /(?:^|\s)(\/[^/\n]{1,90}\/|\[[^\][\n]{1,90}\])(?=\s|$)/;

function findIpaInLine(line: string): { ipa: string; index: number; end: number } | null {
  const cleaned = stripMarkdownFormatting(line);
  const slashMatch = cleaned.match(/(?:^|\s)(\/[^/\n]{1,90}\/)(?=\s|$|[.,;])/);
  if (slashMatch && slashMatch.index !== undefined) {
    const token = slashMatch[1];
    const inner = token.slice(1, -1);
    if (looksLikeIpaContent(inner) && !/^n\/v$|^v\/n$|^adj\/adv$/i.test(inner)) {
      const start = slashMatch.index + (slashMatch[0].startsWith(' ') ? 1 : 0);
      return { ipa: token.trim(), index: start, end: start + token.length };
    }
  }

  const bracketMatch = cleaned.match(/(?:^|\s)(\[[^\][\n]{1,90}\])(?=\s|$|[.,;])/);
  if (bracketMatch && bracketMatch.index !== undefined) {
    const token = bracketMatch[1];
    const inner = token.slice(1, -1);
    if (!KNOWN_POS_KEYS.has(inner.toLowerCase()) && looksLikeIpaContent(inner)) {
      const start = bracketMatch.index + (bracketMatch[0].startsWith(' ') ? 1 : 0);
      return { ipa: token.trim(), index: start, end: start + token.length };
    }
  }
  return null;
}

function extractWordAndPos(rawHeader: string): { word: string; partOfSpeech: string } {
  let line = rawHeader.trim().replace(/^(?:\d+[.)]\s+|[-•]\s+)/, '').trim();
  if (!line) return { word: '', partOfSpeech: '' };

  // Pattern: **word** _pos_
  const mdMatch = line.match(
    /^\*\*([^*\n]+)\*\*\s*(?:[_*([]\s*([a-zA-Z./,\s]{1,20})\s*[_*)\]]|([a-zA-Z./]{1,12}))?$/
  );
  if (mdMatch) {
    const word = stripMarkdownFormatting(mdMatch[1]);
    const posCandidate = mdMatch[2] || mdMatch[3] || '';
    const posKey = posCandidate.replace(/\./g, '').trim().toLowerCase();
    if (!posCandidate || KNOWN_POS_KEYS.has(posKey)) {
      return { word, partOfSpeech: normalizePos(posCandidate) };
    }
  }

  const plain = stripMarkdownFormatting(line);

  // Pattern: word (pos) or word [pos] or word - pos
  const parenMatch = plain.match(
    /^([a-zA-Z][a-zA-Z\s'’/-]{0,60}?)\s*(?:\(([a-zA-Z./,\s]{1,20})\)|\[([a-zA-Z./,\s]{1,20})\]|\s[-–—]\s([a-zA-Z./,\s]{1,20}))$/
  );
  if (parenMatch) {
    const posRaw = (parenMatch[2] || parenMatch[3] || parenMatch[4] || '')
      .replace(/\./g, '')
      .trim()
      .toLowerCase();
    if (KNOWN_POS_KEYS.has(posRaw)) {
      return {
        word: parenMatch[1].trim(),
        partOfSpeech: normalizePos(posRaw),
      };
    }
  }

  // Pattern: "word pos" e.g. "advertisement n" or "look after phr v"
  const tokens = plain.split(/\s+/);
  if (tokens.length >= 2 && !/[.!?]$/.test(plain)) {
    const lastTwo = tokens.slice(-2).join(' ').replace(/\./g, '').toLowerCase();
    if (tokens.length >= 3 && KNOWN_POS_KEYS.has(lastTwo)) {
      return {
        word: tokens.slice(0, -2).join(' '),
        partOfSpeech: normalizePos(lastTwo),
      };
    }
    const lastOne = tokens[tokens.length - 1].replace(/\./g, '').toLowerCase();
    if (KNOWN_POS_KEYS.has(lastOne) && tokens.length <= 5) {
      return {
        word: tokens.slice(0, -1).join(' '),
        partOfSpeech: normalizePos(lastOne),
      };
    }
  }

  return { word: plain, partOfSpeech: '' };
}

function tryExplicitHeader(rawLine: string): {
  word: string;
  partOfSpeech: string;
  pronunciation: string;
} | null {
  let line = rawLine.trim().replace(/^(?:\d+[.)]\s+|[-•]\s+)/, '').trim();
  if (!line || containsCyrillic(line)) return null;

  const ipaHit = findIpaInLine(line);
  const cleaned = stripMarkdownFormatting(line);
  const beforeIpa = ipaHit ? cleaned.slice(0, ipaHit.index).trim() : line;

  // Check explicit POS or markdown bold
  const hasMdBold = /^\*\*[^*\n]+\*\*/.test(beforeIpa);
  const { word, partOfSpeech } = extractWordAndPos(beforeIpa);

  if (hasMdBold && word) {
    return { word, partOfSpeech, pronunciation: ipaHit ? ipaHit.ipa : '' };
  }
  if (partOfSpeech && word && !/[.!?]$/.test(word)) {
    return { word, partOfSpeech, pronunciation: ipaHit ? ipaHit.ipa : '' };
  }
  return null;
}

function looksLikeEnglishSentenceText(text: string): boolean {
  const latinOnly = text.replace(/[\u0400-\u04FF]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!latinOnly) return false;
  // Uzbek-specific markers (apostrophe forms like o', g', suffixes like -moq, -lik, -ning, -dagi) reduce English false-positives
  const hasUzbekMarkers =
    /\b\w*(?:moq|ning|dagi|uchun|bilan|qilmoq|etmoq|bo['’]lmoq)\b/i.test(latinOnly) ||
    /(?:o|g)['’ʻʼ]/i.test(latinOnly);
  const hasEnglishFunctionWords =
    /\b(the|a|an|is|are|was|were|have|has|had|can|could|couldn't|couldn’t|would|will|didn't|didn’t|don't|don’t|i've|i’ve|he|she|they|we|you|my|your|his|her|their|this|that)\b/i.test(
      latinOnly
    );

  const words = latinOnly.split(/\s+/);
  if (words.length >= 6 && /[.!?]["”'’)]?$/.test(latinOnly) && !hasUzbekMarkers) return true;
  if (words.length >= 8 && hasEnglishFunctionWords) return true;
  if (/[.!?]["”'’)]?$/.test(latinOnly) && words.length >= 4 && hasEnglishFunctionWords) {
    return true;
  }
  return false;
}

function splitCyrillicRussianAndUzbek(text: string): {
  beforeCyrillic: string;
  russian: string;
  afterCyrillic: string;
} {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return { beforeCyrillic: '', russian: '', afterCyrillic: '' };
  }

  const firstCyrMatch = normalized.match(/[\u0400-\u04FF]/);
  if (!firstCyrMatch || firstCyrMatch.index === undefined) {
    return { beforeCyrillic: normalized, russian: '', afterCyrillic: '' };
  }

  let startIdx = firstCyrMatch.index;
  // Include hyphenated Latin prefix directly attached to Cyrillic (e.g. "SMS-сообщение")
  const prefixSlice = normalized.slice(0, startIdx);
  const attachedLatinPrefix = prefixSlice.match(/([A-Za-z0-9]+-)$/);
  if (attachedLatinPrefix) {
    startIdx -= attachedLatinPrefix[1].length;
  }
  // Include opening parenthesis right before Cyrillic if matching closing paren is in Cyrillic
  if (startIdx > 0 && normalized[startIdx - 1] === '(') {
    startIdx -= 1;
  }

  // Find last Cyrillic character
  let lastCyrIdx = -1;
  for (let i = normalized.length - 1; i >= startIdx; i--) {
    if (/[\u0400-\u04FF]/.test(normalized[i])) {
      lastCyrIdx = i;
      break;
    }
  }

  let endIdx = lastCyrIdx + 1;
  // Include trailing closing parenthesis or punctuation attached to the Russian phrase
  while (endIdx < normalized.length && /[)!?.]/.test(normalized[endIdx])) {
    endIdx++;
  }

  // If everything after endIdx contains NO Latin letters (e.g. trailing numbers "реклама 1"), keep it in Russian
  const rawAfter = normalized.slice(endIdx).trim();
  if (rawAfter && !/[a-zA-Z]/.test(rawAfter)) {
    endIdx = normalized.length;
  }

  const beforeCyrillic = normalized.slice(0, startIdx).trim();
  const russian = normalized
    .slice(startIdx, endIdx)
    .replace(/^[,;\s]+|[,;\s]+$/g, '')
    .trim();
  const afterCyrillic = normalized
    .slice(endIdx)
    .replace(/^[,;\s]+/, '')
    .trim();

  return { beforeCyrillic, russian, afterCyrillic };
}

function parseCsvLine(line: string, delimiter: ',' | ';'): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if (ch === '\n' && !inQuotes) {
      if (current.trim()) records.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) records.push(current);
  return records;
}

export function validateEntryFields(
  fields: {
    word: string;
    partOfSpeech: string;
    pronunciation: string;
    exampleSentence: string;
    russianTranslation: string;
    uzbekTranslation: string;
  },
  isDuplicate: boolean,
  extraReasons: string[] = []
): {
  warnings: string[];
  correctionReasons: string[];
  needsCorrection: boolean;
} {
  const correctionReasons: string[] = [...extraReasons];
  const warnings: string[] = [];

  const word = fields.word.trim();
  const example = fields.exampleSentence.trim();
  const russian = fields.russianTranslation.trim();
  const uzbek = fields.uzbekTranslation.trim();

  if (!word) {
    correctionReasons.push('Inglizcha so‘z kiritilmagan');
  } else {
    if (containsCyrillic(word)) {
      correctionReasons.push('Inglizcha so‘z maydonida kirill harflari bor');
    }
    if (/[.!?]$/.test(word) || word.split(/\s+/).length > 6) {
      correctionReasons.push('So‘z maydoni butun gapga o‘xshaydi');
    }
  }

  if (!uzbek) {
    correctionReasons.push('O‘zbekcha tarjima bo‘sh');
  } else {
    if (containsCyrillic(uzbek)) {
      correctionReasons.push('O‘zbekcha tarjima maydonida kirill matni aralashgan');
    }
    if (looksLikeEnglishSentenceText(uzbek)) {
      correctionReasons.push('O‘zbekcha tarjima ichida inglizcha misol gap aralashgan bo‘lishi mumkin');
    }
  }

  if (!russian) {
    correctionReasons.push('Ruscha tarjima topilmadi');
  } else if (!containsCyrillic(russian)) {
    correctionReasons.push('Ruscha tarjimada kirill matni topilmadi');
  }

  if (!example) {
    correctionReasons.push('Misol gap topilmadi');
  } else if (containsCyrillic(example)) {
    correctionReasons.push('Misol gap maydonida kirill harflari aralashgan');
  }

  if (isDuplicate) {
    warnings.push('Bu so‘z lug‘atingizda allaqachon mavjud');
  }

  const dedupedReasons = Array.from(new Set(correctionReasons));
  const needsCorrection = dedupedReasons.length > 0;

  return {
    warnings: [...dedupedReasons, ...warnings],
    correctionReasons: dedupedReasons,
    needsCorrection,
  };
}

function tryParseStructuredTable(normalizedText: string): ParsedVocabDraft[] | null {
  const rawLines = normalizedText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (rawLines.length === 0) return null;

  let delimiter: '\t' | '|' | ',' | ';' | null = null;

  const tabLines = rawLines.filter((l) => l.includes('\t')).length;
  const pipeLines = rawLines.filter((l) => l.split('|').length >= 4).length;

  if (tabLines >= Math.max(1, Math.floor(rawLines.length * 0.6))) {
    delimiter = '\t';
  } else if (pipeLines >= Math.max(1, Math.floor(rawLines.length * 0.6))) {
    delimiter = '|';
  } else {
    const csvLines = splitCsvRecords(normalizedText);
    const semicolonLines = csvLines.filter((l) => parseCsvLine(l, ';').length >= 4).length;
    const commaLines = csvLines.filter((l) => parseCsvLine(l, ',').length >= 4).length;
    if (semicolonLines === csvLines.length && semicolonLines >= 1) {
      delimiter = ';';
    } else if (commaLines === csvLines.length && commaLines >= 1) {
      delimiter = ',';
    }
  }

  if (!delimiter) return null;

  const rowStrings =
    delimiter === ',' || delimiter === ';'
      ? splitCsvRecords(normalizedText)
      : rawLines;

  const parsedRows: Array<{
    word: string;
    partOfSpeech: string;
    pronunciation: string;
    exampleSentence: string;
    russianTranslation: string;
    uzbekTranslation: string;
    extraReasons: string[];
  }> = [];

  for (const rowStr of rowStrings) {
    let cells: string[];
    if (delimiter === '\t') {
      cells = rowStr.split('\t').map((c) => stripMarkdownFormatting(c));
    } else if (delimiter === '|') {
      cells = rowStr
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => stripMarkdownFormatting(c));
      // Skip markdown table divider row like |---|---|---|
      if (cells.every((c) => /^:?-+:?$/.test(c) || c === '')) continue;
    } else {
      cells = parseCsvLine(rowStr, delimiter).map((c) => stripMarkdownFormatting(c));
    }

    if (cells.every((c) => !c)) continue;

    // Check if header row
    const joinedHeaderCheck = cells.join(' ').toLowerCase();
    const headerHits = cells.filter((c) => TABLE_HEADER_KEYWORDS.has(c.toLowerCase())).length;
    if (headerHits >= 2 || isHeaderKeywordLine(joinedHeaderCheck)) {
      continue;
    }

    let rawWord = '';
    let rawPos = '';
    let pronunciation = '';
    let exampleSentence = '';
    let russianTranslation = '';
    let uzbekTranslation = '';
    const extraReasons: string[] = [];

    if (cells.length >= 6) {
      // Check if column 2 is POS
      const col2Clean = cells[1].replace(/\./g, '').trim().toLowerCase();
      if (KNOWN_POS_KEYS.has(col2Clean)) {
        rawWord = cells[0];
        rawPos = normalizePos(col2Clean);
        pronunciation = cells[2];
        exampleSentence = cells[3];
        russianTranslation = cells[4];
        uzbekTranslation = cells.slice(5).join(', ');
      } else {
        rawWord = cells[0];
        pronunciation = cells[1];
        exampleSentence = cells[2];
        russianTranslation = cells[3];
        uzbekTranslation = cells.slice(4).join(', ');
      }
    } else if (cells.length === 5) {
      [rawWord, pronunciation, exampleSentence, russianTranslation, uzbekTranslation] = cells;
    } else if (cells.length === 4) {
      // Auto-detect missing column (either pronunciation or example)
      rawWord = cells[0];
      const ipaHit = findIpaInLine(cells[1]);
      if (ipaHit) {
        pronunciation = cells[1];
        if (containsCyrillic(cells[2])) {
          russianTranslation = cells[2];
          uzbekTranslation = cells[3];
        } else {
          exampleSentence = cells[2];
          if (containsCyrillic(cells[3])) {
            russianTranslation = cells[3];
          } else {
            uzbekTranslation = cells[3];
          }
        }
      } else {
        exampleSentence = cells[1];
        russianTranslation = cells[2];
        uzbekTranslation = cells[3];
      }
    } else if (cells.length >= 2) {
      rawWord = cells[0];
      for (let c = 1; c < cells.length; c++) {
        const val = cells[c];
        if (!val) continue;
        if (!pronunciation && findIpaInLine(val)) {
          pronunciation = val;
        } else if (containsCyrillic(val)) {
          russianTranslation = russianTranslation ? `${russianTranslation}, ${val}` : val;
        } else if (!exampleSentence && looksLikeEnglishSentenceText(val)) {
          exampleSentence = val;
        } else {
          uzbekTranslation = uzbekTranslation ? `${uzbekTranslation}, ${val}` : val;
        }
      }
      extraReasons.push('Jadval ustunlari 5 tadan kam — maydonlarni tekshiring');
    }

    const { word, partOfSpeech } = extractWordAndPos(rawWord);

    parsedRows.push({
      word,
      partOfSpeech: rawPos || partOfSpeech,
      pronunciation,
      exampleSentence,
      russianTranslation,
      uzbekTranslation,
      extraReasons,
    });
  }

  if (parsedRows.length === 0) return null;

  return parsedRows.map((r, idx) => ({
    tempId: `draft-s-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
    word: r.word,
    partOfSpeech: r.partOfSpeech,
    pronunciation: r.pronunciation,
    exampleSentence: r.exampleSentence,
    russianTranslation: r.russianTranslation,
    uzbekTranslation: r.uzbekTranslation,
    warnings: [],
    correctionReasons: r.extraReasons,
    needsCorrection: r.extraReasons.length > 0,
    confirmedByUser: false,
    isDuplicate: false,
    importMode: 'structured',
  }));
}

interface UnstructuredBlock {
  rawWordLine: string;
  word: string;
  partOfSpeech: string;
  pronunciation: string;
  bodyLines: string[];
  extraReasons: string[];
}

function splitSmashedSingleLineEntries(lines: string[]): Array<{ text: string; smashedWarning: boolean }> {
  const expanded: Array<{ text: string; smashedWarning: boolean }> = [];

  for (const line of lines) {
    const cleaned = stripMarkdownFormatting(line);
    // Check if a single line contains Cyrillic AND THEN a new IPA later on the SAME line!
    // e.g. "I want ... реклама reklama afford /əˈfɔːrd/ The family ..."
    const firstCyr = cleaned.search(/[\u0400-\u04FF]/);
    if (firstCyr !== -1) {
      const tailAfterCyr = cleaned.slice(firstCyr);
      const laterIpa = tailAfterCyr.match(IPA_REGEX);
      if (laterIpa && laterIpa.index !== undefined) {
        // Walk and split across all Cyrillic -> IPA transitions on the line
        let remaining = line;
        let safety = 0;
        let wasSplit = false;
        while (safety < 50) {
          safety++;
          const remClean = stripMarkdownFormatting(remaining);
          const cyrIdx = remClean.search(/[\u0400-\u04FF]/);
          if (cyrIdx === -1) {
            expanded.push({ text: remaining, smashedWarning: wasSplit });
            break;
          }
          const afterCyr = remClean.slice(cyrIdx);
          const ipaHit = findIpaInLine(afterCyr);
          if (!ipaHit) {
            expanded.push({ text: remaining, smashedWarning: wasSplit });
            break;
          }

          // Locate where the Cyrillic ends and the segment before the next IPA begins
          const splitData = splitCyrillicRussianAndUzbek(afterCyr.slice(0, ipaHit.index));
          const prefixBeforeCyr = remClean.slice(0, cyrIdx);
          const betweenCyrAndIpa = splitData.afterCyrillic;

          const leftChunk = `${prefixBeforeCyr}${splitData.russian ? splitData.russian : ''}${betweenCyrAndIpa ? ' ' + betweenCyrAndIpa : ''}`.trim();
          expanded.push({ text: leftChunk, smashedWarning: true });
          remaining = afterCyr.slice(ipaHit.index);
          wasSplit = true;
        }
        continue;
      }
    }
    expanded.push({ text: line, smashedWarning: false });
  }

  return expanded;
}

function parseUnstructuredPdfText(normalizedText: string): ParsedVocabDraft[] {
  const initialLines = normalizedText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isSeparatorLine(l));

  const withoutNoise = stripRepeatedPdfBanners(initialLines);
  const rejoinedLines = rejoinSplitIpaLines(withoutNoise);
  const lineEntries = splitSmashedSingleLineEntries(rejoinedLines);

  if (lineEntries.length === 0) return [];

  // Check if text predominantly uses IPA anchors
  const ipaLineIndices: number[] = [];
  for (let i = 0; i < lineEntries.length; i++) {
    if (findIpaInLine(lineEntries[i].text)) {
      ipaLineIndices.push(i);
    }
  }

  const blocks: UnstructuredBlock[] = [];

  if (ipaLineIndices.length >= 1) {
    // IPA-anchored segmentation!
    // Each IPA line `idx` either has the word on the same line (before IPA),
    // OR the word is on line `idx - 1` (when nothing precedes IPA on line `idx`).
    interface Anchor {
      wordLineIndex: number;
      ipaLineIndex: number;
      word: string;
      partOfSpeech: string;
      ipa: string;
      trailingBodyOnIpaLine: string;
      smashedWarning: boolean;
    }

    const anchors: Anchor[] = [];

    for (let k = 0; k < ipaLineIndices.length; k++) {
      const ipaLineIdx = ipaLineIndices[k];
      const rawLine = lineEntries[ipaLineIdx].text;
      const cleaned = stripMarkdownFormatting(rawLine);
      const ipaHit = findIpaInLine(rawLine)!;

      const beforeIpaClean = cleaned.slice(0, ipaHit.index).trim();
      const afterIpaClean = cleaned.slice(ipaHit.end).trim();

      if (beforeIpaClean.length > 0) {
        const { word, partOfSpeech } = extractWordAndPos(beforeIpaClean);
        anchors.push({
          wordLineIndex: ipaLineIdx,
          ipaLineIndex: ipaLineIdx,
          word,
          partOfSpeech,
          ipa: ipaHit.ipa,
          trailingBodyOnIpaLine: afterIpaClean,
          smashedWarning: lineEntries[ipaLineIdx].smashedWarning,
        });
      } else {
        // IPA is at the start of line `ipaLineIdx` -> check previous line for Word
        const prevAnchorEnd = k > 0 ? anchors[k - 1].ipaLineIndex : -1;
        const candidateWordIdx = ipaLineIdx - 1;
        const prevLineRaw = candidateWordIdx > prevAnchorEnd ? lineEntries[candidateWordIdx].text : '';
        const prevClean = stripMarkdownFormatting(prevLineRaw);
        const prevIsPlausibleWordLine =
          candidateWordIdx > prevAnchorEnd &&
          !lineEntries[candidateWordIdx].smashedWarning &&
          !containsCyrillic(prevClean) &&
          !looksLikeEnglishSentenceText(prevClean);

        if (prevIsPlausibleWordLine) {
          const { word, partOfSpeech } = extractWordAndPos(prevLineRaw);
          anchors.push({
            wordLineIndex: candidateWordIdx,
            ipaLineIndex: ipaLineIdx,
            word,
            partOfSpeech,
            ipa: ipaHit.ipa,
            trailingBodyOnIpaLine: afterIpaClean,
            smashedWarning: lineEntries[ipaLineIdx].smashedWarning,
          });
        } else {
          // No clean word line found before IPA!
          anchors.push({
            wordLineIndex: ipaLineIdx,
            ipaLineIndex: ipaLineIdx,
            word: '',
            partOfSpeech: '',
            ipa: ipaHit.ipa,
            trailingBodyOnIpaLine: afterIpaClean,
            smashedWarning: true,
          });
        }
      }
    }

    // Check if there were leftover lines BEFORE the first anchor's wordLineIndex
    if (anchors.length > 0 && anchors[0].wordLineIndex > 0) {
      const orphanLines = lineEntries
        .slice(0, anchors[0].wordLineIndex)
        .map((e) => stripMarkdownFormatting(e.text));
      const firstHeader = tryExplicitHeader(orphanLines[0] || '');
      if (firstHeader) {
        blocks.push({
          rawWordLine: orphanLines[0],
          word: firstHeader.word,
          partOfSpeech: firstHeader.partOfSpeech,
          pronunciation: firstHeader.pronunciation,
          bodyLines: orphanLines.slice(1),
          extraReasons: [],
        });
      } else if (orphanLines.length > 0) {
        const { word, partOfSpeech } = extractWordAndPos(orphanLines[0]);
        blocks.push({
          rawWordLine: orphanLines[0],
          word,
          partOfSpeech,
          pronunciation: '',
          bodyLines: orphanLines.slice(1),
          extraReasons: ['IPA transkripsiya topilmadi — chegarani tekshiring'],
        });
      }
    }

    const splitBodyIfContainsEmbeddedNoIpaEntry = (
      baseBlock: UnstructuredBlock
    ): UnstructuredBlock[] => {
      const lines = baseBlock.bodyLines;
      let firstCyr = -1;
      let nonCyrAfterFirst = -1;
      let secondCyr = -1;

      for (let i = 0; i < lines.length; i++) {
        const hasCyr = containsCyrillic(lines[i]);
        if (firstCyr === -1) {
          if (hasCyr) firstCyr = i;
        } else if (nonCyrAfterFirst === -1) {
          if (!hasCyr) nonCyrAfterFirst = i;
        } else if (hasCyr) {
          secondCyr = i;
          break;
        }
      }

      if (secondCyr === -1) {
        return [baseBlock];
      }

      // Split between the Uzbek line (nonCyrAfterFirst) and the embedded next entry before secondCyr
      // Look after nonCyrAfterFirst for an explicit header or candidate word line before secondCyr
      let splitAt = nonCyrAfterFirst + 1;
      if (splitAt >= secondCyr) {
        // Not even one line between Uzbek and second Cyrillic — ambiguous boundary
        splitAt = nonCyrAfterFirst + 1;
      }

      const firstBody = lines.slice(0, splitAt);
      const restLines = lines.slice(splitAt);
      const firstBlock: UnstructuredBlock = {
        ...baseBlock,
        bodyLines: firstBody,
      };

      if (restLines.length === 0) {
        return [firstBlock];
      }

      const explicit = tryExplicitHeader(restLines[0]);
      const { word, partOfSpeech } = explicit || extractWordAndPos(restLines[0]);
      const nextBlock: UnstructuredBlock = {
        rawWordLine: restLines[0],
        word,
        partOfSpeech,
        pronunciation: explicit?.pronunciation || '',
        bodyLines: restLines.slice(1),
        extraReasons: explicit ? [] : ['IPA transkripsiya topilmadi — chegarani tekshiring'],
      };

      return [firstBlock, ...splitBodyIfContainsEmbeddedNoIpaEntry(nextBlock)];
    };

    // Build block for each IPA anchor
    for (let k = 0; k < anchors.length; k++) {
      const curr = anchors[k];
      const nextWordLineIdx =
        k + 1 < anchors.length ? anchors[k + 1].wordLineIndex : lineEntries.length;

      const bodyLines: string[] = [];
      if (curr.trailingBodyOnIpaLine) {
        bodyLines.push(curr.trailingBodyOnIpaLine);
      }

      let hasSmashed = curr.smashedWarning;
      for (let j = curr.ipaLineIndex + 1; j < nextWordLineIdx; j++) {
        const cleanedBody = stripMarkdownFormatting(lineEntries[j].text);
        if (cleanedBody) {
          bodyLines.push(cleanedBody);
        }
        if (lineEntries[j].smashedWarning) {
          hasSmashed = true;
        }
      }

      const extraReasons: string[] = [];
      if (hasSmashed) {
        extraReasons.push(
          'Qator chegarasi noaniq: so‘zlar bitta qatorga birlashib ketgan — maydonlarni tekshiring'
        );
      }
      if (!curr.word) {
        extraReasons.push('IPA oldidan inglizcha so‘z topilmadi');
      }

      const rawBlock: UnstructuredBlock = {
        rawWordLine: curr.word,
        word: curr.word,
        partOfSpeech: curr.partOfSpeech,
        pronunciation: curr.ipa,
        bodyLines,
        extraReasons,
      };

      blocks.push(...splitBodyIfContainsEmbeddedNoIpaEntry(rawBlock));
    }
  } else {
    // Fallback heuristic when NO IPA is present anywhere in the pasted text
    let current: { lines: string[]; explicit: boolean } | null = null;

    const hasBothTranslations = (lines: string[]) => {
      let seenCyr = false;
      let seenLatAfter = false;
      for (let i = 1; i < lines.length; i++) {
        const l = stripMarkdownFormatting(lines[i]);
        if (!l) continue;
        if (containsCyrillic(l)) seenCyr = true;
        else if (seenCyr) seenLatAfter = true;
      }
      return seenCyr && seenLatAfter;
    };

    const rawGroups: string[][] = [];
    for (let i = 0; i < lineEntries.length; i++) {
      const line = lineEntries[i].text;
      const explicitHeader = tryExplicitHeader(line);

      if (!current) {
        current = { lines: [line], explicit: Boolean(explicitHeader) };
        continue;
      }

      const finished = hasBothTranslations(current.lines);
      const plain = stripMarkdownFormatting(line);
      const startsNew =
        (explicitHeader !== null && current.lines.length >= 2) ||
        (finished &&
          !containsCyrillic(plain) &&
          plain.split(/\s+/).length <= 4 &&
          !/[.!?]$/.test(plain));

      if (startsNew) {
        rawGroups.push(current.lines);
        current = { lines: [line], explicit: Boolean(explicitHeader) };
      } else {
        current.lines.push(line);
      }
    }
    if (current) rawGroups.push(current.lines);

    for (const grp of rawGroups) {
      const explicit = tryExplicitHeader(grp[0]);
      const { word, partOfSpeech } = explicit
        ? explicit
        : extractWordAndPos(grp[0]);
      blocks.push({
        rawWordLine: grp[0],
        word,
        partOfSpeech,
        pronunciation: explicit?.pronunciation || '',
        bodyLines: grp.slice(1).map((l) => stripMarkdownFormatting(l)),
        extraReasons: [],
      });
    }
  }

  // Extract Example, Russian, and Uzbek from each block's bodyLines cleanly!
  return blocks.map((block, index) => {
    const joinedBody = block.bodyLines.join('\n');
    const lines = block.bodyLines;

    let exampleSentence = '';
    let russianTranslation = '';
    let uzbekTranslation = '';
    const extraReasons = [...block.extraReasons];

    // Check if body contains Cyrillic
    const firstCyrLineIdx = lines.findIndex((l) => containsCyrillic(l));

    if (firstCyrLineIdx !== -1) {
      // Find last line containing Cyrillic
      let lastCyrLineIdx = firstCyrLineIdx;
      for (let i = lines.length - 1; i >= firstCyrLineIdx; i--) {
        if (containsCyrillic(lines[i])) {
          lastCyrLineIdx = i;
          break;
        }
      }

      // Lines strictly before first Cyrillic line belong to the English example sentence
      const preCyrLines = lines.slice(0, firstCyrLineIdx);

      // Process the Cyrillic span (which may include English tail on first line and Uzbek tail on last line)
      const firstCyrSplit = splitCyrillicRussianAndUzbek(lines[firstCyrLineIdx]);

      if (firstCyrSplit.beforeCyrillic) {
        preCyrLines.push(firstCyrSplit.beforeCyrillic);
      }
      exampleSentence = preCyrLines.join(' ').replace(/\s+/g, ' ').trim();

      if (firstCyrLineIdx === lastCyrLineIdx) {
        russianTranslation = firstCyrSplit.russian;
        const postLines = [
          ...(firstCyrSplit.afterCyrillic ? [firstCyrSplit.afterCyrillic] : []),
          ...lines.slice(lastCyrLineIdx + 1),
        ];
        uzbekTranslation = postLines.join(' ').replace(/\s+/g, ' ').trim();
      } else {
        // Multi-line Russian span
        const cyrParts: string[] = [];
        if (firstCyrSplit.russian) cyrParts.push(firstCyrSplit.russian);
        if (firstCyrSplit.afterCyrillic) {
          // Unexpected Latin inside multi-line Cyrillic block
          cyrParts.push(firstCyrSplit.afterCyrillic);
          extraReasons.push('Ruscha tarjima qatorlari orasida lotin matni aniqlandi');
        }
        for (let i = firstCyrLineIdx + 1; i < lastCyrLineIdx; i++) {
          cyrParts.push(lines[i]);
        }
        const lastCyrSplit = splitCyrillicRussianAndUzbek(lines[lastCyrLineIdx]);
        if (lastCyrSplit.beforeCyrillic) cyrParts.push(lastCyrSplit.beforeCyrillic);
        if (lastCyrSplit.russian) cyrParts.push(lastCyrSplit.russian);

        russianTranslation = cyrParts.join(' ').replace(/\s+/g, ' ').trim();

        const postLines = [
          ...(lastCyrSplit.afterCyrillic ? [lastCyrSplit.afterCyrillic] : []),
          ...lines.slice(lastCyrLineIdx + 1),
        ];
        uzbekTranslation = postLines.join(' ').replace(/\s+/g, ' ').trim();
      }
    } else if (lines.length > 0) {
      // No Cyrillic found in this block at all!
      if (lines.length >= 2) {
        const lastLine = lines[lines.length - 1];
        const leadingLines = lines.slice(0, -1).join(' ').replace(/\s+/g, ' ').trim();
        if (looksLikeEnglishSentenceText(leadingLines) && !looksLikeEnglishSentenceText(lastLine)) {
          exampleSentence = leadingLines;
          uzbekTranslation = lastLine;
        } else {
          // Ambiguous without Cyrillic separator
          exampleSentence = lines.join(' ');
          extraReasons.push('Ruscha tarjima topilmadi — misol va o‘zbekcha tarjimani ajratib tekshiring');
        }
      } else {
        const single = joinedBody.trim();
        if (looksLikeEnglishSentenceText(single)) {
          exampleSentence = single;
        } else {
          uzbekTranslation = single;
        }
      }
    }

    return {
      tempId: `draft-u-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      word: block.word,
      partOfSpeech: block.partOfSpeech,
      pronunciation: block.pronunciation,
      exampleSentence,
      russianTranslation,
      uzbekTranslation,
      warnings: [],
      correctionReasons: extraReasons,
      needsCorrection: extraReasons.length > 0,
      confirmedByUser: false,
      isDuplicate: false,
      importMode: 'unstructured',
    };
  });
}

export function revalidateDraftList(
  drafts: ParsedVocabDraft[],
  existingItems: Pick<OriginalVocabSnapshot, 'word'>[]
): ParsedVocabDraft[] {
  const existingSet = new Set(existingItems.map((item) => item.word.trim().toLowerCase()));
  const seenInBatch = new Set<string>();

  return drafts.map((draft) => {
    const key = draft.word.trim().toLowerCase();
    const isDuplicate = key.length > 0 && (existingSet.has(key) || seenInBatch.has(key));
    if (key) seenInBatch.add(key);

    // Keep structural/boundary reasons that aren't field-level, or re-evaluate cleanly if user edited or confirmed
    const boundaryReasons = draft.confirmedByUser
      ? []
      : draft.correctionReasons.filter(
          (r) =>
            r.includes('chegara') ||
            r.includes('Chegara') ||
            r.includes('birlashib') ||
            r.includes('ustunlari') ||
            r.includes('orasida')
        );

    const validation = validateEntryFields(draft, isDuplicate, boundaryReasons);
    const hardInvalid =
      !draft.word.trim() ||
      !draft.uzbekTranslation.trim() ||
      containsCyrillic(draft.word) ||
      containsCyrillic(draft.uzbekTranslation) ||
      looksLikeEnglishSentenceText(draft.uzbekTranslation);

    // If user explicitly confirmed a minor warning (e.g. missing Russian or missing Example), allow Ready state unless hard-invalid
    const needsCorrection = hardInvalid
      ? true
      : draft.confirmedByUser
        ? false
        : validation.needsCorrection;

    return {
      ...draft,
      isDuplicate,
      warnings: validation.warnings,
      correctionReasons: validation.correctionReasons,
      needsCorrection,
    };
  });
}

export function parseVocabularyText(
  rawText: string,
  existingItems: Pick<OriginalVocabSnapshot, 'word'>[] = []
): ParsedVocabDraft[] {
  if (!rawText || !rawText.trim()) return [];

  // If HTML table was pasted directly into text
  const maybeTableTsv = extractTableFromHtml(rawText);
  const normalized = normalizeRawInput(maybeTableTsv ?? rawText);
  if (!normalized.trim()) return [];

  // Path A: Structured Table Import (TSV, pipe table, CSV, HTML table)
  const structured = tryParseStructuredTable(normalized);
  if (structured !== null) {
    return revalidateDraftList(structured, existingItems);
  }

  // Path B: Unstructured PDF Text Import
  const unstructured = parseUnstructuredPdfText(normalized);
  return revalidateDraftList(unstructured, existingItems);
}

export function detectSuspiciousRecord(
  record: Pick<
    OriginalVocabSnapshot,
    'word' | 'exampleSentence' | 'russianTranslation' | 'uzbekTranslation'
  >
): string[] {
  const reasons: string[] = [];
  if (!record.word.trim() || containsCyrillic(record.word) || record.word.split(/\s+/).length > 6) {
    reasons.push('So‘z maydoni noto‘g‘ri ko‘rinadi');
  }
  if (containsCyrillic(record.uzbekTranslation)) {
    reasons.push('O‘zbekcha tarjimada kirill matni aralashgan');
  }
  if (looksLikeEnglishSentenceText(record.uzbekTranslation) || /\/[^/\n]+\//.test(record.uzbekTranslation)) {
    reasons.push('O‘zbekcha tarjima ichida inglizcha gap yoki transkripsiya aralashgan');
  }
  if (record.exampleSentence && containsCyrillic(record.exampleSentence)) {
    reasons.push('Misol gap ichida kirill matni aralashgan');
  }
  if (record.russianTranslation && !containsCyrillic(record.russianTranslation)) {
    reasons.push('Ruscha tarjima noto‘g‘ri ko‘rinadi');
  }
  return reasons;
}

// --- Exercise Helpers ---

export function normalizeComparisonChars(value: string): string {
  return value
    .replace(/[’‘ʻʼ`]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[—–]/g, '-');
}

export function stripEdgePunctuation(token: string): string {
  return token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

export interface WordToken {
  display: string;
  core: string;
  fullNormalized: string;
}

export function tokenizeSentenceForWords(sentence: string): WordToken[] {
  const rawParts = sentence.trim().split(/\s+/).filter(Boolean);
  const merged: string[] = [];

  for (const part of rawParts) {
    const hasAlphaNum = /[\p{L}\p{N}]/u.test(part);
    if (!hasAlphaNum && merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${part}`;
    } else {
      merged.push(part);
    }
  }

  return merged.map((display) => {
    const fullNormalized = normalizeComparisonChars(display).toLowerCase();
    const core = stripEdgePunctuation(fullNormalized);
    return {
      display,
      core: core || fullNormalized,
      fullNormalized,
    };
  });
}

export function isWordAnswerMatch(userInput: string, expected: WordToken): boolean {
  const normalizedInput = normalizeComparisonChars(userInput).trim().toLowerCase();
  if (!normalizedInput) return false;
  if (normalizedInput === expected.fullNormalized) return true;
  const inputCore = stripEdgePunctuation(normalizedInput);
  return inputCore.length > 0 && normalizedInput === inputCore && inputCore === expected.core;
}

export interface CharSlot {
  index: number;
  char: string;
  isSpace: boolean;
  isPunctuation: boolean;
  expectedNormalized: string;
}

export function buildCharStream(sentence: string): CharSlot[] {
  const chars = Array.from(sentence.trim());
  return chars.map((char, index) => {
    const isSpace = /\s/.test(char);
    const isPunctuation = !isSpace && /[^\p{L}\p{N}]/u.test(char);
    return {
      index,
      char,
      isSpace,
      isPunctuation,
      expectedNormalized: normalizeComparisonChars(char).toLowerCase(),
    };
  });
}

export function advancePastSpaces(slots: CharSlot[], startIndex: number): number {
  let idx = startIndex;
  while (idx < slots.length && slots[idx].isSpace) {
    idx++;
  }
  return idx;
}

function buildVerifiedTargetRegex(cleanWord: string): RegExp {
  const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 1. Exact word or multi-word phrase boundary match
  // 2. For single words, allow genuine English inflectional forms only:
  //    - regular suffixes (s, es, ed, d, ing, er, est, ly, 's, ’s)
  //    - final -y -> ies/ied (e.g. try -> tried)
  //    - final -e drop -> ing/ed (e.g. afford/write -> writing, make -> making)
  const isSingleWord = /^[a-zA-Z'’-]+$/.test(cleanWord);
  if (!isSingleWord) {
    return new RegExp(`(\\b${escaped}(?:['’]s)?)`, 'gi');
  }

  const variants = [escaped];
  variants.push(`${escaped}(?:s|es|ed|d|ing|er|est|ly|['’]s)`);
  if (/[^aeiou]y$/i.test(cleanWord)) {
    const stem = cleanWord.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    variants.push(`${stem}(?:ies|ied|ier|iest)`);
  }
  if (/e$/i.test(cleanWord) && cleanWord.length > 2) {
    const stem = cleanWord.slice(0, -1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    variants.push(`${stem}(?:ing|ed|er|est)`);
  }

  return new RegExp(`(\\b(?:${variants.join('|')})\\b)`, 'gi');
}

export function splitSentenceWithHighlightedWord(
  sentence: string,
  targetWord: string
): Array<{ text: string; isTarget: boolean }> {
  const cleanWord = targetWord.trim();
  if (!sentence || !cleanWord) {
    return [{ text: sentence, isTarget: false }];
  }

  // First prefer exact match
  const escaped = cleanWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactRegex = new RegExp(`(\\b${escaped}\\b)`, 'gi');
  const useExact = exactRegex.test(sentence);
  const activeRegex = useExact ? new RegExp(`(\\b${escaped}\\b)`, 'gi') : buildVerifiedTargetRegex(cleanWord);

  const parts = sentence.split(activeRegex);
  if (parts.length <= 1) {
    return [{ text: sentence, isTarget: false }];
  }

  const matchCheck = new RegExp(`^${activeRegex.source}$`, 'i');
  return parts
    .filter((p) => p.length > 0)
    .map((part) => ({
      text: part,
      isTarget: matchCheck.test(part),
    }));
}

export interface MaskedContextResult {
  found: boolean;
  parts: Array<{ text: string; isBlank: boolean; answer: string }>;
}

export function maskTargetWordInSentence(
  sentence: string,
  targetWord: string
): MaskedContextResult {
  const cleanWord = targetWord.trim();
  if (!sentence.trim() || !cleanWord) {
    return { found: false, parts: [] };
  }

  const parts = splitSentenceWithHighlightedWord(sentence, cleanWord);
  const hasTarget = parts.some((p) => p.isTarget);
  if (!hasTarget) {
    return { found: false, parts: [] };
  }

  return {
    found: true,
    parts: parts.map((p) => ({
      text: p.text,
      isBlank: p.isTarget,
      answer: p.text,
    })),
  };
}
