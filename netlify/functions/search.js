const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

async function searchQwantWithPuppeteer(query, originalQuery) {
  let browser = null;
  
  try {
    // Launch browser with chromium for Netlify
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
    
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Build Qwant URL
    const qwantUrl = `https://www.qwant.com/?q=${encodeURIComponent(query)}&t=web`;
    
    // Navigate to Qwant
    await page.goto(qwantUrl, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });
    
    // Wait for results to load
    await page.waitForSelector('.gW4ak span', { timeout: 10000 }).catch(() => null);
    
    // Extract data using the same selectors as Web Scraper sitemap
    const result = await page.evaluate(() => {
      // Title selector: .gW4ak span
      const titleElement = document.querySelector('.gW4ak span');
      const title = titleElement ? titleElement.textContent.trim() : '';
      
      // Link selector: .Fqopp a
      const linkElement = document.querySelector('.Fqopp a');
      const url = linkElement ? linkElement.href : '';
      
      // Description selector: div.aVNer
      const descElement = document.querySelector('div.aVNer');
      const description = descElement ? descElement.textContent.trim() : '';
      
      return { title, url, description };
    });
    
    await browser.close();
    
    if (result.url && result.title) {
      return {
        url: result.url,
        title: result.title,
        description: result.description,
        error: null
      };
    }
    
    return {
      url: '',
      title: '',
      description: '',
      error: 'Nessun risultato trovato su Qwant'
    };
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    return {
      url: '',
      title: '',
      description: '',
      error: `Errore Puppeteer: ${error.message}`
    };
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { domain, query } = JSON.parse(event.body);
    
    if (!domain || !query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Dominio e query sono richiesti' })
      };
    }
    
    const cleanDomain = domain.replace(/\.\*$/, '').replace(/\*$/, '').replace(/\.$/, '').trim();
    const searchQuery = `site:${cleanDomain} "${query}"`;
    
    // Search with Puppeteer
    const result = await searchQwantWithPuppeteer(searchQuery, query);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};