/**
 * Evaluation plan: which questions a run will ask, in which order — deterministically.
 *
 * Why this is separate from the component: the original code picked questions with
 * `[...questions].sort(() => Math.random() - 0.5)`, which is seeded from the clock. That
 * made "Stop" + "Resume" unsound — the resumed run walked a *different* ordering of the
 * same pool, so it could skip questions it had not asked yet and re-ask ones it had. It
 * also meant a run could not be reproduced or reasoned about after the fact.
 *
 * A plan is a plain JSON object (so it survives localStorage):
 *
 *   {
 *     signature: string,          // identifies the selection this plan was built for
 *     seed: number,               // base seed for the run
 *     ids: { [source]: string[] } // the ordered, chosen question ids per category
 *   }
 */

/** Small, fast, well-distributed 32-bit PRNG. Deterministic across browsers. */
export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** FNV-1a. Used to give each category its own stream from the run's base seed. */
export const hashString = (value) => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** Per-category seed: one category's shuffle cannot shift another's. */
export const seedForSource = (seed, source) =>
  (Math.imul(seed >>> 0, 2654435761) ^ hashString(String(source))) >>> 0;

/** Deterministic Fisher-Yates. Same input + same seed => same output, always. */
export const shuffleWithSeed = (items, seed) => {
  const random = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Identify the selection a plan belongs to. If the user changes the categories or the
 * per-category limit, the old plan is no longer valid and must not be reused.
 */
export const planSignature = ({ sources, questionLimit, total }) =>
  JSON.stringify({ sources: [...sources].sort(), questionLimit, total });

/**
 * Build a new plan for a selection.
 *
 * `questionsBySource` maps a category to its question objects; only the ids are stored.
 */
export const createPlan = ({ questionsBySource, questionLimit, total, seed }) => {
  const sources = Object.keys(questionsBySource);
  const plan = {
    signature: planSignature({ sources, questionLimit, total }),
    seed: seed ?? Math.floor(Math.random() * 2 ** 31),
    ids: {},
  };

  sources.forEach((source) => {
    plan.ids[source] = selectIds(questionsBySource[source], questionLimit, seedForSource(plan.seed, source));
  });

  return plan;
};

/**
 * The ordered ids for one category.
 *
 * With a limit of N we still shuffle the whole pool rather than slicing first: the
 * selection is a random sample, and *which* N were chosen must stay stable across a
 * resume, not just their order.
 */
export const selectIds = (questions, questionLimit, seed) => {
  const ids = questions.map((q) => q.id);
  const shuffled = shuffleWithSeed(ids, seed);
  return questionLimit > 0 ? shuffled.slice(0, questionLimit) : shuffled;
};

/**
 * Resolve a plan back into the ordered question list for a run.
 *
 * Ids missing from the pool (data changed under us) are skipped rather than crashing, and
 * the count of skipped entries is reported so the caller can log it.
 */
export const resolvePlanQuestions = ({ plan, questionsBySource, questionLimit }) => {
  const questions = [];
  let missing = 0;

  Object.keys(plan.ids || {}).forEach((source) => {
    const pool = questionsBySource[source];
    if (!pool) {
      missing += plan.ids[source].length;
      return;
    }

    const byId = new Map(pool.map((q) => [q.id, q]));
    const ids = plan.ids[source].slice(0, questionLimit > 0 ? questionLimit : undefined);

    ids.forEach((id) => {
      const question = byId.get(id);
      if (question) questions.push(question);
      else missing += 1;
    });
  });

  return { questions, missing };
};

/**
 * Where a resume should start.
 *
 * A question counts as done per model when a result is stored for it, so the earliest
 * unfinished question is the minimum across models — this is what makes an interrupted
 * question get re-run instead of being assumed complete. Taking the minimum of that and
 * the remembered index means resuming can close gaps but never re-ask finished questions
 * unnecessarily.
 */
export const resolveResumeIndex = ({ requestedIndex, completedByModel, total }) => {
  const counts = Array.isArray(completedByModel) ? completedByModel : [];
  const firstIncomplete = counts.length > 0 ? Math.min(...counts) : 0;
  const clamped = Math.max(0, Math.min(requestedIndex ?? firstIncomplete, firstIncomplete));
  return Math.max(0, Math.min(clamped, total ?? Number.MAX_SAFE_INTEGER));
};

export default {
  mulberry32,
  hashString,
  seedForSource,
  shuffleWithSeed,
  planSignature,
  createPlan,
  selectIds,
  resolvePlanQuestions,
  resolveResumeIndex,
};
