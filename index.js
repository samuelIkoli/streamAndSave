const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const dotenv = require('dotenv').config();
const path = require('path');

const amqp = require('amqplib');
const fs = require('fs');
const multer = require('multer');
const storage = multer.memoryStorage()
const upload = multer({ storage })

const https = require('https')
const { execSync: exec } = require('child_process')
const { Deepgram } = require('@deepgram/sdk')
const ffmpegStatic = require('ffmpeg-static')

const { v4: uuidv4 } = require('uuid');

const QUEUE_NAME = 'video_queue';
const VIDEO_DIRECTORY = './public';
const homeURL = 'http://localhost:3000';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const deepgram = new Deepgram('e5ba51d26294551581d2bb227f84dab8f6c241d8')

async function sendData(data) {
    // send data to queue
    await channel.sendToQueue("test-queue", Buffer.from(JSON.stringify(data)));
}

async function sendVideoAsBlob(media) {
    try {
        await channel.assertQueue(QUEUE_NAME);

        channel.sendToQueue('video_queue', media);

        console.log('Video sent successfully.');

    } catch (error) {
        console.error('Error:', error);
    }
}

const writeVideo = async (videoData) => {
    try {
        // Generate a unique filename for the video
        const fileName = `video_${uuidv4()}.mp4`;
        const filePath = `${VIDEO_DIRECTORY}/${fileName}`;
        const videoURL = `${homeURL}/${fileName}`;
        console.log('Video path:', filePath)
        // Create a write stream to save the video
        const fileStream = fs.createWriteStream(filePath);

        // Write the video data to the file
        fileStream.write(videoData);
        fileStream.end();

        console.log('Video saved to:', filePath);
    } catch (error) {
        console.error('Error:', error);
    }
};

async function ffmpeg(command) {
    return new Promise((resolve, reject) => {
        exec(`${ffmpegStatic} ${command}`, (err, stderr, stdout) => {
            if (err) reject(err)
            resolve(stdout)
        })
    })
};

async function transcribeLocalVideo(filePath) {
    ffmpeg(`-hide_banner -y -i ${filePath} ${filePath}.wav`)

    const audioFile = {
        buffer: fs.readFileSync(`${filePath}.wav`),
        mimetype: 'audio/wav',
    }
    const response = await deepgram.transcription.preRecorded(audioFile, {
        punctuation: true,
    })
    return response.results.channels[0].alternatives[0].transcript
}

transcribeLocalVideo('./public/video_47aa63e0-d8d3-43e9-896f-df7ab68b44b1.mp4').then((transcript) =>
    console.dir(transcript, { depth: null })
)
// Start the RabbitMQ consumer
// startRabbitMQConsumer();

///////////////////////////////////////////////////////////////////////////////////////////////////

async function connectQueue() {
    try {
        connection = await amqp.connect("amqp://localhost:5672");
        channel = await connection.createChannel()

        await channel.assertQueue("video_queue")
        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg) {
                try {
                    // Generate a unique filename for the video
                    const fileName = `video_${uuidv4()}.mp4`;
                    const filePath = `${VIDEO_DIRECTORY}/${fileName}`;
                    const videoURL = `${homeURL}/${fileName}`;
                    console.log('Video path:', filePath)
                    // Create a write stream to save the video
                    const fileStream = fs.createWriteStream(filePath);

                    // Write the video data to the file
                    fileStream.write(msg.content);
                    fileStream.end();

                    console.log('Video saved to:', videoURL);

                    // Acknowledge the message
                    channel.ack(msg);
                } catch (error) {
                    console.error('Error:', error);
                    // Reject the message on error
                    channel.reject(msg, false);
                }
            }
        });
    } catch (error) {
        console.log(error)
    }
}

connectQueue();


app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get("/send", (req, res) => {

    // data to be sent
    const data = {
        title: "Six of Crows",
        author: "Leigh Burdugo"
    }
    sendData(data);  // pass the data to the function we defined
    console.log("A message is sent to queue")
    res.send("Message Sent"); //response to the API request
})

app.post("/sendVideo", upload.single('media'), (req, res) => {
    console.log(req.file)
    const media = req.file.buffer
    sendVideoAsBlob(media);  // pass the data to the function we defined
    console.log("A video is sent to queue")
    res.send("Video Sent"); //response to the API request
})

app.post('/receiveBlobs', (req, res) => {
    const { sequenceNumber, totalBlobs, blobData } = req.body;

    if (!sequenceNumber || !totalBlobs || !blobData) {
        return res.status(400).json({ message: 'Invalid Blob data' });
    }

    receivedBlobs[sequenceNumber] = blobData;

    // Check if all Blobs have been received
    if (receivedBlobs.length === totalBlobs) {
        console.log('All Blobs received. Aggregating...');

        // Aggregate all received Blobs
        const aggregatedBlob = Buffer.concat(receivedBlobs);

        // Save the aggregated Blob to a file
        fs.writeFile('aggregatedFile.mp4', aggregatedBlob, (err) => {
            if (err) {
                console.error('Error saving aggregated file:', err);
                res.status(500).json({ message: 'Error saving aggregated file' });
            } else {
                console.log('Aggregated file saved successfully.');
                res.status(200).json({ message: 'Aggregated file saved successfully' });
            }
        });
    } else {
        res.status(200).json({ message: 'Blob received' });
    }
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});

