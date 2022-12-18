const router = require("express").Router();
const { createVideoTeam, getVideoTeamDetails, getVideoTeamScore, getVideoTeamScoreOther } = require("../../controllers/videoContest/videoTeams")
const checkAuth = require("../../middleware/checkAuth");

router.route("/").post(checkAuth, createVideoTeam);
router.route("/:id").get(checkAuth, getVideoTeamDetails);
router.route("/score/:id").get(checkAuth, getVideoTeamScore);
router.route("/scoreOthers/:videoContestId/:userId").get(checkAuth, getVideoTeamScoreOther);
module.exports = router;