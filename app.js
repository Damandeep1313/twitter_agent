// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000;

// Environment variables (use your OAuth2 credentials, not OAuth1)
const CLIENT_ID = process.env.CLIENT_ID;       // Twitter OAuth2 Client ID
const CLIENT_SECRET = process.env.CLIENT_SECRET;  // Twitter OAuth2 Client Secret
const REDIRECT_URI = process.env.REDIRECT_URI;    // "http://127.0.0.1:3000/callback"
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

app.use(express.json());

/**
 * Exchange authorization code for access token
 */
async function getAccessToken(code, codeVerifier) {
  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Authorization': 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  };

  // Build URL-encoded body
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier
  });

  try {
    // Use axios to send the POST request
    const response = await axios.post(TOKEN_URL, params.toString(), { headers });
    return response.data; 
  } catch (error) {
    console.error('Error fetching access token:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Write a Tweet using the v2 endpoint
 */
async function writeTweet(accessToken, tweetText) {
  const url = 'https://api.twitter.com/2/tweets';

  try {
    const response = await axios.post(
      url,
      { text: tweetText },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error posting tweet:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Callback route: Twitter redirects here with ?code=...
 * We exchange the code for an access token
 */
app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  // Hard-coded codeVerifier for demo; in production, store/generate PKCE properly.
  const codeVerifier = 'challenge';

  if (error) {
    console.error('Error in callback:', error);
    return res.status(400).send('Error: ' + error);
  }

  if (!code) {
    console.error('Authorization code not found in the query:', req.query);
    return res.status(400).send('Authorization code missing.');
  }

  try {
    // Exchange the authorization code for an access token
    const tokenResponse = await getAccessToken(code, codeVerifier);
    console.log('Access Token Response:', tokenResponse);

    if (tokenResponse.access_token) {
      const bearerToken = `Bearer ${tokenResponse.access_token}`;
      return res.send(
        `Authorization successful!<br>Access Token: ${bearerToken}<br>
         Refresh Token: ${tokenResponse.refresh_token || 'no refresh token'}<br><br>
         Now you can use this token to call /post/tweet.`
      );
    } else {
      return res.status(400).send('Failed to retrieve access token: ' + JSON.stringify(tokenResponse));
    }
  } catch (error) {
    console.error('Error getting access token:', error);
    return res.status(500).send('Error retrieving access token. Please try again.');
  }
});

/**
 * POST /post/tweet
 * Body: { "text": "..." }
 * Header: Authorization: Bearer <token>
 */
app.post('/post/tweet', async (req, res) => {
  console.log('/post/tweet - request body:', req.body);

  // Extract the access token from the Authorization header
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(400).json({ error: 'Authorization header is missing.' });
  }

  // The token is after "Bearer "
  const accessToken = authHeader.split(' ')[1];
  if (!accessToken) {
    return res.status(400).json({ error: 'Access token is missing in Authorization header.' });
  }

  // The tweet text from request body
  const { text } = req.body;

  try {
    // Post the tweet
    const tweetResponse = await writeTweet(accessToken, text);
    console.log('Tweet response:', tweetResponse);

    return res.json({ message: 'Tweet sent successfully.', tweetResponse });
  } catch (error) {
    console.error('Error posting tweet:', error);
    return res.status(500).json({ error: 'Error posting tweet. Please try again.' });
  }
});

/**
 * Start the server
 */
app.listen(port, () => {
  console.log(`Server is running on http://127.0.0.1:${port}`);
});
