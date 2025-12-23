const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('./controllers/authController.js');
const { authenticateToken } = require('./authMiddleware.js');

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/dashboard', authenticateToken, (req, res) => {
  res.send('Welcome to your dashboard');
});

module.exports = router;