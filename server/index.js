import express from 'express';
import cors from 'cors';
import db from './db.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for model data

// Register an account
app.post('/api/register', (req, res) => {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const sql = 'INSERT INTO users (email, password, name) VALUES (?, ?, ?)';
    db.run(sql, [email, password, name], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: 'User already exists' });
            }
            return res.status(500).json({ error: err.message });
        }

        // Auto-login after register
        res.json({
            message: 'User registered successfully',
            user: { id: this.lastID, email, name }
        });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }

    const sql = 'SELECT id, email, name, password FROM users WHERE email = ?';
    db.get(sql, [email], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        // Simple password check (PlainText as requested for demo)
        if (user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
            message: 'Login successful',
            user: { id: user.id, email: user.email, name: user.name }
        });
    });
});

// Get User Model
app.get('/api/models', (req, res) => {
    const { userId } = req.query;

    if (!userId) return res.status(400).json({ error: 'User ID required' });

    const sql = 'SELECT data, updated_at FROM models WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1';
    db.get(sql, [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        if (row && row.data) {
            try {
                const data = JSON.parse(row.data);
                res.json({ model: data, updatedAt: row.updated_at });
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse model data' });
            }
        } else {
            res.json({ model: null, updatedAt: null });
        }
    });
});

// Save User Model
app.post('/api/models', (req, res) => {
    const { userId, modelData } = req.body;

    if (!userId || !modelData) {
        return res.status(400).json({ error: 'User ID and model data required' });
    }

    // Check if model entry exists for user
    const checkSql = 'SELECT id FROM models WHERE user_id = ?';
    db.get(checkSql, [userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });

        const dataStr = JSON.stringify(modelData);

        if (row) {
            // Update existing
            const updateSql = 'UPDATE models SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?';
            db.run(updateSql, [dataStr, userId], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Model updated successfully' });
            });
        } else {
            // Insert new
            const insertSql = 'INSERT INTO models (user_id, data) VALUES (?, ?)';
            db.run(insertSql, [userId, dataStr], (err) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ message: 'Model saved successfully' });
            });
        }
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
