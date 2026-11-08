import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

import ProvinceSelector from './components/ProvinceSelector'
import WeatherCard from './components/WeatherCard'
import RainCard from './components/RainCard'
import AdviceCard from './components/AdviceCard'
import ForecastCard from './components/ForecastCard'
import TourismRecommendation from './components/TourismRecommendation'
import HomeTravelSuggestions from './components/HomeTravelSuggestions'

const weatherCodes = {
  0: 'ท้องฟ้าแจ่มใส',
  1: 'มีเมฆเล็กน้อย',
  2: 'มีเมฆบางส่วน',
  3: 'มีเมฆมาก',
  45: 'มีหมอก',
  48: 'มีหมอกจับตัวแข็ง',
  51: 'ฝนปรอยเล็กน้อย',
  53: 'ฝนปรอย',
  55: 'ฝนปรอยหนัก',
  61: 'ฝนตกเล็กน้อย',
  63: 'ฝนตกปานกลาง',
  65: 'ฝนตกหนัก',
  80: 'ฝนตกเป็นช่วงๆ',
  81: 'ฝนตกเป็นช่วงๆ',
  82: 'ฝนตกหนักเป็นช่วงๆ',
  95: 'พายุฝนฟ้าคะนอง',
  96: 'พายุฝนฟ้าคะนองและลูกเห็บ',
  99: 'พายุฝนฟ้าคะนองและลูกเห็บหนัก',
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    throw new Error('เซิร์ฟเวอร์ส่งข้อมูลไม่ถูกต้อง กรุณาลองอีกครั้ง')
  }
}

function App() {
  const [provinces, setProvinces] = useState([])
  const [province, setProvince] = useState('')
  const [weather, setWeather] = useState(null)
  const [status, setStatus] = useState('loading')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [isEnteringSite, setIsEnteringSite] = useState(true)
  const initialized = useRef(false)

  const loadWeather = useCallback(async (selectedProvince = province) => {
    setStatus('loading')
    setFeedbackMessage('')
    setWeather(null)

    try {
      const response = await fetch(
        `/weather?province=${encodeURIComponent(selectedProvince)}`
      )

      const data = await readJson(response)

      if (!response.ok) {
        throw new Error(data.error || 'โหลดข้อมูลสภาพอากาศไม่สำเร็จ')
      }

      if (!data || !data.current) {
        setStatus('empty')
        setFeedbackMessage(
          `ยังไม่มีข้อมูลสภาพอากาศของจังหวัด${selectedProvince} ในขณะนี้ ลองตรวจสอบอีกครั้งภายหลัง`
        )
        return
      }

      if (
        !data.location ||
        !data.units ||
        !Array.isArray(data.advice) ||
        !Array.isArray(data.daily?.time)
      ) {
        throw new Error('ข้อมูลสภาพอากาศที่ได้รับไม่ครบถ้วน กรุณาลองอีกครั้ง')
      }

      setWeather(data)
      setStatus('success')
      setFeedbackMessage(`อัปเดตข้อมูลสภาพอากาศจังหวัด${selectedProvince} แล้ว`)
    } catch (err) {
      console.error('Weather Error:', err)
      setStatus('error')
      setFeedbackMessage(
        err instanceof TypeError
          ? 'เชื่อมต่อบริการสภาพอากาศไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'
          : err.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองอีกครั้ง'
      )
    }
  }, [province])

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch('/provinces')
      const data = await readJson(response)
      if (!response.ok) {
        throw new Error('โหลดรายชื่อจังหวัดไม่สำเร็จ กรุณาลองอีกครั้ง')
      }
      if (!Array.isArray(data.provinces)) {
        throw new Error('รายชื่อจังหวัดที่ได้รับไม่ถูกต้อง กรุณาลองอีกครั้ง')
      }

      setProvinces(data.provinces)
      if (data.provinces.length === 0) {
        setStatus('empty')
        setFeedbackMessage('ยังไม่มีรายชื่อจังหวัดให้เลือกในขณะนี้')
        return
      }

      setStatus('idle')
    } catch (err) {
      console.error('Province List Error:', err)
      setStatus('error')
      setFeedbackMessage(
        err instanceof TypeError
          ? 'เชื่อมต่อบริการไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'
          : err.message || 'โหลดรายชื่อจังหวัดไม่สำเร็จ กรุณาลองอีกครั้ง'
      )
    } finally {
      setIsEnteringSite(false)
    }
  }, [])

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true
      loadDashboard()
    }
  }, [loadDashboard])

  function retryLoad() {
    setStatus('loading')
    setFeedbackMessage('')
    setWeather(null)
    if (provinces.includes(province)) {
      loadWeather()
    } else {
      loadDashboard()
    }
  }

  function selectSuggestedProvince(selectedProvince) {
    setProvince(selectedProvince)
    loadWeather(selectedProvince)
  }

  function showTravelSuggestions() {
    setProvince('')
    setWeather(null)
    setStatus('idle')
    setFeedbackMessage('')
  }

  const current = weather?.current
  const nextRain = weather?.nextRain

  let theme = 'weather-sunny'

  if (current) {
    const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]
    const cloudyCodes = [1, 2, 3, 45, 48]

    if (
      rainCodes.includes(current.weather_code) ||
      current.rain > 0 ||
      (nextRain && nextRain.minutes <= 60)
    ) {
      theme = 'weather-rain'
    } else if (cloudyCodes.includes(current.weather_code)) {
      theme = 'weather-cloudy'
    }
  }

  useEffect(() => {
    document.body.classList.remove(
      'weather-sunny',
      'weather-cloudy',
      'weather-rain'
    )
    document.body.classList.add(theme)

    return () => {
      document.body.classList.remove(
        'weather-sunny',
        'weather-cloudy',
        'weather-rain'
      )
    }
  }, [theme])

  return (
    <>
      <div className="weather-scene" aria-hidden="true">
        <div className="sunlight" />
        <div className="cloud cloud--one" />
        <div className="cloud cloud--two" />
        <div className="cloud cloud--tiny cloud--three">
          <span className="cloud-face"><i /></span>
        </div>
        <div className="cloud cloud--tiny cloud--four">
          <span className="cloud-face"><i /></span>
        </div>
      </div>

      {isEnteringSite && (
        <div className="site-loader" role="status" aria-live="polite">
          <div className="site-loader__content">
            <div className="site-loader__art" aria-hidden="true">
              <span className="site-loader__sun">
                <i className="site-loader__sun-face site-loader__sun-face--left" />
                <i className="site-loader__sun-face site-loader__sun-face--right" />
                <i className="site-loader__sun-smile" />
              </span>
              <span className="site-loader__cloud">
                <i className="site-loader__cloud-eye site-loader__cloud-eye--left" />
                <i className="site-loader__cloud-eye site-loader__cloud-eye--right" />
                <i className="site-loader__cloud-smile" />
              </span>
            </div>
            <h1>อากาศประเทศไทย</h1>
            <p>กำลังเตรียมข้อมูลสภาพอากาศ...</p>
            <div
              className="site-loader__track"
              role="progressbar"
              aria-label="กำลังโหลดเว็บไซต์"
              aria-valuetext="กำลังโหลด"
            >
              <span className="site-loader__bar" />
            </div>
          </div>
        </div>
      )}

      <header>
        <h1>อากาศประเทศไทย</h1>
        <p>เช็กอุณหภูมิ ฝนที่กำลังจะมา และอุปกรณ์ที่ควรเตรียม</p>

        <div className="header-weather-art" aria-hidden="true">
          <span className="header-weather-art__sun">🌞</span>
          <span className="header-weather-art__cloud header-weather-art__cloud--back" />
          <span className="header-weather-art__cloud header-weather-art__cloud--front" />
        </div>
      </header>

      
      <main>
        <ProvinceSelector
          provinces={provinces}
          province={province}
          setProvince={setProvince}
          onShowTravelSuggestions={showTravelSuggestions}
          loadWeather={loadWeather}
          loading={status === 'loading'}
        />

        {!province && status === 'idle' && (
          <HomeTravelSuggestions
            provinces={provinces}
            weatherCodes={weatherCodes}
            onSelectProvince={selectSuggestedProvince}
          />
        )}

        {status === 'loading' && (
          <section className="feedback feedback--loading" role="status" aria-live="polite">
            <span className="loading-spinner" aria-hidden="true" />
            <div>
              <h2>กำลังโหลดข้อมูลสภาพอากาศ</h2>
              <p>
                {provinces.length
                  ? `กำลังค้นหาสภาพอากาศล่าสุดของจังหวัด${province}`
                  : 'กำลังเตรียมรายชื่อจังหวัดและตรวจสอบสภาพอากาศ'}
              </p>
            </div>
          </section>
        )}

        {status === 'empty' && (
          <section className="feedback feedback--empty" role="status" aria-live="polite">
            <span className="feedback-icon" aria-hidden="true">☁️</span>
            <div>
              <h2>ยังไม่มีข้อมูลให้แสดง</h2>
              <p>{feedbackMessage}</p>
              <button type="button" onClick={retryLoad}>
                ลองตรวจสอบอีกครั้ง
              </button>
            </div>
          </section>
        )}

        {status === 'error' && (
          <section className="feedback feedback--error" role="alert">
            <span className="feedback-icon" aria-hidden="true">!</span>
            <div>
              <h2>โหลดข้อมูลไม่สำเร็จ</h2>
              <p>{feedbackMessage}</p>
              <button type="button" onClick={retryLoad}>
                ลองอีกครั้ง
              </button>
            </div>
          </section>
        )}

        {status === 'success' && weather && (
          <>
            <p className="feedback feedback--success" role="status" aria-live="polite">
              <span aria-hidden="true">✓</span> {feedbackMessage}
            </p>
            <section className="grid">
              <WeatherCard weather={weather} weatherCodes={weatherCodes} />
              <RainCard nextRain={nextRain} />
            </section>

            <AdviceCard advice={weather.advice} />
            <ForecastCard daily={weather.daily} />
            <TourismRecommendation
              key={province}
              province={province}
              weather={weather}
              weatherCodes={weatherCodes}
            />
          </>
        )}
      </main>

    </>
  )
}

export default App
