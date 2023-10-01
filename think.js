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
})