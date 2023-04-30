require("dotenv").config();
const pool = require("../db/postgreDb");
const axios = require("axios");
const {
    encodeRequest,
    signRequest,
    decodeRequest,
} = require("./common/helper");
const fetch = require("node-fetch");
const fsm = require('fuzzy-string-matching');
const { fast2smsSend } = require("../utils/otp");

const validateVpa = async(req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const { vpa, name } = req.body;
        if(!vpa || !name) {
            return res.status(400).json({success: false, reason: "missing required information"})
        }
        //check if VPA already verified in the db (check for line item)
        const verification_db_entry = await pool.query(`SELECT * FROM verification where user_id = $1`, [user_id_mongo])
        if(verification_db_entry.rows.length === 1 && verification_db_entry.rows[0].upi_verification_status === 'SUCCESS'){
            return res.status(400).json({message: "VPA Already verified for this user"})
        }
        //creating payload and fetching data from Phonepe
        const payload = {
            merchantId: process.env.PHONEPE_UAT_MID,
            vpa: vpa
        }
        const payload_base64 = encodeRequest(payload);
        const sign = payload_base64 + "/pg/v1/vpa/validate" + process.env.PHONEPE_UAT_KEY;
        const x_verify = signRequest(sign) + "###" + process.env.PHONEPE_UAT_KEYINDEX;
        const options = {
            method: "POST",
            headers: {
                accept: "application/json",
                "Content-Type": "application/json",
                "X-VERIFY": x_verify,
            },
            body: JSON.stringify({
                request: payload_base64,
            }),
        };
        const vpa_verification = await fetch(
            "https://api.phonepe.com/apis/hermes/pg/v1/vpa/validate",
            options
        )
            .then((response) => response.json())
            .catch((err) => console.error(err));

        if(vpa_verification.success === false && vpa_verification.code === 'INVALID_VPA') return res.status(200).json({success: vpa_verification.success, message: vpa_verification.message})
        if(vpa_verification.success === false){
            return res.status(400).json({success: false, message: "Please try later"})
        }
        if(vpa_verification.success && vpa_verification.code === 'SUCCESS'){
            if(!vpa_verification.data.name || !vpa_verification.data.vpa) return res.status(500).send("Internal server error with VPA Verification")
            //if entry not available, create it
            if(verification_db_entry.rows.length === 0){
                await pool.query(`
                    INSERT INTO verification (updated_at, user_id, name_in_upi, upi_id, upi_verification_status) VALUES (NOW(), $1, $2, $3, 'SUCCESS');
                `, [user_id_mongo, vpa_verification.data.name, vpa_verification.data.vpa])
                return res.status(200).json({success: true, vpa: vpa_verification.data.vpa})
            }
            //if entry available, update the entry
            await pool.query(`
                UPDATE verification SET updated_at = NOW(), upi_verification_status = 'SUCCESS', name_in_upi = $1, upi_id = $2 WHERE user_id = $3;
            `, [vpa_verification.data.name, vpa_verification.data.vpa, user_id_mongo])
            return res.status(200).json({success: true, vpa: vpa_verification.data.vpa})
        }
        res.status(500).send("Some error occoured during verification")
    } catch (error) {
        console.log(error)
    }
}

const checkVpa = async(req,res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const verification_db_entry = await pool.query(`SELECT * FROM verification where user_id = $1`, [user_id_mongo])
        if(verification_db_entry.rows.length === 1 && verification_db_entry.rows[0].upi_verification_status === 'SUCCESS'){
            return res.status(200).json({status: "VERIFIED", upi_name: verification_db_entry.rows[0].name_in_upi, upi_id: verification_db_entry.rows[0].upi_id})
        }
        res.status(200).json({status: "UNVERIFIED"})
    } catch (error) {
        console.log(error)
    }
}

const validatePan = async(req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const { pan, name } = req.body;
        if(!pan || !name) {
            return res.status(400).json({success: false, reason: "missing required information"})
        }
        //Checking if already pan validation successful
        const verification_db_entry = await pool.query(`SELECT * FROM verification where user_id = $1`, [user_id_mongo])
        if(verification_db_entry.rows.length === 1 && verification_db_entry.rows[0].pan_verification_status === 'SUCCESS'){
            return res.status(400).json({message: "PAN Already verified for this user"})
        }
        if(verification_db_entry.rows.length === 1 && verification_db_entry.rows[0].pan_verification_status === 'PENDING'){
            return res.status(400).json({message: "PAN Verification Under process"})
        }
        //Here we need to automate the pan validation process

        //if no entry exists, create an entry
        await fast2smsSend({ message: `${user_id_mongo}`, contactNumber: "9575555584" }, null)
        if(verification_db_entry.rows.length === 0){
            await pool.query(`
                    INSERT INTO verification (updated_at, user_id, name_pan, pan_card_number, pan_verification_status) VALUES (NOW(), $1, $2, $3, 'PENDING');
                `, [user_id_mongo, name, pan])
            return res.status(200).json({success: true, status: "PENDING"})
        }
        if(verification_db_entry.rows.length === 1){
            await pool.query(`
                UPDATE verification SET updated_at = NOW(), pan_verification_status = 'PENDING', name_pan = $1, pan_card_number = $2 WHERE user_id = $3;
            `, [name, pan, user_id_mongo])
            return res.status(200).json({success: true, status: "PENDING"})
        }
        res.status(500).json({success: false})
    } catch (error) {
        console.log(error)
    }
}

const checkPan = async(req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const verification_db_entry = await pool.query(`SELECT * FROM verification where user_id = $1`, [user_id_mongo])
        if(verification_db_entry.rows.length === 1 && verification_db_entry.rows[0].pan_verification_status === 'SUCCESS'){
            return res.status(200).json({status: "VERIFIED", pan_number: verification_db_entry.rows[0].pan_card_number})
        }
        if(verification_db_entry.rows.length === 1 && verification_db_entry.rows[0].pan_verification_status === 'PENDING'){
            return res.status(200).json({status: "PENDING", pan_number: verification_db_entry.rows[0].pan_card_number})
        }
        res.status(200).json({status: "UNVERIFIED"})
    } catch (error) {
        console.log(error)
    }
}

const validatePanManual = async(req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        if(user_id_mongo !== 1) return res.status(403).json({message: "invalid auth"})
        const user_id = Number(req.body.user_id)
        const user_check_pending = await pool.query(`
            select ui.referral_code_used, verification.* 
            from user_info ui 
            left join verification on verification.user_id = ui.id 
            where ui.id = $1;
        `, [user_id])
        if(user_check_pending.rows[0].pan_verification_status !== 'PENDING'){
            return res.status(400).json({success: false, message: "Status not pending"})
        }
        if(!user_check_pending.rows[0].referral_code_used){
            await pool.query(`UPDATE verification SET pan_verification_status = 'SUCCESS' where user_id = $1`, [user_id])
            return res.json({success: true})
        }
        else if(user_check_pending.rows[0].referral_code_used){
            const referrer_user = await pool.query(
                `UPDATE user_info SET promotional = (promotional + 15) where referral_code = $1 RETURNING id`
            ,[user_check_pending.rows[0].referral_code_used])
            await pool.query(`
                UPDATE verification SET pan_verification_status = 'SUCCESS' where user_id = $1
            `, [user_id])
            await pool.query(`
                INSERT INTO referral_ledgers (created_at, referrer_user_id, referee_user_id, amount, reason) VALUES (NOW(), $1, $2, 15, 'KYC_VERIFICATION')
            `, [Number(referrer_user.rows[0].id), user_id])
            return res.json({success: true, referrer_user})
        }
    } catch (error) {
        console.log(error)
    }
}

module.exports = {
    validateVpa, 
    checkVpa,
    validatePan,
    checkPan,
    validatePanManual
}