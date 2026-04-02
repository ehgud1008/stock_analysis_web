import { readFileSync } from 'fs';
import { join } from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

function loadPromptMd() {
  return readFileSync(join(process.cwd(), 'public', 'prompt.md'), 'utf-8');
}

function parsePromptMd(md) {
  const sysMatch = md.match(/## 시스템 설정\s*\n([\s\S]*?)(?=\n---)/);
  const systemInstruction = sysMatch ? sysMatch[1].trim() : '';

  const instrIdx = md.indexOf('## 분석 지시사항');
  const analysisInstructions = instrIdx >= 0 ? md.slice(instrIdx).trim() : '';

  return { systemInstruction, analysisInstructions };
}

export default async function handler(req, res) {  debugger
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt가 필요합니다.' });
  }

  try {
    const md = loadPromptMd();
    const { systemInstruction, analysisInstructions } = parsePromptMd(md);
    const fullUserPrompt = prompt + '\n\n' + analysisInstructions;

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
            maxOutputTokens: 8192,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();

    // 응답이 토큰 한도로 잘렸는지 확인
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS') {
      throw new Error('AI 응답이 너무 길어 중간에 잘렸습니다. 다시 시도해 주세요.');
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini 응답에서 텍스트를 추출할 수 없습니다.');
    }

    return res.json({ text });
  } catch (err) {
    return res.status(500).json({ error: `AI 분석 요청 실패: ${err.message}` });
  }
}
