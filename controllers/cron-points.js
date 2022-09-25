const cron = require("node-cron");
const pool = require("../db/postgreDb");

cron.schedule("*/30 * * * * *", async () => {
    console.log("running the point task every three mins!!!");
    const contest_ids = await pool.query(
        `select id, event_start_time, event_end_time from contests where is_expired is false`
    );
    for (let row_data of contest_ids.rows) {
        if (
            Date.now() < row_data.event_start_time ||
            Date.now() > row_data.event_end_time
        ) {
            continue;
        }
        const initial_team_stats = await pool.query(
            `
            with rank_table as (select *, RANK() OVER(PARTITION BY browser_id order by updated_at desc) from creator_stats where updated_at <= (select event_start_time from contests where id=$1)) select * from rank_table where rank=1;
        `,
            [row_data.id]
        );
        initial_data = {};
        for (let item of initial_team_stats.rows) {
            const { browser_id, views, comments, likes } = item;
            initial_data[browser_id] = { views, comments, likes };
        }
        const final_team_stats = await pool.query(`
            with rank_table as (select *, RANK() OVER(PARTITION BY browser_id order by updated_at desc) from creator_stats)
            select * from rank_table where rank=1;
        `);
        final_data = {};
        for (let item of final_team_stats.rows) {
            const { browser_id, views, comments, likes } = item;
            final_data[browser_id] = { views, comments, likes };
        }
        console.log(final_data);
        const total_points = {};

        if (initial_data.length === final_data.length) {
            Object.keys(final_data).forEach((key) => {
                const view_points = Math.floor(
                    (Number(final_data[key].views) -
                        Number(initial_data[key].views)) /
                        5
                );
                const comment_points =
                    2 *
                    (Number(final_data[key].comments) -
                        Number(initial_data[key].comments));
                const like_points =
                    Number(final_data[key].likes) -
                    Number(initial_data[key].likes);
                total_points[key] = like_points + view_points + comment_points;
            });
            let temp_query_array = [];
            Object.keys(total_points).forEach((key) => {
                temp_query_array.push(
                    `('${key}', ${row_data.id}, ${total_points[key]})`
                );
            });
            temp_query_array = temp_query_array.join(",");
            const update_points = await pool.query(
                `update creator_points as cp set
                score = cp2.score
                from (values ${temp_query_array}) as cp2 (browser_id, contest_id, score)
                where cp.browser_id = cp2.browser_id and cp.contest_id=cp2.contest_id
                `
            );
            console.log(update_points);
        }
    }
});
