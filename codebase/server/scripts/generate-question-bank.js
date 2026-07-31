// Offline, one-off batch job: pre-builds a static bank of quiz questions per
// section (chương) so /api/generate-quiz can serve a random 2-3 question pick
// from disk instead of calling Gemini live every time a student opens or
// retries a quiz. Run manually whenever data/knowledge.js content changes:
//
//   node codebase/server/scripts/generate-question-bank.js
//
// Writes codebase/server/data/questionBank.json, keyed by day -> sectionId ->
// question[], so every stored question is already tagged to the correct
// chương and generate-quiz only ever has to slice into the right array.
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const { sections, decks, getSection, getSectionGroundingText } = require("../data/knowledge");
const { buildBankPrompt } = require("../prompts");
const { quizResponseSchema } = require("../quizSchema");

// gemini-flash-latest hits the free-tier's separate (very low) daily quota
// fast; gemini-flash-lite-latest is what /api/chat-ask already fell back to
// for the same reason (see server.js CHAT_MODEL) and has more free headroom.
const MODEL = "gemini-flash-lite-latest";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OUTPUT_PATH = path.join(__dirname, "..", "data", "questionBank.json");

// ~50 questions per day (per slide deck), spread across that day's chương in
// proportion to how many slides each chương has — a 13-slide chương gets a
// bigger pool than a 2-slide one — with a floor so even the smallest chương
// still has enough pool depth for a non-repetitive random 2-3 pick on retry.
const TOTAL_QUESTIONS_PER_DAY = 50;
const MIN_QUESTIONS_PER_SECTION = 6;

if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY — copy codebase/server/.env.example to .env and paste your key.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Free-tier quota hands back 429 RESOURCE_EXHAUSTED with a retryDelay hint
// even within a burst of ~10 sequential calls (not just once/day), so retry
// with the server's own suggested delay instead of giving up the whole run.
async function withRetry(fn, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const message = String(err && err.message || err);
            const isQuota = err && err.status === 429 || message.includes("RESOURCE_EXHAUSTED");
            if (!isQuota || attempt === retries) throw err;
            const match = /retryDelay":"(\d+)s/.exec(message);
            const waitMs = (match ? Number(match[1]) : 10 * attempt) * 1000 + 1000;
            console.log(`  quota hit, retry ${attempt}/${retries} sau ${Math.round(waitMs / 1000)}s...`);
            await sleep(waitMs);
        }
    }
}

function slideCountOf(day, section) {
    return section.slideEnd - section.slideStart + 1;
}

function planSectionCounts(day) {
    const list = sections[day];
    const totalSlides = list.reduce((sum, s) => sum + slideCountOf(day, s), 0);
    return list.map((s) => {
        const weight = slideCountOf(day, s) / totalSlides;
        const raw = Math.round(TOTAL_QUESTIONS_PER_DAY * weight);
        return { section: s, count: Math.max(MIN_QUESTIONS_PER_SECTION, raw) };
    });
}

async function generateSectionBank(day, section, questionCount) {
    const groundingText = getSectionGroundingText(day, section.id);
    const prompt = buildBankPrompt({
        day,
        sectionTitle: section.title,
        groundingText,
        questionCount,
        slideCount: slideCountOf(day, section)
    });

    const response = await withRetry(() => ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: quizResponseSchema,
            temperature: 0.6
        }
    }));

    const parsed = JSON.parse(response.text);
    return parsed.questions || [];
}

function saveBank(bank) {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), bank }, null, 2));
}

async function main() {
    // Resume-friendly: reuse whatever sections a previous (interrupted) run
    // already wrote, so a quota hit partway through doesn't waste already-
    // banked sections.
    let bank = {};
    try {
        bank = require(OUTPUT_PATH).bank || {};
    } catch (err) {
        bank = {};
    }

    for (const day of Object.keys(sections)) {
        bank[day] = bank[day] || {};
        const plan = planSectionCounts(day);
        for (const { section, count } of plan) {
            if (bank[day][section.id] && bank[day][section.id].length) {
                console.log(`Skip ${day}/${section.id} — đã có ${bank[day][section.id].length} câu.`);
                continue;
            }
            process.stdout.write(`Generating ${day}/${section.id} "${section.title}" (${count} câu)... `);
            const questions = await generateSectionBank(day, section, count);
            bank[day][section.id] = questions.map((q, idx) => ({
                id: `${section.id}-q${String(idx + 1).padStart(2, "0")}`,
                ...q
            }));
            console.log(`OK — nhận ${questions.length} câu`);
            saveBank(bank);
            await sleep(3000);
        }
    }

    saveBank(bank);
    console.log(`\nĐã ghi ngân hàng câu hỏi vào ${OUTPUT_PATH}`);
}

main().catch((err) => {
    console.error("generate-question-bank failed:", err);
    process.exitCode = 1;
});
