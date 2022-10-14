require("dotenv").config();
const { google } = require("googleapis");
const lodash = require("lodash");
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

// auth: "AIzaSyCq9A_4gIUHX1XltFcGPqRU8SKj2BvxsTY",
const pool = require("../../db/postgreDb");

const getUploadId = async (channel_id) => {
    const response = await youtube.channels
        .list({
            part: ["snippet,contentDetails,statistics"],
            id: [channel_id],
        })
        .then((response) => {
            // total views and subscribers to be added here
            return {
                upload_id:
                    response["data"]["items"][0]["contentDetails"][
                        "relatedPlaylists"
                    ]["uploads"],
                channel_views:
                    response["data"]["items"][0]["statistics"]["viewCount"],
                channel_subscribers:
                    response["data"]["items"][0]["statistics"][
                        "subscriberCount"
                    ],
                channel_videos_total:
                    response["data"]["items"][0]["statistics"]["videoCount"],
                channel_name: response["data"]["items"][0]["snippet"]["title"],
            };
        })
        .catch((err) => {
            console.log(err);
        });
    return response;
};

const getVideoIdList = async (upload_id, nextPageToken) => {
    const video_list = [];
    const response = await youtube.playlistItems
        .list({
            part: ["snippet,contentDetails"],
            playlistId: upload_id,
            maxResults: 50,
            pageToken: nextPageToken,
        })
        .then((res) => {
            for (item of res.data.items) {
                video_list.push(item.contentDetails.videoId);
            }
            return {
                video_list: video_list,
                nextPageToken: res.data.nextPageToken,
            };
        })
        .catch((err) => {
            console.log(err);
        });
    return response;
};

const getVideoDetails = async (video_ids) => {
    const response = await youtube.videos
        .list({
            part: ["statistics"],
            id: [video_ids],
        })
        .then((res) => {
            let temp_stats = {
                total_likes: 0,
                total_comments: 0,
                total_views: 0,
            };
            for (item of res.data.items) {
                if (Number(item.statistics.likeCount)) {
                    temp_stats.total_likes += Number(item.statistics.likeCount);
                }
                if (Number(item.statistics.commentCount)) {
                    temp_stats.total_comments += Number(
                        item.statistics.commentCount
                    );
                }
                if (Number(item.statistics.viewCount)) {
                    temp_stats.total_views += Number(item.statistics.viewCount);
                }
            }
            return temp_stats;
        });
    return response;
};

const fetchChannelData = async (browser_id) => {
    // const mr_beast_channel_id = "UCX6OQ3DkcsbYNE6H8uQQuVA";
    let pageToken = null;
    let channel_statistics = {};
    let video_id_list = [];
    const {
        upload_id,
        channel_videos_total,
        channel_subscribers,
        channel_name,
    } = await getUploadId(browser_id);
    console.log(upload_id);
    channel_statistics.channel_name = channel_name;
    channel_statistics.channel_videos_total = Number(channel_videos_total);
    channel_statistics.channel_subscribers = Number(channel_subscribers);
    channel_statistics.channel_views = 0;
    channel_statistics.channel_likes = 0;
    channel_statistics.channel_comments = 0;
    do {
        const { video_list, nextPageToken } = await getVideoIdList(
            upload_id,
            pageToken
        );

        video_id_list = lodash.concat(video_id_list, video_list);
        pageToken = nextPageToken;
    } while (pageToken);
    for (let i = 0; i < video_id_list.length; i = i + 50) {
        const { total_likes, total_comments, total_views } =
            await getVideoDetails(lodash.join(video_id_list.slice(i, i + 50)));
        channel_statistics.channel_likes += total_likes;
        channel_statistics.channel_comments += total_comments;
        channel_statistics.channel_views += total_views;
    }
    // console.log(channel_statistics);
    //console.log(channel_statistics);
    return channel_statistics;
};

// fetchChannelData("UCj22tfcQrWG7EMEKS0qLeEg");
const fetchAllData = async (browser_ids) => {
    const creatorsData = [];
    for (const browser_id of browser_ids) {
        try {
            let stats = await fetchChannelData(browser_id);
            const create_stats = await pool.query(
                `INSERT INTO creator_stats (browser_id, views,comments, likes,subscribers,total_videos) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    browser_id,
                    stats.channel_views,
                    stats.channel_comments,
                    stats.channel_likes,
                    stats.channel_subscribers,
                    stats.channel_videos_total,
                ]
            );
            creatorsData.push(stats);
            //console.log(stats);
        } catch (error) {
            console.log(error);
        }
    }
    return creatorsData;
};

module.exports = { fetchAllData };

