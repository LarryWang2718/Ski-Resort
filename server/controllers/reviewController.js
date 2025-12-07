const Review = require("../models/Review");

const pickReviewFields = (input = {}) => {
    const allowedFields = [
        'rating',
        'categories',
        'title',
        'content',
        'visitDate',
        'visitDuration',
        'visitSeason',
        'skiLevel',
        'snowboardLevel',
        'groupType',
        'groupSize',
        'tripType',
        'accommodationType',
        'transportationMethod',
        'weatherDuringVisit',
        'favoriteTrails',
        'favoriteLifts',
        'wouldRecommendFor',
        'pros',
        'cons',
        'tips',
        'wouldReturn',
        'wouldRecommend',
        'isVerifiedVisit',
        'verificationMethod',
        'language',
        'reviewerLocation',
        'photos'
    ];

    return allowedFields.reduce((payload, field) => {
        if (input[field] !== undefined) {
            payload[field] = input[field];
        }
        return payload;
    }, {});
};

exports.createReview = async (req, res) => {
    try{
        const resortId = req.params.resortId || req.body.resort;
        const existing = await Review.findOne({ resort: resortId, user: req.user._id});
        if (existing){
            return res.status(400).json({success: false, message: 'You already created a review for this resort before'});
            }
        const review = await Review.create({
            ...pickReviewFields(req.body),
            resort: resortId,
            user: req.user._id
        });
        res.status(201).json( {success: true, data: review});
    } catch (error) {
        res.status(400).json( {success: false, message: error.message});
    }
};

exports.getResortReviews = async (req, res) => {
    try{
        const filters = {
            resort: req.params.resortId,
            isApproved: true,
            ...(req.query.skiLevel && { skiLevel: req.query.skiLevel}),
            ...(req.query.visitSeason && { viistSeason: req.query.visitSeason}),
        };
        const reviews = await Review.find(filters)
        .populate('user', 'firstName lastName')
        .sort({ publishAt: -1});
        res.json({ success: true, data: reviews});
    } catch (error) {
        res.status(500).json( {succcess: false, message: error.message} )
    }
};

exports.getResortReviewsStats = async (req, res) => {
    try{
        const [stats] = await Review.getResortStats(req.params.resortId);
        const distribution = await Review.getRatingDistribution(req.params.resortId);
        res.json( {success: true, data: stats || null, distribution: distribution || []});
    } catch (error) {
        res.status(500).json( {succcess: false, message: error.message} )
    }
};

exports.updateReview = async (req, res) => {
    try{
        const review = await Review.findOne({_id: req.params.reviewId, user: req.user._id});
        if (!review){
            return res.status(404).json({ success: false, message: 'Review not found.'});
        }
        Object.assign(review, pickReviewFields(req.body));
        await review.save();
        res.json({ success: true, data: review});
    } catch (error) {
        res.status(400).json( {succcess: false, message: error.message});
    }
};

exports.deleteReview = async (req, res) => {
    try{
        const review = await Review.findOne({_id: req.params.reviewId, user: req.user._id});
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found.'});
        }
        await review.remove()
        res.json( {success: true, message: 'Review deleted successfully.'});
    } catch (error) {
        res.status(500).json( {succcess: false, message: error.message} )
    }
};

exports.voteHelpful = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found.'});
        }

        await review.addHelpfulVote();
        res.json( {success: true, data: review});
    } catch (error) {
        res.status(500).json( {succcess: false, message: error.message} )
    }
};

exports.voteUnhelpful = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) {
            return res.status(404).json({ success: false, message: 'Review not found.'});
        }

        await review.addUnhelpfulVote();
        res.json( {success: true, data: review});
    } catch (error) {
        res.status(500).json( {succcess: false, message: error.message} )
    }
};

exports.flagReview = async (req, res) => {
    try{
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ success: false, message: 'Review not found.'});
        await review.flag(req.body.reason || 'other');
        res.json( {success: true, data: review});
    } catch (error) {
        res.status(500).json( {succcess: false, message: error.message} )
    }
};

exports.respondToReview = async (req, res) => {
    try {
        const review = await Review.findById(req.params.reviewId);
        if (!review) return res.status(404).json({ success: false, message: 'Review not found.'});
        review.resortResponse = {
            content: req.body.content,
            respondedBy: req.body.respondedBy || 'Resort Team',
            respondedAt: new Date(),
            isOfficial: req.body.isOfficial ?? true,
        };
        await review.save();
        res.json( {success: true, data: review});
    } catch (error) {
        res.status(500).json( {succcess: false, message: error.message} );
    }
};
