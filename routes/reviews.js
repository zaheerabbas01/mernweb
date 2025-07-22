const express = require('express');
const router = express.Router();

// @route   GET /api/reviews/:productId
// @desc    Get product reviews
// @access  Public
router.get('/:productId', (req, res) => {
    res.json({ message: 'Get reviews endpoint - implementation needed' });
});

// @route   POST /api/reviews
// @desc    Create review
// @access  Private
router.post('/', (req, res) => {
    res.json({ message: 'Create review endpoint - implementation needed' });
});

module.exports = router;