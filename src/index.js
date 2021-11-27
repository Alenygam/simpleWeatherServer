import fetch from 'node-fetch';
import express from 'express';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import search from './search.js';

dayjs.extend(utc);

var app = express();

const appId = process.env.appIdOpenWeatherMap;

app.use('/search', search);

app.get('/weather/:cityID', async (req, res) => {
  if (!req.params.cityID) return res.status(400).json({message: "specifica una città"});
  const cityId = encodeURIComponent(req.params.cityID);

  const currentRes = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?appid=${appId}&lang=it&units=metric&id=${cityId}`
  )
  if (!currentRes.ok) {
    const json = await currentRes.json();
    return res.status(400).json({message: json.message});
  }

  const forecastRes = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?appid=${appId}&lang=it&units=metric&id=${cityId}`
  )
  if (!forecastRes.ok) {
    const json = await forecastRes.json();
    return res.status(400).json({message: json.message});
  }

  const currentFromApi = await currentRes.json();
  const forecastFromApi = await forecastRes.json();

  // A weird edge case could be that the city's
  // timezone is between UTC -00:17 and UTC +00:17
  // in which case dayjs will treat the numbers like hours.

  // There is no city with that time zone. I checked.
  // https://24timezones.com/time-zones
  const timeZone = forecastFromApi.city.timezone / 60;
  const response = {};

  response["current"] = {
    id: currentFromApi.weather[0].id,
    main: currentFromApi.weather[0].main,
    description: currentFromApi.weather[0].description,
    icon: currentFromApi.weather[0].icon,
    temp: Math.round(currentFromApi.main.temp),
    pressure: currentFromApi.main.pressure,
    humidity: currentFromApi.main.humidity,
  }

  response["hourly"] = [];


  // Get first 4 * 3 hours of forecast.
  for(let i = 0; i < 4; i++) {
    const hourForecast = forecastFromApi.list[i];
    const timeOfForecast = dayjs
          .utc(new Date(hourForecast.dt * 1000))
          .utcOffset(timeZone)
          .format('HH:mm');
    response["hourly"].push({
      time: timeOfForecast,
      temp: Math.round(hourForecast.main.temp),
      id: hourForecast.weather[0].id,
      main: hourForecast.weather[0].main,
      description: hourForecast.weather[0].description,
      icon: hourForecast.weather[0].icon
    })
  }

  response["daily"] = [];

  var byDay = [];
  const nowDay = dayjs().utc(new Date()).format('DD/MM/YYYY');
  var prevDay;

  for(let forecast of forecastFromApi.list) {
    const dayOfForecast = dayjs
          .utc(new Date(forecast.dt * 1000))
          .utcOffset(timeZone)
          .format('DD/MM/YYYY');
    if (dayOfForecast === nowDay) continue;

    // What values should we get
    if (dayOfForecast !== prevDay && byDay.length > 0) {
      let highestTemperature = 0;
      // VERY IMPORTANT FOR MY ALGORITHM TO WORK!
      let lowestTemperature = Infinity;
      // VERY IMPORTANT FOR MY ALGORITHM TO WORK!
      let lowestWeather = Infinity;

      let weather;
      let continueChecking = true;

      for (let day of byDay) {
        if (day.temp < lowestTemperature) {
          lowestTemperature = day.temp;
        }
        if (day.temp > highestTemperature) {
          highestTemperature = day.temp;
        }

        // https://openweathermap.org/weather-conditions
        if (!continueChecking) continue;
        // If snow, stop checking for other things.
        if (day.weather[0].id > 599 && day.weather[0].id < 701) {
          lowestWeather = day.weather[0].id;
          continueChecking = false;
        } else if (day.weather[0].id < lowestWeather) {
          lowestWeather = day.weather[0].id;
        }
      }

      // Get the weather with that id value.
      for (let day of byDay) {
        if (day.weather[0].id === lowestWeather) {
          weather = day.weather[0];
          // Replace eventual nightime icon
          // with its corresponding daytime icon.
          weather.icon = weather.icon.replace(/n/g, 'd');
          break;
        }
      }

      response["daily"].push({
        date: prevDay,
        hightemp: Math.round(highestTemperature),
        lowtemp: Math.round(lowestTemperature),
        ...weather
      })

      byDay = [];
    }
    prevDay = dayOfForecast;
    byDay.push({
      temp: forecast.main.temp,
      weather: forecast.weather
    })
  }

  res.status(200).json(response);
})

app.listen(4000, () => {
  console.log('Funzionando su porta 4000');
})
