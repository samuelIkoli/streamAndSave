# USERS API Documentation

This document provides documentation for the API endpoints specified below.

## Table of Contents

- [Endpoints](#endpoints)

  - [Instantiate start](#start)
  - [Send Chunks](#receive)
  - [Get URL](#final)
  - [Get Transcript](#transcript)

---

## Endpoints


### Start

Create a new stream to start recieving.

- **URL**: `/startReceiving`
- **Method**: `GET`
- **Request**: None
- **Response**: An ID to keep track of your video.


### Receive

Retrieve details of a specific user by their id.

- **URL**: `/receiveChunks/:id`
- **Method**: `POST`
- **Request**: None
- **Response**: If user exists, (Success - HTTP Status Code 200) and details of username searched, else (Failed - HTTP Status Code 400).


### Final

Get URL when finished.

- **URL**: `/final/:id` 
- **Method**: `GET`
- **Request Param**: id
- **Response**: Video URL

### Transcript

Retrieve transcript of video recording.

- **URL**: `/transcript/:id`
- **Method**: `GET`
- **Request**: None
- **Response**: (Success - HTTP Status Code 200) and trnscript, else (Failed - HTTP Status Code 400 - transcript not found).