const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const dayjs = require('dayjs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'inhaber@kuechen-obermeier.de';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-secret-soon';
let ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || null;

if (!ADMIN_PASSWORD_HASH && process.env.ADMIN_PASSWORD) {
  ADMIN_PASSWORD_HASH = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = `${Date.now()}-${uuidv4()}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 8
    }
  })
);

const transporter = (() => {
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_PORT) {
    return null;
  }
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined
  });
})();

function loadTickets() {
  try {
    const file = fs.readFileSync(TICKETS_FILE, 'utf8');
    return JSON.parse(file);
  } catch (error) {
    return [];
  }
}

function saveTickets(tickets) {
  fs.writeFileSync(TICKETS_FILE, JSON.stringify(tickets, null, 2));
}

function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.isAuthenticated) {
    return next();
  }
  return res.redirect('/login');
}

function buildTicketNumber(orderNumber, existingTickets) {
  const siblings = existingTickets.filter((ticket) => ticket.orderNumber === orderNumber);
  const sequence = siblings.length + 1;
  return `${orderNumber}R${String(sequence).padStart(3, '0')}`;
}

async function sendConfirmationEmail(ticket) {
  if (!transporter) {
    console.info('SMTP configuration missing. Confirmation email logged instead.', ticket.ticketNumber);
    return;
  }

  const customerName = ticket.customerName.split(' ')[0] || ticket.customerName;
  const itemsList = ticket.items
    .map((item, index) => `#${index + 1}: ${item.area ? item.area + ' – ' : ''}${item.description}`)
    .join('\n');

  const mailOptions = {
    from: process.env.MAIL_FROM || `Küchen Obermeier <${process.env.SMTP_USER}>`,
    to: ticket.email,
    subject: `Ihre Reklamation ${ticket.ticketNumber} bei Küchen Obermeier`,
    text: `Hallo ${customerName},\n\nherzlichen Dank für Ihre Nachricht. Wir haben das Ticket ${ticket.ticketNumber} erhalten.\n\nAuftrag: ${ticket.orderNumber}\nErhalten am: ${dayjs(ticket.createdAt).format('DD.MM.YYYY HH:mm')} Uhr\n\nDetails:\n${itemsList}\n\nSie hören schnellstmöglich von uns. Für Rückfragen antworten Sie bitte mit der Ticketnummer ${ticket.ticketNumber}.\n\nViele Grüße\nIhr Team von Küchen Obermeier`,
    html: `<p>Hallo ${customerName},</p>
      <p>herzlichen Dank für Ihre Nachricht. Wir haben das Ticket <strong>${ticket.ticketNumber}</strong> erhalten.</p>
      <p><strong>Auftrag:</strong> ${ticket.orderNumber}<br/>
      <strong>Erhalten am:</strong> ${dayjs(ticket.createdAt).format('DD.MM.YYYY HH:mm')} Uhr</p>
      <p><strong>Details:</strong></p>
      <ol>${ticket.items
        .map(
          (item) =>
            `<li>${item.area ? `<strong>${item.area}</strong>: ` : ''}${item.description}${
              item.photo?.originalName ? ` (Foto: ${item.photo.originalName})` : ''
            }</li>`
        )
        .join('')}</ol>
      <p>Sie hören schnellstmöglich von uns. Für Rückfragen antworten Sie bitte mit der Ticketnummer <strong>${ticket.ticketNumber}</strong>.</p>
      <p>Viele Grüße<br/>Ihr Team von Küchen Obermeier</p>`
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('E-Mail Versand fehlgeschlagen', error);
  }
}

app.get('/', (req, res) => {
  res.render('home', { year: new Date().getFullYear() });
});

app.get('/reklamation', (req, res) => {
  res.render('reklamation');
});

app.post('/api/reklamationen', upload.any(), async (req, res) => {
  try {
    const { orderNumber, customerName, phone, email, preferredContact, installationDate, notes } = req.body;

    if (!orderNumber || !customerName || !phone || !email) {
      return res.status(400).json({ message: 'Bitte füllen Sie alle Pflichtfelder aus.' });
    }

    let itemsData = req.body.items || [];
    if (!Array.isArray(itemsData)) {
      itemsData = [itemsData];
    }

    if (!itemsData.length) {
      return res.status(400).json({ message: 'Bitte fügen Sie mindestens eine Reklamation hinzu.' });
    }

    const fileMap = {};
    req.files.forEach((file) => {
      const match = file.fieldname.match(/items\[(\d+)\]\[photo\]/);
      if (match) {
        fileMap[Number(match[1])] = {
          storedName: file.filename,
          path: `/uploads/${file.filename}`,
          originalName: file.originalname
        };
      }
    });

    const tickets = loadTickets();
    const ticketNumber = buildTicketNumber(orderNumber, tickets);

    for (let i = 0; i < itemsData.length; i += 1) {
      if (!fileMap[i]) {
        return res.status(400).json({
          message: 'Bitte laden Sie für jede Reklamation ein Foto hoch.'
        });
      }
    }

    const items = itemsData.map((item, index) => ({
      area: item.area || '',
      description: item.description || '',
      photo: fileMap[index]
    }));

    const ticket = {
      id: uuidv4(),
      ticketNumber,
      orderNumber,
      customerName,
      phone,
      email,
      preferredContact: preferredContact || 'telefon',
      installationDate: installationDate || null,
      notes: notes || '',
      items,
      status: 'new',
      createdAt: new Date().toISOString()
    };

    tickets.push(ticket);
    saveTickets(tickets);

    sendConfirmationEmail(ticket);

    res.json({ success: true, ticketNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Es ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.' });
  }
});

app.get('/login', (req, res) => {
  if (req.session && req.session.isAuthenticated) {
    return res.redirect('/admin');
  }
  res.render('login', { error: null, email: '' });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const errorMessage = 'Login fehlgeschlagen. Bitte prüfen Sie Ihre Daten.';

  if (!ADMIN_PASSWORD_HASH) {
    return res.render('login', {
      error: 'Es ist kein Administratorpasswort konfiguriert. Bitte setzen Sie ADMIN_PASSWORD oder ADMIN_PASSWORD_HASH.',
      email
    });
  }

  if (email !== ADMIN_EMAIL) {
    return res.render('login', { error: errorMessage, email });
  }

  if (!bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.render('login', { error: errorMessage, email });
  }

  req.session.isAuthenticated = true;
  req.session.adminEmail = email;

  res.redirect('/admin');
});

app.post('/logout', ensureAuthenticated, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/admin', ensureAuthenticated, (req, res) => {
  const tickets = loadTickets()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.render('admin', { tickets, dayjs });
});

app.get('/admin/tickets/:id', ensureAuthenticated, (req, res) => {
  const tickets = loadTickets();
  const ticket = tickets.find((t) => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).send('Ticket nicht gefunden');
  }
  res.render('ticket', { ticket, dayjs });
});

app.post('/admin/tickets/:id/status', ensureAuthenticated, (req, res) => {
  const { status } = req.body;
  const tickets = loadTickets();
  const ticketIndex = tickets.findIndex((ticket) => ticket.id === req.params.id);
  if (ticketIndex === -1) {
    return res.status(404).json({ message: 'Ticket nicht gefunden.' });
  }

  tickets[ticketIndex].status = status;
  tickets[ticketIndex].updatedAt = new Date().toISOString();
  saveTickets(tickets);

  res.redirect('/admin');
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
