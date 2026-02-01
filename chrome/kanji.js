// 数字マップ
const KANJI_MAP = {
  〇: 0,
  一: 1,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

// 桁の単位マップ
const UNIT_MAP = {
  十: 10,
  百: 100,
  千: 1000,
};

// 漢数字判定用セット
const KANJI_SET = new Set([
  ...Object.keys(KANJI_MAP),
  ...Object.keys(UNIT_MAP),
]);

// 単位変換用定義
const UNIT_PREFIXES = {
  ギガ: 'G',
  メガ: 'M',
  キロ: 'k',
  センチ: 'c',
  ミリ: 'm',
};

const UNIT_BASES = {
  メートル: 'm',
  グラム: 'g',
  トン: 't',
  リットル: 'L',
  ニュートン: 'N',
  ジュール: 'J',
  ワット: 'W',
  パーセント: '%',
  パスカル: 'Pa',
};

const UNIT_MODIFIERS = {
  平方: '²',
  立方: '³',
};

// そのまま変換する例外や短縮形のマッピング
// const UNIT_SPECIAL_MAP = {
//     'キロ': 'km',   // 文脈によるが道路関連ではkmが多いため
//     'センチ': 'cm',
//     'ミリ': 'mm'
// };

// 漢数字文字列を算用数字(String)に変換する関数
function parseKanjiNumber(str) {
  if (!str) return null;

  if (str.includes('・')) {
    const parts = str.split('・');
    const integerPart = parseIntegerPart(parts[0]);
    const decimalPart = parseDecimalPart(parts[1]);
    if (integerPart !== null && decimalPart !== null) {
      return integerPart + '.' + decimalPart;
    }
    return null;
  } else {
    return parseIntegerPart(str);
  }
}

function parseIntegerPart(str) {
  if (!str) return 0;
  let total = 0;
  let temp = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (KANJI_MAP[char] !== undefined) {
      // 〇は単独で使用されている場合のみ0として、それ以外は10倍（三〇=30など）
      if (char === '〇') {
        if (temp === 0 && i === 0) {
          // 先頭の〇は0
          temp = 0;
        } else if (temp === 0 && (i === 0 || !KANJI_MAP[str[i - 1]])) {
          // 前の数字がない場合は0
          temp = 0;
        } else if (temp !== 0) {
          // 前に数字がある場合は10倍（三〇=30）
          temp *= 10;
        }
      } else {
        temp = KANJI_MAP[char];
      }
    } else if (UNIT_MAP[char]) {
      const val = temp === 0 && (i === 0 || !KANJI_MAP[str[i - 1]]) ? 1 : temp;
      total += val * UNIT_MAP[char];
      temp = 0;
    }
  }
  total += temp;
  return total;
}

function parseDecimalPart(str) {
  if (!str) return '';
  let res = '';
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (KANJI_MAP[char] !== undefined) {
      res += KANJI_MAP[char];
    } else {
      return null;
    }
  }
  return res;
}

/**
 * 兆・億・万を維持しつつ、その間の数字を算用数字にする
 * 例: "三億二千八百万" -> "3億2800万"
 */
function parseLargeKanjiNumber(str) {
  if (!str) return null;

  // 兆・億・万が含まれていない場合は、従来のパースを行う
  if (!/[兆億万]/.test(str)) {
    return parseKanjiNumber(str);
  }

  // 兆・億・万で分割し、それぞれの塊をパースして結合する
  // 例: "三億二千八百万" -> "三億" + "二千八百" + "万"
  let result = str.replace(
    /([〇一二三四五六七八九十百千]+)([兆億万])/g,
    (match, numPart, unit) => {
      const parsed = parseKanjiNumber(numPart);
      return parsed + unit;
    },
  );

  // 末尾に千以下の端数がある場合（例: 二億五千）の処理
  const lastMatch = str.match(/([〇一二三四五六七八九十百千]+)$/);
  if (lastMatch && !/[兆億万]$/.test(str)) {
    const lastNum = parseKanjiNumber(lastMatch[1]);
    result = result.replace(new RegExp(lastMatch[1] + '$'), lastNum);
  }

  return result;
}

// 単位文字列を記号に変換する関数
// 例: "キロメートル" -> "km", "平方メートル" -> "m²"
function convertUnitToSymbol(unitStr) {
  // 1. 完全一致（短縮形など）
  // if (UNIT_SPECIAL_MAP[unitStr]) {
  //     return UNIT_SPECIAL_MAP[unitStr];
  // }

  // 2. 基本単位のみ
  if (UNIT_BASES[unitStr]) {
    return UNIT_BASES[unitStr];
  }

  let currentStr = unitStr;
  let symbol = '';
  let suffix = '';

  // 3. 平方・立方の処理 (m² 等)
  for (const [modName, modSym] of Object.entries(UNIT_MODIFIERS)) {
    if (currentStr.startsWith(modName)) {
      suffix = modSym;
      currentStr = currentStr.slice(modName.length);
      break;
    }
  }

  // 4. 接頭辞の処理 (k, M, c, m 等)
  for (const [preName, preSym] of Object.entries(UNIT_PREFIXES)) {
    if (currentStr.startsWith(preName)) {
      symbol += preSym;
      currentStr = currentStr.slice(preName.length);
      break;
    }
  }

  // 5. 残りの基本単位 (m, g, W 等)
  if (UNIT_BASES[currentStr]) {
    symbol += UNIT_BASES[currentStr];
    return symbol + suffix;
  }

  // マッチしない場合は元の文字列を返す
  return unitStr;
}

// テキスト内の漢数字参照を変換する関数
function replaceKanjiReferences(text) {
  if (!text) return text;

  // 物理単位
  const regexPhysical =
    /([〇一二三四五六七八九十百千・]+)((?:ギガ|メガ|キロ|センチ|ミリ|平方|立方|メートル|グラム|トン|リットル|ニュートン|ジュール|ワット|パーセント|パスカル)+)/g;

  // 改良版：接頭辞に「元号」を追加、兆億万を許容し、誤変換回避の否定先読みを拡張
  // 接頭辞の「の」はカタカナの「ノ」も許容する
  const regexLegal =
    /(第|同|の|ノ|令和|平成|昭和|大正|^)([〇一二三四五六七八九十百千兆億万・]+)(?![般部者員体定分括律端方側つ人日間権法福節種様切致環例])(条|項|号|編|章|節|款|目|年|月|日|回|%|円|時|倍)?/g;

  // 熟語的な誤変換を追加で防ぐための除外セット
  const EXCLUDE_SUFFIXES = new Set([
    '種',
    '様',
    '切',
    '致',
    '環',
    '例',
    '部',
    '同',
  ]);

  // 1. 物理単位の処理
  let processedText = text.replace(
    regexPhysical,
    (match, kanjiNum, unitStr) => {
      const number = parseKanjiNumber(String(kanjiNum));
      if (number === null) return match;
      return number + convertUnitToSymbol(unitStr);
    },
  );

  // 2. 法令番号・日付・元号の処理
  processedText = processedText.replace(
    regexLegal,
    (match, prefix, kanjiNum, suffix, offset, string) => {
      if (!kanjiNum) return match;

      // 直後の文字が熟語的な除外語の場合は変換しない
      const prefixLen = prefix && prefix !== '^' ? prefix.length : 0;
      const kanjiStart = offset + prefixLen;
      const kanjiEnd = kanjiStart + kanjiNum.length;
      const nextChar = string[kanjiEnd];
      if (nextChar && EXCLUDE_SUFFIXES.has(nextChar)) return match;

      const numberStr = parseLargeKanjiNumber(String(kanjiNum));
      if (numberStr === null) return match;

      // 条件1: 単位(suffix)がある場合（年、月、日、条、項など）
      if (suffix) {
        const p = prefix === '^' || !prefix ? '' : prefix;
        return p + numberStr + suffix;
      }

      // 条件2: 接頭辞が「第」「同」「の/ノ」または「元号」の場合
      if (prefix && prefix !== '^') {
        // 「の」「ノ」の場合は枝番チェック（前が漢数字なら枝番の一部なので変換しない）
        if (prefix === 'の' || prefix === 'ノ') {
          if (offset > 0) {
            const prevChar = string[offset - 1];
            if (KANJI_SET.has(prevChar)) return match;
          }
        }
        return prefix + numberStr;
      }

      return match;
    },
  );

  return processedText;
}
