import { useEffect, useState } from 'react'
import { fetchTourismImage } from '../utils/tourismImages'
import { destinationsByProvince } from '../data/destinationsByProvince'
import provinceLandscape from '../assets/province-landscape.svg'

const heavyRainCodes = [65, 82, 95, 96, 99]
const rainCodes = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99]

function TourismRecommendation({ province, weather, weatherCodes }) {
  const destinations = destinationsByProvince[province]
  const [destinationIndex, setDestinationIndex] = useState(() =>
    destinations?.length ? Math.floor(Math.random() * destinations.length) : 0
  )
  const [imageResult, setImageResult] = useState(null)
  const [destinationWeather, setDestinationWeather] = useState(null)
  const { current, nextRain, daily } = weather
  const destination =
    destinations?.[destinationIndex % destinations.length]
  const imageTarget = destination || province
  const currentImage = imageResult?.destination === imageTarget ? imageResult : null
  const canBrowseDestinations = destinations?.length > 1
  const rainExpectedToday =
    daily.precipitation_probability_max?.[0] >= 70 ||
    daily.rain_sum?.[0] >= 10
  const severeWeather =
    heavyRainCodes.includes(current.weather_code) ||
    current.rain >= 5
  const rainIsNear = nextRain && nextRain.minutes <= 120
  const shouldPrepareBackup =
    severeWeather ||
    rainIsNear ||
    rainExpectedToday ||
    rainCodes.includes(current.weather_code) ||
    current.rain > 0

  useEffect(() => {
    if (!destinations || destinations.length < 2) return undefined

    function chooseRandomDestination(previousIndex) {
      if (destinations.length < 2) return 0
      const randomIndex = Math.floor(Math.random() * (destinations.length - 1))
      return randomIndex >= previousIndex ? randomIndex + 1 : randomIndex
    }

    const intervalId = window.setInterval(() => {
      setDestinationIndex(previousIndex =>
        chooseRandomDestination(previousIndex % destinations.length)
      )
    }, 60_000)

    return () => window.clearInterval(intervalId)
  }, [province, destinations])

  function showPreviousDestination() {
    setDestinationIndex(index => (index - 1 + destinations.length) % destinations.length)
  }

  function showNextDestination() {
    setDestinationIndex(index => (index + 1) % destinations.length)
  }

  useEffect(() => {
    if (!imageTarget) return undefined

    const controller = new AbortController()
    async function loadDestinationImage() {
      try {
        const image = await fetchTourismImage(imageTarget, controller.signal, province)
        if (!image) {
          setImageResult({ destination: imageTarget, status: 'unavailable' })
          return
        }

        setImageResult({
          destination: imageTarget,
          status: 'loaded',
          ...image,
        })
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('Tourism Image Error:', error)
        setImageResult({ destination: imageTarget, status: 'error' })
      }
    }

    loadDestinationImage()
    return () => controller.abort()
  }, [imageTarget, province])

  useEffect(() => {
    if (!destination) return undefined

    const controller = new AbortController()
    async function loadDestinationWeather() {
      try {
        const query = new URLSearchParams({ destination, province })
        const response = await fetch(`/destination-weather?${query}`, {
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || `โหลดอากาศ${destination}ไม่สำเร็จ`)
        }
        if (
          !data.current ||
          !data.units ||
          !data.weatherSource ||
          !Array.isArray(data.daily?.precipitation_probability_max)
        ) {
          throw new Error(`ข้อมูลอากาศ${destination}ไม่ครบถ้วน`)
        }

        setDestinationWeather({ destination, status: 'loaded', data })
      } catch (error) {
        if (error.name === 'AbortError') return
        console.error('Destination Weather Error:', error)
        setDestinationWeather({
          destination,
          status: 'error',
          message: error.message || 'โหลดสภาพอากาศของสถานที่ไม่สำเร็จ',
        })
      }
    }

    loadDestinationWeather()
    return () => controller.abort()
  }, [destination, province])

  const currentDestinationWeather =
    destinationWeather?.destination === destination ? destinationWeather : null

  return (
    <section className="panel panel-spaced tourism">
      <h2>ที่เที่ยวแนะนำจังหวัด{province}</h2>

      <p className={`tourism-status${severeWeather ? ' tourism-status--warning' : ''}`}>
        <strong>
          {severeWeather
            ? 'ควรระวังสภาพอากาศ'
            : shouldPrepareBackup
              ? 'ควรเตรียมแผนสำรอง'
              : 'อากาศค่อนข้างเหมาะกับการเที่ยวกลางแจ้ง'}
        </strong>
        {' · '}
        {weatherCodes[current.weather_code] || 'สภาพอากาศแปรปรวน'}
        {rainIsNear && ' · คาดว่าฝนอาจตกภายใน 2 ชั่วโมง'}
      </p>

      {destination ? (
        <div className="tourism-carousel">
          <div className="tourism-content">
            <article className="tourism-option" key={destination}>
              <img
                className="tourism-option__image"
                src={currentImage?.status === 'loaded'
                  ? currentImage.imageUrl
                  : provinceLandscape}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => {
                  if (currentImage?.status !== 'loaded') return
                  setImageResult(result =>
                    result?.destination === destination
                      ? { destination, status: 'unavailable' }
                      : result
                  )
                }}
              />
              <div className="tourism-option__details">
                <span className="tourism-option__icon" aria-hidden="true">📍</span>
                <div>
                  <span className="tourism-option__eyebrow">
                    สถานที่แนะนำ {destinationIndex + 1} จาก {destinations.length}
                  </span>
                  <h3>{destination}</h3>
                  <p>จังหวัด{province}</p>
                </div>
              </div>
              {currentImage?.status === 'loaded' ? (
                <a
                  className="tourism-image-credit"
                  href={currentImage.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="ดูที่มาและรายละเอียดสัญญาอนุญาตของภาพ"
                >
                  ภาพ: {currentImage.artist ? `${currentImage.artist} · ` : ''}
                  {currentImage.license}
                </a>
              ) : (
                <span className="tourism-image-status">
                  {currentImage?.status === 'error'
                    ? 'โหลดภาพไม่สำเร็จ'
                    : currentImage?.status === 'unavailable'
                      ? 'ไม่พบภาพสถานที่'
                      : 'กำลังโหลดภาพสถานที่...'}
                </span>
              )}
            </article>

            <section
              className="tourism-weather"
              aria-label={`สภาพอากาศของ${destination}`}
              aria-live="polite"
            >
              {currentDestinationWeather?.status === 'loaded' ? (
                <>
                  <h3 className="tourism-weather__heading">
                    สภาพอากาศ{currentDestinationWeather.data.weatherSource === 'destination'
                      ? `ใกล้${destination}`
                      : `จังหวัด${province}`}
                  </h3>
                  <p className="tourism-weather__source">
                    {currentDestinationWeather.data.weatherSource === 'destination'
                      ? 'พยากรณ์จากพิกัดใกล้สถานที่'
                      : 'ไม่พบพิกัดสถานที่ ใช้ข้อมูลจังหวัดแทน'}
                  </p>
                  <div className="tourism-weather__grid">
                    <div className="tourism-weather__item">
                      <span aria-hidden="true">🌡️</span>
                      <div><small>อุณหภูมิ</small><strong>{Math.round(currentDestinationWeather.data.current.temperature_2m)}{currentDestinationWeather.data.units.temperature_2m}</strong></div>
                    </div>
                    <div className="tourism-weather__item">
                      <span aria-hidden="true">🌥️</span>
                      <div><small>สภาพอากาศ</small><strong>{weatherCodes[currentDestinationWeather.data.current.weather_code] || 'สภาพอากาศแปรปรวน'}</strong></div>
                    </div>
                    <div className="tourism-weather__item">
                      <span aria-hidden="true">💧</span>
                      <div><small>ความชื้น</small><strong>{currentDestinationWeather.data.current.relative_humidity_2m}{currentDestinationWeather.data.units.relative_humidity_2m}</strong></div>
                    </div>
                    <div className="tourism-weather__item">
                      <span aria-hidden="true">🌧️</span>
                      <div><small>ฝนตอนนี้</small><strong>{currentDestinationWeather.data.current.rain} {currentDestinationWeather.data.units.rain}</strong></div>
                    </div>
                    <div className="tourism-weather__item">
                      <span aria-hidden="true">💨</span>
                      <div><small>ความเร็วลม</small><strong>{currentDestinationWeather.data.current.wind_speed_10m} {currentDestinationWeather.data.units.wind_speed_10m}</strong></div>
                    </div>
                    <div className="tourism-weather__item">
                      <span aria-hidden="true">☔</span>
                      <div>
                        <small>ฝนครั้งถัดไป</small>
                        <strong>
                          {currentDestinationWeather.data.nextRain
                            ? `ประมาณ ${currentDestinationWeather.data.nextRain.minutes} นาที`
                            : 'ไม่มีแนวโน้มใน 24 ชม.'}
                        </strong>
                      </div>
                    </div>
                    <div className="tourism-weather__item">
                      <span aria-hidden="true">🌦️</span>
                      <div>
                        <small>โอกาสฝนวันนี้</small>
                        <strong>
                          {currentDestinationWeather.data.daily.precipitation_probability_max?.[0] ?? 'ไม่มีข้อมูล'}
                          {currentDestinationWeather.data.daily.precipitation_probability_max?.[0] != null ? '%' : ''}
                        </strong>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="tourism-weather__message">
                  {currentDestinationWeather?.status === 'error'
                    ? currentDestinationWeather.message
                    : `กำลังโหลดสภาพอากาศใกล้${destination}...`}
                </p>
              )}
            </section>
          </div>

          <nav className="tourism-carousel__controls" aria-label="เลื่อนดูสถานที่แนะนำ">
            <button
              type="button"
              onClick={showPreviousDestination}
              disabled={!canBrowseDestinations}
              aria-label="ดูสถานที่แนะนำก่อนหน้า"
            >
              ←
            </button>
            <button
              type="button"
              onClick={showNextDestination}
              disabled={!canBrowseDestinations}
              aria-label="ดูสถานที่แนะนำถัดไป"
            >
              →
            </button>
          </nav>

          <p className="tourism-rotation">
            มีสถานที่แนะนำ {destinations.length} แห่ง · กดปุ่มลูกศรเพื่อเลือกดู
            และระบบจะสุ่มเปลี่ยนสถานที่ทุก 1 นาที
          </p>
        </div>
      ) : (
        <>
          <article className="tourism-option tourism-option--province">
            <img
              className="tourism-option__image"
              src={currentImage?.status === 'loaded'
                ? currentImage.imageUrl
                : provinceLandscape}
              alt={`ภาพประกอบทิวทัศน์จังหวัด${province}`}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              onError={() => {
                setImageResult(result =>
                  result?.destination === imageTarget
                    ? { destination: imageTarget, status: 'unavailable' }
                    : result
                )
              }}
            />
            <div className="tourism-option__details">
              <span className="tourism-option__icon" aria-hidden="true">📍</span>
              <div>
                <span className="tourism-option__eyebrow">จังหวัดแนะนำ</span>
                <h3>จังหวัด{province}</h3>
                <p>ยังไม่มีรายการสถานที่ท่องเที่ยวแนะนำ</p>
              </div>
            </div>
            {currentImage?.status === 'loaded' ? (
              <a
                className="tourism-image-credit"
                href={currentImage.sourceUrl}
                target="_blank"
                rel="noreferrer"
                title="ดูที่มาและรายละเอียดสัญญาอนุญาตของภาพ"
              >
                ภาพ: {currentImage.artist ? `${currentImage.artist} · ` : ''}
                {currentImage.license}
              </a>
            ) : (
              <span className="tourism-image-status">ภาพประกอบจังหวัด</span>
            )}
          </article>
          <p className="tourism-note">
            ไม่พบข้อมูลสถานที่ท่องเที่ยวของจังหวัดนี้ในรายการแนะนำ
            {shouldPrepareBackup
              ? ' หากมีฝนหรือสภาพอากาศไม่เอื้ออำนวย ควรตรวจสอบประกาศและเงื่อนไขการเดินทางก่อนเลือกสถานที่'
              : ' โปรดตรวจสอบข้อมูลสถานที่และประกาศในพื้นที่ก่อนเดินทาง'}
          </p>
        </>
      )}

      <p className="tourism-disclaimer">
        ข้อมูลอากาศใช้พิกัดใกล้แหล่งท่องเที่ยวเมื่อค้นหาได้ หากไม่พบจะใช้ข้อมูลระดับจังหวัดแทน
        และไม่ใช่การยืนยันว่าแหล่งท่องเที่ยวเปิดให้บริการหรือปลอดภัย
        โปรดตรวจสอบประกาศจากหน่วยงานในพื้นที่ก่อนเดินทาง
      </p>
    </section>
  )
}

export default TourismRecommendation