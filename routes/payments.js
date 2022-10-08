const router = require("express").Router();
const checkAuth = require("../middleware/checkAuth");
const {
    generateToken,
    rechargeSuccess,
    rechargeFailed,
} = require("../controllers/payments");

router.route("/recharge").post(checkAuth, generateToken);
router.route("/recharge/success").post(checkAuth, rechargeSuccess);
router.route("/recharge/failed").post(checkAuth, rechargeFailed);

module.exports = router;
