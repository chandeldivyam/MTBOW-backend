const router = require("express").Router();
const { addCreator } = require("../controllers/creators");

router.route("/").post(addCreator);

module.exports = router;
