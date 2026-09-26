const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;
const DEFAULT_PROVINCE = 'กรุงเทพมหานคร';
const geocodeCache = new Map();
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

app.use(express.static('public'));

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
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?${encodeQuery({
      latitude: location.latitude, longitude: location.longitude, timezone: 'Asia/Bangkok', forecast_days: 2,
      current: 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m',
      minutely_15: 'precipitation_probability,precipitation,rain', daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max,rain_sum',
    })}`;
    const data = await getJson(weatherUrl);
    const nextRain = findNextRain(data);
    res.json({ location, current: data.current, nextRain, advice: getAdvice(data.current, nextRain), daily: data.daily, units: data.current_units, timezone: data.timezone });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Weather dashboard: http://localhost:${PORT}`));
