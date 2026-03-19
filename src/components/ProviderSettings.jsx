import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Check, Key, Globe, Loader2 } from 'lucide-react';
import { 
  getProviders, 
  addProvider, 
  deleteProvider, 
  testProviderConnection,
  PROVIDER_TYPES,
  PROVIDER_DEFAULTS 
} from '../services/providerService';

const PROVIDER_TYPE_OPTIONS = [
  { value: PROVIDER_TYPES.OLLAMA, label: 'Ollama (Local)' },
  { value: PROVIDER_TYPES.OPENAI, label: 'OpenAI' },
  { value: PROVIDER_TYPES.ANTHROPIC, label: 'Anthropic' },
  { value: PROVIDER_TYPES.GEMINI, label: 'Google Gemini' },
];

export default function ProviderSettings({ isOpen, onClose, onProviderAdded }) {
  const [providers, setProviders] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  
  const [formData, setFormData] = useState({
    type: PROVIDER_TYPES.OLLAMA,
    name: '',
    host: '',
    apiKey: '',
    model: '',
  });

  useEffect(() => {
    if (isOpen) {
      const loadProviders = () => {
        const stored = getProviders();
        setProviders(stored);
      };
      loadProviders();
    }
  }, [isOpen]);

  const handleTypeChange = (type) => {
    const defaults = PROVIDER_DEFAULTS[type];
    setFormData({
      ...formData,
      type,
      name: defaults.name,
      host: defaults.host,
      model: defaults.model || '',
    });
  };

  const handleAdd = () => {
    if (!formData.name || (!formData.apiKey && PROVIDER_DEFAULTS[formData.type].apiKeyRequired)) {
      return;
    }
    addProvider(formData);
    setProviders(getProviders());
    setShowAddForm(false);
    setFormData({ type: PROVIDER_TYPES.OLLAMA, name: '', host: '', apiKey: '', model: '' });
    if (onProviderAdded) onProviderAdded();
  };

  const handleDelete = (id) => {
    deleteProvider(id);
    setProviders(getProviders());
    if (onProviderAdded) onProviderAdded();
  };

  const handleTest = async (provider) => {
    setTestingId(provider.id);
    setTestResult(null);
    const result = await testProviderConnection(provider);
    setTestResult({ id: provider.id, ...result });
    setTestingId(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">AI Providers</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(80vh-130px)]">
          {providers.map((provider) => (
            <div key={provider.id} className="border rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800">{provider.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded ${provider.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {provider.type}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {provider.host}
                  </div>
                  {provider.model && (
                    <div className="text-sm text-gray-500">Model: {provider.model}</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleTest(provider)}
                    disabled={testingId === provider.id}
                    className="p-2 hover:bg-gray-100 rounded-lg text-blue-600"
                    title="Test Connection"
                  >
                    {testingId === provider.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    className="p-2 hover:bg-gray-100 rounded-lg text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {testResult?.id === provider.id && (
                <div className={`mt-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                  {testResult.success ? `Connected! Found ${testResult.models?.length || 0} models.` : `Failed: ${testResult.error}`}
                </div>
              )}
            </div>
          ))}

          {showAddForm ? (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-gray-800 mb-3">Add New Provider</h3>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    {PROVIDER_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="My Ollama"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Host URL</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder="http://localhost:11434"
                  />
                </div>

                {PROVIDER_DEFAULTS[formData.type].apiKeyRequired && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Key className="w-4 h-4 inline mr-1" />
                      API Key
                    </label>
                    <input
                      type="password"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg"
                      placeholder="sk-..."
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                    placeholder={PROVIDER_DEFAULTS[formData.type].model || 'llama3'}
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleAdd}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add Provider
                  </button>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600"
            >
              <Plus className="w-5 h-5" />
              Add Provider
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
