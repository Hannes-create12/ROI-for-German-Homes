const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // Serve static files (index.html)

// Helper function to extract price from text
function extractPrice(text) {
    if (!text) return null;
    // Remove all non-numeric characters except comma and dot
    const cleaned = text.replace(/[^\d,.]/g, '');
    // Replace comma with dot for decimal
    const normalized = cleaned.replace(',', '.');
    const price = parseFloat(normalized);
    return isNaN(price) ? null : Math.round(price);
}

// Helper function to extract area from text
function extractArea(text) {
    if (!text) return null;
    const match = text.match(/(\d+[,.]?\d*)\s*m²/);
    if (match) {
        return parseFloat(match[1].replace(',', '.'));
    }
    return null;
}

// Scraping function for ImmobilienScout24
async function scrapeImmobilienScout24(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const data = {};

        // Extract purchase price
        const kaufpreisText = $('[data-qa="expose-price"]').first().text() || 
                             $('.is24qa-kaufpreis').first().text() ||
                             $('dd[class*="kaufpreis"]').first().text();
        data.kaufpreis = extractPrice(kaufpreisText);

        // Extract rent (for investment properties)
        const mieteinnahmenText = $('[data-qa="mieteinnahmen"]').text() ||
                                  $('.is24qa-mieteinnahmen').text() ||
                                  $('dd:contains("Mieteinnahmen")').text();
        if (mieteinnahmenText) {
            const yearlyRent = extractPrice(mieteinnahmenText);
            data.miete = yearlyRent ? Math.round(yearlyRent / 12) : null;
        }

        // Extract rooms (to estimate rent if not available)
        const roomsText = $('[data-qa="expose-zimmer"]').text() || 
                         $('.is24qa-zimmer').text();
        const rooms = parseFloat(roomsText);

        // Extract area
        const areaText = $('[data-qa="expose-wohnflaeche"]').text() || 
                        $('.is24qa-wohnflaeche').text();
        const area = extractArea(areaText);

        // If rent not found, estimate it (rough estimate: 8-12 EUR per sqm in Germany)
        if (!data.miete && data.kaufpreis && area) {
            const estimatedRentPerSqm = 10; // Average estimate
            data.miete = Math.round(area * estimatedRentPerSqm);
        } else if (!data.miete && data.kaufpreis) {
            // Fallback: estimate based on typical 4-5% annual yield
            data.miete = Math.round((data.kaufpreis * 0.04) / 12);
        }

        // Calculate typical German transaction costs (10-15%)
        if (data.kaufpreis) {
            data.nebenkosten = Math.round(data.kaufpreis * 0.10); // 10% is typical
        }

        // Estimate renovation costs (typically 5-10% of purchase price for older properties)
        if (data.kaufpreis) {
            data.renovierung = Math.round(data.kaufpreis * 0.05);
        }

        // Estimate property tax (Grundsteuer) - roughly 0.15% of purchase price annually
        if (data.kaufpreis) {
            data.grundsteuer = Math.round(data.kaufpreis * 0.0015);
        }

        // Estimate management costs (roughly 0.4% of purchase price annually)
        if (data.kaufpreis) {
            data.verwaltung = Math.round(data.kaufpreis * 0.004);
        }

        return data;
    } catch (error) {
        console.error('Scraping error:', error.message);
        throw new Error('Fehler beim Extrahieren der Daten. Die Website könnte nicht erreichbar sein oder Zugriff verweigern.');
    }
}

// Scraping function for Immowelt
async function scrapeImmowelt(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        
        const $ = cheerio.load(response.data);
        const data = {};

        // Extract purchase price
        const kaufpreisText = $('[data-test="price"]').first().text() ||
                             $('.price-value').first().text();
        data.kaufpreis = extractPrice(kaufpreisText);

        // Extract area
        const areaText = $('[data-test="area"]').text() ||
                        $('.hardfact:contains("Wohnfläche")').next().text();
        const area = extractArea(areaText);

        // Estimate monthly rent
        if (!data.miete && data.kaufpreis && area) {
            const estimatedRentPerSqm = 10;
            data.miete = Math.round(area * estimatedRentPerSqm);
        } else if (!data.miete && data.kaufpreis) {
            data.miete = Math.round((data.kaufpreis * 0.04) / 12);
        }

        // Calculate transaction costs
        if (data.kaufpreis) {
            data.nebenkosten = Math.round(data.kaufpreis * 0.10);
            data.renovierung = Math.round(data.kaufpreis * 0.05);
            data.grundsteuer = Math.round(data.kaufpreis * 0.0015);
            data.verwaltung = Math.round(data.kaufpreis * 0.004);
        }

        return data;
    } catch (error) {
        console.error('Scraping error:', error.message);
        throw new Error('Fehler beim Extrahieren der Daten. Die Website könnte nicht erreichbar sein oder Zugriff verweigern.');
    }
}

// API endpoint to extract property data
app.post('/api/extract', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ 
                error: 'URL ist erforderlich' 
            });
        }

        let data;

        // Determine which scraper to use based on URL
        if (url.includes('immobilienscout24.de')) {
            data = await scrapeImmobilienScout24(url);
        } else if (url.includes('immowelt.de')) {
            data = await scrapeImmowelt(url);
        } else {
            return res.status(400).json({ 
                error: 'Diese Website wird noch nicht unterstützt. Unterstützte Websites: ImmobilienScout24, Immowelt' 
            });
        }

        // Validate that we got at least the purchase price
        if (!data.kaufpreis) {
            return res.status(404).json({ 
                error: 'Kaufpreis konnte nicht extrahiert werden. Bitte überprüfen Sie die URL.' 
            });
        }

        res.json(data);
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ 
            error: error.message || 'Fehler beim Extrahieren der Immobiliendaten' 
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend API läuft' });
});

app.listen(PORT, () => {
    console.log(`Backend-Server läuft auf Port ${PORT}`);
    console.log(`API verfügbar unter: http://localhost:${PORT}/api/extract`);
});
