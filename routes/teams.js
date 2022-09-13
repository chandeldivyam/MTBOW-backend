const router = require("express").Router();
const {
    getTeamDetails,
    createTeam,
    getTeamScore,
} = require("../controllers/teams");
const checkAuth = require("../middleware/checkAuth");

router.route("/").post(checkAuth, createTeam);
router.route("/:id").get(checkAuth, getTeamDetails);
router.route("/score/:id").get(checkAuth, getTeamScore);

module.exports = router;
