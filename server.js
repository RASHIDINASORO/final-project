const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer'); // email line

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
        console.log('Using database file:', require('path').resolve('./kilimo.db'));


        db.serialize(() => {
            db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    fullName TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    specialization TEXT
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
            db.run(`
                CREATE TABLE IF NOT EXISTS products (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    price TEXT NOT NULL,
                    image TEXT NOT NULL,
                    category TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            db.run(`
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    product_id INTEGER,
                    quantity INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users (id),
                    FOREIGN KEY (product_id) REFERENCES products (id)
                )
            `);
            db.run(`
                CREATE TABLE IF NOT EXISTS market_prices (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    price TEXT NOT NULL,
                    image TEXT,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

// In-memory store for recovery codes
const recoveryCodes = {};

// Utility to generate a 6-digit code
function generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Configure nodemailer transporter 
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'rashidinasoro912@gmail.com', // Gmail
        pass: 'plih uypr mcsk zrjy'         //  App Password 
    }
});

// Send recovery email using nodemailer
function sendRecoveryEmail(email, code) {
    const mailOptions = {
        from: '"Kilimolink Support" <rashidinasoro912gmail.com>',
        to: email,
        subject: 'Your Kilimolink Password Recovery Code',
        text: `Your password recovery code is: ${code}\n\nThis code will expire in 10 minutes.`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending recovery email:', error);
        } else {
            console.log('Recovery email sent:', info.response);
        }
    });
}

// Step 1: Send recovery code to user's email
app.post('/send-recovery-code', (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    console.log('Received password recovery request for:', email); // Debug log

    if (!email) {
        return res.status(400).json({ message: 'Email is required.' });
    }

    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ message: 'Database error.' });
        }
        if (!user) {
            console.log('Email not found:', email);
            return res.status(404).json({ message: 'Email not found.' });
        }

        const code = generateCode();
        recoveryCodes[email] = { code, expires: Date.now() + 10 * 60 * 1000 };

        sendRecoveryEmail(email, code);

        res.status(200).json({ message: 'Recovery code sent to your email.' });
    });
});

// Step 2: Verify code and reset password
app.post('/verify-recovery-code', async (req, res) => {
    const email = (req.body.email || '').trim().toLowerCase();
    const code = (req.body.code || '').trim();
    const newPassword = req.body.newPassword;

    if (!email || !code || !newPassword) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    const record = recoveryCodes[email];
    if (!record || record.code !== code || Date.now() > record.expires) {
        return res.status(400).json({ message: 'Invalid or expired code.' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email], function (err) {
        if (err) {
            return res.status(500).json({ message: 'Error updating password.' });
        }
        delete recoveryCodes[email];
        res.status(200).json({ message: 'Password reset successful!' });
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

// Add product route
app.post('/api/products', (req, res) => {
    const { name, price, image, category, phone } = req.body;
    if (!name || !price || !image || !category || !phone) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    db.run(
        'INSERT INTO products (name, price, image, category, phone) VALUES (?, ?, ?, ?, ?)',
        [name, price, image, category, phone],
        function (err) {
            if (err) {
                return res.status(500).json({ message: 'Error saving product.' });
            }
            res.status(201).json({ message: 'Product uploaded successfully!' });
        }
    );
});

// Get products by category
app.get('/api/products/:category', (req, res) => {
    const category = req.params.category;
    db.all('SELECT * FROM products WHERE category = ? ORDER BY created_at DESC', [category], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: 'Error fetching products.' });
        }
        res.status(200).json({ products: rows });
    });
});

// Get all products
app.get('/api/products/all', (req, res) => {
    db.all('SELECT * FROM products ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching products.' });
        res.json({ products: rows });
    });
});

// Update product
app.put('/api/products/:id', (req, res) => {
    const { name, price, image, category } = req.body;
    const { id } = req.params;
    if (!name || !price || !image || !category) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    db.run(
        'UPDATE products SET name=?, price=?, image=?, category=? WHERE id=?',
        [name, price, image, category, id],
        function (err) {
            if (err) return res.status(500).json({ message: 'Error updating product.' });
            res.json({ message: 'Product updated successfully!' });
        }
    );
});

// Delete product
app.delete('/api/products/:id', (req, res) => {
    db.run('DELETE FROM products WHERE id=?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ message: 'Error deleting product.' });
        res.json({ message: 'Product deleted successfully!' });
    });
});

// Get all users
app.get('/api/users', (req, res) => {
    db.all('SELECT id, fullName, phone, email, role FROM users ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching users.' });
        res.json({ users: rows });
    });
});

// Add user
app.post('/api/users', async (req, res) => {
    const { fullName, phone, email, password, role } = req.body;
    if (!fullName || !phone || !email || !password) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run(
        'INSERT INTO users (fullName, phone, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [fullName, phone, email.trim().toLowerCase(), hashedPassword, role || 'user'],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint')) {
                    return res.status(409).json({ message: 'Email is already registered.' });
                }
                return res.status(500).json({ message: 'Error adding user.' });
            }
            res.status(201).json({ message: 'User added successfully!' });
        }
    );
});

// Update user
app.put('/api/users/:id', async (req, res) => {
    const { fullName, phone, email, password, role } = req.body;
    const { id } = req.params;
    if (!fullName || !phone || !email) {
        return res.status(400).json({ message: 'All fields are required.' });
    }
    let query, params;
    if (password) {
        const hashedPassword = await bcrypt.hash(password, 10);
        query = 'UPDATE users SET fullName=?, phone=?, email=?, password=?, role=? WHERE id=?';
        params = [fullName, phone, email.trim().toLowerCase(), hashedPassword, role || 'user', id];
    } else {
        query = 'UPDATE users SET fullName=?, phone=?, email=?, role=? WHERE id=?';
        params = [fullName, phone, email.trim().toLowerCase(), role || 'user', id];
    }
    db.run(query, params, function (err) {
        if (err) return res.status(500).json({ message: 'Error updating user.' });
        res.json({ message: 'User updated successfully!' });
    });
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
    db.run('DELETE FROM users WHERE id=?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ message: 'Error deleting user.' });
        res.json({ message: 'User deleted successfully!' });
    });
});

// Get all orders (join with users and products for names)
app.get('/api/orders/all', (req, res) => {
    db.all(`
        SELECT orders.id, users.fullName as user_name, products.name as product_name, orders.status, orders.created_at
        FROM orders
        LEFT JOIN users ON orders.user_id = users.id
        LEFT JOIN products ON orders.product_id = products.id
        ORDER BY orders.created_at DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching orders.' });
        res.json({ orders: rows });
    });
});

// Get all success stories
app.get('/api/success_stories', (req, res) => {
    db.all('SELECT * FROM success_stories ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching stories.' });
        res.json({ stories: rows });
    });
});

// Add a new success story
app.post('/api/success_stories', (req, res) => {
    const { author, story, image } = req.body;
    if (!author || !story) {
        return res.status(400).json({ message: 'Author and story are required.' });
    }
    db.run(
        'INSERT INTO success_stories (author, story, image) VALUES (?, ?, ?)',
        [author, story, image],
        function (err) {
            if (err) return res.status(500).json({ message: 'Error adding story.' });
            res.json({ message: 'Story added successfully!' });
        }
    );
});

// Get all tips
app.get('/api/tips', (req, res) => {
    db.all('SELECT * FROM tips ORDER BY id DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching tips.' });
        res.json({ tips: rows });
    });
});

// Get all experts
app.get('/api/experts', (req, res) => {
    db.all(
        `SELECT fullName as name, specialization, phone, email FROM users WHERE role = 'expert'`,
        [],
        (err, rows) => {
            if (err) return res.status(500).json({ message: 'Error fetching experts.' });
            res.json({ experts: rows });
        }
    );
});

// Get all market prices
app.get('/api/market_prices', (req, res) => {
    db.all('SELECT * FROM market_prices ORDER BY name ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ message: 'Error fetching market prices.' });
        res.json({ prices: rows });
    });
});

// Add a new market price
app.post('/api/market_prices', (req, res) => {
    const { name, price, image } = req.body;
    if (!name || !price) {
        return res.status(400).json({ message: 'Name and price are required.' });
    }
    db.run(
        'INSERT INTO market_prices (name, price, image) VALUES (?, ?, ?)',
        [name, price, image],
        function (err) {
            if (err) return res.status(500).json({ message: 'Error adding price.' });
            res.json({ message: 'Market price added successfully!' });
        }
    );
});

// Update a market price
app.put('/api/market_prices/:id', (req, res) => {
    const { name, price, image } = req.body;
    db.run(
        'UPDATE market_prices SET name=?, price=?, image=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
        [name, price, image, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ message: 'Error updating price.' });
            res.json({ message: 'Market price updated successfully!' });
        }
    );
});

// Delete a market price
app.delete('/api/market_prices/:id', (req, res) => {
    db.run('DELETE FROM market_prices WHERE id=?', [req.params.id], function (err) {
        if (err) return res.status(500).json({ message: 'Error deleting price.' });
        res.json({ message: 'Market price deleted successfully!' });
    });
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
