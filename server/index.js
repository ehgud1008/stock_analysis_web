import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 환경 변수 ────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB || 'stock_analysis';
const COLLECTION = process.env.MONGO_COLLECTION || 'analysis_history';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// ── MongoDB 연결 ─────────────────────────────────────────
let db;
const client = new MongoClient(MONGO_URI);

async function connectDB() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    console.log(`✅ MongoDB 연결 성공 (${DB_NAME})`);
  } catch (err) {
    console.error('❌ MongoDB 연결 실패:', err.message);
    process.exit(1);
  }
}

function getCollection() {
  return db.collection(COLLECTION);
}

// ── Express 서버 ─────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '5mb' }));

// 전체 조회 (최신순)
app.get('/api/history', async (req, res) => {
  try {
    const records = await getCollection()
      .find({})
      .sort({ analyzedAt: -1 })
      .limit(200)
      .toArray();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 단건 조회
app.get('/api/history/:id', async (req, res) => {
  try {
    const record = await getCollection().findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!record) return res.status(404).json({ error: 'Not found' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 저장
app.post('/api/history', async (req, res) => {
  try {
    const entry = {
      ...req.body,
      analyzedAt: new Date().toISOString(),
    };
    const result = await getCollection().insertOne(entry);
    res.status(201).json({ ...entry, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 단건 삭제
app.delete('/api/history/:id', async (req, res) => {
  try {
    await getCollection().deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 전체 삭제
app.delete('/api/history', async (req, res) => {
  try {
    await getCollection().deleteMany({});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 비교 분석 기록 (/serv/compare) ─────────────────────────
const COMPARE_COLLECTION = 'compare_history';
function getCompareCollection() {
  return db.collection(COMPARE_COLLECTION);
}

// 전체 조회 (최신순)
app.get('/serv/compare', async (req, res) => {
  try {
    const records = await getCompareCollection()
      .find({})
      .sort({ analyzedAt: -1 })
      .limit(100)
      .toArray();
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 저장
app.post('/serv/compare', async (req, res) => {
  try {
    const entry = {
      ...req.body,
      analyzedAt: new Date().toISOString(),
    };
    const result = await getCompareCollection().insertOne(entry);
    res.status(201).json({ ...entry, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 단건 삭제
app.delete('/serv/compare/:id', async (req, res) => {
  try {
    await getCompareCollection().deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Gemini AI 분석 (/api/ai) ──────────────────────────────

// AI 단일 종목 분석
app.post('/api/ai/analyze', async (req, res) => { debugger
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt가 필요합니다.' });
  }

  try {
    const md = readFileSync(join(__dirname, '..', 'public', 'prompt.md'), 'utf-8');
    const sysMatch = md.match(/## 시스템 설정\s*\n([\s\S]*?)(?=\n---)/);
    const systemInstruction = sysMatch ? sysMatch[1].trim() : '';
    const instrIdx = md.indexOf('## 분석 지시사항');
    const analysisInstructions = instrIdx >= 0 ? md.slice(instrIdx).trim() : '';
    const fullUserPrompt = prompt + '\n\n' + analysisInstructions;

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: fullUserPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini 응답에서 텍스트를 추출할 수 없습니다.');

    return res.json({ text });
  } catch (err) {
    return res.status(500).json({ error: `AI 분석 실패: ${err.message}` });
  }
});

// AI 비교 분석
app.post('/api/ai/compare', async (req, res) => { debugger
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' });
  }

  const { stocksJson } = req.body;
  if (!stocksJson) {
    return res.status(400).json({ error: 'stocksJson이 필요합니다.' });
  }

  try {
    const md = readFileSync(join(__dirname, '..', 'public', 'prompt_compare.md'), 'utf-8');
    const sysMatch = md.match(/## 시스템 설정\s*\n([\s\S]*?)(?=\n────)/);
    const systemInstruction = sysMatch ? sysMatch[1].trim() : '';
    const instrIdx = md.indexOf('## 비교 분석 지시사항');
    const compareInstructions = instrIdx >= 0 ? md.slice(instrIdx).trim() : '';
    const fullUserPrompt = stocksJson + '\n\n' + compareInstructions;

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [{ parts: [{ text: fullUserPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error?.message || `Gemini API 오류: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini 응답에서 텍스트를 추출할 수 없습니다.');

    return res.json({ text });
  } catch (err) {
    return res.status(500).json({ error: `비교 분석 실패: ${err.message}` });
  }
});

// ── 서버 시작 ────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 History API 서버: http://localhost:${PORT}`);
  });
});

