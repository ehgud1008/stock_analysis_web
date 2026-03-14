import { readFileSync } from 'fs';
import { join } from 'path';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

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
            maxOutputTokens: 4000,
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
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error('Gemini 응답에서 텍스트를 추출할 수 없습니다.');
    }

    return res.json({ text });
  } catch (err) {
    return res.status(500).json({ error: `비교 분석 요청 실패: ${err.message}` });
  }
}
