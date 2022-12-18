const cron = require("node-cron");
const pool = require("../../db/postgreDb");

cron.schedule("*/15 * * * * *", async () => {
    try {
        console.log("running the point task every 15 seconds!!!");
        const video_contest_ids = await pool.query(
            `SELECT id, event_start_time, event_end_time FROM video_contests where is_expired is false`
        )
        for(let row_data of video_contest_ids.rows){
            if( Date.now() < new Date(row_data.event_start_time) || Date.now() > new Date(row_data.event_end_time) ) {
                continue;
            }
            const initial_video_stats = await pool.query(`
                with rank_table as (select *, RANK() OVER(PARTITION BY video_id order by updated_at desc) 
                from video_stats 
                where updated_at <= (select event_start_time from video_contests where id=$1) 
                and video_id in (select video_id from video_points where contest_id = $1))
                SELECT * FROM rank_table where rank=1
            `, [row_data.id])

            initial_data = {};
            for (let item of initial_video_stats.rows) {
                const { video_id, video_views, video_comments, video_likes } = item;
                initial_data[video_id] = { video_views, video_comments, video_likes };
            }
            const final_video_stats = await pool.query(`
                with rank_table as (select *, RANK() OVER(PARTITION BY video_id order by updated_at desc) 
                from video_stats 
                where updated_at <= (select event_end_time from video_contests where id=$1) 
                and video_id in (select video_id from video_points where contest_id = $1))
                SELECT * FROM rank_table where rank=1
            `, [row_data.id])
            final_data = {};
            for (let item of final_video_stats.rows) {
                const { video_id, video_views, video_comments, video_likes } = item;
                final_data[video_id] = { video_views, video_comments, video_likes };
            }
            const total_points = {};
            if (initial_data.length === final_data.length) {
                Object.keys(final_data).forEach((key) => {
                    const view_points = Math.floor((Number(final_data[key].video_views) - Number(initial_data[key].video_views)) / 5);
                    const comment_points = 2 * (Number(final_data[key].video_comments) - Number(initial_data[key].video_comments));
                    const like_points = Number(final_data[key].video_likes) - Number(initial_data[key].video_likes);
                    total_points[key] = {like_points, view_points, comment_points}; 
                })
                let temp_query_array = [];
                Object.keys(total_points).forEach((key) => {
                    const {view_points, comment_points, like_points} = total_points[key]
                    const extra_details_obj = JSON.stringify({view_points, comment_points, like_points})
                    temp_query_array.push(`('${key}', ${row_data.id}, ${view_points+comment_points+like_points}, '${extra_details_obj}')`);
                })
                temp_query_array = temp_query_array.join(",");
                const update_points = await pool.query(`
                    update video_points as cp set
                    score = cp2.score
                    , extra_details = cp2.extra_details::jsonb
                    from (values ${temp_query_array}) as cp2 (video_id, contest_id, score, extra_details)
                    where cp.video_id = cp2.video_id and cp.video_id=cp2.video_id
                `)
            }
        }
    } catch (error) {
        console.log(error)
    }
});