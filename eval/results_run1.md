# Kết quả chạy Golden Set — Lượt 1 (lời gọi AI thật)

- **Ngày chạy:** 31/07/2026
- **Model:** `gemini-3.1-flash-lite` (gọi trực tiếp Gemini REST API bằng `GEMINI_API_KEY` đã cấu hình sẵn ở `codebase/server/.env` — model này cũng chính là model chatlog thật đang dùng nhiều nhất, xem `data/vlearn-pack/chatlog/DATA_DICTIONARY.md`)
- **Prompt dùng:** Prompt B trong `eval/prompts.md` (chấm câu trả lời tự luận + phát hiện misconception + trích dẫn), áp dụng nguyên văn cho cả 20 case — không chỉnh sửa gì giữa các case.
- **Cách grounding:** với mỗi case, cấp đúng đoạn transcript thật quanh `expected_citation` (cửa sổ 0-1 đoạn lân cận) làm "kết quả retrieval giả lập"; với case ①/③ không có nội dung liên quan, cố ý KHÔNG cấp transcript nào để mô phỏng đúng tình huống retrieval không tìm thấy gì.
- **Trace log đầy đủ (prompt + response thật cho từng case):** `eval/trace_log_run1.json`
- **Quality bar đối chiếu (spec.md §7):** ≥ 85% và không bịa trích dẫn sai.

## Kết quả tổng

| Chỉ số | Giá trị |
|---|---|
| Tổng số case | 20 |
| Đạt (verdict đúng **và** citation khớp chính xác) | **14 / 20 = 70.0%** |
| Đối chiếu Quality Bar (≥85%) | **CHƯA ĐẠT** |
| Số case bịa trích dẫn không tồn tại | **0** (không có case nào model tự bịa mã đoạn ngoài transcript được cấp) |

## Bảng chi tiết từng case

| ID | Lớp | Expected verdict | Got verdict | Verdict khớp? | Expected citation | Got citation | Citation khớp? | Pass |
|---|---|---|---|---|---|---|---|---|
| TC01 | ④ | misconception | misconception | ✅ | [T04-056] | [T04-056] | ✅ | ✅ |
| TC02 | ④ | misconception | **correct** | ❌ | [T04-040] | [T04-040] | ✅ | ❌ |
| TC03 | ④ | misconception | misconception | ✅ | [T04-086] | [T04-086] | ✅ | ✅ |
| TC04 | ④ | misconception | misconception | ✅ | [T04-059] | [T04-060] | ❌ (lệch 1 đoạn liền kề) | ❌ |
| TC05 | ④ | misconception | misconception | ✅ | [T02-034] | [T02-033], [T02-034] | ❌ (thừa 1 mã, có chứa mã đúng) | ❌ |
| TC06 | ④ | misconception | misconception | ✅ | [T02-036] | [T02-036] | ✅ | ✅ |
| TC07 | ④ (correct-check) | correct | correct | ✅ | [T02-034] | [T02-033], [T02-034] | ❌ (thừa 1 mã, có chứa mã đúng) | ❌ |
| TC08 | ④ (correct-check) | correct | correct | ✅ | [T04-056] | [T04-056] | ✅ | ✅ |
| TC09 | ① | ungrounded_question | ungrounded_question | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC10 | ① | ungrounded_question | ungrounded_question | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC11 | ① | ungrounded_question | ungrounded_question | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC12 | ① | ungrounded_question | ungrounded_question | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC13 | ② | ambiguous | ambiguous | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC14 | ② | ambiguous | ambiguous | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC15 | ② | ambiguous | ambiguous | ✅ | NONE_OUT_OF_SCOPE | [T04-056] | ❌ (model vẫn kèm citation dù verdict=ambiguous) | ❌ |
| TC16 | ③ | out_of_scope | out_of_scope | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC17 | ③ | out_of_scope | out_of_scope | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC18 | ③ | out_of_scope | out_of_scope | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC19 | ③ | out_of_scope | out_of_scope | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC20 | ③ | out_of_scope | out_of_scope | ✅ | [T03-095] | NONE_OUT_OF_SCOPE | ❌ (model không kèm citation cho case out_of_scope) | ❌ |

## Phân tích nguyên nhân 6 case chưa đạt

Chia theo mức độ nghiêm trọng — **không chỉnh sửa cách chấm sau khi thấy kết quả**, chỉ phân loại nguyên nhân để biết nên sửa gì trước (prompt/model) và sửa gì ở golden set (thiết kế case/tiêu chí so khớp):

**Nhóm A — Model thật sự bỏ sót misconception (1 case, nghiêm trọng nhất):**
- **TC02**: học viên khẳng định sai (Transformer xử lý 4 câu như 4 luồng độc lập song song), nhưng model chấm là "correct". Đây là lỗi thật của model/prompt — misconception khá tinh vi (nhầm giữa "xử lý song song các từ trong 1 chuỗi" với "chạy song song nhiều câu độc lập") và model bị đánh lừa bởi việc cả hai đều dùng đúng từ "song song". → Cần tinh chỉnh Prompt B: yêu cầu model diễn giải lại đúng ý học viên bằng lời trước khi kết luận đúng/sai, để lộ ra chỗ lệch nghĩa.

**Nhóm B — Verdict đúng, citation lệch nhẹ do model gộp/lân cận đoạn (3 case, lỗi nhẹ):**
- **TC04**: model trích [T04-060] thay vì [T04-059] — cả hai đoạn liền kề nhau, cùng nói về việc RLHF vẫn cần con người. Model bắt đúng khái niệm nhưng chỉ tay vào câu kế bên thay vì câu đầu tiên nêu ý đó.
- **TC05, TC07**: model trả về **hai** mã trích dẫn `[T02-033], [T02-034]` thay vì chỉ `[T02-034]` — về nội dung vẫn đúng và có chứa đúng mã kỳ vọng, nhưng vi phạm định dạng "1 citation" mà Prompt B yêu cầu. Với tiêu chí so khớp CHẶT (exact-match) đang dùng, cả 2 case này bị tính fail; nếu tính "khớp một phần" (mã đúng nằm trong tập trả về) thì cả 2 sẽ pass, nâng tổng lên **16/20 = 80%** — vẫn chưa đạt 85% nhưng gần hơn. Mình giữ nguyên cách chấm chặt vì đúng tinh thần "1 citation chính xác" của spec, chỉ ghi chú rõ ở đây để không che giấu cách tính.

**Nhóm C — Model không tuân thủ đúng quy tắc định dạng citation theo verdict (2 case, lỗi định dạng, không phải lỗi hiểu bài):**
- **TC15**: verdict "ambiguous" đúng, nhưng model vẫn kèm citation `[T04-056]` dù Prompt B nói rõ verdict ambiguous "KHÔNG chấm đúng/sai" (ngụ ý không cần trích dẫn).
- **TC20**: verdict "out_of_scope" đúng (nhận diện đúng đây là vượt thẩm quyền), nhưng KHÔNG trích [T03-095] như kỳ vọng — có thể vì Prompt B chỉ nói rõ citation bắt buộc ở lớp ①, còn lớp ③ không có hướng dẫn rõ có cần citation hay không. Đây một phần là **lỗ hổng trong chính câu chữ của Prompt B** (thiếu chỉ dẫn rõ cho lớp ③), không hẳn lỗi model.

## Kết luận & việc cần làm tiếp

- **0/20 case model tự bịa trích dẫn không tồn tại** — điều kiện "không bịa trích dẫn sai" của quality bar được giữ vững ở lượt này.
- **14/20 (70%) đạt tuyệt đối, chưa tới mốc 85%** — chủ yếu do lỗi định dạng citation (nhóm B, C: 5/6 case fail) chứ không phải lỗi hiểu sai kiến thức (nhóm A: chỉ 1/6). Ưu tiên sửa tiếp theo: (1) làm rõ trong Prompt B rằng lớp ③ cũng cần citation nếu có sẵn, (2) yêu cầu model chỉ trả về đúng 1 mã trích dẫn duy nhất, (3) thêm bước "diễn giải lại ý học viên" trước khi kết luận đúng/sai để bắt được misconception tinh vi như TC02.
- Đây là **lời gọi AI thật đầu tiên** ở quyết định trung tâm của tính năng (chấm hiểu bài + phát hiện misconception) — đủ điều kiện cho mốc CP3 (`04-rubric.md`: "Lời gọi AI thật ở quyết định trung tâm + golden set ≥20 + bảng kết quả lượt 1 có %").
