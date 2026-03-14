import { ObjectId } from 'mongodb';
import getDb from '../_db.js';

export default async function handler(req, res) {
  const { id } = req.query;
  const db = await getDb();
  const collection = db.collection('compare_history');

  try {
    if (req.method === 'DELETE') {
      await collection.deleteOne({ _id: new ObjectId(id) });
      return res.json({ success: true });
    }

    res.setHeader('Allow', 'DELETE');
    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
