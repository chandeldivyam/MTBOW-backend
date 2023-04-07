const { realEscapeString, randomisePoolArray, distributeWinnings } = require("../common/helper");
const pool = require("../../db/postgreDb");
const referralCodeGenerator = require("referral-code-generator")

function sortAndRemoveDuplicates(names) {
  const uniqueNames = [...new Set(names)];
  uniqueNames.sort();
  return uniqueNames;
}

const createBot = async () => {
    const users = [];
    
    let indianNames = [
        "Aarav Patel",
        "Advait Kumar",
        "Aishwarya Singh",
        "Akash Gupta",
        "Ananya Iyer",
        "Arjun Chakraborty",
        "Aryan Sharma",
        "Avni Desai",
        "Chirag Shah",
        "Devanshi Mehta",
        "Dhruv Joshi",
        "Gauri Nair",
        "Harshini Patel",
        "Ishaan Malhotra",
        "Jhanvi Patel",
        "Kavya Menon",
        "Krishna Nair",
        "Manav Gupta",
        "Mira Shah",
        "Mohit Kumar",
        "Neha Desai",
        "Nikita Shah",
        "Pooja Singh",
        "Pranav Menon",
        "Priya Nair",
        "Rahul Chakraborty",
        "Rhea Patel",
        "Ria Singh",
        "Riya Patel",
        "Rohan Shah",
        "Rohan Srinivasan",
        "Roshni Patel",
        "Sahil Chakraborty",
        "Samarth Gupta",
        "Sana Sharma",
        "Sarika Iyer",
        "Sarthak Menon",
        "Shanaya Nair",
        "Shivangi Patel",
        "Shruti Singh",
        "Shubham Gupta",
        "Siddharth Iyer",
        "Siya Desai",
        "Sneha Patel",
        "Soham Chakraborty",
        "Srishti Menon",
        "Tanvi Shah",
        "Trisha Patel",
        "Urvashi Desai",
        "Vaishnavi Nair",
        "Varun Patel",
        "Vidhi Singh",
        "Vikram Malhotra",
        "Yash Gupta",
        "Yashvi Patel",
        "Zara Shah",
        "Aanya Gupta",
        "Aarav Desai",
        "Aditi Menon",
        "Advait Iyer",
        "Akash Singh",
        "Aman Chakraborty",
        "Ananya Patel",
        "Anika Shah",
        "Arnav Nair",
        "Arushi Sharma",
        "Avi Gupta",
        "Avni Mehta",
        "Chaitanya Patel",
        "Deepti Singh",
        "Devika Chakraborty",
        "Dhruv Nair",
        "Divya Iyer",
        "Gaurav Desai",
        "Harini Menon",
        "Ishaan Chakraborty",
        "Ishika Gupta",
        "Jai Singh",
        "Janvi Shah",
        "Kavya Patel",
        "Khushi Menon",
        "Krish Gupta",
        "Lakshmi Nair",
        "Manasvi Desai",
        "Manya Shah",
        "Maya Singh",
        "Meera Chakraborty",
        "Megha Iyer",
        "Mihir Patel",
        "Nakul Gupta",
        "Navya Nair",
        "Nehal Menon",
        "Nidhi Sharma",
        "Nikhil Desai",
        "Nikita Singh",
        "Pooja Chakraborty",
        "Pranav Nair",
        "Priya Patel",
        "Raghav Shah",
        "Rahul Menon",
        "Raj Singh",
        "Rhea Gupta",
        "Riddhi Iyer",
        "Riya Desai",
        "Rohan Chakraborty",
        "Roshni Menon",
        "Sahana Nair",
        "Sakshi Patel",
        "Samaira Singh",
        "Samarth Shah",
        "Sanaya Gupta",
        "Sanskriti Chakraborty",
        "Sarayu Iyer",
        "Sarthak Patel",
        "Saurav Desai",
        "Shalini Menon",
        "Shanaya Shah",
        "Shanvi Gupta",
        "Shiv Patel",
        "Shreya Singh",
        "Shriya Chakraborty",
        "Shubh Gupta",
        "Siddharth Nair",
        "Simran Patel",
        "Sneha Menon",
        "Soham Iyer",
        "Sonal Desai",
        "Srishti Shah",
        "Tanish Gupta",
        "Tara Singh",
        "Tisha Patel",
        "Tushar Nair",
        "Urvi Chakraborty",
        "Vedant Menon",
        "Vidhi Gupta",
        "Vidya Shah",
        "Vijay Iyer",
        "Vikrant Patel",
        "Yashika Nair",
        "Yuvraj Desai",
        "Zara Singh"
    ];
    indianNames = sortAndRemoveDuplicates(indianNames)
    for (let i = 0; i < 100; i++) {
    const name = indianNames[i];
    users.push({ name });
    }
    let referral_code, referral_unique
    for(user of users){
        while(true){
            referral_code = referralCodeGenerator.alphaNumeric('uppercase', 3, 1)
            referral_unique = await pool.query(`SELECT * FROM user_info where referral_code = $1`, [referral_code])
            if(referral_unique.rowCount === 0) break
        }
        const newUser = await pool.query(
            `INSERT INTO user_info (name, phone, promotional, winnings, topup, referral_code) VALUES ($1, $2, $3, $4, $5, $6)`,
            [user.name, '', 0, 0, 0, referral_code]
        );
        console.log(`Completed for : ${user.name}`)
    }
}

createBot()