const pool = require("../../db/postgreDb");
const { realEscapeString, randomisePoolArray, distributeWinnings } = require("../common/helper");
const { videoData, generateVideoData, generateVideoDataGenre } = require("../common/videoData");


const createVideoContest = async (req, res) => {
    try {
        const {
            contest_name,
            video_ids,
            image_url,
            event_start_time,
            event_end_time,
            participation_fee,
            prize_pool,
            max_participants,
            prizepool_array
        } = req.body;
    
        if(Number(participation_fee) > 0 && !prizepool_array) return res.status(400).json({success: false, message: "prizepool_array missing"})

        const newVideoContest = await pool.query(`
            INSERT INTO video_contests (name, event_start_time, event_end_time, is_expired, image_url, all_video_ids, participation_fee, prize_pool, max_participants, prizepool_array) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
        `, [contest_name, event_start_time, event_end_time, false, image_url, video_ids, participation_fee, prize_pool, max_participants, JSON.stringify(prizepool_array)])
    
        const contest_id = Number(newVideoContest.rows[0].id);
    
        //fetch data from youtube APIs regarding video thumbnail + channel thumbnail images + video_url + channel title 
        const video_data = await videoData(video_ids)

        let query = video_ids.map((item) => {
            return `('${item}', ${contest_id}, '${realEscapeString(video_data[item].channel_title)}', '${realEscapeString(video_data[item].video_title)}', '${video_data[item].video_thumbnail}', '${video_data[item].channel_thumbnail}',0, '${video_data[item].video_published_at}')`;
        });
        const points = pool.query(
            `INSERT INTO video_points (video_id, contest_id, channel_title, video_title, video_thumbnail, channel_thumbnail, score, video_published_at) VALUES ${query}`
        );
        res.status(200).json({contest_name})
    } catch (error) {
        console.log(error)
    }
}

const getExpiredVideoContests = async (req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const allExpiredContests = await pool.query(
            `
            SELECT vc.id, vc.name, vc.image_url FROM video_contests vc 
            where vc.is_expired is true 
            and id not in (select distinct video_contest_id from video_teams where user_id = $1)
            order by vc.id desc
            LIMIT 10`,
            [user_id_mongo]
        );
        const myExpiredContests = await pool.query(
            `
            SELECT vc.id, vc.name, vc.image_url FROM video_contests vc 
            where vc.is_expired is true 
            and id in (select distinct video_contest_id from video_teams where user_id = $1)
            order by vc.id desc`,
            [user_id_mongo]
        );
        const myLiveContests = await pool.query(
            `
            SELECT vc.id, vc.name, vc.image_url FROM video_contests vc 
            where vc.is_expired is false 
            and id in (select distinct video_contest_id from video_teams where user_id = $1)
            order by vc.id desc`,
            [user_id_mongo]
        );
        res.status(200).json({allExpiredContests: allExpiredContests.rows, myExpiredContests: myExpiredContests.rows, myLiveContests: myLiveContests.rows});
    } catch (error) {
        console.log(error)
        res.status(500).json({success: false, message: "Some error occoured while fetching expired video events"})
    }
}

const getLiveVideoContests = async (req, res) => {
    try {
        const liveVideoEvents = await pool.query(`
            SELECT id, name, image_url, event_start_time, participation_fee, prize_pool, max_participants, prizepool_array from video_contests where is_expired is false
        `)
        res.status(200).json({ liveVideoContest: liveVideoEvents.rows });
    } catch (error) {
        console.log(error) 
        res.status(500).json({success: false, message: "Some error occoured while fetching live video events"})
    }
    
}

const getVideoContestInfo = async (req, res) => {
    const event_id = parseInt(req.params.id);
    const contest_details = await pool.query(`
        with info_table as (
            SELECT name, image_url, unnest(all_video_ids) as video_id, event_start_time, event_end_time, is_expired, participation_fee, prize_pool, max_participants, prizepool_array FROM video_contests WHERE id = $1
        )
        , stats_table as (
            SELECT DISTINCT ON (video_id) video_id, video_views, video_likes, video_comments FROM video_stats WHERE video_id in (SELECT unnest(all_video_ids) FROM video_contests WHERE id = $1) ORDER BY video_id, updated_at DESC
        )
        SELECT info_table.*, video_points.*, stats_table.* from info_table
        left join video_points on video_points.video_id = info_table.video_id
        left join stats_table on info_table.video_id = stats_table.video_id
        where video_points.contest_id = $1
    `, [event_id])

    const participants = await pool.query(
        `select count(distinct user_id) as total_teams from video_teams where video_contest_id = $1`
    , [event_id])

    if(participants.rows.length === 0){
        return res.json({contest_details: contest_details.rows})
    }
    res.status(200).json({
        contest_details: contest_details.rows,
        participants: participants.rows[0]["total_teams"]
    });
}

const expireVideoContest = async (req, res) => {
    const contest_id = parseInt(req.params.id);
    const contest_expired = await pool.query(
        `SELECT is_expired, participation_fee, prize_pool, max_participants, prizepool_array FROM video_contests where id=$1`,
        [Number(contest_id)]
    );
    if (contest_expired.rows[0]["is_expired"]) {
        return res.status(400).send("The event has expired");
    }
    const leaderboard = await pool.query(
        `with team_points as (select user_id,unnest(video_team) as video_id from video_teams where video_contest_id = $1)
        select team_points.user_id, SUM(video_points.score) as total_points, RANK() OVER(ORDER BY SUM(video_points.score) desc) from team_points
        left join video_points on team_points.video_id = video_points.video_id
        where video_points.contest_id = $2
        group by 1
        order by rank;`,
        [contest_id, contest_id]
    );
    const winners = {
        rank1: [],
        rank2: [],
        top50_percentile: [],
    };
    let prize_pool = parseInt(contest_expired.rows[0]["prize_pool"]);
    if( parseInt(contest_expired.rows[0]["participation_fee"]) === 0){
        prize_pool = 300;
    }
    const total_participants = parseInt(leaderboard.rows.length);
    
    if (parseInt(contest_expired.rows[0]["participation_fee"]) === 0) {

        //create an array of prize which we want to give to the users
        let prizePoolArray = [100, 75, 35, 30, 25]
        prizePoolArray = randomisePoolArray(prizePoolArray)

        //generate prize distribution 
        
        let winningsArray 
        if(total_participants < 5){
            winningsArray = distributeWinnings(leaderboard.rows, prizePoolArray.slice(0,total_participants))
        }
        else{
            winningsArray = distributeWinnings(leaderboard.rows, prizePoolArray)
        }
        winningsArray = winningsArray.map(entry => {
            if(Number(entry.rank) === 1) {
              return {...entry, card_type: 'GOLDEN'};
            }
            if(Number(entry.rank) === 2) {
              return {...entry, card_type: 'SILVER'};
            }
            if(Number(entry.rank) >= 3 && Number(entry.rank) <= 5) {
              return {...entry, card_type: 'BRONZE'};
            }
            if(Number(entry.rank) > 5) {
              if(Math.random() < 0.6) {
                return {...entry, card_type: 'BLUE', prize: Math.random() > 0.3 ? 0 : Math.floor(Math.random() * 15) + 1};
              }
            }
            return entry;
          });

        //add the name of the scratch cards which should be alloted to the respective users + also add some random blue card holders
        let temp_query = winningsArray
                        .filter(entry => entry.prize !== undefined && entry.card_type !== undefined)
                        .map(entry => `('${entry.card_type}', ${entry.user_id}, ${contest_id}, false, ${entry.prize})`);
        temp_query = temp_query.join(",");
        await pool.query(`
          INSERT INTO scratch_card (card_type, user_id, video_contest_id, is_seen, reward) VALUES ${temp_query}
        `)
        //add the scratch card to the DB
        const expire_event = await pool.query(
            `UPDATE video_contests set is_expired = true where id = $1`,
            [contest_id]
        );
        return res.status(200).json({
            success: true,
        });
    }
    if(!contest_expired.rows[0]["prizepool_array"]) return res.status(500).json({success: false, error: "Prizepool array not found"})
    let prizeDistribution = contest_expired.rows[0]["prizepool_array"]
    let prizePoolArray = [];
    for (let item of prizeDistribution) {
        let ranks = item.rank.split('-');
        let startRank = parseInt(ranks[0]);
        let endRank = ranks[1] ? parseInt(ranks[1]) : startRank;
        let prizes = new Array(endRank - startRank + 1).fill(item.amount);
        prizePoolArray = [...prizePoolArray, ...prizes];
    }
    //create an array of winnings which needs to be distributed
    if(leaderboard.rows.length < prizePoolArray.length){
        prizePoolArray = prizePoolArray.slice(0,leaderboard.rows.length)
    }
    let winningsArray 
    winningsArray = distributeWinnings(leaderboard.rows, prizePoolArray)

    //use the function distributeWinnings to distribute the winnings.
    winningsArray = winningsArray.filter(entry => entry.prize !== undefined)
    for (const winnings of winningsArray){
        const { user_id, prize } = winnings;
        await pool.query(`
            WITH table1 as (UPDATE video_teams SET reward = $1 WHERE user_id = $2 and video_contest_id = $3)
            UPDATE user_info SET winnings = winnings + $1 WHERE id = $2
        `, [prize, user_id, contest_id]);
    }
                        
    const expire_event = await pool.query(
        `UPDATE video_contests set is_expired = true where id = $1`,
        [contest_id]
    );
    res.status(200).json({
        success: true,
    });
}

const createAutomatedVideoContest = async (req, res) => {
    try {
        const {
            contest_name,
            image_url,
            event_start_time,
            event_end_time,
            participation_fee,
            genre,
            prize_pool,
            max_participants,
            prizepool_array
        } = req.body;
        if(genre){
            var video_ids = await generateVideoDataGenre(genre)
            if(typeof video_ids === "string") return res.status(400).json({success: false, message: video_ids})
            if(video_ids.length < 21) return res.status(400).json({success: false, message: "could not find 21 videos"})
        }
        else{
            var video_ids = await generateVideoData()
        }
        if(Number(participation_fee) > 0 && !prizepool_array) return res.status(400).json({success: false, message: "prizepool_array missing"})
        const temp_prizepool_array = JSON.stringify(prizepool_array)
        const newVideoContest = await pool.query(`
            INSERT INTO video_contests (name, event_start_time, event_end_time, is_expired, image_url, all_video_ids, participation_fee, prize_pool, max_participants, prizepool_array) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *
        `, [contest_name, event_start_time, event_end_time, false, image_url, video_ids, participation_fee, prize_pool, max_participants, temp_prizepool_array])
    
        const contest_id = Number(newVideoContest.rows[0].id);
    
        //fetch data from youtube APIs regarding video thumbnail + channel thumbnail images + video_url + channel title 
        const video_data = await videoData(video_ids)

        let query = video_ids.map((item) => {
            return `('${item}', ${contest_id}, '${realEscapeString(video_data[item].channel_title)}', '${realEscapeString(video_data[item].video_title)}', '${video_data[item].video_thumbnail}', '${video_data[item].channel_thumbnail}',0, '${video_data[item].video_published_at}')`;
        });
        const points = pool.query(
            `INSERT INTO video_points (video_id, contest_id, channel_title, video_title, video_thumbnail, channel_thumbnail, score, video_published_at) VALUES ${query}`
        );
        res.status(200).json({success: true, video_data})
    } catch (error) {
        console.log(error)
        res.status(400).json({success: false, error: error})
    }
}

module.exports = {
    createVideoContest,
    getExpiredVideoContests,
    getLiveVideoContests,
    getVideoContestInfo,
    expireVideoContest,
    createAutomatedVideoContest
}
