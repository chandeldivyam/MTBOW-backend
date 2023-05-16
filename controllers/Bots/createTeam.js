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

const createSuperTeam = async (req, res) => {
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

    const initial_video_stats = await pool.query(`
                with rank_table as (select *, RANK() OVER(PARTITION BY video_id order by updated_at desc) 
                from video_stats 
                where updated_at <=  NOW() - interval '30' minute 
                and video_id in (select video_id from video_points where contest_id = $1))
                SELECT * FROM rank_table where rank=1
            `, [contest_id])

    initial_data = {};
    for (let item of initial_video_stats.rows) {
        const { video_id, video_views, video_comments, video_likes } = item;
        initial_data[video_id] = { video_views, video_comments, video_likes };
    }

    const final_video_stats = await pool.query(`
            with rank_table as (select *, RANK() OVER(PARTITION BY video_id order by updated_at desc) 
            from video_stats 
            where video_id in (select video_id from video_points where contest_id = $1))
            SELECT * FROM rank_table where rank=1
        `, [contest_id])

    final_data = {};
    for (let item of final_video_stats.rows) {
        const { video_id, video_views, video_comments, video_likes } = item;
        final_data[video_id] = { video_views, video_comments, video_likes };
    }

    const total_points = {};

    if (initial_data.length === final_data.length) {
        Object.keys(final_data).forEach((key) => {
            const view_points = Math.floor((Number(final_data[key].video_views) - Number(initial_data[key].video_views)) / 20);
            const comment_points = 2 * (Number(final_data[key].video_comments) - Number(initial_data[key].video_comments));
            const like_points = Number(final_data[key].video_likes) - Number(initial_data[key].video_likes);
            total_points[key] = like_points+view_points+comment_points;
        })
    }
    let entries = Object.entries(total_points);

    // Sort the array by the second element of each entry (the point values).
    entries.sort((a, b) => b[1] - a[1]);

    // Take the first 12 elements of the sorted array and map them back to just the keys (video ids).
    let top12Videos;
    if(total_count === 1){
        top12Videos = entries.slice(0, 11).map(entry => entry[0]);
    }
    else{
        top12Videos = entries.slice(0, 12).map(entry => entry[0]);
    }

    for(const user of bots_used){
        const team = getRandomItems(top12Videos, 11)
        const newTeam = await pool.query(
            `INSERT INTO video_teams (user_id, video_contest_id, video_team, reward, first_seen) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [user.id, contest_id, team, 0, false]
        );
    }
    res.json({success: true, total_teams_created: bots_used.length, bots: bots_used})
    //return total number of teams created
}

module.exports = { createTeam, createSuperTeam }