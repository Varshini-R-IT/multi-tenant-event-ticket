const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/me', requireAuth, authController.me);
router.get('/demo-accounts', authController.getDemoAccounts);

module.exports = router;
