import * as Tone from 'tone';
import { SOUNDS } from '../utils/constants.js';

export class AudioManager {
    constructor() {
        this.isInitialized = false;
        this.sounds = {};
        this.lastPlayTime = 0;
        this.minPlayGap = 0.05; // 50ms minimum gap between sounds
        
        // Add multiple musical scales focused on happy/Nintendo-like sounds
        this.musicalScales = {
            // C major scale (happy, triumphant) - higher octave
            cMajor: ['C6', 'D6', 'E6', 'F6', 'G6', 'A6', 'B6', 'C7'],
            
            // G major scale (bright, cheerful) - higher octave
            gMajor: ['G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F#6', 'G6'],
            
            // C major pentatonic (very happy, classic game sounds)
            cMajorPentatonic: ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'],
            
            // Mario-like scale (bouncy)
            marioScale: ['E6', 'G6', 'C7', 'E7', 'G7'],
            
            // Zelda-like scale (bright and adventurous)
            zeldaScale: ['A5', 'B5', 'D6', 'E6', 'F#6', 'A6']
        };
        
        // Current scale - start with C major
        this.currentScale = 'cMajor';
        
        // Get the notes from the current scale
        this.deathNotes = this.musicalScales[this.currentScale];
        
        // Start at random position in scale
        this.lastNoteIndex = Math.floor(Math.random() * this.deathNotes.length);
        
        // Change scale every 10-15 deaths for musical variety
        this.deathCount = 0;
        this.scaleChangeThreshold = Math.floor(Math.random() * 6) + 10; // 10-15
        
        this.setupSynths();
    }
    
    setupSynths() {
        // Create reverb effect
        this.reverb = new Tone.Reverb({
            decay: 4,
            wet: 0.6,
            preDelay: 0.2
        }).toDestination();

        // Create a simple synth for pixel enemy death 'pew'
        this.scream = new Tone.Synth({
            oscillator: {
                type: 'square4'  // More 8-bit Nintendo-like sound
            },
            envelope: {
                attack: 0.005,   // Faster attack for crisp Nintendo sound
                decay: 0.2,      // Slightly shorter decay
                sustain: 0.1,    // Lower sustain
                release: 0.4     // Shorter but still fading release
            },
            volume: -15         // Lower volume
        }).toDestination();

        // Create 8-bit sound synth for gunshot
        this.hihat = new Tone.Synth({
            oscillator: {
                type: 'square',  // Back to simple square wave
                width: 0.3  // Tighter width for cleaner sound
            },
            envelope: {
                attack: 0.001,
                decay: 0.1,  // Quick decay
                sustain: 0,   // No sustain for cleaner sound
                release: 0.1  // Quick release
            },
            volume: -12
        }).toDestination();
        
        // Create 8-bit explosion synth
        this.tom = new Tone.Synth({
            oscillator: {
                type: 'square8',
                width: 0.8
            },
            envelope: {
                attack: 0.001,
                decay: 0.4,
                sustain: 0.01,
                release: 0.8
            },
            volume: -20
        }).toDestination();
        
        // Create arcade-style pickup sound synth
        this.ping = new Tone.Synth({
            oscillator: {
                type: 'square4'  // More arcade-like sound
            },
            envelope: {
                attack: 0.001,
                decay: 0.2,
                sustain: 0.1,
                release: 0.3
            },
            volume: -15
        }).toDestination();
        
        // Create 8-bit reload sound synth
        this.click = new Tone.Synth({
            oscillator: {
                type: 'square',
                width: 0.5
            },
            envelope: {
                attack: 0.001,
                decay: 0.1,
                sustain: 0,
                release: 0.1
            },
            volume: -20
        }).toDestination();
        
        // Create 8-bit footstep synth
        this.footstep = new Tone.Synth({
            oscillator: {
                type: 'square'
            },
            envelope: {
                attack: 0.001,
                decay: 0.2,
                sustain: 0,
                release: 0.1
            },
            volume: -20
        }).toDestination();
        
        // Set initial volume very low to prevent audio spikes
        this.hihat.volume.value = -12;  // Increased from -20 for louder gunshots
        this.tom.volume.value = -20;
        this.ping.volume.value = -15;
        this.click.volume.value = -20;
        this.footstep.volume.value = -20;
        
        this.isInitialized = true;
        
        // Track footsteps
        this.lastFootstepTime = 0;
        this.footstepCooldown = 0.3; // seconds between footsteps
        this.footstepPhase = 0; // 0 or 1 to alternate between left and right foot
    }
    
    playSound(soundType, pitch = null, pitchModifier = 1.0) {
        if (!this.isInitialized || Tone.context.state !== 'running') {
            console.warn('Audio not initialized or context not running');
            return;
        }
        
        const sound = SOUNDS[soundType];
        if (!sound) return;
        
        try {
            // Ensure minimum time gap between sounds
            const now = Tone.now();
            const timeToPlay = Math.max(now, this.lastPlayTime + this.minPlayGap);
            this.lastPlayTime = timeToPlay;
            
            // 8-bit style pitch and timing
            let duration = '16n';
            let synth;
            
            switch (sound.type) {
                case 'hihat':
                    synth = this.hihat;
                    duration = '32n';
                    break;
                case 'tom':
                    synth = this.tom;
                    duration = '8n';
                    break;
                case 'click':
                    synth = this.click;
                    duration = '32n';
                    break;
                case 'ping':
                    synth = this.ping;
                    duration = '16n';
                    break;
                case 'footstep':
                    synth = this.footstep;
                    duration = '64n';
                    break;
                default:
                    return;
            }
            
            // Set volume from sound options
            synth.volume.value = sound.options.volume;
            
            // Apply pitch modifier if provided
            if (pitchModifier !== 1.0 && pitch) {
                // Calculate modified frequency
                const baseFreq = Tone.Frequency(pitch).toFrequency();
                const modifiedFreq = baseFreq * pitchModifier;
                // Convert back to note
                synth.triggerAttackRelease(modifiedFreq, duration, timeToPlay);
            } else {
                // Use pitch directly
                synth.triggerAttackRelease(pitch || 'C2', duration, timeToPlay);
            }
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }
    
    playGunshot(pitchModifier = 1.0) {
        // Use D5 for a more natural sound
        const basePitch = 'D5';
        this.playSound('GUNSHOT', basePitch, pitchModifier);
    }
    
    playExplosion() {
        this.playSound('EXPLOSION');
    }
    
    playReload() {
        this.playSound('RELOAD');
    }
    
    playPickup(itemType) {
        try {
            if (Tone.context.state !== 'running') {
                Tone.context.resume();
            }

            switch(itemType) {
                case 'ammo':
                    // High, metallic sound for ammo pickup
                    const ammoSynth = new Tone.Synth({
                        oscillator: { type: 'square4' },
                        envelope: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.3 }
                    }).toDestination();
                    ammoSynth.volume.value = -10;
                    // Play ascending notes in higher range
                    ammoSynth.triggerAttackRelease('E5', '16n');
                    setTimeout(() => ammoSynth.triggerAttackRelease('G5', '16n'), 100);
                    setTimeout(() => ammoSynth.triggerAttackRelease('B5', '16n'), 200);
                    break;

                case 'grenade':
                    // Low, heavy sound for grenade pickup
                    const grenadeSynth = new Tone.Synth({
                        oscillator: { type: 'square4' },
                        envelope: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.3 }
                    }).toDestination();
                    grenadeSynth.volume.value = -10;
                    // Play ascending notes in lower range
                    grenadeSynth.triggerAttackRelease('A2', '16n');
                    setTimeout(() => grenadeSynth.triggerAttackRelease('C3', '16n'), 100);
                    setTimeout(() => grenadeSynth.triggerAttackRelease('E3', '16n'), 200);
                    break;

                case 'health':
                    // Happy, Mario-like sound for health pickup
                    const healthSynth = new Tone.Synth({
                        oscillator: { type: 'square4' },
                        envelope: { attack: 0.001, decay: 0.2, sustain: 0.1, release: 0.3 }
                    }).toDestination();
                    healthSynth.volume.value = -10;
                    // Play ascending notes for happy sound
                    healthSynth.triggerAttackRelease('C4', '16n');
                    setTimeout(() => healthSynth.triggerAttackRelease('E4', '16n'), 100);
                    setTimeout(() => healthSynth.triggerAttackRelease('G4', '16n'), 200);
                    break;
            }
        } catch (e) {
            console.error('Error playing pickup sound:', e);
        }
    }
    
    // Add new methods for grenade sounds
    playGrenadeBounce() {
        // Use a higher pitch for bounce sound with random variation
        const pitches = ['C3', 'D3', 'E3', 'F3'];
        const randomPitch = pitches[Math.floor(Math.random() * pitches.length)];
        this.playSound('GRENADE_BOUNCE', randomPitch);
    }
    
    playGrenadeExplosion() {
        try {
            // Make sure audio context is running
            if (Tone.context.state !== 'running') {
                console.warn('Audio context not running, attempting to resume');
                Tone.context.resume();
            }
            
            // Create a more punchy, dry explosion sound
            const baseBoom = new Tone.Synth({
                oscillator: {
                    type: 'square8',
                    width: 0.5  // Reduced width for tighter sound
                },
                envelope: {
                    attack: 0.001,
                    decay: 0.2,    // Shorter decay
                    sustain: 0.1,  // Lower sustain
                    release: 0.3   // Much shorter release
                }
            }).toDestination();
            
            // Higher frequencies explosion synth
            const debrisSynth = new Tone.Synth({
                oscillator: {
                    type: 'square4',
                    width: 0.3  // Tighter width
                },
                envelope: {
                    attack: 0.001,
                    decay: 0.15,   // Shorter decay
                    sustain: 0,
                    release: 0.2    // Shorter release
                }
            }).toDestination();
            
            // Create distortion synth for noise component
            const noiseSynth = new Tone.Synth({
                oscillator: {
                    type: 'square8',
                    width: 0.4  // Tighter width
                },
                envelope: {
                    attack: 0.001,
                    decay: 0.2,    // Shorter decay
                    sustain: 0.1,
                    release: 0.3    // Shorter release
                }
            }).toDestination();
            
            // Add a sharp initial impact sound
            const impactSynth = new Tone.Synth({
                oscillator: {
                    type: 'square',
                    width: 0.2  // Very tight for punch
                },
                envelope: {
                    attack: 0.001,
                    decay: 0.05,   // Very short decay
                    sustain: 0,
                    release: 0.05   // Very short release
                }
            }).toDestination();
            
            // Set volumes - adjusted for better balance
            baseBoom.volume.value = -5;    // Reduced from 0
            debrisSynth.volume.value = -8;  // Reduced from -5
            noiseSynth.volume.value = -10;  // Reduced from -8
            impactSynth.volume.value = -3;  // Slightly louder for punch
            
            // Initial impact sound
            impactSynth.triggerAttackRelease('C2', '32n');
            
            // Play initial deeper boom
            baseBoom.triggerAttackRelease('A0', '16n');  // Shorter duration
            
            // Create sequence of higher sounds that follow the main explosion
            setTimeout(() => {
                // First debris sound
                debrisSynth.triggerAttackRelease('D2', '32n');  // Shorter duration
                
                // Set of random debris sounds
                const playRandomDebris = () => {
                    const randomNotes = ['C2', 'D2', 'E2', 'G2'];  // Removed higher notes
                    const randomNote = randomNotes[Math.floor(Math.random() * randomNotes.length)];
                    debrisSynth.triggerAttackRelease(randomNote, '32n');
                };
                
                // Play fewer debris sounds at closer intervals
                setTimeout(() => playRandomDebris(), 25);
                setTimeout(() => playRandomDebris(), 75);
                setTimeout(() => playRandomDebris(), 125);
            }, 25);  // Start debris sooner
            
            // Add low rumble with shorter duration
            setTimeout(() => {
                baseBoom.oscillator.type = 'square8';
                baseBoom.volume.value = -8;
                baseBoom.triggerAttackRelease('F0', '8n');  // Shorter duration
            }, 50);
            
            // Add noise burst for explosion
            setTimeout(() => {
                noiseSynth.volume.value = -8;
                noiseSynth.triggerAttackRelease('C1', '32n');  // Shorter duration
            }, 35);
            
            // Add a second bass hit for more impact
            setTimeout(() => {
                baseBoom.volume.value = -10;
                baseBoom.triggerAttackRelease('C1', '16n');  // Shorter duration
            }, 75);
            
            // Secondary explosion for more impact
            setTimeout(() => {
                baseBoom.volume.value = -12;
                baseBoom.triggerAttackRelease('E0', '16n');  // Shorter duration
                
                // More random debris
                setTimeout(() => playRandomDebris(), 25);
                setTimeout(() => playRandomDebris(), 60);
            }, 100);
            
            // Final blast
            setTimeout(() => {
                debrisSynth.volume.value = -12;
                debrisSynth.triggerAttackRelease('G1', '32n');  // Shorter duration
            }, 150);
            
        } catch (e) {
            console.error('Error playing grenade explosion:', e);
        }
    }

    playEnemyDeath(enemyId = null) {
        try {
            if (Tone.context.state !== 'running') {
                Tone.context.resume();
            }
            
            // Increment death counter and possibly change scale
            this.deathCount++;
            if (this.deathCount >= this.scaleChangeThreshold) {
                // Reset counter
                this.deathCount = 0;
                
                // Set new change threshold
                this.scaleChangeThreshold = Math.floor(Math.random() * 6) + 10; // 10-15
                
                // Pick a new random scale
                const scales = Object.keys(this.musicalScales);
                let newScale;
                do {
                    newScale = scales[Math.floor(Math.random() * scales.length)];
                } while (newScale === this.currentScale); // Ensure we change to a different scale
                
                this.currentScale = newScale;
                this.deathNotes = this.musicalScales[this.currentScale];
                
                // Reset note index
                this.lastNoteIndex = Math.floor(Math.random() * this.deathNotes.length);
                
                console.log(`Changed to ${this.currentScale} scale`);
            }
            
            // Use the enemy ID to select a note if provided, otherwise continue the sequence
            let noteIndex;
            if (enemyId !== null) {
                // Use the enemy ID to select a deterministic but seemingly random note
                noteIndex = enemyId % this.deathNotes.length;
            } else {
                // Otherwise, continue the sequence
                this.lastNoteIndex = (this.lastNoteIndex + 1) % this.deathNotes.length;
                noteIndex = this.lastNoteIndex;
            }
            
            const note = this.deathNotes[noteIndex];
            
            // Vary the synth settings slightly for each enemy
            if (enemyId !== null) {
                // Slightly vary the oscillator type for different timbres
                // Nintendo-like oscillator types (8-bit/chiptune sound)
                const oscTypes = ['square', 'square4', 'square8', 'pulse', 'pwm', 'sine4', 'triangle4', 'sawtooth8'];
                const oscTypeIndex = enemyId % oscTypes.length;
                this.scream.oscillator.type = oscTypes[oscTypeIndex];
                
                // Vary the envelope parameters for Nintendo-like sound character
                const attackVar = 0.001 + (enemyId % 5) * 0.001;  // Very fast attack for crisp sounds
                const decayVar = 0.1 + (enemyId % 8) * 0.03;     // Moderate decay
                const sustainVar = 0.05 + (enemyId % 5) * 0.01;  // Low sustain for punchier sound
                const releaseVar = 0.2 + (enemyId % 8) * 0.05;   // Shorter release but still with fade
                
                this.scream.envelope.attack = attackVar;
                this.scream.envelope.decay = decayVar;
                this.scream.envelope.sustain = sustainVar;
                this.scream.envelope.release = releaseVar;
            }
            
            // Calculate a slightly lower note for the end of the slide
            const endNoteIdx = Math.max(0, noteIndex - 2);
            const endNote = this.deathNotes[endNoteIdx];
            
            // Play the musical death sound with Nintendo-like quality
            const duration = 0.3; // Shorter duration for arcade-like effect
            this.scream.triggerAttack(note);
            
            // For Nintendo-like sounds, slide UP instead of down (more cheerful)
            const higherNote = this.deathNotes[Math.min(noteIndex + 2, this.deathNotes.length - 1)];
            this.scream.frequency.rampTo(Tone.Frequency(higherNote), duration * 0.6);
            
            setTimeout(() => {
                this.scream.triggerRelease();
            }, duration * 1000);
            
        } catch (e) {
            console.error('Error playing enemy death sound:', e);
        }
    }

    // New method for footstep sounds
    playFootstep(movementIntensity = 1.0) {
        const now = Tone.now();
        
        // Only play footstep sounds if enough time has passed since the last one
        if (now - this.lastFootstepTime < this.footstepCooldown) {
            return;
        }
        
        // Calculate footstep cooldown based on movement intensity
        // Faster movement = faster footstep sounds
        this.footstepCooldown = 0.2 - (movementIntensity * 0.1); // Between 0.1-0.2 seconds (twice as fast)
        
        // Alternate between left and right footstep sounds
        this.footstepPhase = 1 - this.footstepPhase;
        
        // Use lower pitches for less annoying sound
        const basePitch = this.footstepPhase === 0 ? 'C3' : 'E3';
        
        // Randomize the pitch slightly
        const pitchVariation = 0.95 + (Math.random() * 0.1); // 0.95-1.05
        
        // Set volume based on movement intensity (even lower volume)
        const volume = -30 - (1.0 - movementIntensity) * 5; // Volume between -30 and -35
        const sound = { type: 'footstep', options: { volume } };
        SOUNDS.FOOTSTEP = sound;
        
        // Play the sound
        this.playSound('FOOTSTEP', basePitch, pitchVariation);
        
        // Update timestamp
        this.lastFootstepTime = now;
    }
} 