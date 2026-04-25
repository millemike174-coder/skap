// SKAP - Test endpoint Hotellook API (alloggi/ostelli)
// Endpoint Vercel: https://skap-vert.vercel.app/api/alloggi-test
//
// Esempi d'uso:
// https://skap-vert.vercel.app/api/alloggi-test
// https://skap-vert.vercel.app/api/alloggi-test?city=budapest&checkIn=2026-05-09&checkOut=2026-05-11
// https://skap-vert.vercel.app/api/alloggi-test?city=barcelona

export default async function handler(req, res) {
  // Parametri di default: ricerca a Budapest per il prossimo weekend
  const today = new Date();
  const defaultCheckIn = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000); // tra 14 giorni
  const defaultCheckOut = new Date(today.getTime() + 16 * 24 * 60 * 60 * 1000); // tra 16 giorni

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
      error: 'TRAVELPAYOUTS_TOKEN non configurato su Vercel',
    });
  }

  // Endpoint Hotellook: ricerca cache prezzi (più veloce, dati cached recenti)
  // Documentazione: https://support.travelpayouts.com/hc/en-us/articles/115000351631
  const params = new URLSearchParams({
    location: city,
    checkIn: checkIn,
    checkOut: checkOut,
    adults: adults,
    currency: currency,
    limit: limit,
    token: TOKEN,
  });

  const url = `https://engine.hotellook.com/api/v2/cache.json?${params.toString()}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Hotellook ha risposto con status ${response.status}`,
        statusText: response.statusText,
      });
    }

    const data = await response.json();

    // Hotellook ritorna un array di hotel. Estraiamo i campi utili
    const hotels = Array.isArray(data) ? data.slice(0, parseInt(limit)) : [];

    // Calcola riepilogo per uso pratico
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
        price_total: h.priceFrom,        // prezzo totale per il soggiorno
        price_per_night: h.priceAvg,     // prezzo medio per notte
        location: h.location?.name,
        property_type: h.propertyType,
      })),
      raw_count: hotels.length,
    };

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');
    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      error: 'Errore durante chiamata Hotellook',
      message: error.message,
    });
  }
}
