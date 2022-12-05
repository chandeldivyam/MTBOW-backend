const router = require("express").Router();
const checkAuth = require("../middleware/checkAuth");
const {
    generateToken,
    rechargeSuccess,
    rechargeFailed,
    paymentCallback,
    initiatePayment,
    allTransactions,
} = require("../controllers/payments");

router.route("/recharge").post(checkAuth, initiatePayment);
router.route("/callback/:id").post(paymentCallback);
router.route("/transactions").get(checkAuth, allTransactions);

module.exports = router;
