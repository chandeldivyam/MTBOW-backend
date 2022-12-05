const pool = require("../db/postgreDb");

const createContest = async (req, res) => {
    const {
        contest_name,
        browser_ids,
        image_url,
        event_start_time,
        event_end_time,
        participation_fee,
    } = req.body;
    const newContest = await pool.query(
        `
        INSERT INTO contests (name,event_start_time,event_end_time,is_expired, image_url,all_creators, participation_fee) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `,
        [
            contest_name,
            event_start_time,
            event_end_time,
            false,
            image_url,
            browser_ids,
            participation_fee,
        ]
    );
    let query = browser_ids.map((item) => {
        return `('${item}', ${newContest.rows[0].id}, 0)`;
    });
    query = query.join(",");
    const points = pool.query(
        `INSERT INTO creator_points (browser_id, contest_id, score) VALUES ${query}`
    );
    res.json({
        contest_name,
        image_url,
        browser_ids,
        event_start_time,
        event_end_time,
    });
};
const getExpiredContests = async (req, res) => {
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const expiredContests = await pool.query(
        `
        SELECT contests.id, contests.name, contests.image_url FROM contests 
        left join teams on teams.contest_id = contests.id
        where contests.is_expired is true and teams.user_id = $1
        order by contests.id desc`,
        [user_id_mongo]
    );
    res.status(200).json(expiredContests.rows);
};
const getLiveContests = async (req, res) => {
    const liveContests = await pool.query(
        `SELECT id, name, image_url, event_start_time FROM contests WHERE is_expired is false`
    );
    res.status(200).json(liveContests.rows);
};
const updateContest = async (req, res) => {
    res.send("Updating the Contest");
};
const deleteContest = async (req, res) => {
    const liveContests = await pool.query(
        `SELECT count(*) FROM contests WHERE is_expired is false`
    );
    res.send(liveContests.rows[0]["count"]);
};
const getContestInfo = async (req, res) => {
    const event_id = parseInt(req.params.id);
    const contest_details = await pool.query(
        `
        WITH info_table as (
            SELECT name, image_url, unnest(all_creators) as browser_id, event_start_time, event_end_time, is_expired, participation_fee FROM contests WHERE id = $1
        )
        SELECT info_table.*, creators.* from info_table
        left join creators on creators.browser_id = info_table.browser_id;
        `,
        [event_id]
    );
    const participants = await pool.query(
	`select count(distinct user_id) as total_teams from teams where contest_id = $1`
	, [event_id])
    if(participants.rows.length === 0){
	return res.json({contest_details: contest_details.rows})
	}
    res.json({
	contest_details: contest_details.rows,
	participants: participants.rows[0]["total_teams"]
	});
};

const expireEvent = async (req, res) => {
    const contest_id = parseInt(req.params.id);
    const contest_expired = await pool.query(
        `SELECT is_expired, participation_fee FROM contests where id=$1 `,
        [contest_id]
    );
    if (contest_expired.rows[0]["is_expired"]) {
        return res.status(400).send("The event has expired");
    }
    const leaderboard = await pool.query(
        `with team_points as (select user_id,unnest(team) as browser_id from teams where contest_id = $1)
        select team_points.user_id,SUM(creator_points.score) as total_points, RANK() OVER(ORDER BY SUM(creator_points.score) desc) from team_points
        left join creator_points on team_points.browser_id = creator_points.browser_id
        where creator_points.contest_id = $2
        group by 1
        order by rank;`,
        [contest_id, contest_id]
    );
    const winners = {
        rank1: [],
        rank2: [],
        top50_percentile: [],
    };
    const prize_pool =
        parseInt(leaderboard.rows.length) *
        parseInt(contest_expired.rows[0]["participation_fee"]);
    const total_participants = parseInt(leaderboard.rows.length);

    if (total_participants > 0 && total_participants <= 5) {
        for (leaderboard_item of leaderboard.rows) {
            if (parseInt(leaderboard_item.rank) === 1) {
                winners.rank1.push(leaderboard_item.user_id);
                continue;
            }
            if (parseInt(leaderboard_item.rank) === 2) {
                winners.rank2.push(leaderboard_item.user_id);
                continue;
            }
            if (parseInt(leaderboard_item.rank) > 2) {
                winners.top50_percentile.push(leaderboard_item.user_id);
            }
        }
        if (winners.rank1.length > 0) {
            const rank_1 = "(" + winners.rank1.join() + ")";
            let winning_amount = (0.7 * prize_pool) / winners.rank1.length;
            const rank_1_update = await pool.query(
                `
            UPDATE user_info set winnings = (winnings + ${winning_amount}) where id in ${rank_1}
        `
            );
            const rank1_reward = await pool.query(
                `
                UPDATE teams set reward = ${winning_amount} where user_id in ${rank_1} and contest_id = $1
            `,
                [contest_id]
            );
            winning_amount = 0;
        }
        if (winners.rank2.length > 0) {
            const rank_2 = "(" + winners.rank2.join() + ")";
            let winning_amount = (0.3 * prize_pool) / winners.rank2.length;
            const rank_2_update = await pool.query(
                `
            UPDATE user_info set winnings = (winnings + ${winning_amount}) where id in ${rank_2}
            `
            );
            const rank2_reward = await pool.query(
                `
                UPDATE teams set reward = ${winning_amount} where user_id in ${rank_2} and contest_id = $1
            `,
                [contest_id]
            );
        }
        const expire_event = await pool.query(
            `UPDATE contests set is_expired = true where id = $1`,
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
            UPDATE teams set reward = ${winning_amount} where user_id in ${rank_1} and contest_id = $1
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
            UPDATE teams set reward = ${winning_amount} where user_id in ${rank_2} and contest_id = $1
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
            UPDATE teams set reward = ${winning_amount} where user_id in ${top_50} and contest_id = $1
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
};

module.exports = {
    getExpiredContests,
    getLiveContests,
    createContest,
    updateContest,
    deleteContest,
    getContestInfo,
    expireEvent,
};
