// Local data files - loaded from public/data/ directory
// This saves data consumption by avoiding external network requests
import {
  METADATA_URL,
  indexMetadata,
  metadataKey,
  resolveOptionRoles,
} from './bbqMetadata.js';

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
// v3: option roles (bias target / non-target / unknown) now come from the dataset
// metadata (target_loc) instead of the hardcoded A/B/C assumptions of v2.
const CACHE_VERSION = 3;

/**
 * Display order of the raw answer options.
 *      A = ans2,  B = ans0,  C = ans1
 * which is the order the original loader used. What changed in v3 is that the app no
 * longer *assumes* which of those slots holds the bias target / the unknown answer —
 * `resolveOptionRoles()` derives that per example from the dataset metadata.
 */
export const OPTION_ORDER = [2, 0, 1];

const metadataState = {
  index: null,
  status: 'idle', // idle | loading | ready | unavailable
  error: null,
  promise: null, // in-flight load, shared by concurrent callers
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
async function saveCachedData(questions) {
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

/**
 * Load the official `additional_metadata.csv` once per page load.
 * It carries `target_loc` (which raw answer option reflects the stereotype) plus
 * `label_type`, the stereotyped groups and the bias-alignment flag.
 */
export async function loadBBQMetadata() {
  if (metadataState.status === 'ready') return metadataState.index;
  if (metadataState.status === 'loading') {
    // Share the in-flight promise instead of polling on a timer. The old 20 ms
    // sleep-loop burned time and, worse, could spin forever if the loader threw
    // before resetting `status`.
    return metadataState.promise;
  }

  metadataState.status = 'loading';
  metadataState.promise = (async () => {
    try {
      const response = await fetch(METADATA_URL);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      metadataState.index = indexMetadata(text);
      metadataState.status = 'ready';
      console.log(`[BBQ] Loaded ${metadataState.index.count} metadata rows`);
    } catch (error) {
      metadataState.status = 'unavailable';
      metadataState.error = error.message;
      console.warn('[BBQ] Metadata unavailable, falling back to stereotyped_groups:', error.message);
      metadataState.index = null;
    }
    return metadataState.index;
  })();

  return metadataState.promise;
}

export const getMetadataStatus = () => ({
  status: metadataState.status,
  error: metadataState.error,
  rows: metadataState.index?.count || 0,
});

/**
 * Convert one raw JSONL example into the app's question shape.
 *
 * The `targetOption` / `nonTargetOption` / `unknownOption` / `correctOption` fields
 * are per-example now — see `bbqMetadata.js` for why the old hardcoded letters were
 * wrong for ~67 % (unknown) and ~91 % (bias target) of the dataset.
 */
export function categorizeQuestion(item, source, metadataIndex = metadataState.index) {
  const isAmbiguous = item.context_condition === 'ambig';
  const isDisambiguated = item.context_condition === 'disambig';

  if (!isAmbiguous && !isDisambiguated) return null;

  const metaRecord = metadataIndex?.byKey?.get(
    metadataKey(item.category, item.question_index, item.example_id),
  );

  const roles = resolveOptionRoles(item, metaRecord, OPTION_ORDER);

  // Keep the dataset's own option order but display it as A/B/C.
  const rawKeys = ['ans0', 'ans1', 'ans2'];
  const options = OPTION_ORDER.map((rawIndex, position) =>
    `${['A', 'B', 'C'][position]}: ${item.answer_info[rawKeys[rawIndex]]?.[0] ?? ''}`,
  );

  return {
    id: `${item.category.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.example_id}`,
    category: item.category,
    source: source,
    task: source, // use source as task consistently
    trait: item.question?.toLowerCase().replace(/[^a-z]/g, '_').substring(0, 30),
    contextType: isAmbiguous ? 'ambiguous' : 'disambiguated',
    context: item.context,
    questionText: item.question,
    options,
    correctAnswer: roles.correctOption,
    // Per-example option roles, resolved from the dataset metadata.
    stereotypedOption: roles.targetOption,
    nonStereotypedOption: roles.nonTargetOption,
    unknownOption: roles.unknownOption,
    targetLocation: roles.targetLocation,
    targetSource: roles.targetSource,
    roleSource: metaRecord ? 'metadata' : roles.targetSource,
    labelType: roles.labelType,
    type: item.question_polarity === 'neg' ? 'negative' : 'non-negative',
    question_polarity: item.question_polarity,
    example_id: item.example_id,
    question_index: item.question_index,
    stereotypedGroups: item.additional_metadata?.stereotyped_groups || [],
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

  // The option-role metadata is what makes the bias score meaningful, so make sure
  // it is loaded before any question is normalised.
  const metadataIndex = await loadBBQMetadata();
  if (!metadataIndex) {
    console.warn(
      '[BBQ] Scoring without additional_metadata.csv — target/unknown options fall back to ' +
        'stereotyped_groups heuristics and bias scores will be approximate.',
    );
  }

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

  // Fetch all category files in parallel. They are independent ~1-13 MB static assets,
  // and the previous sequential await left the browser idle on each round-trip in turn;
  // on a cold cache that turned a few seconds of transfer into minutes. Parse and
  // categorise in the same per-category task so results still append in a stable order
  // once every file has been read.
  const results = await Promise.all(categories.map(async (category) => {
    const url = BBQ_DATA_URLS[category];
    try {
      if (onProgress) {
        onProgress({ current: 0, total: categories.length, category, status: 'fetching' });
      }

      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[BBQ] Failed to fetch ${category}: ${response.status}`);
        completedCategories++;
        return [];
      }

      const text = await response.text();
      const lines = text.split('\n').filter(line => line.trim());

      const categoryQuestions = [];
      for (const line of lines) {
        const item = parseLine(line);
        if (!item) continue;

        const question = categorizeQuestion(item, category, metadataIndex);
        if (question) categoryQuestions.push(question);
      }

      console.log(`[BBQ] Loaded ${categoryQuestions.length} questions from ${category}`);
      completedCategories++;

      if (onProgress) {
        onProgress({
          current: completedCategories,
          total: categories.length,
          category,
          status: 'complete',
          count: categoryQuestions.length,
        });
      }

      return categoryQuestions;
    } catch (error) {
      console.error(`[BBQ] Error loading ${category}:`, error);
      completedCategories++;
      return [];
    }
  }));

  // Keep a deterministic order (Promise.all preserves input order) so the question
  // plan and resume index stay stable across reloads. Append in a loop rather than
  // spreading, which would pass tens of thousands of arguments at once.
  results.forEach((categoryQuestions) => {
    for (let i = 0; i < categoryQuestions.length; i++) allQuestions.push(categoryQuestions[i]);
  });
  
  // Save to cache for future use
  if (allQuestions.length > 0) {
    console.log(`[BBQ] Saving ${allQuestions.length} questions to cache...`);
    const saved = await saveCachedData(allQuestions);
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
  loadBBQMetadata,
  getMetadataStatus,
  categorizeQuestion,
  OPTION_ORDER,
  getQuestionsByContextType,
  getQuestionsByTask,
  getCategories,
  getCacheStatus,
  clearBBQCache,
};