const genius = require('genius-lyrics-api');
const play = require('play-dl');
require('dotenv').config();

// const options = {
//     apiKey: process.env.GENIUS_SECRET,
//     title: "Heat Waves",
//     artist: "Glass Animals",
//     optimizeQuery: true
// }
// genius.searchSong(options).then((song) => {
//     console.log(song);
// })
// let info = play.search("Heat waves", {source: {youtube: "video"}, limit: 1}).then(
//     (l) => {console.log(l[0])}
// )
const i = play.search("heat waves", {source: {soundcloud: "tracks"}, limit: 1}).then(
    (l) => {console.log(l[0])}
)
