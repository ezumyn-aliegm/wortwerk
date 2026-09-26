import { WORDS } from "./data.js";
import { createTutor } from "./tutor.js";

// Compatibility entry point for original single-wave saves and tests.
const tutor = createTutor(WORDS);
export const {
  teachingPages,
  questionTopic,
  missingTeaching,
  acknowledgeTeaching,
  STORAGE_KEY,
  PHASES,
  freshState,
  mastery,
  summary,
  dayTwoAt,
  delayedReviewAt,
  dueAt,
  phaseInfo,
  weakestSkills,
  buildQueue,
  startSession,
  describe,
  normalize,
  grade,
  setDraft,
  setCorrection,
  setTeachingStep,
  startCorrection,
  correctionNeeded,
  correctionReady,
  useHint,
  visitWordbank,
  answerQuestion,
  advance,
  validateState,
} = tutor;
