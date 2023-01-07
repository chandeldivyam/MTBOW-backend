const pool = require("../db/postgreDb");
const referralCodeGenerator = require("referral-code-generator")

const getReferralInfo = async(req, res) => {
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const referral_data = await pool.query(`
            SELECT sum(rl.amount) as referral_bonus, ui.referral_code from referral_ledgers rl
            right join user_info ui on ui.id = rl.referrer_user_id
            where ui.id = $1
            group by 2
    `, [user_id_mongo])
    if(referral_data.rowCount !== 1) return res.status(500).json({success: false, message: "INTERNAL_SERVER_ERROR"})
    if(!referral_data.rows[0].referral_bonus){
        referral_data.rows[0].referral_bonus = 0
    }
    if(!referral_data.rows[0].referral_code){
        let referral_code_gen = "";
        while(true){
            referral_code_gen = referralCodeGenerator.alphaNumeric('uppercase', 3, 1)
            let referral_unique = await pool.query(`SELECT * FROM user_info where referral_code = $1`, [referral_code_gen])
            if(referral_unique.rowCount === 0) break
        }
        await pool.query(`UPDATE user_info SET referral_code = $1 where id = $2`, [referral_code_gen, user_id_mongo])
        return res.status(200).json({referral_code: referral_code_gen, referral_bonus: 0})
    }
    return res.status(200).json(referral_data.rows[0])
}

module.exports = {
    getReferralInfo
}