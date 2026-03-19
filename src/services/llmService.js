import { getProviders, PROVIDER_TYPES } from './providerService';

const getHeaders = (provider) => {
  const { type, apiKey } = provider;
  
  if (type === PROVIDER_TYPES.OPENAI) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
  }
  
  if (type === PROVIDER_TYPES.ANTHROPIC) {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };
  }
  
  if (type === PROVIDER_TYPES.GEMINI) {
    return {
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
};

const buildUrl = (provider, endpoint) => {
  const { type, host, apiKey, model } = provider;
  
  if (type === PROVIDER_TYPES.GEMINI) {
    return `${host}/models/${model}:generateContent?key=${apiKey}`;
  }
  
  return `${host}${endpoint}`;
};

const buildBody = (provider, prompt, options = {}) => {
  const { type } = provider;
  const model = options.model || provider.model;
  const temperature = options.temperature ?? 0;
  
  if (type === PROVIDER_TYPES.OPENAI) {
    return {
      model: model || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature,
      top_p: options.top_p ?? 1,
    };
  }
  
  if (type === PROVIDER_TYPES.ANTHROPIC) {
    return {
      model: model || 'claude-sonnet-4-20250514',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 10,
      temperature,
    };
  }
  
  if (type === PROVIDER_TYPES.GEMINI) {
    return {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        topP: options.top_p ?? 1,
      },
    };
  }
  
  return {
    model: model || 'llama3',
    prompt,
    stream: false,
    options: { temperature, top_p: options.top_p ?? 1 },
  };
};

const parseResponse = (provider, data) => {
  const { type } = provider;
  
  if (type === PROVIDER_TYPES.OPENAI) {
    return data.choices?.[0]?.message?.content || '';
  }
  
  if (type === PROVIDER_TYPES.ANTHROPIC) {
    return data.content?.[0]?.text || '';
  }
  
  if (type === PROVIDER_TYPES.GEMINI) {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
  
  return data.response || '';
};

export const generateCompletion = async (providerId, prompt, options = {}) => {
  const providers = getProviders();
  const provider = providers.find(p => p.id === providerId);
  
  if (!provider) {
    throw new Error('Provider not found');
  }
  
  const { type, host } = provider;
  const isOllama = type === PROVIDER_TYPES.OLLAMA;
  
  let endpoint = '/api/generate';
  if (type === PROVIDER_TYPES.OPENAI) endpoint = '/chat/completions';
  if (type === PROVIDER_TYPES.ANTHROPIC) endpoint = '/messages';
  
  const url = isOllama ? `${host}${endpoint}` : buildUrl(provider, endpoint);
  const headers = getHeaders(provider);
  const body = buildBody(provider, prompt, options);
  
  const maxRetries = options.maxRetries || 2;
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = options.timeout || 60000;
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        
        // Parse error to check for rate limit info
        let retryDelay = null;
        let isRateLimit = response.status === 429;
        let errorMessage = errorText;
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.error?.details) {
            const retryInfo = errorJson.error.details.find(d => d['@type']?.includes('RetryInfo'));
            if (retryInfo?.retryDelay) {
              // Parse duration like "31s" or "1m30s"
              const delayMatch = retryInfo.retryDelay.match(/(\d+)s/);
              if (delayMatch) {
                retryDelay = parseInt(delayMatch[1]) * 1000; // Convert to ms
              }
            }
          }
          // Extract user-friendly message
          if (errorJson.error?.message) {
            errorMessage = errorJson.error.message;
          }
        } catch (e) {
          // Not JSON, use raw text
        }
        
        // Retry on 500 errors and rate limits (429)
        if ((response.status >= 500 || isRateLimit) && attempt < maxRetries) {
          const delay = retryDelay || Math.min(1000 * Math.pow(2, attempt), 5000);
          const delaySec = Math.ceil(delay / 1000);
          
          if (isRateLimit) {
            console.warn(`[LLM Service] Rate limit hit for ${type}. Waiting ${delaySec}s before retry ${attempt + 1}/${maxRetries + 1}...`);
          } else {
            console.warn(`[LLM Service] ${type} API error ${response.status}, retrying in ${delaySec}s (${attempt + 1}/${maxRetries + 1})...`);
          }
          
          lastError = new Error(`${type} API error: ${response.status} - ${errorMessage}`);
          await new Promise(resolve => setTimeout(resolve, Math.min(delay, 60000))); // Cap at 60s
          continue;
        }
        
        // If it's a rate limit and we've exhausted retries, provide a helpful message
        if (isRateLimit) {
          throw new Error(`${type} rate limit exceeded. You've hit the API quota limit. Please wait a few minutes before trying again, or check your plan and billing details at https://ai.google.dev/gemini-api/docs/rate-limits`);
        }
        
        throw new Error(`${type} API error: ${response.status} - ${errorMessage}`);
      }
      
      const data = await response.json();
      const text = parseResponse(provider, data);
      
      return { response: text, raw: data };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        if (attempt < maxRetries) {
          console.warn(`[LLM Service] Request timed out, retrying (${attempt + 1}/${maxRetries + 1})...`);
          lastError = new Error(`Request timed out after ${timeout / 1000} seconds`);
          await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 5000)));
          continue;
        }
        throw new Error(`Request timed out after ${timeout / 1000} seconds`);
      }
      // For other errors, retry if we haven't exhausted retries
      if (attempt < maxRetries) {
        console.warn(`[LLM Service] Error: ${error.message}, retrying (${attempt + 1}/${maxRetries + 1})...`);
        lastError = error;
        await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, attempt), 5000)));
        continue;
      }
      throw error;
    }
  }
  
  throw lastError || new Error('Failed after all retries');
};

export const getAvailableModels = async (providerId) => {
  const providers = getProviders();
  const provider = providers.find(p => p.id === providerId);
  
  if (!provider) return [];
  
  try {
    if (provider.type === PROVIDER_TYPES.OLLAMA) {
      const response = await fetch(`${provider.host}/api/tags`);
      const data = await response.json();
      return data.models?.map(m => ({
        id: m.name,
        name: m.name,
        provider: provider.name,
      })) || [];
    }
    
    if (provider.type === PROVIDER_TYPES.OPENAI) {
      const response = await fetch(`${provider.host}/models`, {
        headers: { 'Authorization': `Bearer ${provider.apiKey}` },
      });
      const data = await response.json();
      return data.data?.map(m => ({
        id: m.id,
        name: m.id,
        provider: provider.name,
      })) || [];
    }
    
    if (provider.type === PROVIDER_TYPES.ANTHROPIC) {
      return [{ id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: provider.name },
              { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: provider.name }];
    }
    
    if (provider.type === PROVIDER_TYPES.GEMINI) {
      const response = await fetch(`${provider.host}/models?key=${provider.apiKey}`);
      const data = await response.json();
      return data.models?.map(m => ({
        id: m.name.replace('models/', ''),
        name: m.name,
        provider: provider.name,
      })) || [];
    }
  } catch (error) {
    console.error('Failed to fetch models:', error);
    return [];
  }
};
