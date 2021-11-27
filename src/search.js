import express from 'express';
import Fuse from 'fuse.js';
import fs from 'fs';

const router = express.Router();
const cities = JSON.parse(fs.readFileSync('./city.list.json', { encoding: 'UTF-8' }));
const fuse = new Fuse(cities, { keys: ['name', 'country', 'id'] })

router.get('/:q', (req, res) => {
  if (!req.params.q) return res.status(400).json({ message: "specifica una stringa di ricerca" });
  const result = fuse.search(req.params.q).splice(0, 10);
  res.json(result);
})

export default router;
