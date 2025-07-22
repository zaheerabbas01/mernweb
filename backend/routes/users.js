const express = require('express');
const router = express.Router();

router.get('/profile', (req, res) => {
    res.json({ message: 'Get user profile endpoint - implementation needed' });
});

router.put('/profile', (req, res) => {
    res.json({ message: 'Update user profile endpoint - implementation needed' });
});

module.exports = router;
