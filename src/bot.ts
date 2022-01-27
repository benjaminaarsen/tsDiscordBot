require('dotenv').config();

import { AudioPlayerStatus, AudioResource, entersState, joinVoiceChannel, VoiceConnectionStatus } from '@discordjs/voice';
import { Client, GuildMember, Intents, Message, Snowflake, TextChannel, User } from 'discord.js';
import { Subscription } from './classes/subscription';
import { Track } from './classes/track';
const myIntents = new Intents();
myIntents.add(
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_VOICE_STATES
    );

const client = new Client({intents: myIntents});

const prefix = ".";
client.on('ready', () => {
    console.log(`${client.user.username} has logged in`);
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
        console.log(queue);
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
                        name: "help",
                        description: "shows this command"
                    }
                ]
                let msg = "";
                commands.forEach(cmd => {
                    msg += `${cmd.name}:\n${cmd.description}\n\n`
                })
                await message.channel.send(msg);

        }
    }
})
client.login(process.env.DISCORD_TOKEN);
