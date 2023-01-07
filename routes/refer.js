const router = require("express").Router();
const { getReferralInfo } = require("../controllers/refer");
const checkAuth = require("../middleware/checkAuth");

router.route("/info").get(checkAuth, getReferralInfo)

module.exports = router