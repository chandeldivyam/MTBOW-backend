const balanceCalculator = (winnings, topup, promotional, participation_fee) => {
    let winnings_left = winnings;
    let topup_left = topup;
    let promotional_left = promotional;
    let participation_fee_left = participation_fee;
    if (winnings > 0) {
        if (participation_fee_left <= winnings) {
            winnings_left = winnings - participation_fee_left;
            participation_fee_left = 0;
            return { winnings_left, topup_left, promotional_left };
        }
        participation_fee_left = participation_fee_left - winnings_left;
        winnings_left = 0;
    }
    if (topup_left > 0) {
        if (participation_fee_left <= topup_left) {
            topup_left = topup_left - participation_fee_left;
            participation_fee_left = 0;
            return { winnings_left, topup_left, promotional_left };
        }
        participation_fee_left = participation_fee_left - topup_left;
        winnings_left = 0;
    }
    if (promotional_left > 0) {
        promotional_left = promotional_left - participation_fee_left;
        participation_fee_left = 0;
        return { winnings_left, topup_left, promotional_left };
    }
};

module.exports = { balanceCalculator };
