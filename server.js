const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const app = express();
app.use(cors({
  origin: 'https://final-project-sepia-delta.vercel.app'
}));
app.use(bodyParser.json());

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Home route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/index.html'));
});

// Initialize SQLite database
const db = new sqlite3.Database('./kilimo.db', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to SQLite database.');

        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fullName TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL
                )
            `);
            db.run(`
                CREATE TABLE IF NOT EXISTS success_stories (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    author TEXT NOT NULL,
                    story TEXT NOT NULL,
                    image TEXT
                )
            `);
            db.run(`
                CREATE TABLE IF NOT EXISTS tips (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    image TEXT
                )
            `);
        });
    }
});

// Signup route
app.post('/signup', async (req, res) => {
    const { fullName, phone, email, password } = req.body;

    if (!fullName || !phone || !email || !password) {
        return res.status(400).json({ message: 'Please fill in all fields.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const hashedPassword = await bcrypt.hash(password, 10);

    const insertQuery = `
        INSERT INTO users (fullName, phone, email, password)
        VALUES (?, ?, ?, ?)
    `;

    db.run(insertQuery, [fullName, phone, normalizedEmail, hashedPassword], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint')) {
                return res.status(409).json({ message: 'Email is already registered.' });
            }
            return res.status(500).json({ message: 'Signup error: ' + err.message });
        }
        res.status(201).json({ message: 'Signup successful!' });
    });
});

// Login route
app.post('/index', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please provide email and password.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail], async (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Login error: ' + err.message });
        }

        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid email or password.' });
        }

        // Send user info (add avatar if you have it in your DB)
        res.status(200).json({ 
            message: 'Login successful!',
            user: {
                username: user.username,
                avatar: user.avatar // or user.image, depending on your DB column
            }
        });
    });
});

// Password recovery route
app.post('/recover-password', async (req, res) => {
    const email = req.body.email.trim().toLowerCase();
    const newPassword = req.body.newPassword;

    if (!email || !newPassword) {
        return res.status(400).json({ message: 'Please provide all required fields.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            return res.status(500).json({ message: 'Error checking user.' });
        }

        if (!user) {
            return res.status(404).json({ message: 'Email not found.' });
        }

        db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email], function (err) {
            if (err) {
                return res.status(500).json({ message: 'Error updating password.' });
            }
            if (this.changes === 0) {
                return res.status(400).json({ message: 'Password update failed.' });
            }
            res.status(200).json({ message: 'Password updated successfully!' });
        });
    });
});

// Fetch success stories
app.get('/success-stories', (req, res) => {
    db.all('SELECT * FROM success_stories', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching success stories.' });
        }
        res.status(200).json({ stories: rows });
    });
});

// Fetch tips
app.get('/tips', (req, res) => {
    db.all('SELECT * FROM tips', [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching tips.' });
        }
        res.status(200).json({ tips: rows });
    });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
