const pool = require("../../db/postgreDb");
const { realEscapeString, randomisePoolArray, distributeWinnings, convertToIST } = require("../common/helper");
const { videoData, generateVideoData, generateVideoDataGenre } = require("../common/videoData");

const testFunc = async() => {
    const all_video_ids = await pool.query(`
        SELECT distinct video_id FROM video_points;
    `)
    const final_ids = all_video_ids.rows.map(obj => obj.video_id);
    const data = await videoData(final_ids)
    for (const key of Object.keys(data)) {
        const video_published_at = data[key].video_published_at;
        const update_status = await pool.query(
          `UPDATE video_points SET video_published_at = $1 WHERE video_id = $2`,
          [video_published_at, key]
        );
        console.log(`Done for : ${key}`)
    }
}
testFunc()