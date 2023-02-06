const router = require("express").Router();
const { getInfo, scratch } = require("../controllers/scratchCards");
const checkAuth = require("../middleware/checkAuth");

router.route("/").get(checkAuth, getInfo)
router.route("/scratch").post(checkAuth, scratch)

module.exports = router