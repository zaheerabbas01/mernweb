const express = require('express');
const router = express.Router();

router.get('/:productId', (req, res) => {
    res.json({ message: 'Get reviews endpoint - implementation needed' });
});

router.post('/', (req, res) => {
    res.json({ message: 'Create review endpoint - implementation needed' });
});

module.exports = router;
