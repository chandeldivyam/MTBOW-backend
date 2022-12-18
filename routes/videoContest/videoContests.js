const router = require("express").Router()
const checkAuth = require("../../middleware/checkAuth")

const {
    createVideoContest,
    getExpiredVideoContests,
    getLiveVideoContests,
    getVideoContestInfo,
    expireVideoContest
} = require("../../controllers/videoContest/videoContests")

router.route("/").post(createVideoContest);
router.route("/expired").get(checkAuth, getExpiredVideoContests);
router.route("/live").get(checkAuth, getLiveVideoContests);
router.route("/contestInfo/:id").get(checkAuth, getVideoContestInfo);
router.route("/expire/:id").post(expireVideoContest);

module.exports = router;
