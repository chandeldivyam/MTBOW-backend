const pool = require("../db/postgreDb");

const getInfo = async(req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const scratchCardData = await pool.query(`
            SELECT id, card_type, is_seen, reward FROM scratch_card
            WHERE user_id = $1
        `, [user_id_mongo])

        res.status(200).json({success: true, data: scratchCardData.rows})
    } catch (error) {
        console.error(error)
        res.json({success: false})
    }
}

const scratch = async(req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const scratch_card_id = parseInt(req.body.scratch_card_id)
        const seen = await pool.query(`SELECT is_seen, reward, video_contest_id FROM scratch_card WHERE id = $1 and user_id = $2`, [scratch_card_id, user_id_mongo])
        if(seen?.rows[0].is_seen) return res.status(400).json({success: false, message: "Card Already Scratched"})
        const update_card = await pool.query(`
            UPDATE scratch_card SET is_seen = true, updated_at = NOW() WHERE id = $1 and user_id = $2 RETURNING *
        `, [scratch_card_id, user_id_mongo])
        const reward = update_card?.rows[0]?.reward
        const video_contest_id = seen?.rows[0]?.video_contest_id
        const balance = await pool.query(`
            WITH table1 as (UPDATE video_teams SET reward = $1 WHERE video_contest_id = $3 and user_id = $2)
            UPDATE user_info SET promotional = promotional + $1 WHERE id = $2 RETURNING topup, promotional, winnings
        `, [reward, user_id_mongo, video_contest_id])
        const { topup, promotional, winnings } = balance.rows[0];
        res.json({success: true, balance: { topup, promotional, winnings }})
    } catch (error) {
        console.error(error)
        res.json({success: false})
    }
}
module.exports = {
    getInfo,
    scratch
}