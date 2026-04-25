// SKAP - Test endpoint Travelpayouts API

export default async function handler(req, res) {
  const {
    from = 'BGY',
    to = 'BUD',
    currency = 'eur',
  } = req.query;

  const TOKEN = process.env.TRAVELPAYOUTS_TOKEN;
  const MARKER = process.env.TRAVELPAYOUTS_MARKER;

  if (!TOKEN) {
    return res.status(500).json({
      error: 'TRAVELPAYOUTS_TOKEN non configurato su Vercel',
      hint: 'Vai su Vercel Dashboard > Settings > Environment Variables e aggiungilo'
    });
  }

  const url = `https://api.travelpayouts.com/v1/prices/cheap?origin=${from}&destination=${to}&currency=${currency}&token=${TOKEN}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Travelpayouts ha risposto con status ${response.status}`,
        statusText: response.statusText,
      });
    }

    const data = await response.json();

    const result = {
      success: true,
      query: { from, to, currency },
      marker: MARKER,
      timestamp: new Date().toISOString(),
      raw_data: data,
    };

    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate');

    return res.status(200).json(result);

  } catch (error) {
    return res.status(500).json({
      error: 'Errore durante chiamata Travelpayouts',
      message: error.message,
    });
  }
}
