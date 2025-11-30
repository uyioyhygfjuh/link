import { NextRequest, NextResponse } from 'next/server';

// Detect if URL is from a social media or known platform
function isSocialMediaOrKnownPlatform(url: string): boolean {
  const knownDomains = [
    'facebook.com', 'fb.com', 'twitter.com', 'x.com', 'instagram.com',
    'linkedin.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'snapchat.com',
    'pinterest.com', 'reddit.com', 'tumblr.com', 'whatsapp.com',
    't.me', 'telegram.org', 'telegram.me',
    'goo.gl', 'bit.ly', 't.co', 'ow.ly', 'tinyurl.com', 'buff.ly',
    'amazon.com', 'amzn.to', 'flipkart.com', 'ebay.com', 'meesho.com',
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

// Check link status with retry logic (matches scanWorker.ts)
async function checkLinkStatus(url: string, retryCount = 0): Promise<{
  url: string;
  status: 'working' | 'broken' | 'warning';
  statusCode: number;
  error?: string;
}> {
  const maxRetries = 2;
  const isSocialMedia = isSocialMediaOrKnownPlatform(url);
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

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

    let status: 'working' | 'broken' | 'warning' = 'working';
    const statusCode = response.status;

    if (statusCode >= 200 && statusCode < 300) {
      status = 'working';
    } else if (statusCode >= 300 && statusCode < 400) {
      status = 'warning';
    } else if (statusCode >= 400 && statusCode < 500) {
      if (isSocialMedia) {
        if (statusCode === 400 || statusCode === 403 || statusCode === 405 || statusCode === 429) {
          status = 'warning';
        } else if (statusCode === 404 || statusCode === 410) {
          status = 'broken';
        } else {
          status = 'warning';
        }
      } else {
        status = 'broken';
      }
    } else if (statusCode >= 500) {
      if (isSocialMedia && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return checkLinkStatus(url, retryCount + 1);
      }
      status = 'warning';
    }

    return { url, status, statusCode };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      if (isSocialMedia && retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return checkLinkStatus(url, retryCount + 1);
      }
      return { url, status: 'warning', statusCode: 408, error: 'Timeout' };
    }
    
    if (isSocialMedia && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return checkLinkStatus(url, retryCount + 1);
    }
    
    if (isSocialMedia) {
      return { url, status: 'warning', statusCode: 0, error: error.message };
    }
    
    return { url, status: 'broken', statusCode: 0, error: error.message };
  }
}

// Test endpoint
export async function GET() {
  return NextResponse.json({ 
    message: 'Link checker API is running',
    usage: 'POST with { urls: ["url1", "url2"] }'
  });
}

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json();

    if (!urls || !Array.isArray(urls)) {
      return NextResponse.json(
        { error: 'Invalid request. Expected array of URLs.' },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      urls.map(async (url: string) => {
        try {
          // Validate URL format
          try {
            new URL(url);
          } catch {
            return {
              url,
              status: 'warning',
              statusCode: 0,
              error: 'Invalid URL format'
            };
          }

          // Use the same checkLinkStatus function as scanWorker.ts
          const result = await checkLinkStatus(url);
          return result;
        } catch (error: any) {
          return {
            url,
            status: 'broken',
            statusCode: 0,
            error: error.message || 'Unknown error'
          };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Link checking error:', error);
    return NextResponse.json(
      { error: 'Failed to check links', details: error.message },
      { status: 500 }
    );
  }
}
