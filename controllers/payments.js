require("dotenv").config();
const pool = require("../db/postgreDb");
const Cashfree = require("cashfree-sdk");
const axios = require("axios");
const nanoId = require("nano-id");
const { query } = require("express");

const generateToken = async (req, res) => {
    try {
        const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
        const { amount } = req.body;
        if (!amount) {
            res.status(400).send("Amount not entered");
        }
        const user_details = await pool.query(
            `select name, phone from user_info where id = $1`,
            [user_id_mongo]
        );
        const { name, phone } = user_details.rows[0];
        const order_id = nanoId(32);
        const user_number_string = user_id_mongo.toString();

        const { data } = await axios({
            method: "POST",
            url: "https://sandbox.cashfree.com/pg/orders",
            data: {
                order_id: order_id,
                order_amount: parseInt(amount),
                order_currency: "INR",
                customer_details: {
                    customer_id: user_number_string,
                    customer_name: name,
                    customer_email: "care@cashfree.com",
                    customer_phone: phone,
                },
            },
            headers: {
                "Content-Type": "application/json",
                "x-api-version": "2022-01-01",
                "x-client-id": process.env.CASHFREE_PAYMENT_TEST_API_KEY,
                "x-client-secret": process.env.CASHFREE_PAYMENT_TEST_SECRET_KEY,
            },
        });
        await pool.query(
            `
            INSERT INTO recharge_request (user_id, order_id, cf_order_id, cf_order_token, order_status, order_amount) VALUES ($1, $2, $3, $4, $5, $6)
        `,
            [
                user_id_mongo,
                data.order_id,
                data.cf_order_id,
                data.order_token,
                "ACTIVE",
                data.order_amount,
            ]
        );
        res.status(200).json({ order_token: data.order_token });
    } catch (error) {
        console.log(error);
        res.status(500).send(error);
    }
};

const rechargeSuccess = async (req, res) => {
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const { order_id } = req.body;
    const current_status = await pool.query(
        `select order_status from recharge_request where user_id = $1 and order_id = $2`,
        [user_id_mongo, order_id]
    );
    const current_order_status = current_status.rows[0].order_status;
    if (current_order_status !== "ACTIVE") {
        return res.status(400).send("Payment Expired or Already processed");
    }
    const { data } = await axios({
        method: "GET",
        url: `https://sandbox.cashfree.com/pg/orders/${order_id}`,
        headers: {
            "Content-Type": "application/json",
            "x-api-version": "2022-01-01",
            "x-client-id": process.env.CASHFREE_PAYMENT_TEST_API_KEY,
            "x-client-secret": process.env.CASHFREE_PAYMENT_TEST_SECRET_KEY,
        },
    });

    if (data.order_status !== "PAID") {
        return res.status(424).send("Payment Failed");
    }
    await pool.query(
        `
        UPDATE recharge_request set order_status = 'PAID' where user_id = $1 and order_id = $2
    `,
        [user_id_mongo, order_id]
    );

    await pool.query(
        `
        UPDATE user_info set topup = (topup + $1) where id = $2
    `,
        [data.order_amount, user_id_mongo]
    );

    res.json({ success: true });
};

const rechargeFailed = async (req, res) => {
    const user_id_mongo = parseInt(req.headers.user.user_id_mongo);
    const { order_id } = req.body;
    pool.query(
        `UPDATE recharge_request set order_status = 'FAILED' where user_id = $1 and order_id = $2`,
        [user_id_mongo, order_id]
    );
    res.json({ payment: "failed" });
};

module.exports = { generateToken, rechargeSuccess, rechargeFailed };
