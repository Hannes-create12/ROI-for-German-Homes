# Backend Setup - ROI-Rechner mit echten Daten

Dieses Backend ermöglicht die automatische Extraktion von echten Immobiliendaten von unterstützten Websites.

## 🚀 Schnellstart

### Voraussetzungen
- Node.js (Version 14 oder höher)
- npm (kommt mit Node.js)

### Installation

1. **Abhängigkeiten installieren:**
```bash
npm install
```

2. **Server starten:**
```bash
npm start
```

Der Server läuft dann auf `http://localhost:3000`

### Entwicklungsmodus

Für Entwicklung mit Auto-Reload:
```bash
npm run dev
```

## 📋 Unterstützte Websites

Aktuell werden folgende Immobilienportale unterstützt:
- ✅ ImmobilienScout24 (immobilienscout24.de)
- ✅ Immowelt (immowelt.de)

## 🔧 API Endpunkte

### POST /api/extract

Extrahiert Immobiliendaten von einer URL.

**Request Body:**
```json
{
  "url": "https://www.immobilienscout24.de/expose/12345"
}
```

**Response (Erfolg):**
```json
{
  "kaufpreis": 340000,
  "miete": 1240,
  "nebenkosten": 34000,
  "renovierung": 17000,
  "grundsteuer": 510,
  "verwaltung": 1360
}
```

**Response (Fehler):**
```json
{
  "error": "Fehler beim Extrahieren der Daten..."
}
```

### GET /api/health

Health-Check Endpunkt zum Überprüfen ob der Server läuft.

**Response:**
```json
{
  "status": "ok",
  "message": "Backend API läuft"
}
```

## 📊 Funktionsweise

### Datenextraktion

1. **Kaufpreis**: Wird direkt von der Immobilien-Website extrahiert
2. **Miete**: Wird extrahiert oder basierend auf Fläche/Kaufpreis geschätzt
3. **Nebenkosten**: Geschätzt (ca. 10% des Kaufpreises)
4. **Renovierung**: Geschätzt (ca. 5% des Kaufpreises)
5. **Grundsteuer**: Geschätzt (ca. 0.15% des Kaufpreises jährlich)
6. **Verwaltung**: Geschätzt (ca. 0.4% des Kaufpreises jährlich)

### Schätzungen

Wenn bestimmte Daten nicht verfügbar sind, verwendet das System realistische Schätzungen basierend auf:
- Typischen deutschen Immobilienmarkt-Kennzahlen
- Kaufpreis der Immobilie
- Wohnfläche (wenn verfügbar)
- Regionale Durchschnittswerte

## ⚠️ Wichtige Hinweise

### Rechtliche Aspekte
- Web Scraping kann gegen die Nutzungsbedingungen von Websites verstoßen
- Prüfen Sie die Nutzungsbedingungen der Ziel-Websites
- Verwenden Sie das Tool nur für legale Zwecke
- Respektieren Sie robots.txt und Rate Limits

### Technische Limitierungen
- Websites können Anti-Scraping-Maßnahmen haben
- Website-Strukturen können sich ändern und das Scraping brechen
- Nicht alle Datenfelder sind auf allen Inseraten verfügbar
- Manche Websites laden Daten dynamisch per JavaScript (schwerer zu scrapen)

### Rate Limiting
- Zu viele Anfragen können zu IP-Blocking führen
- Fügen Sie bei Bedarf Verzögerungen zwischen Anfragen hinzu
- Verwenden Sie einen Proxy-Service für produktive Umgebungen

## 🔒 Sicherheit

### Produktionsempfehlungen

1. **Umgebungsvariablen verwenden:**
   - API-Keys
   - Port-Konfiguration
   - Logging-Level

2. **Rate Limiting hinzufügen:**
   ```bash
   npm install express-rate-limit
   ```

3. **HTTPS verwenden:**
   - Niemals unverschlüsselt in Produktion

4. **Error Handling verbessern:**
   - Keine sensiblen Informationen in Fehlermeldungen
   - Proper Logging implementieren

## 🛠️ Erweiterung

### Neue Website hinzufügen

1. Erstellen Sie eine neue Scraper-Funktion in `server.js`:
```javascript
async function scrapeNeueWebsite(url) {
    // Implementierung hier
}
```

2. Fügen Sie die Website zur URL-Erkennung hinzu:
```javascript
if (url.includes('neue-website.de')) {
    data = await scrapeNeueWebsite(url);
}
```

3. Testen Sie die Implementierung gründlich

## 📝 Troubleshooting

### Server startet nicht
- Prüfen Sie ob Port 3000 frei ist
- Überprüfen Sie Node.js Installation: `node --version`
- Löschen Sie `node_modules` und führen Sie `npm install` erneut aus

### Daten werden nicht extrahiert
- Überprüfen Sie die Konsole für Fehlermeldungen
- Testen Sie die URL manuell im Browser
- Website-Struktur könnte sich geändert haben
- Anti-Scraping-Maßnahmen könnten greifen

### CORS-Fehler
- Stellen Sie sicher, dass Frontend und Backend auf demselben Port laufen
- Oder konfigurieren Sie CORS richtig in `server.js`

## 📦 Dependencies

- **express**: Web-Framework für Node.js
- **cors**: CORS-Middleware
- **axios**: HTTP-Client für Requests
- **cheerio**: HTML-Parser für Web Scraping

## 🚢 Deployment

### Heroku
```bash
# Procfile erstellen
echo "web: node server.js" > Procfile

# Git Push zu Heroku
git push heroku main
```

### Railway/Render
- Automatische Erkennung von `package.json`
- Start-Command: `npm start`
- Port wird automatisch zugewiesen

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

## 📞 Support

Bei Fragen oder Problemen:
- Erstellen Sie ein Issue im Repository
- Überprüfen Sie die Console-Logs
- Testen Sie mit dem Health-Check Endpunkt
