const router = require("express").Router();
const { getBalance } = require("../controllers/wallet");
const checkAuth = require("../middleware/checkAuth");

router.route("/balance").get(checkAuth, getBalance);

module.exports = router;
