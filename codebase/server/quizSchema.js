const { Type } = require("@google/genai");

// Shared between server.js (live fallback generation) and
// scripts/generate-question-bank.js (offline bank generation) so both paths
// ask Gemini for exactly the same JSON shape.
const quizResponseSchema = {
    type: Type.OBJECT,
    properties: {
        questions: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    question: { type: Type.STRING },
                    citation: { type: Type.STRING },
                    sourcePages: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                    reviewSummary: { type: Type.STRING },
                    options: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                key: { type: Type.STRING },
                                text: { type: Type.STRING },
                                correct: { type: Type.BOOLEAN },
                                feedback: { type: Type.STRING }
                            },
                            required: ["key", "text", "correct", "feedback"]
                        }
                    }
                },
                required: ["question", "citation", "sourcePages", "reviewSummary", "options"]
            }
        }
    },
    required: ["questions"]
};

// Response shape for buildExplainAnswerPrompt (server.js /api/explain-answer
// and eval/run_eval.js) — kept identical between the live endpoint and the
// eval runner so a golden-set score change reflects a real prompt change,
// not a schema drift between the two call sites.
const explainAnswerResponseSchema = {
    type: Type.OBJECT,
    properties: {
        restatedUnderstanding: { type: Type.STRING },
        verdict: { type: Type.STRING },
        misconceptionName: { type: Type.STRING },
        citation: { type: Type.STRING },
        feedbackToStudent: { type: Type.STRING }
    },
    required: ["restatedUnderstanding", "verdict", "citation", "feedbackToStudent"]
};

module.exports = { quizResponseSchema, explainAnswerResponseSchema };
