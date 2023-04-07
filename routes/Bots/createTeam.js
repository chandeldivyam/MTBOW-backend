const router = require("express").Router();
const { createTeam } = require('../../controllers/Bots/createTeam')

router.route('/').post(createTeam)

module.exports = router;