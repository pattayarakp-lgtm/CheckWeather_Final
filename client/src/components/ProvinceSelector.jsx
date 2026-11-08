
import { useState } from 'react'

function ProvinceSelector({
  provinces,
  province,
  setProvince,
  onShowTravelSuggestions,
  loadWeather,
  loading,
}) {
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const query = province.trim().toLocaleLowerCase('th')
  const matchingProvinces = provinces.filter(name =>
    name.toLocaleLowerCase('th').includes(query)
  )
  const suggestions = (query
    ? [
        ...matchingProvinces.filter(name =>
          name.toLocaleLowerCase('th').startsWith(query)
        ),
        ...matchingProvinces.filter(name =>
          !name.toLocaleLowerCase('th').startsWith(query)
        ),
      ]
    : provinces
  ).slice(0, 8)
  const isValidProvince = provinces.includes(province)

  function chooseSuggestion(name) {
    setProvince(name)
    setIsSuggestionsOpen(false)
    setActiveSuggestion(-1)
    loadWeather(name)
  }

  function handleInputKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.length === 0) return
      event.preventDefault()
      setIsSuggestionsOpen(true)
      setActiveSuggestion(index => {
        if (event.key === 'ArrowDown') {
          return index >= suggestions.length - 1 ? 0 : index + 1
        }
        return index <= 0 ? suggestions.length - 1 : index - 1
      })
    } else if (event.key === 'Enter') {
      if (isSuggestionsOpen && activeSuggestion >= 0) {
        event.preventDefault()
        chooseSuggestion(suggestions[activeSuggestion])
      } else if (isValidProvince) {
        event.preventDefault()
        loadWeather()
      }
    } else if (event.key === 'Escape') {
      setIsSuggestionsOpen(false)
      setActiveSuggestion(-1)
    }
  }

  return (
    <section className="search">
      <div className="province-field">
        <label htmlFor="province">พิมพ์หรือเลือกจังหวัด</label>
        <div className="province-select-row">
          <input
            id="province"
            type="text"
            value={province}
            onChange={event => {
              const value = event.target.value
              setProvince(value)
              setActiveSuggestion(-1)
              setIsSuggestionsOpen(true)
              if (provinces.includes(value)) {
                loadWeather(value)
              }
            }}
            onFocus={() => setIsSuggestionsOpen(true)}
            onBlur={event => {
              if (!event.currentTarget.closest('.province-field').contains(event.relatedTarget)) {
                setIsSuggestionsOpen(false)
                setActiveSuggestion(-1)
              }
            }}
            onKeyDown={handleInputKeyDown}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isSuggestionsOpen && suggestions.length > 0}
            aria-controls="province-options"
            aria-activedescendant={
              activeSuggestion >= 0
                ? `province-option-${activeSuggestion}`
                : undefined
            }
            placeholder="เช่น เชียงใหม่"
            autoComplete="off"
            disabled={loading || provinces.length === 0}
          />
          {province && (
            <button
              type="button"
              onClick={onShowTravelSuggestions}
              disabled={loading}
            >
              กลับไปดูจังหวัดน่าเที่ยว
            </button>
          )}
        </div>
        <div
          id="province-options"
          className="province-suggestions"
          role="listbox"
          aria-label="จังหวัดที่แนะนำ"
          hidden={!isSuggestionsOpen || suggestions.length === 0}
        >
          {suggestions.map((name, index) => (
            <button
              id={`province-option-${index}`}
              key={name}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={activeSuggestion === index}
              className={`province-suggestion${activeSuggestion === index ? ' is-active' : ''}`}
              onClick={() => chooseSuggestion(name)}
            >
              <span className="province-suggestion__name">{name}</span>
            </button>
          ))}
        </div>
      </div>

    </section>
  )
}

export default ProvinceSelector
