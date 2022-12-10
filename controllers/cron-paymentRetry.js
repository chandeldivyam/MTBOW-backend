require("dotenv").config();
const cron = require("node-cron");
const pool = require("../db/postgreDb");
const axios = require("axios");
const { signRequest } = require("./common/helper");

cron.schedule("* * * * *", async () => {
    try {
	console.log("In the cron");
        const payment_ids = await pool.query(
            `select user_id, transaction_id, created_at, recharge_status from recharge_request where recharge_status in ('ACTIVE', 'PAYMENT_PENDING')
            and created_at >= now() - interval '15' minute
            and created_at <= now() - interval '3' minute
            `
        );
        for (let row_data of payment_ids.rows) {
            const x_verify =
                signRequest(
                    `/pg/v1/status/PGTESTPAYUAT/${row_data.transaction_id}` +
                        process.env.PHONEPE_UAT_KEY
                ) +
                "###" +
                process.env.PHONEPE_UAT_KEYINDEX;
            const phonepe_response = await axios.get(
                `https://api.phonepe.com/apis/hermes/pg/v1/status/PGTESTPAYUAT/${row_data.transaction_id}`,
                {
                    headers: {
                        "Content-Type": "application/json",
                        "X-MERCHANT-ID": "PGTESTPAYUAT",
                        "X-VERIFY": x_verify,
                        accept: "application/json",
                    },
                }
            );
            if (phonepe_response.data.code === "PAYMENT_PENDING") {
                await pool.query(
                    `UPDATE recharge_request set recharge_status = $1 where user_id = $2 and transaction_id = $3`,
                    [
                        "PAYMENT_PENDING",
                        row_data.user_id,
                        row_data.transaction_id,
                    ]
                );
                continue;
            }
            if (phonepe_response.data.code === "PAYMENT_SUCCESS") {
                await pool.query(
                    `
        UPDATE recharge_request set recharge_status = 'PAYMENT_SUCCESS' where user_id = $1 and transaction_id = $2
    `,
                    [row_data.user_id, row_data.transaction_id]
                );

                await pool.query(
                    `
        UPDATE user_info set topup = (topup + $1) where id = $2
    `,
                    [phonepe_response.data.data.amount / 100, row_data.user_id]
                );
                continue;
            }
            if (phonepe_response.data.code) {
                await pool.query(
                    `UPDATE recharge_request set recharge_status = $1 where user_id = $2 and transaction_id = $3`,
                    [
                        phonepe_response.data.code,
                        row_data.user_id,
                        row_data.transaction_id,
                    ]
                );
            }
        }
    } catch (error) {
        console.log(error);
    }
});
