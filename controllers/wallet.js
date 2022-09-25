const pool = require("../db/postgreDb");

const getBalance = async (req, res) => {
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const balance = await pool.query(
        `
        select topup, promotional, winnings from user_info where id = $1
    `,
        [user_id_mongo]
    );
    const { topup, promotional, winnings } = balance.rows[0];
    res.json({ topup, promotional, winnings });
};

module.exports = { getBalance };
