import * as THREE from 'three';
import { COLORS, SIZES, GAME } from '../utils/constants.js';
import { Bullet, OptimizedBullet, BossBullet } from './projectiles.js';

export class Enemy {
    constructor(scene, position, type = 'REGULAR', spawnManager = null) {
        this.scene = scene;
        this.position = position.clone();
        this.type = type;
        this.isActive = true;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.speed = this.getSpeedByType();
        this.health = this.getHealthByType();
        this.jumpTime = Math.random() * 10; // Randomize jump animation phase
        this.spawnManager = spawnManager;
        this.attachedBullets = []; // Track attached paintballs
        this.isDying = false; // Flag for dying animation
        this.deathTime = 0; // Timer for death animation
        this.hitEffects = []; // Store hit effects for animation
        this.audioManager = spawnManager.audioManager; // Get audio manager from spawn manager
        
        // Generate a unique ID for this enemy (for sound variety)
        this.enemyId = Math.floor(Math.random() * 1000000);
        
        // Blown away state for grenades
        this.isBlownAway = false;
        this.blownAwayVelocity = new THREE.Vector3(0, 0, 0);
        this.blownAwayRotation = new THREE.Vector3(0, 0, 0);
        this.gravity = 9.8; // Gravity for physics
        
        // Shooting properties
        this.lastShotTime = 0;
        this.shootingCooldown = this.getShootingCooldownByType();
        this.shootingRange = 15; // Units to start shooting from
        
        this.createEnemyMesh();
    }
    
    getHealthByType() {
        switch(this.type) {
            case 'CHUBBY': return 3;
            case 'THIN': return 1;
            default: return 2; // REGULAR
        }
    }
    
    getSizeByType() {
        switch(this.type) {
            case 'CHUBBY': return SIZES.ENEMIES.CHUBBY;
            case 'THIN': return SIZES.ENEMIES.THIN;
            default: return SIZES.ENEMIES.REGULAR;
        }
    }
    
    getColorByType() {
        switch(this.type) {
            case 'CHUBBY': return COLORS.ENEMY.CHUBBY;
            case 'THIN': return COLORS.ENEMY.THIN;
            default: return COLORS.ENEMY.REGULAR;
        }
    }
    
    getSpeedByType() {
        switch(this.type) {
            case 'CHUBBY': 
                return GAME.SPEEDS.ENEMY.CHUBBY;
            case 'THIN': 
                return GAME.SPEEDS.ENEMY.THIN;
            default: // REGULAR
                return GAME.SPEEDS.ENEMY.REGULAR;
        }
    }
    
    getShootingCooldownByType() {
        switch(this.type) {
            case 'CHUBBY': return 5000; // 5 seconds between shots
            case 'THIN': return 4000; // 4 seconds between shots
            default: return 3000; // 3 seconds between shots for regular enemies
        }
    }
    
    createEnemyMesh() {
        const size = this.getSizeByType();
        // Create a rectangular box instead of a cube
        const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);  // width, height, depth
        const material = new THREE.MeshBasicMaterial({ color: this.getColorByType() });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        
        // Add character through varied shapes based on enemy type
        switch(this.type) {
            case 'BOSS':
                // Boss is much larger than regular enemies
                this.mesh.scale.set(3, 3, 3);
                break;
            case 'CHUBBY':
                // Wider, shorter enemy
                this.mesh.scale.set(1.5, 0.8, 1.5);
                break;
            case 'THIN':
                // Taller, thinner enemy
                this.mesh.scale.set(0.6, 1.6, 0.6);
                break;
            default: // REGULAR
                // Slightly random variations for regular enemies
                const xzScale = 0.8 + Math.random() * 0.4; // 0.8 to 1.2
                const yScale = 0.9 + Math.random() * 0.4;  // 0.9 to 1.3
                this.mesh.scale.set(xzScale, yScale, xzScale);
        }
        
        // Create the gun with the same style as player's - a rectangle with 2 equal sides and 1 long side
        const gunWidth = SIZES.GUN.WIDTH * 0.8;  // Make width slightly smaller
        const gunHeight = gunWidth;              // Make height equal to width for square profile
        const gunLength = SIZES.GUN.DEPTH * 2.5; // Slightly shorter than player's gun
        
        const gunGeometry = new THREE.BoxGeometry(
            gunWidth,  // X dimension (width) - smaller square profile
            gunHeight, // Y dimension (height) - equal to width for square profile
            gunLength  // Z dimension (length) - longer rectangle pointing forward
        );
        const gunMaterial = new THREE.MeshBasicMaterial({ color: COLORS.GUN });
        this.gun = new THREE.Mesh(gunGeometry, gunMaterial);
        
        // Position the gun to point forward
        // Center the gun at the enemy's "chest" height
        this.gun.position.set(0, 0.1, SIZES.PLAYER / 2 + gunLength / 2);
        this.mesh.add(this.gun);
        
        // Position half height above ground (since height is 1)
        // Original y position is the center of the mesh, so we need to offset it
        this.mesh.position.y = 0.5;
        this.scene.add(this.mesh);
    }
    
    update(dt, playerPosition) {
        if (!this.isActive) return;
        
        // If enemy is in dying animation
        if (this.isDying) {
            this.updateDeathAnimation(dt);
            return;
        }
        
        // If enemy is blown away by explosion
        if (this.isBlownAway) {
            this.updateBlownAwayAnimation(dt);
            return;
        }
        
        if (!playerPosition) {
            console.error("Enemy update called without player position!");
            return;
        }
        
        // Calculate direction to player
        const directionToPlayer = new THREE.Vector3()
            .subVectors(playerPosition, this.position)
            .normalize();
        
        // Calculate distance to player
        const distanceToPlayer = this.position.distanceTo(playerPosition);
        
        // Try to shoot if within range
        if (distanceToPlayer <= this.shootingRange) {
            this.tryShoot(directionToPlayer);
        }
        
        // Define the optimal shooting distance based on enemy type
        const optimalShootingDistance = this.getOptimalShootingDistance();
        
        // Get the movement direction based on type and distance
        let finalDirection = this.getMovementBehavior(directionToPlayer, playerPosition, distanceToPlayer, optimalShootingDistance);
        
        // Apply movement with type-specific speed from GAME.SPEEDS.ENEMY values
        // Use pure delta time for consistent movement across hardware
        this.velocity.copy(finalDirection).multiplyScalar(this.speed * dt);
        this.mesh.position.add(this.velocity);
        
        // Update position for collision detection, but keep proper y value for rendering
        this.position.x = this.mesh.position.x;
        this.position.z = this.mesh.position.z;
        // Keep y at 0 for collision calculations, but mesh position is at correct height
        
        // Update animation
        this.updateAnimation(dt);
        
        // Always face the player
        const angleToPlayer = Math.atan2(
            playerPosition.x - this.position.x,
            playerPosition.z - this.position.z
        );
        
        // Keep the y rotation to face player, since x and z rotation are used for leaning
        this.mesh.rotation.y = angleToPlayer;
        
        // Update attached bullets positions
        this.updateAttachedBullets();
    }
    
    // Method to get optimal shooting distance based on enemy type
    getOptimalShootingDistance() {
        switch(this.type) {
            case 'CHUBBY':
                return 3
                ; // Chubby enemies prefer to be closer (was 8)
            case 'THIN':
                return 3; // Thin enemies prefer to stay further away (was 12)
            default: // REGULAR
                return 3; // Regular enemies maintain a medium distance (was 10)
        }
    }
    
    getMovementBehavior(directionToPlayer, playerPosition, distanceToPlayer, optimalDistance) {
        // Calculate movement direction based on the distance to player
        let finalDirection;
        
        // Determine if we should move towards or away from player based on distance
        if (distanceToPlayer < optimalDistance - 1) {
            // Too close - move away from player
            finalDirection = directionToPlayer.clone().negate(); // Reverse direction
        } 
        else if (distanceToPlayer > optimalDistance + 3) {
            // Too far - move towards player
            finalDirection = directionToPlayer.clone();
        }
        else {
            // In optimal shooting range - strafe around player
            // Create a perpendicular direction to circle around the player
            finalDirection = new THREE.Vector3(
                directionToPlayer.z, 
                0, 
                -directionToPlayer.x
            );
            
            // Randomly change strafe direction sometimes
            if (Math.random() < 0.01) { // 1% chance per frame to change strafe direction
                finalDirection.negate();
            }
        }
                
        // Add type-specific behaviors and randomness
        switch(this.type) {
            case 'CHUBBY':
                // Chubby enemies are more direct with minimal randomness
                finalDirection.add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.05,
                    0,
                    (Math.random() - 0.5) * 0.05
                ));
                break;
                
            case 'THIN':
                // Thin enemies are more erratic but still maintain distance
                finalDirection.add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.15,
                    0,
                    (Math.random() - 0.5) * 0.15
                ));
                
                // Thin enemies have more pronounced strafing behavior
                if (distanceToPlayer > optimalDistance - 2 && distanceToPlayer < optimalDistance + 2) {
                    // Add more strafing component
                    const strafeVector = new THREE.Vector3(
                        directionToPlayer.z, 
                        0, 
                        -directionToPlayer.x
                    );
                    finalDirection.add(strafeVector.multiplyScalar(0.5));
                }
                break;
                
            default: // REGULAR
                // Regular enemies have moderate randomness
                finalDirection.add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1,
                    0,
                    (Math.random() - 0.5) * 0.1
                ));
        }
        
        return finalDirection.normalize();
    }
    
    updateAnimation(dt) {
        const size = this.getSizeByType();
        
        // Calculate movement intensity (0-1) based on current velocity
        const movementIntensity = Math.min(1.0, this.velocity.length() / (this.speed * dt));
        
        // Adjust animation speed based on movement intensity
        // Faster movement = faster animation
        const animationSpeed = (GAME.STEP_FREQUENCY / 3 * (0.2 + movementIntensity * 0.8)) * 2; // Doubled the speed
        this.jumpTime += dt * animationSpeed;
        
        // Create a stepping cycle with sin - multiplied for more pronounced steps
        const stepCycle = Math.sin(this.jumpTime * Math.PI);
        
        // Exaggerated up and down movement - scale with movement intensity
        const baseJumpHeight = 0.45; // Base jump height
        const jumpHeight = Math.abs(stepCycle) * baseJumpHeight * movementIntensity;
        this.mesh.position.y = size / 2 + jumpHeight;
        
        // Exaggerated squash and stretch - scale with movement intensity
        const baseSquashFactor = 0.5;
        const squashFactor = baseSquashFactor * movementIntensity;
        this.mesh.scale.y = (this.type === 'THIN' ? 1.6 : (this.type === 'CHUBBY' ? 0.8 : (this.type === 'BOSS' ? 3 : 1))) * (1 - jumpHeight * squashFactor);
        this.mesh.scale.x = (this.type === 'THIN' ? 0.6 : (this.type === 'CHUBBY' ? 1.5 : (this.type === 'BOSS' ? 3 : 1))) * (1 + jumpHeight * squashFactor * 0.5);
        this.mesh.scale.z = (this.type === 'THIN' ? 0.6 : (this.type === 'CHUBBY' ? 1.5 : (this.type === 'BOSS' ? 3 : 1))) * (1 + jumpHeight * squashFactor * 0.5);
        
        // Add a slight lean in the direction of movement
        if (this.velocity.x !== 0 || this.velocity.z !== 0) {
            const movementDirection = this.velocity.clone().normalize();
            const leanAmount = 0.15 * movementIntensity; // Scale lean with movement intensity
            this.mesh.rotation.z = -movementDirection.x * leanAmount;
            this.mesh.rotation.x = movementDirection.z * leanAmount;
        }
    }
    
    updateAttachedBullets() {
        // Update position of all attached bullets
        this.attachedBullets.forEach(bulletInfo => {
            // Skip decals as they don't need position updates
            if (bulletInfo.isDecal) return;
            
            if (bulletInfo.bullet && bulletInfo.bullet.mesh) {
                // Apply the enemy's position plus the relative offset
                bulletInfo.bullet.mesh.position.copy(this.mesh.position).add(bulletInfo.offset);
                // Apply the enemy's rotation
                bulletInfo.bullet.mesh.rotation.y = this.mesh.rotation.y;
            }
        });
    }
    
    attachBullet(bullet) {
        // Generate random offset on enemy's body that takes into account the enemy's shape
        const size = this.getSizeByType();
        const scaleX = this.mesh.scale.x;
        const scaleY = this.mesh.scale.y;
        const scaleZ = this.mesh.scale.z;
        
        // Scale the offsets by the enemy's dimensions
        const randomOffset = new THREE.Vector3(
            (Math.random() - 0.5) * size * scaleX * 0.8,  // Scale X offset by enemy width
            (Math.random() - 0.5) * size * scaleY * 0.8 + size * scaleY * 0.5,  // Scale Y offset by enemy height
            (Math.random() - 0.5) * size * scaleZ * 0.8   // Scale Z offset by enemy depth
        );
        
        // For OptimizedBullet, we don't need the bullet mesh to be visible
        // Instead we'll create a decal effect directly on the enemy
        if (bullet.constructor.name === "OptimizedBullet" && bullet.decalManager) {
            // Create a local hit position for the decal
            const hitPosition = this.mesh.position.clone().add(randomOffset);
            
            // Create a local normal (pointing away from the center of the enemy)
            const normal = randomOffset.clone().normalize();
            
            // Create the impact decal at the hit position
            bullet.createImpactDecal(hitPosition, normal, this);
            
            // We still need to count this as an attached bullet for the enemy logic
            // even though visually it's a decal
            this.attachedBullets.push({
                isDecal: true,
                offset: randomOffset
            });
        } else {
            // Regular bullet - store the bullet and its relative position
            this.attachedBullets.push({
                bullet: bullet,
                offset: randomOffset
            });
            
            // Make bullet look like it's embedded in the enemy - more cube-like but still visible
            const bulletScale = new THREE.Vector3(1.5, 1.5, 1.5); // More cube-like shape
            
            // Only try to set rotation and position if the bullet has a mesh
            if (bullet.mesh) {
                // Add a slight random rotation for variety
                bullet.mesh.rotation.set(
                    Math.random() * Math.PI * 0.5,
                    Math.random() * Math.PI * 2,
                    Math.random() * Math.PI * 0.5
                );
                bullet.mesh.scale.copy(bulletScale);
                
                // Update the bullet's position to match the attachment point
                bullet.mesh.position.copy(this.mesh.position).add(randomOffset);
            }
            
            // Notify bullet that it's attached
            bullet.attachToEnemy(this);
        }
        
        // Create impact effect
        this.createBulletImpactEffect(randomOffset);
        
        // Reduce health
        this.takeDamage(1, false); // Don't die yet, just track damage
        
        return this.attachedBullets.length;
    }
    
    createBulletImpactEffect(hitOffset) {
        // Create splash effect geometry
        const splashGeometry = new THREE.SphereGeometry(0.4, 8, 8);
        const splashMaterial = new THREE.MeshBasicMaterial({
            color: COLORS.BULLET,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending // Make it glow
        });
        
        const splash = new THREE.Mesh(splashGeometry, splashMaterial);
        splash.position.copy(this.mesh.position).add(hitOffset);
        this.scene.add(splash);
        
        // Add a point light for glow effect
        const light = new THREE.PointLight(COLORS.BULLET, 2, 1.5);
        light.position.copy(splash.position);
        this.scene.add(light);
        
        // Store for animation
        const startTime = Date.now();
        this.hitEffects.push({ splash, light, startTime });
        
        // Animate and remove
        const animateSplash = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > 0.4 || !this.isActive) {
                this.scene.remove(splash);
                this.scene.remove(light);
                splashGeometry.dispose();
                splashMaterial.dispose();
                this.hitEffects = this.hitEffects.filter(effect => effect.splash !== splash);
                return;
            }
            
            // Expand and fade
            const scale = 1.0 + elapsed * 4;
            splash.scale.set(scale, scale * 0.3, scale);
            splashMaterial.opacity = 1.0 - (elapsed / 0.4);
            light.intensity = (1.0 - (elapsed / 0.4)) * 2;
            
            requestAnimationFrame(animateSplash);
        };
        
        animateSplash();
    }
    
    takeDamage(amount, canDie = true) {
        this.health -= amount;
        
        // Visual feedback for hit (flash)
        this.mesh.scale.set(1.3, 0.7, 1.3);
        
        // Color flash (brighter)
        if (this.mesh.material) {
            const originalColor = this.getColorByType();
            this.mesh.material.color.setHex(0xffffff);
            
            setTimeout(() => {
                if (this.isActive && this.mesh.material) {
                    this.mesh.material.color.setHex(originalColor);
                }
            }, 120);
        }
        
        setTimeout(() => {
            if (this.isActive && !this.isDying) {
                // Reset to type-specific scaling
                const baseScale = this.type === 'THIN' ? 0.6 : (this.type === 'CHUBBY' ? 1.5 : 1);
                const baseYScale = this.type === 'THIN' ? 1.6 : (this.type === 'CHUBBY' ? 0.8 : 1);
                this.mesh.scale.set(baseScale, baseYScale, baseScale);
            }
        }, 100);
        
        // Check if enemy should die
        if (canDie && this.health <= 0) {
            if (this.attachedBullets.length >= 3) {
                // Start dying animation if we have 3+ paintballs
                this.startDyingAnimation();
            } else {
                // Otherwise die immediately
                this.die();
            }
        }
    }
    
    startDyingAnimation() {
        this.isDying = true;
        this.deathTime = 0;
        
        // Play death sound immediately for direct feedback
        if (this.audioManager) {
            this.audioManager.playEnemyDeath(this.enemyId);
        }
        
        // Stop current movement
        this.velocity.set(0, 0, 0);
        
        // Flash enemy white
        if (this.mesh.material) {
            this.mesh.material.color.setHex(0xffffff);
        }
        
        // Create explosion of paint particles
        this.createPaintExplosion();
        
        // Create a quick explosion effect
        const enemyColor = this.getColorByType();
        const enemySize = this.getSizeByType() * 1.5; // Slightly larger than enemy
        
        // Create explosion sphere
        const explosionGeometry = new THREE.SphereGeometry(enemySize, 12, 12);
        const explosionMaterial = new THREE.MeshBasicMaterial({
            color: enemyColor,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending // Make it glow
        });
        
        const explosion = new THREE.Mesh(explosionGeometry, explosionMaterial);
        explosion.position.copy(this.mesh.position);
        this.scene.add(explosion);
        
        // Add a point light for glow effect
        const light = new THREE.PointLight(enemyColor, 5, 3);
        light.position.copy(this.mesh.position);
        this.scene.add(light);
        
        // Quickly dispose of the enemy after a short delay
        setTimeout(() => {
            this.die();
            
            // Animate explosion
            let opacity = 1.0;
            let scale = 1.0;
            
            const animateExplosion = () => {
                opacity -= 0.05;
                scale += 0.15;
                
                if (opacity <= 0) {
                    this.scene.remove(explosion);
                    this.scene.remove(light);
                    explosionMaterial.dispose();
                    explosionGeometry.dispose();
                    return;
                }
                
                explosionMaterial.opacity = opacity;
                explosion.scale.set(scale, scale, scale);
                light.intensity = opacity * 5;
                
                requestAnimationFrame(animateExplosion);
            };
            
            // Start animation
            animateExplosion();
        }, 100); // Remove after a very short delay for the white flash
    }
    
    createPaintExplosion() {
        const particleCount = 20;
        const particles = [];
        const size = this.getSizeByType() * 0.3;
        const arenaHalfSize = GAME.ARENA_SIZE / 2;
        
        // Create paint particle geometries
        for (let i = 0; i < particleCount; i++) {
            const particleGeometry = new THREE.BoxGeometry(size, size, size);
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: COLORS.BULLET,
                transparent: true,
                opacity: 0.9
            });
            
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Position at enemy center
            particle.position.copy(this.mesh.position);
            
            // Random direction
            const angle = Math.random() * Math.PI * 2;
            const height = Math.random() * 1.0;
            const speed = 0.05 + Math.random() * 0.1;
            
            // Store velocity and other properties for animation
            particle.userData = {
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed,
                    height * speed * 2,
                    Math.sin(angle) * speed
                ),
                gravity: -0.005,
                lifetime: 1.0,
                age: 0,
                bounceCount: 0,
                elasticity: 0.7 + Math.random() * 0.2,
                maxBounces: Math.floor(Math.random() * 3) + 1
            };
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate particles
        const animateParticles = () => {
            if (!this.isDying || particles.length === 0) {
                // Clean up remaining particles if animation stopped
                particles.forEach(particle => {
                    this.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();
                });
                return;
            }
            
            particles.forEach((particle, index) => {
                // Update age
                particle.userData.age += 0.016; // Approx 60fps
                
                // Remove expired particles
                if (particle.userData.age >= particle.userData.lifetime) {
                    this.scene.remove(particle);
                    particle.geometry.dispose();
                    particle.material.dispose();
                    particles.splice(index, 1);
                    return;
                }
                
                // Update velocity with gravity
                particle.userData.velocity.y += particle.userData.gravity;
                
                // Move particle
                particle.position.add(particle.userData.velocity);
                
                // Wall collision checking
                // X-axis walls
                if (Math.abs(particle.position.x) > arenaHalfSize - 0.5) {
                    // Bounce off wall
                    particle.userData.velocity.x *= -particle.userData.elasticity;
                    particle.userData.bounceCount++;
                    
                    // Keep within bounds
                    if (particle.position.x > arenaHalfSize - 0.5) {
                        particle.position.x = arenaHalfSize - 0.5;
                    } else if (particle.position.x < -arenaHalfSize + 0.5) {
                        particle.position.x = -arenaHalfSize + 0.5;
                    }
                    
                    // Add some random variation after bounce
                    particle.userData.velocity.z += (Math.random() - 0.5) * 0.02;
                }
                
                // Z-axis walls
                if (Math.abs(particle.position.z) > arenaHalfSize - 0.5) {
                    // Bounce off wall
                    particle.userData.velocity.z *= -particle.userData.elasticity;
                    particle.userData.bounceCount++;
                    
                    // Keep within bounds
                    if (particle.position.z > arenaHalfSize - 0.5) {
                        particle.position.z = arenaHalfSize - 0.5;
                    } else if (particle.position.z < -arenaHalfSize + 0.5) {
                        particle.position.z = -arenaHalfSize + 0.5;
                    }
                    
                    // Add some random variation after bounce
                    particle.userData.velocity.x += (Math.random() - 0.5) * 0.02;
                }
                
                // Floor collision
                if (particle.position.y < 0.1) {
                    particle.position.y = 0.1;
                    particle.userData.velocity.y = Math.abs(particle.userData.velocity.y) * particle.userData.elasticity;
                    particle.userData.elasticity *= 0.8; // Reduce elasticity with each bounce
                    particle.userData.bounceCount++;
                    
                    // Slow horizontal movement on ground contact
                    particle.userData.velocity.x *= 0.9;
                    particle.userData.velocity.z *= 0.9;
                    
                    // Stop bouncing after a few bounces
                    if (particle.userData.bounceCount > particle.userData.maxBounces) {
                        particle.userData.velocity.y = 0;
                    }
                }
                
                // Fade out
                const remainingLife = 1 - (particle.userData.age / particle.userData.lifetime);
                particle.material.opacity = remainingLife * 0.9;
                
                // Spin
                particle.rotation.x += 0.05;
                particle.rotation.y += 0.05;
            });
            
            if (particles.length > 0) {
                requestAnimationFrame(animateParticles);
            }
        };
        
        animateParticles();
    }
    
    updateDeathAnimation(dt) {
        // This is now very simple - just wait for the timeout in startDyingAnimation to complete
        // Keep this method for compatibility, but it doesn't do much
        this.deathTime += dt;
    }
    
    die() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Notify spawn manager that enemy is defeated
        if (this.spawnManager) {
            this.spawnManager.enemyDefeated();
            
            // Create a ground splat where the enemy died
            if (this.spawnManager.decalManager) {
                // Position the splat at the enemy's position, but on the ground
                const splatPosition = new THREE.Vector3(
                    this.position.x,
                    0.02, // Just above ground
                    this.position.z
                );
                
                // Use the enemy's color for the splat
                const splatColor = this.getColorByType();
                
                // Size based on enemy type
                const splatSize = this.getSizeByType() * 1.2;
                
                // Create the ground splat
                this.spawnManager.decalManager.createGroundSplat(splatPosition, splatSize, splatColor);
            }
        }
        
        // Remove all attached bullets
        this.attachedBullets.forEach(bulletInfo => {
            if (bulletInfo.bullet) {
                bulletInfo.bullet.deactivate();
            }
        });
        
        // Remove the enemy mesh
        this.scene.remove(this.mesh);
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingRadius() {
        // Adjust bounding radius based on enemy shape
        const baseSize = this.getSizeByType();
        let scaleFactor;
        
        switch(this.type) {
            case 'BOSS':
                // Make boss much easier to hit by increasing collision radius
                scaleFactor = 2.0; // Increased from 1.0
                break;
            case 'CHUBBY':
                // Use the wider dimension for chubby enemies
                scaleFactor = 1.5;
                break;
            case 'THIN':
                // Increase collision radius for thin enemies to make them easier to hit
                scaleFactor = 1.5;
                break;
            default: // REGULAR
                // Use average dimension for regular enemies
                scaleFactor = 1.0;
        }
        
        // Increase the overall multiplier to make all enemies easier to hit
        const radius = baseSize * scaleFactor * 1.0;
        return radius;
    }
    
    tryShoot(direction) {
        const now = Date.now();
        
        // Check if cooldown has passed
        if (now - this.lastShotTime < this.shootingCooldown) {
            return;
        }
        
        // Get distance to player to make sure we're not too close
        const playerPosition = this.spawnManager && this.spawnManager.player ? 
            this.spawnManager.player.getPosition() : null;
        
        if (playerPosition) {
            const distanceToPlayer = this.position.distanceTo(playerPosition);
            const optimalDistance = this.getOptimalShootingDistance();
            
            // Only shoot if we're at a reasonable distance - not too close, not too far
            if (distanceToPlayer < optimalDistance * 0.5 || distanceToPlayer > this.shootingRange) {
                return; // Too close or too far to shoot effectively
            }
        }
        
        // 50% chance to shoot when cooldown is ready - adds unpredictability
        if (Math.random() < 0.5) {
            this.shoot(direction);
            this.lastShotTime = now;
        }
    }
    
    shoot(direction) {
        // Create bullet position at gun tip
        const bulletPosition = this.position.clone();
        bulletPosition.y = SIZES.PLAYER / 2;
        
        // Add offset in facing direction
        const offset = direction.clone().multiplyScalar(SIZES.PLAYER + 0.3);
        bulletPosition.add(offset);
        
        // Get player's current position and velocity if available
        let adjustedDirection = direction.clone();
        if (this.spawnManager && this.spawnManager.player) {
            const player = this.spawnManager.player;
            const playerPosition = player.getPosition();
            const playerVelocity = player.velocity;
            
            // Only apply predictive aiming if player is moving and not standing still
            if (playerVelocity && playerVelocity.lengthSq() > 0.1) {
                // Calculate time it would take for the bullet to reach player
                const distanceToPlayer = this.position.distanceTo(playerPosition);
                const bulletSpeed = GAME.SPEEDS.BULLET;
                const timeToHit = distanceToPlayer / bulletSpeed;
                
                // Predict where the player will be
                const predictedPosition = playerPosition.clone().add(
                    playerVelocity.clone().multiplyScalar(timeToHit * 0.5) // Scale down prediction for balance
                );
                
                // Adjust aim direction toward the predicted position
                adjustedDirection = new THREE.Vector3()
                    .subVectors(predictedPosition, bulletPosition)
                    .normalize();
            }
            
            // Add slight randomness based on enemy type for aiming accuracy
            let inaccuracy = 0;
            switch(this.type) {
                case 'CHUBBY':
                    inaccuracy = 0.12; // Least accurate
                    break;
                case 'THIN':
                    inaccuracy = 0.05; // Most accurate
                    break;
                default: // REGULAR
                    inaccuracy = 0.08; // Medium accuracy
            }
            
            // Apply randomness to direction
            adjustedDirection.x += (Math.random() - 0.5) * inaccuracy;
            adjustedDirection.z += (Math.random() - 0.5) * inaccuracy;
            adjustedDirection.normalize();
        }
        
        // Create and add bullet with appropriate speed based on enemy type
        // Thin enemies shoot faster bullets, chubby enemies shoot slower bullets
        let bulletSpeedMultiplier = 0.5; // Base speed multiplier (was 0.2)
        switch(this.type) {
            case 'CHUBBY':
                bulletSpeedMultiplier = 0.4; // Slower bullets
                break;
            case 'THIN':
                bulletSpeedMultiplier = 0.65; // Faster bullets
                break;
        }
        
        // Create optimized bullet with appropriate color based on enemy type
        const bulletColor = this.getColorByType();
        const bullet = new OptimizedBullet(this.scene, bulletPosition, adjustedDirection, bulletSpeedMultiplier, this.spawnManager.decalManager, false, bulletColor);
        
        if (this.spawnManager) {
            this.spawnManager.addEnemyBullet(bullet);
        }
        
        // Add muzzle flash
        this.createMuzzleFlash();
    }
    
    createMuzzleFlash() {
        // Get the position for the muzzle flash
        const flashPosition = this.position.clone();
        flashPosition.y = SIZES.PLAYER / 2;
        
        // Add offset in facing direction
        const direction = new THREE.Vector3(
            Math.sin(this.mesh.rotation.y),
            0,
            Math.cos(this.mesh.rotation.y)
        );
        const offset = direction.clone().multiplyScalar(SIZES.PLAYER + 0.3);
        flashPosition.add(offset);
        
        // Create flash
        const flashGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(flashPosition);
        flash.rotation.y = this.mesh.rotation.y;
        this.scene.add(flash);
        
        // Add light
        const light = new THREE.PointLight(0xffff00, 3, 2);
        light.position.copy(flashPosition);
        this.scene.add(light);
        
        // Animate and remove
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
            light.intensity = opacity * 3;
            
            requestAnimationFrame(animateFlash);
        };
        
        animateFlash();
    }
    
    // Add a new method to handle being blown away by grenade
    blowAway(direction, strength) {
        if (!this.isActive || this.isDying || this.isBlownAway) return;
        
        this.isBlownAway = true;
        
        // Calculate initial velocity based on direction and strength
        this.blownAwayVelocity = direction.clone().multiplyScalar(strength);
        
        // Add upward component for arc
        this.blownAwayVelocity.y = Math.min(strength * 1.5, 5);
        
        // Random rotation speed
        this.blownAwayRotation.set(
            (Math.random() - 0.5) * 10, 
            (Math.random() - 0.5) * 10,
            (Math.random() - 0.5) * 10
        );
        
        // Remove death scream - don't play sound for grenade deaths
    }
    
    updateBlownAwayAnimation(dt) {
        // Apply gravity to vertical velocity
        this.blownAwayVelocity.y -= this.gravity * dt;
        
        // Move enemy based on velocity
        this.mesh.position.add(this.blownAwayVelocity.clone().multiplyScalar(dt));
        
        // Update position for collision detection
        this.position.x = this.mesh.position.x;
        this.position.z = this.mesh.position.z;
        
        // Rotate mesh for tumbling effect
        this.mesh.rotation.x += this.blownAwayRotation.x * dt;
        this.mesh.rotation.y += this.blownAwayRotation.y * dt;
        this.mesh.rotation.z += this.blownAwayRotation.z * dt;
        
        // Check if enemy has hit the ground
        if (this.mesh.position.y <= 0.2) {
            // Set on ground and start death animation
            this.mesh.position.y = 0.2;
            
            // Remove death scream - don't play sound for grenade deaths
            
            this.die();
        }
        
        // Update attached bullets
        this.updateAttachedBullets();
    }
    
    reset(position, type = 'REGULAR') {
        // Reset position
        this.position = position.clone();
        this.type = type;
        
        // Reset state
        this.isActive = true;
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.speed = this.getSpeedByType();
        this.health = this.getHealthByType();
        this.jumpTime = Math.random() * 10;
        this.attachedBullets = [];
        this.isDying = false;
        this.deathTime = 0;
        this.hitEffects = [];
        
        // Generate a new unique ID
        this.enemyId = Math.floor(Math.random() * 1000000);
        
        // Reset blown away state
        this.isBlownAway = false;
        this.blownAwayVelocity = new THREE.Vector3(0, 0, 0);
        this.blownAwayRotation = new THREE.Vector3(0, 0, 0);
        
        // Reset shooting properties
        this.lastShotTime = 0;
        this.shootingCooldown = this.getShootingCooldownByType();
        
        // Clean up any existing mesh
        if (this.mesh) {
            this.scene.remove(this.mesh);
            // Don't dispose geometry/materials as they're reused
        }
        
        // Create new mesh with the updated type
        this.createEnemyMesh();
        
        return this;
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Remove all attached bullets
        this.attachedBullets.forEach(bulletInfo => {
            if (bulletInfo.bullet) {
                bulletInfo.bullet.deactivate();
            }
        });
        
        // Don't remove the mesh from scene, just hide it for reuse
        if (this.mesh) {
            this.mesh.visible = false;
        }
    }
}

export class Boss extends Enemy {
    constructor(scene, position, spawnManager = null) {
        // Call the Enemy constructor with the BOSS type
        super(scene, position, 'BOSS', spawnManager);
        
        // Override properties specific to the boss
        this.health = GAME.BOSS_HEALTH;
        this.shootingCooldown = GAME.BOSS_SHOOTING_COOLDOWN;
        this.shootingRange = 25; // Larger shooting range
        
        // Boss-specific properties - only use single attack
        this.attackPattern = 'SINGLE';
        
        // Track shared resources for explosion effects
        this.sharedGeometries = null;
        this.sharedMaterials = null;
        if (spawnManager && spawnManager.grenadePool) {
            this.sharedGeometries = spawnManager.grenadePool.sharedGeometries;
            this.sharedMaterials = spawnManager.grenadePool.sharedMaterials;
        }
        
        // Create a crown/emblem to distinguish the boss
        this.addBossEmblem();
    }
    
    addBossEmblem() {
        // Add a glowing effect
        const glowGeometry = new THREE.SphereGeometry(0.4, 8, 8);
        const glowMaterial = new THREE.MeshBasicMaterial({ 
            color: COLORS.ENEMY.BOSS,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending 
        });
        this.glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.mesh.add(this.glow);
        
        // Add a point light
        this.light = new THREE.PointLight(COLORS.ENEMY.BOSS, 0.8, 3);
        this.light.position.y = 0.5;
        this.mesh.add(this.light);
    }
    
    update(dt, playerPosition) {
        if (!this.isActive) return;
        
        // Call the parent update method
        super.update(dt, playerPosition);
        
        // Update glow effect
        if (this.glow) {
            const pulseScale = 1 + Math.sin(this.jumpTime * 3) * 0.2;
            this.glow.scale.set(pulseScale, pulseScale, pulseScale);
        }
        
        // Update light intensity
        if (this.light) {
            this.light.intensity = 0.5 + Math.sin(this.jumpTime * 3) * 0.3;
        }
    }
    
    tryShoot(direction) {
        const now = Date.now();
        
        // Check if enough time has passed since last shot
        if (now - this.lastShotTime < this.shootingCooldown) return;
        
        // Only use single bullet attack
        this.shootSingleBullet(direction);
        
        this.lastShotTime = now;
    }
    
    shootSingleBullet(direction) {
        // Create bullet position
        const bulletPosition = this.position.clone();
        bulletPosition.y = SIZES.PLAYER / 2;
        
        // Add offset in facing direction
        const offset = direction.clone().multiplyScalar(SIZES.PLAYER + 0.5);
        bulletPosition.add(offset);
        
        // Create a BossBullet with adjusted direction
        const bullet = new BossBullet(
            this.scene, 
            bulletPosition, 
            direction.clone(), 
            1.0, 
            this.spawnManager.decalManager,
            this.spawnManager.audioManager
        );
        
        // Check if the game is in low performance mode
        if (this.spawnManager.game && this.spawnManager.game.isLowPerformanceMode) {
            bullet.lowPerformanceMode = true;
        }
        
        if (this.spawnManager) {
            this.spawnManager.addEnemyBullet(bullet);
        }
        
        // Play a muzzle flash effect
        this.createEnhancedMuzzleFlash(bulletPosition);
    }
    
    createEnhancedMuzzleFlash(position, size = 0.4, color = 0xffff00) {
        // Create a larger flash
        const flashGeometry = new THREE.BoxGeometry(size, size, size);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        this.scene.add(flash);
        
        // Add an intense light
        const light = new THREE.PointLight(color, 5, 5);
        light.position.copy(position);
        this.scene.add(light);
        
        // Animate and remove with more intense effect
        let opacity = 1.0;
        let scale = 1.0;
        
        const animateFlash = () => {
            opacity -= 0.1;
            scale += 0.3;
            
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
        
        animateFlash();
    }
    
    die() {
        if (!this.isActive) return;
        
        // Create a single dramatic expanding sphere blast
        this.createBossDeathBlast();
        
        // Show a "Boss Defeated" message
        this.showBossDefeatedMessage();
        
        // Call the parent die method
        super.die();
    }
    
    createBossDeathBlast() {
        // Create a single expanding sphere blast
        const blastGeometry = this.sharedGeometries ? 
            this.sharedGeometries.particle : 
            new THREE.SphereGeometry(0.1, 16, 16); // Reduced from 32,32 to 16,16
        
        const blastMaterial = new THREE.MeshBasicMaterial({
            color: COLORS.ENEMY.BOSS,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        
        const blast = new THREE.Mesh(blastGeometry, blastMaterial);
        blast.position.copy(this.position);
        this.scene.add(blast);
        
        // Add a bright point light for the blast
        const blastLight = new THREE.PointLight(COLORS.ENEMY.BOSS, 8, 10);
        blastLight.position.copy(this.position);
        this.scene.add(blastLight);
        
        // Create debris pieces
        const debrisCount = 4; // Just a few pieces like grenade
        const debrisPieces = [];
        
        // Get appropriate debris geometries
        const debrisGeometries = this.sharedGeometries ? this.sharedGeometries.debris : null;
        const geometryOptions = debrisGeometries ? 
            Object.values(debrisGeometries) : 
            [new THREE.DodecahedronGeometry(0.2, 0)];
        
        for (let i = 0; i < debrisCount; i++) {
            // Use shared geometries if available, otherwise create a new one
            const geometry = geometryOptions[Math.floor(Math.random() * geometryOptions.length)];
            
            const debrisMaterial = new THREE.MeshBasicMaterial({
                color: COLORS.ENEMY.BOSS,
                transparent: true,
                opacity: 0.9
            });
            
            const debris = new THREE.Mesh(geometry, debrisMaterial);
            debris.position.copy(this.position);
            
            // Random initial rotation
            debris.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            // Random velocity and rotation speed
            debris.userData = {
                velocity: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.2, // Less spread
                    Math.random() * 0.3 + 0.2,   // Less upward velocity
                    (Math.random() - 0.5) * 0.2
                ),
                rotationSpeed: new THREE.Vector3(
                    (Math.random() - 0.5) * 0.1, // Slower rotation
                    (Math.random() - 0.5) * 0.1,
                    (Math.random() - 0.5) * 0.1
                ),
                gravity: 0.01,
                bounceCount: 0,
                maxBounces: 1 // Just one bounce like grenade
            };
            
            this.scene.add(debris);
            debrisPieces.push(debris);
        }
        
        // Animate the blast and debris
        let time = 0;
        const blastDuration = 1000; // ms
        let lastTime = performance.now();
        let animationId;
        
        const animateBlast = () => {
            const now = performance.now();
            const deltaTime = Math.min(now - lastTime, 33); // Cap at ~30fps for performance
            lastTime = now;
            
            time += deltaTime;
            const progress = time / blastDuration;
            
            if (progress < 1) {
                // Animate expanding sphere with easing
                const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out
                const scale = 1 + easeOut * 2; // Smaller expansion like grenade
                blast.scale.set(scale, scale, scale);
                
                // Fade out with a slight delay
                const fadeStart = 0.3; // Start fading after 30% of the animation
                const fadeProgress = Math.max(0, (progress - fadeStart) / (1 - fadeStart));
                blastMaterial.opacity = 1.0 * (1 - fadeProgress);
                blastLight.intensity = 8 * (1 - fadeProgress);
                
                // Update debris
                debrisPieces.forEach(debris => {
                    // Apply gravity
                    debris.userData.velocity.y -= debris.userData.gravity;
                    
                    // Update position
                    debris.position.add(debris.userData.velocity);
                    
                    // Update rotation
                    debris.rotation.x += debris.userData.rotationSpeed.x;
                    debris.rotation.y += debris.userData.rotationSpeed.y;
                    debris.rotation.z += debris.userData.rotationSpeed.z;
                    
                    // Floor collision
                    if (debris.position.y < 0.2 && debris.userData.velocity.y < 0) {
                        debris.position.y = 0.2;
                        debris.userData.velocity.y = Math.abs(debris.userData.velocity.y) * 0.5;
                        debris.userData.bounceCount++;
                        
                        // Slow down horizontal movement on bounce
                        debris.userData.velocity.x *= 0.8;
                        debris.userData.velocity.z *= 0.8;
                        
                        // Stop bouncing after max bounces
                        if (debris.userData.bounceCount >= debris.userData.maxBounces) {
                            debris.userData.velocity.y = 0;
                        }
                    }
                    
                    // Fade out debris
                    debris.material.opacity = 0.9 * (1 - fadeProgress);
                });
                
                animationId = requestAnimationFrame(animateBlast);
            } else {
                // Clean up
                this.scene.remove(blast);
                this.scene.remove(blastLight);
                
                // Only dispose if not using shared geometries
                if (!this.sharedGeometries) {
                    blastGeometry.dispose();
                }
                blastMaterial.dispose();
                
                // Clean up debris
                debrisPieces.forEach(debris => {
                    this.scene.remove(debris);
                    debris.geometry.dispose();
                    debris.material.dispose();
                });
                
                // Cancel animation frame if needed
                if (animationId) {
                    cancelAnimationFrame(animationId);
                }
            }
        };
        
        animationId = requestAnimationFrame(animateBlast);
    }
    
    showBossDefeatedMessage() {
        // Create a message element
        const message = document.createElement('div');
        message.textContent = 'BOSS DEFEATED!';
        message.style.position = 'fixed';
        message.style.top = '50%';
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.color = '#ffaa00';
        message.style.fontSize = '48px';
        message.style.fontFamily = '"Press Start 2P", cursive';
        message.style.textShadow = '0 0 10px #880088, 0 0 20px #880088';
        message.style.zIndex = '1000';
        message.style.opacity = '0';
        message.style.transition = 'opacity 0.5s ease-in-out';
        
        document.body.appendChild(message);
        
        // Fade in
        setTimeout(() => {
            message.style.opacity = '1';
        }, 100);
        
        // Remove after a few seconds
        setTimeout(() => {
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 500);
        }, 3000);
    }
    
    // Override reset method to properly handle boss-specific properties
    reset(position) {
        // Call parent reset method with BOSS type
        super.reset(position, 'BOSS');
        
        // Reset boss-specific properties
        this.health = GAME.BOSS_HEALTH;
        this.shootingCooldown = GAME.BOSS_SHOOTING_COOLDOWN;
        this.attackPattern = 'SINGLE';
        
        // Add back the boss emblem
        this.addBossEmblem();
        
        return this;
    }
}

export class EnemyPool {
    constructor(scene, spawnManager) {
        this.scene = scene;
        this.spawnManager = spawnManager;
        this.pool = [];
        this.poolSize = 20; // Initial pool size
        this.activeEnemies = [];
        
        // Initialize the pool
        this.initPool();
    }
    
    initPool() {
        for (let i = 0; i < this.poolSize; i++) {
            // Create an enemy at a default position
            const enemy = new Enemy(
                this.scene, 
                new THREE.Vector3(0, -100, 0), // Hidden position
                'REGULAR', 
                this.spawnManager
            );
            
            // Deactivate immediately
            enemy.deactivate();
            
            // Add to pool
            this.pool.push(enemy);
        }
    }
    
    getEnemy(position, type = 'REGULAR') {
        // Try to get an enemy from the pool
        let enemy = this.pool.find(e => !e.isActive);
        
        // If no enemy is available, create a new one or grow the pool
        if (!enemy) {
            if (this.pool.length + this.activeEnemies.length < 50) { // Cap at 50 total enemies

                enemy = new Enemy(this.scene, position, type, this.spawnManager);
            } else {
                // Take the oldest enemy from active enemies
                enemy = this.activeEnemies.shift();
            }
        } else {
            // Remove from pool
            this.pool.splice(this.pool.indexOf(enemy), 1);
        }
        
        // Reset and reposition the enemy
        enemy.reset(position, type);
        
        // Add to active enemies
        this.activeEnemies.push(enemy);
        
        return enemy;
    }
    
    recycleEnemy(enemy) {
        // Remove from active enemies
        const index = this.activeEnemies.indexOf(enemy);
        if (index !== -1) {
            this.activeEnemies.splice(index, 1);
        }
        
        // Add back to pool
        this.pool.push(enemy);
    }
    
    update(dt, playerPosition) {
        // Update all active enemies
        for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
            const enemy = this.activeEnemies[i];
            enemy.update(dt, playerPosition);
            
            // Check if enemy is no longer active
            if (!enemy.isActive) {
                this.recycleEnemy(enemy);
            }
        }
        
        return this.activeEnemies;
    }
    
    cleanup() {
        // Properly dispose of all enemies
        [...this.pool, ...this.activeEnemies].forEach(enemy => {
            if (enemy.mesh) {
                this.scene.remove(enemy.mesh);
                enemy.mesh.geometry.dispose();
                enemy.mesh.material.dispose();
            }
        });
        
        this.pool = [];
        this.activeEnemies = [];
    }
} 