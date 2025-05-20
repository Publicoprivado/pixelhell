import * as THREE from 'three';
import { COLORS, SIZES, GAME } from '../utils/constants.js';

export class Bullet {
    constructor(scene, position, direction, speedMultiplier = 1.0, color = COLORS.BULLET) {
        this.scene = scene;
        this.position = position.clone(); 
        this.direction = direction.clone().normalize();
        this.isActive = true;
        
        // Apply speed multiplier to allow for different speeds
        // Use the new SPEEDS.BULLET value from constants for consistent behavior
        this.speed = GAME.SPEEDS.BULLET * speedMultiplier;
        
        // Store initial position to track travel distance
        this.initialPosition = position.clone();
        this.maxTravelDistance = GAME.BULLET_MAX_DISTANCE;
        
        this.attachedToEnemy = false;
        this.attachedEnemy = null;

        // Create a cube mesh for the bullet to match the square theme
        const geometry = new THREE.BoxGeometry(SIZES.BULLET, SIZES.BULLET, SIZES.BULLET); 
        const material = new THREE.MeshBasicMaterial({ color: color });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        
        // Rotate the bullet to align with its direction of travel
        if (this.direction.x !== 0 || this.direction.z !== 0) {
            // Calculate the angle between direction vector and the z-axis
            this.mesh.rotation.y = Math.atan2(this.direction.x, this.direction.z);
        }
        
        this.scene.add(this.mesh);
    }

    update(dt) {
        if (!this.isActive || !this.mesh) {
            return;
        }
        
        // If attached to an enemy, don't update position independently
        if (this.attachedToEnemy) {
            return;
        }

        // Move the bullet mesh
        const moveDistance = this.speed * dt; 
        if (isNaN(moveDistance) || moveDistance === undefined) {
            console.error("[Bullet.update] moveDistance is NaN or undefined!", {speed: this.speed, dt: dt});
            return;
        }
        
        const moveVector = this.direction.clone().multiplyScalar(moveDistance);
        if (isNaN(moveVector.x) || isNaN(moveVector.y) || isNaN(moveVector.z)) {
            console.error("[Bullet.update] moveVector has NaN components!", {direction: this.direction, moveDistance: moveDistance});
            return;
        }

        this.mesh.position.add(moveVector);
        this.position.copy(this.mesh.position); 

        // Check if bullet has traveled its maximum distance
        const distanceTraveled = this.position.distanceTo(this.initialPosition);
        if (distanceTraveled >= this.maxTravelDistance) {
            this.deactivate();
        }
    }
    
    // Called when the bullet hits an enemy
    attachToEnemy(enemy) {
        this.attachedToEnemy = true;
        this.attachedEnemy = enemy;
        
        // Stop bullet's independent movement
        this.speed = 0;
    }

    deactivate() {
        if (!this.isActive) return;
        this.isActive = false;
        
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null; 
        }
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingRadius() {
        // Increase bullet collision radius to make hits easier
        const radius = SIZES.BULLET * 2.5;
        return radius; 
    }
    
    // Create a decal instead of staying as a 3D object - added for compatibility with OptimizedBullet
    createImpactDecal(position, normal, object) {
        // If we have a decal manager, create a decal
        if (this.decalManager) {
            // Determine if this is a ground hit or an object hit
            if (normal && Math.abs(normal.y) > 0.9) {
                // Ground hit - create a ground splatter
                this.decalManager.createGroundSplat(position, 0.7, this.color);
            } else {
                // Object hit - create a surface decal
                this.decalManager.createSurfaceDecal(position, normal, object, this.color);
            }
        }
        
        // Deactivate the bullet
        this.deactivate();
    }
}

// Raycast bullet - instant hit, no travel
export class InstantBullet {
    constructor(scene, position, direction, enemies) {
        this.scene = scene;
        this.position = position.clone();
        this.direction = direction.clone().normalize();
        this.isActive = true;
        
        // Immediately trace the path and check for hits
        this.traceBullet(enemies);
    }
    
    traceBullet(enemies) {
        // Create a visible line for the shot
        const lineGeometry = new THREE.BufferGeometry();
        const startPoint = this.position.clone();
        let endPoint = this.position.clone().add(this.direction.clone().multiplyScalar(100));
        
        // Check if we hit any enemies
        let hitEnemy = null;
        let closestDistance = Infinity;
        
        if (enemies && enemies.length > 0) {
            for (const enemy of enemies) {
                const enemyPos = enemy.getPosition();
                const enemyRadius = enemy.getBoundingRadius();
                
                // Create a ray from bullet position in bullet direction
                const ray = new THREE.Ray(this.position, this.direction);
                
                // Check if ray intersects enemy sphere
                const sphere = new THREE.Sphere(enemyPos, enemyRadius);
                const intersection = ray.intersectSphere(sphere, new THREE.Vector3());
                
                if (intersection) {
                    // Calculate distance to hit
                    const distance = intersection.distanceTo(this.position);
                    
                    // If this is the closest hit, store it
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        hitEnemy = enemy;
                        endPoint = intersection.clone();
                    }
                }
            }
        }
        
        // Create the line from start to end point
        const linePoints = [startPoint, endPoint];
        lineGeometry.setFromPoints(linePoints);
        
        // Create a bright material for the line
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 10,
        });
        
        this.line = new THREE.Line(lineGeometry, lineMaterial);
        this.scene.add(this.line);
        
        // If we hit an enemy, damage it
        if (hitEnemy) {
            hitEnemy.takeDamage(1);
            this.createHitEffect(endPoint);
        }
        
        // Remove the line after a short delay
        setTimeout(() => {
            this.deactivate();
        }, 100);
    }
    
    createHitEffect(position) {
        // Create a bright flash at the hit position
        const flashGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 1.0
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(position);
        this.scene.add(flash);
        
        // Create a point light at the hit position
        const light = new THREE.PointLight(0xffff00, 5, 3);
        light.position.copy(position);
        this.scene.add(light);
        
        // Fade out and remove
        let opacity = 1.0;
        let scale = 0.5;
        
        const fadeOut = () => {
            opacity -= 0.1;
            scale += 0.1;
            
            flashMaterial.opacity = opacity;
            flash.scale.set(scale, scale, scale);
            light.intensity = opacity * 5;
            
            if (opacity > 0) {
                requestAnimationFrame(fadeOut);
            } else {
                this.scene.remove(flash);
                this.scene.remove(light);
                flashGeometry.dispose();
                flashMaterial.dispose();
            }
        };
        
        fadeOut();
    }
    
    update() {
        // No update needed - this is an instant bullet
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Remove the line
        if (this.line) { // Check if line exists
            this.scene.remove(this.line);
            this.line.geometry.dispose();
            this.line.material.dispose();
            this.line = null; // Clear reference
        }
    }
    
    getPosition() {
        return this.position;
    }
}

export class Grenade {
    constructor(scene, position, direction, audioManager, decalManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.decalManager = decalManager; // Store reference to decalManager
        this.position = position.clone();
        this.initialPosition = position.clone();
        this.direction = direction.clone().normalize();
        this.speed = GAME.SPEEDS.GRENADE;
        this.isActive = true;
        this.hasExploded = false;
        this.explosionActive = false; // Flag to track if explosion is in active damage phase
        this.throwTime = performance.now(); // Use performance.now for more precise timing
        this.explosionRadius = GAME.GRENADE_EXPLOSION_RADIUS;
        this.throwStrength = GAME.GRENADE_THROW_STRENGTH;
        this.explodeAfter = GAME.GRENADE_EXPLOSION_DELAY; // Cache this value
        
        // Physics parameters for proper arc trajectory
        this.gravityEffect = 0.02; 
        
        // Initial vertical velocity for higher arc
        this.verticalVelocity = this.throwStrength * 0.7; 
        
        // Start position slightly higher
        this.position.y += 0.5; // Start above the player's hand
        
        // Use smaller step size for finer motion
        this.stepSize = 0.15;
        
        // Track the last bounce time to avoid playing the sound too frequently
        this.lastBounceTime = 0;
        this.bounceThreshold = 300; // minimum ms between bounce sounds
        
        // Will hold shared resources from the pool
        this.sharedGeometries = null;
        this.sharedMaterials = null;
        
        // Track created objects for cleanup
        this.meshes = [];
        this.lights = []; // Kept for backward compatibility, but we'll avoid using lights
        this.trailParticles = [];
        this.debrisParticles = [];
        this.animationIds = [];
        
        // Light optimization flag
        this.useLights = false; // Set to false to use emissive materials instead of lights
        
        // Create the actual grenade mesh
        this.createGrenadeMesh();
    }
    
    // Method to reset a pooled grenade
    reset(position, direction) {
        // Reset position and direction
        this.position = position.clone();
        this.position.y += 0.5; // Start above the player's hand
        this.initialPosition = position.clone();
        this.direction = direction.clone().normalize();
        
        // Reset state with proper timestamp
        this.isActive = true;
        this.hasExploded = false;
        this.explosionActive = false;
        this.throwTime = performance.now();
        
        // Reset physics
        this.speed = GAME.SPEEDS.GRENADE;
        this.verticalVelocity = this.throwStrength * 0.7;
        this.gravityEffect = 0.02; // Ensure gravity effect is reset
        this.lastBounceTime = 0;
        
        // Ensure explosion timer is reset
        this.explodeAfter = GAME.GRENADE_EXPLOSION_DELAY;
        
        // Clean up any existing objects and animations
        this.cleanupObjects(false);
        
        // Create a new mesh
        this.createGrenadeMesh();
        
 
        
        return this;
    }
    
    createGrenadeMesh() {
        // Use shared geometry and material if available
        const geometry = this.sharedGeometries ? this.sharedGeometries.grenade : new THREE.DodecahedronGeometry(0.3, 0);
        
        // Use a more emissive material to compensate for no light
        const material = this.sharedMaterials ? this.sharedMaterials.grenade.clone() : new THREE.MeshPhongMaterial({ 
            color: 0xff3300,
            emissive: 0xff5500,        // Brighter emissive color to replace light
            emissiveIntensity: 0.8,    // Higher intensity
            shininess: 80
        });
        
        // Increase emissive intensity if we're using a shared material
        if (this.sharedMaterials) {
            material.emissive.setHex(0xff5500);
            material.emissiveIntensity = 0.8;
        }
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        
        // Start higher off the ground for better visibility
        this.mesh.position.y = Math.max(this.mesh.position.y, 0.3 + 0.5); // Proper height for arc
        
        this.scene.add(this.mesh);
        this.meshes.push(this.mesh);
        
        // Create emissive glow sphere to replace the light
        if (!this.useLights) {
            const glowGeometry = this.sharedGeometries ? 
                this.sharedGeometries.particle : 
                new THREE.SphereGeometry(0.4, 6, 6);
                
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0xff5500,
                transparent: true,
                opacity: 0.4,
                blending: THREE.NormalBlending  // Use normal blending instead of additive
            });
            
            this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
            this.mesh.add(this.glowMesh);
            this.meshes.push(this.glowMesh);
        } 
        // Only add a light if absolutely necessary (backward compatibility)
        else {
            this.light = new THREE.PointLight(0xff5500, 2, 5);
            this.light.position.copy(this.position);
            this.scene.add(this.light);
            this.lights.push(this.light);
        }
        
        // Create a trail effect with particles
        this.createTrailEffect();
    }
    
    createTrailEffect() {
        // Particle system for trail effect
        this.trailParticles = [];
        this.maxTrailParticles = 4; // Reduced from 12 for less memory impact
        this.trailUpdateRate = 100; // Slower updates (was 50)
        this.lastTrailUpdate = performance.now();
        
        // Only create a few particles for the trail
        const particleGeometry = this.sharedGeometries ? 
            this.sharedGeometries.particle : 
            new THREE.SphereGeometry(0.15, 4, 4); // Reduced segments
        
        const particleMaterial = this.sharedMaterials ? 
            this.sharedMaterials.trailParticle : 
            new THREE.MeshBasicMaterial({
                color: 0xff5500,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending
            });
        
        // Pre-create all particles but keep them invisible
        for (let i = 0; i < this.maxTrailParticles; i++) {
            // Reuse material for all particles
            const particle = new THREE.Mesh(particleGeometry, particleMaterial);
            
            // Hide initially
            particle.visible = false;
            particle.userData = {
                active: false,
                age: 0,
                maxAge: 500, // Shorter lifetime
                startOpacity: 0.8,
                startScale: 0.8,
                endScale: 0.2
            };
            
            // Add to scene
            this.scene.add(particle);
            this.trailParticles.push(particle);
        }
    }
    
    updateTrailEffect() {
        if (!this.isActive || this.hasExploded) return;

        const now = performance.now();
        
        // Only update trail occasionally to avoid performance issues
        if (now - this.lastTrailUpdate > this.trailUpdateRate) {
            this.lastTrailUpdate = now;
            
            // Find an inactive particle
            let particle = null;
            for (const p of this.trailParticles) {
                if (!p.userData.active) {
                    particle = p;
                    break;
                }
            }
            
            // If all particles are active, reuse the oldest one
            if (!particle) {
                let oldestAge = 0;
                for (const p of this.trailParticles) {
                    if (p.userData.age > oldestAge) {
                        oldestAge = p.userData.age;
                        particle = p;
                    }
                }
            }
            
            // Position particle at current grenade position
            if (particle) {
                particle.position.copy(this.mesh.position);
                particle.visible = true;
                particle.userData.active = true;
                particle.userData.age = 0;
                particle.scale.setScalar(particle.userData.startScale);
                particle.material.opacity = particle.userData.startOpacity;
            }
        }
        
        // Batch update active particles for better performance
        const dt = 16; // Fixed time step
        let activeCount = 0;
        
        for (const particle of this.trailParticles) {
            if (particle.userData.active) {
                activeCount++;
                particle.userData.age += dt;
                
                // Fade out based on age
                const lifeRatio = particle.userData.age / particle.userData.maxAge;
                
                if (lifeRatio > 1) {
                    // Deactivate particle
                    particle.userData.active = false;
                    particle.visible = false;
                } else {
                    // Update every other frame for better performance
                    if (Math.floor(particle.userData.age / 32) % 2 === 0) {
                        // Smooth fade out with easing
                        const fadeRatio = 1 - (lifeRatio * lifeRatio); // Quadratic easing
                        particle.material.opacity = particle.userData.startOpacity * fadeRatio;
                        
                        // Smoothly scale down
                        const scale = particle.userData.startScale + 
                            (particle.userData.endScale - particle.userData.startScale) * lifeRatio;
                        particle.scale.setScalar(scale);
                    }
                }
            }
        }
    }
    
    update(dt) {
        if (!this.isActive || this.hasExploded) return;
        
        // Use elapsed time in seconds for more precise physics
        const now = performance.now();
        const elapsedTime = (now - this.throwTime) / 1000;
        
        // Apply horizontal movement using consistent step size
        const horizontalMovement = this.direction.clone().multiplyScalar(this.speed * this.stepSize);
        this.mesh.position.x += horizontalMovement.x;
        this.mesh.position.z += horizontalMovement.z;
        
        // Update vertical position using physics
        this.verticalVelocity -= this.gravityEffect; // Apply gravity
        this.mesh.position.y += this.verticalVelocity;
        
        // If grenade hits ground, make it bounce slightly and roll
        if (this.mesh.position.y < 0.3) {
            this.mesh.position.y = 0.3;
            
            // Check if the bounce is significant enough to play sound
            // and if enough time has passed since the last bounce
            if (Math.abs(this.verticalVelocity) > 0.01 && now - this.lastBounceTime > this.bounceThreshold) {
                // Play bounce sound with volume proportional to impact velocity
                this.audioManager.playGrenadeBounce();
                this.lastBounceTime = now;
            }
            
            this.verticalVelocity = Math.abs(this.verticalVelocity) * 0.3; // Small bounce
            
            // Reduce horizontal speed to simulate friction
            this.speed *= 0.9;
        }
        
        // Blink effect for countdown to explosion
        const timeToExplode = this.explodeAfter - (now - this.throwTime);
        const blinkSpeed = Math.max(1, 10 - (timeToExplode / 200)); // Blink faster as time runs out
        const blinkValue = 2.5 + Math.sin(elapsedTime * blinkSpeed * Math.PI) * 1.5;
        
        if (this.useLights && this.light) {
            // Update light position and intensity
            this.light.position.copy(this.mesh.position);
            this.light.intensity = blinkValue;
        } else if (this.mesh.material && this.glowMesh) {
            // Update emissive intensity and glow opacity instead of light
            this.mesh.material.emissiveIntensity = 0.5 + Math.sin(elapsedTime * blinkSpeed * Math.PI) * 0.3;
            this.glowMesh.material.opacity = 0.2 + Math.sin(elapsedTime * blinkSpeed * Math.PI) * 0.2;
        }
        
        // Rotate grenade as it moves to simulate tumbling
        this.mesh.rotation.x += dt * 5;
        this.mesh.rotation.y += dt * 3;
        this.mesh.rotation.z += dt * 4;
        
        // Update trail effect less frequently based on frame rate
        this.updateTrailEffect();
        
        this.position.copy(this.mesh.position);
        
        // Check if grenade should explode
        if (now - this.throwTime > this.explodeAfter) {

            this.explode();
        } else if (timeToExplode < 500 && Math.floor(timeToExplode) % 100 === 0) {
            // Add debug logging to see countdown

        }
        
        // Check if grenade is out of bounds
        const halfSize = GAME.ARENA_SIZE / 2;
        if (
            this.position.x < -halfSize || 
            this.position.x > halfSize || 
            this.position.z < -halfSize || 
            this.position.z > halfSize
        ) {
            this.deactivate();
        }
    }
    
    explode() {
        if (!this.isActive || this.hasExploded) return;
        
        this.hasExploded = true;
        this.explosionActive = true;
        
        // Play explosion sound
        if (this.audioManager) {
            this.audioManager.playGrenadeExplosion();
        }
        
        // Create explosion splat on ground
        if (this.decalManager) {
            const splatPosition = this.position.clone();
            splatPosition.y = 0.02;
            this.decalManager.createGroundSplat(splatPosition, this.explosionRadius * 1.2, 0xff5500);
        }
        
        // Hide the grenade
        if (this.mesh) {
            this.mesh.visible = false;
        }
        
        // Create initial flash effect (sphere that quickly expands and fades)
        // Use shared resources if available
        const flashGeometry = this.sharedGeometries && this.sharedGeometries.particle ? 
            this.sharedGeometries.particle : 
            new THREE.SphereGeometry(0.3, 8, 8); // Reduced segments from 16 to 8
        
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00, // Bright yellow flash
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(this.position);
        this.scene.add(flash);
        this.meshes.push(flash);
        
        // Very bright point light for initial flash
        const flashLight = new THREE.PointLight(0xffff00, 15, this.explosionRadius * 2);
        flashLight.position.copy(this.position);
        this.scene.add(flashLight);
        this.lights.push(flashLight);
        
        // Animate the flash quickly - use more efficient animation technique
        let flashTime = 0;
        const flashDuration = 200;
        let lastFlashTime = performance.now();
        let flashAnimationId;
        
        const animateFlash = () => {
            const now = performance.now();
            flashTime += now - lastFlashTime;
            lastFlashTime = now;
            
            const progress = flashTime / flashDuration;
            
            if (progress < 1) {
                const scale = 1 + progress * 5;
                flash.scale.set(scale, scale, scale);
                flashMaterial.opacity = 1.0 * (1 - progress);
                flashLight.intensity = 15 * (1 - progress);
                
                flashAnimationId = requestAnimationFrame(animateFlash);
                this.animationIds.push(flashAnimationId);
            } else {
                // Cancel any pending animation frames
                if (flashAnimationId) {
                    cancelAnimationFrame(flashAnimationId);
                    const index = this.animationIds.indexOf(flashAnimationId);
                    if (index !== -1) this.animationIds.splice(index, 1);
                }
                
                this.scene.remove(flash);
                this.scene.remove(flashLight);
                // Only dispose if not using shared resources
                if (!this.sharedGeometries || !this.sharedGeometries.particle) {
                    flashGeometry.dispose();
                }
                flashMaterial.dispose();
            }
        };
        
        animateFlash();
        
        // Create main explosion effect
        this.createExplosionEffect();
        
        // Create debris flying out
        this.createDebrisEffect();
        
        // Disable explosion damage after a short delay
        this.explosionTimer = setTimeout(() => {
            this.explosionActive = false;
            // Don't deactivate yet - we want to keep the debris around for a bit
            setTimeout(() => {
                this.deactivate();
            }, 2000); // Keep debris for 2 seconds
        }, 400);
    }
    
    createExplosionEffect() {
        // Create a bright light at explosion center (reduced intensity and range)
        const explosionLight = new THREE.PointLight(0xff5500, 8, this.explosionRadius * 2.5);
        explosionLight.position.copy(this.position);
        explosionLight.position.y = this.explosionRadius * 0.4;
        this.scene.add(explosionLight);
        this.lights.push(explosionLight);
        
        // Create explosion particles (significantly reduced count)
        const particleCount = 30; // Reduced from 250
        
        // Use shared geometry if available or create a new one
        let particles;
        let particleMaterial;
        
        if (this.sharedGeometries && this.sharedMaterials) {
            // Create particles using shared resources but with unique positions
            particles = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            
            // Set positions and colors
            for (let i = 0; i < particleCount; i++) {
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.random() * Math.PI;
                const radius = Math.random() * this.explosionRadius * 1.3;
                
                positions[i * 3] = this.position.x + radius * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = this.position.y + radius * Math.sin(phi) * Math.sin(theta);
                positions[i * 3 + 2] = this.position.z + radius * Math.cos(phi);
                
                // Set particle color (orange-yellow)
                colors[i * 3] = 1.0;
                colors[i * 3 + 1] = 0.7;
                colors[i * 3 + 2] = 0.2;
            }
            
            particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            // Use a clone of the shared material to avoid affecting other instances
            particleMaterial = this.sharedMaterials.explosion.clone();
            particleMaterial.size = 0.4;
            particleMaterial.vertexColors = true;
        } else {
            // Create particles the original way
            particles = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            
            // Set positions and colors
            for (let i = 0; i < particleCount; i++) {
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.random() * Math.PI;
                const radius = Math.random() * this.explosionRadius * 1.3;
                
                positions[i * 3] = this.position.x + radius * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = this.position.y + radius * Math.sin(phi) * Math.sin(theta);
                positions[i * 3 + 2] = this.position.z + radius * Math.cos(phi);
                
                // Set particle color (orange-yellow)
                colors[i * 3] = 1.0;
                colors[i * 3 + 1] = 0.7;
                colors[i * 3 + 2] = 0.2;
            }
            
            particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            particleMaterial = new THREE.PointsMaterial({
                size: 0.4,
                vertexColors: true,
                blending: THREE.AdditiveBlending,
                transparent: true,
                sizeAttenuation: true,
                depthWrite: false
            });
        }
        
        const particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(particleSystem);
        this.meshes.push(particleSystem);
        
        // Create shockwave ring (simplified)
        const ringGeometry = this.sharedGeometries && this.sharedGeometries.ring ? 
            this.sharedGeometries.ring : 
            new THREE.RingGeometry(0.0, 0.2, 8);
        
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(this.position);
        ring.rotation.x = Math.PI / 2; // Align with ground
        this.scene.add(ring);
        this.meshes.push(ring);
        
        // Animate explosion (optimized)
        let explosionTime = 0;
        const explosionDuration = 600; // Reduced from 800ms
        let lastTime = performance.now();
        let explosionAnimId;
        
        const animateExplosion = () => {
            const now = performance.now();
            const deltaTime = Math.min(now - lastTime, 33); // Cap at ~30fps for better performance
            lastTime = now;
            
            explosionTime += deltaTime;
            const progress = explosionTime / explosionDuration;
            
            if (progress < 1) {
                // Scale ring with easing
                const easeOutQuad = 1 - Math.pow(1 - progress, 2);
                const ringScale = easeOutQuad * this.explosionRadius * 4;
                ring.scale.set(ringScale, ringScale, ringScale);
                ringMaterial.opacity = Math.max(0, 1 - progress * 1.5);
                
                // Fade explosion light
                explosionLight.intensity = 8 * (1 - progress);
                
                // Fade particles 
                particleMaterial.opacity = 1 - (progress * 0.8);
                
                explosionAnimId = requestAnimationFrame(animateExplosion);
                this.animationIds.push(explosionAnimId);
            } else {
                // Cancel any pending animation
                if (explosionAnimId) {
                    cancelAnimationFrame(explosionAnimId);
                    const index = this.animationIds.indexOf(explosionAnimId);
                    if (index !== -1) this.animationIds.splice(index, 1);
                }
                
                // Clean up resources
                this.scene.remove(explosionLight);
                this.scene.remove(particleSystem);
                this.scene.remove(ring);
                
                particleMaterial.dispose();
                particles.dispose();
                ringMaterial.dispose();
                
                // Only dispose geometry if not shared
                if (!this.sharedGeometries || !this.sharedGeometries.ring) {
                    ringGeometry.dispose();
                }
            }
        };
        
        explosionAnimId = requestAnimationFrame(animateExplosion);
        this.animationIds.push(explosionAnimId);
    }
    
    createDebrisEffect() {
        // Create a good number of debris pieces
        const debrisCount = 6;
        this.debrisParticles = [];
        
        // Get shared geometries if available
        const debrisGeometries = this.sharedGeometries ? this.sharedGeometries.debris : {
            shard: new THREE.ConeGeometry(0.2, 0.8, 3),
            chunk: new THREE.DodecahedronGeometry(0.3, 0),
            splinter: new THREE.BoxGeometry(0.1, 0.6, 0.1),
            plate: new THREE.BoxGeometry(0.4, 0.1, 0.4),
            miniGrenade: new THREE.SphereGeometry(0.15, 6, 6)
        };
        
        // Get shared materials if available
        const debrisMaterial = this.sharedMaterials ? this.sharedMaterials.debris1 : new THREE.MeshPhongMaterial({
            color: 0x9B870C,
            emissive: 0x9B870C,
            emissiveIntensity: 0.3,
            shininess: 40,
            flatShading: true
        });
        
        const debrisMaterial2 = this.sharedMaterials ? this.sharedMaterials.debris2 : new THREE.MeshPhongMaterial({
            color: 0x777777,
            emissive: 0x444444,
            emissiveIntensity: 0.1,
            shininess: 60,
            flatShading: true
        });
        
        for (let i = 0; i < debrisCount; i++) {
            // Direction calculation with more upward momentum
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI / 2; // More upward bias
            
            const direction = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * 0.35,
                Math.random() * 0.8 + 0.4, // Much higher upward velocity
                Math.sin(phi) * Math.sin(theta) * 0.35
            );
            
            // Select random geometry - better selection
            const geometryTypes = Object.keys(debrisGeometries);
            const geometry = debrisGeometries[geometryTypes[Math.floor(Math.random() * geometryTypes.length)]];
            
            // Alternate materials for variety
            const material = i % 2 === 0 ? debrisMaterial : debrisMaterial2;
            const debris = new THREE.Mesh(geometry, material);
            
            // Randomized scale
            const baseScale = 0.6 + Math.random() * 0.6;
            debris.scale.setScalar(baseScale);
            
            debris.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            // Add slight offset for better initial spread
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3
            );
            debris.position.copy(this.position).add(offset);
            this.scene.add(debris);
            
            // Enhanced physics parameters for better bouncing
            this.debrisParticles.push({
                mesh: debris,
                direction: direction,
                speed: Math.random() * 0.5 + 0.3, // Higher speed range
                rotationAxis: new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize(),
                rotationSpeed: Math.random() * 0.2 + 0.1,
                bounceAmount: 0.4 + Math.random() * 0.3,
                elasticity: 0.7 + Math.random() * 0.2, // Initial elasticity
                spinDecay: 0.97 + Math.random() * 0.02, // Spin slowdown factor
                gravity: 0.015 + Math.random() * 0.01,
                bounceCount: 0,
                maxBounces: Math.floor(Math.random() * 3) + 2, // 2-4 bounces before settling
                playedBounceSound: false,
                bounceSoundDelay: Math.random() * 200, // Randomize sound delay
                settled: false
            });
        }
        
        // Animate debris with bouncing
        let lastFrameTime = performance.now();
        const targetFrameTime = 1000 / 60; // Target 60 FPS
        
        const animateDebris = () => {
            if (!this.isActive || !this.debrisParticles || this.debrisParticles.length === 0) return;
            
            const currentTime = performance.now();
            const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, targetFrameTime / 1000);
            lastFrameTime = currentTime;
            
            let activeCount = 0;
            
            // Get arena boundaries from game constants
            const arenaHalfSize = GAME.ARENA_SIZE / 2;
            
            for (const debris of this.debrisParticles) {
                if (debris.settled) continue;
                activeCount++;
                
                // Apply velocity with deltaTime
                const frameSpeed = debris.speed * deltaTime * 60; // Normalize to 60 FPS
                debris.mesh.position.x += debris.direction.x * frameSpeed;
                debris.mesh.position.y += debris.direction.y * frameSpeed;
                debris.mesh.position.z += debris.direction.z * frameSpeed;
                
                // Apply rotation for spinning effect
                debris.mesh.rotateOnAxis(debris.rotationAxis, debris.rotationSpeed * deltaTime * 60);
                
                // Gravity with slightly slower fall for smaller debris
                const gravity = 0.06 * deltaTime * 60 * (1 - (debris.mesh.scale.x - 0.6) / 0.6 * 0.3);
                debris.direction.y -= gravity;
                
                // Wall collision checking with bouncing
                // X-axis walls
                if (Math.abs(debris.mesh.position.x) > arenaHalfSize - 0.5) {
                    // Hit left or right wall - reverse X direction with some energy loss
                    debris.direction.x *= -0.8;
                    
                    // Keep within bounds
                    if (debris.mesh.position.x > arenaHalfSize - 0.5) {
                        debris.mesh.position.x = arenaHalfSize - 0.5;
                    } else if (debris.mesh.position.x < -arenaHalfSize + 0.5) {
                        debris.mesh.position.x = -arenaHalfSize + 0.5;
                    }
                    
                    // Add some random variation to direction after bounce
                    debris.direction.z += (Math.random() - 0.5) * 0.3;
                    
                    // Play bounce sound occasionally for wall hits
                    if (this.audioManager && Math.random() < 0.3 && !debris.wallBounceSound) {
                        debris.wallBounceSound = true;
                        setTimeout(() => {
                            this.audioManager.playGrenadeBounce();
                        }, Math.random() * 100);
                    }
                }
                
                // Z-axis walls
                if (Math.abs(debris.mesh.position.z) > arenaHalfSize - 0.5) {
                    // Hit front or back wall - reverse Z direction with energy loss
                    debris.direction.z *= -0.8;
                    
                    // Keep within bounds
                    if (debris.mesh.position.z > arenaHalfSize - 0.5) {
                        debris.mesh.position.z = arenaHalfSize - 0.5;
                    } else if (debris.mesh.position.z < -arenaHalfSize + 0.5) {
                        debris.mesh.position.z = -arenaHalfSize + 0.5;
                    }
                    
                    // Add some random variation to direction after bounce
                    debris.direction.x += (Math.random() - 0.5) * 0.3;
                    
                    // Play bounce sound occasionally for wall hits
                    if (this.audioManager && Math.random() < 0.3 && !debris.wallBounceSound) {
                        debris.wallBounceSound = true;
                        setTimeout(() => {
                            this.audioManager.playGrenadeBounce();
                        }, Math.random() * 100);
                    }
                }
                
                // Ground collision with bouncing
                if (debris.mesh.position.y < 0.15) {
                    debris.bounceCount++;
                    debris.mesh.position.y = 0.15;
                    
                    // Play bounce sound for larger debris with random delay
                    if (this.audioManager && !debris.playedBounceSound && 
                        debris.mesh.scale.x > 0.8 && 
                        debris.bounceCount === 1) {
                        debris.playedBounceSound = true;
                        setTimeout(() => {
                            this.audioManager.playGrenadeBounce();
                        }, debris.bounceSoundDelay);
                    }
                    
                    if (debris.bounceCount >= debris.maxBounces || debris.speed < 0.05) {
                        debris.settled = true;
                        debris.mesh.position.y = 0.12;
                        
                        // Set final rotation once and stop updating
                        debris.mesh.rotation.set(
                            Math.random() < 0.5 ? 0 : Math.PI/2,
                            Math.random() * Math.PI * 2,
                            Math.random() < 0.5 ? 0 : Math.PI/4
                        );
                    } else {
                        // Energetic bounce
                        debris.direction.y = Math.abs(debris.direction.y) * debris.elasticity;
                        
                        // Reduce energy with each bounce
                        debris.elasticity *= 0.7;
                        debris.speed *= 0.8;
                        
                        // Reduce spin speed after bounces
                        debris.rotationSpeed *= debris.spinDecay;
                        
                        // Add random horizontal variation for more organic movement
                        debris.direction.x += (Math.random() - 0.5) * 0.2;
                        debris.direction.z += (Math.random() - 0.5) * 0.2;
                    }
                }
            }
            
            // Continue animation if any active debris remains
            if (activeCount > 0) {
                const animId = requestAnimationFrame(animateDebris);
                this.animationIds.push(animId);
            } else {
                // All debris has settled, fade them out after a delay
                setTimeout(() => {
                    this.fadeOutDebris();
                }, 2000);
            }
        };
        
        // Start the animation
        const animId = requestAnimationFrame(animateDebris);
        this.animationIds.push(animId);
    }
    
    fadeOutDebris() {
        if (!this.isActive || !this.debrisParticles || this.debrisParticles.length === 0) return;
        
        const fadeSpeed = 0.02;
        
        const fadeAnimation = () => {
            let stillVisible = false;
            
            for (const debris of this.debrisParticles) {
                if (!debris.mesh || !debris.mesh.material) continue;
                
                // Make sure material is set to transparent to enable fading
                if (!debris.mesh.material.transparent) {
                    debris.mesh.material.transparent = true;
                    debris.mesh.material.needsUpdate = true;
                }
                
                // Fade out the opacity
                if (debris.mesh.material.opacity > 0) {
                    debris.mesh.material.opacity -= fadeSpeed;
                    stillVisible = true;
                    
                    // If nearly transparent, just set to zero
                    if (debris.mesh.material.opacity < 0.05) {
                        debris.mesh.material.opacity = 0;
                    }
                }
            }
            
            if (stillVisible) {
                const animId = requestAnimationFrame(fadeAnimation);
                this.animationIds.push(animId);
            } else {
                // All debris faded out, now we can deactivate
                this.deactivate();
            }
        };
        
        // Start the fade animation
        const animId = requestAnimationFrame(fadeAnimation);
        this.animationIds.push(animId);
    }
    
    // Helper method to clean up objects without deactivating
    cleanupObjects(forceCleanup = false) {
        // Clean up all created objects
        this.animationIds.forEach(id => cancelAnimationFrame(id));
        this.animationIds = [];
        
        // Remove and dispose meshes
        this.meshes.forEach(mesh => {
            if (mesh && mesh.parent) {
                this.scene.remove(mesh);
                // Only dispose if we created them ourselves or force disposal is requested
                if ((!this.sharedGeometries || forceCleanup) && mesh.geometry) {
                    mesh.geometry.dispose();
                }
                if ((!this.sharedMaterials || forceCleanup) && mesh.material) {
                    mesh.material.dispose();
                }
            }
        });
        this.meshes = [];
        
        // Remove lights
        this.lights.forEach(light => {
            if (light && light.parent) {
                this.scene.remove(light);
            }
        });
        this.lights = [];
        
        // Clean up trail particles
        this.trailParticles.forEach(particle => {
            if (particle && particle.parent) {
                this.scene.remove(particle);
                if (!this.sharedGeometries && particle.geometry) {
                    particle.geometry.dispose();
                }
                if (!this.sharedMaterials && particle.material) {
                    particle.material.dispose();
                }
            }
        });
        this.trailParticles = [];
        
        // Clean up debris particles
        this.debrisParticles.forEach(debris => {
            if (debris.mesh && debris.mesh.parent) {
                this.scene.remove(debris.mesh);
                if (!this.sharedGeometries && debris.mesh.geometry) {
                    debris.mesh.geometry.dispose();
                }
                if (!this.sharedMaterials && debris.mesh.material) {
                    debris.mesh.material.dispose();
                }
            }
        });
        this.debrisParticles = [];
    }
    
    deactivate(forceCleanup = false) {
        if (!this.isActive && !forceCleanup) return;
        
        this.isActive = false;
        
        // Use the cleanupObjects method to handle cleanup
        this.cleanupObjects(forceCleanup);
        
        // Cancel any pending timers
        if (this.explosionTimer) {
            clearTimeout(this.explosionTimer);
            this.explosionTimer = null;
        }
    }
    
    getPosition() {
        return this.position;
    }
    
    getExplosionRadius() {
        return this.explosionRadius;
    }
    
    hasExploded() {
        return this.hasExploded;
    }
    
    isExplosionActive() {
        return this.explosionActive;
    }
}

// BulletManager class for instanced rendering of bullets
export class BulletManager {
    constructor(scene) {
        this.scene = scene;
        this.maxBullets = 100; // Maximum number of bullets to render
        this.activeBullets = [];
        this.decalManager = null;
        
        // Create instanced geometry and material
        this.createInstancedMesh();
    }
    
    setDecalManager(decalManager) {
        this.decalManager = decalManager;
    }
    
    createInstancedMesh() {
        // Create a box geometry for the bullets
        const geometry = new THREE.BoxGeometry(SIZES.BULLET, SIZES.BULLET, SIZES.BULLET);
        const material = new THREE.MeshBasicMaterial({ color: COLORS.BULLET });
        
        // Create an instanced mesh with the maximum number of instances
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxBullets);
        this.instancedMesh.count = 0; // Start with 0 instances
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); // Mark as dynamic
        
        // Disable frustum culling to prevent bullets from disappearing when outside camera frustum
        this.instancedMesh.frustumCulled = false;
        
        this.scene.add(this.instancedMesh);
        
        // Create a matrix for transformations
        this.matrix = new THREE.Matrix4();
    }
    
    // Create a new bullet and return it
    createBullet(position, direction, speedMultiplier = 1.0) {
        // Create a bullet object but don't create a mesh for it
        const bullet = new OptimizedBullet(this.scene, position, direction, speedMultiplier, this.decalManager, true);
        
        // Instead of adding a mesh to the scene, add it to our instances
        if (this.activeBullets.length < this.maxBullets) {
            // Assign an instance index
            bullet.instanceId = this.activeBullets.length;
            this.activeBullets.push(bullet);
            
            // Increase the count of visible instances
            this.instancedMesh.count = this.activeBullets.length;
            
            // Update the instance matrix for this bullet
            this.updateBulletInstance(bullet);
        }
        
        return bullet;
    }
    
    // Update the instance matrix for a specific bullet
    updateBulletInstance(bullet) {
        if (bullet.instanceId === undefined || bullet.instanceId >= this.maxBullets) {
            return;
        }
        
        // Set position
        this.matrix.makeTranslation(
            bullet.position.x,
            bullet.position.y,
            bullet.position.z
        );
        
        // Set rotation to match direction
        if (bullet.direction.x !== 0 || bullet.direction.z !== 0) {
            const rotationMatrix = new THREE.Matrix4();
            const target = bullet.position.clone().add(bullet.direction);
            
            // Create a quaternion for the rotation
            const quaternion = new THREE.Quaternion();
            const up = new THREE.Vector3(0, 1, 0);
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bullet.direction);
            
            // Apply rotation
            rotationMatrix.makeRotationFromQuaternion(quaternion);
            this.matrix.multiply(rotationMatrix);
        }
        
        // Apply the matrix to the instance
        this.instancedMesh.setMatrixAt(bullet.instanceId, this.matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }
    
    // Remove a bullet
    removeBullet(bullet) {
        // Find the bullet's index
        const index = this.activeBullets.indexOf(bullet);
        if (index === -1) return;
        
        // Remove the bullet
        this.activeBullets.splice(index, 1);
        
        // Update the count
        this.instancedMesh.count = this.activeBullets.length;
        
        // Update all bullet IDs and matrices after the removed one
        for (let i = index; i < this.activeBullets.length; i++) {
            this.activeBullets[i].instanceId = i;
            this.updateBulletInstance(this.activeBullets[i]);
        }
    }
    
    // Update all bullets
    update(dt) {
        const bulletsToRemove = [];
        
        // Update all bullets
        for (const bullet of this.activeBullets) {
            // Update the bullet
            bullet.update(dt);
            
            // If the bullet is inactive, mark it for removal
            if (!bullet.isActive) {
                bulletsToRemove.push(bullet);
            } else {
                // Update the instance matrix
                this.updateBulletInstance(bullet);
            }
        }
        
        // Remove any inactive bullets
        for (const bullet of bulletsToRemove) {
            this.removeBullet(bullet);
        }
    }
    
    // Clean up resources
    cleanUp() {
        this.scene.remove(this.instancedMesh);
        this.instancedMesh.geometry.dispose();
        this.instancedMesh.material.dispose();
        this.activeBullets = [];
    }
}

export class OptimizedBullet {
    constructor(scene, position, direction, speedMultiplier = 1.0, decalManager, useInstance = false, color = COLORS.BULLET) {
        this.scene = scene;
        this.position = position.clone(); 
        this.direction = direction.clone().normalize();
        this.isActive = true;
        
        // Apply speed multiplier to allow for different speeds
        // Use the new SPEEDS.BULLET value from constants for consistent behavior
        this.speed = GAME.SPEEDS.BULLET * speedMultiplier;
        
        // Store initial position to track travel distance
        this.initialPosition = position.clone();
        this.maxTravelDistance = GAME.BULLET_MAX_DISTANCE;
        this.distanceTraveled = 0; // Initialize distance traveled
        
        this.attachedToEnemy = false;
        this.attachedEnemy = null;
        this.decalManager = decalManager;
        this.useInstance = useInstance;
        this.color = color; // Store the bullet color
        
        // Initialize arrays for tracking resources
        this.meshes = [];
        this.lights = [];
        
        // Only create a mesh if we're not using instanced rendering
        if (!useInstance) {
            // Create a simple cube for the bullet to match the square theme
            const geometry = new THREE.BoxGeometry(SIZES.BULLET, SIZES.BULLET, SIZES.BULLET); 
            const material = new THREE.MeshBasicMaterial({ color: this.color });
            this.mesh = new THREE.Mesh(geometry, material);
            this.mesh.position.copy(this.position);
            
            // Rotate the bullet to align with its direction of travel
            if (this.direction.x !== 0 || this.direction.z !== 0) {
                // Calculate the angle between direction vector and the z-axis
                this.mesh.rotation.y = Math.atan2(this.direction.x, this.direction.z);
            }
            
            this.scene.add(this.mesh);
        }
    }

    update(dt) {
        if (!this.isActive) return;
        
        // Update position
        const distance = this.speed * dt;
        this.position.add(this.direction.clone().multiplyScalar(distance));
        
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            // Rotate the bullet for better visual effect
            this.mesh.rotation.x += dt * 10;
            this.mesh.rotation.z += dt * 10;
        }
        
        // Update light position to follow bullet
        if (this.light) {
            this.light.position.copy(this.position);
        }
        
        // Calculate distance traveled from initial position
        const currentDistanceFromStart = this.position.distanceTo(this.initialPosition);
        this.distanceTraveled = currentDistanceFromStart;
        
        // Check if bullet has exceeded maximum distance
        if (this.distanceTraveled > this.maxTravelDistance) {

            this.deactivate(); // Just deactivate instead of exploding
        }
    }
    
    // Called when the bullet hits an enemy
    attachToEnemy(enemy) {
        this.attachedToEnemy = true;
        this.attachedEnemy = enemy;
        
        // Stop bullet's independent movement
        this.speed = 0;
    }
    
    // Create a decal instead of staying as a 3D object
    createImpactDecal(position, normal, object) {

        // If we have a decal manager, create a decal
        if (this.decalManager) {
            // Determine if this is a ground hit or an object hit
            if (normal && Math.abs(normal.y) > 0.9) {
                // Ground hit - create a ground splatter
                this.decalManager.createGroundSplat(position, 0.7, this.color);
            } else {
                // Object hit - create a surface decal
                this.decalManager.createSurfaceDecal(position, normal, object, this.color);
            }
        }
        
        // Deactivate the bullet
        this.deactivate();
    }

    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Cancel all pending animations
        if (this.animationIds && Array.isArray(this.animationIds)) {
            this.animationIds.forEach(id => {
                cancelAnimationFrame(id);
            });
            this.animationIds = [];
        }
        
        // Remove bullet mesh if it exists
        if (this.mesh && !this.useInstance) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
        
        // Remove light if it exists
        if (this.light) {
            this.scene.remove(this.light);
            this.light = null;
        }
        
        // Clean up all tracked objects (only if arrays exist)
        if (this.meshes && Array.isArray(this.meshes)) {
            this.meshes.forEach(mesh => {
                if (mesh && mesh.parent) {
                    this.scene.remove(mesh);
                    if (mesh.geometry) mesh.geometry.dispose();
                    if (mesh.material) mesh.material.dispose();
                }
            });
            this.meshes = [];
        }
        
        if (this.lights && Array.isArray(this.lights)) {
            this.lights.forEach(light => {
                if (light && light.parent) {
                    this.scene.remove(light);
                }
            });
            this.lights = [];
        }
        
        // Clean up debris particles
        if (this.debrisParticles && Array.isArray(this.debrisParticles)) {
            this.debrisParticles.forEach(debris => {
                if (debris.mesh && debris.mesh.parent) {
                    this.scene.remove(debris.mesh);
                    if (debris.mesh.geometry) debris.mesh.geometry.dispose();
                    if (debris.mesh.material) debris.mesh.material.dispose();
                }
            });
            this.debrisParticles = [];
        }
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingRadius() {
        // Increase bullet collision radius to make hits easier
        const radius = SIZES.BULLET * 3.5;
        return radius; 
    }
}

// Add this after the last existing class
export class GrenadePool {
    constructor(scene, audioManager, decalManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.decalManager = decalManager;
        this.pool = [];
        this.poolSize = 5; // Adjust based on expected max simultaneous grenades
        this.activeGrenades = [];
        
        // Light optimization settings
        this.useLightsForEffects = false; // Set to false to use emissive materials instead of lights
        this.useSimpleBlending = true;    // Set to true to use normal blending instead of additive
        
        // Shared resources for all grenades
        this.sharedGeometries = {
            grenade: new THREE.DodecahedronGeometry(0.3, 0),
            ring: new THREE.RingGeometry(0.08, 0.4, 8),
            particle: new THREE.SphereGeometry(0.15, 6, 6),
            debris: {
                shard: new THREE.ConeGeometry(0.2, 0.8, 3),
                chunk: new THREE.DodecahedronGeometry(0.3, 0),
                splinter: new THREE.BoxGeometry(0.1, 0.6, 0.1),
                plate: new THREE.BoxGeometry(0.4, 0.1, 0.4),
                miniGrenade: new THREE.SphereGeometry(0.15, 6, 6)
            }
        };
        
        // Get the blend mode based on settings
        const blendMode = this.useSimpleBlending ? THREE.NormalBlending : THREE.AdditiveBlending;
        
        this.sharedMaterials = {
            grenade: new THREE.MeshPhongMaterial({ 
                color: 0xff3300, 
                emissive: 0xff5500,            // Brighter emissive to compensate for no light
                emissiveIntensity: 0.8,        // Higher intensity
                shininess: 80
            }),
            explosion: new THREE.MeshBasicMaterial({
                color: 0x9B870C,
                transparent: true,
                opacity: 1.0,
                side: THREE.DoubleSide,
                blending: blendMode            // Use normal blending instead of additive
            }),
            debris1: new THREE.MeshPhongMaterial({
                color: 0x9B870C,
                emissive: 0x9B870C,
                emissiveIntensity: 0.4,        // Increased from 0.3
                shininess: 40,
                flatShading: true
            }),
            debris2: new THREE.MeshPhongMaterial({
                color: 0x777777,
                emissive: 0x444444,
                emissiveIntensity: 0.2,        // Increased from 0.1
                shininess: 60,
                flatShading: true
            }),
            trailParticle: new THREE.MeshBasicMaterial({
                color: 0xff5500,
                transparent: true,
                opacity: 0.8,
                blending: blendMode            // Use normal blending instead of additive
            })
        };
        
        // Initialize the pool
        this.initPool();
    }
    
    initPool() {
        for (let i = 0; i < this.poolSize; i++) {
            const grenade = new Grenade(
                this.scene, 
                new THREE.Vector3(), 
                new THREE.Vector3(),
                this.audioManager,
                this.decalManager
            );
            
            // Assign shared resources
            grenade.sharedGeometries = this.sharedGeometries;
            grenade.sharedMaterials = this.sharedMaterials;
            
            // Configure light optimization settings
            grenade.useLights = this.useLightsForEffects;
            
            // Deactivate immediately
            grenade.deactivate(true);
            
            this.pool.push(grenade);
        }
    }
    
    getGrenade(position, direction) {
        // Try to get a grenade from the pool
        let grenade = this.pool.find(g => !g.isActive);
        
        // If no grenade is available, create a new one or reuse oldest one
        if (!grenade) {

            grenade = new Grenade(
                this.scene, 
                position, 
                direction,
                this.audioManager,
                this.decalManager
            );
            grenade.sharedGeometries = this.sharedGeometries;
            grenade.sharedMaterials = this.sharedMaterials;
            grenade.useLights = this.useLightsForEffects; // Set lighting optimization
        } else {
            // Remove from pool
            this.pool.splice(this.pool.indexOf(grenade), 1);
            
            // Reset the grenade
            grenade.reset(position, direction);
        }
        
        // Add to active grenades
        this.activeGrenades.push(grenade);
        
        return grenade;
    }
    
    recycleGrenade(grenade) {
        // Remove from active grenades
        const index = this.activeGrenades.indexOf(grenade);
        if (index !== -1) {
            this.activeGrenades.splice(index, 1);
        }
        
        // Add back to pool
        this.pool.push(grenade);
    }
    
    update(dt) {
        // Update all active grenades
        for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
            const grenade = this.activeGrenades[i];
            grenade.update(dt);
            
            // Check if grenade is no longer active
            if (!grenade.isActive) {
                this.recycleGrenade(grenade);
            }
        }
    }
    
    cleanup() {
        // Dispose of all shared resources
        Object.values(this.sharedGeometries).forEach(geometry => {
            if (typeof geometry === 'object' && geometry !== null) {
                if (geometry.dispose) {
                    geometry.dispose();
                } else {
                    // If it's an object of geometries
                    Object.values(geometry).forEach(subGeometry => {
                        if (subGeometry && subGeometry.dispose) {
                            subGeometry.dispose();
                        }
                    });
                }
            }
        });
        
        Object.values(this.sharedMaterials).forEach(material => {
            if (material && material.dispose) {
                material.dispose();
            }
        });
        
        // Clean up all grenades
        [...this.pool, ...this.activeGrenades].forEach(grenade => {
            if (grenade && grenade.deactivate) {
                grenade.deactivate(true);
            }
        });
        
        this.pool = [];
        this.activeGrenades = [];
    }
}

export class BossBullet extends OptimizedBullet {
    constructor(scene, position, direction, speedMultiplier = 1.0, decalManager, audioManager, useInstance = false) {
        // Call the parent constructor with specific boss bullet color
        super(scene, position, direction, speedMultiplier, decalManager, useInstance, COLORS.BOSS_BULLET);
        
        this.audioManager = audioManager;
        // Use the same explosion radius as grenade
        this.explosionRadius = GAME.GRENADE_EXPLOSION_RADIUS;
        this.hasExploded = false;
        this.explosionActive = false;
        
        // Increase the size of the bullet (but less than before)
        if (this.mesh) {
            this.mesh.scale.set(1.4, 1.4, 1.4); // Reduced from 1.7
        }
        
        // Track created objects for cleanup (do this before adding any objects)
        this.meshes = [];
        this.lights = [];
        this.trailParticles = [];
        this.debrisParticles = [];
        this.animationIds = [];
        
        // Add support for shared resources
        this.sharedGeometries = null;
        this.sharedMaterials = null;
        
        // Light optimization flag
        this.useLights = false; // Set to false to use emissive materials instead of lights
        
        // Add a glow effect to the bullet
        this.addGlowEffect();
    }
    
    // Add a method to set shared resources
    setSharedResources(geometries, materials) {
        this.sharedGeometries = geometries;
        this.sharedMaterials = materials;
        return this;
    }
    
    addGlowEffect() {
        if (this.useLights) {
            // Add point light following the bullet for glow effect (reduced intensity)
            this.light = new THREE.PointLight(COLORS.BOSS_BULLET, 0.7, 2.5); // Reduced from 1, 3
            this.light.position.copy(this.position);
            this.scene.add(this.light);
            this.lights.push(this.light);
        } else {
            // Instead of a light, create a glow sphere with emissive material
            const glowGeometry = new THREE.SphereGeometry(1.0, 8, 8);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: COLORS.BOSS_BULLET,
                transparent: true,
                opacity: 0.3,
                blending: THREE.NormalBlending
            });
            
            this.glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
            this.glowMesh.scale.set(1.8, 1.8, 1.8);
            
            // Add the glow as a child of the mesh so it follows automatically
            if (this.mesh) {
                this.mesh.add(this.glowMesh);
                
                // Also increase the emissive value of the main mesh
                if (this.mesh.material) {
                    this.mesh.material.emissive = new THREE.Color(COLORS.BOSS_BULLET);
                    this.mesh.material.emissiveIntensity = 0.8;
                }
            }
        }
    }
    
    // Override createImpactDecal to make boss bullets explode on impact
    createImpactDecal(position, normal, object) {

        // Call explode instead of creating a decal
        this.position.copy(position); // Set explosion position to impact point
        this.explode();
    }
    
    update(dt) {
        if (!this.isActive) return;
        
        // Update position
        const distance = this.speed * dt;
        this.position.add(this.direction.clone().multiplyScalar(distance));
        
        if (this.mesh) {
            this.mesh.position.copy(this.position);
            // Rotate the bullet for better visual effect
            this.mesh.rotation.x += dt * 10;
            this.mesh.rotation.z += dt * 10;
        }
        
        // Update light position to follow bullet
        if (this.light) {
            this.light.position.copy(this.position);
        }
        
        // Calculate distance traveled from initial position
        const currentDistanceFromStart = this.position.distanceTo(this.initialPosition);
        this.distanceTraveled = currentDistanceFromStart;
        
        // Check if bullet has exceeded maximum distance
        if (this.distanceTraveled > this.maxTravelDistance) {

            this.explode(); // Explode when max distance reached
        }
    }
    
    explode() {
        if (!this.isActive || this.hasExploded) return;
        

        
        this.hasExploded = true;
        this.explosionActive = true;
        
        // Play explosion sound
        if (this.audioManager) {
            this.audioManager.playGrenadeExplosion();
        }
        
        // Create explosion splat on ground
        if (this.decalManager) {
            const splatPosition = this.position.clone();
            splatPosition.y = 0.02;
            this.decalManager.createGroundSplat(splatPosition, this.explosionRadius * 1.2, COLORS.BOSS_BULLET);
        }
        
        // Hide the bullet
        if (this.mesh) {
            this.mesh.visible = false;
        }
        
        // Create initial flash effect (sphere that quickly expands and fades)
        // Use shared resources if available
        const flashGeometry = this.sharedGeometries && this.sharedGeometries.particle ? 
            this.sharedGeometries.particle : 
            new THREE.SphereGeometry(0.3, 8, 8); // Reduced segments from 16 to 8
        
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00, // Bright yellow flash
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending
        });
        
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flash.position.copy(this.position);
        this.scene.add(flash);
        this.meshes.push(flash);
        
        // Very bright point light for initial flash
        const flashLight = new THREE.PointLight(0xffff00, 15, this.explosionRadius * 2);
        flashLight.position.copy(this.position);
        this.scene.add(flashLight);
        this.lights.push(flashLight);
        
        // Animate the flash quickly - use more efficient animation technique
        let flashTime = 0;
        const flashDuration = 200;
        let lastFlashTime = performance.now();
        let flashAnimationId;
        
        const animateFlash = () => {
            const now = performance.now();
            flashTime += now - lastFlashTime;
            lastFlashTime = now;
            
            const progress = flashTime / flashDuration;
            
            if (progress < 1) {
                const scale = 1 + progress * 5;
                flash.scale.set(scale, scale, scale);
                flashMaterial.opacity = 1.0 * (1 - progress);
                flashLight.intensity = 15 * (1 - progress);
                
                flashAnimationId = requestAnimationFrame(animateFlash);
                this.animationIds.push(flashAnimationId);
            } else {
                // Cancel any pending animation frames
                if (flashAnimationId) {
                    cancelAnimationFrame(flashAnimationId);
                    const index = this.animationIds.indexOf(flashAnimationId);
                    if (index !== -1) this.animationIds.splice(index, 1);
                }
                
                this.scene.remove(flash);
                this.scene.remove(flashLight);
                // Only dispose if not using shared resources
                if (!this.sharedGeometries || !this.sharedGeometries.particle) {
                    flashGeometry.dispose();
                }
                flashMaterial.dispose();
            }
        };
        
        animateFlash();
        
        // Create main explosion effect
        this.createExplosionEffect();
        
        // Create debris flying out
        this.createDebrisEffect();
        
        // Disable explosion damage after a short delay
        this.explosionTimer = setTimeout(() => {
            this.explosionActive = false;
            // Don't deactivate yet - we want to keep the debris around for a bit
            setTimeout(() => {
                this.deactivate();
            }, 2000); // Keep debris for 2 seconds
        }, 400);
    }
    
    createExplosionEffect() {
        // Create a bright light at explosion center (reduced intensity and range)
        const explosionLight = new THREE.PointLight(0xff5500, 8, this.explosionRadius * 2.5);
        explosionLight.position.copy(this.position);
        explosionLight.position.y = this.explosionRadius * 0.4;
        this.scene.add(explosionLight);
        this.lights.push(explosionLight);
        
        // Create explosion particles (significantly reduced count)
        const particleCount = 15; // Reduced from 250
        
        // Use shared geometry if available or create a new one
        let particles;
        let particleMaterial;
        
        if (this.sharedGeometries && this.sharedMaterials) {
            // Create particles using shared resources but with unique positions
            particles = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            
            // Set positions and colors
            for (let i = 0; i < particleCount; i++) {
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.random() * Math.PI;
                const radius = Math.random() * this.explosionRadius * 1.3;
                
                positions[i * 3] = this.position.x + radius * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = this.position.y + radius * Math.sin(phi) * Math.sin(theta);
                positions[i * 3 + 2] = this.position.z + radius * Math.cos(phi);
                
                // Set particle color (orange-yellow)
                colors[i * 3] = 1.0;
                colors[i * 3 + 1] = 0.7;
                colors[i * 3 + 2] = 0.2;
            }
            
            particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            // Use a clone of the shared material to avoid affecting other instances
            particleMaterial = this.sharedMaterials.explosion.clone();
            particleMaterial.size = 0.4;
            particleMaterial.vertexColors = true;
        } else {
            // Create particles the original way
            particles = new THREE.BufferGeometry();
            const positions = new Float32Array(particleCount * 3);
            const colors = new Float32Array(particleCount * 3);
            
            // Set positions and colors
            for (let i = 0; i < particleCount; i++) {
                const phi = Math.random() * Math.PI * 2;
                const theta = Math.random() * Math.PI;
                const radius = Math.random() * this.explosionRadius * 1.3;
                
                positions[i * 3] = this.position.x + radius * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = this.position.y + radius * Math.sin(phi) * Math.sin(theta);
                positions[i * 3 + 2] = this.position.z + radius * Math.cos(phi);
                
                // Set particle color (orange-yellow)
                colors[i * 3] = 1.0;
                colors[i * 3 + 1] = 0.7;
                colors[i * 3 + 2] = 0.2;
            }
            
            particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            particles.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            
            particleMaterial = new THREE.PointsMaterial({
                size: 0.4,
                vertexColors: true,
                blending: THREE.AdditiveBlending,
                transparent: true,
                sizeAttenuation: true,
                depthWrite: false
            });
        }
        
        const particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(particleSystem);
        this.meshes.push(particleSystem);
        
        // Create shockwave ring (simplified)
        const ringGeometry = this.sharedGeometries && this.sharedGeometries.ring ? 
            this.sharedGeometries.ring : 
            new THREE.RingGeometry(0.0, 0.2, 8);
        
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xff5500,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(this.position);
        ring.rotation.x = Math.PI / 2; // Align with ground
        this.scene.add(ring);
        this.meshes.push(ring);
        
        // Animate explosion (optimized)
        let explosionTime = 0;
        const explosionDuration = 600; // Reduced from 800ms
        let lastTime = performance.now();
        let explosionAnimId;
        
        const animateExplosion = () => {
            const now = performance.now();
            const deltaTime = Math.min(now - lastTime, 33); // Cap at ~30fps for better performance
            lastTime = now;
            
            explosionTime += deltaTime;
            const progress = explosionTime / explosionDuration;
            
            if (progress < 1) {
                // Scale ring with easing
                const easeOutQuad = 1 - Math.pow(1 - progress, 2);
                const ringScale = easeOutQuad * this.explosionRadius * 4;
                ring.scale.set(ringScale, ringScale, ringScale);
                ringMaterial.opacity = Math.max(0, 1 - progress * 1.5);
                
                // Fade explosion light
                explosionLight.intensity = 8 * (1 - progress);
                
                // Fade particles 
                particleMaterial.opacity = 1 - (progress * 0.8);
                
                explosionAnimId = requestAnimationFrame(animateExplosion);
                this.animationIds.push(explosionAnimId);
            } else {
                // Cancel any pending animation
                if (explosionAnimId) {
                    cancelAnimationFrame(explosionAnimId);
                    const index = this.animationIds.indexOf(explosionAnimId);
                    if (index !== -1) this.animationIds.splice(index, 1);
                }
                
                // Clean up resources
                this.scene.remove(explosionLight);
                this.scene.remove(particleSystem);
                this.scene.remove(ring);
                
                particleMaterial.dispose();
                particles.dispose();
                ringMaterial.dispose();
                
                // Only dispose geometry if not shared
                if (!this.sharedGeometries || !this.sharedGeometries.ring) {
                    ringGeometry.dispose();
                }
            }
        };
        
        explosionAnimId = requestAnimationFrame(animateExplosion);
        this.animationIds.push(explosionAnimId);
    }
    
    createDebrisEffect() {
        // Create a good number of debris pieces
        const debrisCount = 12;
        this.debrisParticles = [];
        
        // Get shared geometries if available
        const debrisGeometries = this.sharedGeometries ? this.sharedGeometries.debris : {
            shard: new THREE.ConeGeometry(0.2, 0.8, 3),
            chunk: new THREE.DodecahedronGeometry(0.3, 0),
            splinter: new THREE.BoxGeometry(0.1, 0.6, 0.1),
            plate: new THREE.BoxGeometry(0.4, 0.1, 0.4),
            miniGrenade: new THREE.SphereGeometry(0.15, 6, 6)
        };
        
        // Get shared materials if available
        const debrisMaterial = this.sharedMaterials ? this.sharedMaterials.debris1 : new THREE.MeshPhongMaterial({
            color: COLORS.BOSS_BULLET,
            emissive: COLORS.BOSS_BULLET,
            emissiveIntensity: 0.3,
            shininess: 40,
            flatShading: true
        });
        
        const debrisMaterial2 = this.sharedMaterials ? this.sharedMaterials.debris2 : new THREE.MeshPhongMaterial({
            color: 0x777777,
            emissive: 0x444444,
            emissiveIntensity: 0.1,
            shininess: 60,
            flatShading: true
        });
        
        for (let i = 0; i < debrisCount; i++) {
            // Direction calculation with reduced spread and height
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI / 3; // Reduced from PI/2 for less upward spread
            
            const direction = new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta) * 0.5, // Reduced from 1.5
                Math.random() * 0.4 + 0.2, // Reduced from 0.8 + 0.4
                Math.sin(phi) * Math.sin(theta) * 0.5  // Reduced from 1.5
            );
            
            // Select random geometry
            const geometryTypes = Object.keys(debrisGeometries);
            const geometry = debrisGeometries[geometryTypes[Math.floor(Math.random() * geometryTypes.length)]];
            
            // Alternate materials for variety
            const material = i % 2 === 0 ? debrisMaterial : debrisMaterial2;
            const debris = new THREE.Mesh(geometry, material);
            
            // Reduced scale range
            const baseScale = 0.4 + Math.random() * 0.4; // Reduced from 0.6 + 0.6
            debris.scale.setScalar(baseScale);
            
            debris.rotation.set(
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2,
                Math.random() * Math.PI * 2
            );
            
            // Reduced initial spread
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 0.2, // Reduced from 0.3
                (Math.random() - 0.5) * 0.2, // Reduced from 0.3
                (Math.random() - 0.5) * 0.2  // Reduced from 0.3
            );
            debris.position.copy(this.position).add(offset);
            this.scene.add(debris);
            
            // Enhanced physics parameters with reduced values
            this.debrisParticles.push({
                mesh: debris,
                direction: direction,
                speed: Math.random() * 0.3 + 0.2, // Reduced from 0.5 + 0.3
                rotationAxis: new THREE.Vector3(
                    Math.random() - 0.5,
                    Math.random() - 0.5,
                    Math.random() - 0.5
                ).normalize(),
                rotationSpeed: Math.random() * 0.1 + 0.05, // Reduced from 0.2 + 0.1
                bounceAmount: 0.3 + Math.random() * 0.2, // Reduced from 0.4 + 0.3
                elasticity: 0.5 + Math.random() * 0.2, // Reduced from 0.7 + 0.2
                spinDecay: 0.95 + Math.random() * 0.02, // Increased decay (was 0.97)
                gravity: 0.02 + Math.random() * 0.01, // Increased gravity (was 0.015)
                bounceCount: 0,
                maxBounces: Math.floor(Math.random() * 2) + 1, // Reduced from 3
                playedBounceSound: false,
                bounceSoundDelay: Math.random() * 200,
                settled: false
            });
        }
        
        // Animate debris with bouncing
        let lastFrameTime = performance.now();
        const targetFrameTime = 1000 / 60; // Target 60 FPS
        
        const animateDebris = () => {
            if (!this.isActive || !this.debrisParticles || this.debrisParticles.length === 0) return;
            
            const currentTime = performance.now();
            const deltaTime = Math.min((currentTime - lastFrameTime) / 1000, targetFrameTime / 1000);
            lastFrameTime = currentTime;
            
            let activeCount = 0;
            
            // Get arena boundaries from game constants
            const arenaHalfSize = GAME.ARENA_SIZE / 2;
            
            for (const debris of this.debrisParticles) {
                if (debris.settled) continue;
                activeCount++;
                
                // Apply velocity with deltaTime
                const frameSpeed = debris.speed * deltaTime * 60; // Normalize to 60 FPS
                debris.mesh.position.x += debris.direction.x * frameSpeed;
                debris.mesh.position.y += debris.direction.y * frameSpeed;
                debris.mesh.position.z += debris.direction.z * frameSpeed;
                
                // Apply rotation for spinning effect
                debris.mesh.rotateOnAxis(debris.rotationAxis, debris.rotationSpeed * deltaTime * 60);
                
                // Gravity with slightly slower fall for smaller debris
                const gravity = 0.06 * deltaTime * 60 * (1 - (debris.mesh.scale.x - 0.6) / 0.6 * 0.3);
                debris.direction.y -= gravity;
                
                // Wall collision checking with bouncing
                // X-axis walls
                if (Math.abs(debris.mesh.position.x) > arenaHalfSize - 0.5) {
                    // Hit left or right wall - reverse X direction with some energy loss
                    debris.direction.x *= -0.8;
                    
                    // Keep within bounds
                    if (debris.mesh.position.x > arenaHalfSize - 0.5) {
                        debris.mesh.position.x = arenaHalfSize - 0.5;
                    } else if (debris.mesh.position.x < -arenaHalfSize + 0.5) {
                        debris.mesh.position.x = -arenaHalfSize + 0.5;
                    }
                    
                    // Add some random variation to direction after bounce
                    debris.direction.z += (Math.random() - 0.5) * 0.3;
                    
                    // Play bounce sound occasionally for wall hits
                    if (this.audioManager && Math.random() < 0.3 && !debris.wallBounceSound) {
                        debris.wallBounceSound = true;
                        setTimeout(() => {
                            this.audioManager.playGrenadeBounce();
                        }, Math.random() * 100);
                    }
                }
                
                // Z-axis walls
                if (Math.abs(debris.mesh.position.z) > arenaHalfSize - 0.5) {
                    // Hit front or back wall - reverse Z direction with energy loss
                    debris.direction.z *= -0.8;
                    
                    // Keep within bounds
                    if (debris.mesh.position.z > arenaHalfSize - 0.5) {
                        debris.mesh.position.z = arenaHalfSize - 0.5;
                    } else if (debris.mesh.position.z < -arenaHalfSize + 0.5) {
                        debris.mesh.position.z = -arenaHalfSize + 0.5;
                    }
                    
                    // Add some random variation to direction after bounce
                    debris.direction.x += (Math.random() - 0.5) * 0.3;
                    
                    // Play bounce sound occasionally for wall hits
                    if (this.audioManager && Math.random() < 0.3 && !debris.wallBounceSound) {
                        debris.wallBounceSound = true;
                        setTimeout(() => {
                            this.audioManager.playGrenadeBounce();
                        }, Math.random() * 100);
                    }
                }
                
                // Ground collision with bouncing
                if (debris.mesh.position.y < 0.15) {
                    debris.bounceCount++;
                    debris.mesh.position.y = 0.15;
                    
                    // Play bounce sound for larger debris with random delay
                    if (this.audioManager && !debris.playedBounceSound && 
                        debris.mesh.scale.x > 0.8 && 
                        debris.bounceCount === 1) {
                        debris.playedBounceSound = true;
                        setTimeout(() => {
                            this.audioManager.playGrenadeBounce();
                        }, debris.bounceSoundDelay);
                    }
                    
                    if (debris.bounceCount >= debris.maxBounces || debris.speed < 0.05) {
                        debris.settled = true;
                        debris.mesh.position.y = 0.12;
                        
                        // Set final rotation once and stop updating
                        debris.mesh.rotation.set(
                            Math.random() < 0.5 ? 0 : Math.PI/2,
                            Math.random() * Math.PI * 2,
                            Math.random() < 0.5 ? 0 : Math.PI/4
                        );
                    } else {
                        // Energetic bounce
                        debris.direction.y = Math.abs(debris.direction.y) * debris.elasticity;
                        
                        // Reduce energy with each bounce
                        debris.elasticity *= 0.7;
                        debris.speed *= 0.8;
                        
                        // Reduce spin speed after bounces
                        debris.rotationSpeed *= debris.spinDecay;
                        
                        // Add random horizontal variation for more organic movement
                        debris.direction.x += (Math.random() - 0.5) * 0.2;
                        debris.direction.z += (Math.random() - 0.5) * 0.2;
                    }
                }
            }
            
            // Continue animation if any active debris remains
            if (activeCount > 0) {
                const animId = requestAnimationFrame(animateDebris);
                this.animationIds.push(animId);
            } else {
                // All debris has settled, fade them out after a delay
                setTimeout(() => {
                    this.fadeOutDebris();
                }, 2000);
            }
        };
        
        // Start the animation
        const animId = requestAnimationFrame(animateDebris);
        this.animationIds.push(animId);
    }
    
    fadeOutDebris() {
        if (!this.isActive || !this.debrisParticles || this.debrisParticles.length === 0) return;
        
        const fadeSpeed = 0.02;
        
        const fadeAnimation = () => {
            let stillVisible = false;
            
            for (const debris of this.debrisParticles) {
                if (!debris.mesh || !debris.mesh.material) continue;
                
                // Make sure material is set to transparent to enable fading
                if (!debris.mesh.material.transparent) {
                    debris.mesh.material.transparent = true;
                    debris.mesh.material.needsUpdate = true;
                }
                
                // Fade out the opacity
                if (debris.mesh.material.opacity > 0) {
                    debris.mesh.material.opacity -= fadeSpeed;
                    stillVisible = true;
                    
                    // If nearly transparent, just set to zero
                    if (debris.mesh.material.opacity < 0.05) {
                        debris.mesh.material.opacity = 0;
                    }
                }
            }
            
            if (stillVisible) {
                const animId = requestAnimationFrame(fadeAnimation);
                this.animationIds.push(animId);
            } else {
                // All debris faded out, now we can deactivate
                this.deactivate();
            }
        };
        
        // Start the fade animation
        const animId = requestAnimationFrame(fadeAnimation);
        this.animationIds.push(animId);
    }
    
    deactivate() {
        if (!this.isActive) return;
        
        this.isActive = false;
        
        // Cancel all pending animations
        if (this.animationIds && Array.isArray(this.animationIds)) {
            this.animationIds.forEach(id => {
                cancelAnimationFrame(id);
            });
            this.animationIds = [];
        }
        
        // Remove bullet mesh if it exists
        if (this.mesh && !this.useInstance) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
        
        // Remove light if it exists
        if (this.light) {
            this.scene.remove(this.light);
            this.light = null;
        }
        
        // Clean up all tracked objects (only if arrays exist)
        if (this.meshes && Array.isArray(this.meshes)) {
            this.meshes.forEach(mesh => {
                if (mesh && mesh.parent) {
                    this.scene.remove(mesh);
                    if (mesh.geometry) mesh.geometry.dispose();
                    if (mesh.material) mesh.material.dispose();
                }
            });
            this.meshes = [];
        }
        
        if (this.lights && Array.isArray(this.lights)) {
            this.lights.forEach(light => {
                if (light && light.parent) {
                    this.scene.remove(light);
                }
            });
            this.lights = [];
        }
        
        // Clean up debris particles
        if (this.debrisParticles && Array.isArray(this.debrisParticles)) {
            this.debrisParticles.forEach(debris => {
                if (debris.mesh && debris.mesh.parent) {
                    this.scene.remove(debris.mesh);
                    if (debris.mesh.geometry) debris.mesh.geometry.dispose();
                    if (debris.mesh.material) debris.mesh.material.dispose();
                }
            });
            this.debrisParticles = [];
        }
    }
    
    // Method for collision system to check
    isExplosionActive() {
        return this.explosionActive;
    }
    
    getExplosionRadius() {
        return this.explosionRadius;
    }
} 