const pool = require("../../db/postgreDb");
const { realEscapeString, randomisePoolArray, distributeWinnings, convertToIST } = require("../common/helper");
const { videoData, generateVideoData, generateVideoDataGenre } = require("../common/videoData");

const testFunc = async() => {
    const prizePoolArray = []
    const prize_pool = 1000
    for(let i = 0; i <= Number(100)/2; i++){
        if(i===0){
            prizePoolArray.push(parseInt(prize_pool * 0.25))
            continue
        }
        if(i===1){
            prizePoolArray.push(parseInt(prize_pool * 0.125))
            continue
        }
        if(i===2){
            prizePoolArray.push(parseInt(prize_pool * 0.07))
            continue
        }
        if(i===3 || i===4){
            prizePoolArray.push(parseInt(prize_pool * 0.04))
            continue
        }
        if(i > 4 && i <= 9){
            prizePoolArray.push(parseInt(prize_pool * 0.025))
            continue
        }
        if(i > 9 && i <= 19){
            prizePoolArray.push(parseInt(prize_pool * 0.015))
            continue
        }
        if(i > 19 && i <= 29){
            prizePoolArray.push(parseInt(prize_pool * 0.010))
            continue
        }
        if(i > 29 && i <= 49){
            prizePoolArray.push(parseInt(prize_pool * 0.005))
            continue
        }
    }
    console.log(prizePoolArray)
    let prizeDistribution = [
        {rank: "1", amount: 250},
        {rank: "2", amount: 125},
        {rank: "3", amount: 70},
        {rank: "4-5", amount: 40},
        {rank: "6-10", amount: 25},
        {rank: "11-20", amount: 15},
        {rank: "21-30", amount: 10},
        {rank: "31-50", amount: 5}
    ]
    let result = [];
    for (let prize of prizeDistribution) {
        let ranks = prize.rank.split('-');
        let startRank = parseInt(ranks[0]);
        let endRank = ranks[1] ? parseInt(ranks[1]) : startRank;
        let prizes = new Array(endRank - startRank + 1).fill(prize.amount);
        result = [...result, ...prizes];
    }
    console.log(result)
}
testFunc()