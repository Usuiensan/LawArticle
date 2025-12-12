// 数字マップ
const KANJI_MAP = {
    '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9
};

// 桁の単位マップ
const UNIT_MAP = {
    '十': 10, '百': 100, '千': 1000
};

// 漢数字判定用セット（判定を高速化するため）
const KANJI_SET = new Set([...Object.keys(KANJI_MAP), ...Object.keys(UNIT_MAP)]);

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

// テキスト内の漢数字参照を変換する関数
function replaceKanjiReferences(text) {
    if (!text) return text;

    // パターン定義
    const regexStandard = /(第|同|の|^)([〇一二三四五六七八九十百千・]+)(条|項|号|編|章|節|款|目|ギガ|メガ|キロ|センチ|ミリ|平方|立方|メートル|グラム|トン|リットル|ニュートン|ジュール|ワット|パーセント|パスカル)?/g;
    const regexMeter = /([〇一二三四五六七八九十百千・]+)(ギガ|メガ|キロ|センチ|ミリ|平方|立方|メートル|グラム|トン|リットル|ニュートン|ジュール|ワット|パーセント|パスカル)/g;

    // 1. 単位直結型（メートル等）を先に処理
    let processedText = text.replace(regexMeter, (match, kanjiNum, unit) => {
        const number = parseKanjiNumber(kanjiNum);
        return (number !== null) ? number + unit : match;
    });

    // 2. 標準的な法令番号/枝番を処理
    processedText = processedText.replace(regexStandard, (match, prefix, kanjiNum, suffix, offset, string) => {
        const number = parseKanjiNumber(kanjiNum);
        if (number === null) return match;

        // 条件A: 単位(suffix)がある場合 (例: 第五条 -> 第5条)
        // -> 無条件で変換
        if (suffix) {
            const p = (prefix === '^') ? '' : prefix;
            return p + number + suffix;
        }

        // 条件B: 接頭辞が「の」の場合 (例: の二)
        // -> 直前が「条・項」などの単位なら変換する (第1条の2)
        // -> 直前が「漢数字」なら号の枝番とみなして変換しない (三の二 -> 三の二 のまま)
        if (prefix === 'の') {
            // 直前の文字を確認
            if (offset > 0) {
                const prevChar = string[offset - 1];
                // 直前が漢数字の場合は、号(Item)の枝番と判断して変換をスキップ
                if (KANJI_SET.has(prevChar)) {
                    return match;
                }
            }
            return prefix + number;
        }

        // それ以外（単位なし、接頭辞なし/その他）は変換しない
        // これにより、行頭の「一　道路」などは漢数字のまま維持される
        return match;
    });

    return processedText;
}