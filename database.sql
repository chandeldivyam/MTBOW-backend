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
    topup float,
    referral_code VARCHAR(55),
    referral_code_used VARCHAR(55)
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

CREATE TABLE verification(
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    user_id INT,
    name_pan VARCHAR(255),
    pan_card_number VARCHAR(255),
    pan_verification_status VARCHAR(255),
    name_in_upi VARCHAR(255),
    upi_id VARCHAR(255),
    upi_verification_status VARCHAR(255)
);

CREATE TABLE withdraw_request(
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    user_id INT,
    withdraw_amount INT,
    withdraw_status varchar(255)
);

CREATE TABLE video_contests(
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    event_start_time TIMESTAMPTZ NOT NULL,
    event_end_time TIMESTAMPTZ NOT NULL,
    participation_fee INT,
    is_expired BOOLEAN,
    image_url VARCHAR(255),
    all_video_ids varchar(255) ARRAY,
    prize_pool INT,
    max_participants INT,
    prizepool_array JSONB 
);

CREATE TABLE video_points(
    id SERIAL PRIMARY KEY,
    video_id varchar(255),
    contest_id INT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    channel_title VARCHAR(255),
    video_title VARCHAR(255),
    video_thumbnail VARCHAR(255),
    channel_thumbnail VARCHAR(255),
    score INT,
    extra_details JSONB DEFAULT '{"like_points": 0, "view_points": 0, "comment_points": 0}',
    video_published_at TIMESTAMPTZ
);

CREATE TABLE video_teams(
    id SERIAL PRIMARY KEY,
    user_id INT,
    video_contest_id INT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    video_team varchar(255) ARRAY,
    reward INT,
    first_seen BOOLEAN
);

CREATE TABLE video_stats(
    id SERIAL PRIMARY KEY,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    video_id VARCHAR(255),
    video_views BIGINT,
    video_likes BIGINT,
    video_comments BIGINT
);

CREATE TABLE referral_ledgers(
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    referrer_user_id INT,
    referee_user_id INT,
    amount INT,
    reason VARCHAR(255),
    video_contest_id INT
);

CREATE TABLE scratch_card(
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ, 
    card_type VARCHAR(55),
    user_id INT,
    video_contest_id INT,
    is_seen BOOLEAN,
    amount INT
);