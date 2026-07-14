# 조팸스런 Step 7 — Cloudflare Workers AI 연결

## 구성
- `src/index.js`: Workers AI 중계 API
- `wrangler.jsonc`: AI binding 및 허용 Origin 설정
- `JofamsRun_AI_Step7_WorkersAI_Connected.html`: 생성형 AI 연결용 게임
- `package.json`: 실행·배포 명령

## 1. Worker 배포
Node.js 설치 후 이 폴더에서 실행합니다.

```bash
npm install
npx wrangler login
npm run deploy
```

배포가 끝나면 다음과 같은 주소가 표시됩니다.

```text
https://jofams-ai-report.<계정서브도메인>.workers.dev
```

정상 상태 확인:

```text
https://jofams-ai-report.<계정서브도메인>.workers.dev/health
```

## 2. 게임과 연결
게임 HTML을 열고 Chrome 개발자도구 Console에서 한 번 실행합니다.

```javascript
setJofamsAiEndpoint(
  "https://jofams-ai-report.<계정서브도메인>.workers.dev/api/jofams-report"
)
```

확인:

```javascript
getJofamsAiEndpoint()
```

그 후 게임을 완료하고 지식검증 문항을 제출합니다. 결과카드에
`생성형 AI · @cf/meta/llama-3.1-8b-instruct-fast`가 표시되면 연결 성공입니다.

GitHub Pages에 최종 배포할 때는 HTML의 `AI_REPORT_ENDPOINT` 상수에 위 주소를
직접 입력해도 됩니다.

## 3. 허용 도메인
`wrangler.jsonc`의 `ALLOWED_ORIGINS`는 현재 다음 도메인을 허용합니다.

- `https://localpay.github.io`
- 로컬 테스트 주소

커스텀 도메인을 사용하면 쉼표로 추가한 뒤 다시 배포합니다.

## 개인정보 최소화
게임은 생성형 AI 엔드포인트로 이름과 소속을 전송하지 않습니다.
모델에는 게임점수, 진단점수, 취약분야와 지식검증 결과만 전달됩니다.

## 오류 시 동작
Worker 호출이 실패하거나 엔드포인트를 설정하지 않으면 게임은 중단되지 않고
설명 가능한 로컬 리포트로 자동 전환됩니다.

## 주의
- AI 리포트는 교육용입니다.
- 실제 계약 또는 공공구매 실적 인정 여부를 확정하지 않습니다.
- 지식검증 문항과 안내문은 담당부서의 최종 법령 검수를 거쳐야 합니다.
- Workers AI 사용량에는 계정 요금·한도가 적용될 수 있으므로 Cloudflare 대시보드에서 확인합니다.
