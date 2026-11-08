
function WeatherCard({ weather, weatherCodes }) {
  const { current, units, location } = weather

  return (
    <div className="panel">
      <h2>จังหวัด{location.name}</h2>

      <div className="current">
        <div className="temperature">
          {Math.round(current.temperature_2m)}
          {units.temperature_2m}
        </div>

        <div className="weather-summary">
          {weatherCodes[current.weather_code] || 'สภาพอากาศแปรปรวน'}
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <small>ความชื้น</small>
          <strong>{current.relative_humidity_2m}{units.relative_humidity_2m}</strong>
        </div>

        <div className="stat">
          <small>ฝนตอนนี้</small>
          <strong>{current.rain} {units.rain}</strong>
        </div>

        <div className="stat">
          <small>ความเร็วลม</small>
          <strong>{current.wind_speed_10m} {units.wind_speed_10m}</strong>
        </div>

        <div className="stat">
          <small>อัปเดตเวลา</small>
          <strong>
            {new Date(current.time).toLocaleTimeString('th-TH', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </strong>
        </div>
      </div>
    </div>
  )
}

export default WeatherCard
