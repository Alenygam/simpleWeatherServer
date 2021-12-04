import express from 'express';
import Geode from 'geode';

const router = express.Router();

router.get('/geo/:q', search);
router.get('/geo/:q/:lang', search);

function search(req, res) {
  if (!req.params.q) return res.status(400).json({ message: "specifica una stringa di ricerca" });
  if (!req.params.lang) req.params.lang = "it";
  var geo;
  try {
    geo = new Geode('alenygam', { language: req.params.lang });
  } catch (err) {
    console.error(err);
    return res.status(400).json({message: err.message});
  }
  geo.search({ q: req.params.q, maxRows: 10, cities: 'cities500' }, (err, results) => {
    if (err) return res.status(400).json({ message: err.message });
    res.json(results.geonames);
  })
}

export default router;
