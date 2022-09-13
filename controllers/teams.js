// const pool = require("../db/postgreDb");

const pool = require("../db/postgreDb");
const { unsubscribe } = require("../routes/teams");

const createTeam = async (req, res) => {
    let { contest_id, browser_ids } = req.body;
    contest_id = parseInt(contest_id);
    const { user_id_mongo } = req.headers.user;
    const contest_expired = await pool.query(
        `SELECT is_expired FROM contests where id=$1 `,
        [contest_id]
    );
    if (contest_expired.rows[0]["is_expired"]) {
        return res.send("The event has expired");
    }
    const alreadyParticipated = await pool.query(
        `SELECT * FROM teams where user_id = $1 and contest_id = $2`,
        [user_id_mongo, contest_id]
    );
    if (alreadyParticipated.rowCount !== 0) {
        return res.send("Already Participated in the contest");
    }
    const newTeam = await pool.query(
        `INSERT INTO teams (user_id, contest_id, team) VALUES ($1, $2, $3) RETURNING *`,
        [user_id_mongo, contest_id, browser_ids]
    );
    res.json(newTeam);
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
        select team_points.user_id,SUM(creator_points.score) as total_points, RANK() OVER(ORDER BY SUM(creator_points.score) desc) from team_points
            left join creator_points on team_points.browser_id = creator_points.browser_id
            where creator_points.contest_id = $2
            group by 1
            order by 1
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
    console.log({ leaderboard: leaderboard.rows, team_score: team_score.rows });
    res.json({ leaderboard: leaderboard.rows, team_score_object });
};

module.exports = { createTeam, getTeamDetails, getTeamScore };
