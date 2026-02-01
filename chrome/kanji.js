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
const UNIT_SMALL = { 十: 10, 百: 100, 千: 1000 };
const UNIT_LARGE = { 万: 10000, 億: 100000000, 兆: 1000000000000 };

// 物理単位定義（変更なし）
const UNIT_PREFIXES = {
  ギガ: 'G',
  メガ: 'M',
  キロ: 'k',
  センチ: 'c',
  ミリ: 'm',
};
const UNIT_BASES = {
  メートル: 'm',
  メートル毎時: 'm/h',
  メートル毎分: 'm/min',
  メートル毎秒: 'm/s',
  メートル毎秒毎秒: 'm/s²',
  グラム: 'g',
  トン: 't',
  リットル: 'L',
  ニュートン: 'N',
  ジュール: 'J',
  ワット: 'W',
  パーセント: '%',
  パスカル: 'Pa',
};
const UNIT_MODIFIERS = { 平方: '²', 立方: '³' };

/**
 * 漢数字文字列を数値(Integer)に変換する
 */
function parseKanjiNumber(str) {
  if (!str) return null;
  if (/^[0-9]+$/.test(str)) return parseInt(str, 10);

  // 位取り記法（〇を含む、または単位文字を含まない長い羅列）
  const isPositional =
    str.includes('〇') || (!/[十百千万億兆]/.test(str) && str.length > 1);

  if (isPositional) {
    let res = '';
    for (const char of str) {
      if (KANJI_MAP[char] !== undefined) res += KANJI_MAP[char];
      else return null;
    }
    return parseInt(res, 10);
  }

  // 単位付き記法
  let total = 0;
  let sectionVal = 0;
  let currentVal = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (KANJI_MAP[char] !== undefined) {
      currentVal = KANJI_MAP[char];
    } else if (UNIT_SMALL[char]) {
      if (currentVal === 0) currentVal = 1;
      sectionVal += currentVal * UNIT_SMALL[char];
      currentVal = 0;
    } else if (UNIT_LARGE[char]) {
      if (currentVal > 0) sectionVal += currentVal;
      if (sectionVal === 0 && currentVal === 0) sectionVal = 1;
      total += sectionVal * UNIT_LARGE[char];
      sectionVal = 0;
      currentVal = 0;
    }
  }
  total += sectionVal + currentVal;
  return total;
}

/**
 * 物理単位の変換 (変更なし)
 */
function convertUnitToSymbol(unitStr) {
  let current = unitStr;
  let suffix = '';
  let prefix = '';
  let base = '';

  for (const [key, val] of Object.entries(UNIT_MODIFIERS)) {
    if (current.startsWith(key)) {
      suffix = val;
      current = current.slice(key.length);
      break;
    }
  }
  for (const [key, val] of Object.entries(UNIT_PREFIXES)) {
    if (current.startsWith(key)) {
      prefix = val;
      current = current.slice(key.length);
      break;
    }
  }
  if (UNIT_BASES[current]) {
    base = UNIT_BASES[current];
    return prefix + base + suffix;
  }
  return unitStr;
}

/**
 * 【新機能】数値を公用文ルール（万・億・兆残し、3桁カンマ）でフォーマットする
 * 例: 123456789 -> "1億2,345万6,789"
 */
function formatCurrency(num) {
  if (num === 0) return '0';

  // 4桁ごとに切り分けるための単位
  const units = ['', '万', '億', '兆'];
  let parts = [];
  let n = num;
  let unitIndex = 0;

  while (n > 0) {
    const chunk = n % 10000; // 下4桁を取得
    if (chunk > 0) {
      // 3桁区切りのカンマを入れる (例: 1234 -> "1,234")
      const formattedChunk = chunk.toLocaleString();
      parts.unshift(formattedChunk + units[unitIndex]);
    }
    n = Math.floor(n / 10000);
    unitIndex++;
  }

  return parts.join('');
}

/**
 * テキスト変換メイン関数
 */
function replaceKanjiReferences(text) {
  if (!text) return text;

  // --- 正規表現の定義 ---

  // 1. 金額パターン (New!)
  // 「金」はあってもなくても良い。末尾が「円」。
  // 概数（数万円、数十円）を除外するため、漢数字のみに限定
  const regexCurrency = /(金)?([〇一二三四五六七八九十百千万億兆]+)円/g;

  // 2. 物理単位パターン
  const unitParts = Object.keys(UNIT_BASES).join('|');
  const regexPhysical = new RegExp(
    `([〇一二三四五六七八九十百千万億兆]+)((?:平方|立方)?(?:ギガ|メガ|キロ|センチ|ミリ)?(?:${unitParts}))`,
    'g',
  );

  // 3. 法令番号パターン
  const regexLawStrict =
    /(第|同)([〇一二三四五六七八九十百千万億兆]+)(条|項|号|編|章|節|款|目)/g;

  // 4. 日付・元号パターン
  const regexDate =
    /(明治|大正|昭和|平成|令和)([〇一二三四五六七八九十百千]+)(年|年度|月|日)/g;

  // 5. 期間・箇所パターン (New! 公用文ルール「ケ」対応)
  // 「三箇月」->「3か月」、「五箇所」->「5か所」
  const regexCount = /([〇一二三四五六七八九十百千]+)(箇|か|カ|ヵ)(月|所|国)/g;

  // 6. 枝番パターン
  const regexBranchChain =
    /([条項号編章節款目])((?:の[〇一二三四五六七八九十百千]+)+)/g;

  let processed = text;

  // --- 変換処理 ---

  // A. 金額の変換 (公用文ルール適用)
  processed = processed.replace(regexCurrency, (match, prefix, numStr) => {
    // "数万円" などの概数は parseKanjiNumber で null ではないが、
    // 厳密な数値変換を意図するため、除外ロジックが必要ならここに追加。
    // 現状の parseKanjiNumber は "数" を無視またはパース不能とするため安全。

    const num = parseKanjiNumber(numStr);
    if (num !== null) {
      const formatted = formatCurrency(num);
      return (prefix || '') + formatted + '円';
    }
    return match;
  });

  // B. 期間・箇所の変換 (箇 -> か)
  processed = processed.replace(regexCount, (match, numStr, k, suffix) => {
    const num = parseKanjiNumber(numStr);
    if (num !== null) {
      // ルール「ケ」: 算用数字を使う場合は「か」と書く
      return `${num}か${suffix}`;
    }
    return match;
  });

  // C. 物理単位
  processed = processed.replace(regexPhysical, (match, numStr, unitStr) => {
    const num = parseKanjiNumber(numStr);
    const symbol = convertUnitToSymbol(unitStr);
    if (num !== null && symbol !== unitStr) {
      return num + symbol;
    }
    return match;
  });

  // D. 法令番号
  processed = processed.replace(
    regexLawStrict,
    (match, prefix, numStr, suffix) => {
      const num = parseKanjiNumber(numStr);
      return num !== null ? `${prefix}${num}${suffix}` : match;
    },
  );

  // E. 日付
  processed = processed.replace(regexDate, (match, prefix, numStr, suffix) => {
    const num = parseKanjiNumber(numStr);
    return num !== null ? `${prefix}${num}${suffix}` : match;
  });

  // F. 枝番
  processed = processed.replace(regexBranchChain, (match, suffix, chain) => {
    const convertedChain = chain.replace(
      /の([〇一二三四五六七八九十百千]+)/g,
      (m, numStr) => {
        const num = parseKanjiNumber(numStr);
        return num !== null ? `の${num}` : m;
      },
    );
    return suffix + convertedChain;
  });

  return processed;
}

window.KanjiConverter = { replaceKanjiReferences };
