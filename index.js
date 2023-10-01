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
const FileReader = require('filereader')


const https = require('https')
const { execSync: exec } = require('child_process')
const { Deepgram } = require('@deepgram/sdk')
const ffmpegStatic = require('ffmpeg-static')

const { v4: uuidv4 } = require('uuid');

const QUEUE_NAME = 'video_queue';
const VIDEO_DIRECTORY = './public';
const homeURL = 'http://localhost:3000';
let transcript;
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json({ limit: "5000MB", type: 'application/json' }));

const deepgram = new Deepgram('e5ba51d26294551581d2bb227f84dab8f6c241d8')
var receivedBlobs = [];

async function sendData(data) {
    // send data to queue
    await channel.sendToQueue("video_queue", Buffer.from(data));
}

function sendBlobAsBase64(blob) {
    const bufferData = Buffer.from(blob, 'utf-8'); // Replace with your buffer data
    // Convert the buffer to a Base64-encoded string
    const base64Encoded = bufferData.toString('base64');
    console.log('Base64 Encoded:', base64Encoded);
    const BufferData = Buffer.from(base64Encoded, 'base64');
    const fileStream = fs.createWriteStream(`./public/blob${uuidv4()}.mp4`, { flags: 'a' });
    console.log("buffer is", BufferData);
    console.log("type of base 64 is", typeof base64Encoded);
    fileStream.write(BufferData);
    fileStream.end();
};

const writeTranscript = (transcript, id) => {
    fs.writeFile(`./public/${id}.txt`, transcript, (err) => {
        if (err) {
            console.log(err);
        }
        console.log("Successfully Written to File.");
    })
}

function sendBlobtoFile(blob) {
    const BufferData = Buffer.from(blob, 'base64');
    const fileStream = fs.createWriteStream(`./public/blob${uuidv4()}.mp4`, { flags: 'a' });
    fileStream.write(BufferData);
    fileStream.end();
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

async function connectQueue() {
    try {
        connection = await amqp.connect("amqp://localhost:5672");
        channel = await connection.createChannel()
        await channel.assertQueue("video_queue")
        channel.consume(QUEUE_NAME, async (message) => {
            if (message !== null) {
                let content = JSON.parse(message.content.toString());
                let id = content.id;
                let filePath = content.filePath;
                console.log('Received message:', content.url);
                transcript = await transcribeLocalVideo(filePath);
                console.log(transcript);
                writeTranscript(transcript, id);
                // Acknowledge the message once processed
                channel.ack(message);
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
    // receivedChunks.length = 0; // Clear the array to start fresh
    const id = uuidv4();
    return res.status(200).send(id);
});

// Endpoint to continuously receive blobs
app.post('/receiveChunk/:id', (req, res) => {
    // Check the content type to ensure it's a binary blob
    console.log(req.body);
    const media = req.body.data;
    try {
        const id = req.params.id;
        const BufferData = Buffer.from(media, 'base64');
        const fileStream = fs.createWriteStream(`./public/${id}.mp4`, { flags: 'a' });
        console.log('before', BufferData)
        fileStream.write(BufferData);
        console.log('after', BufferData)
        // BufferData = Buffer.from(media, 'base64');
        fileStream.write(BufferData);
        fileStream.end();
        return res.json({ gotit: true });
    } catch (error) {
        console.log(error);
        return res.json({ gotit: false });
    }
});

// Endpoint to aggregate the blobs when done
app.get('/final/:id', (req, res) => {
    // Convert blob back to file
    const id = req.params.id;
    const videoURL = `${homeURL}/${id}.mp4`;
    let trans = {
        filePath: `${VIDEO_DIRECTORY}/${id}.mp4`,
        id: id
    };
    trans = JSON.stringify(trans)
    sendData(trans);
    return res.send(videoURL);
});


app.get('/transcript/:id', (req, res) => {
    const id = req.params.id;
    try {
        const transcript = fs.readFileSync(`./public/${id}.txt`, 'utf8');
        res.send(transcript);
    } catch (error) {
        return res.status(404).send('Transcript not found');
    }
});

app.get("/send", (req, res) => {

    // data to be sent
    let data = {
        title: "Six of Crows",
        author: "Leigh Burdugo"
    }
    data = JSON.stringify(data);
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

app.post("/makeChunk", upload.single('media'), (req, res) => {
    console.log(req.file.buffer);
    const chunk = req.file.buffer;
    sendBlobAsBase64(chunk);
    return res.send('madeChunk');
})

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});