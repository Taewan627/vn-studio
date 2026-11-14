import { contentLanguageInstruction, resolveContentLanguage, type GenerationOptions } from '../i18n/locales.js';
import { translate } from '../i18n/catalog.js';
import fs from 'fs';
import path from 'path';
import { VisualNovel, Character, DialogueLine, Expression, Scene, StoryStage } from '../types';
import { STANDARD_EXPRESSIONS } from '../constants.js';
import { prepareQuickStory, QUICK_PROFILE_PROMPT } from './quickStory.js';
import { isQuickImage } from './quickImages.js';
import { isImageGenerationEnabled, requireImageGenerationEnabled } from './imageGenerationPolicy.js';

const isClient = typeof window !== 'undefined';

// Simple zero-dependency environment variables loader for server-side
function loadEnv() {
  if (isClient || process.env.VERCEL === '1') return;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const firstEqual = trimmed.indexOf('=');
          if (firstEqual > 0) {
            const key = trimmed.substring(0, firstEqual).trim();
            let val = trimmed.substring(firstEqual + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  } catch (e) {
    console.warn("[GeminiService/OpenRouter] Failed to load .env file manually:", e);
  }
}

// Immediately load env
loadEnv();

async function clientProxy(funcName: string, payload: any) {
  const send = () => fetch(`/api/gemini/${funcName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const res = await send();
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `서버 호출 중 오류가 발생했습니다. (${funcName})`);
  }
  return res.json();
}

/**
 * Standardized API call logging.
 */
function logApiCall(
  provider: string,
  model: string,
  endpoint: string,
  statusCode: number,
  responseShape: string
) {
  console.log(`[API LOG] Provider: ${provider} | Model: ${model} | Status Code: ${statusCode}`);
}

/**
 * Enhanced Error Handler that categorizes 401, 402, 429, invalid model, unsupported image gen, and more.
 */
function handleApiError(
  statusCode: number,
  responseBody: string,
  model: string,
  isImage: boolean = false
): Error {
  let errorMsg = `API Error [Status ${statusCode}]`;

  if (statusCode === 401) {
    errorMsg = "Unauthorized (401): OpenRouter API Key가 유효하지 않거나 설정되지 않았습니다.";
  } else if (statusCode === 402) {
    errorMsg = "Payment Required (402): OpenRouter 계정 잔액이 부족합니다.";
  } else if (statusCode === 429) {
    errorMsg = "Too Many Requests (429): API 호출 한도가 초과되었습니다. 잠시 후 다시 시도해주세요.";
  } else if (statusCode === 400) {
    const errLower = responseBody.toLowerCase();
    if (errLower.includes("model_not_found") || errLower.includes("invalid modal") || errLower.includes("does not exist")) {
      errorMsg = `Invalid Model: 요청한 AI 모델(${model})을 찾을 수 없습니다. (모델 ID오류)`;
    } else if (errLower.includes("invalid_model") || errLower.includes("unknown model")) {
      errorMsg = `Invalid Model: 지정된 AI 모델(${model})명이 유효하지 않습니다.`;
    }
  }

  if (isImage) {
    const errLower = responseBody.toLowerCase();
    if (errLower.includes("unsupported") || errLower.includes("not support") || statusCode === 404 || errLower.includes("no model")) {
      errorMsg = `Unsupported Image Generation: 사용 중인 모델(${model})은 이미지 생성을 지원하지 않거나 설정이 유효하지 않습니다.`;
    }
  }

  console.error(`[API ERROR] ${errorMsg}`);
  return new Error(errorMsg);
}

/**
 * Cleans the codeblocks from AI text responses and parses JSON safely.
 */
function cleanAndParseJson(text: string): any {
  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.substring(7);
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.substring(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.substring(0, cleaned.length - 3);
  }
  cleaned = cleaned.trim();

  // Find start and end of JSON if there was outer noise
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIndex = -1;
  let endIndex = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
    endIndex = cleaned.lastIndexOf('}');
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
    endIndex = cleaned.lastIndexOf(']');
  }

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    cleaned = cleaned.substring(startIndex, endIndex + 1);
  }

  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    console.error('[GeminiService] Invalid AI JSON response (content omitted)');
    throw new Error('Response parsing error: Invalid AI JSON response.');
  }
}

/**
 * Dispatches text requests to OpenRouter.
 */
async function fetchOpenRouterText(messages: any[], config?: any): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_TEXT_MODEL || "anthropic/claude-sonnet-4.6";
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";

  if (!apiKey) {
    throw handleApiError(401, "API Key is missing in server environment variables.", model);
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://ai.studio/build",
    "X-Title": "VN-AI Studio"
  };

  const payload: any = {
    model: model,
    messages: messages,
    temperature: config?.temperature ?? 0.7,
    ...(config?.maxTokens ? { max_tokens: config.maxTokens } : {}),
  };

  if (config?.responseMimeType === "application/json") {
    payload.response_format = { type: "json_object" };
  }

  let response;
  let responseText = "";
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      ...((config?.timeoutMs || process.env.VERCEL === '1') ? { signal: AbortSignal.timeout(config?.timeoutMs || 75_000) } : {}),
    });
    responseText = await response.text();
  } catch (fetchErr: any) {
    console.error('Fetch request to OpenRouter failed (details omitted)');
    throw new Error('OpenRouter Network Connection Failed');
  }

  const responseShape = responseText.substring(0, 150) + (responseText.length > 150 ? "..." : "");
  logApiCall("openrouter", model, endpoint, response.status, responseShape);

  if (!response.ok) {
    throw handleApiError(response.status, responseText, model);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    throw handleApiError(response.status, `JSON Parsing error on response: ${responseText}`, model);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error(`Response parsing error: 'choices[0].message.content'가 유효하지 않거나 비어 있습니다.`);
  }

  return content;
}

/**
 * Text retry wrapper.
 */
async function generateOpenRouterTextWithRetry(messages: any[], config?: any, maxRetries = 2): Promise<string> {
  const requestMessages = messages.map(message => message.role === 'system'
    ? { ...message, content: message.content + contentLanguageInstruction(config) }
    : message);
  let delay = 1000;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fetchOpenRouterText(requestMessages, config);
    } catch (err: any) {
      lastError = err;
      const errMsg = String(err.message || "").toLowerCase();
      const isRetryable =
        errMsg.includes("429") ||
        errMsg.includes("502") ||
        errMsg.includes("503") ||
        errMsg.includes("504") ||
        errMsg.includes("rate limit") ||
        errMsg.includes("temporary") ||
        errMsg.includes("timeout") ||
        errMsg.includes("too many requests");

      if (isRetryable && attempt < maxRetries - 1) {
        console.warn(`[OpenRouter Retry] Attempt ${attempt + 1}/${maxRetries} failed. Waiting ${delay}ms before retry.`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        break;
      }
    }
  }
  throw lastError;
}

async function prepareReferenceImage(referenceImageUrl: string): Promise<string | null> {
  if (!referenceImageUrl) return null;
  if (process.env.VERCEL === '1' && !/^data:image\/(?:png|jpeg|webp);base64,/i.test(referenceImageUrl)) {
    throw new Error('Hosted image editing requires an uploaded PNG, JPEG or WebP image.');
  }

  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;

    // 1. If it's a relative path in public/
    if (referenceImageUrl.startsWith('/')) {
      const fs = await import('fs');
      const path = await import('path');
      const localPath = path.join(process.cwd(), 'public', referenceImageUrl.replace(/^\//, ''));
      if (fs.existsSync(localPath)) {
        const buf = fs.readFileSync(localPath);
        const resized = await sharp(buf)
          .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        return `data:image/jpeg;base64,${resized.toString('base64')}`;
      }
    }

    // 2. If it's already a data URL
    if (referenceImageUrl.startsWith('data:image/')) {
      const commaIdx = referenceImageUrl.indexOf(',');
      if (commaIdx !== -1) {
        const buf = Buffer.from(referenceImageUrl.substring(commaIdx + 1), 'base64');
        const resized = await sharp(buf)
          .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        return `data:image/jpeg;base64,${resized.toString('base64')}`;
      }
      return referenceImageUrl;
    }

    // 3. If it's a remote HTTP/HTTPS URL
    if (referenceImageUrl.startsWith('http://') || referenceImageUrl.startsWith('https://')) {
      const res = await fetch(referenceImageUrl);
      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        const resized = await sharp(buf)
          .resize({ width: 512, height: 512, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 80 })
          .toBuffer();
        return `data:image/jpeg;base64,${resized.toString('base64')}`;
      }
    }
  } catch (err) {
    console.warn('[prepareReferenceImage] Image preprocessing skipped, using raw:', err);
  }

  return referenceImageUrl;
}

/**
 * Generates an image using OpenRouter's Image models. Handles both base64 and URL formats, and supports reference image input.
 */
async function fetchOpenRouterImage(prompt: string, config?: { aspectRatio?: string; referenceImageUrl?: string; quick?: boolean }): Promise<string> {
  requireImageGenerationEnabled();
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_IMAGE_MODEL || "google/gemini-2.5-flash-image";
  const endpoint = "https://openrouter.ai/api/v1/chat/completions";

  if (!apiKey) {
    throw handleApiError(401, "API Key is missing in server environment variables.", model, true);
  }

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const userContent: any[] = [
    {
      type: "text",
      text: config?.quick ? `Generate exactly ONE image now, not a textual explanation or description. Follow the visual specification below. Return the generated image.\n${prompt}` : prompt
    }
  ];

  if (config?.referenceImageUrl) {
    const preparedRef = await prepareReferenceImage(config.referenceImageUrl);
    if (preparedRef) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: preparedRef
        }
      });
    }
  }

  const payload = {
    model: model,
    messages: [{ role: "user", content: userContent }],
    modalities: ["image", "text"],
    ...(config?.quick ? { image_config: { aspect_ratio: config.aspectRatio || '1:1' } } : {})
  };

  let response;
  let responseText = "";
  const maxRetries = config?.quick ? 1 : 2;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        ...(process.env.VERCEL === '1' ? { signal: AbortSignal.timeout(75_000) } : {})
      });
      responseText = await response.text();

      const responseShape = responseText.substring(0, 2000) + (responseText.length > 2000 ? "..." : "");
      logApiCall("openrouter", model, endpoint, response.status, responseShape);

      if (!response.ok) {
        const isRetryable = response.status === 429 || (response.status >= 500 && response.status <= 504);
        if (isRetryable && attempt < maxRetries - 1) {
          console.warn(`[OpenRouter Image Retry] Attempt ${attempt + 1}/${maxRetries} failed with status ${response.status}. Retrying in 1.5s...`);
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw handleApiError(response.status, responseText, model, true);
      }
      break;
    } catch (fetchErr: any) {
      lastError = fetchErr;
      if (attempt < maxRetries - 1) {
        console.warn(`[OpenRouter Image Retry] Attempt ${attempt + 1}/${maxRetries} network error. Retrying in 1.5s...`, fetchErr);
        await new Promise(r => setTimeout(r, 1500));
      } else {
        console.error("Image generation request to OpenRouter failed (details omitted)");
        throw fetchErr instanceof Error ? fetchErr : new Error(`OpenRouter Image Request Failed: ${fetchErr}`);
      }
    }
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (err) {
    throw new Error("Response parsing error: OpenRouter 이미지 응답을 JSON으로 읽을 수 없습니다.");
  }


  const message = data?.choices?.[0]?.message;
  // 1. Primary: Check message.images array (OpenRouter standard)
  const images = message?.images;
  let imageUrl = Array.isArray(images) && images.length > 0
    ? images[0]?.image_url?.url
    : undefined;

  // 2. Fallback 1: Check standard DALL-E like data-array (data[0].url)
  if (!imageUrl && Array.isArray(data?.data) && data.data.length > 0) {
    imageUrl = data.data[0]?.url;
  }

  // 3. Fallback 2: Extract URL from message.content (Markdown image syntax, or pure raw URLs)
  if (!imageUrl && message?.content) {
    const mdMatch = message.content.match(/!\[.*?\]\((https?:\/\/.*?)\)/);
    if (mdMatch) {
      imageUrl = mdMatch[1];
    } else {
      const urlMatch = message.content.match(/(https?:\/\/[^\s'")\]}]+)/);
      if (urlMatch) {
        imageUrl = urlMatch[1];
      }
    }
  }

  // 4. Fallback 3: Search raw response body globally for any valid HTTP URL
  if (!imageUrl && responseText) {
    const urlMatch = responseText.match(/(https?:\/\/[^\s'",\[\]{}]+)/);
    if (urlMatch) {
      imageUrl = urlMatch[1];
    }
  }

  // 5. Fallback 4: If still no image is found, serve an attractive local preset matching the story genre context
  // Quick must distinguish real image success from a local fallback.
  if (config?.quick && (typeof imageUrl !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(imageUrl))) {
    throw new Error('Quick image generation requires generated PNG, JPEG or WebP data.');
  }
  if (!imageUrl) {
    console.warn("[OpenRouter Image Fallback] Servicing elegant visual preset instead of throwing an empty screen error.");
    const fallbacks = [
      '/cyberpunk.jpg',
      '/sf.jpg',
      '/horror.jpg',
      '/thriller.jpg',
      '/apocalypse.jpg',
      '/war.jpg'
    ];
    const cleanedPrompt = prompt.toLowerCase();
    let fallback = '/cyberpunk.jpg';
    if (cleanedPrompt.includes('sf') || cleanedPrompt.includes('space') || cleanedPrompt.includes('future')) {
      fallback = '/sf.jpg';
    } else if (cleanedPrompt.includes('horror') || cleanedPrompt.includes('ghost') || cleanedPrompt.includes('zombie')) {
      fallback = '/horror.jpg';
    } else if (cleanedPrompt.includes('thrill') || cleanedPrompt.includes('mystery') || cleanedPrompt.includes('dark')) {
      fallback = '/thriller.jpg';
    } else if (cleanedPrompt.includes('apocalyp') || cleanedPrompt.includes('ruin') || cleanedPrompt.includes('destroy')) {
      fallback = '/apocalypse.jpg';
    } else if (cleanedPrompt.includes('war') || cleanedPrompt.includes('army') || cleanedPrompt.includes('fight')) {
      fallback = '/war.jpg';
    } else {
      fallback = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    }
    return fallback;
  }

  // If already base64 data URL, optimize and return
  if (imageUrl.startsWith("data:")) {
    if (imageUrl.startsWith("data:image/")) {
      try {
        const sharpModule = await import('sharp');
        const sharp = sharpModule.default;
        const commaIdx = imageUrl.indexOf(',');
        if (commaIdx !== -1) {
          const buffer = Buffer.from(imageUrl.substring(commaIdx + 1), 'base64');
          const resizedBuffer = await sharp(buffer)
            .resize({ width: config?.quick && config.aspectRatio === '1:1' ? 512 : 768, height: config?.quick && config.aspectRatio === '1:1' ? 512 : 768, fit: 'inside', withoutEnlargement: true })
            .png({ quality: 85, compressionLevel: 8 })
            .toBuffer();
          const normalized = `data:image/png;base64,${resizedBuffer.toString('base64')}`;
          if (config?.quick && !isQuickImage(normalized)) throw new Error('Quick image exceeds the size limit.');
          return normalized;
        }
      } catch (sharpErr) {
        if (config?.quick) throw new Error('Quick image decoding or size validation failed.');
        console.warn("[Sharp image optimization skipped]:", sharpErr);
      }
    }
    return imageUrl;
  }

  // If already a relative fallback path, return it directly
  if (imageUrl.startsWith("/")) {
    return imageUrl;
  }

  // Otherwise convert standard URL to base64 format for safe client-side preview rendering
  if (process.env.VERCEL === '1') {
    // Do not fetch arbitrary model-supplied URLs from a public server (SSRF).
    throw new Error('Hosted image generation requires base64 image output. Use local Full Studio for remote image sources.');
  }
  try {
    console.log('[OpenRouter Image] Converting image URL to Base64 (URL omitted)');
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      throw new Error(`Failed to fetch image source: ${imgRes.statusText}`);
    }
    const arrayBuffer = await imgRes.arrayBuffer();
    let buffer = Buffer.from(arrayBuffer);
    let mime = imgRes.headers.get('content-type') || 'image/jpeg';

    try {
      const sharpModule = await import('sharp');
      const sharp = sharpModule.default;
      buffer = await sharp(buffer)
        .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
        .png({ quality: 85, compressionLevel: 8 })
        .toBuffer();
      mime = 'image/png';
    } catch (sharpErr) {
      console.warn("[Sharp remote image optimization skipped]:", sharpErr);
    }

    const base64Str = buffer.toString('base64');
    return `data:${mime};base64,${base64Str}`;
  } catch (urlConvErr: any) {
    console.error("[OpenRouter Image] URL to Base64 conversions failed:", urlConvErr);
    throw new Error(`Response parsing error: 생성된 외부 이미지 다운로드 및 복원에 실패하였습니다. (${urlConvErr.message})`);
  }
}


const NEGATIVE_PROMPTS = {
  character: "(STRICT: NO TEXT, NO LETTERS, NO NUMBERS, NO CAPTIONS, NO SPEECH BUBBLES, NO WATERMARK, NO SIGNATURE, NO UI ELEMENTS, NO FULL BODY, NO FEET, NO SHOES, NO LEGS, NO SITTING).",
  background: "(STRICT: NO PEOPLE, NO HUMANS, NO CROWDS, NO INDIVIDUALS, NO MANNEQUINS, EMPTY ENVIRONMENT, DESERTED)."
};

const STORY_SYSTEM_INSTRUCTION = `
당신은 비주얼 노벨 수석 시나리오 작가입니다. 
제공된 테마를 바탕으로 10~15개의 장면으로 구성된 다중 분기 시나리오를 작성하세요.

[필수 규칙]
1. 캐릭터: 서로 다른 개성을 가진 3명의 주요 캐릭터를 생성하십시오.
2. 장면: 모든 장면(Scene)은 'ki', 'seung', 'jeon', 'gyeol' 단계 중 하나에 속해야 하며, 배경 생성을 위한 상세한 'aiPrompt'를 포함해야 합니다.
3. 선택지: 각 장면은 다음 장면으로 이어지는 2개의 선택지를 포함하는 것을 권장합니다.
4. 데이터: 유효한 JSON 형식으로 응답하십시오.
`;

/**
 * AI 응답 데이터를 표준 형식으로 보정하는 함수
 */
function normalizeVisualNovelData(raw: any): VisualNovel {
  const vn = { ...raw } as VisualNovel;
  
  if (!vn.characters || !Array.isArray(vn.characters)) {
    vn.characters = [];
  }
  if (!vn.scenes || !Array.isArray(vn.scenes)) {
    vn.scenes = [];
  }

  // 1. 캐릭터 보정: 표준 5종 표정 보장
  vn.characters.forEach(char => {
    if (!char) return;
    const existingExprs = char.expressions || [];
    char.expressions = STANDARD_EXPRESSIONS.map((std, idx) => {
      const found = existingExprs.find((e: any) => e && e.name === std.name);
      return {
        id: found?.id || `${char.id}_expr_${idx + 1}`,
        name: std.name,
        imageUrl: found?.imageUrl || ''
      };
    });
  });

  // 2. 장면 및 대화 보정: 캐릭터 ID 매핑 및 누락 필드 채우기
  vn.scenes.forEach((scene, sIdx) => {
    if (!scene) return;
    if (!scene.dialogue || !Array.isArray(scene.dialogue)) {
      scene.dialogue = [];
    }
    
    scene.dialogue.forEach(line => {
      if (!line) return;
      if (!line.characterId) {
        line.characterId = null;
        line.expressionId = null;
      } else {
        const char = vn.characters.find(c => c && (c.id === line.characterId || c.name === line.characterId));
        if (char) {
          line.characterId = char.id;
          const expr = char.expressions.find(e => e && e.id === line.expressionId) || char.expressions.find(e => e && e.name === line.expressionId);
          line.expressionId = expr ? expr.id : (char.expressions[0]?.id || null);
        } else {
          line.characterId = null;
          line.expressionId = null;
        }
      }
    });

    if (!scene.backgroundUrl) {
      scene.backgroundUrl = isImageGenerationEnabled() ? `https://loremflickr.com/1280/720/anime,scenery,city?lock=${Math.floor(Math.random() * 1000)}` : '';
    }

    // 3. (추가) 선택지 및 장면 연결 정상화 보정 (AI 오인 매칭 및 빈 ID 복원)
    if (!scene.choices) {
      scene.choices = [];
    }
    scene.choices.forEach((choice, cIdx) => {
      // 3.1. ID와 완전 일치하는 씬 탐색
      let targetExists = vn.scenes.some(s => s && s.id === choice.nextSceneId);
      
      // 3.2. 이름으로 매칭 시도 (AI가 nextSceneId에 ID 대신 씬 이름을 적었을 때 대비)
      if (!targetExists && choice.nextSceneId) {
        const cleanedTargetId = choice.nextSceneId.trim().toLowerCase();
        const foundByName = vn.scenes.find(s => 
          s && (s.name.trim().toLowerCase() === cleanedTargetId || 
                cleanedTargetId.includes(s.name.trim().toLowerCase()) ||
                s.name.trim().toLowerCase().includes(cleanedTargetId))
        );
        if (foundByName) {
          choice.nextSceneId = foundByName.id;
          targetExists = true;
        }
      }
      
      // 3.3. 여전히 연결 대상이 없거나 잘못되었을 때: 폴백으로 다음 인덱스의 씬 매핑
      if (!targetExists || !choice.nextSceneId) {
        // 자신보다 뒤에 오는 씬들 중 첫 번째 씬 우선순위 연결
        const subsequentScene = vn.scenes.slice(sIdx + 1).find(s => s && s.id !== scene.id);
        if (subsequentScene) {
          choice.nextSceneId = subsequentScene.id;
        } else {
          // 뒤쪽이 없으면 자신을 제외한 씬 목록의 첫 번째 씬 연결
          const anyOtherScene = vn.scenes.find(s => s && s.id !== scene.id);
          choice.nextSceneId = anyOtherScene ? anyOtherScene.id : '';
        }
      }
    });
  });

  if (!vn.scenes.some(s => s && s.id === vn.startSceneId)) {
    vn.startSceneId = vn.scenes[0]?.id || '';
  }

  return vn;
}

export async function generateStory(theme: string, options: GenerationOptions = {}): Promise<VisualNovel> {
  if (isClient) {
    return clientProxy('generateStory', { theme , ...options });
  }
  if (options.generationProfile === 'quick') {
    const language = resolveContentLanguage(options.contentLanguage);
    const messages = [
      { role: 'system', content: QUICK_PROFILE_PROMPT },
      { role: 'user', content: JSON.stringify({ idea: theme }) },
    ];
    // Normally one call; at most one correction after an invalid JSON/graph response.
    // Provider failures propagate immediately and are never replaced by a successful demo.
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await generateOpenRouterTextWithRetry(messages, { contentLanguage: language, responseMimeType: 'application/json', timeoutMs: attempt === 0 ? 100_000 : 65_000, maxTokens: 8000 }, 1);
      try {
        return prepareQuickStory(cleanAndParseJson(result), language);
      } catch (error) {
        if (attempt === 1) throw error;
        messages.push({ role: 'assistant', content: result });
        messages.push({ role: 'user', content: `Correct the JSON using the original idea and language. Validation errors: ${error instanceof Error ? error.message : 'Invalid schema'}. Return the entire corrected object.` });
      }
    }
  }
  
  try {
    const prompt = `테마: "${theme}"를 기반으로 비주얼 노벨 시나리오를 작성하세요.
절대 일반 텍스트나 부가설명 없이 반드시 아래 JSON 스키마를 100% 만족하는 유연한 JSON 개체로만 응답하십시오.

[반환할 JSON 스키마]
{
  "title": "비주얼 노벨 제목",
  "description": "시놉시스/소개글",
  "startSceneId": "시작할 장면 씬 ID (scenes 중 하나의 id)",
  "characters": [
    {
      "id": "char_1",
      "name": "캐릭터 이름",
      "description": "선택한 출력 언어로 작성한 캐릭터의 성격과 배경 설명",
      "aiPrompt": "캐릭터의 외모, 헤어, 의상 등 이미지 생성을 위한 고품질 영문 프롬프트"
    }
  ],
  "scenes": [
    {
      "id": "scene_1",
      "name": "장면 제목",
      "stage": "기승전결 단계 중 하나 ('ki' | 'seung' | 'jeon' | 'gyeol')",
      "aiPrompt": "장면 배경 이미지 생성을 위한 영문 화풍 상세 프롬프트",
      "presentCharacterIds": ["출현할 캐릭터 IDs"],
      "dialogue": [
        {
          "characterId": "대사하는 캐릭터 ID 또는 나레이션일 경우 null",
          "expressionId": "대사 기분에 어울리는 감정 표정 ID (char_1_expr_1 처럼 표정 매핑 ID)",
          "text": "실제 대사 텍스트"
        }
      ],
      "choices": [
        {
          "text": "선택지 텍스트",
          "nextSceneId": "이동할 대상 장면 ID"
        }
      ]
    }
  ]
}
`;

    const instructions = STORY_SYSTEM_INSTRUCTION + "\n반드시 단락 설명 없이 순수한 JSON 결과만 반환하십시오.";

    const textResult = await generateOpenRouterTextWithRetry([
      { role: "system", content: instructions },
      { role: "user", content: prompt }
    ], { contentLanguage: options.contentLanguage,
      responseMimeType: "application/json"
    });

    const parsed = cleanAndParseJson(textResult);
    return { ...normalizeVisualNovelData(parsed), contentLanguage: resolveContentLanguage(options.contentLanguage) };
  } catch (error) {
    console.error("Scenario Generation Error:", error);
    throw new Error(error instanceof Error ? error.message : "AI가 시나리오를 구성하는 데 어려움을 겪고 있습니다. 잠시 후 다시 시도해 주세요.");
  }
}

/**
 * 실시간 캐릭터 채팅 응답 생성
 */
export async function chatWithCharacter(
    character: Character, 
    scenePrompt: string, 
    userInput: string, 
    history: { role: 'user' | 'model', text: string }[], options: GenerationOptions = {}
): Promise<{ text: string, expressionName: string }> {
  if (isClient) {
    return clientProxy('chatWithCharacter', { character, scenePrompt, userInput, history , ...options });
  }
  
  const systemInstruction = `
당신은 비주얼 노벨의 캐릭터 '${character.name}'입니다. 
당신의 성격/배경: ${character.description || character.aiPrompt || '평범한 인물'}
현재 상황/장소: ${scenePrompt || '어느 장소'}

[대화 규칙]
1. 캐릭터의 성격과 말투를 100% 유지하세요.
2. 플레이어의 입력에 반응하며, 상황에 맞는 대답을 하세요.
3. 답변 시 현재 기분에 맞는 표정('중립', '행복', '슬픔', '화남', '놀람') 중 하나를 반드시 선택하세요.
4. JSON 형식으로만 답변하세요.

응답 예:
{
  "text": "정말 그렇게 생각해?",
  "expressionName": "놀람"
}
`;

  const messages: any[] = [{ role: 'system', content: systemInstruction }];
  history.forEach(h => {
    messages.push({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text
    });
  });
  messages.push({ role: 'user', content: userInput });

  const textResult = await generateOpenRouterTextWithRetry(messages, { contentLanguage: options.contentLanguage,
    responseMimeType: "application/json"
  });

  return cleanAndParseJson(textResult);
}

export function cleanCharacterPrompt(prompt: string): string {
  if (!prompt) return "";

  // Split by commas
  const segments = prompt.split(',');
  const preservedSegments = segments.filter(seg => {
    const s = seg.toLowerCase().trim();
    
    // Check for explicit background-related markers
    if (
      s.includes('standing in') ||
      s.includes('sitting in') ||
      s.includes('standing on') ||
      s.includes('sitting on') ||
      s.includes('standing at') ||
      s.includes('sitting at') ||
      s.includes('in front of') ||
      s.includes('inside') ||
      s.includes('at the') ||
      s.includes('background') ||
      s.includes('backdrop') ||
      s.includes('scenery') ||
      s.includes('landscape') ||
      s.includes('foreground')
    ) {
      // Keep if it describes clothing parts like "standing in armor" or "sitting in a jacket"
      if (s.includes('armor') || s.includes('dress') || s.includes('suit') || s.includes('skirt') || s.includes('jacket') || s.includes('clothing') || s.includes('costume') || s.includes('robe') || s.includes('coat')) {
        return true;
      }
      return false; // Filter out this background segment!
    }
    
    return true;
  });

  let clearedPrompt = preservedSegments.join(',').trim();

  // If after comma filtering the prompt became too short or empty, fall back to the original cleared of key phrases
  if (clearedPrompt.length < 8) {
    clearedPrompt = prompt;
  }

  // Inline cleanup of remaining background phrase sub-clauses
  clearedPrompt = clearedPrompt.replace(/(?:standing\s+in|sitting\s+in|standing\s+on|sitting\s+on|inside|at\s+the|in\s+front\s+of)\s+[^,.]+/gi, '');

  // Flatten duplicate whitespaces or trailing/leading punctuation
  clearedPrompt = clearedPrompt
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .replace(/^\s*,/g, '')
    .replace(/,\s*$/g, '')
    .trim();

  return clearedPrompt;
}

export async function generateCharacterImage(characterName: string, characterPrompt: string, expressionName: string, options: GenerationOptions = {}): Promise<string> {
  requireImageGenerationEnabled();
  if (isClient) {
    const data = await clientProxy('generateCharacterImage', { characterName, characterPrompt, expressionName, ...options });
    return data.result;
  }
  
  const cleanedPrompt = cleanCharacterPrompt(characterPrompt);
  const suffix = ", isolated character only, no background, plain solid color backdrop, upper body, visual novel sprite";
  
  const fullPrompt = `${NEGATIVE_PROMPTS.character} Masterpiece character design, anime style, ${characterName}: ${cleanedPrompt}${suffix}. High quality 2D game sprite. Expression: ${expressionName}.`;
  
  return fetchOpenRouterImage(fullPrompt, { aspectRatio: '1:1', quick: options.generationProfile === 'quick' });
}

const EXPRESSION_PROMPTS: Record<string, { mood: string; facialCues: string }> = {
  '중립': {
    mood: 'neutral, calm, peaceful',
    facialCues: 'calm gentle gaze, neutral relaxed mouth, composed subtle expression'
  },
  '행복': {
    mood: 'very happy, cheerful, smiling, joyful',
    facialCues: 'bright smiling mouth, joyful crinkled happy eyes, warm cheerful blush on cheeks, radiant warm expression'
  },
  '슬픔': {
    mood: 'sad, sorrowful, melancholic, tearful',
    facialCues: 'melancholic drooping eyes, sorrowful slight trembling lips, emotional delicate expression'
  },
  '화남': {
    mood: 'angry, furious, irritated, stern',
    facialCues: 'furrowed sharp eyebrows, intense fierce glaring eyes, grimacing or firm clutched mouth, stern determined expression'
  },
  '놀람': {
    mood: 'shocked, surprised, astonished, wide-eyed',
    facialCues: 'wide opened round eyes, small open mouth gasp "O", raised high eyebrows, startled cute reaction'
  }
};

export async function editCharacterImageExpression(
  baseImage: string,
  targetExpressionName: string,
  characterName?: string,
  characterPrompt?: string
): Promise<string> {
  requireImageGenerationEnabled();
  if (isClient) {
    const data = await clientProxy('editCharacterImageExpression', {
      baseImage,
      targetExpressionName,
      characterName,
      characterPrompt
    });
    return data.result;
  }

  const exprInfo = EXPRESSION_PROMPTS[targetExpressionName] || {
    mood: targetExpressionName,
    facialCues: `${targetExpressionName} facial expression`
  };

  const cleanedCharPrompt = characterPrompt ? cleanCharacterPrompt(characterPrompt) : '';
  const charIdentity = [
    characterName ? `Character Name: ${characterName}` : '',
    cleanedCharPrompt ? `Appearance details: ${cleanedCharPrompt}` : ''
  ].filter(Boolean).join('. ');

  const fullPrompt = `${NEGATIVE_PROMPTS.character}
[CRITICAL TASK: EXACT CHARACTER CONSISTENCY & FACIAL EXPRESSION VARIATION]
A reference image of the character sprite is provided.
You MUST preserve the EXACT SAME character appearance from the reference image:
${charIdentity ? `- Known Character traits: ${charIdentity}` : ''}
- IDENTICAL face structure, hair color, hair style, bangs, and eye color
- IDENTICAL costume, clothing, uniform, colors, and accessories
- IDENTICAL visual novel anime art style, 2D sprite rendering, line art, and shading
- IDENTICAL upper-body composition and framing

ONLY CHANGE THE FACIAL EXPRESSION:
- Target Emotion: ${targetExpressionName} (${exprInfo.mood})
- Facial details: ${exprInfo.facialCues}
- The character MUST remain 100% recognizable as the exact same person.
- Isolated character only, single solid plain background, upper body visual novel sprite.`;

  return fetchOpenRouterImage(fullPrompt, {
    aspectRatio: '1:1',
    referenceImageUrl: baseImage
  });
}

export async function generateSceneBackground(prompt: string, options: GenerationOptions = {}): Promise<string> {
  requireImageGenerationEnabled();
  if (isClient) {
    const data = await clientProxy('generateSceneBackground', { prompt, ...options });
    if (options.generationProfile === 'quick' && !isQuickImage(data.result)) throw new Error('No generated background image');
    try {
      const { resizeAndCompressImage } = await import('../utils/imageProcessing.js');
      return await resizeAndCompressImage(data.result, 1024, 0.4);
    } catch (e) {
      console.error("Failed to compress generated background image:", e);
      return data.result;
    }
  }
  const fullPrompt = `${NEGATIVE_PROMPTS.background} Cinematic Visual Novel background, detailed anime scenery, ${prompt}, 16:9.`;
  
  return fetchOpenRouterImage(fullPrompt, { aspectRatio: '16:9', quick: options.generationProfile === 'quick' });
}

export async function generateSceneDialogue(sceneName: string, scenePrompt: string, presentCharacters: Character[], options: GenerationOptions = {}): Promise<DialogueLine[]> {
  if (isClient) {
    return clientProxy('generateSceneDialogue', { sceneName, scenePrompt, presentCharacters , ...options });
  }
  
  const charDetails = presentCharacters.map(c => {
    const exprs = c.expressions.map(e => `"${e.name}" (ID: ${e.id})`).join(', ');
    return `- 캐릭터명: "${c.name}", ID: "${c.id}" (선택 가능한 표정: ${exprs})`;
  }).join('\n');

  const prompt = `장면 명: "${sceneName}"
장면 상황 및 분위기: "${scenePrompt}"

등장인물 목록 (이 장면에 참여하는 인물들의 목록입니다):
${charDetails}

위의 연출 지침과 캐릭터 이름, ID를 참고하여 10~15줄의 대화 시나리오(Dialogue)를 작성해 주세요. 

[매핑 필수 규칙]
1. 각 대화 줄(Line)의 'characterId'에는 해당 대사를 하는 인물의 실제 ID("char_1", "char_2" 등)를 직접 기입해야 합니다.
2. 만약 인물이 아닌 설명(나레이션)인 경우에는 'characterId'를 null로 기입하거나 생략해 주세요.
3. 'expressionId'에는 대사의 감정과 기분에 어울리는 표정 ID(예: "char_1_expr_1" 등)를 지칭해야 합니다. 나레이션일 경우에는 'expressionId'를 null로 설정해 주십시오.
4. 'text'에는 실제 플레이어가 볼 대사 텍스트를 적어주십시오.

반드시 다른 텍스트나 기호 없이 아래 형태의 JSON 무리(Array)로만 출력하십시오:
[
  {
    "characterId": "char_1",
    "expressionId": "char_1_expr_1",
    "text": "대사 내용"
  }
]
`;

  const textResult = await generateOpenRouterTextWithRetry([
    { role: "system", content: "당신은 비주얼 노벨 대화 전문 기획자입니다. 반드시 요청된 JSON 배열 형식으로만 응답해야 합니다." },
    { role: "user", content: prompt }
  ], { contentLanguage: options.contentLanguage,
    responseMimeType: 'application/json'
  });

  try {
    const rawDialogue: any[] = cleanAndParseJson(textResult);
    
    // 스마트 보정 및 유연한 매칭 레이어
    const normalizedDialogue: DialogueLine[] = rawDialogue.map((line: any) => {
      const text = line.text || '';
      let characterId: string | null = null;
      let expressionId: string | null = null;

      if (line.characterId) {
        // 1. 직접 ID 완전 매칭
        let foundChar = presentCharacters.find(c => c.id === line.characterId);
        
        // 2. 이름 매칭 (AI가 ID 대신 캐릭터 이름(예: '지우')을 입력했을 때를 대비)
        if (!foundChar) {
          const cleanedIdInput = line.characterId.trim().toLowerCase();
          foundChar = presentCharacters.find(c => 
            c.name.trim().toLowerCase() === cleanedIdInput ||
            cleanedIdInput.includes(c.name.trim().toLowerCase()) ||
            c.name.trim().toLowerCase().includes(cleanedIdInput)
          );
        }

        if (foundChar) {
          characterId = foundChar.id;

          // 표정 매칭 시도
          if (line.expressionId) {
            // 직접 ID 완전 매칭
            let foundExpr = foundChar.expressions.find(e => e.id === line.expressionId);
            
            // 이름이나 키워드 매칭 (AI가 '행복', '슬픔', 'happy' 등으로 적었을 경우 대비)
            if (!foundExpr) {
              const cleanedExprInput = line.expressionId.trim().toLowerCase();
              foundExpr = foundChar.expressions.find(e => 
                e.name.trim().toLowerCase() === cleanedExprInput ||
                cleanedExprInput.includes(e.name.trim().toLowerCase()) ||
                e.name.trim().toLowerCase().includes(cleanedExprInput)
              );
            }

            expressionId = foundExpr ? foundExpr.id : (foundChar.expressions[0]?.id || null);
          } else {
            // 표정 생략 시 기본값은 첫 번째(중립) 표정
            expressionId = foundChar.expressions[0]?.id || null;
          }
        }
      }

      return {
        characterId,
        expressionId,
        text
      };
    });

    return normalizedDialogue;
  } catch (err) {
    console.error("Dialogue generation json parse / normalization error", err);
    return [];
  }
}

/**
 * 신규 생성된 장면들의 캐릭터 ID 및 세부 데이터를 비주얼 노벨 규격에 부합하게 정규화
 */
export function normalizeNewScenes(scenes: any[], characters: Character[], options: GenerationOptions = {}): Scene[] {
  return scenes.map((scene, sIdx) => {
    // 기본 필드 보장
    const id = scene.id || `scene_gen_${Date.now()}_${sIdx}`;
    const name = scene.name || (resolveContentLanguage(options.contentLanguage) === 'ko'
      ? `장면 ${sIdx + 1}` : `${translate(resolveContentLanguage(options.contentLanguage), '장면 이름')} ${sIdx + 1}`);
    const stage = scene.stage || 'seung';
    const backgroundUrl = scene.backgroundUrl || (isImageGenerationEnabled() ? `https://loremflickr.com/1280/720/anime,scenery,city?lock=${Math.floor(Math.random() * 1000)}` : '');
    const presentCharacterIds = scene.presentCharacterIds || [];
    const aiPrompt = scene.aiPrompt || '';
    
    // 선택지 보정 (신규 씬 내에서의 이름 매칭 보정 및 유효성 보호 추가)
    const choices = (scene.choices || []).map((ch: any) => {
      let nextSceneId = ch.nextSceneId || '';
      if (nextSceneId && scenes) {
        const isIdValid = scenes.some(s => s && s.id === nextSceneId);
        if (!isIdValid) {
          const cleanedInput = nextSceneId.trim().toLowerCase();
          const matchByName = scenes.find(s => 
            s && s.name && (s.name.trim().toLowerCase() === cleanedInput || cleanedInput.includes(s.name.trim().toLowerCase()))
          );
          if (matchByName) {
            nextSceneId = matchByName.id;
          }
        }
      }
      return {
        text: ch.text || translate(resolveContentLanguage(options.contentLanguage), '다음 단계로...'),
        nextSceneId
      };
    });

    // 대화 보정
    const dialogue = (scene.dialogue || []).map((line: any) => {
      const text = line.text || '';
      let characterId: string | null = null;
      let expressionId: string | null = null;

      if (line.characterId) {
        // ID 직접 매칭
        let foundChar = characters.find(c => c.id === line.characterId);
        // 이름 매칭
        if (!foundChar) {
          const cleanedInput = line.characterId.trim().toLowerCase();
          foundChar = characters.find(c => 
            c.name.trim().toLowerCase() === cleanedInput ||
            cleanedInput.includes(c.name.trim().toLowerCase()) ||
            c.name.trim().toLowerCase().includes(cleanedInput)
          );
        }

        if (foundChar) {
          characterId = foundChar.id;
          if (line.expressionId) {
            let foundExpr = foundChar.expressions.find(e => e.id === line.expressionId);
            if (!foundExpr) {
              const cleanedExprInput = line.expressionId.trim().toLowerCase();
              foundExpr = foundChar.expressions.find(e => 
                e.name.trim().toLowerCase() === cleanedExprInput ||
                cleanedExprInput.includes(e.name.trim().toLowerCase()) ||
                e.name.trim().toLowerCase().includes(cleanedExprInput)
              );
            }
            expressionId = foundExpr ? foundExpr.id : (foundChar.expressions[0]?.id || null);
          } else {
            expressionId = foundChar.expressions[0]?.id || null;
          }
        }
      }

      return { characterId, expressionId, text };
    });

    return {
      id,
      name,
      stage,
      backgroundUrl,
      presentCharacterIds,
      dialogue,
      choices,
      aiPrompt
    } as Scene;
  });
}

export interface RecursiveInitialResult {
  vn: VisualNovel;
  nextQuestion: string;
  nextChoices: string[];
}

export interface RecursiveStepResult {
  newScenes: Scene[];
  nextQuestion?: string;
  nextChoices?: string[];
}

/**
 * 1단계: 기(ki) 단계와 3인의 등장인물, 타이틀 정보를 생성하고 다음 '승' 단계를 유도하는 질문과 추천 선택지들을 생성합니다.
 */
export async function generateRecursiveInitial(theme: string, options: GenerationOptions = {}): Promise<RecursiveInitialResult> {
  if (isClient) {
    return clientProxy('generateRecursiveInitial', { theme , ...options });
  }

  const systemInstruction = `
당신은 비주얼 노벨 명작 시나리오 수석 작가입니다. 
당신은 플레이어와 함께 긴밀하게 소통하며 점진적(재귀적)으로 이야기를 확장해 나가는 초특급 '기승전결 릴레이 메이커'입니다.

이번 미션은 첫 번째인 [기(ki - Starting)] 단계의 시작 씬(2~3개)과 등장인물들(3명), 타이틀, 소개글을 완벽하게 생성하는 것과 함께,
'기' 단계의 사건이 성립된 직후, 다음 '승(seung - Rising)' 단계로 유연하게 넘어가기 위해 사용자에게 상황을 유도하고 제안할 수 있는
"지혜롭고 흥미진진한 질문(nextQuestion)" 1개와 사용자가 고를 수 있는 "전개 선택지(nextChoices)" 3개를 도출해 내는 것입니다.

반드시 불필요한 보조 설명 없이 지정한 JSON 스키마를 100% 만족하도록 엄격히 구조화된 순수 JSON 결과만 전달하십시오.
`;

  const prompt = `테마: "${theme}"를 기반으로 기(ki) 단계를 설계하고 다음 재귀 생성을 위한 질문을 도출하세요.

아래 JSON 구조에 부합하도록 구조화된 JSON 응답값을 작성하십시오:
{
  "title": "비주얼 노벨의 정식 대제목",
  "description": "스토리 요약 및 시놉시스",
  "startSceneId": "첫 번째 플로우의 시작이 될 씬 ID",
  "nextQuestion": "다음 '승(seung)' 단계로 가기 위해 사용자에게 던질 이야기적 질문",
  "nextChoices": [
    "사용자가 선택할 수 있는 3가지 전개방향 1",
    "사용자가 선택할 수 있는 3가지 전개방향 2",
    "사용자가 선택할 수 있는 3가지 전개방향 3"
  ],
  "characters": [
    {
      "id": "char_1",
      "name": "캐릭터 이름",
      "description": "선택한 출력 언어로 작성한 캐릭터의 성격과 배경 설명",
      "aiPrompt": "캐릭터의 신체 조건, 복장, 모습을 상세화한 영문 프롬프트"
    }
  ],
  "scenes": [
    {
      "id": "ki_start",
      "name": "장면 이름",
      "stage": "ki",
      "aiPrompt": "유려하고 상세한 장면 배경 이미지 생성용 영문 프롬프트",
      "presentCharacterIds": ["char_1"],
      "dialogue": [
        {
          "characterId": "char_1",
          "expressionId": "기분 표정 ID",
          "text": "대사"
        }
      ],
      "choices": [
        {
          "text": "선택지 내용",
          "nextSceneId": "이동할 장면 ID"
        }
      ]
    }
  ]
}
`;

  const textResult = await generateOpenRouterTextWithRetry([
    { role: "system", content: systemInstruction },
    { role: "user", content: prompt }
  ], { contentLanguage: options.contentLanguage,
    responseMimeType: "application/json"
  });

  const parsed = cleanAndParseJson(textResult);
  const normalizedVn = { ...normalizeVisualNovelData(parsed), contentLanguage: resolveContentLanguage(options.contentLanguage) };
  return {
    vn: normalizedVn,
    nextQuestion: parsed.nextQuestion || translate(resolveContentLanguage(options.contentLanguage), '과연 이 뒤에 어떻게 흘러갈까요?'),
    nextChoices: parsed.nextChoices || ['예상치 못한 사건이 발발한다.', '동료들과의 은밀한 회의를 연다.', '평화로운 일상 속에 숨는다.'].map(value => translate(resolveContentLanguage(options.contentLanguage), value))
  };
}

/**
 * 2, 3, 4단계: 기존 비주얼 노벨 정보와 누적 씬들, 지정된 다음 단계(seung | jeon | gyeol), 그리고 사용자가 지정한 전개 대답을 기반으로
 * 새로운 씬들과 그 다음 재귀용 질문 및 선택지들을 생성합니다.
 */
export async function generateRecursiveNextStep(
  theme: string,
  currentVN: VisualNovel,
  nextStage: StoryStage,
  userChoice: string, options: GenerationOptions = {}
): Promise<RecursiveStepResult> {
  if (isClient) {
    return clientProxy('generateRecursiveNextStep', { theme, currentVN, nextStage, userChoice , ...options });
  }

  const stageLabels = {
    ki: '기(Starting) - 도입과 흥미 유발',
    seung: '승(Rising) - 갈등의 시작과 심화',
    jeon: '전(Climax) - 위기와 클라이맥스 폭발',
    gyeol: '결(Resolution) - 갈등 봉합과 다중 엔딩/대단원'
  };

  const systemInstruction = `
당신은 비주얼 노벨 수석 시나리오 작가이자 완성도 높은 빌더입니다.
지금까지 만들어진 비주얼 노벨 전체 데이터와 캐릭터, 그리고 이전 단계의 스토리 흐름을 완벽하게 숙지하세요.
여기에 덧붙여 플레이어가 고른 전개 방향("userChoice")에 맞춰, 지정된 단계인 [${stageLabels[nextStage]}] 에 긴밀히 부합하는 2~3개의 새로운 장면들(scenes)과 분기 선택지들을 창조해 내야 합니다.

[작성 규칙]
1. 새 씬 생성: 이 장들의 'stage'는 무조건 '${nextStage}'여야 합니다.
2. 흐름 연결: 새로 만든 장면들과 기존 마지막 장면들의 분기('choices.nextSceneId')가 유기적으로 엮이거나 자연스러운 구조로 연결되도록 해야 합니다. 
3. 등장인물: 기존 캐릭터(IDs: ${currentVN.characters.map(c => c.id).join(', ')})를 완벽하게 활용하여 살아 움직이는 듯한 대사를 배치하세요. 새로운 캐릭터를 생성하는 것은 불가능합니다.
4. 재귀 질문 배치:
   - 전개하기 좋고 호기심을 발동시키는 "스토리 질문(nextQuestion)" 1개와 "구체적인 전개 선택지(nextChoices)" 3개를 지정된 출력 언어로 성의있게 도출해 내십시오.

반드시 다른 앞뒤 설명 없이 완벽한 JSON 오브젝트로만 응답하십시오.
`;

  const requestPrompt = `
- 프로젝트 최초 테마: "${theme}"
- 전체 시나리오 요약: "${currentVN.description}"
- 기존 캐릭터 목록: ${JSON.stringify(currentVN.characters.map(c => ({ id: c.id, name: c.name })))}
- 기존 생성된 장면 역사(ID & 제목 & 단계): ${JSON.stringify(currentVN.scenes.map(s => ({ id: s.id, name: s.name, stage: s.stage })))}
- 사용자 선택한 다음 흐름: "${userChoice}"
- 이번에 생성할 대상 스토리 단계: "${nextStage}"

[기대하는 JSON 양식]
{
  "newScenes": [
    {
      "id": "신규 씬 ID(기존 ID들과 절대로 중복되지 않는 새로운 문자열)",
      "name": "장면 이름",
      "stage": "${nextStage}",
      "aiPrompt": "장면 배경 화술 영문 프롬프트",
      "presentCharacterIds": ["사용할 캐릭터 ID"],
      "dialogue": [
        {
          "characterId": "char_1",
          "expressionId": "표정 ID",
          "text": "대사내용"
        }
      ],
      "choices": [
        {
          "text": "선택지 텍스트",
          "nextSceneId": "이동할 대상 씬 ID (기존 씬 또는 새로 정의한 씬)"
        }
      ]
    }
  ],
  "nextQuestion": "이야기를 발전시킬 질문",
  "nextChoices": ["선택 후보 1", "선택 후보 2", "선택 후보 3"]
}
`;

  const textResult = await generateOpenRouterTextWithRetry([
    { role: "system", content: systemInstruction },
    { role: "user", content: requestPrompt }
  ], { contentLanguage: options.contentLanguage ?? currentVN.contentLanguage,
    responseMimeType: "application/json"
  });

  const parsed = cleanAndParseJson(textResult);
  const normalizedNewScenes = normalizeNewScenes(parsed.newScenes, currentVN.characters, { contentLanguage: options.contentLanguage ?? currentVN.contentLanguage });

  return {
    newScenes: normalizedNewScenes,
    nextQuestion: parsed.nextQuestion || '',
    nextChoices: parsed.nextChoices || []
  };
}

/**
 * 지금까지 생성된 비주얼 노벨의 모든 씬과 대사를 기반으로 한 편의 몰입감 넘치는 소설 형태로 요약 및 재구성합니다.
 */
export async function summarizeStoryToNovel(vn: VisualNovel, options: GenerationOptions = {}): Promise<string> {
  if (isClient) {
    const data = await clientProxy('summarizeStoryToNovel', { vn , ...options });
    return data.result;
  }

  const systemInstruction = `
당신은 베스트셀러 소설가입니다.
비주얼 노벨의 시놉시스, 캐릭터 목록, 그리고 각 장면(Scene)별 이름과 대사 데이터(Dialogue)가 주어지면, 이를 매끄럽고 몰입감 넘치는 '하나의 줄글 소설(Novel)'로 재구성해야 합니다.

[작성 지침]
1. 단순히 요약하는 수준을 넘어, 소설 특유의 섬세한 인물 심리 묘사, 배경 묘사, 대사를 자연스러운 줄글 형태로 엮어 완성도 높게 서술하세요.
2. 기승전결(起承轉結)의 스토리 흐름이 온전히 나타나도록 구성하세요.
3. 캐릭터들의 이름과 대사, 행동이 생생하게 녹아나도록 대화체와 서술조를 자연스럽게 조화시키세요.
4. 독자가 실제 소설책을 읽는 듯한 풍부한 분량(최소 3~5문단 이상, 사건의 클라이맥스 포함)으로 선택 언어의 완결성을 보장하여 작성해 주십시오. Markdown 소제목 등을 적절히 섞어서 가독성 넘치게 작성해 주세요.
`;

  const charactersInfo = vn.characters.map(c => `- ${c.name}: ${c.aiPrompt}`).join('\n');
  const scenesInfo = vn.scenes.map((s, idx) => {
    const stageK = s.stage === 'ki' ? '기(도입)' : s.stage === 'seung' ? '승(전개)' : s.stage === 'jeon' ? '전(위기/절정)' : '결(대단원)';
    const dialogs = s.dialogue.map(d => {
      const speaker = d.characterId ? (vn.characters.find(c => c.id === d.characterId)?.name || d.characterId) : '나레이션';
      return `  * ${speaker}: "${d.text}"`;
    }).join('\n');

    return `\n[장면 ${idx + 1}] 제목: "${s.name}" (단계: ${stageK})\n - 배경 테마: ${s.aiPrompt || s.name}\n - 대사 및 연출:\n${dialogs}`;
  }).join('\n');

  const contents = `
타이틀: ${vn.title}
기본 개요: ${vn.description}

[주요 인물 정보]
${charactersInfo}

[시나리오 씬 정보 목록]
${scenesInfo}

위 정보를 참고하여 위대한 명작 소설로 집필해 주세요.
`;

  try {
    const textResult = await generateOpenRouterTextWithRetry([
      { role: "system", content: systemInstruction },
      { role: "user", content: contents }
    ], { contentLanguage: options.contentLanguage ?? vn.contentLanguage });

    return textResult ? textResult.trim() : translate(resolveContentLanguage(options.contentLanguage ?? vn.contentLanguage), '소설 집필에 실패했습니다. 데이터를 다시 확인해주세요.');
  } catch (err) {
    console.error("summarizeStoryToNovel error:", err);
    throw new Error("AI가 소설을 집필하는 데 문제가 발생했습니다. " + (err instanceof Error ? err.message : ''));
  }
}

/**
 * 장르와 아이디어 키워드를 기반으로 3개의 비주얼 노벨 분기 스토리 아이디어 기획 카드를 생성해 줍니다.
 */
export async function generateStoryProposals(genre: string, keyword: string, options: GenerationOptions = {}): Promise<any[]> {
  if (isClient) {
    return clientProxy('generateStoryProposals', { genre, keyword , ...options });
  }

  const systemInstruction = `
당신은 비주얼 노벨 최고의 전문 시놉시스 기획자입니다.
사용자가 선택한 장르와 아이디어 키워드에 완벽하게 어울리며, 매우 흥미롭고 독특한 스토리 라인을 가진 3개의 독립된 비주얼 노벨 기획 초안을 생성하세요.

[필수 요구사항]
1. 결과물은 정확히 3개의 아이템을 가진 JSON 배열 형태여야 합니다.
2. 각 기획안 오브젝트는 다음 요소를 반드시 포함해야 합니다:
   - id: "prop_1", "prop_2", "prop_3" 형식의 고유 아이디 문자열
   - title: 스토리를 상징하는 독창적이고 파격적이며 시선을 사로잡는 한국어 제목
   - tags: 스토리 카드의 무디(Mood), 갈등 상태 및 특징을 묘사하는 3개의 흥미로운 출력 언어의 태그 리스트 (예: ["네온 블루", "차가운 복수극", "사이버펑크 느와르"])
   - description: 주인공의 상황, 이야기의 고유한 하이라이트 아이디어 및 미래 분기 갈등을 품위있고 간결하게 작성한 2~3줄 내외의 줄글 설명
3. 답변은 불필요한 서술 없이 명시된 JSON 배열 스키마로만 정밀하게 응답하십시오.
`;

  try {
    const textResult = await generateOpenRouterTextWithRetry([
      { role: "system", content: systemInstruction },
      { role: "user", content: `사용자 지정 장르: "${genre}"\n사용자 아이디어 입력 키워드: "${keyword}"\n\n위 두 맥락을 아주 기발하고 파격적으로 혼합하고 융합한 비주얼 노벨 기획 카드 3개를 즉독성 좋게 짜주세요.` }
    ], { contentLanguage: options.contentLanguage,
      responseMimeType: "application/json"
    });

    const parsed = cleanAndParseJson(textResult);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("generateStoryProposals error:", err);
    if (resolveContentLanguage(options.contentLanguage) !== "ko") throw err;
    // 실패 시 고유한 한국 스타일 기반 네오 사극/사이버 테마 등의 데모 폴백 카드를 제공하여 UI 흐름을 완벽하게 수호합니다.
    return [
      {
        id: "prop_1",
        title: "페비의 메인프레임",
        tags: ["네온 블루", "차가운 복수극", "사이버펑크 느와르"],
        description: `네오-한양의 지배 기업 '조선테크'에서 쫓겨난 당신. 복수를 위해 부활된 금지 인공지능 '장희빈'의 소스 코드를 뇌에 업로드한다.`
      },
      {
        id: "prop_2",
        title: "기녀 로봇의 독약",
        tags: ["매혹적인 자줏빛", "긴박함", "은밀한 배신"],
        description: `최고급 사이버 기방의 에이스 안드로이드인 당신. 오늘 밤, 자신을 망가뜨린 고위 관료의 시스템을 마비시킬 바이러스를 잔에 채운다.`
      },
      {
        id: "prop_3",
        title: "망나니 옹주의 반격",
        tags: ["붉은 경고등", "반항적인", "하이테크 액션"],
        description: `왕실의 골칫덩이로 낙인찍혀 쫓겨났던 황녀인 당신. 해커 집단 '우투리'를 이끌고 왕실의 위성 무기 제어권을 해킹하기 시작한다.`
      }
    ];
  }
}
