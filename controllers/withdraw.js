require("dotenv").config();
const pool = require("../db/postgreDb");
const axios = require("axios");
const { fast2smsSend } = require("../utils/otp");

const initiateWithdrawal = async(req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const amount = Number(req.body.amount);

        if(!amount || amount <= 0) return res.status(400).json({success:false, message: "Amount not mentioned"});

        //check if any previous request is pending: If yes return waiting response
        const active_requests = await pool.query(`
            SELECT * FROM withdraw_request where user_id = $1 and withdraw_status = 'PENDING' ORDER BY created_at desc
        `, [user_id_mongo])

        if(active_requests.rows.length > 0) return res.status(400).json({success:false, message: "Previous request already pending"});

        //create a new request to initiate transaction (only allow if amount <= winnings amount)

        const balance = await pool.query(
            `
            select topup, promotional, winnings from user_info where id = $1
        `,
            [user_id_mongo]
        );
        const { topup, promotional, winnings } = balance.rows[0];

        if(amount > Number(winnings)) return res.status(400).json({success:false, message: "Can not withdraw amount more than winnings"});

        //check for verification
        const verification_status = await pool.query(`SELECT * FROM verification where user_id = $1`, [user_id_mongo])
        if(verification_status.rows.length !== 1) return res.status(400).json({success: false, status: "NO_ENTRY"})
        if(verification_status.rows[0].upi_verification_status !== 'SUCCESS' || verification_status.rows[0].pan_verification_status !== 'SUCCESS') return res.status(400).json({success: false, status: "UNVERIFIED"})
        await fast2smsSend({ message: `${user_id_mongo}`, contactNumber: "9575555584" }, null)
        await pool.query(`
            INSERT INTO withdraw_request (updated_at, user_id, withdraw_amount, withdraw_status) VALUES (NOW(), $1, $2, 'PENDING')
        `, [user_id_mongo, amount])

        res.status(200).json({success: true, message: "Withdrawal Request Generated Successfully!"})

    } catch (error) {
        console.log(error)
    }
}

const checkWithdrawalStatus = async(req, res) => {
    //check for pan and upi validation status, and send response accordingly
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const verification_status = await pool.query(`SELECT * FROM verification where user_id = $1`, [user_id_mongo])
        if(verification_status.rows.length !== 1) return res.status(200).json({success: false, status: "NO_ENTRY"})
        if(verification_status.rows[0].upi_verification_status !== 'SUCCESS') return res.status(200).json({success: false, status: "UNVERIFIED_VPA"})
        if(verification_status.rows[0].pan_verification_status !== 'SUCCESS') return res.status(200).json({success: false, status: "UNVERIFIED_PAN"})
        
        const pending_withdrawal = await pool.query(
            `SELECT * FROM withdraw_request where withdraw_status = 'PENDING' and user_id = $1`
            , [user_id_mongo]
        )
        
        if(pending_withdrawal.rows.length === 1){
            return res.status(200).json({success: true, status: "WITHDRAW_PENDING", amount: pending_withdrawal.rows[0].withdraw_amount})
        }

        return res.status(200).json({success: true, status: "ACTIVE"})
    } catch (error) {
        console.log(error);
    }
}

const settleWithdrawal = async(req, res) => {
    //settle a withdrawal after paying money manually
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const amount = Number(req.body.amount)
        const user_id = Number(req.body.user_id)
        if(user_id_mongo !== 1) return res.status(401).json({success: false})
        await pool.query(`
            UPDATE user_info SET winnings = winnings - $1 where id = $2
        `, [amount, user_id])
        await pool.query(`
            UPDATE withdraw_request SET withdraw_status = 'SUCCESS' where user_id = $1 and withdraw_status = 'PENDING'
        `, [user_id])
        res.status(200).json({success: true})
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    initiateWithdrawal,
    checkWithdrawalStatus,
    settleWithdrawal
}