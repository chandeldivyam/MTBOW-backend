const pool = require("../../db/postgreDb");
const { realEscapeString } = require("../common/helper");
const { videoData } = require("../common/videoData");


const createVideoContest = async (req, res) => {
    try {
        const {
            contest_name,
            video_ids,
            image_url,
            event_start_time,
            event_end_time,
            participation_fee,
        } = req.body;
    
        const newVideoContest = await pool.query(`
            INSERT INTO video_contests (name, event_start_time, event_end_time, is_expired, image_url, all_video_ids, participation_fee) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
        `, [contest_name, event_start_time, event_end_time, false, image_url, video_ids, participation_fee,])
    
        const contest_id = Number(newVideoContest.rows[0].id);
    
        //fetch data from youtube APIs regarding video thumbnail + channel thumbnail images + video_url + channel title 
        const video_data = await videoData(video_ids)

        let query = video_ids.map((item) => {
            return `('${item}', ${contest_id}, '${realEscapeString(video_data[item].channel_title)}', '${realEscapeString(video_data[item].video_title)}', '${video_data[item].video_thumbnail}', '${video_data[item].channel_thumbnail}',0)`;
        });
        const points = pool.query(
            `INSERT INTO video_points (video_id, contest_id, channel_title, video_title, video_thumbnail, channel_thumbnail, score) VALUES ${query}`
        );
        res.status(200).json({contest_name})
    } catch (error) {
        console.log(error)
    }
}

const getExpiredVideoContests = async (req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const allExpiredContests = await pool.query(
            `
            SELECT vc.id, vc.name, vc.image_url FROM video_contests vc 
            where vc.is_expired is true 
            and id not in (select distinct video_contest_id from video_teams where user_id = $1)
            order by vc.id desc`,
            [user_id_mongo]
        );
        const myExpiredContests = await pool.query(
            `
            SELECT vc.id, vc.name, vc.image_url FROM video_contests vc 
            where vc.is_expired is true 
            and id in (select distinct video_contest_id from video_teams where user_id = $1)
            order by vc.id desc`,
            [user_id_mongo]
        );
        res.status(200).json({allExpiredContests: allExpiredContests.rows, myExpiredContests: myExpiredContests.rows});
    } catch (error) {
        console.log(error)
        res.status(500).json({success: false, message: "Some error occoured while fetching expired video events"})
    }
}

const getLiveVideoContests = async (req, res) => {
    try {
        const liveVideoEvents = await pool.query(`
            SELECT id, name, image_url, event_start_time, participation_fee from video_contests where is_expired is false
        `)
        const previous_winner = await pool.query(`
        select ui.name,reward from video_teams vt left join user_info ui on ui.id = vt.user_id 
        where video_contest_id = (select max(id) from video_contests where is_expired is true) 
        order by 2 desc 
        limit 1;
        `)
        res.status(200).json({liveVideoContest: liveVideoEvents.rows, previousWinner: previous_winner.rows[0].name});
    } catch (error) {
        console.log(error) 
        res.status(500).json({success: false, message: "Some error occoured while fetching live video events"})
    }
    
}

const getVideoContestInfo = async (req, res) => {
    const event_id = parseInt(req.params.id);
    const contest_details = await pool.query(`
        with info_table as (
            SELECT name, image_url, unnest(all_video_ids) as video_id, event_start_time, event_end_time, is_expired, participation_fee FROM video_contests WHERE id = $1
        )
        SELECT info_table.*, video_points.* from info_table
        left join video_points on video_points.video_id = info_table.video_id
        where video_points.contest_id = $1
    `, [event_id])

    const participants = await pool.query(
        `select count(distinct user_id) as total_teams from video_teams where video_contest_id = $1`
    , [event_id])

    if(participants.rows.length === 0){
        return res.json({contest_details: contest_details.rows})
    }
    res.status(200).json({
        contest_details: contest_details.rows,
        participants: participants.rows[0]["total_teams"]
    });
}

const expireVideoContest = async (req, res) => {
    const contest_id = parseInt(req.params.id);
    const contest_expired = await pool.query(
        `SELECT is_expired, participation_fee FROM video_contests where id=$1 `,
        [contest_id]
    );
    if (contest_expired.rows[0]["is_expired"]) {
        return res.status(400).send("The event has expired");
    }
    const leaderboard = await pool.query(
        `with team_points as (select user_id,unnest(video_team) as video_id from video_teams where video_contest_id = $1)
        select team_points.user_id, SUM(video_points.score) as total_points, RANK() OVER(ORDER BY SUM(video_points.score) desc) from team_points
        left join video_points on team_points.video_id = video_points.video_id
        where video_points.contest_id = $2
        group by 1
        order by rank;`,
        [contest_id, contest_id]
    );
    const winners = {
        rank1: [],
        rank2: [],
        top50_percentile: [],
    };
    let prize_pool = parseInt(leaderboard.rows.length) * parseInt(contest_expired.rows[0]["participation_fee"]);
    if( parseInt(contest_expired.rows[0]["participation_fee"]) === 0){
        prize_pool = 300;
    }
    const total_participants = parseInt(leaderboard.rows.length);
    
    if (parseInt(contest_expired.rows[0]["participation_fee"]) === 0 || (total_participants > 0 && total_participants <= 5)) {
        for (leaderboard_item of leaderboard.rows) {
            if (parseInt(leaderboard_item.rank) === 1) {
                winners.rank1.push(leaderboard_item.user_id);
                continue;
            }
            if (parseInt(leaderboard_item.rank) === 2) {
                winners.rank2.push(leaderboard_item.user_id);
                continue;
            }
            if (parseInt(leaderboard_item.rank) > 2 & parseInt(leaderboard_item.rank) < 6) {
                winners.top50_percentile.push(leaderboard_item.user_id);
            }
        }
        if (winners.rank1.length > 0) {
            const rank_1 = "(" + winners.rank1.join() + ")";
            let winning_amount = (0.35 * prize_pool) / winners.rank1.length;
            const rank_1_update = await pool.query(
                `
            UPDATE user_info set winnings = (winnings + ${winning_amount}) where id in ${rank_1}
        `
            );
            const rank1_reward = await pool.query(
                `
                UPDATE video_teams set reward = ${winning_amount} where user_id in ${rank_1} and video_contest_id = $1
            `,
                [contest_id]
            );
            winning_amount = 0;
        }
        if (winners.rank2.length > 0) {
            const rank_2 = "(" + winners.rank2.join() + ")";
            let winning_amount = (0.25 * prize_pool) / winners.rank2.length;
            const rank_2_update = await pool.query(
                `
            UPDATE user_info set winnings = (winnings + ${winning_amount}) where id in ${rank_2}
            `
            );
            const rank2_reward = await pool.query(
                `
                UPDATE video_teams set reward = ${winning_amount} where user_id in ${rank_2} and video_contest_id = $1
            `,
                [contest_id]
            );
        }
        if (winners.top50_percentile.length > 0) {
            const rank_till_5 = "(" + winners.top50_percentile.join() + ")";
            let winning_amount = (0.4 * prize_pool) / winners.top50_percentile.length;
            const rank_till_5_update = await pool.query(`
                UPDATE user_info set winnings = (winnings + ${winning_amount}) where id in ${rank_till_5}   
            `)
            const rank5_reward = await pool.query(
                `
                UPDATE video_teams set reward = ${winning_amount} where user_id in ${rank_till_5} and video_contest_id = $1
            `,
                [contest_id]
            );
        }
        const expire_event = await pool.query(
            `UPDATE video_contests set is_expired = true where id = $1`,
            [contest_id]
        );
        return res.status(200).json({
            success: true,
        });
    }

    if (leaderboard.rows.length > 0) {
        for (leaderboard_item of leaderboard.rows) {
            if (parseInt(leaderboard_item.rank) === 1) {
                winners.rank1.push(leaderboard_item.user_id);
                continue;
            }
            if (parseInt(leaderboard_item.rank) === 2) {
                winners.rank2.push(leaderboard_item.user_id);
                continue;
            }
            if (
                parseInt(leaderboard_item.rank) > 2 &&
                parseInt(leaderboard_item.rank) <=
                    Math.ceil(total_participants / 2)
            ) {
                winners.top50_percentile.push(leaderboard_item.user_id);
            }
        }
    }

    if (winners.rank1.length > 0) {
        const rank_1 = "(" + winners.rank1.join() + ")";
        let winning_amount = (0.4 * prize_pool) / winners.rank1.length;
        const rank_1_update = await pool.query(
            `
        UPDATE user_info set winnings = (winnings + ${winning_amount}) where id in ${rank_1}
    `
        );
        const rank1_reward = await pool.query(
            `
            UPDATE video_teams set reward = ${winning_amount} where user_id in ${rank_1} and video_contest_id = $1
        `,
            [contest_id]
        );
        winning_amount = 0;
    }

    if (winners.rank2.length > 0) {
        const rank_2 = "(" + winners.rank2.join() + ")";
        let winning_amount = (0.2 * prize_pool) / winners.rank2.length;
        const rank_2_update = await pool.query(
            `
        UPDATE user_info set winnings = (winnings + ${winning_amount}) where id in ${rank_2}
        `
        );
        const rank2_reward = await pool.query(
            `
            UPDATE video_teams set reward = ${winning_amount} where user_id in ${rank_2} and video_contest_id = $1
        `,
            [contest_id]
        );
    }

    if (winners.top50_percentile.length > 0) {
        const top_50 = "(" + winners.top50_percentile.join() + ")";
        let winning_amount =
            (0.4 * prize_pool) / winners.top50_percentile.length;
        const rank_50percentile_update = await pool.query(
            `
        UPDATE user_info set winnings = (winnings + ${winning_amount}) where id in ${top_50}
        `
        );
        const rank_50percentile_reward = await pool.query(
            `
            UPDATE video_teams set reward = ${winning_amount} where user_id in ${top_50} and video_contest_id = $1
        `,
            [contest_id]
        );
    }
    const expire_event = await pool.query(
        `UPDATE contests set is_expired = true where id = $1`,
        [contest_id]
    );
    res.status(200).json({
        success: true,
    });
}

module.exports = {
    createVideoContest,
    getExpiredVideoContests,
    getLiveVideoContests,
    getVideoContestInfo,
    expireVideoContest
}