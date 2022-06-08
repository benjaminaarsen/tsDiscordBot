import { AudioResource, createAudioResource } from "@discordjs/voice";
import { GuildMember, Message, TextChannel } from "discord.js";
import { stream, search, video_info, YouTubeStream } from "play-dl";
export interface TrackData {
	url: string;
	title: string;
    author: GuildMember;
    channel: TextChannel;
    artist: string;
    query: string;
}

export class Track implements TrackData{
    public readonly url: string;
	public readonly title: string;
    public readonly author: GuildMember;
    public readonly channel: TextChannel;
    public readonly artist: string;
    public readonly query: string;

	private constructor({ url, title, author, channel, artist, query }: TrackData) {
		this.url = url;
		this.title = title;
        this.author = author;
        this.channel = channel;
        this.artist = artist;
        this.query = query;
	}

    public createAudioResource(): Promise<AudioResource<Track>> {
        return new Promise(async (resolve, reject) => {
            await stream(this.url)
            .catch(
                (err) => {
                    reject(new Error(err));
                }
            )
            .then((data: YouTubeStream) => {
                resolve(createAudioResource(data.stream, { metadata: this, inputType: data.type}))
                }
            )
            .catch(
                (err) => {
                    reject(new Error(err));
                }
            )
        });
        
    }

    public static async from(query: string, author: GuildMember, channel: TextChannel): Promise<Track> {
        let info;
        try{
            info = await search(query, {source: {youtube: "video"}, limit: 1}).then(
                (l) => {return l[0]}
            )
        }
        catch (error) {
            console.log(error);
            await channel.send("Something went wrong playing the track, try again later.")
        }
        
        if (!info) {    
            console.log(info);
            return;
        }
        // console.log(await video_info(info.url));
        
        return new Track({
            title: info.title,
            url: info.url,
            author: author,
            channel: channel,
            artist: info.channel.name,
            query: query
        });
	}
}