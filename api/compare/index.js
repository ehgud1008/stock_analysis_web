import getDb from '../_db.js';

export default async function handler(req, res) {
  const db = await getDb();
  const collection = db.collection('compare_history');

  try {
    if (req.method === 'GET') {
      const records = await collection
        .find({})
        .sort({ analyzedAt: -1 })
        .limit(100)
        .toArray();
      return res.json(records);
    }

    if (req.method === 'POST') {
      const entry = { ...req.body, analyzedAt: new Date().toISOString() };
      const result = await collection.insertOne(entry);
      return res.status(201).json({ ...entry, _id: result.insertedId });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
