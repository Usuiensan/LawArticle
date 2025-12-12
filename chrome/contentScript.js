// kanji.js で定義した replaceKanjiReferences(text) 関数を利用する

function convertPageText(rootNode) {
    const selectors = 'p, li, div:not(.sidebar):not(.header), span, h1, h2, h3, h4';
    
    let elements;
    if (rootNode.nodeType === Node.TEXT_NODE) {
        elements = [rootNode.parentElement];
    } else {
        elements = rootNode.querySelectorAll(selectors);
        if (rootNode.matches && rootNode.matches(selectors)) {
            elements = [rootNode, ...elements];
        }
    }
    
    const processedNodes = new Set();
    
    for (const element of elements) {
        if (!element || processedNodes.has(element)) {
            continue;
        }
        
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        let node;
        while (node = walker.nextNode()) {
            const originalText = node.nodeValue;
            
            if (!originalText || originalText.trim() === '' || node.parentElement.closest('script, style')) {
                continue;
            }
            
            // 【修正点】文章全体を解析して、該当箇所だけ置換する関数を呼ぶ
            // （以前はここで parse 関数を呼んでしまい、戻り値が空文字になっていた）
            const convertedText = replaceKanjiReferences(originalText);
            
            if (originalText !== convertedText) {
                node.nodeValue = convertedText;
            }
        }
        
        processedNodes.add(element);
    }
}

function startMutationObserver() {
    const config = { 
        childList: true,
        subtree: true,
        characterData: true
    };

    const callback = (mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE || node.nodeType === Node.TEXT_NODE) {
                        convertPageText(node);
                    }
                });
            } else if (mutation.type === 'characterData') {
                if (mutation.target.nodeType === Node.TEXT_NODE) {
                    convertPageText(mutation.target);
                }
            }
        }
    };

    const observer = new MutationObserver(callback);
    observer.observe(document.body, config);

    convertPageText(document.body);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMutationObserver);
} else {
    startMutationObserver();
}