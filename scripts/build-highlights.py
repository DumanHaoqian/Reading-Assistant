"""Rebuild the offline highlights from the local article library, using its actual DOM text.

    python -m pip install jieba==0.42.1 playwright==1.64.1
    python -m playwright install chromium
    python scripts/build-highlights.py

Alternatively set CHROME_PATH to an installed Chrome executable. Use --check to verify
the committed output. No account, service, model downloads or network needed at build/run
time after installation. Jieba's bundled tokenizer and keyword TextRank provide the lexical
scores (github.com/fxsjy/jieba). Clause, discourse and density rules below are product
heuristics. The source text and attribution live in the original sample files.
"""

import argparse
import json
import logging
import math
import os
import re
from collections import defaultdict
from functools import lru_cache
from pathlib import Path

import jieba
import jieba.analyse
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'reading-highlights.js'

# Read prose at the same entry point as the reader. Keep the exact paragraph key.
# Insert a sentinel into scoring text where a formula, code or transcription gap occurs.
EXTRACT = r"""() => {
    const article = document.querySelector('#article-body');
    const rows = [];
    let heading = '';
    function prose(node) {
        if (node.nodeType === Node.TEXT_NODE) return node.data;
        if (node.matches('math, code, pre, .transcription-gap')) return '\uFFFC';
        return Array.from(node.childNodes, prose).join('');
    }
    for (const node of article.querySelectorAll(':scope > h2, :scope > p, :scope > ul > li, :scope > ol > li')) {
        if (node.matches('h2')) heading = node.textContent;
        else rows.push({heading, text: node.textContent, prose: prose(node)});
    }
    const current = document.querySelector('#sample-library .library-link[aria-current="page"]');
    return {
        id: current && new URL(current.href).searchParams.get('sample'),
        title: document.querySelector('#question-title').textContent,
        rows,
    };
}"""

CJK = re.compile(r'[\u3400-\u9fff]')
LATIN_WORD = re.compile(r'[a-z]+(?:-[a-z]+)*', re.I)
STOP = set('一个 一种 这个 这些 那些 自己 我们 可以 就是 时候 还有 这么 因为 所以 比较 今年 已经 其实 他们 一个 进行 能够 一些'.split())
STOP.update('a an the as at of for on in to into and from are be been by is it its was were this with which that'.split())
CLAIM = re.compile(r'症结|关键|原因|意味着|主要|重要|结果|使得|表明|发现|证明|显示|目标|从而|因此|所以|应当|应该|必须|只有|在于|本意|总而言之|解决|避免|保留|导致|提升|提高|降低|下降|增长|增加|超过|高达|升至|降至|降到|跌至|达到|转向|决非|决不|首次|负责|成立|提出|支持|反对|\b(?:responsib\w*|found(?:ed)?|first|main|because|results?)\b', re.I)
EVIDENCE = re.compile(r'\d+\.\d+|[一二两三四五六七八九十]倍|\d+(?:,\d+)?\s*[多余]?\s*(?:%|[万亿倍种名个位次步篇架座年月家张]|GB|MB|hours?\b|aircraft\b|operators?\b|countries\b)', re.I)
PREDICATE = re.compile(r'在于|意味着|表明|使得|是|作为|应当|应该|无需|依赖|提升|提高|解决|降低|下降|增长|增加|超[过出]|高达|升至|降至|跌至|达到|导致|提供|负责|避免|保留|采用|测试|承担|转向|发现|保[持住]|压缩|完成|丢失')
SCOPE = re.compile(r'如果|若|只要|只有|除非|倘|一旦|假如|假使|即使|即便|尽管|虽|并非|并不|不但|不独|不仅|不是|而非|而是|未必|似乎|可能|或许|有人|以为|据说|我猜|譬如|比如|举例|为例|例如|\b(?:if|unless|although|though|may|might|possibly|however|rather than|not only)\b', re.I)
DEPENDENT_START = re.compile(r'^(?:和|与|及|而|但|却|也|还|并|仍|才|则|就|便|从而|同时|从中|其中|包括|甚至|以及|一方面|另一方面|一是|二是|例如|至于|以至|无非|以及|如同|的是|等[等人]|\d+[、.]\s)')
LEAD_IN = re.compile(r'^(?:比如|譬如|例如|此外|从逻辑角度来看|截至|截止|据|对于|至于|除了|伴随|通过|为了|随着|针对|在.{0,18}(?:中|下|上|时|后|前|期间|层面))')
BOILERPLATE = re.compile(r'https?://|点击|见下[图表]|如[上下]图|如[上下]所|归纳如下|如下[：:]|先来聊聊|先来总结|前文中提到|如上言|所以说，\s*[“「]|这(?:一层|个|也)是?一个问题|对于这问题|分享.{1,12}感悟|在年中总结的时候|不再赘述|不展开|参考链接|下表汇总|附注|转载|©|版权所有|感谢阅读')
OPEN = dict(zip('（(【「『“《[', '）)】」』”》]'))


@lru_cache(maxsize=4096)
def terms(text):
    return {w for w in jieba.lcut(text.lower()) if len(w) >= 2 and w not in STOP
            and (CJK.search(w) or LATIN_WORD.fullmatch(w))}


def punctuated(text, delimiters):
    """Only cut outside parentheses/quotations. Keep decimals and punctuation intact."""
    closing = []
    start = 0
    for i, char in enumerate(text):
        if char in OPEN:
            closing.append(OPEN[char])
        elif closing and char == closing[-1]:
            closing.pop()
        elif char == '"':
            if closing and closing[-1] == '"':
                closing.pop()
            else:
                closing.append('"')
        if closing or char not in delimiters:
            continue
        if char == '.' and i + 1 < len(text) and not text[i + 1].isspace():
            continue
        if char == ',' and 0 < i < len(text) - 1 and text[i-1].isdigit() and text[i+1].isdigit():
            continue
        yield text[start:i+1]
        start = i + 1
    if start < len(text):
        yield text[start:]


def candidates(prose):
    prose = prose.removeprefix('【参考译文】').strip()
    for sentence in punctuated(prose, '。！？.!?'):
        sentence = sentence.strip()
        if '\uFFFC' in sentence or not sentence or sentence[-1] in '？?：:' or BOILERPLATE.search(sentence):
            continue
        yield sentence, True
        if not CJK.search(sentence) or SCOPE.search(sentence):
            continue
        # A quoted/conditional argument or comparison stays intact. For other long
        # sentences consider consecutive whole clauses, never crop to a character limit.
        parts = list(punctuated(sentence, '，；：'))
        for i, first in enumerate(parts):
            # Commas often carry the subject/qualifier forward. Start only at a
            # sentence or major boundary; a later comma cannot start an excerpt.
            if i and not parts[i-1].endswith(('；', '：')):
                continue
            if DEPENDENT_START.match(first.lstrip()):
                continue
            for size in (1, 2):
                if i + size > len(parts):
                    continue
                phrase = ''.join(parts[i:i+size]).strip().rstrip('，；：')
                if size == 1 and LEAD_IN.match(phrase):
                    continue
                if phrase.endswith(('时', '方面', '相比', '如下', '原因', '认为', '的问题')):
                    continue
                if phrase != sentence and PREDICATE.search(phrase):
                    yield phrase, False


def candidate_score(phrase, whole, context, ranks):
    if CJK.search(phrase):
        width = len(phrase) * 0.48 + len(CJK.findall(phrase)) * 0.52
        # A longer complete experimental finding may contain its necessary conditions.
        max_width = 70 if whole and EVIDENCE.search(phrase) else 52
        if not 9 <= width <= max_width:
            return None
    else:
        count = len(LATIN_WORD.findall(phrase))
        if not 6 <= count <= 20 or len(phrase) > 120:
            return None
        width = count * 1.9
    words = terms(phrase)
    if len(words) < 2:
        return None
    ranked = sorted((ranks.get(w, 0) for w in words), reverse=True)
    score = sum(ranked[:4]) + min(2, len(words & context)) * 0.8
    score += bool(CLAIM.search(phrase)) * 1.15 + bool(EVIDENCE.search(phrase)) * 1.1
    score += 1.2 if whole else 0
    if re.search(r'^参考(?:一些|其他)|这张图|整张图|数据刻度', phrase):
        score -= 1
    return score - abs(width - 25) * 0.034


def rank_article(title, rows):
    article = '\n'.join(r['prose'] for r in rows)
    ranks = dict(jieba.analyse.textrank(article.lower(), topK=120, withWeight=True,
                                        allowPOS=('ns', 'n', 'vn', 'v', 'nr', 'nz', 'eng')))
    sections = defaultdict(list)
    for i, row in enumerate(rows):
        text = row['text']
        if len(text.strip()) < 24 or BOILERPLATE.match(text):
            continue
        context = terms(title) | terms(row['heading'])
        best = None
        for phrase, whole in candidates(row['prose']):
            if text.count(phrase) != 1:
                continue
            score = candidate_score(phrase, whole, context, ranks)
            if score is not None and (best is None or score > best[0]):
                best = (score, i, phrase)
        if best and best[0] >= 1.85:
            sections[row['heading']].append(best)

    choices = {}
    for options in sections.values():
        # Each section gets a chance; just over half its eligible paragraphs can be marked.
        limit = math.ceil(len(options) * 0.58)
        for _, i, phrase in sorted(options, key=lambda item: (-item[0], item[1]))[:limit]:
            choices[i] = phrase
    return {rows[i]['text']: choices[i] for i in sorted(choices)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    jieba.setLogLevel(logging.ERROR)
    highlights = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROME_PATH'))
        page = browser.new_page()
        page.goto((ROOT / 'index.html').as_uri())
        samples = page.locator('#sample-library .library-link').evaluate_all(
            "links => links.map(link => ({id: new URL(link.href).searchParams.get('sample'), url: link.href}))"
        )
        if not samples:
            raise ValueError('No articles found in the sample library')
        for sample in samples:
            sample_id = sample['id']
            if not sample_id or sample_id in highlights:
                raise ValueError(f'Missing or repeated article ID in the library: {sample_id!r}')
            page.goto(sample['url'])
            article = page.evaluate(EXTRACT)
            if article['id'] != sample_id or not article['title'].strip():
                raise ValueError(f'Article identity missing or incorrect: {sample_id}')
            rows = article['rows']
            marked = rank_article(article['title'], rows)
            highlights[sample_id] = marked
            characters = sum(len(row['text']) for row in rows)
            coverage = sum(map(len, marked.values())) / characters if characters else 0
            print(f'{sample_id}: {len(marked)}/{len(rows)} paragraphs, {coverage:.1%} of prose characters')
        browser.close()
    source = '// Generated by scripts/build-highlights.py. Each article ID maps verbatim DOM paragraphs to excerpts.\n'
    source += 'window.READING_HIGHLIGHTS = ' + json.dumps(highlights, ensure_ascii=False, indent=2) + ';\n'
    if args.check:
        if not OUTPUT.is_file() or OUTPUT.read_text(encoding='utf-8') != source:
            raise SystemExit('reading-highlights.js is stale; rerun the builder.')
    else:
        OUTPUT.write_bytes(source.encode('utf-8'))


if __name__ == '__main__':
    main()
