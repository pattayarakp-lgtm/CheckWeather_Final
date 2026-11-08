const destinationSearchTerms = {
  ทะเลบัวแดง: ['Red Lotus Sea at Nong Han Kumphawapi, Udon Thani'],
}

export async function fetchTourismImage(destination, signal, province = '') {
  const searchTerms = [
    `intitle:${destination}`,
    `${destination} ${province} Thailand`,
    `${destination} Thailand`,
    ...(destinationSearchTerms[destination] || []),
    destination,
  ].filter((term, index, terms) => terms.indexOf(term) === index)

  for (const searchTerm of searchTerms) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: searchTerm,
      gsrnamespace: '6',
      gsrlimit: '8',
      prop: 'imageinfo',
      iiprop: 'url|extmetadata',
      iiurlwidth: '1400',
      format: 'json',
      origin: '*',
    })

    const response = await fetch(
      `https://commons.wikimedia.org/w/api.php?${params}`,
      { signal }
    )
    if (!response.ok) {
      throw new Error(`Wikimedia Commons ตอบกลับ ${response.status}`)
    }

    const data = await response.json()
    const pages = Object.values(data.query?.pages || {})
    const matchingPage = pages.find(page => {
      const image = page.imageinfo?.[0]
      return (
        /\.(jpe?g|png|webp)$/i.test(page.title || '') &&
        image?.thumburl &&
        image?.descriptionurl
      )
    })

    if (!matchingPage) continue

    const image = matchingPage.imageinfo[0]
    const imageUrl = new URL(image.thumburl)
    const sourceUrl = new URL(image.descriptionurl)
    if (
      imageUrl.protocol !== 'https:' ||
      !(
        imageUrl.hostname === 'wikimedia.org' ||
        imageUrl.hostname.endsWith('.wikimedia.org')
      ) ||
      sourceUrl.protocol !== 'https:' ||
      sourceUrl.hostname !== 'commons.wikimedia.org'
    ) {
      throw new Error('ได้รับที่อยู่ภาพจากแหล่งที่ไม่ถูกต้อง')
    }

    const artistMarkup = image.extmetadata?.Artist?.value || ''
    const artist = new DOMParser()
      .parseFromString(artistMarkup, 'text/html')
      .body.textContent.trim()
      .replace(/\s+/g, ' ')

    return {
      imageUrl: imageUrl.href,
      sourceUrl: sourceUrl.href,
      artist,
      license: image.extmetadata?.LicenseShortName?.value || 'Wikimedia Commons',
    }
  }

  return null
}
