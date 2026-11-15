import {
  detectSuspiciousRecord,
  extractTableFromHtml,
  parseVocabularyText,
  splitSentenceWithHighlightedWord,
} from '../src/utils/parser.ts';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(
      `${label}\n  Expected: ${JSON.stringify(expected)}\n  Actual:   ${JSON.stringify(actual)}`
    );
  }
}

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL: ${name}`);
    console.error(err instanceof Error ? err.message : String(err));
  }
}

// 1. Single vocabulary entry
test('1. Single vocabulary entry (advertisement)', () => {
  const input = `**advertisement** _n_
/ədˈvɜːtɪsmənt/

I want to sell my guitar so I’ve put an **advertisement** in a newspaper.

реклама

reklama`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 1, 'entry count');
  assertEqual(result[0].word, 'advertisement', 'word');
  assertEqual(result[0].partOfSpeech, 'noun', 'partOfSpeech');
  assertEqual(result[0].pronunciation, '/ədˈvɜːtɪsmənt/', 'pronunciation');
  assertEqual(
    result[0].exampleSentence,
    'I want to sell my guitar so I’ve put an advertisement in a newspaper.',
    'exampleSentence'
  );
  assertEqual(result[0].russianTranslation, 'реклама', 'russianTranslation');
  assertEqual(result[0].uzbekTranslation, 'reklama', 'uzbekTranslation');
  assertEqual(result[0].needsCorrection, false, 'needsCorrection');
});

// 2. Multiple consecutive vocabulary entries
test('2. Multiple consecutive vocabulary entries (advertisement, afford, art, bag, bike)', () => {
  const input = `advertisement
/ədˈvɜːtɪsmənt/
I want to sell my guitar so I've put an advertisement in a newspaper.
реклама
reklama

afford
/əˈfɔːrd/
The family was very poor and couldn't afford piano lessons.
позволить себе
qurbi yetmoq

art
/ɑːrt/
I'm not very good at art.
искусство
san'at

bag
/bæɡ/
She carried a small leather bag.
сумка
sumka

bike
/baɪk/
He goes to school by bike.
велосипед
velosiped`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 5, 'entry count');
  assertEqual(result[0].word, 'advertisement', 'w0');
  assertEqual(result[0].uzbekTranslation, 'reklama', 'uz0');
  assertEqual(result[1].word, 'afford', 'w1');
  assertEqual(result[1].russianTranslation, 'позволить себе', 'ru1');
  assertEqual(result[1].uzbekTranslation, 'qurbi yetmoq', 'uz1');
  assertEqual(result[2].word, 'art', 'w2');
  assertEqual(result[2].uzbekTranslation, "san'at", 'uz2');
  assertEqual(result[3].word, 'bag', 'w3');
  assertEqual(result[3].uzbekTranslation, 'sumka', 'uz3');
  assertEqual(result[4].word, 'bike', 'w4');
  assertEqual(result[4].uzbekTranslation, 'velosiped', 'uz4');
  assert(result.every((r) => !r.needsCorrection), 'all 5 clean');
});

// 3. Multiline wrapped example sentences
test('3. Multiline wrapped example sentences and multi-sentence example', () => {
  const input = `afford
/əˈfɔːrd/
The family was very poor
and couldn't afford
piano lessons.
позволить себе
qurbi yetmoq

adventure
/ədˈventʃər/
They went on an exciting adventure in the mountains.
It was unforgettable.
приключение
sarguzasht`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 2, 'entry count');
  assertEqual(
    result[0].exampleSentence,
    "The family was very poor and couldn't afford piano lessons.",
    'wrapped sentence joined'
  );
  assertEqual(result[0].uzbekTranslation, 'qurbi yetmoq', 'uz0');
  assertEqual(
    result[1].exampleSentence,
    'They went on an exciting adventure in the mountains. It was unforgettable.',
    'multi-sentence example kept intact'
  );
  assertEqual(result[1].uzbekTranslation, 'sarguzasht', 'uz1');
});

// 4. HTML entity normalization and HTML table extraction
test('4. HTML entity normalization and HTML table extraction', () => {
  const htmlTable = `<table>
    <thead><tr><th>WORDS</th><th>TRANSCRIPT</th><th>EXAMPLE</th><th>RUSSIAN TRANSLATION</th><th>UZBEK TRANSLATION</th></tr></thead>
    <tbody>
      <tr><td>advertisement</td><td>/ədˈvɜːtɪsmənt/</td><td>I&#x20;want to sell my guitar so I&rsquo;ve put an advertisement in a newspaper.</td><td>реклама</td><td>reklama</td></tr>
      <tr><td>afford</td><td>/əˈfɔːrd/</td><td>They couldn&#39;t afford piano lessons.&nbsp;</td><td>позволить себе</td><td>qurbi yetmoq</td></tr>
    </tbody>
  </table>`;

  const tsv = extractTableFromHtml(htmlTable);
  assert(tsv !== null, 'HTML table extracted');
  const tableDrafts = parseVocabularyText(htmlTable);
  assertEqual(tableDrafts.length, 2, 'HTML table entries');
  assertEqual(tableDrafts[0].importMode, 'structured', 'importMode structured');
  assertEqual(
    tableDrafts[0].exampleSentence,
    'I want to sell my guitar so I’ve put an advertisement in a newspaper.',
    'entities decoded cleanly'
  );
  assertEqual(tableDrafts[1].uzbekTranslation, 'qurbi yetmoq', 'row 2 uzbek');
  assert(!tableDrafts[0].needsCorrection && !tableDrafts[1].needsCorrection, 'structured clean');

  // Also test HTML entities in plain text
  const plainEntities = `advertisement&#x20;
/ədˈvɜːtɪsmənt/
I&rsquo;ve put an advertisement in a newspaper.&nbsp;
реклама
reklama`;
  const plainDrafts = parseVocabularyText(plainEntities);
  assertEqual(plainDrafts.length, 1, 'plain entity entry');
  assertEqual(plainDrafts[0].word, 'advertisement', 'plain word');
  assertEqual(
    plainDrafts[0].exampleSentence,
    'I’ve put an advertisement in a newspaper.',
    'plain sentence entities decoded'
  );
});

// 5. Markdown formatting
test('5. Markdown formatting stripping', () => {
  const input = `**classical music** _n_
/ˈklæsɪkəl ˈmjuːzɪk/
Do you listen to **classical music** every _evening_?
классическая музыка
klassik musiqa`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 1, 'count');
  assertEqual(result[0].word, 'classical music', 'word');
  assertEqual(result[0].partOfSpeech, 'noun', 'pos');
  assertEqual(
    result[0].exampleSentence,
    'Do you listen to classical music every evening?',
    'markdown stripped from example'
  );
  assertEqual(result[0].needsCorrection, false, 'clean');
});

// 6. Russian translations with multiple words
test('6. Russian translations with multiple words', () => {
  const input = `look after
/lʊk ˈɑːftər/
Can you look after my cat while I am away?
присматривать за, заботиться о
g'amxo'rlik qilmoq, qaramoq`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 1, 'count');
  assertEqual(result[0].russianTranslation, 'присматривать за, заботиться о', 'multiword russian');
  assertEqual(result[0].needsCorrection, false, 'clean');
});

// 7. Uzbek translations with multiple words and commas
test('7. Uzbek translations with multiple words and commas', () => {
  const input = `turn back
/tɜːrn bæk/
The weather became worse so we decided to turn back.
повернуть назад, вернуться обратно
orqaga qaytmoq, ortga burilmoq, yo'ldan qaytmoq`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 1, 'count');
  assertEqual(
    result[0].uzbekTranslation,
    "orqaga qaytmoq, ortga burilmoq, yo'ldan qaytmoq",
    'multiword uzbek'
  );
  assertEqual(result[0].needsCorrection, false, 'clean');
});

// 8. Multiword English expressions
test('8. Multiword English expressions (all 8 expressions)', () => {
  const input = `classical music
/ˈklæsɪkəl ˈmjuːzɪk/
She enjoys listening to classical music in the evening.
классическая музыка
klassik musiqa

credit card
/ˈkredɪt kɑːrd/
You can pay for the ticket by credit card.
кредитная карта
kredit karta

country and western
/ˈkʌntri ənd ˈwestərn/
My uncle plays country and western songs on his guitar.
музыка кантри и вестерн
kantri va vestern musiqasi

foreign language
/ˈfɒrən ˈlæŋɡwɪdʒ/
Learning a foreign language takes patience.
иностранный язык
chet tili

look after
/lʊk ˈɑːftər/
Parents look after their children carefully.
ухаживать, присматривать
qaramoq, g'amxo'rlik qilmoq

musical instrument
/ˈmjuːzɪkəl ˈɪnstrəmənt/
Can you play any musical instrument?
музыкальный инструмент
musiqa asbobi

text message
/tekst ˈmesɪdʒ/
Send me a text message when you arrive home.
текстовое сообщение
matnli xabar

turn back
/tɜːrn bæk/
It was too foggy to drive, so we had to turn back.
повернуть назад
orqaga qaytmoq`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 8, 'all 8 multiword expressions');
  const expectedWords = [
    'classical music',
    'credit card',
    'country and western',
    'foreign language',
    'look after',
    'musical instrument',
    'text message',
    'turn back',
  ];
  for (let i = 0; i < expectedWords.length; i++) {
    assertEqual(result[i].word, expectedWords[i], `word[${i}]`);
    assert(!result[i].needsCorrection, `clean[${i}]`);
  }
});

// 9. IPA transcription split across lines
test('9. IPA transcription split across lines', () => {
  const input = `advertisement
/ədˈvɜːtɪs
mənt/
I saw an advertisement for the concert.
реклама
reklama

classical music
/ˈklæsɪkəl
ˈmjuːzɪk/
He plays classical music on the piano.
классическая музыка
klassik musiqa`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 2, 'count');
  assertEqual(result[0].pronunciation, '/ədˈvɜːtɪsmənt/', 'rejoined single-word IPA');
  assertEqual(result[1].pronunciation, '/ˈklæsɪkəl ˈmjuːzɪk/', 'rejoined multiword IPA');
  assertEqual(result[0].needsCorrection, false, 'clean 0');
  assertEqual(result[1].needsCorrection, false, 'clean 1');
});

// 10. Repeated PDF headers and footers
test('10. Repeated PDF headers, page footers, and repeated document titles', () => {
  const input = `English Vocabulary Unit 1 — Intermediate
WORDS TRANSCRIPT EXAMPLE RUSSIAN TRANSLATION UZBEK TRANSLATION
Page 1 of 5

advertisement
/ədˈvɜːtɪsmənt/
I put an advertisement in the paper.
реклама
reklama

- 1 -
English Vocabulary Unit 1 — Intermediate
WORDS TRANSCRIPT EXAMPLE RUSSIAN TRANSLATION UZBEK TRANSLATION
Page 2 of 5

credit card
/ˈkredɪt kɑːrd/
Do you accept credit card?
кредитная карта
kredit karta

- 2 -
English Vocabulary Unit 1 — Intermediate`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 2, 'only 2 real entries, banners stripped');
  assertEqual(result[0].word, 'advertisement', 'w0');
  assertEqual(result[0].uzbekTranslation, 'reklama', 'uz0 clean without footer');
  assertEqual(result[1].word, 'credit card', 'w1');
  assertEqual(result[1].uzbekTranslation, 'kredit karta', 'uz1 clean without footer');
});

// 11. Ambiguous table boundaries
test('11. Ambiguous table boundaries flagged as Tekshirish kerak rather than silently merged', () => {
  const input = `advertisement /ədˈvɜːtɪsmənt/
I want to sell my guitar so I've put an advertisement in a newspaper. реклама reklama afford /əˈfɔːrd/ The family was very poor and couldn't afford piano lessons. позволить себе qurbi yetmoq`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 2, 'should separate into 2 entries, NOT merge into 1');
  assertEqual(result[0].word, 'advertisement', 'entry 0 word');
  assertEqual(result[0].russianTranslation, 'реклама', 'entry 0 russian');
  assertEqual(result[0].needsCorrection, true, 'entry 0 flagged Tekshirish kerak');
  assertEqual(result[1].pronunciation, '/əˈfɔːrd/', 'entry 1 pronunciation');
  assertEqual(
    result[1].exampleSentence,
    "The family was very poor and couldn't afford piano lessons.",
    'entry 1 example kept separate'
  );
  assertEqual(result[1].russianTranslation, 'позволить себе', 'entry 1 russian');
  assertEqual(result[1].uzbekTranslation, 'qurbi yetmoq', 'entry 1 uzbek');
  assertEqual(result[1].needsCorrection, true, 'entry 1 flagged Tekshirish kerak');
});

// 12. Duplicated words
test('12. Duplicated words flagged with isDuplicate', () => {
  const input = `credit card
/ˈkredɪt kɑːrd/
Pay by credit card here.
кредитная карта
kredit karta

credit card
/ˈkredɪt kɑːrd/
She lost her credit card yesterday.
кредитная карта
kredit karta`;

  const result = parseVocabularyText(input, [{ word: 'afford' }]);
  assertEqual(result.length, 2, 'neither deleted by repeated banner stripper!');
  assertEqual(result[0].isDuplicate, false, 'first not duplicate');
  assertEqual(result[1].isDuplicate, true, 'second flagged duplicate');

  const dupExisting = parseVocabularyText(
    `afford\t/əˈfɔːrd/\tThey couldn't afford it.\tпозволить себе\tqurbi yetmoq`,
    [{ word: 'Afford' }]
  );
  assertEqual(dupExisting[0].isDuplicate, true, 'case-insensitive duplicate against existing');
});

// 13. Missing fields
test('13. Missing fields flagged with needsCorrection', () => {
  const input = `advertisement\t/ədˈvɜːtɪsmənt/\t\tреклама\treklama
afford\t/əˈfɔːrd/\tShe could afford a ticket.\t\tqurbi yetmoq
art\t/ɑːrt/\tI like art.\tискусство\t`;

  const result = parseVocabularyText(input);
  assertEqual(result.length, 3, '3 rows');
  assertEqual(result[0].needsCorrection, true, 'missing example flagged');
  assertEqual(result[1].needsCorrection, true, 'missing russian flagged');
  assertEqual(result[2].needsCorrection, true, 'missing uzbek flagged');
});

// 14. Long paste input with 80+ entries
test('14. Long paste input with 85 PDF entries (wrapped lines, multiword, headers/footers, zero cross-contamination)', () => {
  const baseEntries = [
    ['advertisement', '/ədˈvɜːtɪsmənt/', 'I put an advertisement in the local newspaper.', 'реклама', 'reklama'],
    ['afford', '/əˈfɔːrd/', "They couldn't afford a new car last year.", 'позволить себе', 'qurbi yetmoq'],
    ['classical music', '/ˈklæsɪkəl ˈmjuːzɪk/', 'My sister loves listening to classical music.', 'классическая музыка', 'klassik musiqa'],
    ['credit card', '/ˈkredɪt kɑːrd/', 'He paid for the hotel room by credit card.', 'кредитная карта', 'kredit karta'],
    ['foreign language', '/ˈfɒrən ˈlæŋɡwɪdʒ/', 'Speaking a foreign language helps when traveling.', 'иностранный язык', 'chet tili'],
    ['look after', '/lʊk ˈɑːftər/', 'She stayed home to look after her younger brother.', 'присматривать за', "g'amxo'rlik qilmoq"],
    ['musical instrument', '/ˈmjuːzɪkəl ˈɪnstrəmənt/', 'The violin is a difficult musical instrument to learn.', 'музыкальный инструмент', 'musiqa asbobi'],
    ['text message', '/tekst ˈmesɪdʒ/', 'Did you receive my text message this morning?', 'текстовое сообщение', 'matnli xabar'],
    ['turn back', '/tɜːrn bæk/', 'The storm forced the climbers to turn back early.', 'повернуть назад', 'orqaga qaytmoq'],
    ['adventure', '/ədˈventʃər/', 'Reading books is a great adventure for children.', 'приключение', 'sarguzasht'],
  ];

  const chunks: string[] = [];
  const expected: Array<{ word: string; ipa: string; ex: string; ru: string; uz: string }> = [];

  for (let i = 0; i < 85; i++) {
    if (i % 15 === 0) {
      chunks.push(`English Vocabulary PDF Master List`);
      chunks.push(`WORDS TRANSCRIPT EXAMPLE RUSSIAN TRANSLATION UZBEK TRANSLATION`);
      chunks.push(`Page ${Math.floor(i / 15) + 1} of 6`);
    }
    const base = baseEntries[i % baseEntries.length];
    const word = `${base[0]} ${i + 1}`;
    // Note: keep numeric suffix or distinct word without changing multiword shape
    const uniqueWord = i < 10 ? base[0] : `${base[0].replace(/\s+/g, '')}x${i + 1}`;
    const ipa = base[1];
    // Wrap example across 2 lines on every 3rd item
    const ex = `${base[2]} Item number ${i + 1}.`;
    const exText =
      i % 3 === 0
        ? ex.replace(' is ', '\nis ').replace(' for ', '\nfor ')
        : ex;
    const ru = `${base[3]} ${i + 1}`;
    const uz = `${base[4]} ${i + 1}`;

    expected.push({ word: uniqueWord, ipa, ex, ru, uz });
    chunks.push(`${uniqueWord}\n${ipa}\n${exText}\n${ru}\n${uz}\n`);

    if (i % 15 === 14) {
      chunks.push(`- ${Math.floor(i / 15) + 1} -`);
    }
  }

  const parsed = parseVocabularyText(chunks.join('\n'));
  assertEqual(parsed.length, 85, 'all 85 entries parsed separately');

  for (let i = 0; i < 85; i++) {
    assertEqual(parsed[i].word, expected[i].word, `entry[${i}].word`);
    assertEqual(parsed[i].pronunciation, expected[i].ipa, `entry[${i}].ipa`);
    assertEqual(parsed[i].exampleSentence, expected[i].ex, `entry[${i}].example`);
    assertEqual(parsed[i].russianTranslation, expected[i].ru, `entry[${i}].ru`);
    assertEqual(parsed[i].uzbekTranslation, expected[i].uz, `entry[${i}].uz`);
    assertEqual(parsed[i].needsCorrection, false, `entry[${i}].needsCorrection`);
  }
});

// Bonus tests: suspicious record detection & verified inflection highlighting
test('Bonus A: detectSuspiciousRecord flags corrupted stored records', () => {
  const bad = detectSuspiciousRecord({
    word: 'advertisement',
    exampleSentence: 'I put an advertisement in a newspaper.',
    russianTranslation: 'реклама',
    uzbekTranslation:
      'reklama afford /əˈfɔːrd/ The family was very poor and couldn’t afford piano lessons. позволить себе qurbi yetmoq',
  });
  assert(bad.length >= 2, 'flags Cyrillic + English sentence inside uzbekTranslation');

  const good = detectSuspiciousRecord({
    word: 'look after',
    exampleSentence: 'Please look after the cat.',
    russianTranslation: 'присматривать за',
    uzbekTranslation: "g'amxo'rlik qilmoq, qaramoq",
  });
  assertEqual(good.length, 0, 'clean stored record has 0 warnings');
});

test('Bonus B: splitSentenceWithHighlightedWord highlights true inflections only, never false substrings', () => {
  const artInParty = splitSentenceWithHighlightedWord('We went to a birthday party yesterday.', 'art');
  assert(
    artInParty.every((p) => !p.isTarget),
    'must NOT highlight "art" inside "party"'
  );

  const affordInflected = splitSentenceWithHighlightedWord(
    'They afforded the house after saving.',
    'afford'
  );
  assert(
    affordInflected.some((p) => p.isTarget && p.text.toLowerCase() === 'afforded'),
    'highlights genuine inflection "afforded"'
  );

  const phraseHighlight = splitSentenceWithHighlightedWord(
    'Do you enjoy classical music?',
    'classical music'
  );
  assert(
    phraseHighlight.some((p) => p.isTarget && p.text === 'classical music'),
    'highlights multiword expression "classical music"'
  );
});

console.log(`\nSummary: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  throw new Error(`${failed} parser test(s) failed`);
}
