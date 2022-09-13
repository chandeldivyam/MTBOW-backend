const cron = require("node-cron");
const { fetchAllData } = require("./common/fetchScore");
const pool = require("../db/postgreDb");

cron.schedule("*/45 * * * * *", async () => {
    console.log("running a task every three mins!!!");
    const browser_id_data = await pool.query(`select browser_id from creators`);
    const browser_ids = [];
    for (browser_id_object of browser_id_data.rows) {
        browser_ids.push(browser_id_object.browser_id);
    }
    const creatorStats = await fetchAllData(browser_ids);
    console.log("Added stats!!");
});
