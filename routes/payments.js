const router = require("express").Router();
const checkAuth = require("../middleware/checkAuth");
const {
    generateToken,
    rechargeSuccess,
    rechargeFailed,
    paymentCallback,
    initiatePayment,
} = require("../controllers/payments");

router.route("/recharge").post(checkAuth, initiatePayment);
router.route("/callback/:id").post(paymentCallback);

module.exports = router;
