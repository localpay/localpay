const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fast";
const MAX_BODY_BYTES = 32_000;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
};

function allowedOrigins(env) {
  return String(env.ALLOWED_ORIGINS || "https://localpay.github.io,http://localhost:8787,http://127.0.0.1:8787")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = allowedOrigins(env);
  const allowOrigin = allowed.includes(origin) ? origin : allowed[0] || "https://localpay.github.io";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "Content-Type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  };
}

function json(data, status, request, env) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...JSON_HEADERS, ...corsHeaders(request, env) },
  });
}

function clampNumber(value, min, max, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function cleanName(value, fallback = "") {
  return String(value || fallback).replace(/[<>{}\[\]`]/g, "").trim().slice(0, 80);
}

function normalizePayload(input) {
  const p = input && typeof input === "object" ? input : {};
  const diagnosis = p.diagnosis || {};
  const knowledge = p.knowledge || {};
  const integrated = p.integrated || {};
  const effect = p.learningEffect || {};

  const normalizeItems = (items) =>
    (Array.isArray(items) ? items : []).slice(0, 3).map((x) => ({
      name: cleanName(x?.name, "미분류"),
      mastery: clampNumber(x?.mastery, 0, 100),
    }));

  return {
    performance: {
      finalScore: clampNumber(p.performance?.finalScore, 0, 10_000_000),
      stageReached: clampNumber(p.performance?.stageReached, 1, 100, 1),
      totalCollected: clampNumber(p.performance?.totalCollected, 0, 100_000),
      uniqueCollected: clampNumber(p.performance?.uniqueCollected, 0, 12),
      maxCombo: clampNumber(p.performance?.maxCombo, 0, 100_000),
      collisionCount: clampNumber(p.performance?.collisionCount, 0, 100_000),
    },
    diagnosis: {
      overallScore: clampNumber(diagnosis.overallScore, 0, 100),
      level: cleanName(diagnosis.level, "입문"),
      strengths: normalizeItems(diagnosis.strengths),
      weaknesses: normalizeItems(diagnosis.weaknesses),
      recommendation: cleanName(diagnosis.recommendation, ""),
    },
    knowledge: {
      score: clampNumber(knowledge.score, 0, 100),
      correctCount: clampNumber(knowledge.correctCount, 0, 20),
      totalQuestions: clampNumber(knowledge.totalQuestions, 0, 20),
      wrongCategories: (Array.isArray(knowledge.wrongCategories) ? knowledge.wrongCategories : [])
        .slice(0, 5)
        .map((x) => cleanName(x))
        .filter(Boolean),
    },
    integrated: {
      score: clampNumber(integrated.score, 0, 100),
      level: cleanName(integrated.level, "입문"),
      behaviorScore: clampNumber(integrated.behaviorScore, 0, 100),
      knowledgeScore: clampNumber(integrated.knowledgeScore, 0, 100),
      improvementScore: clampNumber(integrated.improvementScore, 0, 100),
    },
    learningEffect: {
      compared: Boolean(effect.compared),
      overallDelta: effect.overallDelta == null ? null : clampNumber(effect.overallDelta, -100, 100),
      improvedWeakCount: clampNumber(effect.improvedWeakCount, 0, 12),
      verdict: cleanName(effect.verdict, ""),
    },
  };
}

function systemPrompt() {
  return [
    "당신은 한국 공공기관의 공공구매 교육 코치입니다.",
    "입력된 게임·지식검증 수치만 사용하고 사실을 새로 만들지 마세요.",
    "법률·계약·구매실적 인정 여부를 확정하지 말고 담당부서 및 공식 시스템 확인을 안내하세요.",
    "사용자 개인정보를 추측하거나 출력하지 마세요.",
    "반드시 JSON 객체 하나만 출력하세요. 마크다운 코드블록은 금지합니다.",
    '필드: title, summary, strengths, weaknesses, knowledgeFeedback, retryRecommendation, learningEffect, practicalChecklist, disclaimer.',
    "strengths와 weaknesses는 문자열 배열, practicalChecklist는 3개 문자열 배열이어야 합니다.",
    "모든 문장은 한국어로 작성하고 과장 없이 간결하게 작성하세요.",
  ].join("\n");
}

function userPrompt(payload) {
  return [
    "다음 분석데이터를 바탕으로 개인 맞춤 공공구매 코칭 리포트를 작성하세요.",
    "점수의 원인을 단정하지 말고, 관찰된 데이터 범위에서만 설명하세요.",
    JSON.stringify(payload),
  ].join("\n\n");
}

function extractText(result) {
  if (typeof result === "string") return result;
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.result?.response === "string") return result.result.response;
  return JSON.stringify(result);
}

function parseModelJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first < 0 || last <= first) throw new Error("AI response is not JSON");
  return JSON.parse(cleaned.slice(first, last + 1));
}

function normalizeReport(raw, model) {
  const arr = (v, max = 5) =>
    (Array.isArray(v) ? v : []).slice(0, max).map((x) => cleanName(x)).filter(Boolean);

  return {
    source: "server-generative-ai",
    model,
    title: cleanName(raw?.title, "공공구매 AI 코칭 리포트"),
    summary: cleanName(raw?.summary, "분석 결과를 생성했습니다."),
    strengths: arr(raw?.strengths, 3),
    weaknesses: arr(raw?.weaknesses, 3),
    knowledgeFeedback: cleanName(raw?.knowledgeFeedback, "지식검증 결과를 다시 확인하세요."),
    retryRecommendation: cleanName(raw?.retryRecommendation, "취약분야 중심의 재도전을 권장합니다."),
    learningEffect: cleanName(raw?.learningEffect, "반복 플레이 후 변화 추이를 확인하세요."),
    practicalChecklist: arr(raw?.practicalChecklist, 3),
    disclaimer: cleanName(
      raw?.disclaimer,
      "이 리포트는 교육용 분석이며 실제 계약·구매실적 인정 여부를 확정하지 않습니다."
    ),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "jofams-ai-report", model: env.AI_MODEL || DEFAULT_MODEL }, 200, request, env);
    }

    if (url.pathname !== "/api/jofams-report" || request.method !== "POST") {
      return json({ error: "Not found" }, 404, request, env);
    }

    const origin = request.headers.get("Origin") || "";
    if (origin && !allowedOrigins(env).includes(origin)) {
      return json({ error: "Origin not allowed" }, 403, request, env);
    }

    const contentLength = Number(request.headers.get("Content-Length") || 0);
    if (contentLength > MAX_BODY_BYTES) {
      return json({ error: "Request too large" }, 413, request, env);
    }

    let body;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return json({ error: "Request too large" }, 413, request, env);
      body = JSON.parse(raw);
    } catch {
      return json({ error: "Invalid JSON" }, 400, request, env);
    }

    const payload = normalizePayload(body);
    const model = env.AI_MODEL || DEFAULT_MODEL;

    try {
      const result = await env.AI.run(model, {
        messages: [
          { role: "system", content: systemPrompt() },
          { role: "user", content: userPrompt(payload) },
        ],
        max_tokens: 900,
        temperature: 0.2,
      });

      const report = normalizeReport(parseModelJson(extractText(result)), model);
      return json(report, 200, request, env);
    } catch (error) {
      console.error("Workers AI generation failed", error);
      return json(
        { error: "AI generation failed", detail: String(error?.message || error).slice(0, 180) },
        502,
        request,
        env
      );
    }
  },
};
