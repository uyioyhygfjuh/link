import { NextRequest, NextResponse } from 'next/server';

// Detect if URL is from a social media or known platform
function isSocialMediaOrKnownPlatform(url: string): boolean {
  const knownDomains = [
    // Social Media
    'facebook.com', 'fb.com', 'twitter.com', 'x.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'snapchat.com',
    'pinterest.com', 'reddit.com', 'tumblr.com', 'whatsapp.com',
    't.me', 'telegram.org', 'telegram.me',
    // URL Shorteners
    'goo.gl', 'bit.ly', 't.co', 'ow.ly', 'tinyurl.com', 'buff.ly',
    // E-commerce
    'amazon.com', 'amzn.to', 'flipkart.com', 'ebay.com', 'meesho.com',
    // Tools & Services
    'prntscr.com', 'lightshot.com', 'imgur.com', 'gyazo.com'
  ];
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase().replace('www.', '').replace('app.', '');
    return knownDomains.some(domain => hostname.includes(domain));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const isSocialMedia = isSocialMediaOrKnownPlatform(url);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    // Special handling for social media
    let ok = response.ok;
    if (isSocialMedia && response.status >= 400 && response.status < 500) {
      // Social media 4xx errors (except 404/410) are likely bot protection
      if (response.status !== 404 && response.status !== 410) {
        ok = true; // Mark as "ok" (warning) instead of broken
      }
    }

    return NextResponse.json({
      url,
      status: response.status,
      ok: ok,
      statusText: response.statusText,
      isSocialMedia: isSocialMedia,
    });
  } catch (error: any) {
    // Check if it's a timeout
    if (error.name === 'AbortError') {
      return NextResponse.json({
        url,
        status: 408,
        ok: false,
        statusText: 'Request Timeout',
        error: true,
        isSocialMedia: isSocialMedia,
      });
    }
    
    return NextResponse.json({
      url,
      status: 0,
      ok: isSocialMedia, // Social media network errors likely mean accessible
      statusText: error.message || 'Failed to fetch',
      error: true,
      isSocialMedia: isSocialMedia,
    });
  }
}
