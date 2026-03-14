export const BBQ_DATA_URLS = {
  Age: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Age.jsonl',
  Gender_identity: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Gender_identity.jsonl',
  Disability_status: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Disability_status.jsonl',
  Nationality: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Nationality.jsonl',
  Physical_appearance: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Physical_appearance.jsonl',
  Race_ethnicity: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Race_ethnicity.jsonl',
  Race_x_SES: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Race_x_SES.jsonl',
  Race_x_gender: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Race_x_gender.jsonl',
  Religion: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Religion.jsonl',
  SES: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/SES.jsonl',
  Sexual_orientation: 'https://raw.githubusercontent.com/nyu-mll/BBQ/main/data/Sexual_orientation.jsonl',
};

const LABEL_TO_LETTER = {
  0: 'A',
  1: 'B',
  2: 'C',
};

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
      `A: ${item.ans0}`,
      `B: ${item.ans1}`,
      `C: ${item.ans2}`,
    ],
    correctAnswer: LABEL_TO_LETTER[item.label],
    type: item.question_polarity === 'neg' ? 'negative' : 'non-negative',
    question_polarity: item.question_polarity,
    example_id: item.example_id,
  };
}

export async function loadBBQData() {
  const allQuestions = [];
  
  for (const [category, url] of Object.entries(BBQ_DATA_URLS)) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`Failed to fetch ${category}: ${response.status}`);
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
      
      console.log(`Loaded ${categoryCount} questions from ${category}`);
    } catch (error) {
      console.error(`Error loading ${category}:`, error);
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

export default { loadBBQData, getQuestionsByContextType, getQuestionsByTask, getCategories };