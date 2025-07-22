const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'Get cart endpoint - implementation needed' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Add to cart endpoint - implementation needed' });
});

router.delete('/:id', (req, res) => {
    res.json({ message: 'Remove from cart endpoint - implementation needed' });
});

module.exports = router;
