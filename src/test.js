const ytdl = require('ytdl-core');
const fs = require('fs');
const link = "https://www.youtube.com/watch?v=j0lN0w5HVT8";


ytdl(link)
    .pipe(fs.createWriteStream('video.mp4'));