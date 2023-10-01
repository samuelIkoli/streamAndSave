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
const bodyParser = require('body-parser');

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
app.use(bodyParser.raw({ type: '*/*' }));

const deepgram = new Deepgram('e5ba51d26294551581d2bb227f84dab8f6c241d8')
var receivedBlobs = [];

async function sendData(data) {
    // send data to queue
    await channel.sendToQueue("test-queue", Buffer.from(JSON.stringify(data)));
}

async function ffmpeg(command) {
    return new Promise((resolve, reject) => {
        exec(`${ffmpegStatic} ${command}`, (err, stderr, stdout) => {
            if (err) reject(err)
            resolve(stdout)
        })
    })
};
async function writeToDisk(nameOfFile, blob) {
    fs.writeFileSync(`${nameOfFile}`, blob);
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

// transcribeLocalVideo(videoURL).then((transcript) =>
//                         console.dir(transcript, { depth: null })
//                     )

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

// async function enQueue (req, res) {

//     // data to be sent
//     const data = {
//         title: "Six of Crows",
//         author: "Leigh Burdugo"
//     }
//     sendData(data);  // pass the data to the function we defined
//     console.log("A message is sent to queue")
//     res.send("Message Sent"); //response to the API request
// }

app.post('/startReceiving', (req, res) => {
    receivedBlobs.length = 0; // Clear the array to start fresh
    res.sendStatus(200);
});

// Endpoint to continuously receive blobs
app.post('/receiveBlob', (req, res) => {
    // Check the content type to ensure it's a binary blob
    if (req.is('application/octet-stream')) {
        // Push the received blob to the array
        receivedBlobs.push(req.body);
        console.log('Received a blob.');
        res.sendStatus(200);
    } else {
        res.status(400).send('Invalid content type');
    }
});

// Endpoint to aggregate the blobs when done
app.get('/aggregateBlobs', (req, res) => {
    // Process the received blobs (e.g., combine them or save them)
    const integratedBlob = Buffer.concat(receivedBlobs);
    console.log('Integrated all received blobs.');
    console.log('Proceeding to save the blob to disk.');
    // Write the blob to disk
    const fileName = `video_${uuidv4()}.mp4`;
    const reader = new FileReader();

    reader.addEventListener('load', function () {
        // 'reader.result' contains the decoded binary data as an ArrayBuffer
        const binaryData = reader.result;
        writeToDisk(fileName, binaryData);
        console.log('Binary data length:', binaryData.byteLength);
    });

    // Read the Blob as binary data
    reader.readAsArrayBuffer(myBlob);
    res.status(200).send(integratedBlob);
});

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

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});

