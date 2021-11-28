import express from 'express';
import Fuse from 'fuse.js';
import fs from 'fs';
import Geode from 'geode';

const router = express.Router();


// TO BE DEPRECATED
const cities = JSON.parse(fs.readFileSync('./city.list.json', { encoding: 'UTF-8' }));
const fuse = new Fuse(cities, { keys: ['name', 'country', 'id'] })
router.get('/:q', (req, res) => {
  if (!req.params.q) return res.status(400).json({ message: "specifica una stringa di ricerca" });
  const result = fuse.search(req.params.q).splice(0, 10);
  res.json(result);
})
// END OF DEPRECATED

router.get('/geo/:q', (req, res) => {
  if (!req.params.q) return res.status(400).json({ message: "specifica una stringa di ricerca" });
  // Here because we're later going to accept other languages
  const geo = new Geode('alenygam', {language: 'it'});
  geo.search({q: req.params.q, maxRows: 10, cities: 'cities500'}, (err, results) => {
    if (err) return res.status(400).json({message: err.message});
    res.json(results.geonames);
  })
})

export default router;
