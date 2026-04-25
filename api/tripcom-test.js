// SKAP - Test endpoint Trip.com Hotels via Travelpayouts
// Endpoint Vercel: https://skap-vert.vercel.app/api/tripcom-test
//
// Trip.com è attivo nel tuo account Travelpayouts.
// Testiamo se l'API hotel risponde con dati per le destinazioni SKAP.
//
// Esempi:
// https://skap-vert.vercel.app/api/tripcom-test
// https://skap-vert.vercel.app/api/tripcom-test?city=budapest
// https://skap-vert.vercel.app/api/tripcom-test?city=barcelona&checkIn=2026-06-01&checkOut=2026-06-03

export default async function handler(req, res) {
  // Date di default: prossimo weekend
  const today = new Date();
  const defaultCheckIn = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
  const defaultCheckOut = new Date(today.getTime() + 16 * 24 * 60 * 60 * 1000);

  const {
    city = 'budapest',
    checkIn = defaultCheckIn.toISOString().split('T')[0],
    checkOut = defaultCheckOut.toISOString().split('T')[0],
    adults = '2',
    currency = 'eur',
    limit = '5',
  } = req.query;

  const TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
  const MARKER = process.env.TRAVELPAYOUTS_MARKER;

  if (!TOKEN) {
    return res.status(500).json({
      error: 'TRAVELPAYOUTS_TOKEN non configurato',
    });
  }

  // Travelpayouts ha un endpoint generico hotels/cache che funziona con tutti
  // i programmi hotel attivi sul tuo account (Trip.com nel tuo caso)
  const params = new URLSearchParams({
    location: city,
    checkIn: checkIn,
    checkOut: checkOut,
    adults: adults,
    currency: currency,
    limit: limit,
    token: TOKEN,
  });

  // Endpoint Travelpayouts hotels cache (usa il tuo programma hotel attivo)
  const url = `https://engine.hotellook.com/api/v2/cache.json?${params.toString()}`;

  try {
    const response = await fetch(url);

    // Tentativo alternativo se il primo fallisce
    let data;
    if (!response.ok) {
      // Prova endpoint alternativo Trip.com diretto
      const altUrl = `https://engine.hotellook.com/api/v2/lookup.json?query=${encodeURIComponent(city)}&lang=en&lookFor=both&limit=5&token=${TOKEN}`;
      const altResponse = await fetch(altUrl);

      if (!altResponse.ok) {
        return res.status(altResponse.status).json({
          error: `Entrambi gli endpoint hanno fallito`,
          first_status: response.status,
          alt_status: altResponse.status,
          hint: 'Trip.com potrebbe non avere API JSON pubblica via Travelpayouts',
        });
      }

      data = await altResponse.json();
      return res.status(200).json({
        success: true,
        type: 'lookup_only',
        query: { city, checkIn, checkOut, adults, currency },
        marker: MARKER,
        timestamp: new Date().toISOString(),
        message: 'Endpoint cache non disponibile, restituisco lookup città',
        raw_data: data,
      });
    }

    data = await response.json();
    const hotels = Array.isArray(data) ? data.slice(0, parseInt(limit)) : [];

    const summary = hotels.length > 0 ? {
      cheapest: Math.min(...hotels.map(h => h.priceFrom || Infinity)),
      average: Math.round(hotels.reduce((sum, h) => sum + (h.priceFrom || 0), 0) / hotels.length),
      total_results: hotels.length,
    } : null;

    const result = {
      success: true,
      query: { city, checkIn, checkOut, adults, currency },
      marker: MARKER,
      timestamp: new Date().toISOString(),
      summary,
      hotels: hotels.map(h => ({
        name: h.hotelName,
        stars: h.stars,
        price_total: h.priceFrom,
        price_per_night: h.priceAvg,
        location: h.location?.name,
        property_type: h.propertyType,
      })),
      raw_count: hotels.length,
      note: 'Test Trip.com via API hotels Travelpayouts',
    };

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      error: 'Errore durante chiamata',
      message: error.message,
    });
  }
}
