// Re-runs eval/golden_set.json (20 cases) against the IMPROVED explain-answer
// prompt (codebase/server/prompts.js buildExplainAnswerPrompt) with a live
// Gemini call, to check whether the 3 fixes made after eval/results_run1.md's
// 70% run actually raise the score:
//   Nhóm A (TC02): diễn giải lại ý học viên TRƯỚC khi kết luận verdict.
//   Nhóm B (TC04/05/07): bắt buộc đúng 1 mã trích dẫn, ưu tiên đoạn ĐẦU TIÊN.
//   Nhóm C (TC15/20): quy tắc trích dẫn rõ ràng riêng cho từng verdict.
//
// Same grounding methodology as run1 (see eval/results_run1.md "Cách grounding"):
// reuses the EXACT transcript window already recorded per-case in
// eval/trace_log_run1.json (rather than re-deriving it), so a score delta
// reflects the prompt change only, not a different retrieval window.
//
// Uses gemini-flash-lite-latest (CHAT_MODEL), not gemini-flash-latest: the
// latter's free-tier daily quota (20 req/day) was already spent 1:1 by run1
// today and returns 429 RESOURCE_EXHAUSTED on any further call — see the
// same reasoning already documented in
// codebase/server/scripts/generate-question-bank.js.
//
// Usage: node eval/run_eval.js

const fs = require("fs");
const path = require("path");
const serverNodeModules = path.join(__dirname, "..", "codebase", "server", "node_modules");

require(path.join(serverNodeModules, "dotenv")).config({ path: path.join(__dirname, "..", "codebase", "server", ".env") });

const { GoogleGenAI } = require(path.join(serverNodeModules, "@google", "genai"));
const { buildExplainAnswerPrompt } = require("../codebase/server/prompts");
const { explainAnswerResponseSchema } = require("../codebase/server/quizSchema");

const MODEL = "gemini-flash-lite-latest";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY — copy codebase/server/.env.example to codebase/server/.env and paste your key.");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const goldenSet = JSON.parse(fs.readFileSync(path.join(__dirname, "golden_set.json"), "utf8"));
const run1Trace = JSON.parse(fs.readFileSync(path.join(__dirname, "trace_log_run1.json"), "utf8"));
const run1ById = new Map(run1Trace.map((t) => [t.id, t]));

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same quota-aware retry as generate-question-bank.js — the lite model still
// has per-minute rate limits even though its per-day quota is much higher.
async function withRetry(fn, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            const message = String((err && err.message) || err);
            const isQuota = (err && err.status === 429) || message.includes("RESOURCE_EXHAUSTED");
            if (!isQuota || attempt === retries) throw err;
            const match = /retryDelay":"(\d+)s/.exec(message);
            const waitMs = (match ? Number(match[1]) : 10 * attempt) * 1000 + 1000;
            console.log(`  quota hit, retry ${attempt}/${retries} sau ${Math.round(waitMs / 1000)}s...`);
            await sleep(waitMs);
        }
    }
}

// Pulls the exact "TRANSCRIPT LIÊN QUAN ĐƯỢC CẤP" window run1 used for this
// case out of its recorded prompt, so both runs are grounded identically.
function groundingTextFromRun1(id) {
    const trace = run1ById.get(id);
    if (!trace) return null;
    const m = /TRANSCRIPT LIÊN QUAN ĐƯỢC CẤP:\n"""\n([\s\S]*?)\n"""\n\nTrả về/.exec(trace.prompt);
    if (!m) return null;
    const text = m[1];
    // run1 used a Vietnamese placeholder sentence for the intentionally-empty
    // grounding cases (① no source / some ③ cases) — treat that the same way
    // buildExplainAnswerPrompt expects: empty PHẦN KIẾN THỨC.
    return text.startsWith("(không có đoạn transcript") ? "" : text;
}

function normalizeCitation(c) {
    return String(c || "").trim();
}

async function runCase(tc) {
    const groundingText = groundingTextFromRun1(tc.id);
    const prompt = buildExplainAnswerPrompt({
        day: tc.lecture || "AI Thực Chiến",
        sectionTitle: null,
        groundingText: groundingText || "(không có đoạn kiến thức nào được cấp — bước tìm kiếm không thấy nội dung liên quan)",
        question: tc.question,
        studentAnswerText: tc.student_answer
    });

    const response = await withRetry(() => ai.models.generateContent({
        model: MODEL,
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: explainAnswerResponseSchema,
            temperature: 0.3
        }
    }));

    let parsed;
    try {
        parsed = JSON.parse(response.text);
    } catch (err) {
        parsed = { verdict: "PARSE_ERROR", citation: "PARSE_ERROR", feedbackToStudent: response.text };
    }

    const verdictMatch = parsed.verdict === tc.expected_verdict;
    const gotCitation = normalizeCitation(parsed.citation);
    const expectedCitation = normalizeCitation(tc.expected_citation);
    const citationMatch = gotCitation === expectedCitation;
    const pass = verdictMatch && citationMatch;

    return {
        id: tc.id,
        category: tc.category,
        expected_verdict: tc.expected_verdict,
        got_verdict: parsed.verdict,
        verdict_match: verdictMatch,
        expected_citation: tc.expected_citation,
        got_citation: parsed.citation,
        citation_match: citationMatch,
        pass,
        restatedUnderstanding: parsed.restatedUnderstanding,
        misconceptionName: parsed.misconceptionName,
        feedbackToStudent: parsed.feedbackToStudent,
        trace: {
            id: tc.id,
            prompt,
            model_response_text: response.text,
            usage: response.usageMetadata,
            modelVersion: response.modelVersion
        }
    };
}

async function main() {
    const results = [];
    for (const tc of goldenSet.cases) {
        process.stdout.write(`Running ${tc.id}... `);
        try {
            const r = await runCase(tc);
            console.log(`${r.pass ? "PASS" : "FAIL"} (verdict ${r.got_verdict}, citation ${r.got_citation})`);
            results.push(r);
        } catch (err) {
            console.log(`ERROR: ${err.message || err}`);
            results.push({ id: tc.id, category: tc.category, error: String(err.message || err), pass: false });
        }
        // Small gap between calls to stay clear of the lite model's per-minute burst limit.
        await sleep(2000);
    }

    fs.writeFileSync(
        path.join(__dirname, "trace_log_run2.json"),
        JSON.stringify(results.map((r) => r.trace).filter(Boolean), null, 2)
    );

    const passCount = results.filter((r) => r.pass).length;
    const pct = ((passCount / results.length) * 100).toFixed(1);

    const rows = results.map((r) => r.error
        ? `| ${r.id} | ${r.category} | ERROR | - | - | - | - | - | ❌ |`
        : `| ${r.id} | ${r.category} | ${r.expected_verdict} | ${r.got_verdict} | ${r.verdict_match ? "✅" : "❌"} | ${r.expected_citation} | ${r.got_citation} | ${r.citation_match ? "✅" : "❌"} | ${r.pass ? "✅" : "❌"} |`
    ).join("\n");

    const md = `# Kết quả chạy Golden Set — Lượt 2 (prompt cải tiến, sau lượt 1)

- **Ngày chạy:** ${new Date().toISOString().slice(0, 10)}
- **Model:** \`gemini-flash-lite-latest\` (gọi qua \`ai.models.generateContent\` bằng \`GEMINI_API_KEY\` — đổi từ
  \`gemini-flash-latest\` dùng ở lượt 1 vì quota free-tier 20 req/ngày của model đó đã bị chính 20 case
  golden set của lượt 1 dùng hết trong ngày, xem codebase/server/scripts/generate-question-bank.js cho lý do
  tương tự đã áp dụng ở chỗ khác trong repo).
- **Prompt dùng:** \`buildExplainAnswerPrompt\` (codebase/server/prompts.js) — bản thay thế Prompt B sau khi
  phân tích 6 case fail ở lượt 1 (eval/results_run1.md), với 3 thay đổi: (1) bắt buộc diễn giải lại ý học
  viên trước khi kết luận verdict, (2) bắt buộc đúng 1 mã trích dẫn duy nhất — ưu tiên đoạn ĐẦU TIÊN nêu ý
  đó, (3) quy tắc trích dẫn tách riêng theo từng verdict (ambiguous luôn NONE_OUT_OF_SCOPE; out_of_scope/
  ungrounded chỉ trích khi có đúng 1 đoạn liên quan trực tiếp).
- **Cách grounding:** tái sử dụng NGUYÊN VĂN cửa sổ transcript đã cấp cho từng case ở lượt 1
  (\`eval/trace_log_run1.json\`), để chênh lệch điểm số chỉ phản ánh thay đổi prompt, không phải do đổi
  cách retrieval.
- **Trace log đầy đủ:** \`eval/trace_log_run2.json\`
- **Quality bar đối chiếu (spec.md §7):** ≥ 85%.
- **So với lượt 1:** 14/20 = 70.0%.

## Kết quả tổng

| Chỉ số | Giá trị |
|---|---|
| Tổng số case | ${results.length} |
| Đạt (verdict đúng **và** citation khớp chính xác) | **${passCount} / ${results.length} = ${pct}%** |
| Đối chiếu Quality Bar (≥85%) | **${Number(pct) >= 85 ? "ĐẠT" : "CHƯA ĐẠT"}** |
| So với lượt 1 (70.0%) | **${passCount - 14 >= 0 ? "+" : ""}${(Number(pct) - 70).toFixed(1)} điểm %** |

## Bảng chi tiết từng case

| ID | Lớp | Expected verdict | Got verdict | Verdict khớp? | Expected citation | Got citation | Citation khớp? | Pass |
|---|---|---|---|---|---|---|---|---|
${rows}
`;

    fs.writeFileSync(path.join(__dirname, "results_run2.md"), md);
    console.log(`\n${passCount}/${results.length} = ${pct}% — viết eval/results_run2.md và eval/trace_log_run2.json`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
