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

const { v4: uuidv4 } = require('uuid');

const QUEUE_NAME = 'video_queue';
const VIDEO_DIRECTORY = './public';
const homeURL = 'http://localhost:3000';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

async function sendData(data) {
    // send data to queue
    await channel.sendToQueue("test-queue", Buffer.from(JSON.stringify(data)));
}

async function sendVideoAsBlob(media) {
    try {
        await channel.assertQueue(QUEUE_NAME);

        // const videoFilePath = media;
        //   const videoData = fs.readFileSync(videoFilePath);

        channel.sendToQueue('video_queue', media);

        console.log('Video sent successfully.');

        // setTimeout(() => {
        //     connection.close();
        //     process.exit(0);
        // }, 5000);
    } catch (error) {
        console.error('Error:', error);
    }
}

const writeVideo = async (videoData) => {
    try {
        // Generate a unique filename for the video
        const fileName = `video_${uuidv4()}.mp4`;
        const filePath = `${VIDEO_DIRECTORY}/${fileName}`;
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

const startRabbitMQConsumer = async () => {
    try {
        const connection = await amqp.connect('amqp://localhost:15672');
        const channel = await connection.createChannel();

        await channel.assertQueue(QUEUE_NAME);

        channel.consume(QUEUE_NAME, async (msg) => {
            if (msg) {
                try {
                    // Generate a unique filename for the video
                    const fileName = `video_${uuidv4()}.jpg`;
                    const filePath = `${VIDEO_DIRECTORY}/${fileName}`;
                    console.log('Video path:', filePath)
                    // Create a write stream to save the video
                    const fileStream = fs.createWriteStream(filePath);

                    // Write the video data to the file
                    fileStream.write(msg.content);
                    fileStream.end();

                    console.log('Video saved to:', filePath);

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
        console.error('RabbitMQ connection error:', error);
    }
};

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
                    console.log('Video path:', filePath)
                    // Create a write stream to save the video
                    const fileStream = fs.createWriteStream(filePath);

                    // Write the video data to the file
                    fileStream.write(msg.content);
                    fileStream.end();

                    console.log('Video saved to:', filePath);

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
app.post("/sendVideoAsBlob", upload.single('media'), (req, res) => {
    console.log(req.file)
    const media = req.file.buffer
    const blob = new Blob([media]);
    sendVideoAsBlob(blob);  // pass the data to the function we defined
    console.log("A video is sent to queue")
    res.send("Video Sent"); //response to the API request
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`);
});

