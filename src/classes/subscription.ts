import { AudioPlayer, AudioPlayerState, AudioPlayerStatus, AudioResource, createAudioPlayer, entersState, VoiceConnection, VoiceConnectionDisconnectReason, VoiceConnectionStatus } from '@discordjs/voice';
import { promisify } from 'node:util'
import { Track } from './track';
const wait = promisify(setTimeout);


export class Subscription {
    public readonly voiceConnection: VoiceConnection;
	public readonly audioPlayer: AudioPlayer;
	public queue: Track[] = [];
	public queueLock = false;
	public readyLock = false;
	public loop = false;
	public timeout: NodeJS.Timeout;
    public constructor(voiceConnection: VoiceConnection) {
        this.voiceConnection = voiceConnection;
        this.audioPlayer = createAudioPlayer();

        this.voiceConnection.on('stateChange', async (_: any, newState: { status: any; reason: any; closeCode: number; }) => {
			if (newState.status === VoiceConnectionStatus.Disconnected) {
				if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
					/**
					 * If the WebSocket closed with a 4014 code, this means that we should not manually attempt to reconnect,
					 * but there is a chance the connection will recover itself if the reason of the disconnect was due to
					 * switching voice channels. This is also the same code for the bot being kicked from the voice channel,
					 * so we allow 5 seconds to figure out which scenario it is. If the bot has been kicked, we should destroy
					 * the voice connection.
					 */
					try {
						await entersState(this.voiceConnection, VoiceConnectionStatus.Connecting, 5_000);
						// Probably moved voice channel
					} catch {
						this.voiceConnection.destroy();
						// Probably removed from voice channel
					}
				} else if (this.voiceConnection.rejoinAttempts < 5) {
					/**
					 * The disconnect in this case is recoverable, and we also have <5 repeated attempts so we will reconnect.
					 */
					await wait((this.voiceConnection.rejoinAttempts + 1) * 5_000);
					this.voiceConnection.rejoin();
				} else {
					/**
					 * The disconnect in this case may be recoverable, but we have no more remaining attempts - destroy.
					 */
					this.voiceConnection.destroy();
				}
			} else if (newState.status === VoiceConnectionStatus.Destroyed) {
				/**
				 * Once destroyed, stop the subscription.
				 */
				this.stop();
			} else if (
				!this.readyLock &&
				(newState.status === VoiceConnectionStatus.Connecting || newState.status === VoiceConnectionStatus.Signalling)
			) {
				/**
				 * In the Signalling or Connecting states, we set a 20 second time limit for the connection to become ready
				 * before destroying the voice connection. This stops the voice connection permanently existing in one of these
				 * states.
				 */
				this.readyLock = true;
				try {
					await entersState(this.voiceConnection, VoiceConnectionStatus.Ready, 20_000);
				} catch {
					if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) this.voiceConnection.destroy();
				} finally {
					this.readyLock = false;
				}
			}
		});


        // Configure audio player
		this.audioPlayer.on('stateChange', async (oldState: AudioPlayerState, newState: AudioPlayerState) => {
			if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
				// If the Idle state is entered from a non-Idle state, it means that an audio resource has finished playing.
				// The queue is then processed to start playing the next track, if one is available.
				// (oldState.resource as AudioResource<Track>).metadata.onFinish();
				if (this.voiceConnection.state.status !== VoiceConnectionStatus.Destroyed) {
					this.timeout = setTimeout(()=>{this.voiceConnection.destroy(); this.stop()}, 20000);
				}
				if (this.loop && oldState.status === AudioPlayerStatus.Playing && this.queue.length === 0) {
					const resource = oldState.resource as AudioResource<Track>;
					const track = await Track.from(resource.metadata.title, resource.metadata.author, resource.metadata.channel);
					this.queue = [track];
					// console.log(this.queue);
				}
				void this.processQueue();
			}
			if (newState.status === AudioPlayerStatus.Playing) {
				const resource = newState.resource as AudioResource<Track>;
				const channel = resource.metadata.channel;
				await channel.send(`Now playing ${resource.metadata.title} requested by ${resource.metadata.author.user.username}`)
			}
		});

		// this.audioPlayer.on('error', (error: { resource: any; }) => (error.resource as AudioResource<Track>).metadata.onError(error));


		voiceConnection.subscribe(this.audioPlayer);
    }


    /**
     * Adds a new Track to the queue.
     * 
     * @param track the track to add to the queue
     */
    public enqueue(track: Track) {
        this.queue.push(track);
        void this.processQueue();
    }

    /**
     * Stops the audio playback and empties the queue
     */
    public stop() {
        this.queueLock = true;
        this.queue = [];
        this.audioPlayer.stop(true);
    }

    /**
     * Attempts to play a Track from the queue
     */
    private async processQueue(): Promise<void> {
        if (this.queueLock || this.audioPlayer.state.status !== AudioPlayerStatus.Idle || this.queue.length === 0) {
            return;
        }
		clearTimeout(this.timeout);
        // lock queue because we are going to edit it
        this.queueLock = true;

        //remove and store first track in queue
		
		const nextTrack = this.queue.shift()!;
		if (this.loop) {
			this.queue.push(nextTrack);
		}
        
		const resource = await nextTrack.createAudioResource().catch(
			(err) => {
				console.error(err.message)
			}
		);
		if (resource) {
			this.audioPlayer.play(resource);
			this.queueLock = false;
		} else if (this.queue.length > 0){
			// go to next track
			this.queueLock = false;
			return this.processQueue();
		} else {
			this.voiceConnection.destroy();
		}
		
			
			
    }
}