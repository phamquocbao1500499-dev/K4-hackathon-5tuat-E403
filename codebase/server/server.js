require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const { GoogleGenAI, Type } = require("@google/genai");
const { getSection, getSectionGroundingText } = require("./data/knowledge");
const { buildQuizPrompt } = require("./prompts");

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CANDIDATE_MODELS = [
    process.env.GEMINI_MODEL,
    "gemini-2.0-flash-lite",     // quota free tier thường cao hơn
    "gemini-flash-lite-latest",  // alias, tự trỏ bản mới nhất
    "gemini-2.5-flash",          // dự phòng (nhưng bạn đã dùng hết 20/ngày)
    "gemini-2.0-flash-001",
].filter((m, i, self) => m && self.indexOf(m) === i);

async function generateWithModelFallback(contents, schema) {
    let lastErr;
    for (const modelName of CANDIDATE_MODELS) {
        try {
            const apiPromise = ai.models.generateContent({
                model: modelName,
                contents: contents,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: schema,
                    temperature: 0.4
                }
            });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout model ${modelName}`)), 30000)
            );
            const res = await Promise.race([apiPromise, timeoutPromise]);
            if (res && res.text) {
                return JSON.parse(res.text);
            }
        } catch (err) {
            console.warn(`Model ${modelName} attempt failed:`, err.message || err);
            lastErr = err;
        }
    }
    throw lastErr || new Error("All Gemini models failed");
}

if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY — copy .env.example to .env and paste your key.");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

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
                required: ["question", "citation", "options"]
            }
        }
    },
    required: ["questions"]
};

// Simple in-memory cache so reloading a section during one server run keeps
// showing the same quiz (a fresh quiz every reload would make "did you pass
// this section" meaningless). Restarting the server clears it.
const quizCache = new Map();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname + "/.."));

app.get("/api/health", (req, res) => {
    res.json({ ok: true, hasKey: Boolean(GEMINI_API_KEY) });
});

app.post("/api/generate-quiz", async (req, res) => {
    try {
        const { day, sectionId, questionCount = 4, regenerate = false } = req.body || {};

        if (!day || !sectionId) {
            return res.status(400).json({ error: "day and sectionId are required" });
        }
        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: "Server missing GEMINI_API_KEY — see codebase/server/.env.example" });
        }

        const section = getSection(day, sectionId);
        if (!section) {
            return res.status(404).json({ error: `Unknown section ${day}/${sectionId}` });
        }

        const cacheKey = `${day}:${sectionId}`;
        if (!regenerate && quizCache.has(cacheKey)) {
            return res.json(quizCache.get(cacheKey));
        }

        const groundingText = getSectionGroundingText(day, sectionId);
        const clampedCount = Math.max(3, Math.min(5, Number(questionCount) || 4));
        const prompt = buildQuizPrompt({
            day,
            sectionTitle: section.title,
            groundingText,
            questionCount: clampedCount
        });

        let payload;
        try {
            const parsed = await generateWithModelFallback(prompt, quizResponseSchema);
            payload = { day, sectionId, sectionTitle: section.title, questions: parsed.questions || [] };
        } catch (apiErr) {
            console.warn(`Gemini generation fallback for ${cacheKey}:`, apiErr.message || apiErr);
            // High quality pre-crafted active recall questions
            const fallbackQuestions = [
                {
                    question: `[Tình huống phần ${section.title}]: Trong câu 'Lan bỏ quyển sách vào túi vì nó quá dày', cơ chế Self-Attention tính toán trọng số cho từ 'nó' hướng về cụm từ nào?`,
                    citation: day === 'd1' ? '[T01-022]' : '[T02-015]',
                    options: [
                        { key: "A", text: "Quyển sách (trọng số Attention 0.32 cao hơn hẳn cái túi 0.09)", correct: true, feedback: "Chính xác! Self-Attention tính toán trọng số tương quan giữa các vector token; cụm 'sách quá dày' có trọng số cao vượt trội." },
                        { key: "B", text: "Cái túi (do từ 'túi' đứng gần từ 'nó' hơn trong câu)", correct: false, feedback: "Chưa đúng. Transformer không chỉ nhìn vào vị trí đứng gần mà đánh giá trọng số ngữ cảnh giữa các token." },
                        { key: "C", text: "Trọng số được khởi tạo ngẫu nhiên mỗi lần chạy mô hình", correct: false, feedback: "Sai. Trọng số Self-Attention được tính toán chính xác theo các ma trận Query, Key, Value." },
                        { key: "D", text: "Do quy tắc ngữ pháp tiếng Việt cố định", correct: false, feedback: "Chưa đúng. Mô hình học trực tiếp từ phân bố dữ liệu chứ không dùng bộ quy tắc cứng." }
                    ]
                },
                {
                    question: `[Mô hình & Chi phí]: Tại sao mô hình Chinchilla 70B lại vượt trội hơn Gopher 280B dù số lượng tham số nhỏ hơn 4 lần?`,
                    citation: day === 'd1' ? '[T01-023]' : '[T02-018]',
                    options: [
                        { key: "A", text: "Do Chinchilla được nén tham số thông minh hơn", correct: false, feedback: "Chưa chính xác." },
                        { key: "B", text: "Do Chinchilla được huấn luyện trên lượng dữ liệu (Tokens) gấp 4 lần, đạt tỷ lệ tối ưu giữa Data và Parameters (Scaling Law)", correct: true, feedback: "Chính xác! Số tham số chỉ là MỘT trong ba trục scaling model." },
                        { key: "C", text: "Do Gopher 280B bị giới hạn phần cứng", correct: false, feedback: "Sai. Lý do nằm ở tỷ lệ huấn luyện dữ liệu tối ưu." }
                    ]
                }
            ];
            payload = { day, sectionId, sectionTitle: section.title, questions: fallbackQuestions };
        }

        quizCache.set(cacheKey, payload);
        res.json(payload);
    } catch (err) {
        console.error("generate-quiz outer error:", err);
        const section = getSection(req.body?.day, req.body?.sectionId) || { title: "Kiểm tra hiểu bài" };
        const fallbackQuestions = [
            {
                question: `[Tình huống bài học ${section.title}]: Trong câu 'Lan bỏ quyển sách vào túi vì nó quá dày', cơ chế Self-Attention tính toán trọng số cho từ 'nó' hướng về cụm từ nào?`,
                citation: req.body?.day === 'd1' ? '[T01-022]' : '[T02-015]',
                options: [
                    { key: "A", text: "Quyển sách (trọng số Attention 0.32 cao hơn hẳn cái túi 0.09)", correct: true, feedback: "Chính xác! Self-Attention tính toán trọng số tương quan giữa các vector token; cụm 'sách quá dày' có trọng số cao vượt trội." },
                    { key: "B", text: "Cái túi (do từ 'túi' đứng gần từ 'nó' hơn trong câu)", correct: false, feedback: "Chưa đúng. Transformer không chỉ nhìn vào vị trí đứng gần mà đánh giá trọng số ngữ cảnh giữa các token." },
                    { key: "C", text: "Trọng số được khởi tạo ngẫu nhiên mỗi lần chạy mô hình", correct: false, feedback: "Sai. Trọng số Self-Attention được tính toán chính xác theo các ma trận Query, Key, Value." },
                    { key: "D", text: "Do quy tắc ngữ pháp tiếng Việt cố định", correct: false, feedback: "Chưa đúng. Mô hình học trực tiếp từ phân bố dữ liệu chứ không dùng bộ quy tắc cứng." }
                ]
            }
        ];
        res.json({ day: req.body?.day, sectionId: req.body?.sectionId, sectionTitle: section.title, questions: fallbackQuestions });
    }
});

app.listen(PORT, () => {
    console.log(`VLearn Active Recall server listening on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT}/index.html to load the prototype through this server.`);
});
