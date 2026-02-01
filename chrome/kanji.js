/**
 * 定数定義
 */
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

// 物理単位・助数詞定義
// ★ここに「倍」「枚」などを追加しました
const UNIT_PREFIXES = {
  ギガ: 'G',
  メガ: 'M',
  キロ: 'k',
  センチ: 'c',
  ミリ: 'm',
};
const UNIT_BASES = {
  // 物理単位
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
  ルクス: 'lx',
  グレイ: 'Gy',
  デシベル: 'dB',
  オーム: 'Ω',
  ヘクタール: 'ha',
  // 助数詞（算用数字にしても違和感のないもの）
  倍: '倍',
  枚: '枚',
  回: '回',
  個: '個',
  点: '点',
  冊: '冊',
};
const UNIT_MODIFIERS = { 平方: '²', 立方: '³' };

/**
 * 漢数字文字列を数値(Number/String)に変換する
 */
function parseKanjiNumber(str) {
  if (!str) return null;
  if (/^[0-9.]+$/.test(str)) return parseFloat(str);

  // 小数点（・）を含む場合の処理
  if (str.includes('・')) {
    const parts = str.split('・');
    if (parts.length !== 2) return null;

    const integerPart = parseKanjiNumber(parts[0]);
    let decimalPartStr = '';
    for (const char of parts[1]) {
      if (KANJI_MAP[char] !== undefined) {
        decimalPartStr += KANJI_MAP[char];
      } else {
        return null;
      }
    }

    if (integerPart !== null && decimalPartStr !== '') {
      return parseFloat(`${integerPart}.${decimalPartStr}`);
    }
    return null;
  }

  // 位取り記法
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
 * 単位の変換（記号化するものと、そのままのもの）
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
    // "倍" -> "倍" のように、値が同じなら漢字のまま返す（記号化しない）
    // "メートル" -> "m" のように、値が違えば記号化する
    base = UNIT_BASES[current];
    return prefix + base + suffix;
  }
  return unitStr;
}

/**
 * 金額フォーマッター
 */
function formatCurrency(num) {
  if (num === 0) return '0';
  if (!Number.isInteger(num)) return num.toLocaleString();

  const units = ['', '万', '億', '兆'];
  let parts = [];
  let n = num;
  let unitIndex = 0;

  while (n > 0) {
    const chunk = n % 10000;
    if (chunk > 0) {
      parts.unshift(chunk.toLocaleString() + units[unitIndex]);
    }
    n = Math.floor(n / 10000);
    unitIndex++;
  }
  return parts.join('');
}

/**
 * メイン変換関数
 */
function replaceKanjiReferences(text) {
  if (!text) return text;

  // --- 正規表現 ---

  // 1. 金額 (円、銭)
  const regexCurrency = /(金)?([〇一二三四五六七八九十百千万億兆・]+)(円|銭)/g;

  // 2. 単位付き数字（物理単位 ＋ 助数詞）
  // 助数詞（倍、枚など）もここで拾われる
  const unitParts = Object.keys(UNIT_BASES).join('|');
  const regexPhysical = new RegExp(
    `([〇一二三四五六七八九十百千万億兆・]+)((?:平方|立方)?(?:ギガ|メガ|キロ|センチ|ミリ)?(?:${unitParts}))`,
    'g',
  );

  // 3. 法令番号
  const regexLawStrict =
    /(第|同)([〇一二三四五六七八九十百千万億兆]+)(条|項|号|編|章|節|款|目)/g;

  // 4. 日付・元号
  const regexDate =
    /(明治|大正|昭和|平成|令和)([〇一二三四五六七八九十百千]+)(年|年度|月|日)/g;

  // 5. 期間・箇所 (箇->か)
  const regexCount = /([〇一二三四五六七八九十百千]+)(箇|か|カ|ヵ)(月|所|国)/g;

  // 6. 枝番連鎖
  const regexBranchChain =
    /([条項号編章節款目])((?:の[〇一二三四五六七八九十百千]+)+)/g;

  // 7. 別表・別記様式 (例: 別表第一、別記様式第二十二の十一の三)
  // 「別表」「別記様式」「様式」＋(第)＋数字＋(の数字...)
  const regexTableStyle =
    /(別表|別記様式|様式)(第)?([〇一二三四五六七八九十百千万億兆]+)((?:[のノ][〇一二三四五六七八九十百千]+)*)/g;

  // 8. 孤立した漢数字
  // 前後に漢字がないものを対象にする（"一部"などを除外するため）
  const regexIsolated =
    /(?<![一-龠々〆])([〇一二三四五六七八九十百千万億兆]+(?:・[〇一二三四五六七八九十百千万億兆]+)*)(?![一-龠々〆])/g;

  let processed = text;

  // --- 適用順序 ---

  // A. 金額
  processed = processed.replace(
    regexCurrency,
    (match, prefix, numStr, unit) => {
      const num = parseKanjiNumber(numStr);
      if (num !== null) {
        const formatted = formatCurrency(num);
        return (prefix || '') + formatted + unit;
      }
      return match;
    },
  );

  // B. 単位付き数字（倍、枚、m、kg...）
  processed = processed.replace(regexPhysical, (match, numStr, unitStr) => {
    const num = parseKanjiNumber(numStr);
    const symbol = convertUnitToSymbol(unitStr);
    // 数字変換成功時のみ置換
    if (num !== null) {
      return num + symbol;
    }
    return match;
  });

  // C. 法令番号 (第1条 etc)
  processed = processed.replace(
    regexLawStrict,
    (match, prefix, numStr, suffix) => {
      const num = parseKanjiNumber(numStr);
      return num !== null ? `${prefix}${num}${suffix}` : match;
    },
  );

  // D. 別表・様式・別記様式 (別表1、別記様式22の11の3 etc)
  // 法令番号置換の後に実行することで、万が一の競合を防ぎつつ、"別表第一"などを処理
  processed = processed.replace(
    regexTableStyle,
    (match, prefix, dai, numStr, chain) => {
      const num = parseKanjiNumber(numStr);
      if (num === null) return match;

      let res = prefix + (dai || '') + num;
      if (chain) {
        // 枝番部分の数字を変換 (例: "の十一" -> "の11")
        res += chain.replace(
          /[のノ]([〇一二三四五六七八九十百千]+)/g,
          (m, nStr) => {
            const n = parseKanjiNumber(nStr);
            return n !== null ? `の${n}` : m;
          },
        );
      }
      return res;
    },
  );

  // E. 日付
  processed = processed.replace(regexDate, (match, prefix, numStr, suffix) => {
    const num = parseKanjiNumber(numStr);
    return num !== null ? `${prefix}${num}${suffix}` : match;
  });

  // F. 期間・箇所
  processed = processed.replace(regexCount, (match, numStr, k, suffix) => {
    const num = parseKanjiNumber(numStr);
    if (num !== null) {
      return `${num}か${suffix}`;
    }
    return match;
  });

  // G. 枝番連鎖 (条項号などの後ろに続くもの)
  processed = processed.replace(regexBranchChain, (match, suffix, chain) => {
    const convertedChain = chain.replace(
      /[の|ノ]([〇一二三四五六七八九十百千]+)/g,
      (m, numStr) => {
        const num = parseKanjiNumber(numStr);
        return num !== null ? `の${num}` : m;
      },
    );
    return suffix + convertedChain;
  });

  // H. 孤立した漢数字（最後に残ったものを処理）
  // "一部" は後ろが漢字なのでマッチしない
  // "千三百三十スイス" は後ろがカタカナなのでマッチする
  // processed = processed.replace(regexIsolated, (match, numStr) => {
  //   const num = parseKanjiNumber(numStr);
  //   if (num !== null) {
  //     return num;
  //   }
  //   return match;
  // });

  window.KanjiConverter = { replaceKanjiReferences };
  // 環境判定
  if (typeof window !== 'undefined') {
    window.KanjiConverter = { replaceKanjiReferences };
  } else if (typeof module !== 'undefined' && module.exports) {
    module.exports = { replaceKanjiReferences };
  }
  return processed;
}
