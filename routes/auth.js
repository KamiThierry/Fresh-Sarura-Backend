import express from 'express';
import {
    login, createUser, getMe, updateMe,
    updatePassword, forgotPassword, resetPassword,
    getAllUsers, updateUser, deleteUser, permanentlyDeleteUser,
    updateProfile, verifyOtp
} from '../controllers/authController.js';
import { protect, restrictTo } from '../middleware/authMiddleware.js';

const router = express.Router();


router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/create-user', protect, restrictTo('admin'), createUser);
router.get('/me', protect, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.patch('/me', protect, updateMe);
router.patch('/profile', protect, updateProfile);
router.patch('/update-password', protect, updatePassword);

// User management (Admin only)
router.get('/users', protect, restrictTo('admin'), getAllUsers);
router.patch('/users/:id', protect, restrictTo('admin'), updateUser);
router.delete('/users/:id', protect, restrictTo('admin'), deleteUser);
router.delete('/users/:id/permanent', protect, restrictTo('admin'), permanentlyDeleteUser);

export default router;