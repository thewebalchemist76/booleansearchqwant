const fetch = require('node-fetch');

function calculateSimilarity(str1, str2) {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1.0;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  let matches = 0;
  
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.length > 3 && word2.length > 3 && word1 === word2) {
        matches++;
      }
    }
  }
  
  return matches / Math.max(words1.length, words2.length);
}

async function searchQwant(query, originalQuery) {
  try {
    const apiUrl = `https://api.qwant.com/v3/search/web?q=${encodeURIComponent(query)}&locale=it_IT&count=10&offset=0`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.qwant.com/',
        'Origin': 'https://www.qwant.com',
      }
    });
    
    if (!response.ok) {
      return {
        url: '',
        title: '',
        error: `Errore Qwant API HTTP ${response.status}`
      };
    }
    
    const data = await response.json();
    
    if (data.status !== 'success') {
      return {
        url: '',
        title: '',
        error: 'Errore nella risposta Qwant API'
      };
    }
    
    if (!data.data || !data.data.result || !data.data.result.items || data.data.result.items.length === 0) {
      return {
        url: '',
        title: '',
        error: 'Nessun risultato trovato su Qwant'
      };
    }
    
    const results = [];
    
    for (const item of data.data.result.items) {
      if (item.type === 'web' || item.items) {
        const webItems = item.items || [item];
        
        for (const webItem of webItems) {
          if (webItem.url && webItem.title) {
            const url = webItem.url;
            const title = webItem.title;
            const desc = webItem.desc || '';
            
            const titleSimilarity = calculateSimilarity(title, originalQuery);
            const descSimilarity = calculateSimilarity(desc, originalQuery);
            const similarity = Math.max(titleSimilarity, descSimilarity * 0.8);
            
            results.push({ 
              url, 
              title: title.replace(/<[^>]+>/g, ''),
              similarity 
            });
          }
        }
      }
    }
    
    if (results.length > 0) {
      results.sort((a, b) => b.similarity - a.similarity);
      const best = results[0];
      
      return {
        url: best.url,
        title: best.title,
        error: null
      };
    }
    
    return {
      url: '',
      title: '',
      error: 'Nessun risultato trovato'
    };
  } catch (error) {
    return {
      url: '',
      title: '',
      error: `Errore Qwant: ${error.message}`
    };
  }
}

exports.handler = async (event) => {
  // Handle CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow POST
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
    
    const result = await searchQwant(searchQuery, query);
    
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