require('dotenv').config();

import { AudioPlayerStatus, AudioResource, entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, GuildMember, Intents, Snowflake, TextChannel } from 'discord.js';
import { Subscription } from './classes/subscription';
import { Track } from './classes/track';
import SpotifyWebApi from "spotify-web-api-node";

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

const prefix = ".";
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

const subscriptions = new Map<Snowflake, Subscription>();

async function playCommand(member, textChannel, args: string[], subscription: Subscription) {
    console.log("Play command triggered");
    if (!subscription) {
        if (member instanceof GuildMember && member.voice.channel) {
            const channel = member.voice.channel;
            subscription = new Subscription(
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guildId,
                    adapterCreator: channel.guild.voiceAdapterCreator
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

    try {
        const track = await Track.from(args.join(" "));
        subscription.enqueue(track);
        textChannel.send(`Queued ${track.title}`);
    } catch (error){
        console.warn(error);
        await textChannel.send("Failed to play track");
    }
}
async function skipCommand(textChannel, subscription: Subscription) {
    if (subscription) {
        subscription.audioPlayer.stop();
        await textChannel.send("Skipped song");
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
async function loopCommand(textChannel, subscription: Subscription) {
    try {
        if (subscription.audioPlayer.state.status === AudioPlayerStatus.Playing) {
            subscription.loop = !subscription.loop;
            if (subscription.loop) {
                const resource = subscription.audioPlayer.state.resource as AudioResource<Track>;
                const track = await Track.from(resource.metadata.title);
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
                    adapterCreator: channel.guild.voiceAdapterCreator
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
    const id = url.match(/[-\w]{20,}/)[0];
 
    spotify.getPlaylistTracks(id).then((data) => {

        data.body.items.forEach(async (item) => {
            const artistsList = [];
            item.track.artists.forEach((artist) => {
                artistsList.push(artist.name);
            })
            const query = `${item.track.name} ${artistsList.join(", ")}`
            try {
                const track = await Track.from(query);
                subscription.enqueue(track);
            } catch (error) {
                await textChannel.send(`Failed to play ${item.track.name}`);
                console.error(error);
            }
        })
    }, (err) => {
        console.error(err);

    }).catch((err) => {
        console.error(err);
        textChannel.send("An error occured, maybe the link is incorrect?");
    }).then(async () => {
        await textChannel.send(`Successfully added playlist`)
    })
}
client.on("messageCreate", async (message) => {
    if (!message.author.bot) {
        let subscription = subscriptions.get(message.guildId);
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
                loopCommand(message.channel, subscription);
                break;
            case "help": 
                const commands = [
                    {
                        name: "play",
                        description: "Plays music from given url / keywords"
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
        }
    }
})
client.login(process.env.DISCORD_TEST_TOKEN);
