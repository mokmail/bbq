// Local data files - loaded from public/data/ directory
// This saves data consumption by avoiding external network requests
export const BBQ_DATA_URLS = {
  Age: '/data/Age.jsonl',
  Gender_identity: '/data/Gender_identity.jsonl',
  Disability_status: '/data/Disability_status.jsonl',
  Nationality: '/data/Nationality.jsonl',
  Physical_appearance: '/data/Physical_appearance.jsonl',
  Race_ethnicity: '/data/Race_ethnicity.jsonl',
  Race_x_SES: '/data/Race_x_SES.jsonl',
  Race_x_gender: '/data/Race_x_gender.jsonl',
  Religion: '/data/Religion.jsonl',
  SES: '/data/SES.jsonl',
  Sexual_orientation: '/data/Sexual_orientation.jsonl',
};

const CACHE_DB_NAME = 'BBQCache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = 'questions';
const CACHE_META_STORE = 'metadata';
const CACHE_KEY = 'bbq_questions';
const CACHE_VERSION_KEY = 'bbq_cache_version';
const CACHE_VERSION = 1; // Increment this to force refresh

const LABEL_TO_LETTER = {
  0: 'A',
  1: 'B',
  2: 'C',
};

/**
 * Initialize IndexedDB for caching
 */
function openCacheDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create object store for questions
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'category' });
      }
      
      // Create object store for metadata
      if (!db.objectStoreNames.contains(CACHE_META_STORE)) {
        db.createObjectStore(CACHE_META_STORE, { keyPath: 'key' });
      }
    };
  });
}

/**
 * Get cached data from IndexedDB
 */
async function getCachedData() {
  try {
    const db = await openCacheDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHE_STORE_NAME, CACHE_META_STORE], 'readonly');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const metaStore = transaction.objectStore(CACHE_META_STORE);
      
      const cacheVersionRequest = metaStore.get(CACHE_VERSION_KEY);
      const allDataRequest = store.getAll();
      
      let cacheVersion = null;
      let allData = [];
      
      cacheVersionRequest.onsuccess = () => {
        cacheVersion = cacheVersionRequest.result?.value;
      };
      
      allDataRequest.onsuccess = () => {
        allData = allDataRequest.result || [];
      };
      
      transaction.oncomplete = () => {
        if (cacheVersion !== CACHE_VERSION) {
          resolve(null);
          return;
        }
        
        // Combine all questions from all categories
        const questions = [];
        allData.forEach(categoryData => {
          if (categoryData.questions) {
            questions.push(...categoryData.questions);
          }
        });
        
        resolve(questions.length > 0 ? questions : null);
      };
      
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('[BBQ Cache] Error reading from cache:', error);
    return null;
  }
}

/**
 * Save data to IndexedDB
 */
async function saveCachedData(questions, categories) {
  try {
    const db = await openCacheDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHE_STORE_NAME, CACHE_META_STORE], 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const metaStore = transaction.objectStore(CACHE_META_STORE);
      
      // Group questions by category
      const byCategory = {};
      questions.forEach(q => {
        if (!byCategory[q.source]) {
          byCategory[q.source] = [];
        }
        byCategory[q.source].push(q);
      });
      
      // Store each category separately
      Object.entries(byCategory).forEach(([category, categoryQuestions]) => {
        store.put({
          category,
          questions: categoryQuestions,
          timestamp: Date.now(),
          count: categoryQuestions.length,
        });
      });
      
      // Store cache version
      metaStore.put({ key: CACHE_VERSION_KEY, value: CACHE_VERSION });
      
      transaction.oncomplete = () => {
        console.log(`[BBQ Cache] Saved ${questions.length} questions to cache`);
        resolve(true);
      };
      
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('[BBQ Cache] Error saving to cache:', error);
    return false;
  }
}

/**
 * Clear the cached data
 */
export async function clearBBQCache() {
  try {
    const db = await openCacheDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CACHE_STORE_NAME, CACHE_META_STORE], 'readwrite');
      const store = transaction.objectStore(CACHE_STORE_NAME);
      const metaStore = transaction.objectStore(CACHE_META_STORE);
      
      store.clear();
      metaStore.delete(CACHE_VERSION_KEY);
      
      transaction.oncomplete = () => {
        console.log('[BBQ Cache] Cache cleared');
        resolve(true);
      };
      
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    console.error('[BBQ Cache] Error clearing cache:', error);
    return false;
  }
}

/**
 * Get cache status
 */
export async function getCacheStatus() {
  try {
    const cachedData = await getCachedData();
    if (!cachedData) {
      return { cached: false, count: 0, size: 0 };
    }
    
    // Estimate size in bytes
    const sizeStr = JSON.stringify(cachedData);
    const sizeBytes = new Blob([sizeStr]).size;
    
    // Count by category
    const categoryCounts = {};
    cachedData.forEach(q => {
      categoryCounts[q.source] = (categoryCounts[q.source] || 0) + 1;
    });
    
    return {
      cached: true,
      count: cachedData.length,
      size: sizeBytes,
      sizeMB: (sizeBytes / (1024 * 1024)).toFixed(2),
      categories: categoryCounts,
    };
  } catch (error) {
    console.error('[BBQ Cache] Error getting cache status:', error);
    return { cached: false, count: 0, size: 0 };
  }
}

function parseLine(line) {
  try {
    return JSON.parse(line.trim());
  } catch {
    return null;
  }
}

function categorizeQuestion(item, source) {
  const isAmbiguous = item.context_condition === 'ambig';
  const isDisambiguated = item.context_condition === 'disambig';
  
  if (!isAmbiguous && !isDisambiguated) return null;
  
  return {
    id: `${item.category.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.example_id}`,
    category: item.category,
    source: source,
    task: source, // use source as task consistently
    trait: item.question.toLowerCase().replace(/[^a-z]/g, '_').substring(0, 30),
    contextType: isAmbiguous ? 'ambiguous' : 'disambiguated',
    context: item.context,
    questionText: item.question,
    options: [
      `A: ${item.ans2}`,  // Unknown (as per BBQ paper: option A = Not known/Unknown)
      `B: ${item.ans0}`,  // First entity (e.g., "The Black woman", "Shanice Jackson")
      `C: ${item.ans1}`,  // Second entity (e.g., "The Black man", "Tanisha Dorsey")
    ],
    correctAnswer: LABEL_TO_LETTER[item.label],
    type: item.question_polarity === 'neg' ? 'negative' : 'non-negative',
    question_polarity: item.question_polarity,
    example_id: item.example_id,
  };
}

/**
 * Load BBQ data - first checks cache, only fetches from network if not cached
 * @param {Object} options - Loading options
 * @param {boolean} options.forceRefresh - Force refresh from network
 * @param {Function} options.onProgress - Progress callback for fetch
 */
export async function loadBBQData(options = {}) {
  const { forceRefresh = false, onProgress = null } = options;
  
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    console.log('[BBQ] Checking cache...');
    const cachedData = await getCachedData();
    
    if (cachedData && cachedData.length > 0) {
      console.log(`[BBQ] Loaded ${cachedData.length} questions from cache`);
      return cachedData;
    }
  }
  
  console.log('[BBQ] Loading local data files...');
  
  const allQuestions = [];
  const categories = Object.keys(BBQ_DATA_URLS);
  let completedCategories = 0;
  
  for (const [category, url] of Object.entries(BBQ_DATA_URLS)) {
    try {
      if (onProgress) {
        onProgress({
          current: completedCategories + 1,
          total: categories.length,
          category,
          status: 'fetching',
        });
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[BBQ] Failed to fetch ${category}: ${response.status}`);
        completedCategories++;
        continue;
      }
      
      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      let categoryCount = 0;
      for (const line of lines) {
        const item = parseLine(line);
        if (!item) continue;
        
        const question = categorizeQuestion(item, category);
        if (question) {
          allQuestions.push(question);
          categoryCount++;
        }
      }
      
      console.log(`[BBQ] Loaded ${categoryCount} questions from ${category}`);
      completedCategories++;
      
      if (onProgress) {
        onProgress({
          current: completedCategories,
          total: categories.length,
          category,
          status: 'complete',
          count: categoryCount,
        });
      }
      
    } catch (error) {
      console.error(`[BBQ] Error loading ${category}:`, error);
      completedCategories++;
    }
  }
  
  // Save to cache for future use
  if (allQuestions.length > 0) {
    console.log(`[BBQ] Saving ${allQuestions.length} questions to cache...`);
    const saved = await saveCachedData(allQuestions, categories);
    if (saved) {
      console.log(`[BBQ] Successfully cached ${allQuestions.length} questions`);
    } else {
      console.warn('[BBQ] Failed to save cache, will fetch again next time');
    }
  }
  
  return allQuestions;
}

export function getQuestionsByContextType(questions, contextType) {
  return questions.filter(q => q.contextType === contextType);
}

export function getQuestionsByTask(questions, task) {
  return questions.filter(q => q.task === task);
}

export function getCategories() {
  return Object.keys(BBQ_DATA_URLS);
}

export default { 
  loadBBQData, 
  getQuestionsByContextType, 
  getQuestionsByTask, 
  getCategories,
  getCacheStatus,
  clearBBQCache 
};