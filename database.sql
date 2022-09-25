CREATE DATABASE fantasy;
SET TIMEZONE 'Asia/Kolkata';

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
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    views BIGINT,
    comments BIGINT,
    likes BIGINT,
    subscribers BIGINT,
    total_videos INT
);

CREATE TABLE user_info(
    id SERIAL PRIMARY KEY,
    name VARCHAR(55),
    phone VARCHAR(55),
    promotional float,
    topup float,
    winnings float,
);

CREATE TABLE contests(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    event_start_time TIMESTAMP NOT NULL,
    event_end_time TIMESTAMP NOT NULL,
    participation_fee INT,
    is_expired BOOLEAN,
    image_url VARCHAR(255),
    all_creators varchar(255) ARRAY
);

CREATE TABLE teams(
    id SERIAL PRIMARY KEY,
    user_id INT,
    contest_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    team varchar(255) ARRAY,
    reward INT
);

CREATE TABLE creator_points(
    id SERIAL PRIMARY KEY,
    browser_id varchar(255),
    contest_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    score INT
);