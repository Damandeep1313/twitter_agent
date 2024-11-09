const express = require('express');
const axios = require('axios');
const dotenv = require('dotenv');
const fs = require('fs');
const request = require('request');
const path = require('path');

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

// Helper function to download an image and save it locally
const download = function (uri, filename, callback) {
    request.head(uri, function (err, res, body) {
        request(uri).pipe(fs.createWriteStream(filename)).on("close", callback);
    });
};

/**
 * Endpoint to tweet an image by downloading it and uploading it to Twitter
 */
app.post('/tweet-image', async (req, res) => {
    const { text, imageUrl } = req.body;
    if (!text || !imageUrl) {
        return res.status(400).send('Text and image URL are required');
    }
    
    const authHeader = req.headers['authorization'];

    if (!authHeader) {
        return res.status(400).json({ error: 'Authorization header is missing.' });
    }

    const accessToken = authHeader.split(' ')[1];
    if (!accessToken) {
        return res.status(400).json({ error: 'Access token is missing in Authorization header.' });
    }

    const filename = 'downloaded_image.png';

    // Download the image from the provided URL
    download(imageUrl, filename, async function () {
        try {
            // Read the image as a Base64 string
            const mediaData = fs.readFileSync(filename, { encoding: 'base64' });

            // Upload the image to Twitter
            const mediaUploadResponse = await axios.post('https://upload.twitter.com/1.1/media/upload.json?media_category=TWEET_IMAGE', 
                new URLSearchParams({
                    media_data: mediaData
                }), 
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                }
            );

            const mediaId = mediaUploadResponse.data.media_id_string;

            // Post a tweet with the uploaded media
            const tweetResponse = await axios.post('https://api.twitter.com/2/tweets', 
                {
                    status: text,
                    media: {
                        media_ids: [mediaId]
                    }
                }, 
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            res.json({ message: 'Tweet sent successfully.', tweetResponse: tweetResponse.data });
        } catch (error) {
            console.error('Error posting tweet:', error);
            res.status(500).json({ error: 'Error posting tweet. Please try again.' });
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://127.0.0.1:${port}`);
});
