const express = require('express');
const axios = require('axios'); // Import axios instead of node-fetch
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 3000;
app.use(express.json());

const CLIENT_ID = process.env.CONSUMER_KEY; // Your Twitter API Client ID
const CLIENT_SECRET = process.env.CONSUMER_SECRET; // Your Twitter API Client Secret
const REDIRECT_URI = 'https://serverless.on-demand.io/apps/tweet/callback'; // Your callback URL
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

/**
 * Step 2: Exchange authorization code for access token
 */
async function getAccessToken(code, codeVerifier) {
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
    };
    console.log('code verifier:', codeVerifier);

    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: REDIRECT_URI,
        code_verifier: codeVerifier // Ensure you pass the code verifier here
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

async function writeTweet(accessToken, tweet) {
    const url = 'https://api.twitter.com/2/tweets';

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: tweet })
    });

    const data = await response.json();
    return data;
}

app.post("/post/tweet", async (req, res) => {
    console.log(req.body, "line 80");

    // Extract the access token from the Authorization header
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(400).json({ error: 'Authorization header is missing.' });
    }

    // The token comes after "Bearer " in the Authorization header
    const access_token = authHeader.split(' ')[1];
    if (!access_token) {
        return res.status(400).json({ error: 'Access token is missing in Authorization header.' });
    }

    // Get the tweet text from the request body
    const { text } = req.body;

    try {
        // Call the function to post the tweet
        const tweetResponse = await writeTweet(access_token, text);
        console.log('Tweet response:', tweetResponse);

        res.json({ message: "Tweet sent successfully." });
    } catch (error) {
        console.error('Error posting tweet:', error);
        res.status(500).json({ error: 'Error posting tweet. Please try again.' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://127.0.0.1:${port}`);
});
