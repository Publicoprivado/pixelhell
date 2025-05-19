import * as THREE from 'three';
import { GAME } from '../utils/constants.js';

export class CollisionSystem {
    constructor() {
        this.obstacles = [];
        this.enemies = [];
        this.bullets = [];
        this.grenades = [];
        this.ammoPickups = [];
        this.energyPickups = [];
        this.grenadePickups = [];
        this.enemyBullets = [];
        this.player = null;
        this.bulletManager = null;
        this.lastValidPlayerPosition = new THREE.Vector3();
        this.prevPlayerPosition = new THREE.Vector3();
    }
    
    setPlayer(player) {
        this.player = player;
        // Store initial position as valid
        if (player) {
            this.lastValidPlayerPosition.copy(player.getPosition());
            this.prevPlayerPosition.copy(player.getPosition());
        }
    }
    
    setBulletManager(bulletManager) {
        this.bulletManager = bulletManager;
    }
    
    addObstacle(obstacle) {
        this.obstacles.push(obstacle);
    }
    
    addEnemy(enemy) {
        this.enemies.push(enemy);
    }
    
    addBullet(bullet) {
        this.bullets.push(bullet);
    }
    
    addGrenade(grenade) {
        this.grenades.push(grenade);
    }
    
    addAmmoPack(ammoPack) {
        this.ammoPickups.push(ammoPack);
    }
    
    addEnergyPack(energyPack) {
        this.energyPickups.push(energyPack);
    }
    
    addGrenadePack(grenadePack) {
        this.grenadePickups.push(grenadePack);
    }
    
    addEnemyBullet(bullet) {
        this.enemyBullets.push(bullet);
    }
    
    update() {
        if (this.player) {
            // Save the player's position before any movement
            this.prevPlayerPosition.copy(this.player.getPosition());
        }
        
        this.checkBulletCollisions();
        this.checkGrenadeCollisions();
        this.checkPlayerCollisions();
        this.checkEnemyCollisions();
        this.checkEnemyBulletCollisions();
        this.cleanupInactiveObjects();
    }
    
    // Check if a position is inside any obstacle
    isPositionInsideObstacle(position, radius) {
        for (const obstacle of this.obstacles) {
            // Skip grass
            if (obstacle.constructor.name === "Obstacle") continue;
            
            const obstacleBox = obstacle.getBoundingBox();
            const testSphere = new THREE.Sphere(position, radius);
            
            if (obstacleBox.intersectsSphere(testSphere)) {
                return true;
            }
        }
        return false;
    }
    
    checkPlayerCollisions() {
        if (!this.player) return;
        
        const playerPos = this.player.getPosition();
        const playerRadius = this.player.getBoundingRadius();
        
        // Check ammo pickups
        this.ammoPickups.forEach(ammoPack => {
            if (!ammoPack.isActive) return;
            
            const distance = playerPos.distanceTo(ammoPack.getPosition());
            
            if (distance < playerRadius + ammoPack.getBoundingRadius()) {
                // Player collided with ammo pack
                const ammoAmount = ammoPack.pickup();
                // Add ammo to player
                this.player.addAmmo(ammoAmount);
            }
        });
        
        // Check grenade pickups
        this.grenadePickups.forEach(grenadePack => {
            if (!grenadePack.isActive) return;
            
            const distance = playerPos.distanceTo(grenadePack.getPosition());
            
            if (distance < playerRadius + grenadePack.getBoundingRadius()) {
                // Only pickup if player has less than max grenades
                if (this.player.grenades < this.player.maxGrenades) {
                    // Player collided with grenade pack
                    const grenadeAmount = grenadePack.pickup();
                    // Add grenades to player
                    this.player.addGrenades(grenadeAmount);
                }
            }
        });
        
        // Check energy pickups
        this.energyPickups.forEach(energyPack => {
            if (!energyPack.isActive) return;
            
            const distance = playerPos.distanceTo(energyPack.getPosition());
            
            if (distance < playerRadius + energyPack.getBoundingRadius()) {
                // Player collided with energy pack
                const energyAmount = energyPack.pickup();
                // Add energy to player
                this.player.addEnergy(energyAmount);
            }
        });
        
        // IMPROVED COLLISION HANDLING:
        // Check collisions with solid obstacles only
        let collidingObstacles = [];
        
        // First pass: gather all colliding obstacles
        this.obstacles.forEach(obstacle => {
            // Skip grass obstacles
            if (obstacle.constructor.name === "Obstacle") return;
            
            const obstacleBox = obstacle.getBoundingBox();
            const playerSphere = new THREE.Sphere(playerPos, playerRadius);
            
            // Check for collision with solid obstacle
            if (obstacleBox.intersectsSphere(playerSphere)) {
                collidingObstacles.push(obstacle);
            }
        });
        
        // If player is not colliding with any obstacle, update the last valid position
        if (collidingObstacles.length === 0) {
            this.lastValidPlayerPosition.copy(playerPos);
            // Always set movement penalty to 1.0 (no penalty)
            this.player.movementPenalty = 1.0;
            return;
        }
        
        // If colliding with one or more obstacles, handle sliding
        if (collidingObstacles.length > 0) {
            // Calculate slide direction based on all nearby obstacles
            const slideDirection = new THREE.Vector3();
            
            collidingObstacles.forEach(obstacle => {
                const obstaclePos = obstacle.getPosition();
                // Get vector pointing away from obstacle
                const awayVector = new THREE.Vector3().subVectors(playerPos, obstaclePos).normalize();
                // Add to total slide direction
                slideDirection.add(awayVector);
            });
            
            // Normalize the combined slide direction
            if (slideDirection.lengthSq() > 0) {
                slideDirection.normalize();
                
                // Calculate penetration depth (approximated)
                let maxPenetration = 0;
                collidingObstacles.forEach(obstacle => {
                    const obstacleBox = obstacle.getBoundingBox();
                    const playerSphere = new THREE.Sphere(playerPos, playerRadius);
                    const obstaclePos = obstacle.getPosition();
                    const distToCenter = playerPos.distanceTo(obstaclePos);
                    const boundingRadius = obstacle.constructor.getBoundingRadius 
                        ? obstacle.constructor.getBoundingRadius() 
                        : Math.max(
                            obstacleBox.max.x - obstacleBox.min.x,
                            obstacleBox.max.z - obstacleBox.min.z
                          ) / 2;
                    
                    const penetration = (playerRadius + boundingRadius) - distToCenter;
                    if (penetration > maxPenetration) {
                        maxPenetration = penetration;
                    }
                });
                
                // If penetration is too deep, revert to previous position
                if (maxPenetration > playerRadius) {
                    // Significant collision, revert to previous position
                    this.player.group.position.copy(this.prevPlayerPosition);
                    this.player.position.copy(this.prevPlayerPosition);
                } else {
                    // Slide the player along obstacles
                    const slideAmount = Math.min(maxPenetration * 1.1, 0.3); // Limit slide speed
                    
                    // Move player in slide direction
                    const slideMovement = slideDirection.clone().multiplyScalar(slideAmount);
                    this.player.group.position.add(slideMovement);
                    this.player.position.add(slideMovement);
                    
                    // Apply a small movement penalty when sliding
                    this.player.movementPenalty = 0.8;
                }
            }
        }
    }
    
    // Check enemy collisions with obstacles - completely rewritten
    checkEnemyCollisions() {
        this.enemies.forEach(enemy => {
            if (!enemy.isActive) return;
            
            const enemyPos = enemy.getPosition();
            const enemyRadius = enemy.getBoundingRadius();
            
            // Get player position for contextual obstacle avoidance
            const playerPos = this.player ? this.player.getPosition() : null;
            
            // Store previous position as a property if it doesn't exist
            if (!enemy.prevPosition) {
                enemy.prevPosition = enemyPos.clone();
            }
            
            // Initialize direction change cooldown if it doesn't exist
            if (enemy.directionChangeCooldown === undefined) {
                enemy.directionChangeCooldown = 0;
                enemy.lastMajorDirectionChange = 0;
                enemy.directionSmoothingFactor = 0.1; // Base smoothing - higher = more responsive
            }
            
            // Check collisions with all obstacles
            let collidingObstacles = [];
            let totalMoveDirection = new THREE.Vector3();
            
            // First gather all colliding obstacles
            for (const obstacle of this.obstacles) {
                // Skip grass
                if (obstacle.constructor.name === "Obstacle") continue;
                
                const obstacleBox = obstacle.getBoundingBox();
                
                // Calculate dynamic detection radius based on enemy speed and type
                let detectionMultiplier = 1.8; // Increased from 1.5 for earlier detection
                if (enemy.speed) {
                    // Faster enemies need more look-ahead distance
                    detectionMultiplier += enemy.speed * 0.1;
                }
                
                // Thin enemies get extra detection range since they're faster
                if (enemy.type === 'THIN') {
                    detectionMultiplier += 0.3;
                }
                
                // Check for potential collision using dynamic detection radius
                const inflatedSphere = new THREE.Sphere(enemyPos, enemyRadius * detectionMultiplier);
                if (obstacleBox.intersectsSphere(inflatedSphere)) {
                    collidingObstacles.push(obstacle);
                    
                    // Get repulsion vector (away from obstacle)
                    const obstaclePos = obstacle.getPosition();
                    const awayVector = new THREE.Vector3().subVectors(enemyPos, obstaclePos).normalize();
                    
                    // Weight by inverse distance (closer obstacles have more influence)
                    const distToObstacle = enemyPos.distanceTo(obstaclePos);
                    const weight = 1.5 / Math.max(0.1, distToObstacle);
                    
                    // Add to total movement direction
                    totalMoveDirection.add(awayVector.multiplyScalar(weight));
                    
                    // Add wall-following behavior
                    // If player is on the other side of the obstacle, try to go around it
                    if (playerPos) {
                        // Vector from obstacle to enemy
                        const obstacleToEnemy = new THREE.Vector3().subVectors(enemyPos, obstaclePos);
                        // Vector from obstacle to player
                        const obstacleToPlayer = new THREE.Vector3().subVectors(playerPos, obstaclePos);
                        
                        // Cross product to determine which side to go around
                        const crossProduct = new THREE.Vector3().crossVectors(obstacleToEnemy, obstacleToPlayer);
                        
                        // If cross product length is significant, it indicates player and enemy are on different sides
                        if (crossProduct.length() > 0.5) {
                            // Create tangent direction (perpendicular to away vector)
                            const tangent = new THREE.Vector3();
                            
                            // Determine the consistent side to travel around the obstacle
                            // This will be based on the obstacle ID or position to ensure consistent behavior
                            // If we don't have an obstacle ID, use a hash of its position
                            const obstacleId = obstacle.id || 
                                Math.floor(obstaclePos.x * 1000) + Math.floor(obstaclePos.z * 1000);
                            
                            // Get a consistent direction based on the obstacle
                            const goClockwise = obstacleId % 2 === 0;
                            
                            // Set tangent based on the consistent direction
                            if (goClockwise) {
                                tangent.set(-awayVector.z, 0, awayVector.x);
                            } else {
                                tangent.set(awayVector.z, 0, -awayVector.x);
                            }
                            
                            // Add tangent component for wall following (weighted by distance)
                            // Stronger wall following (increased from 1.5)
                            const tangentWeight = 2.5 / Math.max(0.2, distToObstacle);
                            totalMoveDirection.add(tangent.multiplyScalar(tangentWeight));
                        }
                    }
                }
            }
            
            // Process avoidance based on obstacles
            if (collidingObstacles.length > 0) {
                // If we have a direction to move
                if (totalMoveDirection.lengthSq() > 0) {
                    totalMoveDirection.normalize();
                    
                    // Check if the enemy actually intersects with any obstacle (not just in avoidance range)
                    let hasDirectCollision = false;
                    for (const obstacle of collidingObstacles) {
                        const obstacleBox = obstacle.getBoundingBox();
                        const enemySphere = new THREE.Sphere(enemyPos, enemyRadius);
                        
                        if (obstacleBox.intersectsSphere(enemySphere)) {
                            hasDirectCollision = true;
                            break;
                        }
                    }
                    
                    // Handle direct collision resolution
                    if (hasDirectCollision) {
                        // Immediate push out of obstacle
                        const pushAmount = enemyRadius * 0.7;
                        enemy.position.add(totalMoveDirection.clone().multiplyScalar(pushAmount));
                        
                        if (enemy.mesh) {
                            enemy.mesh.position.copy(enemy.position);
                        }
                        
                        // Initialize or update avoidance history with strong weighting to current direction
                        if (!enemy.avoidanceHistory) {
                            enemy.avoidanceHistory = totalMoveDirection.clone();
                        } else {
                            // Apply much stronger weight to current avoidance direction in a collision
                            enemy.avoidanceHistory.lerp(totalMoveDirection, 0.5);
                            enemy.avoidanceHistory.normalize();
                        }
                        
                        // Update direction with heavy weight to avoidance
                        if (enemy.direction) {
                            if (playerPos) {
                                const toPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos).normalize();
                                // 90% obstacle avoidance, 10% player direction for minimal influence
                                const combinedDirection = totalMoveDirection.clone()
                                    .multiplyScalar(0.9)
                                    .add(toPlayer.multiplyScalar(0.1))
                                    .normalize();
                                
                                // Apply high smoothing for direct collisions
                                enemy.direction.lerp(combinedDirection, 0.7);
                                enemy.direction.normalize();
                            } else {
                                // Just use avoidance if no player
                                enemy.direction.lerp(totalMoveDirection, 0.7);
                                enemy.direction.normalize();
                            }
                        }
                        
                        // Reset cooldown to prevent rapid changes after collision resolution
                        enemy.lastMajorDirectionChange = Date.now();
                        enemy.directionChangeCooldown = 500; // Half-second cooldown
                    }
                    // Handle obstacle proximity avoidance (not yet colliding)
                    else {
                        // Get the time since last major direction change
                        const now = Date.now();
                        const timeSinceLastChange = now - enemy.lastMajorDirectionChange;
                        
                        // Only make major direction changes after cooldown expires
                        if (timeSinceLastChange > enemy.directionChangeCooldown) {
                            // Apply movement inertia through avoidance history
                            if (!enemy.avoidanceHistory) {
                                enemy.avoidanceHistory = new THREE.Vector3();
                            }
                            
                            // Gradual blending of avoidance history (strong inertia)
                            enemy.avoidanceHistory.lerp(totalMoveDirection, 0.2);
                            enemy.avoidanceHistory.normalize();
                            
                            if (enemy.direction) {
                                // Get current direction
                                const currentDir = enemy.direction.clone();
                                
                                // Calculate new direction with player influence
                                let newDirection;
                                if (playerPos) {
                                    const toPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos).normalize();
                                    
                                    // Create blended direction: 20% toward player, 40% avoidance, 40% history
                                    newDirection = new THREE.Vector3()
                                        .addScaledVector(toPlayer, 0.2)
                                        .addScaledVector(totalMoveDirection, 0.4)
                                        .addScaledVector(enemy.avoidanceHistory, 0.4)
                                        .normalize();
                                } else {
                                    // No player, blend avoidance and history
                                    newDirection = new THREE.Vector3()
                                        .addScaledVector(totalMoveDirection, 0.5)
                                        .addScaledVector(enemy.avoidanceHistory, 0.5)
                                        .normalize();
                                }
                                
                                // Apply smooth transition to new direction with inertia
                                // Gradually increase responsiveness based on distance to obstacle
                                const closestObstacle = this.findClosestObstacle(enemyPos, collidingObstacles);
                                const distToClosest = closestObstacle ? 
                                    enemyPos.distanceTo(closestObstacle.getPosition()) : 999;
                                
                                // Dynamically adjust smoothing factor - closer = more responsive
                                const baseSmoothingFactor = enemy.directionSmoothingFactor;
                                const distanceFactor = Math.min(1, 1 - (distToClosest / (enemyRadius * 5)));
                                const smoothingFactor = baseSmoothingFactor + distanceFactor * 0.2;
                                
                                // Apply smoothed direction change
                                enemy.direction.lerp(newDirection, smoothingFactor);
                                enemy.direction.normalize();
                                
                                // If this was a significant direction change, update the timestamp
                                if (currentDir.angleTo(enemy.direction) > 0.3) { // ~17 degrees
                                    enemy.lastMajorDirectionChange = now;
                                    // Longer cooldown for non-urgent changes
                                    enemy.directionChangeCooldown = 300; // 300ms cooldown
                                }
                            }
                        }
                    }
                }
            } else {
                // Reset avoidance history when no obstacles are nearby
                if (enemy.avoidanceHistory) {
                    // Gradually fade out avoidance history instead of immediate reset
                    enemy.avoidanceHistory.multiplyScalar(0.9);
                    if (enemy.avoidanceHistory.lengthSq() < 0.01) {
                        enemy.avoidanceHistory.set(0, 0, 0);
                    }
                }
            }
            
            // Special case: check if enemy is stuck against another enemy
            this.enemies.forEach(otherEnemy => {
                if (otherEnemy === enemy || !otherEnemy.isActive) return;
                
                const otherPos = otherEnemy.getPosition();
                const otherRadius = otherEnemy.getBoundingRadius();
                const minDistance = enemyRadius + otherRadius;
                
                const distanceBetween = enemyPos.distanceTo(otherPos);
                
                if (distanceBetween < minDistance) {
                    // Enemies are overlapping - push them apart
                    const separationVector = new THREE.Vector3().subVectors(enemyPos, otherPos).normalize();
                    const overlapAmount = minDistance - distanceBetween;
                    const pushAmount = overlapAmount * 0.5; // Share the push equally
                    
                    // Move this enemy away
                    enemy.position.add(separationVector.multiplyScalar(pushAmount));
                    if (enemy.mesh) {
                        enemy.mesh.position.copy(enemy.position);
                    }
                    
                    // Adjust direction to avoid further collision
                    if (enemy.direction) {
                        // Add randomness to prevent symmetrical behavior
                        const angle = Math.random() * Math.PI * 0.5 - Math.PI * 0.25; // -45 to +45 degrees
                        const randomizedSeparation = new THREE.Vector3(
                            separationVector.x * Math.cos(angle) - separationVector.z * Math.sin(angle),
                            0,
                            separationVector.x * Math.sin(angle) + separationVector.z * Math.cos(angle)
                        );
                        
                        // Blend direction with separation vector - keep movement smooth
                        enemy.direction.lerp(randomizedSeparation, 0.4);
                        enemy.direction.normalize();
                    }
                }
            });
            
            // Store current position for next frame
            enemy.prevPosition.copy(enemyPos);
        });
    }
    
    checkBulletCollisions() {
        // Get all active bullets to check - from both our array and the BulletManager if available
        let bulletsToCheck = [...this.bullets];
        
        // Add bullets from BulletManager if available
        if (this.bulletManager && this.bulletManager.activeBullets) {
            bulletsToCheck = bulletsToCheck.concat(this.bulletManager.activeBullets);
        }
        
        
        bulletsToCheck.forEach(bullet => {
            if (!bullet.isActive || bullet.attachedToEnemy) return;
            
            const bulletPos = bullet.getPosition();
            const bulletRadius = bullet.getBoundingRadius();
            
            // Check collisions with obstacles
            for (const obstacle of this.obstacles) {
                // Skip grass obstacles
                if (obstacle.constructor.name === "Obstacle") continue;
                
                const obstacleBox = obstacle.getBoundingBox();
                
                // Create a sphere that represents the bullet
                const bulletSphere = new THREE.Sphere(bulletPos, bulletRadius);
                
                if (obstacleBox.intersectsSphere(bulletSphere)) {
                    // If this is an OptimizedBullet, create a decal instead of just deactivating
                    if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                        // Calculate impact position and normal
                        const obstaclePos = obstacle.getPosition();
                        const normal = new THREE.Vector3().subVectors(bulletPos, obstaclePos).normalize();
                        bullet.createImpactDecal(bulletPos, normal, obstacle);
                    } else {
                        bullet.deactivate();
                    }
                    break;
                }
            }
            
            // Check ground collision
            if (bullet.isActive && bulletPos.y <= bulletRadius && bullet.direction.y <= 0) {
                // We'll only create a ground decal if the bullet is genuinely hitting the ground (not just spawning near it)
                // Calculate vertical travel - did the bullet actually travel downward or was it just spawned close to the ground?
                const verticalTravel = bullet.initialPosition.y - bulletPos.y;
                
                // Only consider it a ground hit if it's fallen a bit or traveled a significant distance
                const distanceTraveled = bullet.position.distanceTo(bullet.initialPosition);
                
                // Use a fraction of max distance as threshold for creating splats
                const splatThreshold = GAME.BULLET_MAX_DISTANCE * 0.1;
                if (verticalTravel > 0.1 || distanceTraveled > splatThreshold) {
                    // If this is an OptimizedBullet, create a ground decal
                    if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                        // Ground normal is always up
                        const groundNormal = new THREE.Vector3(0, 1, 0);
                        // Position at ground level
                        const groundPos = new THREE.Vector3(bulletPos.x, 0.01, bulletPos.z);
                        bullet.createImpactDecal(groundPos, groundNormal, null);
                    } else {
                        bullet.deactivate();
                    }
                    return;
                }
            }
            
            // If bullet was deactivated by obstacle, skip enemy checks
            if (!bullet.isActive) return;
            
            // Check collisions with enemies
            for (const enemy of this.enemies) {
                if (!enemy.isActive || enemy.isDying) continue;
                
                const enemyPos = enemy.getPosition();
                const enemyRadius = enemy.getBoundingRadius();
                
                const distance = bulletPos.distanceTo(enemyPos);
                
                if (distance < bulletRadius + enemyRadius) {
                    // Bullet hit enemy - attach the bullet instead of deactivating
                    const bulletsAttached = enemy.attachBullet(bullet);
                    
                    // Check if enemy should die after 3 hits
                    if (bulletsAttached >= 3) {
                        enemy.takeDamage(0, true); // Force death check, no additional damage
                    }
                    
                    break;
                }
            }
        });
    }
    
    checkGrenadeCollisions() {
        this.grenades.forEach(grenade => {
            // Only check for collisions if the grenade has exploded and the explosion is active
            // This ensures debris particles left after explosion don't cause damage
            if (!grenade.isActive || !grenade.hasExploded || (typeof grenade.isExplosionActive === 'function' && !grenade.isExplosionActive())) return;
            
            const grenadePos = grenade.getPosition();
            const explosionRadius = grenade.getExplosionRadius();
            
            // Check collisions with enemies
            this.enemies.forEach(enemy => {
                if (!enemy.isActive) return;
                
                const enemyPos = enemy.getPosition();
                const distance = grenadePos.distanceTo(enemyPos);
                
                if (distance < explosionRadius) {
                    // Calculate damage based on distance from explosion center
                    const damageMultiplier = 1 - (distance / explosionRadius); // 100% damage at center, 0% at edge
                    const damageAmount = Math.ceil(10 * damageMultiplier); // Max damage of 10
                    
                    // Apply damage - should kill most enemies in one hit if close enough
                    enemy.takeDamage(damageAmount);
                    
                    // Apply knockback effect
                    if (enemy.isActive) {
                        const knockbackDirection = new THREE.Vector3()
                            .subVectors(enemyPos, grenadePos)
                            .normalize();
                        
                        const knockbackStrength = explosionRadius - distance;
                        
                        // Apply knockback if enemy mesh exists
                        if (enemy.mesh) {
                            enemy.mesh.position.add(
                                knockbackDirection.multiplyScalar(knockbackStrength * 0.5)
                            );
                            enemy.position.copy(enemy.mesh.position);
                        }
                    }
                }
            });
            
            // Check if player is in explosion radius
            if (this.player) {
                const playerPos = this.player.getPosition();
                const distance = grenadePos.distanceTo(playerPos);
                
                if (distance < explosionRadius) {
                    // Player takes less damage from own grenades
                    const damageMultiplier = 0.5 * (1 - (distance / explosionRadius));
                    const damageAmount = Math.ceil(30 * damageMultiplier); // Max damage of 15
                    
                    // Apply damage to player
                    this.player.takeDamage(damageAmount);
                }
            }
        });
    }
    
    checkEnemyBulletCollisions() {
        if (!this.player) return;
        
        const playerPos = this.player.getPosition();
        const playerRadius = this.player.getBoundingRadius();
        
        this.enemyBullets.forEach(bullet => {
            if (!bullet.isActive) return;
            
            const bulletPos = bullet.getPosition();
            const bulletRadius = bullet.getBoundingRadius();
            
            // Check collision with player
            const distance = bulletPos.distanceTo(playerPos);
            if (distance < bulletRadius + playerRadius) {
                // Bullet hit player
                // If this is an OptimizedBullet, create a decal on hit
                if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                    // Calculate impact position (slightly in front of player to avoid z-fighting)
                    const hitPos = new THREE.Vector3().subVectors(bulletPos, playerPos).normalize();
                    hitPos.multiplyScalar(playerRadius * 0.9).add(playerPos);
                    
                    // Create decal with player hit normal
                    bullet.createImpactDecal(hitPos, hitPos.clone().sub(playerPos).normalize(), null);
                } else {
                    bullet.deactivate();
                }
                
                this.player.takeDamage(20); // Each bullet deals 20 damage
                return;
            }
            
            // Check collisions with obstacles
            for (const obstacle of this.obstacles) {
                // Skip grass obstacles
                if (obstacle.constructor.name === "Obstacle") continue;
                
                const obstacleBox = obstacle.getBoundingBox();
                const bulletSphere = new THREE.Sphere(bulletPos, bulletRadius);
                
                if (obstacleBox.intersectsSphere(bulletSphere)) {
                    // If this is an OptimizedBullet, create a decal
                    if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                        // Calculate impact position and normal
                        const obstaclePos = obstacle.getPosition();
                        const normal = new THREE.Vector3().subVectors(bulletPos, obstaclePos).normalize();
                        bullet.createImpactDecal(bulletPos, normal, obstacle);
                    } else {
                        bullet.deactivate();
                    }
                    return;
                }
            }
            
            // Check ground collision
            if (bullet.isActive && bulletPos.y <= bulletRadius && bullet.direction.y <= 0) {
                // For ground collisions, only create splats after traveling some distance
                const distanceTraveled = bullet.position.distanceTo(bullet.initialPosition);
                
                // Use the same formula as player bullets for splat distance threshold
                const splatThreshold = GAME.BULLET_MAX_DISTANCE * 0.1;
                
                if (distanceTraveled > splatThreshold) {
                    // If this is an OptimizedBullet, create a ground decal
                    if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                        // Ground normal is always up
                        const groundNormal = new THREE.Vector3(0, 1, 0);
                        // Position at ground level
                        const groundPos = new THREE.Vector3(bulletPos.x, 0.01, bulletPos.z);
                        bullet.createImpactDecal(groundPos, groundNormal, null);
                    } else {
                        bullet.deactivate();
                    }
                    return;
                }
            }
            
            // Check if bullet has traveled its maximum distance
            if (bullet.initialPosition && bullet.maxTravelDistance) {
                const distanceTraveled = bulletPos.distanceTo(bullet.initialPosition);
                if (distanceTraveled >= bullet.maxTravelDistance) {
                    // If this is an OptimizedBullet, create a ground decal at max distance
                    if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                        // Ground normal is always up
                        const groundNormal = new THREE.Vector3(0, 1, 0);
                        // Position at ground level
                        const groundPos = new THREE.Vector3(bulletPos.x, 0.01, bulletPos.z);
                        bullet.createImpactDecal(groundPos, groundNormal, null);
                    } else {
                        bullet.deactivate();
                    }
                }
            }
        });
    }
    
    cleanupInactiveObjects() {
        // Remove inactive objects from arrays
        this.bullets = this.bullets.filter(bullet => bullet.isActive);
        this.grenades = this.grenades.filter(grenade => grenade.isActive);
        this.enemies = this.enemies.filter(enemy => enemy.isActive);
        this.ammoPickups = this.ammoPickups.filter(ammo => ammo.isActive);
        this.energyPickups = this.energyPickups.filter(energy => energy.isActive);
        this.grenadePickups = this.grenadePickups.filter(grenade => grenade.isActive);
        this.enemyBullets = this.enemyBullets.filter(bullet => bullet.isActive);
    }
    
    // This method is no longer needed
    checkEnemyObstacleCollisions(enemy) {
        // Functionality now handled by checkEnemyCollisions
        return false;
    }

    // Helper method to find closest obstacle
    findClosestObstacle(position, obstacles) {
        let closestDist = Infinity;
        let closestObstacle = null;
        
        obstacles.forEach(obstacle => {
            const obstaclePos = obstacle.getPosition();
            const dist = position.distanceTo(obstaclePos);
            if (dist < closestDist) {
                closestDist = dist;
                closestObstacle = obstacle;
            }
        });
        
        return closestObstacle;
    }
} 