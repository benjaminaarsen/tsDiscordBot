require('dotenv').config();
//TODO last.fm api?
import { AudioPlayerStatus, AudioResource, DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, GuildMember, Intents, Snowflake, TextChannel, MessageEmbed } from 'discord.js';
// import { Subscription } from './classes/subscription';
// import { Track } from './classes/track';
import SpotifyWebApi from "spotify-web-api-node";
import { getSong } from 'genius-lyrics-api';
import { DisTube } from 'distube';
// import songlyrics from 'songlyrics' not working as i would like yet

let leaveTimeout;
const myIntents = new Intents();
myIntents.add(
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_VOICE_STATES
    );

const client = new Client({intents: myIntents});
const distube = new DisTube(client, {
    youtubeDL: false
});

const spotify = new SpotifyWebApi({
    clientId: process.env.SPOTIFY_ID,
    clientSecret: process.env.SPOTIFY_SECRET
})
// get access token
spotify.clientCredentialsGrant().then(
    (data) => {
        spotify.setAccessToken(data.body['access_token'])
    }
)

const prefix = process.env.PREFIX;

client.on('ready', () => {
    console.log(`${client.user.username} has logged in`);
    const refreshAccessToken = setInterval(async () => {
        spotify.clientCredentialsGrant().then(
            (data) => {
                spotify.setAccessToken(data.body['access_token'])
            }
        )
    }, 3600000);
});

// client.on("voiceStateUpdate", (oldState, newState) => {
//     //if leave
//     if (oldState.channel && !newState.channel) {
//         //if one user in voice channel and its the bot
//         if (oldState.channel.members.size === 1 && oldState.channel.members.first().user === client.user) {
//             const subscription = subscriptions.get(oldState.guild.id)
//             try {
//                 if (subscription) {
//                     subscription.voiceConnection.destroy();
//                     subscriptions.delete(oldState.guild.id);
//                 }
//             } catch (err) {
//                 console.error(err)
//             }
//         }
//     }
// })

// const subscriptions = new Map<Snowflake, Subscription>();

async function playCommand(member, textChannel, args: string[]) {
    console.log("Play command triggered");
    if (member instanceof GuildMember && member.voice.channel) {
        const channel = member.voice.channel;
        distube.play(channel, args.join(" "), {
            textChannel: textChannel,
            member: member
        })
        return;
    }
    await textChannel.send("Please join a voice channel!");
    return;
}

async function skipCommand(message) {
    const queue = distube.getQueue(message)
    if (!queue) {
        return
    }
    if (!queue.playing) {
        return
    }
    if (queue.songs.length === 1) {
        await message.channel.send("There is no song up next")
        return
    }
    distube.skip(message).then( async (song) => {
        await message.channel.send(`Skipped song, next up: ${song.name}`)
        }
    )
}

async function queueCommand(message) {
    const queue = distube.getQueue(message);
    if (queue !== undefined) {
        let queueMessage = ""
        queue.songs
        .slice(0,5)
        .forEach(
            (song, index) => {
                queueMessage += `${index + 1}: ${song.name}\n`
            }
        );
        await message.channel.send(queueMessage);
        return;
    }
    await message.channel.send("There is no queue");
}

async function pauseCommand(message) {
    const queue = distube.getQueue(message)
    if (queue && queue.playing) {
        distube.pause(message)
        await message.channel.send("Paused the player.")
        return
    }
    await message.channel.send("I am currently not playing anything.")
}

async function resumeCommand(message) {
    const queue = distube.getQueue(message)
    if (queue && queue.paused) {
        distube.resume(message)
        await message.channel.send("Resumed the player.")
        return
    }
    await message.channel.send("I am not paused.")
}

async function leaveCommand(message) { //TODO idk if this is reliable
    const queue = distube.getQueue(message)
    if (queue && queue.voice) {
        queue.voice.leave()
        await message.channel.send("I have left the voice channel")
        return
    }
    await message.channel.send("I am currently not in a voice channel")
    // distube.stop(message)
}

async function stopCommand(message) {
    const queue = distube.getQueue(message)
    if (queue && queue.playing) {
        queue.stop().then(
            await message.channel.send("Stopped the player")
        )
        return
    }
    await message.channel.send("I am currently not playing anything.")
}
// async function loopCommand(member, textChannel, subscription: Subscription) {
//     try {
//         if (subscription.audioPlayer.state.status === AudioPlayerStatus.Playing) {
//             subscription.loop = !subscription.loop;
//             if (subscription.loop) {
//                 const resource = subscription.audioPlayer.state.resource as AudioResource<Track>;
//                 const track = await Track.from(resource.metadata.title, member, textChannel);
//                 subscription.enqueue(track);
//             }
//             await textChannel.send(`Repeat is now ${subscription.loop ? "On" : "Off"}`)
//         } else {
//             await textChannel.send("I am currently not playing anything")
//         }
//     } catch (error) {
//         if (error instanceof TypeError) await textChannel.send("Error: I am currently not playing anything")
//     }
   
   
// }
// async function playListCommand(url: string, member, textChannel, subscription: Subscription) {
//     if (!subscription) {
//         if (member instanceof GuildMember && member.voice.channel) {
//             const channel = member.voice.channel;
//             subscription = new Subscription(
//                 joinVoiceChannel({
//                     channelId: channel.id,
//                     guildId: channel.guildId,
//                     adapterCreator: channel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator
//                 })
//             );
//             subscription.voiceConnection.on("error", console.warn);
//             subscriptions.set(channel.guildId, subscription);
//         }
//     }
//     if (!subscription) {
//         await textChannel.send("Please join a voice channel!");
//         return;
//     }

//     try {
//         await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
//     } catch (error) {
//         console.warn(error);
//         await textChannel.send("Failed to join the voice channel");
//         return;
//     }
//     const match = url.match(/[-\w]{20,}/);
//     let id: string;
//     if (match) {
//         id = match[0];
//     } else {
//         await textChannel.send("Invalid url");
//         return;
//     }
 
//     spotify.getPlaylistTracks(id).then((data) => {

//         data.body.items.forEach(async (item) => {
//             const artistsList = [];
//             item.track.artists.forEach((artist) => {
//                 artistsList.push(artist.name);
//             })
//             const query = `${artistsList.join(", ")} ${item.track.name} `
//             try {
//                 const track = await Track.from(query, member, textChannel);
//                 subscription.enqueue(track);
//             } catch (error) {
//                 await textChannel.send(`Failed to play ${item.track.name}`);
//                 console.error(error);
//             }
//         })
//     }).catch((err) => {
//         console.error(err);
//         textChannel.send("An error occured, maybe the link is incorrect?");
//     }).then(async () => {
//         await textChannel.send(`Successfully added playlist`)
//     })
// }
// async function clearCommand(textChannel, subscription: Subscription) {
//     if (subscription) {
//         subscription.queue = [];
//         await textChannel.send("The queue has been cleared");
//     }
    
// }
// async function shuffleCommand(textChannel, subscription: Subscription) {
//     if (subscription) {
//         const newQueue = shuffleArray(subscription.queue);
//         subscription.queue = newQueue;
//         await textChannel.send("Shuffled the queue!");
//     }
    
// }
// async function nowPlayingCommand(textChannel, subscription: Subscription) {
//     //if there is something playing
//     if (subscription) {
//         if (subscription.audioPlayer.state.status === AudioPlayerStatus.Playing) {
//             await textChannel.send(`Currenty playing ${(subscription.audioPlayer.state.resource as AudioResource<Track>).metadata.title}`)
//         } else {
//             await textChannel.send("Currently not playing anything.");
//         }
//     }
    
// }
async function lyricsCommand(message) {
    // if (subscription) {
    //     if (subscription.audioPlayer.state.status === AudioPlayerStatus.Playing) {
    //         const m = (subscription.audioPlayer.state.resource as AudioResource<Track>).metadata;   
    //         const options = {
    //             apiKey: process.env.GENIUS_SECRET,
    //             title: m.title,
    //             artist: m.artist,
    //             optimizeQuery: true
    //         }
    //         getSong(options).then(async (song) => {
    //             if (song) {
    //                 const embed = new MessageEmbed()
    //                     .setTitle(`Lyrics for ${m.title} - ${m.artist}`)
    //                     .setDescription(`${song.lyrics}\n${song.url}`)
    //                     .setFooter({text: "Lyrics provided by Genius", iconURL: "https://i.pinimg.com/originals/48/a0/9f/48a09fb46e00022a692e459b917a2848.jpg"});
    //                 await textChannel.send({embeds: [embed]});
    //             } else await textChannel.send(`Couldn't find lyrics for ${m.query}`)
    //         })
    //     } else {
    //             await textChannel.send("Currently not playing anything.");
    //         }
    // }
    // function commonWords1 (first: string, second: string) {
    //     // console.log(`1: ${first}`);
    //     // console.log(`2: ${second}\n`);
    //     var first = first.replace(/[^\w\s]/gi, '')
    //     var second = second.replace(/[^\w\s]/gi, '')
    //     var a = first.split(' ')
    //     var b = second.split(' ')
    //     var d = []

    //     for (var i = 0; i < a.length; i++) {
    //       for (var j = 0; j < b.length; j++) {
    //             if (a[i].toLowerCase() === b[j].toLowerCase() && d.indexOf(a[i]) !== null) {
    //                 d.push(a[i])
    //               }
    //       }
    //     }
    //     return d.join(' ')
    // }
    // const queue = distube.getQueue(message)
    // if (queue && queue.playing){

    // }

}
client.on("messageCreate", async (message) => {
    if (!message.author.bot) {
        if (!message.content.startsWith(prefix)) return;
        const [command, ...args] = message.content
                .trim()
                .substring(prefix.length)
                .split(/\s+/)
        switch (command) {
            case "play": 
                playCommand(message.member, message.channel, args)
                break
            case "skip":
                skipCommand(message)
                break
            case "queue":
                queueCommand(message)
                break
            case "pause":
                pauseCommand(message)
                break
            case "resume":
                resumeCommand(message)
                break
            case "leave":
                leaveCommand(message)
                break
            case "stop":
                stopCommand(message)
                break
            case "help": 
                const commands = [
                    {
                        name: "play",
                        description: "Plays music from given url / keywords"
                    },
                    {
                        name: "lyrics",
                        description: "Send lyrics of current playing song"
                    },
                    {
                        name: "nowplaying",
                        description: "Displays the song that's currently playing"
                    },
                    {
                        name: "skip",
                        description: "Skips to the next song"
                    },
                    {
                        name: "queue",
                        description: "Displays current and upcoming songs"
                    },
                    {
                        name: "clear",
                        description: "clears the queue"
                    },
                    {
                        name: "pause",
                        description: "pauses the current playing song"
                    },
                    {
                        name: "resume",
                        description: "resumes the paused song"
                    },
                    {
                        name: "leave",
                        description: "leaves the voice channel"
                    },
                    {
                        name: "repeat",
                        description: "toggles the repeat (repeats queue)"
                    },
                    {
                        name: "playlist",
                        description: "adds spotify playlist with given url to queue"
                    },
                    {
                        name: "shuffle",
                        description: "shuffles the queue"
                    },
                    {
                        name: "help",
                        description: "shows this command"
                    }
                ]
                let msg = "";
                commands.forEach(cmd => {
                    msg += `${cmd.name}:\n${cmd.description}\n\n`
                })
                await message.channel.send(msg);
                break;
            default:
                message.channel.send(`Command "${command}" not found. Use ".help" to see what commands are available.`);
                break;
        }   
    }
})

distube.on("finish", (queue) => { //leave after 10 seconds of not playing
    leaveTimeout = setTimeout(() => {
        queue.voice.leave()
    }, 10000)
})
.on("addSong", () => { //if a song is added when we are about to leave 
    clearTimeout(leaveTimeout)
})

client.login(process.env.DISCORD_TOKEN);
