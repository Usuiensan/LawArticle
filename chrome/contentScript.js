(function () {
  // 変換処理本体
  function convertNode(textNode) {
    // すでに処理済み、または空の場合はスキップ
    const originalText = textNode.nodeValue;
    if (!originalText || !originalText.trim()) return;

    // 親要素が script や style の場合はスキップ
    const parent = textNode.parentElement;
    if (parent && (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE'))
      return;

    // KanjiConverter は kanji.js で window オブジェクト等に紐付けられている前提
    // もしくは同じスコープに結合されるならそのまま関数呼び出し
    const convertedText = window.KanjiConverter
      ? window.KanjiConverter.replaceKanjiReferences(originalText)
      : replaceKanjiReferences(originalText); // 直接結合されている場合

    if (convertedText !== originalText) {
      textNode.nodeValue = convertedText;
    }
  }

  // ページ全体を走査する関数
  function walkAndConvert(root) {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );

    let node;
    while ((node = walker.nextNode())) {
      convertNode(node);
    }
  }

  // MutationObserverの設定
  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            // 要素ノードならその中身を走査
            if (node.nodeType === Node.ELEMENT_NODE) {
              walkAndConvert(node);
            }
            // テキストノードが直接追加された場合
            else if (node.nodeType === Node.TEXT_NODE) {
              convertNode(node);
            }
          });
        } else if (mutation.type === 'characterData') {
          // テキストが書き換わった場合
          convertNode(mutation.target);
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true, // テキストの変更も監視
    });
  }

  // 初期化処理
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      walkAndConvert(document.body);
      startObserver();
    });
  } else {
    walkAndConvert(document.body);
    startObserver();
  }
})();
