# 실행 지시 기록

실행 당시 지시의 공통 내용이다. 로컬 절대 경로는 공개 자료에서 `{run_dir}`로 정규화했다. 상위 시스템 지시나 실제 모델 버전을 완전히 재현하는 기록은 아니다.

## 독립 응답자 A/B/C

- 이전 대화 없는 새 문맥, 응답자 식별자만 A/B/C로 다르게 전달.
- `{run_dir}/cases.json` 하나만 읽는다. 다른 파일·루브릭·다른 응답·중앙상태·GitHub·인터넷 접근, 파일 기록·하위 에이전트·메시지를 금지한다.
- 각 사례에서 경쟁 가설 최소 2개(고정 선택지는 대안 비교 가능), 근거·미지수·판별 질문/관측·주어진 action 중 추천·재검토 조건을 평가한다. 없는 사실을 발명하지 않는다.
- JSON 배열 필드: id, action, hypotheses, evidence, unknowns, next_observation, reconsider_when. 사례당 200~350자 정도, 여섯 사례 모두 출력.
- 확신 수치를 검증된 확률로 쓰지 않는다. 세 응답자 모두 완료 후 기록·공개한다.

## 조정자

- 이전 대화 없는 새 문맥. cases.json과 responses/a.json, b.json, c.json만 읽는다. 루브릭·다른 파일·외부 조회·기록·하위 에이전트·메시지를 금지한다.
- 다수결을 맹목적으로 따르지 않고 가설 근거를 비교·반박하며, 사실/가치/제약/미지수를 구분한다. 사실과 응답의 모순, 말바꿈, 유효한 경쟁 구분 부재도 확인한다.
- JSON 배열 필드: id, action, accepted_hypothesis, rejected_or_unresolved, evidence_check, next_observation, reconsider_when, limitations. 여섯 사례 모두, 사례당 250~400자 수준.
- 일치 자체를 정답 증거로 보지 않고 새 자료를 실제 조사했다고 주장하지 않는다.
