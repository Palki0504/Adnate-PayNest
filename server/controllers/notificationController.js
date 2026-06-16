const Notification = require('../models/Notification');
const User = require('../models/User');

// ─── @desc    Get notifications for current user
// ─── @route   GET /api/notifications
// ─── @access  Protected
const getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      Notification.countDocuments({ userId: req.user._id }),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);

    res.status(200).json({
      success: true,
      notifications,
      unreadCount,
      pagination: {
        currentPage: pageNum,
        totalPages: Math.ceil(total / limitNum),
        total,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Mark notification as read
// ─── @route   PUT /api/notifications/:id/read
// ─── @access  Protected
const markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }

    res.status(200).json({ success: true, message: 'Marked as read.', notification });
  } catch (error) {
    next(error);
  }
};

// ─── @desc    Mark all notifications as read
// ─── @route   PUT /api/notifications/read-all
// ─── @access  Protected
const markAllAsRead = async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    next(error);
  }
};

const getManagerMessageCustomers = async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const query = { role: 'customer', isActive: true, approvalStatus: 'approved' };

    if (search.trim()) {
      query.$or = [
        { name: { $regex: search.trim(), $options: 'i' } },
        { email: { $regex: search.trim(), $options: 'i' } },
        { customerId: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const customers = await User.find(query)
      .select('name email customerId')
      .sort({ name: 1 })
      .limit(200);

    res.status(200).json({ success: true, customers });
  } catch (error) {
    next(error);
  }
};

const sendManagerCustomerMessage = async (req, res, next) => {
  try {
    const { targetCustomerId, priority = 'medium', title, message } = req.body;

    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ success: false, message: 'Notification title and message are required.' });
    }

    if (!['low', 'medium', 'high'].includes(priority)) {
      return res.status(400).json({ success: false, message: 'Priority must be low, medium, or high.' });
    }

    const userQuery = { role: 'customer', isActive: true, approvalStatus: 'approved' };
    const targetGroup = targetCustomerId === 'all_customers' ? 'all_customers' : 'single_customer';

    if (targetCustomerId && targetCustomerId !== 'all_customers') {
      userQuery._id = targetCustomerId;
    }

    if (!targetCustomerId) {
      return res.status(400).json({ success: false, message: 'Target customer or customer group is required.' });
    }

    const customers = await User.find(userQuery).select('_id');
    if (customers.length === 0) {
      return res.status(404).json({ success: false, message: 'No active customer found for this message.' });
    }

    const notifications = customers.map((customer) => ({
      userId: customer._id,
      title: title.trim(),
      message: message.trim(),
      type: 'info',
      priority,
      senderId: req.user._id,
      senderName: req.user.name || 'Manager',
      senderRole: 'manager',
      targetGroup,
    }));

    await Notification.insertMany(notifications);

    res.status(201).json({
      success: true,
      message: `Message sent to ${customers.length} customer${customers.length === 1 ? '' : 's'}.`,
      count: customers.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getManagerMessageCustomers,
  sendManagerCustomerMessage,
};
