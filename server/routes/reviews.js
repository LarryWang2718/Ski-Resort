const express = require('express');
const router = express.Router( { mergeParams: true });
const { protect, admin } = require('../middleware/auth');
const controller = require('../controllers/reviewController');

router
    .route('/resort/:resortId')
    .get(controller.getResortReviews)
    .post(protect, controller.createReview);

router.get('/resort/:resortId/stats', controller.getResortReviewsStats);
router
    .route('/:reviewId')
    .put(protect, controller.updateReview)
    .delete(protect, controller.deleteReview);

router.post('/:reviewId/helpful', protect, controller.voteHelpful);