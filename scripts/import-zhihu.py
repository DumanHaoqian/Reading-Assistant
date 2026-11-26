"""Build offline samples from an authorized browser export. Requires beautifulsoup4 and requests."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from hashlib import sha256
import json
from pathlib import Path
import re
from tempfile import NamedTemporaryFile
from urllib.parse import urljoin, urlsplit

from bs4 import BeautifulSoup, Comment, Tag
import requests


ROOT = Path(__file__).resolve().parents[1]
BLOCKS = set("p h2 h3 h4 h5 h6 hr ul ol li blockquote pre figure figcaption table thead tbody tfoot tr th td".split())
ALLOWED = BLOCKS | set("img b strong em i u s br code a sub sup mark kbd small".split())
MATH = set("math mrow mi mn mo ms mtext mspace mfrac msqrt mroot msub msup msubsup munder mover munderover mtable mtr mtd mfenced menclose mpadded mstyle semantics annotation mmultiscripts mprescripts none".split())
DISCARD = set("script style template noscript svg iframe canvas video audio form button input select textarea object embed link meta".split())
STATS = ("upvotes", "comments", "favorites", "likes")


def urls(values):
    if isinstance(values, str):
        values = [values]
    result = []
    for value in values or []:
        if not isinstance(value, str):
            continue
        value = value.strip()
        url = "https:" + value if value.startswith("//") else value
        try:
            parsed = urlsplit(url)
            host = parsed.hostname or ""
            if parsed.scheme not in ("http", "https") or parsed.username or parsed.password or parsed.port not in (None, 80, 443):
                continue
        except ValueError:
            continue
        if (host == "zhimg.com" or host.endswith(".zhimg.com")) and url not in result:
            result.append(url)
    return tuple(result)


def image_urls(img):
    return urls([img.get(k) for k in ("data-original", "data-actualsrc", "data-src", "src")])


def visible_images(soup):
    for img in soup.find_all("img"):
        if img.find_parent(list(DISCARD)) is not None:
            continue
        if not image_urls(img) and re.fullmatch(r"data:image/svg\+xml;utf8,<svg[^>]*></svg>", img.get("src", "")):
            continue
        yield img


def extension(data):
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return ".gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return ".webp"
    if data[4:8] == b"ftyp" and data[8:12] in (b"avif", b"avis"):
        return ".avif"
    return None


def atomic_write(path, payload):
    with NamedTemporaryFile(dir=path.parent, delete=False) as tmp:
        temporary = Path(tmp.name)
        try:
            tmp.write(payload)
        except BaseException:
            tmp.close()
            temporary.unlink(missing_ok=True)
            raise
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def fetch_group(group, folder):
    for url in group:
        stem = sha256(url.encode()).hexdigest()[:24]
        for suffix in (".jpg", ".png", ".gif", ".webp", ".avif"):
            cached = folder / (stem + suffix)
            if cached.is_file():
                return "assets/feed/" + cached.name
        try:
            # Explicit redirect validation keeps every media request on the observed image CDN.
            target = url
            for _ in range(4):
                with requests.get(target, timeout=(5, 16), allow_redirects=False, stream=True) as response:
                    if response.is_redirect:
                        redirected = urls([urljoin(target, response.headers["Location"])])
                        if not redirected:
                            break
                        target = redirected[0]
                        continue
                    response.raise_for_status()
                    data = bytearray()
                    for chunk in response.iter_content(65536):
                        data.extend(chunk)
                        if len(data) > 32 * 1024 * 1024:
                            raise ValueError("image exceeds 32 MiB")
                    suffix = extension(data)
                    if suffix:
                        dest = folder / (stem + suffix)
                        atomic_write(dest, data)
                        return "assets/feed/" + dest.name
                    break
        except (requests.RequestException, ValueError):
            continue
    return None


def canonical(value):
    parts = urlsplit(value or "")
    if parts.scheme != "https" or parts.hostname not in {"www.zhihu.com", "zhuanlan.zhihu.com", "zhihu.com"}:
        return None
    path = parts.path.rstrip("/")
    answer = re.fullmatch(r"(?:/question/\d+)?/answer/(\d+)", path)
    column = re.fullmatch(r"/p/(\d+)", path)
    if not answer and not column:
        return None
    return (("answer-" if answer else "article-") + (answer or column)[1], "https://" + parts.hostname + path)


def clean_body(soup, assets, origin):
    for node in soup.find_all(string=lambda text: isinstance(text, Comment)):
        node.extract()
    for expression in soup.select(".ztext-math[data-tex]"):
        native = expression.find("math")
        expression.replace_with(native.extract() if native else expression["data-tex"])
    for node in list(soup.find_all()):
        if not node.name:
            continue
        name, attrs = node.name.lower(), node.attrs
        if name in DISCARD:
            node.decompose()
            continue
        if name == "h1":
            node.name = name = "h2"
        if name == "div" and not node.find(list(BLOCKS | {"div"})):
            node.name = name = "p"
        if name not in ALLOWED | MATH:
            node.unwrap()
            continue
        node.attrs = {}
        if name == "img":
            alt = attrs.get("alt") or attrs.get("data-tex") or ""
            dest = assets.get(image_urls(attrs))
            if dest:
                node["src"], node["alt"] = dest, alt
                for key in ("width", "height"):
                    size = str(attrs.get("data-raw" + key) or attrs.get(key, ""))
                    if size.isdigit() and 0 < int(size) < 100000:
                        node[key] = size
            elif alt:
                node.replace_with(alt)
            else:
                node.decompose()
        elif name == "a":
            href = urljoin(origin, attrs.get("href", ""))
            if attrs.get("href") and urlsplit(href).scheme in ("https", "http"):
                node["href"] = href
            else:
                node.unwrap()
        elif name in ("td", "th", "ol"):
            for key in (("start",) if name == "ol" else ("colspan", "rowspan")):
                if str(attrs.get(key, "")).isdigit():
                    node[key] = attrs[key]
        elif name == "math":
            node["xmlns"] = "http://www.w3.org/1998/Math/MathML"
            if attrs.get("display") == "block":
                node["display"] = "block"
    # The reader paginates top-level blocks. Keep adjacent inline content together.
    para = None
    for child in list(soup.contents):
        if isinstance(child, Tag) and child.name in BLOCKS:
            para = None
        elif isinstance(child, Tag) or child.strip() or para is not None:
            if para is None:
                para = soup.new_tag("p")
                child.insert_before(para)
            para.append(child.extract())
    return str(soup).strip()


def import_feed(source, root, cache_only, limit):
    raw = json.loads(source.read_text(encoding="utf-8-sig"))
    rows, seen, groups, excluded = [], set(), set(), []
    for item in raw:
        identity = canonical(item.get("url"))
        if not identity or identity[0] in seen or not item.get("title"):
            continue
        seen.add(identity[0])
        soup = BeautifulSoup(item.get("bodyHtml") or "", "html.parser")
        text = soup.get_text(strip=True)
        images = list(visible_images(soup))
        paywall = item.get("paywall") or item.get("previewOnly") or re.search(
            r"购买后可查看完整内容|开通会员(继续|即可)阅读|购买后(即可|继续)阅读", text[-70:])
        video_only = soup.find("video") and len(text) < 80 and not soup.select_one("figure img")
        if paywall or video_only or not (text or images):
            excluded.append({"url": identity[1], "reason": "paywall" if paywall else "video-only" if video_only else "empty"})
            continue
        for img in images:
            groups.add(image_urls(img))
        groups.update((urls(item.get("cover")), urls(item.get("avatar"))))
        detail = item.get("detailMeta") or {}
        groups.add(urls(detail.get("hero")))
        rows.append((item, identity, soup))
        if len(rows) == limit:
            break
    folder = root / "assets" / "feed"
    folder.mkdir(parents=True, exist_ok=True)
    groups.discard(())
    groups = sorted(groups)
    with ThreadPoolExecutor(max_workers=6) as workers:
        assets = dict(zip(groups, workers.map(lambda group: fetch_group(group, folder), groups)))
    cards, articles = [], []
    inline_images, inline_files, missing_inline = 0, set(), []
    for item, (key, origin), soup in rows:
        card = {k: item[k] for k in ("title", "author", "excerpt", *STATS) if item.get(k) is not None}
        for name in STATS:
            count = card.get(name)
            if isinstance(count, str) and re.fullmatch(r"\d+|\d{1,3}(?:,\d{3})+", count):
                card[name] = int(count.replace(",", ""))
        card["url"] = origin
        cover = assets.get(urls(item.get("cover")))
        if cover:
            card["cover"] = cover
        cards.append(card)
        for image in visible_images(soup):
            inline_images += 1
            local = assets.get(image_urls(image))
            if local:
                inline_files.add(local)
            else:
                missing_inline.append({"article": origin, "alt": image.get("alt", ""),
                                       "url": (image.get("data-original") or image.get("src") or "")[:260]})
        body = clean_body(soup, assets, origin)
        if not soup.get_text(strip=True) and not soup.find("img"):
            continue
        card["sampleId"] = key
        kind = "answer" if key.startswith("answer-") else "article"
        article = {**card, "id": key, "type": kind, "kind": item.get("kind") or ("知乎回答" if kind == "answer" else "知乎专栏"), "bodyHtml": body}
        if item.get("heading"):
            article["title"] = item["heading"]
        if item.get("lead"):
            article["lead"] = item["lead"]
        avatar = assets.get(urls(item.get("avatar")))
        if avatar:
            article["avatar"] = avatar
        detail = item.get("detailMeta") or {}
        if detail:
            metadata = {k: detail[k] for k in ("topics", "questionDescription", "followers", "views", "answersLabel",
                                                "bio", "profileUrl", "date", "column", "verified")
                        if detail.get(k) is not None}
            hero = assets.get(urls(detail.get("hero")))
            if hero:
                metadata["hero"] = hero
            article["detailMeta"] = metadata
        articles.append(article)
    missing = [group for group in groups if not assets[group]]
    report = {"input": len(raw), "cards": len(cards), "articles": len(articles), "imageVariants": len(groups),
              "localMediaFiles": len(set(assets.values()) - {None}), "failed": missing,
              "bodyImageSlots": inline_images, "uniqueBodyImages": len(inline_files),
              "missingBodyImages": missing_inline, "excluded": excluded}
    atomic_write(source.with_suffix(".report.json"), json.dumps(report, ensure_ascii=False, indent=2).encode())
    if not cache_only:
        blocks = []
        for name, data in (("ZHIHU_FEED", cards), ("ZHIHU_OFFLINE_ARTICLES", articles)):
            blocks.append("window." + name + " = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n")
        atomic_write(root / "feed-data.js", "".join(blocks).encode())
    print(f"{len(cards)} cards, {len(articles)} offline articles, {report['localMediaFiles']} unique local media files, {len(missing)} failed image groups.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--cache-only", action="store_true")
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    import_feed(args.source.resolve(), args.root.resolve(), args.cache_only, args.limit)
