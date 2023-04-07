const cron = require("node-cron");
const { videoStats } = require("../common/videoData");
const pool = require("../../db/postgreDb");

cron.schedule("*/30 * * * * *", async () => {
    console.log("running a task every thirty seconds!!!");
    const video_ids_data = await pool.query(`
        select distinct unnest(all_video_ids) as video_id from video_contests where is_expired = false and NOW() < event_end_time; 
    `)
    const video_ids = [];
    for (let video_id_obj of video_ids_data.rows) {
        video_ids.push(video_id_obj.video_id);
    }
    if(video_ids.length > 0){
	    const creatorStats = await videoStats(video_ids);
	}
    else {
	console.log("Video ids array is empty")
	}
});
