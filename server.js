const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const DEFAULT_PROVINCE = 'กรุงเทพมหานคร';
const geocodeCache = new Map();
const destinationGeocodeCache = new Map();
const photonProvinceCache = new Map();
const PROVINCE_ALIASES = {
  'ตราด': 'Trat',
  'ฉะเชิงเทรา': 'Chachoengsao',
  'นนทบุรี': 'Nonthaburi',
  'พะเยา': 'Phayao',
  'อุบลราชธานี': 'Ubon Ratchathani',
  'หนองคาย': 'Nong Khai',
  'สระบุรี': 'Saraburi',
  'เพชรบุรี': 'Phetchaburi',
  'เพชรบูรณ์': 'Phetchabun',
  'นครนายก': 'Nakhon Nayok',
  'พระนครศรีอยุธยา': 'Phra Nakhon Si Ayutthaya',
  'อ่างทอง': 'Ang Thong',
};

function encodeQuery(params) {
  return new URLSearchParams(params).toString();
}

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`API ตอบ status ${response.status}`);
  return response.json();
}

async function findProvince(province) {
  const query = province.trim() || DEFAULT_PROVINCE;
  const cached = geocodeCache.get(query);
  if (cached) return cached;

  const lookupNames = [...new Set([query, PROVINCE_ALIASES[query]].filter(Boolean))];
  let result;
  for (const lookupName of lookupNames) {
    const data = await getJson(`https://geocoding-api.open-meteo.com/v1/search?${encodeQuery({
      name: lookupName, count: 10, language: lookupName === query ? 'th' : 'en', format: 'json', countryCode: 'TH',
    })}`);
    result = (data.results || []).find(place => place.country_code === 'TH');
    if (result) break;
  }
  if (!result) throw new Error(`ไม่พบจังหวัด "${query}" ในประเทศไทย`);

  const location = { name: query, latitude: result.latitude, longitude: result.longitude, admin1: result.admin1 || result.name };
  geocodeCache.set(query, location);
  return location;
}

function normalizeLocationName(name) {
  return String(name || '').toLocaleLowerCase('th').replace(/[\s-]/g, '');
}

async function findDestination(destination, province) {
  const cacheKey = `${destination}:${province}`;
  const cached = destinationGeocodeCache.get(cacheKey);
  if (cached) return cached;

  const provinceLocation = await findProvince(province);
  let allowedAdminNames = photonProvinceCache.get(province);
  if (!allowedAdminNames) {
    const provinceData = await getJson(`https://photon.komoot.io/api/?${encodeQuery({
      q: `${province}, Thailand`, limit: 10, lang: 'en',
    })}`);
    allowedAdminNames = new Set([
      province,
      provinceLocation.admin1,
      PROVINCE_ALIASES[province],
    ].filter(Boolean).map(normalizeLocationName));
    for (const feature of provinceData.features || []) {
      const properties = feature.properties || {};
      for (const name of [properties.name, properties.state]) {
        if (name) allowedAdminNames.add(normalizeLocationName(name));
      }
    }
    photonProvinceCache.set(province, allowedAdminNames);
  }

  const data = await getJson(`https://photon.komoot.io/api/?${encodeQuery({
    q: `${destination}, ${province}, Thailand`, limit: 10, lang: 'en',
  })}`);
  const matchesProvince = (data.features || []).slice(0, 3).filter(feature => {
    const properties = feature.properties || {};
    const belongsToProvince = [properties.state, properties.city, properties.county]
      .filter(Boolean)
      .some(name => allowedAdminNames.has(normalizeLocationName(name)));
    return properties.countrycode === 'TH' && belongsToProvince;
  });
  const result = matchesProvince.find(feature => {
    const { osm_key: key, osm_value: value } = feature.properties || {};
    return (
      (key === 'tourism' && ['attraction', 'viewpoint', 'museum', 'theme_park', 'zoo'].includes(value)) ||
      (key === 'natural' && ['island', 'cave_entrance', 'beach', 'peak', 'spring', 'waterfall'].includes(value)) ||
      (key === 'place' && value === 'island') ||
      key === 'historic' ||
      (key === 'leisure' && ['park', 'nature_reserve'].includes(value))
    );
  });

  if (result) {
    const [longitude, latitude] = result.geometry.coordinates;
    const location = {
      name: destination,
      latitude,
      longitude,
      admin1: result.properties.state || provinceLocation.admin1,
    };
    const destinationResult = { location, weatherSource: 'destination' };
    destinationGeocodeCache.set(cacheKey, destinationResult);
    return destinationResult;
  }

  const fallbackLocation = { ...provinceLocation, name: province };
  const provinceResult = { location: fallbackLocation, weatherSource: 'province' };
  destinationGeocodeCache.set(cacheKey, provinceResult);
  return provinceResult;
}

function findNextRain(weather) {
  const times = weather.minutely_15?.time || [];
  const precipitation = weather.minutely_15?.precipitation || [];
  const rain = weather.minutely_15?.rain || [];
  const probability = weather.minutely_15?.precipitation_probability || [];
  const now = Date.now();
  const endOfWindow = now + 24 * 60 * 60 * 1000;

  for (let i = 0; i < times.length; i += 1) {
    const time = new Date(times[i]).getTime();
    if (time > endOfWindow) break;
    const isRain = (rain[i] || 0) > 0 || (precipitation[i] || 0) > 0 || (probability[i] || 0) >= 50;
    if (time >= now && isRain) {
      return { time: times[i], minutes: Math.max(0, Math.round((time - now) / 60000)), probability: probability[i] || 0 };
    }
  }
  return null;
}

function getAdvice(current, nextRain) {
  const advice = [];
  const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
  const isRaining = current.rain > 0 || rainCodes.includes(current.weather_code);
  const rainIsNear = nextRain && nextRain.minutes <= 180;
  if (isRaining || rainIsNear) advice.push('พกร่มหรือเสื้อกันฝน');
  else advice.push('ทาครีมกันแดด');
  if (current.temperature_2m >= 33) advice.push('พกน้ำดื่มและหมวก');
  if (current.wind_speed_10m >= 30) advice.push('ระวังลมแรงและสิ่งของปลิว');
  if (!advice.length) advice.push('แต่งกายสบายและพกน้ำดื่ม');
  return advice;
}

async function getWeather(location) {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?${encodeQuery({
    latitude: location.latitude, longitude: location.longitude, timezone: 'Asia/Bangkok', forecast_days: 2,
    current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m',
    minutely_15: 'precipitation_probability,precipitation,rain', daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,rain_sum',
  })}`;
  const data = await getJson(weatherUrl);
  const nextRain = findNextRain(data);
  return {
    location,
    current: data.current,
    nextRain,
    advice: getAdvice(data.current, nextRain),
    daily: data.daily,
    units: data.current_units,
    timezone: data.timezone,
  };
}

function selectionSort(items) {
  const sorted = [...items];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    let minIndex = i;
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (sorted[j].localeCompare(sorted[minIndex], 'th') < 0) minIndex = j;
    }
    [sorted[i], sorted[minIndex]] = [sorted[minIndex], sorted[i]];
  }

  return sorted;
}

app.get('/provinces', (req, res) => {
  const provinces = [
    'กรุงเทพมหานคร', 'กระบี่', 'กาญจนบุรี', 'กาฬสินธุ์', 'กำแพงเพชร', 'ขอนแก่น', 'จันทบุรี', 'ฉะเชิงเทรา', 'ชลบุรี', 'ชัยนาท', 'ชัยภูมิ', 'ชุมพร', 'ตรัง', 'ตราด', 'ตาก', 'นครปฐม', 'นครพนม', 'นครราชสีมา', 'นครศรีธรรมราช', 'นครสวรรค์', 'นครนายก', 'นนทบุรี', 'นราธิวาส', 'น่าน', 'บึงกาฬ', 'บุรีรัมย์', 'ปทุมธานี', 'ประจวบคีรีขันธ์', 'ปราจีนบุรี', 'ปัตตานี', 'พระนครศรีอยุธยา', 'พะเยา', 'พังงา', 'พัทลุง', 'พิจิตร', 'พิษณุโลก', 'ภูเก็ต', 'มหาสารคาม', 'มุกดาหาร', 'ยะลา', 'ยโสธร', 'ร้อยเอ็ด', 'ระนอง', 'ระยอง', 'ราชบุรี', 'ลพบุรี', 'ลำปาง', 'ลำพูน', 'ศรีสะเกษ', 'สกลนคร', 'สงขลา', 'สตูล', 'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'สระแก้ว', 'สระบุรี', 'สิงห์บุรี', 'สุพรรณบุรี', 'สุราษฎร์ธานี', 'สุรินทร์', 'สุโขทัย', 'หนองคาย', 'หนองบัวลำภู', 'อำนาจเจริญ', 'อ่างทอง', 'อุดรธานี', 'อุตรดิตถ์', 'อุทัยธานี', 'อุบลราชธานี', 'เชียงราย', 'เชียงใหม่', 'เพชรบุรี', 'เพชรบูรณ์', 'เลย', 'แพร่', 'แม่ฮ่องสอน',
  ];
  res.json({ provinces: selectionSort(provinces) });
});

app.get('/weather', async (req, res) => {
  try {
    const location = await findProvince(String(req.query.province || DEFAULT_PROVINCE));
    res.json(await getWeather(location));
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.get('/destination-weather', async (req, res) => {
  const destination = String(req.query.destination || '').trim();
  const province = String(req.query.province || '').trim();
  if (!destination || !province) {
    res.status(400).json({ error: 'กรุณาระบุสถานที่และจังหวัด' });
    return;
  }

  try {
    const { location, weatherSource } = await findDestination(destination, province);
    const weather = await getWeather(location);
    res.json({ ...weather, weatherSource });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Weather dashboard: http://localhost:${PORT}`));
