import { useEffect, useState } from 'react'
import { destinationsByProvince } from '../data/destinationsByProvince'
import { fetchTourismImage } from '../utils/tourismImages'

function chooseSuggestions(provinces, previousSuggestions = []) {
  const eligibleProvinces = provinces.filter(
    province => destinationsByProvince[province]?.length
  )
  const newProvinces = eligibleProvinces.filter(
    province => !previousSuggestions.some(item => item.province === province)
  )
  const pool = newProvinces.length >= 6 ? newProvinces : eligibleProvinces
  const shuffled = [...pool]

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    const province = shuffled[index]
    shuffled[index] = shuffled[randomIndex]
    shuffled[randomIndex] = province
  }

  return shuffled.slice(0, 6).map(province => {
    const destinations = destinationsByProvince[province]
    return {
      province,
      destination: destinations[Math.floor(Math.random() * destinations.length)],
    }
  })
}

function HomeTravelSuggestions({ provinces, weatherCodes, onSelectProvince }) {
  const [suggestions, setSuggestions] = useState(() =>
    chooseSuggestions(provinces)
  )
  const [cardData, setCardData] = useState({})

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setSuggestions(previous => chooseSuggestions(provinces, previous))
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [provinces])

  useEffect(() => {
    const controller = new AbortController()

    async function loadSuggestion(suggestion) {
      const { province, destination } = suggestion
      const key = `${province}:${destination}`
      const weatherPromise = (async () => {
        const response = await fetch(
          `/weather?province=${encodeURIComponent(province)}`,
          { signal: controller.signal }
        )
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || `โหลดอากาศจังหวัด${province}ไม่สำเร็จ`)
        }
        if (!data.current || !data.units) {
          throw new Error(`ข้อมูลอากาศจังหวัด${province}ไม่ครบถ้วน`)
        }
        return data
      })()

      const imagePromise = fetchTourismImage(destination, controller.signal, province)
      const [weatherResult, imageResult] = await Promise.allSettled([
        weatherPromise,
        imagePromise,
      ])

      if (controller.signal.aborted) return

      if (weatherResult.status === 'rejected') {
        console.error('Suggested Province Weather Error:', weatherResult.reason)
      }
      if (imageResult.status === 'rejected') {
        console.error('Suggested Destination Image Error:', imageResult.reason)
      }

      setCardData(previous => ({
        ...previous,
        [key]: {
          weather:
            weatherResult.status === 'fulfilled'
              ? { status: 'loaded', data: weatherResult.value }
              : { status: 'error', message: weatherResult.reason.message },
          image:
            imageResult.status === 'fulfilled'
              ? { status: imageResult.value ? 'loaded' : 'unavailable', data: imageResult.value }
              : { status: 'error', message: imageResult.reason.message },
        },
      }))
    }

    suggestions.forEach(suggestion => {
      loadSuggestion(suggestion)
    })

    return () => controller.abort()
  }, [suggestions])

  async function retryWeather(suggestion) {
    const { province, destination } = suggestion
    const key = `${province}:${destination}`

    try {
      const response = await fetch(
        `/weather?province=${encodeURIComponent(province)}`
      )
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || `โหลดอากาศจังหวัด${province}ไม่สำเร็จ`)
      }
      if (!data.current || !data.units) {
        throw new Error(`ข้อมูลอากาศจังหวัด${province}ไม่ครบถ้วน`)
      }

      setCardData(previous => ({
        ...previous,
        [key]: {
          ...previous[key],
          weather: { status: 'loaded', data },
        },
      }))
    } catch (error) {
      console.error('Suggested Province Weather Retry Error:', error)
      setCardData(previous => ({
        ...previous,
        [key]: {
          ...previous[key],
          weather: {
            status: 'error',
            message: error.message || 'โหลดสภาพอากาศไม่สำเร็จ',
          },
        },
      }))
    }
  }

  return (
    <section className="home-travel panel" aria-labelledby="home-travel-title">
      <div className="home-travel__heading">
        <div>
          <span className="home-travel__eyebrow">เที่ยวไหนดีวันนี้</span>
          <h2 id="home-travel-title">สถานที่น่าเที่ยวทั่วไทย</h2>
        </div>
        <span className="home-travel__badge">สุ่ม 6 จังหวัด</span>
      </div>

      <div className="home-travel__grid">
        {suggestions.map(({ province, destination }) => {
          const key = `${province}:${destination}`
          const item = cardData[key]
          const weather = item?.weather?.status === 'loaded' ? item.weather.data : null
          const image = item?.image?.status === 'loaded' ? item.image.data : null
          const imageStatus = item?.image?.status

          return (
            <article className="home-travel-card" key={key}>
              {image?.imageUrl ? (
                <img
                  className="home-travel-card__image"
                  src={image.imageUrl}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => {
                    setCardData(previous => ({
                      ...previous,
                      [key]: {
                        ...previous[key],
                        image: { status: 'unavailable' },
                      },
                    }))
                  }}
                />
              ) : (
                <div className="home-travel-card__image-fallback" aria-hidden="true">
                  <span>🏞️</span>
                  <small>
                    {imageStatus === 'error'
                      ? 'โหลดรูปไม่สำเร็จ'
                      : imageStatus === 'unavailable'
                        ? 'ยังไม่มีรูปสถานที่นี้'
                        : 'กำลังค้นหารูปสถานที่...'}
                  </small>
                </div>
              )}
              <div className="home-travel-card__content">
                <span className="home-travel-card__label">📍 จังหวัด{province}</span>
                <h3>{destination}</h3>
                {weather ? (
                  <>
                    <p className="home-travel-card__condition">
                      <strong>{Math.round(weather.current.temperature_2m)}{weather.units.temperature_2m}</strong>
                      <span>{weatherCodes[weather.current.weather_code] || 'สภาพอากาศแปรปรวน'}</span>
                    </p>
                    <p className="home-travel-card__details">
                      ความชื้น {weather.current.relative_humidity_2m}{weather.units.relative_humidity_2m}
                      {' · '}ฝน {weather.current.rain} {weather.units.rain}
                    </p>
                  </>
                ) : (
                  <div className="home-travel-card__weather-error">
                    <p className="home-travel-card__details">
                      {item?.weather?.status === 'error'
                        ? `โหลดข้อมูลอากาศไม่ได้: ${item.weather.message}`
                        : 'กำลังโหลดสภาพอากาศ...'}
                    </p>
                    {item?.weather?.status === 'error' && (
                      <button
                        type="button"
                        className="home-travel-card__retry"
                        onClick={() => retryWeather({ province, destination })}
                      >
                        ลองโหลดอีกครั้ง
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className="home-travel-card__button"
                  onClick={() => onSelectProvince(province)}
                >
                  ดูอากาศจังหวัดนี้
                </button>
              </div>
              {image && (
                <a
                  className="home-travel-card__credit"
                  href={image.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="ดูที่มาและรายละเอียดสัญญาอนุญาตของภาพ"
                >
                  ภาพ: {image.artist ? `${image.artist} · ` : ''}{image.license}
                </a>
              )}
            </article>
          )
        })}
      </div>

      <p className="home-travel__note">
        สุ่มเปลี่ยนจังหวัดแนะนำทุก 1 นาที · ข้อมูลอากาศเป็นข้อมูลระดับจังหวัด
      </p>
    </section>
  )
}

export default HomeTravelSuggestions
