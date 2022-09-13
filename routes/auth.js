const router = require("express").Router();
const checkAuth = require("../middleware/checkAuth");
const {
    fetchCurrentUser,
    loginUser,
    registerUser,
    verifyOTPSignup,
    verifyOTPLogin,
} = require("../controllers/auth");

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/verifySignup", verifyOTPSignup);
router.post("/verifyLogin", verifyOTPLogin);
router.get("/me", checkAuth, fetchCurrentUser);

module.exports = router;
