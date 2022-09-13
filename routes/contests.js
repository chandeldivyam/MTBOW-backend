const router = require("express").Router();
const checkAuth = require("../middleware/checkAuth");

const {
    getExpiredContests,
    getLiveContests,
    createContest,
    updateContest,
    deleteContest,
    getContestInfo,
    expireEvent,
} = require("../controllers/contests");

router.route("/").post(createContest);
router.route("/expired").get(checkAuth, getExpiredContests);
router.route("/live").get(checkAuth, getLiveContests);
router.route("/:id").put(updateContest).delete(deleteContest);
router.route("/contestInfo/:id").get(checkAuth, getContestInfo);
router.route("/expire/:id").post(expireEvent);

module.exports = router;
