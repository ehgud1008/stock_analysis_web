import { readFileSync } from 'fs';
import { join } from 'path';
import compareResponseSchema from '../../lib/compareSchema.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function loadComparePromptMd() {
  return readFileSync(join(process.cwd(), 'public', 'prompt_compare.md'), 'utf-8');
}

function parseComparePromptMd(md) {
  const sysMatch = md.match(/## 시스템 설정\s*\n([\s\S]*?)(?=\n────)/);
  const systemInstruction = sysMatch ? sysMatch[1].trim() : '';

  const instrIdx = md.indexOf('## 비교 분석 지시사항');
  const compareInstructions = instrIdx >= 0 ? md.slice(instrIdx).trim() : '';

  return { systemInstruction, compareInstructions };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  const { stocksJson } = req.body;
  if (!stocksJson) {
    return res.status(400).json({ error: 'stocksJson이 필요합니다.' });
  }

  try {
    const md = loadComparePromptMd();
    const { systemInstruction, compareInstructions } = parseComparePromptMd(md);
    const fullUserPrompt = stocksJson + '\n\n' + compareInstructions;

    const response = await fetch(
      `${GEMINI_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: [
            {
              parts: [{ text: fullUserPrompt }],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 65536,
            responseMimeType: 'application/json',
            responseSchema: compareResponseSchema,
          },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();

    const finishReason = data.candidates?.[0]?.finishReason;
    console.log('📋 [비교분석] finishReason:', finishReason);

    if (finishReason && finishReason !== 'STOP') {
      const reasonMsg = {
        MAX_TOKENS: 'AI 응답이 토큰 한도로 중간에 잘렸습니다.',
        SAFETY: 'AI 안전 필터에 의해 응답이 차단되었습니다.',
        RECITATION: '저작권 관련 필터에 의해 응답이 차단되었습니다.',
      };
      throw new Error(reasonMsg[finishReason] || `AI 응답이 비정상 종료되었습니다 (${finishReason}). 다시 시도해 주세요.`);
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini 응답에서 텍스트를 추출할 수 없습니다.');
    }

    // JSON 파싱 검증
    try {
      JSON.parse(text);
    } catch (parseErr) {
      console.error('⚠️ [비교분석] Gemini가 불완전한 JSON을 반환:', text.slice(-200));
      throw new Error('AI 응답이 불완전한 JSON입니다. 다시 시도해 주세요.');
    }

    return res.json({ text });
  } catch (err) {
    return res.status(500).json({ error: `비교 분석 요청 실패: ${err.message}` });
  }
}

