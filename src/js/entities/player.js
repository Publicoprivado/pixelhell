import * as THREE from 'three';
import * as Tone from 'tone';
import { COLORS, SIZES, GAME } from '../utils/constants.js';

export class Player {
    constructor(scene, audioManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.position = new THREE.Vector3(0, 0, 0);
        this.rotation = 0;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.recoilVelocity = new THREE.Vector3(0, 0, 0); // Add recoil velocity
        this.isMoving = false;
        this.stepTime = 0;
        this.stepDirection = 1; // 1 for right foot, -1 for left foot
        this.movementIntensity = 0; // How fast player is moving (0-1)
        this.ammo = GAME.AMMO_COUNT;
        this.maxAmmo = GAME.MAX_AMMO;
        this.isReloading = false;
        this.lastShotTime = 0;
        this.fireRate = 100; // milliseconds between shots
        this.grenades = 3; // Start with 3 grenades
        this.maxGrenades = 3; // Maximum grenades player can hold
        this.lastGrenadeTime = 0; // Initialize to 0 to ensure first grenade can be thrown
        this.grenadeRate = 2000; // milliseconds between grenades
        this.isDead = false; // Add isDead flag
        
        // Add controls enabled flag
        this.controlsEnabled = true;
        
        // Gun animation states
        this.isGunHolstered = true;
        this.gunDrawProgress = 0; // 0 = holstered, 1 = drawn
        this.gunDrawSpeed = 0.2; // Speed of drawing animation
        this.gunHolsterSpeed = 0.1; // Speed of holstering animation
        
        // FORCE INITIALIZE lastGrenadeTime to avoid any cooldown issues
        this.lastGrenadeTime = Date.now() - 3000; // Set to 3 seconds ago so first grenade can be thrown immediately
        
        this.debugMode = true; // Enable debug visuals
        
        // Health system
        this.maxHealth = 100;
        this.currentHealth = this.maxHealth;
        this.isInvulnerable = false;
        this.invulnerabilityTime = 1000; // 1 second of invulnerability after being hit
        this.lastHitTime = 0;
        
        // For debugging rotation
        this.debugArrow = null;
        this.lastMouseIntersection = new THREE.Vector3(); // Store the last mouse intersection point
        
        this.movementPenalty = 1.0; // Default to full speed
        
        // Create player mesh first
        this.createPlayerMesh();
        
        // Now create health bar after body exists
        this.createHealthBar();
    }
    
    createPlayerMesh() {
        // Create the player cube
        const geometry = new THREE.BoxGeometry(0.35, 1, 0.35);
        const material = new THREE.MeshBasicMaterial({ color: COLORS.PLAYER });
        this.body = new THREE.Mesh(geometry, material);
        this.body.position.y = 1 / 2; // Position it above the ground
        
        // Create the gun - changed to be a rectangle with 2 equal sides and 1 long side
        const gunWidth = SIZES.GUN.WIDTH * 0.8; // Make width slightly smaller
        const gunHeight = gunWidth; // Make height equal to width for square profile
        const gunLength = SIZES.GUN.DEPTH * 3.5; // Make the gun longer for better visibility
        
        const gunGeometry = new THREE.BoxGeometry(
            gunWidth,  // X dimension (width) - smaller square profile
            gunHeight, // Y dimension (height) - equal to width for square profile
            gunLength  // Z dimension (length) - longer rectangle pointing forward
        );
        const gunMaterial = new THREE.MeshBasicMaterial({ color: COLORS.GUN });
        this.gun = new THREE.Mesh(gunGeometry, gunMaterial);
        
        // Initial holstered position (on the right side, pointing down)
        this.gun.position.set(0.4, -0.2, 0);
        this.gun.rotation.set(Math.PI / 2, 0, 0); // Rotate to point down
        this.body.add(this.gun);
        
        // Group to handle transforms
        this.group = new THREE.Group();
        this.group.add(this.body);
        this.scene.add(this.group);
        
        // Set initial position
        this.group.position.set(0, 0, 5);
        this.position.copy(this.group.position);
        
        // Initialize animation variables
        this.jumpTime = Math.random() * 10; // Randomize jump animation phase
    }
    
    createHealthBar() {
        // Remove any previous DOM-based health bar
        if (this.healthBar && this.healthBar.parentNode) {
            this.healthBar.parentNode.removeChild(this.healthBar);
        }
        
        // Create 3D health bar above the player
        const barWidth = 0.4;
        const barHeight = 0.05;
        const barDepth = 0.05;
        
        // Create background bar (empty/black part)
        const bgGeometry = new THREE.BoxGeometry(barWidth, barHeight, barDepth);
        const bgMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
        this.healthBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
        
        // Create foreground bar (filled/colored part)
        const fgGeometry = new THREE.BoxGeometry(barWidth, barHeight, barDepth);
        const fgMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        this.healthBarFg = new THREE.Mesh(fgGeometry, fgMaterial);
        
        // Position the health bars slightly above the player
        const barY = 1.3; // Above player's head
        this.healthBarBg.position.set(0, barY, 0);
        this.healthBarFg.position.set(0, barY, 0);
        
        // Add bars to the player body so they move with the player
        this.body.add(this.healthBarBg);
        this.body.add(this.healthBarFg);
        
        // Initial scale of foreground bar (full health)
        this.updateHealthBar();
    }
    
    updateHealthBar() {
        if (!this.healthBarFg) return;
        
        const healthPercentage = this.currentHealth / this.maxHealth;
        
        // Scale the foreground bar based on current health
        // Only scale the x-axis to show decreasing bar from right to left
        this.healthBarFg.scale.x = healthPercentage;
        
        // Position the bar to align left edge with background bar
        // This ensures the bar decreases from right to left
        const offset = (1 - healthPercentage) * 0.5 * -0.4; // Half the difference, scaled by bar width
        this.healthBarFg.position.x = offset;
        
        // Change color based on health
        if (healthPercentage > 0.6) {
            this.healthBarFg.material.color.setHex(0x00ff00); // Green
        } else if (healthPercentage > 0.3) {
            this.healthBarFg.material.color.setHex(0xffff00); // Yellow
        } else {
            this.healthBarFg.material.color.setHex(0xff0000); // Red
        }
    }
    
    takeDamage(amount) {
        const now = Date.now();
        if (this.isInvulnerable && now - this.lastHitTime < this.invulnerabilityTime) {
            return; // Still invulnerable
        }
        
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        this.updateHealthBar();
        
        // Visual feedback
        this.body.material.color.setHex(0xff0000);
        setTimeout(() => {
            this.body.material.color.setHex(COLORS.PLAYER);
        }, 100);
        
        // Set invulnerability
        this.isInvulnerable = true;
        this.lastHitTime = now;
        
        // Check for death
        if (this.currentHealth <= 0) {
            this.die();
        }
    }
    
    die() {
        this.isDead = true; // Set isDead flag when player dies
        
        // Create a game over message
        const gameOverMsg = document.createElement('div');
        gameOverMsg.style.position = 'fixed';
        gameOverMsg.style.top = '50%';
        gameOverMsg.style.left = '50%';
        gameOverMsg.style.transform = 'translate(-50%, -50%)';
        gameOverMsg.style.color = 'red';
        gameOverMsg.style.fontSize = '64px';
        gameOverMsg.style.fontFamily = '"Press Start 2P", cursive';
        gameOverMsg.style.textShadow = '2px 2px 4px black';
        gameOverMsg.style.zIndex = '1000';
        gameOverMsg.textContent = 'GAME OVER';
        document.body.appendChild(gameOverMsg);
        
        // Create pixel art style restart button
        const restartBtn = document.createElement('button');
        restartBtn.textContent = 'RESTART GAME';
        restartBtn.style.position = 'fixed';
        restartBtn.style.top = '60%';
        restartBtn.style.left = '50%';
        restartBtn.style.transform = 'translate(-50%, -50%)';
        restartBtn.style.fontSize = '16px';
        restartBtn.style.padding = '16px 32px';
        restartBtn.style.backgroundColor = '#aa0000';  // Red base color
        restartBtn.style.color = '#ffffff';
        restartBtn.style.border = 'none';
        restartBtn.style.cursor = 'pointer';
        restartBtn.style.fontFamily = '"Press Start 2P", cursive';
        restartBtn.style.textTransform = 'uppercase';
        restartBtn.style.letterSpacing = '2px';
        restartBtn.style.imageRendering = 'pixelated';
        restartBtn.style.boxShadow = 'inset -4px -4px 0px 0px #660000';  // Darker red for shadow
        restartBtn.style.outline = 'none';
        
        // Create pixel art border
        restartBtn.style.border = '4px solid #ffffff';
        restartBtn.style.borderStyle = 'solid';
        restartBtn.style.borderWidth = '4px';
        restartBtn.style.borderLeftColor = '#ffffff';
        restartBtn.style.borderTopColor = '#ffffff';
        restartBtn.style.borderRightColor = '#888888';
        restartBtn.style.borderBottomColor = '#888888';
        
        // Add hover and active states
        restartBtn.onmouseover = () => {
            restartBtn.style.backgroundColor = '#cc0000';  // Lighter red on hover
            restartBtn.style.boxShadow = 'inset -4px -4px 0px 0px #880000';
        };
        
        restartBtn.onmouseout = () => {
            restartBtn.style.backgroundColor = '#aa0000';  // Back to base red
            restartBtn.style.boxShadow = 'inset -4px -4px 0px 0px #660000';
            restartBtn.style.transform = 'translate(-50%, -50%)';
            restartBtn.style.borderLeftColor = '#ffffff';
            restartBtn.style.borderTopColor = '#ffffff';
            restartBtn.style.borderRightColor = '#888888';
            restartBtn.style.borderBottomColor = '#888888';
        };
        
        restartBtn.onmousedown = () => {
            restartBtn.style.transform = 'translate(-48%, -48%)';  // Slight offset for press effect
            restartBtn.style.backgroundColor = '#880000';  // Darker red when pressed
            restartBtn.style.boxShadow = 'inset -2px -2px 0px 0px #440000';
            restartBtn.style.borderLeftColor = '#888888';
            restartBtn.style.borderTopColor = '#888888';
            restartBtn.style.borderRightColor = '#ffffff';
            restartBtn.style.borderBottomColor = '#ffffff';
        };
        
        restartBtn.onmouseup = () => {
            restartBtn.style.transform = 'translate(-50%, -50%)';
            restartBtn.style.backgroundColor = '#aa0000';
            restartBtn.style.boxShadow = 'inset -4px -4px 0px 0px #660000';
            restartBtn.style.borderLeftColor = '#ffffff';
            restartBtn.style.borderTopColor = '#ffffff';
            restartBtn.style.borderRightColor = '#888888';
            restartBtn.style.borderBottomColor = '#888888';
        };
        
        // Add button shadow element
        const buttonShadow = document.createElement('div');
        buttonShadow.style.position = 'fixed';
        buttonShadow.style.top = '61%';  // Slightly offset from button
        buttonShadow.style.left = '50.5%';  // Slightly offset from button
        buttonShadow.style.transform = 'translate(-50%, -50%)';
        buttonShadow.style.width = restartBtn.offsetWidth + 'px';
        buttonShadow.style.height = restartBtn.offsetHeight + 'px';
        buttonShadow.style.backgroundColor = '#000000';
        buttonShadow.style.zIndex = '999';  // Below the button
        document.body.appendChild(buttonShadow);
        
        // Add click handler
        restartBtn.onclick = async () => {
            try {
                // Make sure audio context is running
                await Tone.start();
                
                // Play descending notes before reload
                const synth = new Tone.Synth({
                    oscillator: { type: "square" },
                    envelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.2 }
                }).toDestination();
                
                synth.volume.value = -15;
                synth.triggerAttackRelease("C4", "8n");
                setTimeout(() => synth.triggerAttackRelease("G3", "8n"), 150);
                setTimeout(() => synth.triggerAttackRelease("C3", "8n"), 300);
                
                // Fade out and reload
                gameOverMsg.style.transition = 'opacity 0.5s';
                restartBtn.style.transition = 'opacity 0.5s';
                buttonShadow.style.transition = 'opacity 0.5s';
                
                gameOverMsg.style.opacity = '0';
                restartBtn.style.opacity = '0';
                buttonShadow.style.opacity = '0';
                
                // Make sure to reload after the sound and animation finish
                setTimeout(() => {
                    window.location.href = window.location.href;
                }, 800);
            } catch (error) {
                console.error("Error during restart:", error);
                // Fallback: just reload if there's an error
                window.location.reload();
            }
        };
        
        document.body.appendChild(restartBtn);
    }
    
    update(dt, inputHandler, raycaster, camera) {
        // If player is dead, don't process any updates
        if (this.isDead) return;

        // First handle rotation (so movement follows the current rotation)
        this.handleRotation(inputHandler, camera);
        // Then handle movement
        this.handleMovement(inputHandler, dt);
        this.handleShooting(inputHandler, raycaster, camera);
        this.updateAnimation(dt);
        this.updateGunAnimation(dt); // Add gun animation update
    }
    
    handleMovement(inputHandler, dt) {
        // If player is dead or controls disabled, don't process movement
        if (this.isDead || !this.controlsEnabled) {
            // Reset velocity and movement flags when controls disabled
            this.velocity.set(0, 0, 0);
            this.recoilVelocity.set(0, 0, 0); // Reset recoil velocity too
            this.isMoving = false;
            this.movementIntensity = 0;
            return;
        }

        // Reset movement velocity (but keep recoil velocity)
        this.velocity.set(0, 0, 0);
        
        // Fixed movement directions in world space (regardless of rotation)
        const up = new THREE.Vector3(0, 0, -1); // W key - always up (north)
        const down = new THREE.Vector3(0, 0, 1); // S key - always down (south)
        const right = new THREE.Vector3(1, 0, 0); // D key - always right (east)
        const left = new THREE.Vector3(-1, 0, 0); // A key - always left (west)
        
        // Apply input to velocity using fixed directions
        if (inputHandler.keys.up) this.velocity.add(up);
        if (inputHandler.keys.down) this.velocity.add(down);
        if (inputHandler.keys.right) this.velocity.add(right);
        if (inputHandler.keys.left) this.velocity.add(left);
        
        // Normalize velocity for consistent speed in all directions
        if (this.velocity.length() > 0) {
            // Calculate normalized movement intensity (0-1)
            this.movementIntensity = this.velocity.length();
            
            // Normalize direction vector
            this.velocity.normalize();
            
            // Apply consistent speed using units-per-second (multiplied by delta time)
            this.velocity.multiplyScalar(GAME.SPEEDS.PLAYER * dt * this.movementPenalty);
            this.isMoving = true;
        } else {
            this.isMoving = false;
            this.movementIntensity = 0;
        }

        // Apply both movement and recoil velocities
        const totalVelocity = this.velocity.clone().add(this.recoilVelocity);
        this.group.position.add(totalVelocity);
        
        // Decay recoil velocit3
        this.recoilVelocity.multiplyScalar(0.3); // Reduce recoil by 10% each frame
        
        // Constrain to arena
        const halfSize = GAME.ARENA_SIZE / 2;
        this.group.position.x = Math.max(-halfSize, Math.min(halfSize, this.group.position.x));
        this.group.position.z = Math.max(-halfSize, Math.min(halfSize, this.group.position.z));
        
        // Update position for collision detection
        this.position.copy(this.group.position);
    }
    
    handleRotation(inputHandler, camera) {
        // If player is dead or controls disabled, don't process rotation
        if (this.isDead || !this.controlsEnabled) return;

        try {
            // Get the mouse position in normalized device coordinates (-1 to +1)
            const mouse = new THREE.Vector2(
                inputHandler.mouse.x,
                inputHandler.mouse.y
            );
            
            // Create a raycaster from the camera position and mouse position
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            // Create a horizontal plane at the player's height
            const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
            
            // Find where the ray intersects the ground plane
            const intersectionPoint = new THREE.Vector3();
            raycaster.ray.intersectPlane(groundPlane, intersectionPoint);
            
            // If intersection found, calculate direction to look at
            if (intersectionPoint) {
                // Calculate direction from player to intersection point
                const direction = new THREE.Vector3().subVectors(intersectionPoint, this.group.position).normalize();
                this.lastMouseIntersection.copy(intersectionPoint); // Update the last intersection point
                
                // Calculate angle to face the target
                this.rotation = Math.atan2(direction.x, direction.z);
                
                // Apply rotation to the group - this rotates the entire player including feet
                this.group.rotation.y = this.rotation;
            }
        } catch (e) {
            console.error("Error in player rotation:", e);
        }
    }
    
    handleShooting(inputHandler, raycaster, camera) {
        // If player is dead or controls disabled, don't process shooting
        if (this.isDead || !this.controlsEnabled) return;

        const now = Date.now();
        
        // Check if player is shooting
        if (inputHandler.keys.shoot) {
            // Start drawing the gun if it's holstered
            if (this.isGunHolstered) {
                this.isGunHolstered = false;
            }
            
            // Check if enough time has passed since last shot
            if (now - this.lastShotTime > this.fireRate) {
                if (!this.isReloading && this.ammo > 0) {
                    this.shoot();
                    this.lastShotTime = now;
                } else if (!this.isReloading) {
                    // Play dry fire sound when out of ammo - higher pitch for distinctive click
                    this.audioManager.playSound('DRY_FIRE', 'F6');
                    this.lastShotTime = now;
                }
            }
        } else if (!inputHandler.keys.shoot && !this.isGunHolstered && this.gunDrawProgress >= 1) {
            // Holster the gun when not shooting and gun is fully drawn
            this.isGunHolstered = true;
        }
        
        // Handle grenade throwing
        if (inputHandler.keys.grenade && this.grenades > 0) {
            // Check cooldown
            if (now - this.lastGrenadeTime > this.grenadeRate) {
                // Don't actually throw the grenade here, just signal that we can throw
                // Let the main game class handle the actual throwing via right-click
                inputHandler.keys.grenade = false; // Reset to prevent multiple throws
            }
        }
    }
    
    shoot() {
        // Decrease ammo
        this.ammo--;
        
        // Play gunshot sound
        this.audioManager.playGunshot();
        
        // Apply recoil animation and movement
        this.body.scale.z = 0.8;
        
        // Add backward recoil force
        const recoilForce = 0.3; // Increased recoil force
        const backwardDirection = this.getDirection().clone().negate();
        this.recoilVelocity.add(backwardDirection.multiplyScalar(recoilForce));
        
        // Reset scale after recoil
        setTimeout(() => {
            this.body.scale.z = 1;
        }, 50);
        
        // Add dramatic muzzle flash
        this.createMuzzleFlash();
    }
    
    // Methods for machine gun fire
    playShootSound() {
        // Add slight pitch variation for each shot to make it sound more natural
        const pitchVariation = 1.0 + (Math.random() - 0.5) * 0.2; // Random pitch between 0.9 and 1.1
        this.audioManager.playGunshot(pitchVariation);
        
        // Apply recoil animation and movement
        this.body.scale.z = 0.85;
        
        // Add backward recoil force (slightly weaker for machine gun)
        const recoilForce = 0.2; // Increased recoil force for machine gun
        const backwardDirection = this.getDirection().clone().negate();
        this.recoilVelocity.add(backwardDirection.multiplyScalar(recoilForce));
        
        // Reset scale after recoil
        setTimeout(() => {
            this.body.scale.z = 1;
        }, 30); // Faster recoil recovery for machine gun
    }
    
    showMuzzleFlash() {
        this.createMuzzleFlash();
    }
    
    createMuzzleFlash() {
        // Get the position for the muzzle flash (in front of the player)
        const flashPosition = this.getPosition().clone();
        flashPosition.y = SIZES.PLAYER; // Set to player height
        
        // Add the direction offset
        const direction = this.getDirection();
        const offset = direction.clone().multiplyScalar(SIZES.PLAYER + 0.3);
        flashPosition.add(offset);
        
        // Create a bright flash cube instead of sphere
        const flashGeometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(flashPosition);
        // Rotate the cube to match player's rotation
        flash.rotation.y = this.rotation;
        this.scene.add(flash);
        
        // Add intense point light
        const light = new THREE.PointLight(0xffff00, 5, 3);
        light.position.copy(flashPosition);
        this.scene.add(light);
        
        // Animate and remove the flash
        let opacity = 1.0;
        let scale = 1.0;
        
        const animateFlash = () => {
            opacity -= 0.2;
            scale += 0.2;
            
            if (opacity <= 0) {
                this.scene.remove(flash);
                this.scene.remove(light);
                flashMaterial.dispose();
                flashGeometry.dispose();
                return;
            }
            
            flashMaterial.opacity = opacity;
            flash.scale.set(scale, scale, scale);
            light.intensity = opacity * 5;
            
            requestAnimationFrame(animateFlash);
        };
        
        // Start animation
        animateFlash();
    }
    
    reload() {
        this.isReloading = true;
        this.audioManager.playReload();
        
        // Reload animation - scale y down
        this.body.scale.y = 0.7;
        
        // Reload timer
        setTimeout(() => {
            this.ammo = GAME.AMMO_COUNT;
            this.isReloading = false;
            this.body.scale.y = 1;
        }, GAME.RELOAD_TIME);
    }
    
    addAmmo(amount) {
        this.ammo = Math.min(this.maxAmmo, this.ammo + amount);
        this.audioManager.playPickup('ammo');
    }
    
    addEnergy(amount) {
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
        this.updateHealthBar();
        this.audioManager.playPickup('health');
    }
    
    addGrenades(amount) {
        this.grenades = Math.min(this.maxGrenades, this.grenades + amount);
        this.audioManager.playPickup('grenade');
    }
    
    throwGrenade() {
        if (this.isReloading || this.grenades <= 0) {
            console.log("Can't throw grenade:", this.isReloading ? "reloading" : "no grenades left");
            return false;
        }
        
        console.log("Throwing grenade, count before:", this.grenades);
        
        // Reduce grenade count
        this.grenades--;
        
        console.log("Grenade count after:", this.grenades);
        
        // Set the last grenade time to current time
        this.lastGrenadeTime = Date.now();
        
        // Apply throw animation
        this.body.scale.x = 1.2;
        setTimeout(() => {
            this.body.scale.x = 1;
        }, 100);
        
        return true;
    }
    
    updateAnimation(dt) {
        if (this.isMoving) {
            // Update bouncing animation (similar to enemies)
            this.updateBouncingAnimation(dt);
            
            // Play footstep sounds synced with animation
            this.updateFootstepSounds(dt);
        } else {
            // Reset position when not moving
            this.resetAnimationState();
        }
    }
    
    // New method for bouncing animation similar to enemies
    updateBouncingAnimation(dt) {
        // Reduce animation speed to match enemies (GAME.STEP_FREQUENCY / 3)
        this.jumpTime += dt * (GAME.STEP_FREQUENCY);
        
        // Create a stepping cycle with sin - multiplied for pronounced bouncing
        const stepCycle = Math.sin(this.jumpTime * Math.PI);
        
        // Exaggerated up and down movement
        const baseHeight = SIZES.PLAYER / 2;
        const jumpHeight = Math.abs(stepCycle) * 0.25;
        this.body.position.y = baseHeight + jumpHeight;
        
        // Exaggerated squash and stretch
        const squashFactor = 0.3;
        this.body.scale.y = 1 - jumpHeight * squashFactor * 3.5;
        this.body.scale.x = 1 + jumpHeight * squashFactor;
        this.body.scale.z = 1 + jumpHeight * squashFactor * 0.5;
        
        // Lean in the direction of movement independent of facing direction
        const leanAmount = 0.15;
        if (this.velocity.x !== 0 || this.velocity.z !== 0) {
            const movementDirection = this.velocity.clone().normalize();
            this.body.rotation.z = movementDirection.x * leanAmount;
            this.body.rotation.x = -movementDirection.z * leanAmount;
        }
    }
    
    resetAnimationState() {
        // Reset all animations when not moving
        this.body.position.y = SIZES.PLAYER / 2;
        this.body.scale.set(1, 1, 1);
        this.body.rotation.x = 0;
        this.body.rotation.z = 0;
        
        // Slowly reset step time when not moving
        this.stepTime = 0;
    }
    
    getPosition() {
        return this.position;
    }
    
    getDirection() {
        // Return a normalized direction vector based on player rotation
        return new THREE.Vector3(
            Math.sin(this.rotation),
            0,
            Math.cos(this.rotation)
        );
    }
    
    getBoundingRadius() {
        return SIZES.PLAYER * 0.5;
    }
    
    getMouseWorldPosition() {
        return this.lastMouseIntersection.clone();
    }
    
    updateGunAnimation(dt) {
        // Update gun drawing/holstering animation
        if (this.isGunHolstered) {
            // Animate towards holstered position
            this.gunDrawProgress = Math.max(0, this.gunDrawProgress - this.gunHolsterSpeed);
        } else {
            // Animate towards drawn position
            this.gunDrawProgress = Math.min(1, this.gunDrawProgress + this.gunDrawSpeed);
        }

        // Calculate interpolated position and rotation
        const holsteredPos = new THREE.Vector3(0.4, -0.2, 0);
        const drawnPos = new THREE.Vector3(0, 0.1, SIZES.PLAYER / 2 + SIZES.GUN.DEPTH * 1.75);
        
        const holsteredRot = new THREE.Euler(Math.PI / 2, 0, 0); // Point down when holstered
        const drawnRot = new THREE.Euler(0, 0, 0); // Point forward when drawn

        // Interpolate position and rotation
        this.gun.position.lerpVectors(holsteredPos, drawnPos, this.gunDrawProgress);
        this.gun.rotation.x = THREE.MathUtils.lerp(holsteredRot.x, drawnRot.x, this.gunDrawProgress);
        this.gun.rotation.y = THREE.MathUtils.lerp(holsteredRot.y, drawnRot.y, this.gunDrawProgress);
        this.gun.rotation.z = THREE.MathUtils.lerp(holsteredRot.z, drawnRot.z, this.gunDrawProgress);
    }
    
    // New method to check if player is out of ammo (for spawn manager)
    isOutOfAmmo() {
        return this.ammo <= 0;
    }
    
    // Add footstep sound method
    updateFootstepSounds(dt) {
        // Only play footstep sounds if we have an audio manager
        if (!this.audioManager) return;
        
        // Get step cycle position (0-1)
        const stepCyclePosition = (this.jumpTime * Math.PI) % (2 * Math.PI);
        
        // Play footstep sound at the bottom of the step cycle (when foot hits ground)
        // This happens twice per full cycle, at ~PI/2 and ~3PI/2
        if ((Math.abs(stepCyclePosition - Math.PI/2) < 0.15) || 
            (Math.abs(stepCyclePosition - 3*Math.PI/2) < 0.15)) {
            
            // Pass movement intensity to control volume/speed
            this.audioManager.playFootstep(this.movementIntensity);
        }
    }
} 