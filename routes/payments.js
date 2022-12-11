const router = require("express").Router();
const checkAuth = require("../middleware/checkAuth");
const { generateToken, rechargeSuccess, rechargeFailed, paymentCallback, initiatePayment, allTransactions } = require("../controllers/payments");
const { validateVpa, checkVpa, validatePan, checkPan } = require("../controllers/verification");
const { initiateWithdrawal, settleWithdrawal, checkWithdrawalStatus } = require("../controllers/withdraw");

router.route("/recharge").post(checkAuth, initiatePayment);
router.route("/callback/:id").post(paymentCallback);
router.route("/transactions").get(checkAuth, allTransactions);
router.route("/validateVPA").post(checkAuth, validateVpa);
router.route("/checkVPA").get(checkAuth, checkVpa);
router.route("/validatePan").post(checkAuth, validatePan);
router.route("/checkPan").get(checkAuth, checkPan);
router.route("/withdraw").post(checkAuth, initiateWithdrawal);
router.route("/withdrawSettle").post(checkAuth, settleWithdrawal);
router.route("/checkWithdrawal").get(checkAuth, checkWithdrawalStatus)

module.exports = router;
