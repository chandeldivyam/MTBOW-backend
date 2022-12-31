require("dotenv").config();
const { google } = require("googleapis");
const lodash = require("lodash");
const pool = require("../../db/postgreDb");
const getRandomInt = (max) => {
    return Math.floor(Math.random() * max);
};

const youtube_key = [
    "AIzaSyBhBR_tAqUaOOz-hrM-hvL9PFEgilT12fk",
    "AIzaSyCq9A_4gIUHX1XltFcGPqRU8SKj2BvxsTY",
    "AIzaSyBvY1jsO6VCb1Lf1pN_4tkzYkIp7GjLWGg",
    "AIzaSyCojS5-bFxQRJ4Vacu9LjNUtnyq6dQ61Uo",
    "AIzaSyAsII3PbmG3zEpLhxMUY6MeTfRaWr4M4Is",
    "AIzaSyDM9YM3ftNkYq7X8bSWra8icf6GqD3FF5g",
    "AIzaSyD8FvDFeI3NaACEJHgJ3-MSDEsEpN9sOe8"
];
const youtube = google.youtube({
    version: "v3",
    auth: youtube_key[getRandomInt(7)],
});

const videoData = async(video_ids) => {
    const responseObject = {};
    const video_response = await youtube.videos.list({
        "part": [
          "statistics,snippet"
        ],
        "id": video_ids
    })
    for(let item of video_response.data.items){
        const temp_id = item.id
        const temp_creator_title = item.snippet.channelTitle
        const temp_video_title = item.snippet.title
        const temp_video_thubmnail = item.snippet.thumbnails.standard.url
        const channel_data_response = await youtube.channels.list({
            "part": [
              "statistics,snippet"
            ],
            "id": [item.snippet.channelId]
        })
        const temp_channel_thubmnail = channel_data_response.data.items[0].snippet.thumbnails.high.url
        responseObject[temp_id] = {
            channel_title: temp_creator_title,
            video_title: temp_video_title,
            video_thumbnail: temp_video_thubmnail,
            channel_thumbnail: temp_channel_thubmnail
        }
    }
    // console.log(responseObject)
    return responseObject
}

const videoStats = async(video_ids) => {
    const responseObject = {};
    const video_response = await youtube.videos.list({
        "part": [
          "statistics"
        ],
        "id": video_ids
    })
    for (let item of video_response.data.items){
        if(!item.statistics.likeCount){
            responseObject[item.id] = {
                video_views: Number(item.statistics.viewCount),
                video_likes: 0,
                video_comments: Number(item.statistics.commentCount)
            }
        }
        else{
            responseObject[item.id] = {
                video_views: Number(item.statistics.viewCount),
                video_likes: Number(item.statistics.likeCount),
                video_comments: Number(item.statistics.commentCount)
            }
        }
    }
    const query_arr = []
    Object.keys(responseObject).forEach((key) => {
        query_arr.push(`('${key}', ${responseObject[key].video_views}, ${responseObject[key].video_likes}, ${responseObject[key].video_comments})`)
    })
    const query = query_arr.join(",")
    const db_res = await pool.query(`
        INSERT INTO video_stats (video_id, video_views, video_likes, video_comments) VALUES ${query};
    `)
    return 'success'
}
module.exports = {
    videoData,
    videoStats
}