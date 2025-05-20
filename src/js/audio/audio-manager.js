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
            volume: -74  // Lower volume from -12 to -18
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
        this.hihat.volume.value = -28;  // Increased from -20 for louder gunshots
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
        // Use A3 for a lower, less piercing sound (was D5)
        const basePitch = 'A3';
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
    
    // Pre-create synths for better performance
    setupExplosionSynths() {
        if (!this.explosionSynths) {
            // Main explosion synth - reused for multiple parts of the explosion
            this.explosionSynths = {
                // Base boom for low frequencies
                baseBoom: new Tone.Synth({
                    oscillator: {
                        type: 'square8',
                        width: 0.5
                    },
                    envelope: {
                        attack: 0.001,
                        decay: 0.2,
                        sustain: 0.1,
                        release: 0.3
                    }
                }).toDestination(),
                
                // Debris synth for higher frequencies
                debris: new Tone.Synth({
                    oscillator: {
                        type: 'square4',
                        width: 0.3
                    },
                    envelope: {
                        attack: 0.001,
                        decay: 0.15,
                        sustain: 0,
                        release: 0.2
                    }
                }).toDestination()
            };
        }
        return this.explosionSynths;
    }
    
    playGrenadeExplosion() {
        try {
            // Make sure audio context is running
            if (Tone.context.state !== 'running') {
                console.warn('Audio context not running, attempting to resume');
                Tone.context.resume();
            }
            
            // Get or create explosion synths
            const synths = this.setupExplosionSynths();
            const { baseBoom, debris } = synths;
            
            // Reuse the same synths with different settings
            
            // Set initial volumes
            baseBoom.volume.value = -5;
            debris.volume.value = -8;
            
            // Random notes for debris
            const randomNotes = ['C2', 'D2', 'E2', 'G2'];
            const getRandomNote = () => randomNotes[Math.floor(Math.random() * randomNotes.length)];
            
            // Play initial explosion sounds
            baseBoom.triggerAttackRelease('A0', '16n');
            
            // Schedule debris sounds with a single setTimeout for efficiency
            const now = Tone.now();
            
            // Instead of nested timeouts, schedule everything at once with precise timing
            debris.triggerAttackRelease('D2', '32n', now + 0.025);
            debris.triggerAttackRelease(getRandomNote(), '32n', now + 0.05);
            baseBoom.triggerAttackRelease('F0', '8n', now + 0.05);
            baseBoom.volume.rampTo(-8, 0.01, now + 0.05);
            
            debris.triggerAttackRelease(getRandomNote(), '32n', now + 0.1);
            baseBoom.triggerAttackRelease('C1', '16n', now + 0.075);
            baseBoom.volume.rampTo(-10, 0.01, now + 0.075);
            
            // Select only the most important secondary effects to reduce processing
            debris.triggerAttackRelease(getRandomNote(), '32n', now + 0.15);
            baseBoom.triggerAttackRelease('E0', '16n', now + 0.1);
            baseBoom.volume.rampTo(-12, 0.01, now + 0.1);
            
            // Final blast with reduced volume
            debris.triggerAttackRelease('G1', '32n', now + 0.15);
            debris.volume.rampTo(-12, 0.01, now + 0.15);
            
        } catch (e) {
            console.error('Error playing grenade explosion:', e);
        }
    }

    // Setup death sound synth once and reuse it
    setupScreamSynth() {
        // Already created in the constructor, just make sure it's optimally configured
        if (this.scream) {
            // Reset to default for consistency
            this.scream.oscillator.type = 'square4';
            this.scream.envelope.attack = 0.005;
            this.scream.envelope.decay = 0.2;
            this.scream.envelope.sustain = 0.1;
            this.scream.envelope.release = 0.4;
        }
        return this.scream;
    }

    playEnemyDeath(enemyId = null) {
        try {
            if (Tone.context.state !== 'running') {
                Tone.context.resume();
            }
            
            // Get the synth
            const scream = this.setupScreamSynth();
            
            // Only update scale occasionally to reduce computation
            // Increment death counter and possibly change scale
            this.deathCount++;
            if (this.deathCount >= this.scaleChangeThreshold) {
                // Reset counter
                this.deathCount = 0;
                
                // Set new change threshold (higher to reduce frequency of changes)
                this.scaleChangeThreshold = Math.floor(Math.random() * 6) + 12; // 12-17
                
                // Pick a new random scale
                const scales = Object.keys(this.musicalScales);
                const newScale = scales[Math.floor(Math.random() * scales.length)];
                
                // Only change if it's significantly different
                if (newScale !== this.currentScale) {
                    this.currentScale = newScale;
                    this.deathNotes = this.musicalScales[this.currentScale];
                    
                    // Reset note index
                    this.lastNoteIndex = Math.floor(Math.random() * this.deathNotes.length);
                }
            }
            
            // Determine which note to play
            let noteIndex;
            if (enemyId !== null) {
                // Simplified deterministic note selection
                noteIndex = enemyId % this.deathNotes.length;
            } else {
                // Cycle through notes
                this.lastNoteIndex = (this.lastNoteIndex + 1) % this.deathNotes.length;
                noteIndex = this.lastNoteIndex;
            }
            
            const note = this.deathNotes[noteIndex];
            
            // Only vary synth settings for "special" enemies to reduce computation
            // Use a simple mod check to limit variations
            if (enemyId !== null && enemyId % 3 === 0) {
                // Reduced list of oscillator types for better performance
                const oscTypes = ['square', 'square4', 'pulse', 'triangle4'];
                const oscTypeIndex = enemyId % oscTypes.length;
                scream.oscillator.type = oscTypes[oscTypeIndex];
                
                // Simplified envelope variation - only apply to certain enemies
                scream.envelope.attack = 0.001 + (enemyId % 3) * 0.001;
                scream.envelope.decay = 0.1 + (enemyId % 3) * 0.05;
            } else {
                // Use default settings for most enemies
                scream.oscillator.type = 'square4';
                scream.envelope.attack = 0.005;
                scream.envelope.decay = 0.2;
            }
            
            // Play the sound - using Tone.js scheduling for better performance
            const now = Tone.now();
            const duration = 0.25; // Shorter duration for better performance
            
            // Trigger attack now
            scream.triggerAttack(note, now);
            
            // Only for some enemies, perform frequency ramp (every 2nd enemy)
            if ((enemyId === null) || (enemyId % 2 === 0)) {
                // More performant frequency calculation
                const higherNote = this.deathNotes[Math.min(noteIndex + 1, this.deathNotes.length - 1)];
                scream.frequency.rampTo(Tone.Frequency(higherNote), duration * 0.5, now);
            }
            
            // Schedule release using Tone.js timing instead of setTimeout
            scream.triggerRelease(now + duration);
            
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