const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

// Constants for estimation calculations
const ESTIMATED_RENT_PER_SQM = 10; // EUR per square meter (German average)
const TYPICAL_ANNUAL_YIELD = 0.04; // 4% annual yield
const TRANSACTION_COST_RATE = 0.10; // 10% transaction costs (typical in Germany)
const RENOVATION_RATE = 0.05; // 5% for renovation
const PROPERTY_TAX_RATE = 0.0015; // 0.15% annually
const MANAGEMENT_COST_RATE = 0.004; // 0.4% annually

// User agent for web scraping
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Helper function to extract price from text
function extractPrice(text) {
    if (!text) return null;
    // Remove all non-numeric characters except comma and dot
    const cleaned = text.replace(/[^\d,.]/g, '');
    // Replace all commas with dots for decimal
    const normalized = cleaned.replace(/,/g, '.');
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

// Helper function to calculate estimated costs
function calculateEstimatedCosts(kaufpreis) {
    return {
        nebenkosten: Math.round(kaufpreis * TRANSACTION_COST_RATE),
        renovierung: Math.round(kaufpreis * RENOVATION_RATE),
        grundsteuer: Math.round(kaufpreis * PROPERTY_TAX_RATE),
        verwaltung: Math.round(kaufpreis * MANAGEMENT_COST_RATE)
    };
}

// Helper function to estimate monthly rent
function estimateMonthlyRent(kaufpreis, area) {
    if (area) {
        return Math.round(area * ESTIMATED_RENT_PER_SQM);
    }
    // Fallback: estimate based on typical yield
    return Math.round((kaufpreis * TYPICAL_ANNUAL_YIELD) / 12);
}

// Scraping function for ImmobilienScout24
async function scrapeImmobilienScout24(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': USER_AGENT
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

        // Extract area
        const areaText = $('[data-qa="expose-wohnflaeche"]').text() || 
                        $('.is24qa-wohnflaeche').text();
        const area = extractArea(areaText);

        // If rent not found, estimate it
        if (!data.miete && data.kaufpreis) {
            data.miete = estimateMonthlyRent(data.kaufpreis, area);
        }

        // Calculate estimated costs
        if (data.kaufpreis) {
            const costs = calculateEstimatedCosts(data.kaufpreis);
            Object.assign(data, costs);
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
                'User-Agent': USER_AGENT
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
        if (!data.miete && data.kaufpreis) {
            data.miete = estimateMonthlyRent(data.kaufpreis, area);
        }

        // Calculate estimated costs
        if (data.kaufpreis) {
            const costs = calculateEstimatedCosts(data.kaufpreis);
            Object.assign(data, costs);
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

        // Parse URL and determine which scraper to use
        const urlObj = new URL(url);
        const hostname = urlObj.hostname.toLowerCase();
        
        if (hostname.includes('immobilienscout24.de')) {
            data = await scrapeImmobilienScout24(url);
        } else if (hostname.includes('immowelt.de')) {
            data = await scrapeImmowelt(url);
        } else {
            return res.status(400).json({ 
                error: 'Diese Website wird noch nicht unterstützt. Unterstützte Websites: ImmobilienScout24, Immowelt' 
            });
        }

        // Validate that we got at least the purchase price
        if (!data.kaufpreis) {
            return res.status(422).json({ 
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
