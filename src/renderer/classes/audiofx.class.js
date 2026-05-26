import { Howl, Howler } from 'howler';

export class AudioManager {
    constructor(audioPaths) {
        // audioPaths: object with sound name => resolved URL/path
        if (window.settings.audio === true) {
            if (window.settings.disableFeedbackAudio === false) {
                this.stdout = new Howl({
                    src: [audioPaths.stdout],
                    volume: 0.4
                });
                this.stdin = new Howl({
                    src: [audioPaths.stdin],
                    volume: 0.4
                });
                this.folder = new Howl({
                    src: [audioPaths.folder]
                });
                this.granted = new Howl({
                    src: [audioPaths.granted]
                });
            }
            this.keyboard = new Howl({
                src: [audioPaths.keyboard]
            });
            this.theme = new Howl({
                src: [audioPaths.theme]
            });
            this.expand = new Howl({
                src: [audioPaths.expand]
            });
            this.panels = new Howl({
                src: [audioPaths.panels]
            });
            this.scan = new Howl({
                src: [audioPaths.scan]
            });
            this.denied = new Howl({
                src: [audioPaths.denied]
            });
            this.info = new Howl({
                src: [audioPaths.info]
            });
            this.alarm = new Howl({
                src: [audioPaths.alarm]
            });
            this.error = new Howl({
                src: [audioPaths.error]
            });

            Howler.volume(window.settings.audioVolume);
        } else {
            Howler.volume(0.0);
        }

        // Return a proxy to avoid errors if sounds aren't loaded
        return new Proxy(this, {
            get: (target, sound) => {
                if (sound in target) {
                    return target[sound];
                } else {
                    return {
                        play: () => { return true; }
                    };
                }
            }
        });
    }
}

// Factory: pre-resolve all audio paths via electronAPI, then construct
export async function createAudioManager() {
    const soundNames = [
        'stdout', 'stdin', 'folder', 'granted',
        'keyboard', 'theme', 'expand', 'panels',
        'scan', 'denied', 'info', 'alarm', 'error'
    ];

    const audioPaths = {};
    for (const name of soundNames) {
        audioPaths[name] = await window.electronAPI.getAudioUrl(name + '.wav');
    }

    return new AudioManager(audioPaths);
}
