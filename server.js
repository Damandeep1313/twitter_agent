const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000;
app.use(express.json());

// Hardcoded values for Twitter API credentials and callback URL
const CLIENT_ID = 'b2IxOC1EOWQzVnk1cmVKVlRvT1A6MTpjaQ';
const CLIENT_SECRET = '5rlNun5FLNgh8N5mxWUAYVlNDXXfJDVQ6m5x3bzwg2z1f7pmnv';
const ACCESS_TOKEN = '1850263893421211648-zzCwgup9ko4fYPPfvapcl80OpNdbKr';
const ACCESS_TOKEN_SECRET = 'JntQIa9BkMUEsucAOZT1f7igKdd7q8C5WIwgmaYYp2LjH';
const REDIRECT_URI = 'https://serverless.on-demand.io/apps/tweet/callback'; // Updated redirect URI
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

/**
 * Step 2: Exchange authorization code for access token
 */
async function getAccessToken(code, codeVerifier) {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    };
    console.log('Code verifier:', codeVerifier);

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier
    });

    try {
        const response = await axios.post(TOKEN_URL, body.toString(), { headers });
        console.log('Access Token Response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error fetching access token:', error.response ? error.response.data : error.message);
        throw error;
    }
}

app.get('/callback', async (req, res) => {
    console.log('Callback received:', req.query);
    const authorizationCode = req.query.code;
    const error = req.query.error;
    const codeVerifier = 'challenge';
    
    if (error) {
        console.error('Error in callback:', error);
        res.send('Error: ' + error);
        return;
    }

    if (authorizationCode) {
        console.log('Authorization Code:', authorizationCode);
        
        try {
            const tokenResponse = await getAccessToken(authorizationCode, codeVerifier);
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

async function writeTweet(accessToken, tweet) {
    const url = 'https://api.twitter.com/2/tweets';

    try {
        const response = await axios.post(url, { text: tweet }, {
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

app.post("/post/tweet", async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(400).json({ error: 'Authorization header is missing.' });
    }

    const access_token = authHeader.split(' ')[1];
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is missing in Authorization header.' });
    }

    const { text } = req.body;

    try {
        const tweetResponse = await writeTweet(access_token, text);
        console.log('Tweet response:', tweetResponse);
        res.json({ message: "Tweet sent successfully." });
    } catch (error) {
        res.status(500).json({ error: 'Error posting tweet. Please try again.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://127.0.0.1:${port}`);
});
