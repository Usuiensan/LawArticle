const fs = require('fs');
const path = require('path');

/**
 * 1. 変換ロジックの読み込み
 * 拡張機能のコードをNode.jsで実行可能な状態で読み込みます
 */
const kanjiJsPath = path.join(__dirname, 'chrome\\kanji.js');
if (!fs.existsSync(kanjiJsPath)) {
  console.error(`エラー: ${kanjiJsPath} が見つかりません。`);
  process.exit(1);
}

// kanji.jsの中身をグローバルスコープで展開（eval）
// これにより replaceKanjiReferences 等の関数がこのスクリプト内で使用可能になります
const kanjiJsCode = fs.readFileSync(kanjiJsPath, 'utf8');
try {
  eval(kanjiJsCode);
  console.log('✅ kanji.js の読み込みに成功しました。');
} catch (e) {
  console.error('❌ kanji.js の構文にエラーがあります:', e.message);
  process.exit(1);
}

/**
 * 2. CSVの読み込みと解析
 */
const inputPath = path.join(__dirname, 'kansuuji.csv');
const outputPath = path.join(__dirname, 'kansuuji_with_test.csv');

if (!fs.existsSync(inputPath)) {
  console.error(`エラー: ${inputPath} が見つかりません。`);
  process.exit(1);
}

const rawData = fs.readFileSync(inputPath, 'utf8');
// BOMの除去と行分割
const lines = rawData.replace(/^\uFEFF/, '').split(/\r?\n/);
const header = lines[0].split(',');
const outputRows = [header.join(',') + ',変換結果'];

console.log(`🚀 ${lines.length - 1} 行のテストを開始します...`);

for (let i = 1; i < lines.length; i++) {
  if (!lines[i].trim()) continue;

  // 簡易的なCSVパース（カンマ区切り）
  // ※スニペット内にカンマが含まれる場合は、より厳密なパーサーが必要ですが
  // 今回はGoプログラムの出力を受けるため、一旦標準的な分割を行います。
  const cols = parseCsvLine(lines[i]);
  const snippet = cols[5] || ''; // 左から6番目の列（インデックス5）

  // 【重要】実際のJSロジックを適用
  const converted = replaceKanjiReferences(snippet);

  // 結果を結合して新しい行を作成
  const newRow = [...cols, `"${converted.replace(/"/g, '""')}"`].join(',');
  outputRows.push(newRow);
}

/**
 * 3. 結果の出力
 */
fs.writeFileSync(outputPath, '\uFEFF' + outputRows.join('\n'), 'utf8');
console.log(`\n✨ 検証完了！`);
console.log(`出力ファイル: ${outputPath}`);
console.log(`「変換結果」列を確認して、意図通りか手動で検分してください。`);

/**
 * CSVの1行を配列に分解する（クォート対応）
 */
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === ',' && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur);
  return result;
}
