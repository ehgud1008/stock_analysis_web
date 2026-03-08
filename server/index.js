import express from 'express';
import { MongoClient, ObjectId } from 'mongodb';

// ── 환경 변수 ────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGO_DB || 'stock_analysis';
const COLLECTION = process.env.MONGO_COLLECTION || 'analysis_history';

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

// ── 비교 분석 기록 (/api/compare) ─────────────────────────
const COMPARE_COLLECTION = 'compare_history';
function getCompareCollection() {
  return db.collection(COMPARE_COLLECTION);
}

// 전체 조회 (최신순)
app.get('/api/compare', async (req, res) => {
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
app.post('/api/compare', async (req, res) => {
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
app.delete('/api/compare/:id', async (req, res) => {
  try {
    await getCompareCollection().deleteOne({
      _id: new ObjectId(req.params.id),
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 서버 시작 ────────────────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 History API 서버: http://localhost:${PORT}`);
  });
});
