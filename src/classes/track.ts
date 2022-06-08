
import { AudioResource, createAudioResource } from "@discordjs/voice";
import { GuildMember, Message, TextChannel } from "discord.js";
import { stream, search, video_info, YouTubeStream, YouTubeVideo } from "play-dl";
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
        let info: YouTubeVideo;
        
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
        
    
        const song = await video_info(info.url).then( (data) => {
            if (data.video_details.music){
                return {
                    artist: data.video_details.music[0].artist['text'],
                    title: data.video_details.music[0].song['text'] ? data.video_details.music[0].song['text'] : data.video_details.music[0].song
                }
            } else {
                return false
            }
        })
        function commonWords1 (first: string, second: string) {
            var first = first.replace(/[^\w\s]/gi, '')
            var second = second.replace(/[^\w\s]/gi, '')
            // var third = third.replace(/[^\w\s]/gi, '')
            var a = first.split(' ')
            var b = second.split(' ')
            // var c = third.split(' ')
            var d = []

            for (var i = 0; i < a.length; i++) {
              for (var j = 0; j < b.length; j++) {
                // for (var k = 0; k < c.length; k++) {
                    // console.log(`${a[i]} ${b[j]}`)
                    if (a[i].toLowerCase() === b[j].toLowerCase() && d.indexOf(a[i]) !== null) {
                        d.push(a[i])
                      }
                // }
              }
            }
            return d.join(' ')
        }
        function commonWords2 (first: string, second: string, third: string) {
            var first = first.replace(/[^\w\s]/gi, '')
            var second = second.replace(/[^\w\s]/gi, '')
            var third = third.replace(/[^\w\s]/gi, '')
            var a = first.split(' ')
            var b = second.split(' ')
            var c = third.split(' ')
            var d = []

            for (var i = 0; i < a.length; i++) {
                for (var j = 0; j < b.length; j++) {
                for (var k = 0; k < c.length; k++) {
                    // console.log(`${a[i]} ${b[j]}`)
                    if (a[i].toLowerCase() === b[j].toLowerCase() && b[j].toLowerCase() === c[k].toLowerCase() && d.indexOf(a[i]) !== null) {
                        d.push(a[i])
                        }
                }
                }
            }
            return d.join(' ')
        }

        let title;
        if (song) title = commonWords2(info.title, query, song.title)
        else title = commonWords1(info.title, query)

        return new Track({
            title: title,
            url: info.url,
            author: author,
            channel: channel,
            artist: song ? song.artist : info.channel.name,
            query: query
        });
	}
}