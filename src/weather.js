import express from 'express';
import fetch from 'node-fetch';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

const router = express.Router();
const appId = process.env.appIdOpenWeatherMap;

router.get('/:cityID', getDataFromApi, elaborateData)

async function getDataFromApi(req, res, next) {
  if (!req.params.cityID) return res.status(400).json({ message: "specifica una città" });
  const cityId = encodeURIComponent(req.params.cityID);

  const currentRes = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?appid=${appId}&lang=it&units=metric&id=${cityId}`
  )
  if (!currentRes.ok) {
    const json = await currentRes.json();
    return res.status(400).json({ message: json.message });
  }

  const forecastRes = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?appid=${appId}&lang=it&units=metric&id=${cityId}`
  )
  if (!forecastRes.ok) {
    const json = await forecastRes.json();
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
  const daily = [];

  let scannedForecasts = [];
  const currentDayDate = dayjs()
        .utc(new Date())
        .utcOffset(timeZone)
        .format('DD/MM/YYYY');
  var prevDayDate;

  for (let forecast of forecastFromApi.list) {
    const dayOfForecast = dayjs
      .utc(new Date(forecast.dt * 1000))
      .utcOffset(timeZone)
      .format('DD/MM/YYYY');
    if (dayOfForecast === currentDayDate) continue;

    // The second condition is to account for the first few passes
    // of this function where the forecast is of the same day as
    // the current one.
    if (dayOfForecast !== prevDayDate && scannedForecasts.length > 0) {
      const [
        highestTemperature,
        lowestTemperature
      ] = getHighestAndMinimumTemperature(scannedForecasts);

      const weather = getPrioritisedWeather(scannedForecasts);
      // Replace eventual night icon with day icon.
      weather.icon = weather.icon.replace(/n/g, 'd');

      daily.push({
        date: prevDayDate,
        hightemp: highestTemperature,
        lowtemp: lowestTemperature,
        ...weather
      })

      scannedForecasts = [];
    }

    prevDayDate = dayOfForecast;
    scannedForecasts.push({
      temp: forecast.main.temp,
      weather: forecast.weather[0]
    })
  }

  return daily;
}

function getHighestAndMinimumTemperature(scannedForecasts) {
  let high = 0;
  let low = Infinity;

  for (let forecast of scannedForecasts) {
    if (forecast.temp < low) {
      low = forecast.temp;
    }
    if (forecast.temp > high) {
      high = forecast.temp;
    }
  }

  return [Math.round(high), Math.round(low)];
}

function getPrioritisedWeather(scannedForecasts) {
  scannedForecasts.map((forecast) => {
    const weather = forecast.weather;
    let priorityLevel;
    // https://openweathermap.org/weather-conditions
    // This is how I chose to prioritize different weather conditions
    if (weather.id === 800) {
      priorityLevel = 0;
    } else if (weather.id === 801) {
      priorityLevel = 1.1;
    } else if (weather.id === 802) {
      priorityLevel = 1.2;
    } else if (weather.id === 803) {
      priorityLevel = 1.3;
    } else if (weather.id === 804) {
      priorityLevel = 1.4;
    } else if (700 <= weather.id && weather.id < 782) {
      priorityLevel = 2;
    } else if (300 <= weather.id && weather.id < 322) {
      priorityLevel = 3;
    } else if (500 <= weather.id && weather.id < 532) {
      priorityLevel = 4;
    } else if (200 <= weather.id && weather.id < 233) {
      priorityLevel = 5
    } else if (600 <= weather.id && weather.id < 623) {
      priorityLevel = 6;
    }

    weather.priority = priorityLevel;
    return {
      temp: forecast.temp,
      weather: weather
    }
  });

  const highestPriority = scannedForecasts.reduce(
    (a, b) => b.weather.priority > a.weather.priority ? b : a
  );

  return highestPriority.weather;
}

export default router;
