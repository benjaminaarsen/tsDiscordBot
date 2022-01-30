import { AudioResource, createAudioResource } from "@discordjs/voice";
import { GuildMember, Message, TextChannel } from "discord.js";
import { dlp } from "googleapis/build/src/apis/dlp";
import { stream, search, video_info } from "play-dl";
import SearchOptions from "play-dl";
// import { google } from 'googleapis';
export interface TrackData {
	url: string;
	title: string;
    author: GuildMember;
    channel: TextChannel;
}
// const youtube = google.youtube({
//     auth: process.env.YOUTUBE_TOKEN,
//     version: "v3"
// });
// const noop = () => {};

export class Track implements TrackData{
    public readonly url: string;
	public readonly title: string;
    public readonly author: GuildMember;
    public readonly channel: TextChannel;

	private constructor({ url, title, author, channel }: TrackData) {
		this.url = url;
		this.title = title;
        this.author = author;
        this.channel = channel;
	}

    public createAudioResource(): Promise<AudioResource<Track>> {
        return new Promise(async (resolve, reject) => {
            const audioStream = await stream(this.url).catch(
                () => {
                    return;
                }
            );
            if (!audioStream) {
                reject(new Error("Returned error, maybe NFSW?"));
                return;
            }
            resolve(createAudioResource(audioStream.stream, { metadata: this, inputType: audioStream.type}))
        });
    }

    public static async from(query: string, author: GuildMember, channel: TextChannel): Promise<Track> {
        let info = await search(query, {source: {youtube: "video"}, limit: 1}).then(
            (l) => {return l[0]}
        )
        let track : Track;
        await video_info(info.url).catch(async () => {
            const i = await search(query, {source: {soundcloud: "tracks"}, limit: 1, fuzzy: true}).then(
                (l) => {return l[0]}
            )
            track = new Track({
                title: i.name,
                url: i.url,
                author: author,
                channel: channel
            })
        })
        if (track) {
            return track;
        } else {
            return new Track({
                title: info.title,
                url: info.url,
                author: author,
                channel: channel,
            });
        }
	}
}