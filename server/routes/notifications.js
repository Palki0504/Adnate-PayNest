const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// GET /api/notifications
router.get('/', protect, getNotifications);

// PUT /api/notifications/read-all
router.put('/read-all', protect, markAllAsRead);

// PUT /api/notifications/:id/read
router.put('/:id/read', protect, markAsRead);

module.exports = router;
