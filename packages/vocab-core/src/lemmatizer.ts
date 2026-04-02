/**
 * English Lemmatizer - converts inflected words to their base form
 *
 * Examples:
 *   foundations -> foundation
 *   tricks -> trick
 *   running -> run
 *   studied -> study
 *   better -> good (handled as exception)
 */

// Irregular forms map: inflected -> lemma
const IRREGULAR_MAP: Record<string, string> = {
  // Common irregular verbs
  "abided": "abide",
  "abode": "abide",
  "arisen": "arise",
  "awoke": "awake",
  "awoken": "awake",
  "was": "be",
  "were": "be",
  "been": "be",
  "born": "bear",
  "bore": "bear",
  "beaten": "beat",
  "became": "become",
  "begun": "begin",
  "bent": "bend",
  "bid": "bid",
  "bound": "bind",
  "bit": "bite",
  "bitten": "bite",
  "bled": "bleed",
  "blew": "blow",
  "blown": "blow",
  "broke": "break",
  "broken": "break",
  "brought": "bring",
  "built": "build",
  "bought": "buy",
  "caught": "catch",
  "chose": "choose",
  "chosen": "choose",
  "came": "come",
  "cost": "cost",
  "cut": "cut",
  "dealt": "deal",
  "dug": "dig",
  "did": "do",
  "done": "do",
  "drew": "draw",
  "drawn": "draw",
  "drank": "drink",
  "drunk": "drink",
  "drove": "drive",
  "driven": "drive",
  "ate": "eat",
  "eaten": "eat",
  "fell": "fall",
  "fallen": "fall",
  "fed": "feed",
  "felt": "feel",
  "fought": "fight",
  "found": "find",
  "flew": "fly",
  "flown": "fly",
  "forbade": "forbid",
  "forbidden": "forbid",
  "forgot": "forget",
  "forgotten": "forget",
  "froze": "freeze",
  "frozen": "freeze",
  "gave": "give",
  "given": "give",
  "went": "go",
  "gone": "go",
  "grew": "grow",
  "grown": "grow",
  "had": "have",
  "heard": "hear",
  "held": "hold",
  "hid": "hide",
  "hidden": "hide",
  "hurt": "hurt",
  "kept": "keep",
  "knew": "know",
  "known": "know",
  "laid": "lay",
  "led": "lead",
  "left": "leave",
  "let": "let",
  "lay": "lie",
  "lain": "lie",
  "lit": "light",
  "lost": "lose",
  "made": "make",
  "meant": "mean",
  "met": "meet",
  "paid": "pay",
  "put": "put",
  "quit": "quit",
  "read": "read",
  "rid": "rid",
  "rode": "ride",
  "ridden": "ride",
  "rang": "ring",
  "rung": "ring",
  "rose": "rise",
  "risen": "rise",
  "ran": "run",
  "said": "say",
  "saw": "see",
  "seen": "see",
  "sold": "sell",
  "sent": "send",
  "set": "set",
  "shook": "shake",
  "shaken": "shake",
  "shone": "shine",
  "shot": "shoot",
  "showed": "show",
  "shown": "show",
  "shut": "shut",
  "sang": "sing",
  "sung": "sing",
  "sank": "sink",
  "sunk": "sink",
  "sat": "sit",
  "slept": "sleep",
  "spoke": "speak",
  "spoken": "speak",
  "spent": "spend",
  "stood": "stand",
  "stole": "steal",
  "stolen": "steal",
  "stuck": "stick",
  "struck": "strike",
  "swore": "swear",
  "sworn": "swear",
  "swept": "sweep",
  "swam": "swim",
  "swum": "swim",
  "took": "take",
  "taken": "take",
  "taught": "teach",
  "told": "tell",
  "thought": "think",
  "threw": "throw",
  "thrown": "throw",
  "understood": "understand",
  "woke": "wake",
  "woken": "wake",
  "wore": "wear",
  "worn": "wear",
  "won": "win",
  "withdrew": "withdraw",
  "withdrawn": "withdraw",
  "wrote": "write",
  "written": "write",

  // Common irregular plurals/adjectives
  "better": "good",
  "best": "good",
  "worse": "bad",
  "worst": "bad",
  "older": "old",
  "oldest": "old",
  "further": "far",
  "furthest": "far",
  "more": "much",
  "most": "much",
  "less": "little",
  "least": "little",
  "latter": "late",
  "last": "late",
  "nearest": "near",
  "next": "near",

  // Nouns
  "children": "child",
  "feet": "foot",
  "teeth": "tooth",
  "geese": "goose",
  "mice": "mouse",
  "lice": "louse",
  "men": "man",
  "women": "woman",
  "people": "person",
  "oxen": "ox",
  "indices": "index",
  "analyses": "analysis",
  "bases": "basis",
  "crises": "crisis",
  "diagnoses": "diagnosis",
  "hypotheses": "hypothesis",
  "parentheses": "parenthesis",
  "syntheses": "synthesis",
  "theses": "thesis",
  "phenomena": "phenomenon",
  "criteria": "criterion",
  "media": "medium",
  "bacteria": "bacterium",
  "curricula": "curriculum",
  "memoranda": "memorandum",
  "millennia": "millennium",
  "symposia": "symposium",
  "strata": "stratum",
  "cacti": "cactus",
  "foci": "focus",
  "fungi": "fungus",
  "nuclei": "nucleus",
  "radii": "radius",
  "stimuli": "stimulus",
  "syllabi": "syllabus",
  "virtues": "virtue",

  // Verbs that look regular but aren't
  "dived": "dive",
  "dove": "dive",
};

/**
 * Check if a word looks like a proper noun (starts with capital, not at sentence start)
 * Returns the word unchanged if it might be a proper noun
 */
function looksLikeProperNoun(word: string): boolean {
  if (word.length === 0) return false;
  // If first letter is capital and not at sentence start, might be proper noun
  const firstChar = word[0];
  if (firstChar >= 'A' && firstChar <= 'Z') {
    // Could be proper noun - return as-is
    return true;
  }
  return false;
}

/**
 * Apply simple suffix stripping rules for regular verbs
 */
function stripVerbSuffix(word: string): string {
  // -ies -> -ie (flies -> flie, but we'll handle this separately)
  if (word.endsWith('ies') && word.length > 3) {
    return word.slice(0, -3) + 'ie';
  }

  // -ed -> (e)d or just d
  if (word.endsWith('ed') && word.length > 2) {
    const base = word.slice(0, -2);
    // -ied -> -ie (already handled above)
    // -ed -> -e (liked -> like)
    if (base.endsWith('e')) {
      return base;
    }
    // -ed -> (consonant doubling handled elsewhere)
    return base;
  }

  // -ing -> (e) or drop doubling
  // Only strip -ing if the result is a meaningful word (length >= 5)
  // This prevents breaking adverbs like "sparingly" -> "spar"
  if (word.endsWith('ing') && word.length > 4) {
    let base = word.slice(0, -3);  // running -> runn

    // If base ends with doubled consonant (e.g., "runn"), undouble it
    if (base.length >= 3) {
      const lastTwo = base.slice(-2);
      if (lastTwo[0] === lastTwo[1] && isConsonant(lastTwo[0])) {
        // Check if this would create a valid word
        const undoubled = base.slice(0, -1);  // runn -> run
        // Only undouble if result is at least 3 chars
        if (undoubled.length >= 3) {
          base = undoubled;
        }
      }
    }

    // If base is too short (<= 4 chars), it's likely not a verb
    if (base.length <= 4) {
      return word;
    }
    return base;
  }

  // -s/-es for third person singular (handled elsewhere)

  return word;
}

/**
 * Apply simple suffix stripping rules for regular nouns (plurals)
 */
function stripNounSuffix(word: string): string {
  // -ies -> -ie (countries -> country)
  if (word.endsWith('ies') && word.length > 3) {
    return word.slice(0, -3) + 'ie';
  }

  // -es -> (e) (boxes -> box, watches -> watch)
  if (word.endsWith('es') && word.length > 2) {
    const base = word.slice(0, -2);
    if (base.endsWith('e')) {
      return base; // boxes -> box
    }
    return base; // watches -> watch
  }

  // -s (cats -> cat)
  if (word.endsWith('s') && word.length > 1 && !word.endsWith('ss')) {
    return word.slice(0, -1);
  }

  return word;
}

/**
 * Handle consonant doubling (running -> run,搓 running -> run)
 */
function undoubleConsonant(word: string): string {
  if (word.length < 3) return word;

  const lastTwo = word.slice(-2);
  const last = lastTwo[1];

  // If last two chars are same consonant (e.g., "nn", "tt", "ss"), undouble
  if (lastTwo[0] === last && isConsonant(last)) {
    // Only undouble if word is long enough (prevents breaking short words like "inn")
    if (word.length >= 4) {
      return word.slice(0, -1);
    }
  }

  return word;
}

/**
 * Restore final 'e' (making -> make, having -> have)
 */
function restoreFinalE(word: string, original: string): string {
  if (original.endsWith('ing') && word.endsWith(original.slice(0, -3))) {
    // Check if removing 'e' was part of conversion
    // hopping -> hop (not hopp), having -> have (not hav)
    if (original.endsWith('ing') && word.endsWith(original[original.length - 4] || '')) {
      // Likely case: hopp -> hop needs no change
      // having -> hav -> have
      if (word.endsWith('v')) {
        return word + 'e';
      }
    }
  }
  return word;
}

function isConsonant(c: string): boolean {
  return !'aeiou'.includes(c.toLowerCase());
}

function isVowel(c: string): boolean {
  return 'aeiou'.includes(c.toLowerCase());
}

/**
 * Lemmatize an English word to its base form
 *
 * @param word The word to lemmatize
 * @returns The base/lemma form
 */
export function lemmatize(word: string): string {
  if (!word || word.length === 0) return word;

  const original = word.toLowerCase();
  let result = original;

  // 1. Check irregular map first
  if (IRREGULAR_MAP[original]) {
    return IRREGULAR_MAP[original];
  }

  // 2. Check if already a base form (no common suffixes)
  // Simple heuristic: if no common endings, assume it's base form

  // 3. Try verb conjugation patterns
  // -ing (present participle)
  if (original.endsWith('ing')) {
    let base = original.slice(0, -3);

    // lying -> lie (not ly)
    if (base.endsWith('i')) {
      base = base + 'e'; // lying -> lie
    }

    // hopping -> hop (undouble consonant)
    base = undoubleConsonant(base);

    // having -> have (restore 'e')
    if (base.endsWith('v')) {
      return base + 'e';
    }

    return base;
  }

  // -ed (past tense/participle)
  if (original.endsWith('ed')) {
    let base = original.slice(0, -2);

    // loved -> love
    if (!base.endsWith('e')) {
      base = base + 'e';
    }

    // hopped -> hop (undouble)
    base = undoubleConsonant(base);

    return base;
  }

  // -s (third person singular) - but not for words ending in -ous (already base form)
  if (original.endsWith('s') && !original.endsWith('ss') && !original.endsWith('is') && !original.endsWith('ous')) {
    let base = original.slice(0, -1);

    // watches -> watch
    if (base.endsWith('e')) {
      base = base.slice(0, -1);
    }

    // flies -> fly (handled below via -ies)
    if (base.endsWith('i')) {
      return base + 'e';
    }

    return base;
  }

  // -ies (third person singular, nouns)
  if (original.endsWith('ies') && original.length > 3) {
    let base = original.slice(0, -3);
    return base + 'ie'; // flies -> fly
  }

  // -es (third person singular)
  if (original.endsWith('es') && original.length > 2) {
    let base = original.slice(0, -2);

    // boxes -> box
    if (base.endsWith('e')) {
      return base;
    }

    // watches -> watch
    return base;
  }

  // -er (comparative, agent nouns)
  if (original.endsWith('er') && original.length > 2) {
    let base = original.slice(0, -2);
    base = undoubleConsonant(base);
    return base;
  }

  // -est (superlative)
  if (original.endsWith('est') && original.length > 3) {
    let base = original.slice(0, -3);
    if (base.endsWith('e')) {
      return base; // largest -> large
    }
    base = undoubleConsonant(base);
    return base;
  }

  // -ment (noun suffix)
  if (original.endsWith('ment') && original.length > 4) {
    return original.slice(0, -4);
  }

  // -tion (noun suffix)
  if (original.endsWith('tion') && original.length > 4) {
    return original.slice(0, -4);
  }

  // -ness (noun suffix)
  if (original.endsWith('ness') && original.length > 4) {
    return original.slice(0, -4);
  }

  // -ful (adjective suffix)
  if (original.endsWith('ful') && original.length > 3) {
    return original.slice(0, -3);
  }

  // -able/-ible (adjective suffix)
  if ((original.endsWith('able') || original.endsWith('ible')) && original.length > 4) {
    return original.slice(0, -4);
  }

  // -ly (adverb/adjective suffix)
  if (original.endsWith('ly') && original.length > 2) {
    let base = original.slice(0, -2);
    // happily -> happy
    if (base.endsWith('i')) {
      return base + 'y';
    }
    return base;
  }

  // -ity (noun suffix)
  if (original.endsWith('ity') && original.length > 3) {
    let base = original.slice(0, -3);
    // happy -> happiness (handled via -ness)
    return base;
  }

  // If no pattern matched, return original
  return original;
}

/**
 * Lemmatize a word, preserving case
 */
export function lemmatizePreserveCase(word: string): string {
  if (!word) return word;

  const isCapitalized = word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
  const lemma = lemmatize(word);

  if (isCapitalized) {
    return lemma[0].toUpperCase() + lemma.slice(1);
  }

  return lemma;
}
