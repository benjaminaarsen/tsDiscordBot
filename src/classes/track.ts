import { AudioResource, createAudioResource } from "@discordjs/voice";
import { stream } from "play-dl";
import { google } from 'googleapis';

export interface TrackData {
	id: string;
	title: string;
}
const youtube = google.youtube({
    auth: process.env.YOUTUBE_TOKEN,
    version: "v3"
});
const noop = () => {};

export class Track implements TrackData{
    public readonly id: string;
	public readonly title: string;

	private constructor({ id, title }: TrackData) {
		this.id = id;
		this.title = title;
	}

    public createAudioResource(): Promise<AudioResource<Track>> {
        return new Promise(async (resolve, reject) => {
            const audioStream = await stream(this.id);
            resolve(createAudioResource(audioStream.stream, { metadata: this, inputType: audioStream.type}))
        });
    }

    public static async from(query: string): Promise<Track> {
		const info = await youtube.search.list({
            part: [
                "snippet"
            ],
            maxResults: 1,
            q: query
        }).then((res) => {
            return {
                title: res.data.items[0].snippet.title,
                id: res.data.items[0].id.videoId
            }
        })

		return new Track({
			title: info.title,
			id: info.id
		});
	}
}