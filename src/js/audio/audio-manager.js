import * as Tone from 'tone';
import { SOUNDS } from '../utils/constants.js';

export class AudioManager {
    constructor() {
        this.isInitialized = false;
        this.sounds = {};
        this.lastPlayTime = 0;
        this.minPlayGap = 0.05; // 50ms minimum gap between sounds
        
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
                type: 'triangle'
            },
            envelope: {
                attack: 0.01,
                decay: 0.08,
                sustain: 0.0,
                release: 0.05
            }
        }).toDestination(); // No reverb

        // Create synths for various sound effects
        this.hihat = new Tone.MetalSynth({
            frequency: 200,
            envelope: {
                attack: 0.001,
                decay: 0.1,
                release: 0.01
            },
            harmonicity: 5.1,
            modulationIndex: 32,
            resonance: 4000,
            octaves: 1.5
        }).toDestination();
        
        this.tom = new Tone.MembraneSynth({
            pitchDecay: 0.05,
            octaves: 4,
            oscillator: {
                type: 'sine'
            },
            envelope: {
                attack: 0.001,
                decay: 0.4,
                sustain: 0.01,
                release: 1.4,
                attackCurve: 'exponential'
            }
        }).connect(this.reverb); // Connect tom to reverb
        
        this.ping = new Tone.MetalSynth({
            frequency: 500,
            envelope: {
                attack: 0.001,
                decay: 0.1,
                release: 0.01
            },
            harmonicity: 1,
            modulationIndex: 10,
            resonance: 3000,
            octaves: 1
        }).toDestination();
        
        this.click = new Tone.NoiseSynth({
            noise: {
                type: 'white'
            },
            envelope: {
                attack: 0.005,
                decay: 0.1,
                sustain: 0
            }
        }).toDestination();
        
        // Set initial volume very low to prevent audio spikes
        this.hihat.volume.value = -20;
        this.tom.volume.value = -20;
        this.ping.volume.value = -20;
        this.click.volume.value = -20;
        
        this.isInitialized = true;
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
            
            switch (sound.type) {
                case 'hihat':
                    this.hihat.volume.value = sound.options.volume;
                    // Apply pitch modifier to frequency
                    if (pitchModifier !== 1.0) {
                        const freq = this.hihat.frequency.value;
                        this.hihat.frequency.value = freq * pitchModifier;
                    }
                    this.hihat.triggerAttackRelease(pitch || 'C2', '16n', timeToPlay);
                    break;
                case 'tom':
                    this.tom.volume.value = sound.options.volume;
                    this.tom.triggerAttackRelease(pitch || 'C2', '8n', timeToPlay);
                    break;
                case 'click':
                    this.click.volume.value = sound.options.volume;
                    this.click.triggerAttackRelease('16n', timeToPlay);
                    break;
                case 'ping':
                    this.ping.volume.value = sound.options.volume;
                    this.ping.triggerAttackRelease(pitch || 'C5', '16n', timeToPlay);
                    break;
            }
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }
    
    playGunshot(pitchModifier = 1.0) {
        // C2 is the base note, but we'll modify the frequency for variation
        // For example, with pitchModifier = 1.1, we'll get a slightly higher pitch
        const basePitch = 'C2';
        this.playSound('GUNSHOT', basePitch, pitchModifier);
    }
    
    playExplosion() {
        this.playSound('EXPLOSION');
    }
    
    playReload() {
        this.playSound('RELOAD');
    }
    
    playPickup() {
        this.playSound('PICKUP');
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
            
            // Create a single loud explosion sound with better reverb
            this.tom.volume.value = 0; // Full volume
            
            // Connect to reverb for better spatial effect
            // Use lower note for deeper, more impactful sound
            this.tom.triggerAttackRelease('C0', '2n'); 
            
            // Don't schedule additional sounds - just use the reverb to create tail
        } catch (e) {
            console.error('Error playing grenade explosion:', e);
        }
    }

    playEnemyDeath() {
        try {
            if (Tone.context.state !== 'running') {
                Tone.context.resume();
            }
            // Start at a high note and slide down quickly for a 'pew' effect
            const startNote = 'C7';
            const endNote = 'G6';
            const duration = 0.12;
            this.scream.triggerAttack(startNote);
            this.scream.frequency.rampTo(Tone.Frequency(endNote), duration * 0.8);
            setTimeout(() => {
                this.scream.triggerRelease();
            }, duration * 1000);
        } catch (e) {
            console.error('Error playing enemy death sound:', e);
        }
    }
} 