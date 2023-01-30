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
    return Math.floor((Math.floor(Number(views)/10) + Number(likes) + (2*Number(comments))) / time_taken);
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

module.exports = {
    encodeRequest,
    signRequest,
    decodeRequest,
    realEscapeString,
    initialScoreCalculator,
    sleep,
    shuffle
};
