// 数字マップ
const KANJI_MAP = {
    '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9
};

// 桁の単位マップ
const UNIT_MAP = {
    '十': 10, '百': 100, '千': 1000
};

// 漢数字判定用セット
const KANJI_SET = new Set([...Object.keys(KANJI_MAP), ...Object.keys(UNIT_MAP)]);

// 単位変換用定義
const UNIT_PREFIXES = {
    'ギガ': 'G', 'メガ': 'M', 'キロ': 'k', 'センチ': 'c', 'ミリ': 'm'
};

const UNIT_BASES = {
    'メートル': 'm', 'グラム': 'g', 'トン': 't', 'リットル': 'L',
    'ニュートン': 'N', 'ジュール': 'J', 'ワット': 'W', 
    'パーセント': '%', 'パスカル': 'Pa'
};

const UNIT_MODIFIERS = {
    '平方': '²', '立方': '³'
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
            temp = KANJI_MAP[char];
        } else if (UNIT_MAP[char]) {
            const val = (temp === 0 && (i === 0 || !KANJI_MAP[str[i-1]])) ? 1 : temp;
            total += val * UNIT_MAP[char];
            temp = 0;
        }
    }
    total += temp;
    return total;
}

function parseDecimalPart(str) {
    if (!str) return "";
    let res = "";
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
    let symbol = "";
    let suffix = "";

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

    // 物理単位の正規表現（組み合わせマッチ用）
    // (?:...)+ とすることで、"平方"+"キロ"+"メートル" のような連続を1つの塊としてキャプチャする
    const regexPhysical = /([〇一二三四五六七八九十百千・]+)((?:ギガ|メガ|キロ|センチ|ミリ|平方|立方|メートル|グラム|トン|リットル|ニュートン|ジュール|ワット|パーセント|パスカル)+)/g;

    // 法令単位の正規表現（物理単位は上記で処理するため除外）
    const regexLegal = /(第|同|の|^)([〇一二三四五六七八九十百千・]+)(条|項|号|編|章|節|款|目)?/g;

    // 1. 物理単位付きの数値を処理（数値変換 ＋ 単位記号化）
    let processedText = text.replace(regexPhysical, (match, kanjiNum, unitStr) => {
        const number = parseKanjiNumber(kanjiNum);
        if (number === null) return match;
        
        const unitSymbol = convertUnitToSymbol(unitStr);
        return number + unitSymbol;
    });

    // 2. 法令番号/枝番を処理
    processedText = processedText.replace(regexLegal, (match, prefix, kanjiNum, suffix, offset, string) => {
        const number = parseKanjiNumber(kanjiNum);
        if (number === null) return match;

        // 条件A: 単位(suffix)がある場合 -> 無条件で変換
        if (suffix) {
            const p = (prefix === '^') ? '' : prefix;
            return p + number + suffix;
        }

        // 条件B: 接頭辞が「の」の場合
        if (prefix === 'の') {
            if (offset > 0) {
                const prevChar = string[offset - 1];
                // 直前が漢数字（号の可能性）なら変換しない
                if (KANJI_SET.has(prevChar)) {
                    return match; 
                }
            }
            return prefix + number;
        }

        return match;
    });

    return processedText;
}