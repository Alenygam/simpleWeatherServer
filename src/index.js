import express from 'express';
import search from './search.js';
import weather from './weather.js';

var app = express();

app.use('/search', search);
app.use('/weather', weather);

app.listen(4000, () => {
  console.log('Funzionando su porta 4000');
})
