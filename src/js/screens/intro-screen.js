import * as Tone from 'tone';

export class IntroScreen {
    constructor() {
        // Show cursor on intro screen
        document.body.style.cursor = 'default';
        
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.top = '0';
        this.container.style.left = '0';
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.container.style.backgroundColor = 'black';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.alignItems = 'center';
        this.container.style.justifyContent = 'center';
        this.container.style.color = '#ffffff';
        this.container.style.fontFamily = '"Press Start 2P", cursive';
        this.container.style.zIndex = '1000';
        
        // Create text container
        this.textContainer = document.createElement('div');
        this.textContainer.style.textAlign = 'center';
        this.textContainer.style.marginBottom = '2rem';
        this.textContainer.style.fontSize = '1.2rem';
        this.textContainer.style.lineHeight = '2rem';
        this.textContainer.style.maxWidth = '800px';
        this.textContainer.style.padding = '0 1rem';
        
        // Create title element (initially hidden)
        this.titleElement = document.createElement('div');
        this.titleElement.style.fontSize = '3rem';
        this.titleElement.style.marginBottom = '2rem';
        this.titleElement.style.opacity = '0';
        this.titleElement.style.transform = 'scale(0.5)';
        this.titleElement.style.transition = 'all 0.5s ease-out';
        this.titleElement.textContent = 'PIXELHELL';
        
        // Create start button (initially hidden)
        this.startButton = document.createElement('button');
        this.startButton.textContent = 'START';
        this.startButton.style.padding = '1rem 2rem';
        this.startButton.style.fontSize = '1.5rem';
        this.startButton.style.fontFamily = '"Press Start 2P", cursive';
        this.startButton.style.backgroundColor = '#00aa00';
        this.startButton.style.color = '#ffffff';
        this.startButton.style.border = 'none';
        this.startButton.style.cursor = 'pointer';
        this.startButton.style.opacity = '0';
        this.startButton.style.transform = 'scale(0.5)';
        this.startButton.style.transition = 'all 0.5s ease-out';
        this.startButton.style.boxShadow = 'inset -4px -4px 0px 0px #006600';
        this.startButton.style.position = 'relative';
        this.startButton.style.textTransform = 'uppercase';
        this.startButton.style.letterSpacing = '2px';
        this.startButton.style.imageRendering = 'pixelated';
        
        // Add pixel art border
        this.startButton.style.border = '4px solid #ffffff';
        this.startButton.style.borderStyle = 'solid';
        this.startButton.style.borderWidth = '4px';
        this.startButton.style.borderLeftColor = '#ffffff';
        this.startButton.style.borderTopColor = '#ffffff';
        this.startButton.style.borderRightColor = '#888888';
        this.startButton.style.borderBottomColor = '#888888';
        
        // Add hover effect
        this.startButton.onmouseover = () => {
            this.startButton.style.backgroundColor = '#00cc00';
            this.startButton.style.boxShadow = 'inset -4px -4px 0px 0px #008800';
        };
        
        this.startButton.onmouseout = () => {
            this.startButton.style.backgroundColor = '#00aa00';
            this.startButton.style.boxShadow = 'inset -4px -4px 0px 0px #006600';
            this.startButton.style.transform = 'translate(0, 0)';
            this.startButton.style.borderLeftColor = '#ffffff';
            this.startButton.style.borderTopColor = '#ffffff';
            this.startButton.style.borderRightColor = '#888888';
            this.startButton.style.borderBottomColor = '#888888';
        };
        
        this.startButton.onmousedown = () => {
            this.startButton.style.transform = 'translate(2px, 2px)';
            this.startButton.style.backgroundColor = '#008800';
            this.startButton.style.boxShadow = 'inset -2px -2px 0px 0px #004400';
            this.startButton.style.borderLeftColor = '#888888';
            this.startButton.style.borderTopColor = '#888888';
            this.startButton.style.borderRightColor = '#ffffff';
            this.startButton.style.borderBottomColor = '#ffffff';
        };
        
        this.startButton.onmouseup = () => {
            this.startButton.style.transform = 'translate(0, 0)';
            this.startButton.style.backgroundColor = '#00aa00';
            this.startButton.style.boxShadow = 'inset -4px -4px 0px 0px #006600';
            this.startButton.style.borderLeftColor = '#ffffff';
            this.startButton.style.borderTopColor = '#ffffff';
            this.startButton.style.borderRightColor = '#888888';
            this.startButton.style.borderBottomColor = '#888888';
        };
        
        // Add elements to container
        this.container.appendChild(this.textContainer);
        this.container.appendChild(this.titleElement);
        this.container.appendChild(this.startButton);
        
        // Add to document
        document.body.appendChild(this.container);
        
        // Story text
        this.storyText = [
            "You are a THING,",
            "that must recover the THINGS,",
            "in order to escape from THE THING."
        ];
        
        this.currentLine = 0;
        this.currentChar = 0;
        this.typingSpeed = 50; // ms per character
        this.lineDelay = 500; // ms between lines
    }
    
    startTyping() {
        this.typeNextChar();
    }
    
    typeNextChar() {
        if (this.currentLine >= this.storyText.length) {
            this.showTitleAndButton();
            return;
        }
        
        const currentText = this.storyText[this.currentLine];
        
        if (this.currentChar < currentText.length) {
            // Add next character
            const charSpan = document.createElement('span');
            charSpan.textContent = currentText[this.currentChar];
            charSpan.style.opacity = '0';
            charSpan.style.animation = 'fadeIn 0.1s forwards';
            this.textContainer.appendChild(charSpan);
            
            this.currentChar++;
            setTimeout(() => this.typeNextChar(), this.typingSpeed);
        } else {
            // Move to next line
            this.textContainer.appendChild(document.createElement('br'));
            this.currentLine++;
            this.currentChar = 0;
            setTimeout(() => this.typeNextChar(), this.lineDelay);
        }
    }
    
    showTitleAndButton() {
        // Show title with animation
        this.titleElement.style.opacity = '1';
        this.titleElement.style.transform = 'scale(1)';
        
        // Show button with animation after a delay
        setTimeout(() => {
            this.startButton.style.opacity = '1';
            this.startButton.style.transform = 'scale(1)';
        }, 500);
    }
    
    setStartCallback(callback) {
        let isStarting = false; // Add flag to prevent multiple clicks
        
        this.startButton.onclick = async () => {
            // Prevent multiple clicks
            if (isStarting) return;
            isStarting = true;
            
            try {
                // Hide cursor when game starts
                document.body.style.cursor = 'none';
                
                // Start audio context
                await Tone.start();
                
                // Play 3-note startup sound
                const synth = new Tone.Synth({
                    oscillator: {
                        type: "square" // 8-bit sound
                    },
                    envelope: {
                        attack: 0.01,
                        decay: 0.2,
                        sustain: 0.2,
                        release: 0.2
                    }
                }).toDestination();
                
                // Play ascending notes with slight delay
                synth.triggerAttackRelease("C4", "8n");
                setTimeout(() => synth.triggerAttackRelease("E4", "8n"), 150);
                setTimeout(() => synth.triggerAttackRelease("G4", "8n"), 300);
                
                // Fade out intro screen
                this.container.style.opacity = '0';
                this.container.style.transition = 'opacity 0.5s ease-out';
                
                setTimeout(() => {
                    this.container.remove();
                    callback();
                    
                    // Add character entrance animation - falling from sky
                    if (window.gameInstance.player) {
                        const player = window.gameInstance.player;
                        
                        // Disable player control until animation completes
                        player.controlsEnabled = false;
                        
                        // Start player high in the sky
                        player.group.position.set(0, 30, 5);
                        player.group.scale.set(1, 1, 1);
                        
                        // Physics parameters
                        let velocity = 0;
                        const gravity = 0.08;
                        const bounceCoefficient = 0.6;
                        let isGrounded = false;
                        let bounceCount = 0;
                        const maxBounces = 3;
                        
                        // Animate player falling and bouncing
                        function animatePlayerFall() {
                            // Apply gravity
                            velocity += gravity;
                            player.group.position.y -= velocity;
                            
                            if (player.group.position.y <= 0 && !isGrounded) {
                                // Bounce effect
                                velocity = -velocity * bounceCoefficient;
                                bounceCount++;
                                
                                // Play bounce sound
                                if (window.gameInstance.audioManager) {
                                    window.gameInstance.audioManager.playGrenadeBounce();
                                }
                                
                                // Stop bouncing after a few bounces
                                if (bounceCount >= maxBounces || Math.abs(velocity) < 0.3) {
                                    isGrounded = true;
                                    player.group.position.y = 0;
                                    
                                    // Small wobble effect to show landing complete
                                    setTimeout(() => {
                                        player.group.scale.set(0.95, 1.05, 0.95);
                                        setTimeout(() => {
                                            player.group.scale.set(1, 1, 1);
                                            
                                            // Enable player control after animation completes
                                            setTimeout(() => {
                                                player.controlsEnabled = true;
                                                
                                                // Play a "ready" sound
                                                const readySound = new Tone.Synth({
                                                    oscillator: { type: "square" },
                                                    envelope: { attack: 0.001, decay: 0.1, sustain: 0.1, release: 0.2 }
                                                }).toDestination();
                                                readySound.volume.value = -15;
                                                
                                                // Play a short ascending arpeggio
                                                readySound.triggerAttackRelease("C4", "16n");
                                                setTimeout(() => readySound.triggerAttackRelease("E4", "16n"), 100);
                                                setTimeout(() => readySound.triggerAttackRelease("C5", "8n"), 300);
                                            }, 300);
                                        }, 100);
                                    }, 100);
                                    
                                    return;
                                }
                            }
                            
                            if (!isGrounded) {
                                requestAnimationFrame(animatePlayerFall);
                            }
                        }
                        
                        // Start the animation
                        animatePlayerFall();
                    }
                }, 500);
            } catch (error) {
                console.error('Error starting game:', error);
                isStarting = false; // Reset flag if there's an error
            }
        };
    }
    
    // Add CSS animation
    static addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes glow {
                0% { text-shadow: 0 0 10px #ff0000; }
                50% { text-shadow: 0 0 20px #ff0000, 0 0 30px #ff0000; }
                100% { text-shadow: 0 0 10px #ff0000; }
            }
            
            .intro-text {
                animation: glow 2s infinite;
            }
        `;
        document.head.appendChild(style);
    }
} 