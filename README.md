# Küchen Obermeier Serviceportal

Eine Full-Stack-Webanwendung für Küchen Obermeier mit moderner Landingpage, digitalem Reklamationsformular und internem Service-Cockpit.

## Funktionen

### Kundenseite
- Landingpage inspiriert von der bestehenden Unternehmensseite
- Responsives Reklamationsformular mit Unterstützung für mehrere Mängel pro Ticket
- Smartphone-optimierte Fotoaufnahme (Kamera-Button über `capture="environment"`)
- Automatische Ticketnummer (Auftragsnummer + laufende Reklamationsnummer)
- Bestätigungsmeldung direkt nach dem Absenden und Versand einer E-Mail (SMTP erforderlich)

### Backoffice
- Geschützter Login-Bereich (E-Mail + Passwort)
- Ticketübersicht mit Status-Farbcodierung (Offen, In Bearbeitung, Bestellt, Erledigt)
- Detailansicht je Ticket inklusive Kontaktinfos, Notizen und Bildanhang
- Statuswechsel direkt aus der Tabelle oder Detailansicht

### Architektur
- Node.js + Express mit EJS-Templates
- Dateibasierte Persistenz (`data/tickets.json`)
- Dateiuploads werden in `uploads/` abgelegt und über `/uploads/...` ausgeliefert
- Nodemailer-Integration für SMTP-basierte Bestätigungs-E-Mails

## Installation

```bash
npm install
```

## Entwicklung & Betrieb

```bash
npm run dev   # startet den Server auf http://localhost:3000
npm start     # Produktion (ohne automatische Neustarts)
```

## Konfiguration

Um Anmeldung und E-Mail-Versand zu aktivieren, legen Sie eine `.env`-Datei an:

```ini
PORT=3000
SESSION_SECRET=ein-sicherer-string
ADMIN_EMAIL=inhaber@kuechen-obermeier.de
ADMIN_PASSWORD=einGeheimesPasswort
# oder alternativ: ADMIN_PASSWORD_HASH=$2a$10$...

# SMTP-Konfiguration (optional, für den E-Mail-Versand)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=mailer@example.com
SMTP_PASS=sehrGeheim
MAIL_FROM="Küchen Obermeier <service@kuechen-obermeier.de>"
```

> Hinweis: Wird kein SMTP-Server konfiguriert, werden Bestätigungen lediglich im Server-Log vermerkt.

## Datenhaltung

- Tickets werden in `data/tickets.json` als Array gespeichert.
- Anhänge werden unter `uploads/` abgelegt. Für ein frisches Deployment sollten bestehende Uploads gesichert werden.

## Sicherheitshinweise

- Setzen Sie in der Produktion unbedingt eigene Werte für `SESSION_SECRET` und `ADMIN_PASSWORD(_HASH)`.
- Schützen Sie `data/` und `uploads/` auf Serverebene (Backups, Zugriffsrechte).
- Aktivieren Sie HTTPS, um Dateiuploads sowie Login-Daten zu schützen.

## Erweiterbarkeit

Die Codebasis ist modular aufgebaut. Neue Features (z. B. Kalenderintegration, KI-gestützte Kommunikation oder weitere Statuswerte) können über zusätzliche Routen, Views oder API-Endpunkte ergänzt werden.
