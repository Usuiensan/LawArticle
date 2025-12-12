// 数字マップ
const KANJI_MAP = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9
};

// 漢数字文字列を算用数字(Int)に変換する関数
function parseKanjiNumber(str) {
    if (!str) return null;
    
    let total = 0;
    let temp = 0; // 現在の単位未満の数値を保持（例: "百二十"の"二"）

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        
        if (KANJI_MAP[char]) {
            // 1-9の場合、一時変数にセット
            temp = KANJI_MAP[char];
        } else if (char === '十') {
            // 十の場合、tempが0なら1（十）、それ以外ならtemp*10（二十）
            total += (temp === 0 ? 1 : temp) * 10;
            temp = 0;
        } else if (char === '百') {
            // 百の場合、tempが0なら1（百）、それ以外ならtemp*100（二百）
            total += (temp === 0 ? 1 : temp) * 100;
            temp = 0;
        }
    }
    // 最後の端数を足す（例: 二十五 の 五）
    total += temp;
    
    return total;
}

// テキスト内の「第〇条」「第〇項」「第〇号」「の〇」などを探して変換する関数
function replaceKanjiReferences(text) {
    if (!text) return text;

    // 正規表現の解説:
    // (第|の|同|^) : 前置詞（第、の、同、または行頭）をキャプチャ
    // ([一二三四五六七八九十百]+) : 漢数字の連続をキャプチャ
    // (条|項|号|編|章|節|款|目) : 単位（条、項など）をキャプチャ
    const regex = /(第|の|同|^)([一二三四五六七八九十百]+)(条|項|号|編|章|節|款|目)/g;

    return text.replace(regex, (match, prefix, kanjiNum, suffix) => {
        // 漢数字部分を数値に変換
        const number = parseKanjiNumber(kanjiNum);
        
        // 変換に成功したら「第1条」のように組み直して返す
        // 失敗したら元の文字列(match)をそのまま返す
        if (number !== null) {
            // 「^」で行頭マッチした場合は prefix は空文字扱い
            const p = (prefix === '^') ? '' : prefix;
            return p + number + suffix;
        } else {
            return match;
        }
    });
}