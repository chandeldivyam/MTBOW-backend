require("dotenv").config();
const { google } = require("googleapis");
const distance = require('distance');
const { initialScoreCalculator, sleep, shuffle, convertToIST } = require("./helper")
const lodash = require("lodash");
const pool = require("../../db/postgreDb");
const kmeans = require('node-kmeans');
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
        const video_published_at = item.snippet.publishedAt ? item.snippet.publishedAt : ''
        responseObject[temp_id] = {
            channel_title: temp_creator_title,
            video_title: temp_video_title,
            video_thumbnail: temp_video_thubmnail,
            channel_thumbnail: temp_channel_thubmnail,
            video_published_at: convertToIST(video_published_at)
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

const generateVideoData = async() => {
    try {
        const video_sample_data = [];
        let next_page_token = ""
        let video_response = await youtube.videos.list({
            "part": [
            "snippet",
            "statistics"
            ],
            "regionCode": "IN",
            "maxResults": 50,
            "chart": "mostPopular"
        });
        if(video_response.data.nextPageToken){next_page_token = video_response.data.nextPageToken}
        const temp_obj_videos = {}
        if(!video_response.data.items){
            console.log("Missing Items in the api response")
            return
        }
        for(let item of video_response.data.items){
            if(!item.id || !item.snippet.channelTitle || !item.snippet.title || !item.snippet.thumbnails.standard.url || !item.snippet.publishedAt) continue
            //skipping the channel thumbnail check because it will call the youtube api for no reason
            if(!item.statistics.commentCount || !item.statistics.viewCount || !item.statistics.likeCount) continue
            if(Number(item.statistics.viewCount) > 7000000 || Number(item.statistics.viewCount) < 1000000) continue
            temp_obj_videos[item.id] = {
                video_id: item.id,
                channelTitle: item.snippet.channelTitle,
                title: item.snippet.title,
                video_thumbnail: item.snippet.thumbnails.standard.url,
                video_release_time: item.snippet.publishedAt,
                video_view_initial: Number(item.statistics.viewCount),
                    video_comments_initial: Number(item.statistics.commentCount),
                    video_likes_initial: Number(item.statistics.likeCount),
                initial_score: initialScoreCalculator(item.snippet.publishedAt, item.statistics.viewCount, item.statistics.commentCount, item.statistics.likeCount)
            }
        }
        while(Object.keys(temp_obj_videos).length < 200 && next_page_token){
            video_response = await youtube.videos.list({
                "part": [
                "snippet",
                "statistics"
                ],
                "regionCode": "IN",
                "maxResults": 50,
                "pageToken": next_page_token,
                "chart": "mostPopular"
            });
            next_page_token = video_response.data.nextPageToken ? video_response.data.nextPageToken : false
            for(let item of video_response.data.items){
                if(!item.id || !item.snippet.channelTitle || !item.snippet.title || !item.snippet.thumbnails.standard || !item.snippet.thumbnails.standard.url || !item.snippet.publishedAt) continue
                //skipping the channel thumbnail check because it will call the youtube api for no reason
                if(!item.statistics.commentCount || !item.statistics.viewCount || !item.statistics.likeCount) continue
                if(Number(item.statistics.viewCount) > 7000000 || Number(item.statistics.viewCount) < 1000000) continue
                temp_obj_videos[item.id] = {
                    video_id: item.id,
                    channelTitle: item.snippet.channelTitle,
                    title: item.snippet.title,
                    video_thumbnail: item.snippet.thumbnails.standard.url,
                    video_release_time: item.snippet.publishedAt,
                    video_view_initial: Number(item.statistics.viewCount),
                    video_comments_initial: Number(item.statistics.commentCount),
                    video_likes_initial: Number(item.statistics.likeCount),
                    initial_score: initialScoreCalculator(item.snippet.publishedAt, item.statistics.viewCount, item.statistics.commentCount, item.statistics.likeCount)
                }
            }
        }
        // sleep for 1 minute
        await sleep(60000)
        for(let i = 0; i<Object.keys(temp_obj_videos).length; i = i+50){
            let video_array_50 = Object.keys(temp_obj_videos).slice(i, i+50)
            video_response = await youtube.videos.list({
                "part": [
                "statistics"
                ],
                "id": video_array_50
            })
            for(let item of video_response.data.items){
                if(!item.id || !temp_obj_videos[item.id]){
                    continue
                }
                //skipping the channel thumbnail check because it will call the youtube api for no reason
                if(!item.statistics.commentCount || !item.statistics.viewCount || !item.statistics.likeCount){
                    continue
                }
                final_score = Math.floor((Number(item.statistics.viewCount) - temp_obj_videos[item.id].video_view_initial)/30) 
                            + Math.floor((Number(item.statistics.likeCount) - temp_obj_videos[item.id].video_likes_initial)) 
                            + Math.floor((Number(item.statistics.commentCount) - temp_obj_videos[item.id].video_comments_initial)*2) 
                temp_obj_videos[item.id] = {
                    ...temp_obj_videos[item.id],
                    final_score
                }
            }
        }
        const teamsData = Object.values(temp_obj_videos).map(video => [video.initial_score, video.final_score]);
        let kmean_response = []
        let video_index_arr = []
        const video_indexes = await new Promise((resolve, reject) => {
            kmeans.clusterize(teamsData, {k: 7}, async(err, res) => {
                if (err) console.error(err);
                else {
                    const intraClusterDistance = res.map(cluster => {
                        let sum = 0;
                        cluster.clusterInd.forEach(index => {
                            var dis = Math.sqrt(Math.pow(teamsData[index][0]-cluster.centroid[0],2) + Math.pow(teamsData[index][1]-cluster.centroid[1],2));
                            sum += dis
                        });
                        return sum / cluster.clusterInd.length;
                    });
                    if(res.length === intraClusterDistance.length){
                        for(let i=0; i<intraClusterDistance.length; i++){
                            kmean_response[i] = {...res[i], intraClusterDistance: intraClusterDistance[i]}
                        }
                        kmean_response.sort((a, b) => b.centroid[1] - a.centroid[1]);
                    }
                    for(let i = 0; i < kmean_response.length; i++){
                        if(video_index_arr.length >= 21) break
                        if(kmean_response[i].clusterInd.length < 5) continue
                        if(kmean_response[i].clusterInd.length > (21 - video_index_arr.length)){
                            //add only few items
                            video_index_arr = [...video_index_arr, ...kmean_response[i].clusterInd.slice(0,(21 - video_index_arr.length))]
                        }
                        else{
                            //add all the items
                            video_index_arr = [...video_index_arr, ...kmean_response[i].clusterInd]
                        }
                    }
                    resolve(video_index_arr)
                }
            });
        })
        let video_arr = []
        video_indexes.forEach((index) => {
            video_arr.push(Object.keys(temp_obj_videos)[index])
        })
        video_arr = shuffle(video_arr)
        return video_arr
        //Selecting 35 videos out of the selected 100 videos with similar or close score with each other in 1 minute duration

        //selecting 21 out of these 35 videos at random
    } catch (error) {
        console.log(error)
    }
    //Getting 100 valid videos with all the required data points select from in a particular category type (we can also use search page for the same)

}

const generateVideoDataGenre = async(genre) => {
    try {
        const video_sample_data = [];
        let next_page_token = ""
        let video_response = await youtube.videos.list({
            "part": [
            "snippet",
            "statistics"
            ],
            "regionCode": "IN",
            "maxResults": 50,
            "chart": "mostPopular",
            "videoCategoryId": `${genre}`
        });
        if(video_response.data.nextPageToken){next_page_token = video_response.data.nextPageToken}
        if(video_response.data.pageInfo.totalResults <= 21){
            return "Not enough videos in this genre"
        }
        const temp_obj_videos = {}
        if(!video_response.data.items){
            console.log("Missing Items in the api response")
            return
        }
        for(let item of video_response.data.items){
            if(!item.id || !item.snippet.channelTitle || !item.snippet.title || !item.snippet.thumbnails.standard || !item.snippet.thumbnails.standard.url || !item.snippet.publishedAt) continue
            //skipping the channel thumbnail check because it will call the youtube api for no reason
            if(!item.statistics.commentCount || !item.statistics.viewCount || !item.statistics.likeCount) continue
            if(Number(item.statistics.viewCount) > 7000000 || Number(item.statistics.viewCount) < 1000000) continue

            temp_obj_videos[item.id] = {
                video_id: item.id,
                channelTitle: item.snippet.channelTitle,
                title: item.snippet.title,
                video_thumbnail: item.snippet.thumbnails.standard.url,
                video_release_time: item.snippet.publishedAt,
                video_view_initial: Number(item.statistics.viewCount),
                    video_comments_initial: Number(item.statistics.commentCount),
                    video_likes_initial: Number(item.statistics.likeCount),
                initial_score: initialScoreCalculator(item.snippet.publishedAt, item.statistics.viewCount, item.statistics.commentCount, item.statistics.likeCount)
            }
        }
        while(Object.keys(temp_obj_videos).length < 200 && next_page_token){
            video_response = await youtube.videos.list({
                "part": [
                "snippet",
                "statistics"
                ],
                "regionCode": "IN",
                "maxResults": 50,
                "pageToken": next_page_token,
                "chart": "mostPopular",
                "videoCategoryId": `${genre}`
            });
            next_page_token = video_response.data.nextPageToken ? video_response.data.nextPageToken : false
            for(let item of video_response.data.items){
                if(!item.id || !item.snippet.channelTitle || !item.snippet.title || !item.snippet.thumbnails.standard || !item.snippet.thumbnails.standard.url || !item.snippet.publishedAt) continue
                //skipping the channel thumbnail check because it will call the youtube api for no reason
                if(!item.statistics.commentCount || !item.statistics.viewCount || !item.statistics.likeCount) continue
                if(Number(item.statistics.viewCount) > 7000000 || Number(item.statistics.viewCount) < 1000000) continue
                temp_obj_videos[item.id] = {
                    video_id: item.id,
                    channelTitle: item.snippet.channelTitle,
                    title: item.snippet.title,
                    video_thumbnail: item.snippet.thumbnails.standard.url,
                    video_release_time: item.snippet.publishedAt,
                    video_view_initial: Number(item.statistics.viewCount),
                    video_comments_initial: Number(item.statistics.commentCount),
                    video_likes_initial: Number(item.statistics.likeCount),
                    initial_score: initialScoreCalculator(item.snippet.publishedAt, item.statistics.viewCount, item.statistics.commentCount, item.statistics.likeCount)
                }
            }
        }
        // sleep for 1 minute
        await sleep(60000)
        for(let i = 0; i<Object.keys(temp_obj_videos).length; i = i+50){
            let video_array_50 = Object.keys(temp_obj_videos).slice(i, i+50)
            video_response = await youtube.videos.list({
                "part": [
                "statistics"
                ],
                "id": video_array_50
            })
            for(let item of video_response.data.items){
                if(!item.id || !temp_obj_videos[item.id]){
                    continue
                }
                //skipping the channel thumbnail check because it will call the youtube api for no reason
                if(!item.statistics.commentCount || !item.statistics.viewCount || !item.statistics.likeCount){
                    continue
                }
                final_score = Math.floor((Number(item.statistics.viewCount) - temp_obj_videos[item.id].video_view_initial)/30) 
                            + Math.floor((Number(item.statistics.likeCount) - temp_obj_videos[item.id].video_likes_initial)) 
                            + Math.floor((Number(item.statistics.commentCount) - temp_obj_videos[item.id].video_comments_initial)*2) 
                temp_obj_videos[item.id] = {
                    ...temp_obj_videos[item.id],
                    final_score
                }
            }
        }
        const teamsData = Object.values(temp_obj_videos).map(video => [video.initial_score, video.final_score]);
        let kmean_response = []
        let video_index_arr = []
        const video_indexes = await new Promise((resolve, reject) => {
            kmeans.clusterize(teamsData, {k: 7}, async(err, res) => {
                if (err) console.error(err);
                else {
                    const intraClusterDistance = res.map(cluster => {
                        let sum = 0;
                        cluster.clusterInd.forEach(index => {
                            var dis = Math.sqrt(Math.pow(teamsData[index][0]-cluster.centroid[0],2) + Math.pow(teamsData[index][1]-cluster.centroid[1],2));
                            sum += dis
                        });
                        return sum / cluster.clusterInd.length;
                    });
                    if(res.length === intraClusterDistance.length){
                        for(let i=0; i<intraClusterDistance.length; i++){
                            kmean_response[i] = {...res[i], intraClusterDistance: intraClusterDistance[i]}
                        }
                        kmean_response.sort((a, b) => b.centroid[1] - a.centroid[1]);
                    }
                    for(let i = 0; i < kmean_response.length; i++){
                        if(video_index_arr.length >= 21) break
                        if(kmean_response[i].clusterInd.length < 5) continue
                        if(kmean_response[i].clusterInd.length > (21 - video_index_arr.length)){
                            //add only few items
                            video_index_arr = [...video_index_arr, ...kmean_response[i].clusterInd.slice(0,(21 - video_index_arr.length))]
                        }
                        else{
                            //add all the items
                            video_index_arr = [...video_index_arr, ...kmean_response[i].clusterInd]
                        }
                    }
                    resolve(video_index_arr)
                }
            });
        })
        let video_arr = []
        video_indexes.forEach((index) => {
            video_arr.push(Object.keys(temp_obj_videos)[index])
        })
        video_arr = shuffle(video_arr)
        return video_arr
        //Selecting 35 videos out of the selected 100 videos with similar or close score with each other in 1 minute duration

        //selecting 21 out of these 35 videos at random
    } catch (error) {
        console.log(error)
    }
    //Getting 100 valid videos with all the required data points select from in a particular category type (we can also use search page for the same)

}
module.exports = {
    videoData,
    videoStats,
    generateVideoData,
    generateVideoDataGenre
}

