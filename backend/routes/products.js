const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Get products endpoint - implementation needed' });
});

router.get('/:id', (req, res) => {
    res.json({ message: 'Get single product endpoint - implementation needed' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create product endpoint - implementation needed' });
});

module.exports = router;
