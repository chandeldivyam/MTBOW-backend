CREATE DATABASE fantasy;
SET TIMEZONE TO 'Asia/Kolkata';

CREATE TABLE creators(
    id SERIAL PRIMARY KEY,
    channel_name VARCHAR(255),
    channel_image VARCHAR(255),
    channel_url VARCHAR(255),
    browser_id VARCHAR(255)
);

CREATE TABLE creator_stats(
    id SERIAL PRIMARY KEY, 
    browser_id VARCHAR(255),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    views BIGINT,
    comments BIGINT,
    likes BIGINT,
    subscribers BIGINT,
    total_videos INT
);

CREATE TABLE user_info(
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    name VARCHAR(55),
    phone VARCHAR(55),
    promotional float,
    winnings float,
    topup float
);

CREATE TABLE contests(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    event_start_time TIMESTAMPTZ NOT NULL,
    event_end_time TIMESTAMPTZ NOT NULL,
    participation_fee INT,
    is_expired BOOLEAN,
    image_url VARCHAR(255),
    all_creators varchar(255) ARRAY
);

CREATE TABLE teams(
    id SERIAL PRIMARY KEY,
    user_id INT,
    contest_id INT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    team varchar(255) ARRAY,
    reward INT
);

CREATE TABLE creator_points(
    id SERIAL PRIMARY KEY,
    browser_id varchar(255),
    contest_id INT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    score INT
);

CREATE TABLE recharge_request(
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    user_id INT,
    transaction_id VARCHAR(255),
    verification_code varchar(255),
    recharge_amount INT,
    recharge_status varchar(255)
);