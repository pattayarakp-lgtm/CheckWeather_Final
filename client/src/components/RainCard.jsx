
function RainCard({ nextRain }) {
  return (
    <div className="panel rain">
      <h2>ฝนครั้งถัดไป</h2>

      <div className="weather-doodle" aria-hidden="true">
        <span className="weather-doodle__sun" />
        <span className="weather-doodle__puff" />

        <div className="weather-doodle__cloud">
          <i className="weather-doodle__eye weather-doodle__eye--left" />
          <i className="weather-doodle__eye weather-doodle__eye--right" />
          <i className="weather-doodle__smile" />
        </div>

        <span className="weather-doodle__drop weather-doodle__drop--one" />
        <span className="weather-doodle__drop weather-doodle__drop--two" />
        <span className="weather-doodle__drop weather-doodle__drop--three" />
      </div>

      <p>
        {nextRain
          ? `คาดว่าจะเริ่มตกในอีกประมาณ ${nextRain.minutes} นาที`
          : 'ไม่มีแนวโน้มฝนตกใน 24 ชั่วโมงข้างหน้า'}
      </p>

      <p className="muted">
        {nextRain
          ? `โอกาสฝนตกช่วงนั้น ${nextRain.probability}%`
          : 'ตรวจจากพยากรณ์ราย 15 นาที'}
      </p>
    </div>
  )
}

export default RainCard
