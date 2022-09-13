const pool = require("../db/postgreDb");

const createContest = async (req, res) => {
    const {
        contest_name,
        browser_ids,
        image_url,
        event_start_time,
        event_end_time,
    } = req.body;
    const newContest = await pool.query(
        `
        INSERT INTO contests (name,event_start_time,event_end_time,is_expired, image_url,all_creators) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `,
        [
            contest_name,
            event_start_time,
            event_end_time,
            false,
            image_url,
            browser_ids,
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
        where contests.is_expired is true and teams.user_id = $1`,
        [user_id_mongo]
    );
    res.status(200).json(expiredContests.rows);
};
const getLiveContests = async (req, res) => {
    const liveContests = await pool.query(
        `SELECT id, name, image_url FROM contests WHERE is_expired is false`
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
    // const contestInfo = await pool.query()
    const event_id = parseInt(req.params.id);
    const contest_details = await pool.query(
        `
        WITH info_table as (
            SELECT name, image_url, unnest(all_creators) as browser_id, event_start_time, event_end_time, is_expired FROM contests WHERE id = $1
        )
        SELECT info_table.*, creators.* from info_table
        left join creators on creators.browser_id = info_table.browser_id;
        `,
        [event_id]
    );
    res.send(contest_details.rows);
};

const expireEvent = async (req, res) => {
    const contest_id = parseInt(req.params.id);
    const expire_event = await pool.query(
        `UPDATE contests set is_expired = true where id = $1`,
        [contest_id]
    );
    res.send("Event Expired");
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
