const cron = require("node-cron");
const { fetchAllData } = require("./common/fetchScore");
const pool = require("../db/postgreDb");

cron.schedule("* * * * *", async () => {
    //console.log("running a task every three mins!!!");
    const browser_id_data = await pool.query(`select distinct unnest(all_creators) as browser_id from contests where is_expired = false and NOW() > event_start_time - interval '2 minutes' and NOW() < event_end_time;`);
    const browser_ids = [];
    for (browser_id_object of browser_id_data.rows) {
        browser_ids.push(browser_id_object.browser_id);
    }
    if(browser_ids.length > 0){
	const creatorStats = await fetchAllData(browser_ids);
	console.log("Added stats!!");
	}
    else {
	console.log("Browser ids array is empty")
	}
});
