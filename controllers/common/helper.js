const crypto = require("crypto");
const https = require("https");

function encodeRequest(payload) {
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function decodeRequest(payload) {
    return JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
}

function signRequest(payload) {
    return crypto.createHash("sha256").update(payload).digest("hex");
}

function realEscapeString (str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
                return "";
            case `"`:
                return "";
            case "\\":
            case "%":
                return "\\"+char; // prepends a backslash to backslash, percent,
                                  // and double/single quotes
            default:
                return char;
        }
    });
}

function initialScoreCalculator (release_time, views, comments, likes){
    const time_taken = Math.floor(((new Date() - new Date(release_time))/1000/60) << 0);
    return Math.floor((Math.floor(Number(views)/50) + Number(likes) + (2*Number(comments))) / time_taken);
}

const sleep = async function (ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
};

function shuffle(arra1) {
    var ctr = arra1.length, temp, index;

// While there are elements in the array
    while (ctr > 0) {
// Pick a random index
        index = Math.floor(Math.random() * ctr);
// Decrease ctr by 1
        ctr--;
// And swap the last element with it
        temp = arra1[ctr];
        arra1[ctr] = arra1[index];
        arra1[index] = temp;
    }
    return arra1;
}

const distributeWinnings = (leaderboard, prizePoolArray) => {
    const sortedLeaderboard = leaderboard.sort((a, b) => a.rank - b.rank);
    const countByRank = sortedLeaderboard.reduce((counts, entry) => {
        if (!counts[entry.rank]) {
          counts[entry.rank] = 0;
        }
        counts[entry.rank]++;
        return counts;
      }, {});
    let prizeIndex = 0
    while(prizeIndex < prizePoolArray.length){
        if(countByRank[sortedLeaderboard[prizeIndex].rank] > 1){
            //give sum of the money with all the same rank
            const prize = Math.floor(prizePoolArray.slice(prizeIndex, prizeIndex + countByRank[sortedLeaderboard[prizeIndex].rank]).reduce((a, b) => a + b, 0) / countByRank[sortedLeaderboard[prizeIndex].rank]);
            for(let i = 0; i < countByRank[sortedLeaderboard[prizeIndex].rank]; i++){
                sortedLeaderboard[i + prizeIndex] = {...sortedLeaderboard[i + prizeIndex], prize}
            }
            prizeIndex += countByRank[sortedLeaderboard[prizeIndex].rank]
        }
        else{
            sortedLeaderboard[prizeIndex] = {...sortedLeaderboard[prizeIndex], prize: prizePoolArray[prizeIndex]}
            prizeIndex += 1
        }
    }
    return sortedLeaderboard
}

const randomisePoolArray = (prizePoolArray) => {
    let sum = prizePoolArray.reduce((a, b) => a + b, 0);
    
    for (let i = 0; i < prizePoolArray.length; i++) {
      const randomFactor = (Math.random() - 0.5) * 0.2;
      prizePoolArray[i] = prizePoolArray[i] + prizePoolArray[i] * randomFactor;
    }
    
    const updatedSum = prizePoolArray.reduce((a, b) => a + b, 0);
    const factor = sum / updatedSum;
    
    for (let i = 0; i < prizePoolArray.length; i++) {
      prizePoolArray[i] = Math.floor(prizePoolArray[i] * factor);
    }
    return(prizePoolArray)
}

function getRandomItems(arr, numItems) {
    if (numItems > arr.length) {
      throw new Error("Cannot select more items than the array contains");
    }
  
    const selectedItems = new Set();
    while (selectedItems.size < numItems) {
      const randomIndex = Math.floor(Math.random() * arr.length);
      selectedItems.add(arr[randomIndex]);
    }
  
    return Array.from(selectedItems);
  }

function convertToIST(utcString) {
    const utcDate = new Date(utcString);
    const istOffset = 5 * 60 + 30; // IST offset in minutes (5 hours and 30 minutes)
    const istDate = new Date(utcDate.getTime() + istOffset * 60000);

    const formattedDate = istDate.toISOString().split('.')[0].replace('T', ' ');
    const istString = formattedDate + '+05:30';
  
    return istString;
}

module.exports = {
    encodeRequest,
    signRequest,
    decodeRequest,
    realEscapeString,
    initialScoreCalculator,
    sleep,
    shuffle,
    distributeWinnings,
    randomisePoolArray,
    getRandomItems,
    convertToIST
};
