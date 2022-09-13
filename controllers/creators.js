const pool = require("../db/postgreDb");

const addCreator = async (req, res) => {
    const { channel_name, channel_url, channel_image, browser_id } = req.body;
    const newCreator = await pool.query(
        `INSERT INTO creators (channel_name,channel_image,channel_url,browser_id) VALUES ($1, $2, $3, $4) RETURNING *`,
        [channel_name, channel_image, channel_url, browser_id]
    );
    res.json(newCreator);
};

module.exports = { addCreator };
