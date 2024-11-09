const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;
app.use(express.json());

const CLIENT_ID = process.env.CONSUMER_KEY;
const CLIENT_SECRET = process.env.CONSUMER_SECRET;
const REDIRECT_URI = 'http://127.0.0.1:3000/callback';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

/**
 * Step 2: Exchange authorization code for access token
 */
async function getAccessToken(code, codeVerifier) {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    };

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier
    });

    try {
        const response = await axios.post(TOKEN_URL, body.toString(), { headers }); // Use axios to send POST request
        console.log('code verifier:', codeVerifier);
        return response.data; // Return the data from the response
    } catch (error) {
        console.error('Error fetching access token:', error.response ? error.response.data : error.message);
        throw error; // Re-throw error for handling in the callback
    }
}

/**
 * Function to fetch and upload media from a URL to Twitter
 */
async function uploadMediaFromUrl(accessToken, mediaUrl) {
    const url = 'https://upload.twitter.com/1.1/media/upload.json';

    try {
        // Fetch media data from the URL
        const mediaResponse = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        const mediaData = Buffer.from(mediaResponse.data, 'binary').toString('base64');

        // Upload the media to Twitter
        const uploadResponse = await axios.post(url, new URLSearchParams({
            media_data: mediaData
        }), {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        return uploadResponse.data.media_id_string;
    } catch (error) {
        console.error('Error uploading media:', error.response ? error.response.data : error.message);
        throw error;
    }
}



app.get('/callback', async (req, res) => {
    console.log('Callback received:', req.query); // This will show the query parameters
    const authorizationCode = req.query.code;
    const error = req.query.error;
    const codeVerifier = 'challenge'; // Ensure you have this value available
    
    if (error) {
        console.error('Error in callback:', error);
        res.send('Error: ' + error);
        return;
    }

    if (authorizationCode) {
        console.log('Authorization Code:', authorizationCode);
        
        // Call getAccessToken to exchange authorization code for access token
        try {
            const tokenResponse = await getAccessToken(authorizationCode, codeVerifier);
            console.log('Access Token Response:', tokenResponse);

            if (tokenResponse.access_token) {
                res.send(`Authorization successful! Access Token: ${tokenResponse.access_token}`);
            } else {
                res.send('Failed to retrieve access token: ' + JSON.stringify(tokenResponse));
            }
        } catch (error) {
            console.error('Error getting access token:', error);
            res.send('Error retrieving access token. Please try again.');
        }
    } else {
        console.error('Authorization code not found:', req.query);
        res.send('Authorization code not found. Please try again.');
    }
});


/**
 * Function to post a tweet with optional media
 */
async function writeTweet(accessToken, tweet, mediaId = null) {
    const url = 'https://api.twitter.com/2/tweets';
    const body = {
        text: tweet,
        ...(mediaId && { media: { media_ids: [mediaId] } })
    };

    try {
        const response = await axios.post(url, body, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        return response.data;
    } catch (error) {
        console.error('Error posting tweet:', error.response ? error.response.data : error.message);
        throw error;
    }
}

/**
 * Endpoint to post a tweet with text and optional media URL
 */
app.post("/post/tweet", async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(400).json({ error: 'Authorization header is missing.' });
    }

    const access_token = authHeader.split(' ')[1];
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is missing in Authorization header.' });
    }

    const { text, mediaUrl } = req.body;

    try {
        let mediaId = null;

        // If a media URL is provided, upload the media from the URL
        if (mediaUrl) {
            mediaId = await uploadMediaFromUrl(access_token, mediaUrl);
            console.log('Media uploaded with ID:', mediaId);
        }

        // Post the tweet with or without media
        const tweetResponse = await writeTweet(access_token, text, mediaId);
        console.log('Tweet response:', tweetResponse);

        res.json({ message: "Tweet sent successfully.", tweetResponse });
    } catch (error) {
        console.error('Error posting tweet:', error);
        res.status(500).json({ error: 'Error posting tweet. Please try again.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://127.0.0.1:${port}`);
});
