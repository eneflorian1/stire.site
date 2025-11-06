from datetime import datetime
from typing import Any, cast
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy import desc
from sqlmodel import Session, select
from db import get_session
from models import Article
import re
import os

router = APIRouter()

# Get base URL from environment or use default
SITE_URL = os.environ.get("SITE_URL", "https://stirix.site")


def _slugify(title: str) -> str:
    """Generate slug from title (same as in routers_articles.py)"""
    value = title.lower()
    value = re.sub(r"[^a-z0-9\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value).strip("-")
    return value[:120]


@router.get("/sitemap.xml")
def generate_sitemap(request: Request, session: Session = Depends(get_session)) -> Response:
    """
    Generate sitemap.xml for Google Search Console.
    Includes homepage, all articles, and static pages.
    """
    # Use SITE_URL from env if properly set, otherwise infer from request
    if SITE_URL and SITE_URL.startswith("http"):
        base_url = SITE_URL.rstrip("/")
    else:
        # Infer from request (useful for dev or when SITE_URL not set)
        scheme = request.url.scheme
        host = request.headers.get("host", "localhost")
        base_url = f"{scheme}://{host}"
    
    # Get all published articles
    published_col = cast(Any, Article.published_at)
    articles = session.exec(
        select(Article).order_by(desc(published_col))
    ).all()
    
    # Build XML
    xml_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    
    # Homepage
    xml_lines.append("  <url>")
    xml_lines.append(f"    <loc>{base_url}/</loc>")
    xml_lines.append("    <changefreq>daily</changefreq>")
    xml_lines.append("    <priority>1.0</priority>")
    xml_lines.append("  </url>")
    
    # Static pages
    static_pages = [
        ("/categorii", "weekly", "0.8"),
        ("/salvate", "monthly", "0.5"),
        ("/profil", "monthly", "0.5"),
    ]
    
    for path, changefreq, priority in static_pages:
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{base_url}{path}</loc>")
        xml_lines.append(f"    <changefreq>{changefreq}</changefreq>")
        xml_lines.append(f"    <priority>{priority}</priority>")
        xml_lines.append("  </url>")
    
    # Articles
    for article in articles:
        slug = _slugify(article.title)
        article_url = f"{base_url}/article/{slug}--{article.id}"
        
        xml_lines.append("  <url>")
        xml_lines.append(f"    <loc>{article_url}</loc>")
        
        # Use published_at as lastmod if available
        if article.published_at:
            lastmod = article.published_at.strftime("%Y-%m-%d")
            xml_lines.append(f"    <lastmod>{lastmod}</lastmod>")
        
        xml_lines.append("    <changefreq>weekly</changefreq>")
        xml_lines.append("    <priority>0.7</priority>")
        xml_lines.append("  </url>")
    
    xml_lines.append("</urlset>")
    
    xml_content = "\n".join(xml_lines)
    
    return Response(
        content=xml_content,
        media_type="application/xml",
        headers={"Cache-Control": "public, max-age=3600"}  # Cache for 1 hour
    )

