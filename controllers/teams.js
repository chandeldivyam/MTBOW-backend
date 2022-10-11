// const pool = require("../db/postgreDb");

const pool = require("../db/postgreDb");
const { balanceCalculator } = require("./common/balanceCalculator");

const createTeam = async (req, res) => {
    let { contest_id, browser_ids } = req.body;
    contest_id = parseInt(contest_id);
    const { user_id_mongo } = req.headers.user;
    const contest_expired = await pool.query(
        `SELECT is_expired, participation_fee, event_start_time FROM contests where id=$1 `,
        [contest_id]
    );
    if (contest_expired.rows[0]["is_expired"]) {
        return res.status(400).send("The event has expired");
    }
    if (Date.now() >= new Date(contest_expired.rows[0].event_start_time)) {
        return res.status(400).send("The event has alredy started");
    }
    const participation_fee = contest_expired.rows[0]["participation_fee"];
    const alreadyParticipated = await pool.query(
        `SELECT * FROM teams where user_id = $1 and contest_id = $2`,
        [user_id_mongo, contest_id]
    );
    if (alreadyParticipated.rowCount !== 0) {
        return res.status(400).send("Already Participated in the contest");
    }
    const balance = await pool.query(
        `
    select promotional, topup, winnings from user_info where id =$1 
    `,
        [user_id_mongo]
    );
    const { promotional, topup, winnings } = balance.rows[0];
    if (promotional + winnings + topup < participation_fee) {
        return res.status(400).send("Insufficient balance");
    }
    const { winnings_left, topup_left, promotional_left } = balanceCalculator(
        winnings,
        topup,
        promotional,
        participation_fee
    );
    const newTeam = await pool.query(
        `INSERT INTO teams (user_id, contest_id, team, reward) VALUES ($1, $2, $3, $4) RETURNING *`,
        [user_id_mongo, contest_id, browser_ids, 0]
    );
    await pool.query(
        `
        UPDATE user_info set promotional = $1, winnings = $2, topup = $3 where id = $4
    `,
        [promotional_left, winnings_left, topup_left, user_id_mongo]
    );
    res.status(200).json(newTeam);
};
const getTeamDetails = async (req, res) => {
    const contest_id = parseInt(req.params.id);
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    console.log({ contest_id, user_id_mongo });
    const teamDetails = await pool.query(
        `select * from teams where user_id = $1 and contest_id = $2`,
        [user_id_mongo, contest_id]
    );
    res.json(teamDetails);
};

const getTeamScore = async (req, res) => {
    const contest_id = parseInt(req.params.id);
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const leaderboard = await pool.query(
        `
        with team_points as (select user_id,unnest(team) as browser_id from teams where contest_id = $1)
        select team_points.user_id, user_info.name, SUM(creator_points.score) as total_points, RANK() OVER(ORDER BY SUM(creator_points.score) desc) from team_points
            left join creator_points on team_points.browser_id = creator_points.browser_id
            left join user_info on team_points.user_id = user_info.id
	    where creator_points.contest_id = $2
            group by 1,2
            order by rank;
    `,
        [contest_id, contest_id]
    );

    const team_score = await pool.query(
        `with team_points as (select user_id,unnest(team) as browser_id from teams where contest_id = $1 and user_id = $2)
        select team_points.browser_id, creator_points.score from team_points
        left join creator_points on creator_points.browser_id = team_points.browser_id 
        where creator_points.contest_id = $3
        `,
        [contest_id, user_id_mongo, contest_id]
    );
    const team_score_object = {};
    for (let item of team_score.rows) {
        team_score_object[item.browser_id] = item.score;
    }
    res.json({ leaderboard: leaderboard.rows, team_score_object });
};

module.exports = { createTeam, getTeamDetails, getTeamScore };
