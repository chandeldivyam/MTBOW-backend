const router = require("express").Router();
const { createTeam, createSuperTeam } = require('../../controllers/Bots/createTeam')

router.route('/').post(createTeam)
router.route('/superBot').post(createSuperTeam)

module.exports = router;