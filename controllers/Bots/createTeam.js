require('dotenv').config()
const pool = require("../../db/postgreDb");
const { balanceCalculator } = require("../common/balanceCalculator");
const {getRandomItems} = require('../common/helper')
const createTeam = async (req, res) => {
    const botapikey = req.headers.botapikey
    if( !botapikey || botapikey !=  process.env.BOT_API_KEY) res.status(403).json({success: false})
    let { contest_id, total_count } = req.body
    contest_id = parseInt(contest_id);
    if(!contest_id){
        return res.status(400).json({success: false, message: 'Please enter the contest Id'});
    }
    if(!total_count){
        return res.status(400).json({success: false, message: 'Please enter number if teams needed'});
    }
    if(!parseInt(total_count)) return res.status(400).json({success: false, message: 'Please enter number of teams needed in INTEGER'});
    
    //find bots who we need to create team of
    let bot_user_ids = await pool.query(`
        SELECT id FROM user_info WHERE phone = '' and id not in (SELECT user_id FROM video_teams WHERE video_contest_id = $1)
    `, [contest_id])

    if(bot_user_ids.rows.length === 0){
        return res.status(400).json({success: false, message: "No more bot available"})
    }

    const all_videos = await pool.query(`
        SELECT all_video_ids, is_expired, event_start_time FROM video_contests WHERE id = $1
    `, [Number(contest_id)])
    if (all_videos.rows[0]["is_expired"]) {
        return res.status(400).send("The event has expired");
    }
    if (Date.now() >= new Date(all_videos.rows[0].event_start_time)) {
        return res.status(400).send("The event has alredy started");
    }
    let bots_used
    if(total_count > bot_user_ids.rows.length){
        bots_used = bot_user_ids.rows
    }
    else{
        bots_used = getRandomItems(bot_user_ids.rows, total_count)
    }

    for(const user of bots_used){
        const team = getRandomItems(all_videos.rows[0]["all_video_ids"], 11)
        const newTeam = await pool.query(
            `INSERT INTO video_teams (user_id, video_contest_id, video_team, reward, first_seen) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [user.id, contest_id, team, 0, false]
        );
    }
    res.json({success: true, total_teams_created: bots_used.length, bots: bots_used})
    //return total number of teams created
}

module.exports = { createTeam }