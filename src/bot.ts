require('dotenv').config();
//TODO last.fm api?
import { AudioPlayerStatus, AudioResource, DiscordGatewayAdapterCreator, entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, GuildMember, Intents, Snowflake, TextChannel, MessageEmbed } from 'discord.js';
import { Subscription } from './classes/subscription';
import { Track } from './classes/track';
import SpotifyWebApi from "spotify-web-api-node";
import { getSong } from 'genius-lyrics-api'

// import songlyrics from 'songlyrics' not working as i would like yet


const myIntents = new Intents();
myIntents.add(
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_VOICE_STATES
    );

const client = new Client({intents: myIntents});
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
    const subscriptionLoop = setInterval(async () => {
        subscriptions.forEach((s, k) => {
            if (s.voiceConnection.state.status === VoiceConnectionStatus.Destroyed) {
                subscriptions.delete(k)
            }
        })
    }, 10000);
    const refreshAccessToken = setInterval(async () => {
        spotify.clientCredentialsGrant().then(
            (data) => {
                spotify.setAccessToken(data.body['access_token'])
            }
        )
    }, 3600000);
});

client.on("voiceStateUpdate", (oldState, newState) => {
    //if leave
    if (oldState.channel && !newState.channel) {
        //if one user in voice channel and its the bot
        if (oldState.channel.members.size === 1 && oldState.channel.members.first().user === client.user) {
            const subscription = subscriptions.get(oldState.guild.id)
            try {
                if (subscription) {
                    subscription.voiceConnection.destroy();
                    subscriptions.delete(oldState.guild.id);
                }
            } catch (err) {
                console.error(err)
            }
            
           
        }
    }
})

const subscriptions = new Map<Snowflake, Subscription>();

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function playCommand(member, textChannel, args: string[], subscription: Subscription) {
    console.log("Play command triggered");
    if (!subscription) {
        if (member instanceof GuildMember && member.voice.channel) {
            const channel = member.voice.channel;
            subscription = new Subscription(
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guildId,
                    adapterCreator: channel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator
                })
            );
            subscription.voiceConnection.on("error", console.warn);
            subscriptions.set(channel.guildId, subscription);
        }
    }
    if (!subscription) {
        await textChannel.send("Please join a voice channel!");
        return;
    }

    try {
        await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
    } catch (error) {
        console.warn(error);
        await textChannel.send("Failed to join the voice channel");
        return;
    }
        const track = await Track.from(args.join(" "), member, textChannel);
        if (track) {
            if (subscription.queue.length !== 0) {
                await textChannel.send(`Queued ${track.title}`);
            }
            subscription.enqueue(track);
            await textChannel.send(`Now playing ${track.title} requested by ${track.author.displayName}`)
        } else {
            await textChannel.send(`No music found with query: ${args.join(" ")}`)
            if (subscription.queue.length === 0) {
                subscription.voiceConnection.destroy();
                subscriptions.delete(textChannel.guildId);
            }
        }
        
      
    
}   
async function skipCommand(textChannel, subscription: Subscription) {
    if (subscription) {
        let nextTrack;
        if (subscription.queue.length !== 1) {
            nextTrack = subscription.queue[1];
        }
        subscription.audioPlayer.stop();
        if (nextTrack) await textChannel.send(`Skipped song, now playing ${nextTrack.title} requested by ${nextTrack.author.displayName}`);
    } else {
        await textChannel.send("I am currently not playing anything.");
    }
}
async function queueCommand(textChannel, subscription: Subscription) {
    if (subscription) {
        let current;
        if (subscription.audioPlayer.state.status === AudioPlayerStatus.Playing) {
            current = `Playing ${(subscription.audioPlayer.state.resource as AudioResource<Track>).metadata.title}`
        } else {
            current = `Nothing currently playing`
        }
        const queue = 
            subscription.queue
                .slice(0, 5)
                .map((track, index) => `${index + 1}) ${track.title}`)
                .join("\n")
        // console.log(queue);
        await textChannel.send(`${current}\n\n${queue}`);
    } else {
        await textChannel.send("I am currently not playing anything.")
    }
}
async function pauseCommand(textChannel, subscription: Subscription) {
    if (subscription) {
        subscription.audioPlayer.pause();
        await textChannel.send("Paused the player")
    } else {
        await textChannel.send("I am currently not playing anything.")
    }
}
async function resumeCommand(textChannel, subscription: Subscription) {
    if (subscription) {
        subscription.audioPlayer.unpause();
        await textChannel.send("The player has resumed.")
    } else {
        await textChannel.send("I am currently not playing anything.")
    }
}
async function leaveCommand(textChannel: TextChannel, subscription: Subscription) {
    if (subscription) {
        subscription.voiceConnection.destroy();
        subscriptions.delete(textChannel.guildId);
        await textChannel.send("I have left the voice channel");
    } else {
        await textChannel.send("I am currently not in a voice channel.")
    }
}
async function loopCommand(member, textChannel, subscription: Subscription) {
    try {
        if (subscription.audioPlayer.state.status === AudioPlayerStatus.Playing) {
            subscription.loop = !subscription.loop;
            if (subscription.loop) {
                const resource = subscription.audioPlayer.state.resource as AudioResource<Track>;
                const track = await Track.from(resource.metadata.title, member, textChannel);
                subscription.enqueue(track);
            }
            await textChannel.send(`Repeat is now ${subscription.loop ? "On" : "Off"}`)
        } else {
            await textChannel.send("I am currently not playing anything")
        }
    } catch (error) {
        if (error instanceof TypeError) await textChannel.send("Error: I am currently not playing anything")
    }
   
   
}
async function playListCommand(url: string, member, textChannel, subscription: Subscription) {
    if (!subscription) {
        if (member instanceof GuildMember && member.voice.channel) {
            const channel = member.voice.channel;
            subscription = new Subscription(
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guildId,
                    adapterCreator: channel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator
                })
            );
            subscription.voiceConnection.on("error", console.warn);
            subscriptions.set(channel.guildId, subscription);
        }
    }
    if (!subscription) {
        await textChannel.send("Please join a voice channel!");
        return;
    }

    try {
        await entersState(subscription.voiceConnection, VoiceConnectionStatus.Ready, 20e3);
    } catch (error) {
        console.warn(error);
        await textChannel.send("Failed to join the voice channel");
        return;
    }
    const match = url.match(/[-\w]{20,}/);
    let id: string;
    if (match) {
        id = match[0];
    } else {
        await textChannel.send("Invalid url");
        return;
    }
 
    spotify.getPlaylistTracks(id).then((data) => {

        data.body.items.forEach(async (item) => {
            const artistsList = [];
            item.track.artists.forEach((artist) => {
                artistsList.push(artist.name);
            })
            const query = `${artistsList.join(", ")} ${item.track.name} `
            try {
                const track = await Track.from(query, member, textChannel);
                subscription.enqueue(track);
            } catch (error) {
                await textChannel.send(`Failed to play ${item.track.name}, maybe it's explicit?`);
                console.error(error);
            }
        })
    }).catch((err) => {
        console.error(err);
        textChannel.send("An error occured, maybe the link is incorrect?");
    }).then(async () => {
        await textChannel.send(`Successfully added playlist`)
    })
}
async function clearCommand(textChannel, subscription: Subscription) {
    if (subscription) {
        subscription.queue = [];
        await textChannel.send("The queue has been cleared");
    }
    
}
async function shuffleCommand(textChannel, subscription: Subscription) {
    if (subscription) {
        const newQueue = shuffleArray(subscription.queue);
        subscription.queue = newQueue;
        await textChannel.send("Shuffled the queue!");
    }
    
}
async function nowPlayingCommand(textChannel, subscription: Subscription) {
    //if there is something playing
    if (subscription) {
        if (subscription.audioPlayer.state.status === AudioPlayerStatus.Playing) {
            await textChannel.send(`Currenty playing ${(subscription.audioPlayer.state.resource as AudioResource<Track>).metadata.title}`)
        } else {
            await textChannel.send("Currently not playing anything.");
        }
    }
    
}
async function lyricsCommand(textChannel, subscription: Subscription) {
    if (subscription) {
        if (subscription.audioPlayer.state.status === AudioPlayerStatus.Playing) {
            const m = (subscription.audioPlayer.state.resource as AudioResource<Track>).metadata;   
            const options = {
                apiKey: process.env.GENIUS_SECRET,
                title: m.title,
                artist: m.artist,
                optimizeQuery: true
            }
            getSong(options).then(async (song) => {
                if (song) {
                    const embed = new MessageEmbed()
                        .setTitle(`Lyrics for ${m.title} - ${m.artist}`)
                        .setDescription(`${song.lyrics}\n${song.url}`)
                        .setFooter({text: "Lyrics provided by Genius", iconURL: "https://i.pinimg.com/originals/48/a0/9f/48a09fb46e00022a692e459b917a2848.jpg"});
                    await textChannel.send({embeds: [embed]});
                } else await textChannel.send(`Couldn't find lyrics for ${m.query}`)
            })
        } else {
                await textChannel.send("Currently not playing anything.");
            }
    }
}
client.on("messageCreate", async (message) => {
    if (!message.author.bot) {
        let subscription = subscriptions.get(message.guildId);
        if (!message.content.startsWith(prefix)) return;
        const [command, ...args] = message.content
                .trim()
                .substring(prefix.length)
                .split(/\s+/);
        switch (command) {
            case "play": 
                playCommand(message.member, message.channel, args, subscription);
                break;
            case "skip":
                skipCommand(message.channel, subscription);
                break;
            case "queue":
                queueCommand(message.channel, subscription);
                break;
            case "clear":
                clearCommand(message.channel, subscription);
                break;
            case "pause":
                pauseCommand(message.channel, subscription);
                break;
            case "resume":
                resumeCommand(message.channel, subscription);
                break;
            case "leave":
                leaveCommand(message.channel as TextChannel, subscription);
                break;
            case "playlist": 
                playListCommand(args[0], message.member, message.channel, subscription);
                break;
            case "repeat": 
                loopCommand(message.member, message.channel, subscription);
                break;
            case "shuffle":
                shuffleCommand(message.channel, subscription);
                break;
            case "nowplaying":
                nowPlayingCommand(message.channel, subscription);
                break;
            case "lyrics":
                lyricsCommand(message.channel, subscription);
                break;
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
client.login(process.env.DISCORD_TOKEN);
