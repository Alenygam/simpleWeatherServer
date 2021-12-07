import express from 'express';
import fetch from 'node-fetch';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

const router = express.Router();
const appId = process.env.appIdOpenWeatherMap;

const acceptableUnitTypes = [
  "metric",
  "imperial"
]

router.get('/:cityID/:unit', getDataFromApi, elaborateData);
router.get('/geo/:lat/:lon/:unit', getDataFromApiGeo, elaborateData);

async function getDataFromApiGeo(req, res, next) {
  if (!req.params.lat) return res.status(400).json({ message: "specifica una latitudine" });
  if (!req.params.lon) return res.status(400).json({ message: "specifica una longitudine" });
  if (!acceptableUnitTypes.includes(req.params.unit)) return res.status(400).json({message: "Imposta un tipo di unità valido"});
  const lat = encodeURIComponent(req.params.lat);
  const lon = encodeURIComponent(req.params.lon);
  const unit = encodeURIComponent(req.params.unit);

  var currentRes = fetch(
    `https://api.openweathermap.org/data/2.5/weather?appid=${appId}&lang=it&units=${unit}&lat=${lat}&lon=${lon}`
  )
  var forecastRes = fetch(
    `https://api.openweathermap.org/data/2.5/forecast?appid=${appId}&lang=it&lat=${lat}&lon=${lon}&units=${unit}`
  )

  currentRes = await currentRes;
  forecastRes = await forecastRes;

  if (!forecastRes.ok) {
    const json = await forecastRes.json();
    return res.status(400).json({ message: json.message });
  }
  if (!currentRes.ok) {
    const json = await currentRes.json();
    return res.status(400).json({ message: json.message });
  }

  req.currentFromApi = await currentRes.json();
  req.forecastFromApi = await forecastRes.json();

  next();
}

async function getDataFromApi(req, res, next) {
  if (!req.params.cityID) return res.status(400).json({ message: "specifica una città" });
  if (!acceptableUnitTypes.includes(req.params.unit)) return res.status(400).json({ message: "Imposta un tipo di unità valido" });
  const cityId = encodeURIComponent(req.params.cityID);
  const unit = encodeURIComponent(req.params.unit);

  var currentRes = fetch(
    `https://api.openweathermap.org/data/2.5/weather?appid=${appId}&lang=it&units=${unit}&id=${cityId}`
  )

  var forecastRes = fetch(
    `https://api.openweathermap.org/data/2.5/forecast?appid=${appId}&lang=it&id=${cityId}&units=${unit}`
  )

  currentRes = await currentRes;
  forecastRes = await forecastRes;

  if (!forecastRes.ok) {
    const json = await forecastRes.json();
    return res.status(400).json({ message: json.message });
  }

  if (!currentRes.ok) {
    const json = await currentRes.json();
    return res.status(400).json({ message: json.message });
  }

  req.currentFromApi = await currentRes.json();
  req.forecastFromApi = await forecastRes.json();

  next();
}

function elaborateData(req, res) {
  const forecastFromApi = req.forecastFromApi;
  const currentFromApi = req.currentFromApi;

  // A weird edge case could be that the city's
  // timezone is between UTC -00:17 and UTC +00:17
  // in which case dayjs will treat the numbers like hours.

  // There is no city with that time zone. I checked.
  // https://24timezones.com/time-zones
  const timeZone = forecastFromApi.city.timezone / 60;
  const response = {
    current: elaborateCurrentData(currentFromApi),
    hourly: elaborateHourlyData(forecastFromApi, timeZone),
    daily: elaborateDailyData(forecastFromApi, timeZone)
  };

  res.json(response);
}

function elaborateCurrentData(currentFromApi) {
  return {
    id: currentFromApi.weather[0].id,
    main: currentFromApi.weather[0].main,
    description: currentFromApi.weather[0].description,
    icon: currentFromApi.weather[0].icon,
    temp: Math.round(currentFromApi.main.temp),
    pressure: currentFromApi.main.pressure,
    humidity: currentFromApi.main.humidity,
  };
}

function elaborateHourlyData(forecastFromApi, timeZone) {
  const hourly = [];

  // Get first 4 * 3 hours of forecast.
  for (let i = 0; i < 4; i++) {
    const hourForecast = forecastFromApi.list[i];
    const timeOfForecast = dayjs
      .utc(new Date(hourForecast.dt * 1000))
      .utcOffset(timeZone)
      .format('HH:mm');
    hourly.push({
      time: timeOfForecast,
      temp: Math.round(hourForecast.main.temp),
      id: hourForecast.weather[0].id,
      main: hourForecast.weather[0].main,
      description: hourForecast.weather[0].description,
      icon: hourForecast.weather[0].icon
    })
  }

  return hourly;
}

function elaborateDailyData(forecastFromApi, timeZone) {
  const daily = {};

  const currentDayDate = dayjs()
        .utc(new Date())
        .utcOffset(timeZone)
        .format('DD/MM/YYYY');

  for (let forecast of forecastFromApi.list) {
    const dayOfForecast = dayjs
      .utc(new Date(forecast.dt * 1000))
      .utcOffset(timeZone)
      .format('DD/MM/YYYY');
    if (dayOfForecast === currentDayDate) continue;

    const timeOfForecast = dayjs
      .utc(new Date(forecast.dt * 1000))
      .utcOffset(timeZone)
      .format('HH:mm');

    if (!daily[dayOfForecast]) {
      daily[dayOfForecast] = [];
    }
    daily[dayOfForecast].push({
      time: timeOfForecast,
      temp: Math.round(forecast.main.temp),
      id: forecast.weather[0].id,
      main: forecast.weather[0].main,
      description: forecast.weather[0].description,
      icon: forecast.weather[0].icon
    })
  }

  return daily;
}

export default router;
