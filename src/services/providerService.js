const STORAGE_KEY = 'kmail-bbq-providers';

export const PROVIDER_TYPES = {
  OLLAMA: 'ollama',
  OPENAI: 'openai',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
};

export const PROVIDER_DEFAULTS = {
  [PROVIDER_TYPES.OLLAMA]: {
    name: 'Ollama',
    host: 'http://localhost:11434',
    apiKeyRequired: false,
  },
  [PROVIDER_TYPES.OPENAI]: {
    name: 'OpenAI',
    host: 'https://api.openai.com/v1',
    apiKeyRequired: true,
    model: 'gpt-4o',
  },
  [PROVIDER_TYPES.ANTHROPIC]: {
    name: 'Anthropic',
    host: 'https://api.anthropic.com/v1',
    apiKeyRequired: true,
    model: 'claude-sonnet-4-20250514',
  },
  [PROVIDER_TYPES.GEMINI]: {
    name: 'Google Gemini',
    host: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyRequired: true,
    model: 'gemini-2.0-flash',
  },
};

export const getProviders = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load providers:', e);
  }
  return [{ ...PROVIDER_DEFAULTS[PROVIDER_TYPES.OLLAMA], type: PROVIDER_TYPES.OLLAMA, id: 'default-ollama', enabled: true }];
};

export const saveProviders = (providers) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(providers));
};

export const addProvider = (provider) => {
  const providers = getProviders();
  const newProvider = {
    ...provider,
    id: `${provider.type}-${Date.now()}`,
    enabled: true,
  };
  providers.push(newProvider);
  saveProviders(providers);
  return newProvider;
};

export const updateProvider = (id, updates) => {
  const providers = getProviders();
  const index = providers.findIndex(p => p.id === id);
  if (index !== -1) {
    providers[index] = { ...providers[index], ...updates };
    saveProviders(providers);
    return providers[index];
  }
  return null;
};

export const deleteProvider = (id) => {
  const providers = getProviders();
  const filtered = providers.filter(p => p.id !== id);
  saveProviders(filtered);
};

export const getEnabledProviders = () => {
  return getProviders().filter(p => p.enabled);
};

export const testProviderConnection = async (provider) => {
  const { type, host, apiKey } = provider;
  
  try {
    if (type === PROVIDER_TYPES.OLLAMA) {
      const response = await fetch(`${host}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, models: data.models?.map(m => m.name) || [] };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    if (type === PROVIDER_TYPES.OPENAI) {
      const response = await fetch(`${host}/models`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, models: data.data?.map(m => m.id) || [] };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    if (type === PROVIDER_TYPES.ANTHROPIC) {
      const response = await fetch(`${host}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model || 'claude-sonnet-4-20250514',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }],
        }),
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        return { success: true, models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514'] };
      }
      const err = await response.json().catch(() => ({}));
      return { success: false, error: err.error?.message || `HTTP ${response.status}` };
    }
    
    if (type === PROVIDER_TYPES.GEMINI) {
      const response = await fetch(`${host}/models?key=${apiKey}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const data = await response.json();
        return { success: true, models: data.models?.map(m => m.name) || [] };
      }
      return { success: false, error: `HTTP ${response.status}` };
    }
    
    return { success: false, error: 'Unknown provider type' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
