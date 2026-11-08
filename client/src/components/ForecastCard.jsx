
function ForecastCard({ daily }) {
  return (
    <section className="panel panel-spaced">
      <h2>พยากรณ์ 2 วัน</h2>

      <div className="forecast">
        {daily.time.map((date, index) => (
          <div className="forecast-day" key={date}>
            <strong>
              {new Date(`${date}T00:00:00`).toLocaleDateString('th-TH', {
                weekday: 'long',
                day: 'numeric',
                month: 'short',
              })}
            </strong>

            <p>
              {daily.temperature_2m_min[index]}° - {daily.temperature_2m_max[index]}°C
            </p>

            <p className="muted">
              โอกาสฝนสูงสุด {daily.precipitation_probability_max[index]}%
            </p>

            <p className="muted">
              ปริมาณฝน {daily.rain_sum[index]} มม.
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ForecastCard
