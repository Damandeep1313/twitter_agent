import 'dotenv/config';
import fetch from 'node-fetch';
import { createInterface } from 'readline';

const readline = createInterface({
    input: process.stdin,
    output: process.stdout
});

const CLIENT_ID = process.env.CONSUMER_KEY; // Your Twitter API Client ID
const CLIENT_SECRET = process.env.CONSUMER_SECRET; // Your Twitter API Client Secret
const REDIRECT_URI = 'https://serverless.on-demand.io/apps/tweet/callback'; // Your callback URL
const AUTHORIZATION_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const SCOPES = 'tweet.read users.read follows.read follows.write tweet.write'; // Updated scopes

/**
 * Function to get user input from the command line
 */
async function input(prompt) {
    return new Promise((resolve) => {
        readline.question(prompt, (out) => {
            readline.close();
            resolve(out);
        });
    });
}

/**
 * Step 1: Generate the authorization URL and prompt the user to authorize the app
 */
function getAuthorizationUrl() {
    const state = 'state'; // You can generate a more secure random string
    const codeChallenge = 'challenge'; // Placeholder for code challenge (update accordingly)
    const codeVerifier = 'challenge'; // Placeholder for code verifier

    const params = new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'plain'
    });

    const url = `${AUTHORIZATION_URL}?${params.toString()}`;
    console.log('Authorization URL:', url);
    
    return { url, codeVerifier };
}

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

    const response = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: headers,
        body: body
    });

    const data = await response.json();
    console.log(data, 'line 76');
    return data;
}

/**
 * Main function to execute the steps
 */
(async () => {
    try {
        // Step 1: Direct user to authorization URL
        const { url: authorizationUrl, codeVerifier } = getAuthorizationUrl();
        console.log('Please go to this URL and authorize the app:', authorizationUrl);

        // Step 2: Get the authorization code from the user
        const authorizationCode = await input('Paste the authorization code here: ');

        // Step 3: Exchange authorization code for access token
        const tokenResponse = await getAccessToken(authorizationCode.trim(), codeVerifier);

        if (tokenResponse.access_token) {
            console.log('Access token received:', tokenResponse.access_token);
            // The following line has been commented out to prevent posting a tweet.
            const tweetResponse = await writeTweet(tokenResponse.access_token, 'Ho,! This is a test tweet.');
            console.log('Tweet response:', tweetResponse);
        } else {
            console.error('Failed to retrieve access token:', tokenResponse);
        }
    } catch (error) {
        console.error('Error:', error);
    }
})();
