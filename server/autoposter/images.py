from __future__ import annotations

import os
import re
import json
from typing import Optional, Any, Callable
from urllib import request, error as urlerror, parse as urlparse
from datetime import datetime

from config import UPLOAD_DIR, PUBLIC_UPLOAD_URL_PREFIX
from . import sources


def is_valid_banner_image(img_url: str) -> bool:
    """Verifică dacă un URL de imagine este un banner valid (nu logo/thumbnail)."""
    img_url_lower = img_url.lower()

    exclude_keywords = [
        "logo", "icon", "avatar", "favicon", "sprite", "thumbnail",
        "thumb", "small", "mini", "profile", "user", "author"
    ]
    if any(keyword in img_url_lower for keyword in exclude_keywords):
        return False

    size_patterns = [
        r'[=_-]w(\d+)',
        r'[=_-]h(\d+)',
        r'[=_-]size=(\d+)',
        r'[=_-]size=small',
        r'[=_-]s(\d+)',
        r'[=_-](\d+)x(\d+)',
    ]
    for pattern in size_patterns:
        match = re.search(pattern, img_url_lower)
        if match:
            if 'w' in pattern or 'width' in pattern or 's' in pattern:
                size_str = match.group(1)
                try:
                    size = int(size_str)
                    if size < 400:
                        return False
                except (ValueError, IndexError):
                    pass
            elif 'h' in pattern or 'height' in pattern:
                size_str = match.group(1)
                try:
                    size = int(size_str)
                    if size < 400:
                        return False
                except (ValueError, IndexError):
                    pass
            elif 'x' in pattern:
                try:
                    width = int(match.group(1))
                    height = int(match.group(2))
                    if width < 400 or height < 300:
                        return False
                except (ValueError, IndexError):
                    pass
            elif 'small' in pattern:
                return False

    if 'googleusercontent.com' in img_url_lower:
        google_cdn_pattern = r'=s\d*-w(\d+)'
        match = re.search(google_cdn_pattern, img_url_lower)
        if match:
            try:
                width = int(match.group(1))
                if width < 400:
                    return False
            except (ValueError, IndexError):
                if re.search(r'=s\d*-w[0-3]\d{2}', img_url_lower):
                    return False
        if re.search(r'[=_-]w\d+[^0-9]', img_url_lower) or re.search(r'[=_-]s\d+[^0-9]', img_url_lower):
            w_match = re.search(r'[=_-]w(\d+)', img_url_lower)
            s_match = re.search(r'[=_-]s(\d+)', img_url_lower)
            if w_match:
                try:
                    if int(w_match.group(1)) < 400:
                        return False
                except ValueError:
                    pass
            if s_match:
                try:
                    if int(s_match.group(1)) < 400:
                        return False
                except ValueError:
                    pass

    if any(pattern in img_url_lower for pattern in ['/thumb/', '/small/', '/mini/', '/icon/', '/logo/', '/avatar/']):
        return False

    return True


def extract_main_image_from_url(url: str) -> Optional[str]:
    """Extrage imaginea principală dintr-un URL de știre."""
    if not url:
        return None
    html = sources.fetch_page_html(url)
    if not html:
        return None
    try:
        parsed_base = urlparse.urlparse(url)
        base_url = f"{parsed_base.scheme}://{parsed_base.netloc}"
    except Exception:
        base_url = ""

    og_image_patterns = [
        r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
        r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:image["\']',
        r'<meta\s+property=["\']og:image:url["\']\s+content=["\']([^"\']+)["\']',
        r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:image:url["\']',
        r'<meta\s+property=["\']og:image:secure_url["\']\s+content=["\']([^"\']+)["\']',
        r'<meta\s+content=["\']([^"\']+)["\']\s+property=["\']og:image:secure_url["\']',
        r'<meta\s+name=["\']twitter:image["\']\s+content=["\']([^"\']+)["\']',
        r'<meta\s+content=["\']([^"\']+)["\']\s+name=["\']twitter:image["\']',
        r'<meta\s+name=["\']twitter:image:src["\']\s+content=["\']([^"\']+)["\']',
        r'<meta\s+content=["\']([^"\']+)["\']\s+name=["\']twitter:image:src["\']',
    ]
    for pattern in og_image_patterns:
        match = re.search(pattern, html, re.IGNORECASE)
        if match:
            img_url = match.group(1).strip()
            if img_url:
                if img_url.startswith("//"):
                    img_url = f"{parsed_base.scheme}:{img_url}"
                elif img_url.startswith("/"):
                    img_url = f"{base_url}{img_url}"
                elif not img_url.startswith(("http://", "https://")):
                    img_url = f"{base_url}/{img_url}"
                if img_url.startswith(("http://", "https://")) and is_valid_banner_image(img_url):
                    return img_url

    try:
        for m in re.finditer(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, re.IGNORECASE | re.DOTALL):
            json_text = m.group(1).strip()
            json_text = re.sub(r'<!--.*?-->', '', json_text, flags=re.DOTALL)
            data_obj: Any = json.loads(json_text)
            objs = data_obj if isinstance(data_obj, list) else [data_obj]
            def _extract_from_field(val: Any) -> Optional[str]:
                if isinstance(val, str):
                    return val
                if isinstance(val, dict):
                    u = val.get("url") or val.get("@id")
                    if isinstance(u, str):
                        return u
                if isinstance(val, list) and val:
                    for it in val:
                        r = _extract_from_field(it)
                        if r:
                            return r
                return None
            for obj in objs:
                if not isinstance(obj, dict):
                    continue
                for k in ("image", "thumbnailUrl", "thumbnailURL"):
                    if k in obj:
                        candidate = _extract_from_field(obj[k])
                        if candidate:
                            img_url = candidate.strip()
                            if img_url.startswith("//"):
                                img_url = f"{parsed_base.scheme}:{img_url}"
                            elif img_url.startswith("/"):
                                img_url = f"{base_url}{img_url}"
                            elif not img_url.startswith(("http://", "https://")):
                                img_url = f"{base_url}/{img_url}"
                            if img_url.startswith(("http://", "https://")) and is_valid_banner_image(img_url):
                                return img_url
    except Exception:
        pass

    link_match = re.search(r'<link[^>]+rel=["\']image_src["\'][^>]+href=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if link_match:
        img_url = link_match.group(1).strip()
        if img_url:
            if img_url.startswith("//"):
                img_url = f"{parsed_base.scheme}:{img_url}"
            elif img_url.startswith("/"):
                img_url = f"{base_url}{img_url}"
            elif not img_url.startswith(("http://", "https://")):
                img_url = f"{base_url}/{img_url}"
            if img_url.startswith(("http://", "https://")) and is_valid_banner_image(img_url):
                return img_url

    img_pattern = r'<img[^>]+src=["\']([^"\']+)["\']'
    img_matches = re.finditer(img_pattern, html, re.IGNORECASE)
    candidates: list[tuple[str, int]] = []
    for match in img_matches:
        img_url = match.group(1).strip()
        if not img_url:
            continue
        if img_url.startswith("//"):
            img_url = f"{parsed_base.scheme}:{img_url}"
        elif img_url.startswith("/"):
            img_url = f"{base_url}{img_url}"
        elif not img_url.startswith(("http://", "https://")):
            img_url = f"{base_url}/{img_url}"
        if not img_url.startswith(("http://", "https://")) or img_url.startswith("data:"):
            continue
        if not is_valid_banner_image(img_url):
            continue
        img_tag = match.group(0)
        width = 0
        height = 0
        width_match = re.search(r'width=["\']?(\d+)["\']?', img_tag, re.IGNORECASE)
        height_match = re.search(r'height=["\']?(\d+)["\']?', img_tag, re.IGNORECASE)
        if width_match:
            try:
                width = int(width_match.group(1))
            except ValueError:
                pass
        if height_match:
            try:
                height = int(height_match.group(1))
            except ValueError:
                pass
        if width == 0 and height == 0:
            score = 500
        else:
            score = width * height
            if width > 0 and height > 0:
                aspect_ratio = width / height
                if 1.5 <= aspect_ratio <= 2.5:
                    score = int(score * 1.2)
        candidates.append((img_url, score))

    source_pattern = r'<source[^>]+srcset=["\']([^"\']+)["\']'
    for sm in re.finditer(source_pattern, html, re.IGNORECASE):
        srcset = sm.group(1).strip()
        parts = [p.strip() for p in srcset.split(",") if p.strip()]
        best_url = ""
        best_w = 0
        for p in parts:
            segs = p.split()
            if not segs:
                continue
            u = segs[0]
            w = 0
            if len(segs) > 1 and segs[1].endswith("w"):
                try:
                    w = int(segs[1][:-1])
                except Exception:
                    w = 0
            if u.startswith("//"):
                u = f"{parsed_base.scheme}:{u}"
            elif u.startswith("/"):
                u = f"{base_url}{u}"
            elif not u.startswith(("http://", "https://")):
                u = f"{base_url}/{u}"
            if not u.startswith(("http://", "https://")) or u.startswith("data:"):
                continue
            if not is_valid_banner_image(u):
                continue
            if w > best_w:
                best_w = w
                best_url = u
        if best_url:
            candidates.append((best_url, 800 + best_w))

    if candidates:
        candidates.sort(key=lambda x: x[1], reverse=True)
        return candidates[0][0]
    return None


def validate_image_url(url: str) -> bool:
    """Validează că un URL de imagine este valid și accesibil."""
    if not url or not isinstance(url, str):
        return False
    if len(url) > 2048:
        return False
    if url.startswith("data:") or url.startswith("data:image/svg+xml"):
        return False
    if not url.startswith(("http://", "https://")):
        return False
    return True


def search_google_images(query: str, max_results: int = 3, wait_callback: Optional[Callable[[float], bool]] = None) -> list[str]:
    """Caută imagini pe Google Images pentru un query și returnează o listă de imagini valide."""
    if not query or not query.strip():
        return []
    # Limitează numărul de opțiuni returnate la maximum 3
    max_results = min(max_results, 3)
    max_retries = 3
    retry_delay = 2.0
    for attempt in range(1, max_retries + 1):
        try:
            q = urlparse.quote_plus(query)
            search_url = f"https://www.google.com/search?q={q}&tbm=isch&hl=ro&gl=RO"
            req = request.Request(
                search_url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Referer": "https://www.google.com/",
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "same-origin",
                    "Sec-Fetch-User": "?1",
                    "Upgrade-Insecure-Requests": "1",
                    "Connection": "keep-alive",
                    "Cache-Control": "max-age=0",
                },
                method="GET",
            )
            with request.urlopen(req, timeout=15) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                try:
                    html = resp.read().decode(charset, errors="replace")
                except Exception:
                    html = resp.read().decode("utf-8", errors="replace")
            if "captcha" in html.lower() or "unusual traffic" in html.lower() or "our systems have detected" in html.lower():
                if attempt < max_retries:
                    if wait_callback:
                        if wait_callback(retry_delay * attempt):
                            return []
                    continue
                return []
            if len(html) < 1000:
                if attempt < max_retries:
                    if wait_callback:
                        if wait_callback(retry_delay * attempt):
                            return []
                    continue
                return []
            found_urls: set[str] = set()
            direct_url_pattern = r'https://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"\'<>]*)?'
            matches = re.finditer(direct_url_pattern, html, re.IGNORECASE)
            for match in matches:
                url_str = match.group(0).strip().strip('"\'')
                if url_str.startswith("https://") and is_valid_banner_image(url_str):
                    found_urls.add(url_str)
            json_patterns = [
                r'"ou"\s*:\s*"([^"]+)"',
                r'"url"\s*:\s*"([^"]+)"',
                r'"src"\s*:\s*"([^"]+)"',
            ]
            for pattern in json_patterns:
                for match in re.finditer(pattern, html, re.IGNORECASE):
                    url_str = match.group(1).strip()
                    url_str = url_str.replace('\\/', '/').replace('\\u003d', '=').replace('\\u0026', '&')
                    url_str = url_str.replace('\\"', '"').replace("\\'", "'")
                    if url_str.startswith("https://") and is_valid_banner_image(url_str):
                        found_urls.add(url_str)
            lazy_patterns = [
                r'data-src=["\']([^"\']+)["\']',
                r'data-original=["\']([^"\']+)["\']',
                r'srcset=["\']([^"\']+)["\']',
                r'data-imgsrc=["\']([^"\']+)["\']',
            ]
            for pattern in lazy_patterns:
                for match in re.finditer(pattern, html, re.IGNORECASE):
                    url_str = match.group(1).strip()
                    if ' ' in url_str:
                        url_str = url_str.split()[0]
                    if url_str.startswith("https://") and is_valid_banner_image(url_str):
                        found_urls.add(url_str)
            script_pattern = r'<script[^>]*>(.*?)</script>'
            for script_match in re.finditer(script_pattern, html, re.IGNORECASE | re.DOTALL):
                script_content = script_match.group(1)
                for url_match in re.finditer(r'https://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp|gif)', script_content, re.IGNORECASE):
                    url_str = url_match.group(0).strip()
                    if is_valid_banner_image(url_str):
                        found_urls.add(url_str)
            af_init_pattern = r'AF_initDataCallback\([^)]*\)'
            for af_match in re.finditer(af_init_pattern, html, re.IGNORECASE):
                json_content = af_match.group(0)
                for url_match in re.finditer(r'https://[^\s"\'<>]+\.(?:jpg|jpeg|png|webp|gif)', json_content, re.IGNORECASE):
                    url_str = url_match.group(0).strip()
                    if is_valid_banner_image(url_str):
                        found_urls.add(url_str)
            for m in re.finditer(r'imgurl=([^&"\'<>]+)', html, re.IGNORECASE):
                try:
                    raw = m.group(1)
                    decoded = urlparse.unquote(raw)
                    if "%2F" in decoded or "%3A" in decoded:
                        decoded = urlparse.unquote(decoded)
                    if decoded.startswith("https://") and is_valid_banner_image(decoded):
                        found_urls.add(decoded)
                except Exception:
                    continue
            valid_urls: list[str] = []
            for u in found_urls:
                if validate_image_url(u):
                    valid_urls.append(u)
            sorted_urls = sorted(valid_urls, key=lambda x: (len(x.split('?')), x))
            if sorted_urls:
                return sorted_urls[:max_results]
            # Try new UI
            try:
                search_url2 = f"https://www.google.com/search?q={q}&udm=2&hl=ro&gl=RO"
                # clone headers but ensure Accept-Encoding not advertising brotli
                h2 = dict(req.headers)
                h2.pop("Accept-Encoding", None)
                req2 = request.Request(search_url2, headers=h2, method="GET")
                with request.urlopen(req2, timeout=15) as resp2:
                    charset2 = resp2.headers.get_content_charset() or "utf-8"
                    try:
                        html2 = resp2.read().decode(charset2, errors="replace")
                    except Exception:
                        html2 = resp2.read().decode("utf-8", errors="replace")
                found_urls2: set[str] = set()
                for m in re.finditer(direct_url_pattern, html2, re.IGNORECASE):
                    u = m.group(0).strip().strip('"\'')
                    if u.startswith("https://") and is_valid_banner_image(u):
                        found_urls2.add(u)
                for pattern in ["\"ou\"\\s*:\\s*\"([^\"]+)\"", "\"url\"\\s*:\\s*\"([^\"]+)\"", "\"src\"\\s*:\\s*\"([^\"]+)\""]:
                    for m in re.finditer(pattern, html2, re.IGNORECASE):
                        u = m.group(1).strip()
                        u = u.replace('\\/', '/').replace('\\u003d', '=').replace('\\u0026', '&').replace('\\"', '"').replace("\\'", "'")
                        if u.startswith("https://") and is_valid_banner_image(u):
                            found_urls2.add(u)
                for m in re.finditer(r'imgurl=([^&"\'<>]+)', html2, re.IGNORECASE):
                    try:
                        raw = m.group(1)
                        decoded = urlparse.unquote(raw)
                        if "%2F" in decoded or "%3A" in decoded:
                            decoded = urlparse.unquote(decoded)
                        if decoded.startswith("https://") and is_valid_banner_image(decoded):
                            found_urls2.add(decoded)
                    except Exception:
                        continue
                valid2 = [u for u in found_urls2 if validate_image_url(u)]
                sorted2 = sorted(valid2, key=lambda x: (len(x.split('?')), x))
                if sorted2:
                    return sorted2[:max_results]
            except Exception:
                pass
        except urlerror.HTTPError as e:
            if attempt < max_retries and e.code in (429, 503, 502, 500):
                if wait_callback:
                    if wait_callback(retry_delay * attempt):
                        return []
                continue
            break
        except Exception:
            if attempt < max_retries:
                if wait_callback:
                    if wait_callback(retry_delay * attempt):
                        return []
                continue
            break
    return []


def search_bing_images(query: str, max_results: int = 3, wait_callback: Optional[Callable[[float], bool]] = None) -> list[str]:
    """Caută imagini pe Bing Images ca fallback și returnează o listă de imagini valide."""
    if not query or not query.strip():
        return []
    max_results = min(max_results, 3)
    max_retries = 3
    retry_delay = 2.0
    for attempt in range(1, max_retries + 1):
        try:
            q = urlparse.quote_plus(query)
            # Prefer large images to reduce icons/thumbnails
            search_url = f"https://www.bing.com/images/search?q={q}&mkt=ro-RO&qft=+filterui:imagesize-large"
            req = request.Request(
                search_url,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                    ),
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                    "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Referer": "https://www.bing.com/",
                    "Connection": "keep-alive",
                    "Cache-Control": "max-age=0",
                },
                method="GET",
            )
            with request.urlopen(req, timeout=15) as resp:
                charset = resp.headers.get_content_charset() or "utf-8"
                try:
                    html = resp.read().decode(charset, errors="replace")
                except Exception:
                    html = resp.read().decode("utf-8", errors="replace")
            if "throttled" in html.lower() or "temporarily unavailable" in html.lower():
                if attempt < max_retries:
                    if wait_callback:
                        if wait_callback(retry_delay * attempt):
                            return []
                    continue
                return []
            # Prefer exact result tiles' original URLs ("murl") in page order
            ordered: list[str] = []
            seen: set[str] = set()
            # 1) Parse inline JSON present on result anchors: class="iusc" m='{"murl":"..."}'
            for jm in re.finditer(r'class="[^"]*iusc[^"]*"[^>]*\bm\s*=\s*[\'"]({.*?})[\'"]', html, re.IGNORECASE | re.DOTALL):
                raw = jm.group(1)
                try:
                    # unescape common encodings
                    raw = raw.replace("&quot;", "\"")
                    obj = json.loads(raw)
                    u = str(obj.get("murl") or "").strip()
                    if not u.startswith("http"):
                        continue
                    pu = urlparse.urlparse(u)
                    host = (pu.netloc or "").lower()
                    if "bing.com" in host or "microsoft.com" in host or "mm.bing.net" in host:
                        continue
                    if "/OHR/" in u:
                        continue
                    if u not in seen and is_valid_banner_image(u) and validate_image_url(u):
                        ordered.append(u)
                        seen.add(u)
                    if len(ordered) >= max_results:
                        break
                except Exception:
                    continue
            for m in re.finditer(r'"murl"\s*:\s*"([^"]+)"', html, re.IGNORECASE):
                u = m.group(1).strip().replace('\\/', '/')
                if not u.startswith("http"):
                    continue
                # Exclude Bing/Microsoft host images and daily wallpapers
                try:
                    pu = urlparse.urlparse(u)
                    host = (pu.netloc or "").lower()
                    if "bing.com" in host or "microsoft.com" in host or "mm.bing.net" in host:
                        # skip thumbnails or hero wallpapers
                        continue
                    if "/OHR/" in u:
                        continue
                except Exception:
                    pass
                if u not in seen and is_valid_banner_image(u) and validate_image_url(u):
                    ordered.append(u)
                    seen.add(u)
                if len(ordered) >= max_results:
                    break
            # Secondary pattern sometimes used in inline scripts
            if len(ordered) < max_results:
                for m in re.finditer(r'imgurl:([^,&"\']+)', html, re.IGNORECASE):
                    u = urlparse.unquote(m.group(1).strip())
                    if not u.startswith("http"):
                        continue
                    try:
                        pu = urlparse.urlparse(u)
                        host = (pu.netloc or "").lower()
                        if "bing.com" in host or "microsoft.com" in host or "mm.bing.net" in host:
                            continue
                        if "/OHR/" in u:
                            continue
                    except Exception:
                        pass
                    if u not in seen and is_valid_banner_image(u) and validate_image_url(u):
                        ordered.append(u)
                        seen.add(u)
                    if len(ordered) >= max_results:
                        break
            if ordered:
                return ordered[:max_results]
        except urlerror.HTTPError as e:
            if attempt < max_retries and e.code in (429, 503, 502, 500):
                if wait_callback:
                    if wait_callback(retry_delay * attempt):
                        return []
                continue
            break
        except Exception:
            if attempt < max_retries:
                if wait_callback:
                    if wait_callback(retry_delay * attempt):
                        return []
                continue
            break
    return []


def search_images(query: str, max_results: int = 3, wait_callback: Optional[Callable[[float], bool]] = None) -> list[str]:
    """Caută imagini folosind Google apoi Bing (fallback)."""
    results = search_google_images(query, max_results=max_results, wait_callback=wait_callback)
    if results:
        return results[:max_results]
    alt = search_bing_images(query, max_results=max_results, wait_callback=wait_callback)
    return alt[:max_results] if alt else []

 


def _slugify_filename(text_value: str) -> str:
    if not text_value:
        return "image"
    value = text_value.lower().strip()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value or "image"


def _guess_extension(url: str, content_type: Optional[str]) -> str:
    for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
        if url.lower().split("?")[0].endswith(ext):
            return ext if ext.startswith(".") else f".{ext}"
    m = (content_type or "").lower()
    if "jpeg" in m:
        return ".jpg"
    if "png" in m:
        return ".png"
    if "webp" in m:
        return ".webp"
    if "gif" in m:
        return ".gif"
    return ".jpg"


def download_image_to_uploads(url: str, name_hint: str) -> Optional[str]:
    """Download an image URL to UPLOAD_DIR and return its public URL or None."""
    if not url or not url.startswith(("http://", "https://")):
        return None
    try:
        if not os.path.isdir(UPLOAD_DIR):
            os.makedirs(UPLOAD_DIR, exist_ok=True)
    except Exception:
        return None

    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    slug = _slugify_filename(name_hint or "image")
    data: Optional[bytes] = None
    content_type: Optional[str] = None
    try:
        _parsed = urlparse.urlparse(url)
        host_referer = f"{_parsed.scheme}://{_parsed.netloc}/" if _parsed.scheme and _parsed.netloc else "https://www.google.com/"
    except Exception:
        host_referer = "https://www.google.com/"
    try:
        req = request.Request(
            url,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                ),
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": host_referer,
                "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
                "Connection": "keep-alive",
            },
            method="GET",
        )
        with request.urlopen(req, timeout=15) as resp:
            content_type = resp.headers.get("Content-Type", "")
            max_bytes = 10 * 1024 * 1024
            read_bytes: bytes = resp.read(max_bytes + 1)
            if len(read_bytes) == 0 or len(read_bytes) > max_bytes:
                data = None
            else:
                data = read_bytes
    except Exception:
        data = None
    if data is None:
        try:
            import requests  # type: ignore
            from urllib.parse import urlparse as _urlparse
            parsed = _urlparse(url)
            site_referer = f"{parsed.scheme}://{parsed.netloc}/" if parsed.scheme and parsed.netloc else "https://www.google.com/"
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                ),
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": site_referer,
                "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
                "Connection": "keep-alive",
            }
            with requests.get(url, headers=headers, timeout=15, stream=True) as r:
                r.raise_for_status()
                content_type = r.headers.get("Content-Type", "")
                max_bytes = 10 * 1024 * 1024
                chunks: list[bytes] = []
                total = 0
                for chunk in r.iter_content(chunk_size=64 * 1024):
                    if not chunk:
                        break
                    chunks.append(chunk)
                    total += len(chunk)
                    if total > max_bytes:
                        chunks = []
                        break
                if chunks:
                    data = b"".join(chunks)
        except Exception:
            data = None
    if data is None:
        try:
            no_q_url = url.split("#", 1)[0].split("?", 1)[0]
            if no_q_url and no_q_url != url:
                req2 = request.Request(
                    no_q_url,
                    headers={
                        "User-Agent": (
                            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                        ),
                        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                        "Referer": host_referer,
                        "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
                        "Connection": "keep-alive",
                    },
                    method="GET",
                )
                with request.urlopen(req2, timeout=15) as resp2:
                    content_type = resp2.headers.get("Content-Type", "") or content_type
                    max_bytes = 10 * 1024 * 1024
                    read_bytes2: bytes = resp2.read(max_bytes + 1)
                    if len(read_bytes2) > 0 and len(read_bytes2) <= max_bytes:
                        data = read_bytes2
            if data is None and no_q_url and no_q_url != url:
                import requests  # type: ignore
                from urllib.parse import urlparse as _urlparse
                parsed2 = _urlparse(no_q_url)
                site_referer2 = f"{parsed2.scheme}://{parsed2.netloc}/" if parsed2.scheme and parsed2.netloc else host_referer
                headers2 = {
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                    ),
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Referer": site_referer2,
                    "Accept-Language": "ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7",
                    "Connection": "keep-alive",
                }
                with requests.get(no_q_url, headers=headers2, timeout=15, stream=True) as r2:
                    r2.raise_for_status()
                    content_type = r2.headers.get("Content-Type", "") or content_type
                    max_bytes = 10 * 1024 * 1024
                    chunks2: list[bytes] = []
                    total2 = 0
                    for chunk in r2.iter_content(chunk_size=64 * 1024):
                        if not chunk:
                            break
                        chunks2.append(chunk)
                        total2 += len(chunk)
                        if total2 > max_bytes:
                            chunks2 = []
                            break
                    if chunks2:
                        data = b"".join(chunks2)
        except Exception:
            data = None
    if data is None:
        return None
    if content_type and not content_type.lower().startswith("image/"):
        if not any((url.lower().split("?", 1)[0].endswith(ext) for ext in (".jpg", ".jpeg", ".png", ".webp", ".gif"))):
            return None
    ext = _guess_extension(url, content_type)
    try:
        filename = f"{slug}-{timestamp}{ext}"
        abs_path = os.path.join(UPLOAD_DIR, filename)
        with open(abs_path, "wb") as f:
            f.write(data)
        return f"{PUBLIC_UPLOAD_URL_PREFIX}/{filename}"
    except Exception:
        return None


def extract_main_image_from_sources(sources_list: list[dict[str, str]]) -> Optional[str]:
    """Extrage imaginea principală din sursele disponibile."""
    if not sources_list:
        return None
    for source in sources_list:
        url = source.get("url", "").strip()
        pre_img = (source.get("image") or "").strip()
        if pre_img and pre_img.startswith(("http://", "https://")) and is_valid_banner_image(pre_img):
            return pre_img
        if not url:
            continue
        try:
            img_url = extract_main_image_from_url(url)
            if img_url:
                return img_url
        except Exception:
            continue
    return None


