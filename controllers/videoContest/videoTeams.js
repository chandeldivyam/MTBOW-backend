const { balanceCalculator } = require("../common/balanceCalculator");
const pool = require("../../db/postgreDb");

const createVideoTeam = async(req, res) => {
    let { contest_id, video_ids } = req.body
    if(video_ids.length !== 11){
        return res.status(400).send("Team size can only be eleven")
        }
    contest_id = parseInt(contest_id);
    const { user_id_mongo } = req.headers.user;
    const contest_expired = await pool.query(
        `SELECT is_expired, participation_fee, event_start_time, max_participants FROM video_contests where id=$1 `,
        [contest_id]
    );
    const total_current_participants = await pool.query(`
    SELECT count(*) total_participants FROM video_teams WHERE video_contest_id = $1;
    `, [contest_id])
    if(total_current_participants.rows[0].total_participants >= contest_expired.rows[0].max_participants){
        return res.status(400).json({success: false, message: "All participations full"})
    } 
    if (contest_expired.rows[0]["is_expired"]) {
        return res.status(400).send("The event has expired");
    }
    if (Date.now() >= new Date(contest_expired.rows[0].event_start_time)) {
        return res.status(400).send("The event has alredy started");
    }
    const participation_fee = Number(contest_expired.rows[0]["participation_fee"]);
    //need to add the condition for already participated
    const alreadyParticipated = await pool.query(
        `SELECT * FROM video_teams where user_id = $1 and video_contest_id = $2`,
        [user_id_mongo, contest_id]
    );
    if (alreadyParticipated.rowCount !== 0) {
        return res.status(400).send("Already Participated in the contest");
    }

    const balance = await pool.query(`
        select promotional, topup, winnings from user_info where id =$1 
    `,[user_id_mongo]);

    const { promotional, topup, winnings } = balance.rows[0];
    if (Number(promotional) + Number(winnings) + Number(topup) < participation_fee) {
        return res.status(400).send("Insufficient balance");
    }

    if(participation_fee === 0){
        const newTeamZero = await pool.query(
            `INSERT INTO video_teams (user_id, video_contest_id, video_team, reward, first_seen) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [user_id_mongo, contest_id, video_ids, 0, false]
        );
        const referrer_user_zero = await pool.query(`
            UPDATE user_info SET winnings = (winnings + 5) WHERE referral_code in (select ui.referral_code_used
                from user_info ui
                left join verification on verification.user_id = ui.id
                where ui.id = $1 and verification.pan_verification_status = 'SUCCESS'
                LIMIT 1) RETURNING id
        `, [user_id_mongo])
        if(referrer_user_zero.rows.length === 1){
            await pool.query(`
                INSERT INTO referral_ledgers (created_at, referrer_user_id, referee_user_id, amount, reason, video_contest_id) VALUES (NOW(), $1, $2, 5, 'TEAM_CREATION', $3)
            `, [Number(referrer_user_zero.rows[0].id), user_id_mongo, contest_id])
        }
        return res.status(200).json(newTeamZero);
    }

    const { winnings_left, topup_left, promotional_left } = balanceCalculator(
        winnings,
        topup,
        promotional,
        participation_fee
    );

    const newTeam = await pool.query(
        `INSERT INTO video_teams (user_id, video_contest_id, video_team, reward, first_seen) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user_id_mongo, contest_id, video_ids, 0, false]
    );

    await pool.query(`
        UPDATE user_info set promotional = $1, winnings = $2, topup = $3 where id = $4
    `,[promotional_left, winnings_left, topup_left, user_id_mongo]
    );

    const referrer_user = await pool.query(`
            UPDATE user_info SET promotional = (promotional + 5) WHERE referral_code in (select ui.referral_code_used
                from user_info ui
                left join verification on verification.user_id = ui.id
                where ui.id = $1 and verification.pan_verification_status = 'SUCCESS'
                LIMIT 1) RETURNING id
        `, [user_id_mongo])
        if(referrer_user.rows.length === 1){
            await pool.query(`
                INSERT INTO referral_ledgers (created_at, referrer_user_id, referee_user_id, amount, reason, video_contest_id) VALUES (NOW(), $1, $2, 5, 'TEAM_CREATION', $3)
            `, [Number(referrer_user.rows[0].id), user_id_mongo, contest_id])
        }
    res.status(200).json(newTeam);
} 

const getVideoTeamDetails = async(req, res) => {
    const video_contest_id = parseInt(req.params.id);
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const videoTeamDetails = await pool.query(
        `select * from video_teams where user_id = $1 and video_contest_id = $2`,
        [user_id_mongo, video_contest_id]
    );
    res.json(videoTeamDetails)
}

const getVideoTeamDetailsExpired = async(req, res) => {
    const video_contest_id = parseInt(req.params.id);
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const videoTeamDetails = await pool.query(`
        select vt.video_team, vt.reward, vt.first_seen, sc.card_type
        from video_teams vt full join scratch_card sc on sc.user_id = vt.user_id and sc.video_contest_id = vt.video_contest_id 
        where vt.user_id = $1 and vt.video_contest_id = $2
        `,
        [user_id_mongo, video_contest_id]
    );
    if(!videoTeamDetails.rows[0]?.first_seen){
        await pool.query(
            `UPDATE video_teams SET first_seen = true WHERE user_id = $1 and video_contest_id = $2`
        , [user_id_mongo, video_contest_id]
        );
    }
    res.json(videoTeamDetails)
}

const getVideoTeamScore = async(req, res) => {
    const contest_id = parseInt(req.params.id);
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const leaderboard = await pool.query(
        `
        with team_points as (select user_id,unnest(video_team) as video_id from video_teams where video_contest_id = $1)
        select team_points.user_id, user_info.name,  scratch_card.card_type,SUM(video_points.score) as total_points, RANK() OVER(ORDER BY SUM(video_points.score) desc) from team_points
            left join video_points on team_points.video_id = video_points.video_id
            left join user_info on team_points.user_id = user_info.id
            left join scratch_card on scratch_card.user_id = team_points.user_id and scratch_card.video_contest_id = $1
	    where video_points.contest_id = $2
            group by 1,2,3
            order by rank;
    `, [contest_id, contest_id]);

    const team_score = await pool.query(`
        with team_points as (select user_id,unnest(video_team) as video_id from video_teams where video_contest_id = $1 and user_id = $2)
        select team_points.video_id, video_points.score, video_points.extra_details from team_points
        left join video_points on video_points.video_id = team_points.video_id 
        where video_points.contest_id = $3;
    `, [contest_id, user_id_mongo, contest_id])
    const team_score_object = {};
    for (let item of team_score.rows) {
        team_score_object[item.video_id] = item.score
    }
    const score_distribution = {}
    for (let item of team_score.rows) {
        score_distribution[item.video_id] = {...item.extra_details}
    }
    res.status(200).json({ leaderboard: leaderboard.rows, team_score_object, score_distribution });
}

const getVideoTeamScoreOther = async(req, res) => {
    const video_contest_id = Number(req.params.videoContestId)
    const user_id = Number(req.params.userId)
    // console.log({user_id, video_contest_id})
    if(!user_id || !video_contest_id) res.status(400)
    const contest_expired = await pool.query(
        `SELECT is_expired, event_start_time FROM video_contests where id=$1 `,
        [video_contest_id]
    );
    if (Date.now() <= new Date(contest_expired.rows[0].event_start_time)) {
        return res.status(400).send("The event has not started yet");
    }
    const team_score = await pool.query(`
        with team_points as (select user_id,unnest(video_team) as video_id from video_teams where video_contest_id = $1 and user_id = $2)
        select team_points.video_id, video_points.score, video_points.extra_details from team_points
        left join video_points on video_points.video_id = team_points.video_id 
        where video_points.contest_id = $3;
    `, [video_contest_id, user_id, video_contest_id])
    if(team_score.rows.length === 0){
        return res.status(200).json({success: false, message: "No team exists"})
    }
    const team_score_object = {};
    for (let item of team_score.rows) {
        team_score_object[item.video_id] = item.score
    }
    const score_distribution = {}
    for (let item of team_score.rows) {
        score_distribution[item.video_id] = {...item.extra_details}
    }
    res.status(200).json({ team_score_object, score_distribution });
}

module.exports = {createVideoTeam, getVideoTeamDetails, getVideoTeamScore, getVideoTeamScoreOther, getVideoTeamDetailsExpired}