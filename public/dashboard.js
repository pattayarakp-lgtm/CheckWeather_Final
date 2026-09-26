const weatherCodes = {
  0: 'ท้องฟ้าแจ่มใส', 1: 'มีเมฆเล็กน้อย', 2: 'มีเมฆบางส่วน', 3: 'มีเมฆมาก', 45: 'มีหมอก', 48: 'มีหมอกจับตัวแข็ง', 51: 'ฝนปรอยเล็กน้อย', 53: 'ฝนปรอย', 55: 'ฝนปรอยหนัก', 61: 'ฝนตกเล็กน้อย', 63: 'ฝนตกปานกลาง', 65: 'ฝนตกหนัก', 80: 'ฝนตกเป็นช่วงๆ', 81: 'ฝนตกเป็นช่วงๆ', 82: 'ฝนตกหนักเป็นช่วงๆ', 95: 'พายุฝนฟ้าคะนอง', 96: 'พายุฝนฟ้าคะนองและลูกเห็บ', 99: 'พายุฝนฟ้าคะนองและลูกเห็บหนัก',
};

const favoriteStorageKey = 'weatherFavoriteProvinces';
let provinceNames = [];
let favoriteProvinces = loadFavoriteProvinces();

async function loadProvinces() {
  const response = await fetch('/provinces');
  const data = await response.json();
  provinceNames = data.provinces;
  favoriteProvinces = favoriteProvinces.filter(name => provinceNames.includes(name));
  renderProvinceOptions(favoriteProvinces[0] || 'กรุงเทพมหานคร');
}

function loadFavoriteProvinces() {
  try {
    const saved = JSON.parse(localStorage.getItem(favoriteStorageKey) || '[]');
    return Array.isArray(saved) ? saved.filter(name => typeof name === 'string') : [];
  } catch {
    return [];
  }
}

function renderProvinceOptions(selectedProvince) {
  const select = document.getElementById('province');
  const orderedProvinces = [
    ...favoriteProvinces,
    ...provinceNames.filter(name => !favoriteProvinces.includes(name)),
  ];

  select.replaceChildren(...orderedProvinces.map(name => new Option(
    favoriteProvinces.includes(name) ? `★ ${name}` : name,
    name,
  )));
  if (orderedProvinces.includes(selectedProvince)) select.value = selectedProvince;
  updateFavoriteButton();
}

function updateFavoriteButton() {
  const isFavorite = favoriteProvinces.includes(document.getElementById('province').value);
  const button = document.getElementById('favoriteButton');
  button.textContent = isFavorite ? '★ Favorite แล้ว' : '☆ เพิ่ม Favorite';
  button.setAttribute('aria-pressed', String(isFavorite));
}

document.getElementById('province').addEventListener('change', event => {
  updateFavoriteButton();
  loadWeather(event.target.value);
});
document.getElementById('searchForm').addEventListener('submit', event => {
  event.preventDefault();
  loadWeather(document.getElementById('province').value);
});
document.getElementById('searchButton').addEventListener('click', () => {
  loadWeather(document.getElementById('province').value);
});
document.getElementById('favoriteButton').addEventListener('click', () => {
  const selectedProvince = document.getElementById('province').value;
  if (!selectedProvince) return;

  if (favoriteProvinces.includes(selectedProvince)) {
    favoriteProvinces = favoriteProvinces.filter(name => name !== selectedProvince);
  } else {
    favoriteProvinces.unshift(selectedProvince);
  }
  localStorage.setItem(favoriteStorageKey, JSON.stringify(favoriteProvinces));
  renderProvinceOptions(selectedProvince);
});

async function loadWeather(province = 'กรุงเทพมหานคร') {
  const button = document.getElementById('searchButton');
  button.disabled = true;
  showError('');
  try {
    const response = await fetch(`/weather?province=${encodeURIComponent(province)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'โหลดข้อมูลไม่สำเร็จ');
    renderWeather(data);
  } catch (error) { showError(error.message); }
  finally { button.disabled = false; }
}

function renderWeather(data) {
  const { current, units, location, nextRain } = data;
  updateWeatherScene(current, nextRain);
  document.getElementById('locationName').textContent = `จังหวัด${location.name}`;
  document.getElementById('temperature').textContent = `${Math.round(current.temperature_2m)}${units.temperature_2m}`;
  document.getElementById('weatherSummary').textContent = weatherCodes[current.weather_code] || 'สภาพอากาศแปรปรวน';
  document.getElementById('humidity').textContent = `${current.relative_humidity_2m}${units.relative_humidity_2m}`;
  document.getElementById('currentRain').textContent = `${current.rain} ${units.rain}`;
  document.getElementById('wind').textContent = `${current.wind_speed_10m} ${units.wind_speed_10m}`;
  document.getElementById('updatedAt').textContent = new Date(current.time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  document.getElementById('nextRain').textContent = nextRain ? `คาดว่าจะเริ่มตกในอีกประมาณ ${nextRain.minutes} นาที` : 'ไม่มีแนวโน้มฝนตกใน 24 ชั่วโมงข้างหน้า';
  document.getElementById('rainProbability').textContent = nextRain ? `โอกาสฝนตกช่วงนั้น ${nextRain.probability}%` : 'ตรวจจากพยากรณ์ราย 15 นาที';
  renderAdvice(data.advice);
  document.getElementById('forecast').innerHTML = data.daily.time.map((date, index) => `<div class="forecast-day"><strong>${new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' })}</strong><p>${data.daily.temperature_2m_min[index]}° - ${data.daily.temperature_2m_max[index]}°C</p><p class="muted">โอกาสฝนสูงสุด ${data.daily.precipitation_probability_max[index]}%</p><p class="muted">ปริมาณฝน ${data.daily.rain_sum[index]} มม.</p></div>`).join('');
}

function renderAdvice(advice) {
  const icons = [
    { match: /ร่ม|เสื้อกันฝน/, icon: '☂️' },
    { match: /ครีมกันแดด/, icon: '🧴' },
    { match: /น้ำดื่มและหมวก/, icon: '🧢' },
    { match: /ลมแรง/, icon: '🍃' },
    { match: /สบายและพกน้ำดื่ม/, icon: '💧' },
  ];
  const list = document.getElementById('advice');
  list.replaceChildren(...advice.map(item => {
    const entry = document.createElement('li');
    const icon = document.createElement('span');
    const text = document.createElement('span');
    icon.className = 'advice-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = icons.find(option => option.match.test(item))?.icon || '✨';
    text.textContent = item;
    entry.append(icon, text);
    return entry;
  }));
}

function updateWeatherScene(current, nextRain) {
  const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
  const cloudyCodes = [1, 2, 3, 45, 48];
  const rainIsNear = nextRain && nextRain.minutes <= 60;
  const theme = rainCodes.includes(current.weather_code) || current.rain > 0 || rainIsNear
    ? 'weather-rain'
    : cloudyCodes.includes(current.weather_code) ? 'weather-cloudy' : 'weather-sunny';

  document.body.classList.remove('weather-sunny', 'weather-cloudy', 'weather-rain');
  document.body.classList.add(theme);
}

function showError(message) { const error = document.getElementById('error'); error.textContent = message; error.style.display = message ? 'block' : 'none'; }

loadProvinces().then(() => loadWeather(document.getElementById('province').value)).catch(error => showError(error.message));
