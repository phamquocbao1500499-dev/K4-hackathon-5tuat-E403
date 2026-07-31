# Kết quả chạy Golden Set — Lượt 2 (prompt cải tiến, sau lượt 1)

- **Ngày chạy:** 2026-07-31
- **Model:** `gemini-flash-lite-latest` (gọi qua `ai.models.generateContent` bằng `GEMINI_API_KEY` — đổi từ
  `gemini-flash-latest` dùng ở lượt 1 vì quota free-tier 20 req/ngày của model đó đã bị chính 20 case
  golden set của lượt 1 dùng hết trong ngày, xem codebase/server/scripts/generate-question-bank.js cho lý do
  tương tự đã áp dụng ở chỗ khác trong repo).
- **Prompt dùng:** `buildExplainAnswerPrompt` (codebase/server/prompts.js) — bản thay thế Prompt B sau khi
  phân tích 6 case fail ở lượt 1 (eval/results_run1.md), với 3 thay đổi: (1) bắt buộc diễn giải lại ý học
  viên trước khi kết luận verdict, (2) bắt buộc đúng 1 mã trích dẫn duy nhất — ưu tiên đoạn ĐẦU TIÊN nêu ý
  đó, (3) quy tắc trích dẫn tách riêng theo từng verdict (ambiguous luôn NONE_OUT_OF_SCOPE; out_of_scope/
  ungrounded chỉ trích khi có đúng 1 đoạn liên quan trực tiếp).
- **Cách grounding:** tái sử dụng NGUYÊN VĂN cửa sổ transcript đã cấp cho từng case ở lượt 1
  (`eval/trace_log_run1.json`), để chênh lệch điểm số chỉ phản ánh thay đổi prompt, không phải do đổi
  cách retrieval.
- **Trace log đầy đủ:** `eval/trace_log_run2.json`
- **Quality bar đối chiếu (spec.md §7):** ≥ 85%.
- **So với lượt 1:** 14/20 = 70.0%.

## Kết quả tổng

| Chỉ số | Giá trị |
|---|---|
| Tổng số case | 20 |
| Đạt (verdict đúng **và** citation khớp chính xác) | **15 / 20 = 75.0%** |
| Đối chiếu Quality Bar (≥85%) | **CHƯA ĐẠT** |
| So với lượt 1 (70.0%) | **+5.0 điểm %** |

## Bảng chi tiết từng case

| ID | Lớp | Expected verdict | Got verdict | Verdict khớp? | Expected citation | Got citation | Citation khớp? | Pass |
|---|---|---|---|---|---|---|---|---|
| TC01 | ④ Đặc thù domain | misconception | misconception | ✅ | [T04-056] | [T04-056] | ✅ | ✅ |
| TC02 | ④ Đặc thù domain | misconception | misconception | ✅ | [T04-040] | [T04-040] | ✅ | ✅ |
| TC03 | ④ Đặc thù domain | misconception | misconception | ✅ | [T04-086] | [T04-086] | ✅ | ✅ |
| TC04 | ④ Đặc thù domain | misconception | misconception | ✅ | [T04-059] | [T04-060] | ❌ | ❌ |
| TC05 | ④ Đặc thù domain | misconception | misconception | ✅ | [T02-034] | [T02-033] | ❌ | ❌ |
| TC06 | ④ Đặc thù domain | misconception | misconception | ✅ | [T02-036] | [T02-036] | ✅ | ✅ |
| TC07 | ④ Đặc thù domain | correct | correct | ✅ | [T02-034] | [T02-033] | ❌ | ❌ |
| TC08 | ④ Đặc thù domain | correct | correct | ✅ | [T04-056] | [T04-056] | ✅ | ✅ |
| TC09 | ① Nguồn sự thật | ungrounded_question | ungrounded_question | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC10 | ① Nguồn sự thật | ungrounded_question | ungrounded_question | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC11 | ① Nguồn sự thật | ungrounded_question | ungrounded_question | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC12 | ① Nguồn sự thật | ungrounded_question | out_of_scope | ❌ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ❌ |
| TC13 | ② Mơ hồ / Thiếu thông tin | ambiguous | ambiguous | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC14 | ② Mơ hồ / Thiếu thông tin | ambiguous | ambiguous | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC15 | ② Mơ hồ / Thiếu thông tin | ambiguous | ambiguous | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC16 | ③ Ngoài phạm vi | out_of_scope | out_of_scope | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC17 | ③ Ngoài phạm vi | out_of_scope | out_of_scope | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC18 | ③ Ngoài phạm vi | out_of_scope | out_of_scope | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC19 | ③ Ngoài phạm vi | out_of_scope | out_of_scope | ✅ | NONE_OUT_OF_SCOPE | NONE_OUT_OF_SCOPE | ✅ | ✅ |
| TC20 | ③ Ngoài phạm vi | out_of_scope | ungrounded_question | ❌ | [T03-095] | NONE_OUT_OF_SCOPE | ❌ | ❌ |

## Đối chiếu với 3 nhóm lỗi đã sửa (eval/results_run1.md)

- **Nhóm A (TC02 — model bỏ sót misconception tinh vi):** ✅ **Đã sửa.** Bước "diễn giải lại ý học viên
  trước khi kết luận" (restatedUnderstanding) đã lộ đúng chỗ lệch nghĩa ("song song nhiều CÂU" khác
  "song song trong một chuỗi") — TC02 chuyển từ FAIL sang PASS.
- **Nhóm C (TC15 — citation lẫn vào verdict ambiguous; TC16-19 giữ đúng out_of_scope không cần citation):**
  ✅ **Đã sửa.** Quy tắc "verdict=ambiguous LUÔN citation=NONE_OUT_OF_SCOPE" đưa TC15 từ FAIL sang PASS,
  không case nào khác bị ảnh hưởng ngược (TC13/14/16-19 vẫn PASS).
- **Nhóm B (TC04/05/07 — nhiều mã trích dẫn hoặc trích đoạn liền kề):** ⚠️ **Sửa được nửa vấn đề.** Cả 3
  case giờ chỉ trả về ĐÚNG 1 mã (không còn kiểu "[T02-033], [T02-034]" như lượt 1) — đúng yêu cầu định
  dạng. Nhưng cả 3 vẫn chọn sai đoạn trong cặp đoạn liền kề nói cùng một ý (TC04: chọn T04-060 thay vì
  T04-059; TC05/TC07: chọn T02-033 thay vì T02-034) — hướng dẫn "ưu tiên đoạn ĐẦU TIÊN nêu ý đó" chưa đủ
  mạnh để thắng xu hướng model trích đoạn có câu chữ khớp nghĩa nhất với feedback nó vừa viết ra, dù đoạn
  đó không phải đoạn đầu tiên. Cần một vòng sửa tiếp theo, ví dụ: liệt kê rõ TỪNG mã ứng viên kèm số thứ
  tự ngay trong prompt và yêu cầu model chọn số nhỏ nhất trong các mã cùng nói một ý, thay vì để model tự
  ước lượng "đoạn nào đầu tiên" từ văn bản thô.

## Case mới phát sinh — ranh giới lớp ①/③ (TC12, TC20)

Cả TC12 và TC20 đều là case golden set tự nhận là khó chẩn đoán (TC20 note: "ranh giới giữa 'trả lời sai
kiến thức' và 'hành động vượt thẩm quyền'"). Ở lượt 1, TC12 không nằm trong 6 case fail nhưng TC20 verdict
đã đúng (chỉ thiếu citation). Ở lượt 2, cả hai bị lệch VERDICT giữa lớp ① (ungrounded_question — "không có
căn cứ") và lớp ③ (out_of_scope — "vượt phạm vi/thẩm quyền dù có thể có căn cứ gần đó"): TC12 đúng ra là
①, model chọn ③; TC20 đúng ra là ③ có citation, model chọn ① không citation. Đây không phải lỗi định dạng
như nhóm B/C mà là ranh giới ngữ nghĩa mơ hồ giữa 2 lớp — prompt hiện tại liệt kê ①③ tách biệt nhưng chưa
đưa quy tắc phân định rõ "không có căn cứ" (①) khác "có căn cứ nhưng vượt quyền quyết định" (③) như thế
nào. Việc cần làm tiếp: thêm ví dụ đối chiếu ①/③ ngay trong prompt.

## Kết luận

**15/20 = 75.0%**, tăng **+5 điểm %** so với lượt 1 (70.0%), vẫn **chưa đạt** mốc chất lượng 85% (spec.md
§7). 2/3 nhóm lỗi đã xác định ở lượt 1 (A, C) được sửa dứt điểm và không gây hồi quy ở các case khác;
nhóm B (đúng-đoạn-liền-kề) mới sửa được phần định dạng, phần chọn đúng đoạn cần thêm một vòng cải tiến
prompt nữa (liệt kê ứng viên rõ ràng thay vì để model tự ước lượng thứ tự đoạn). 2 case mới lệch (TC12,
TC20) là lỗi ranh giới ①/③, không phải hồi quy từ 2 nhóm đã sửa.
