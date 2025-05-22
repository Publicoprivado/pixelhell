import * as THREE from 'three';
import { SIZES, GAME } from '../utils/constants.js';
import { BossBullet } from '../entities/projectiles.js';

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
        
        // Spatial partitioning system for collision optimization
        this.spatialGrid = new Map();
        this.gridSize = 4; // 4x4 unit grid cells
        this.maxSearchRadius = 8; // Maximum radius to search for collisions
    }
    
    // Spatial Grid Helper Methods
    getGridKey(position) {
        const gridX = Math.floor(position.x / this.gridSize);
        const gridZ = Math.floor(position.z / this.gridSize);
        return `${gridX},${gridZ}`;
    }
    
    addToGrid(entity, position) {
        const key = this.getGridKey(position);
        if (!this.spatialGrid.has(key)) {
            this.spatialGrid.set(key, []);
        }
        this.spatialGrid.get(key).push(entity);
    }
    
    getNearbyEntities(position, searchRadius = this.maxSearchRadius) {
        const entities = [];
        const minGridX = Math.floor((position.x - searchRadius) / this.gridSize);
        const maxGridX = Math.floor((position.x + searchRadius) / this.gridSize);
        const minGridZ = Math.floor((position.z - searchRadius) / this.gridSize);
        const maxGridZ = Math.floor((position.z + searchRadius) / this.gridSize);
        
        for (let x = minGridX; x <= maxGridX; x++) {
            for (let z = minGridZ; z <= maxGridZ; z++) {
                const key = `${x},${z}`;
                if (this.spatialGrid.has(key)) {
                    entities.push(...this.spatialGrid.get(key));
                }
            }
        }
        return entities;
    }
    
    clearGrid() {
        this.spatialGrid.clear();
    }
    
    setPlayer(player) {
        this.player = player;
        if (player) {
            this.lastValidPlayerPosition.copy(player.getPosition());
            this.prevPlayerPosition.copy(player.getPosition());
        }
    }
    
    setBulletManager(bulletManager) {
        this.bulletManager = bulletManager;
    }
    
    setPickupEffectManager(pickupEffectManager) {
        this.pickupEffectManager = pickupEffectManager;
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
            this.prevPlayerPosition.copy(this.player.getPosition());
        }
        
        this.checkBulletCollisions();
        this.checkGrenadeCollisions();
        this.checkPlayerCollisions();
        this.checkEnemyCollisions();
        this.checkEnemyBulletCollisions();
        this.cleanupInactiveObjects();
    }
    
    // OPTIMIZED: Bullet collision detection with spatial partitioning
    checkBulletCollisions() {
        this.clearGrid();
        
        this.enemies.forEach(enemy => {
            if (enemy.isActive && !enemy.isDying) {
                this.addToGrid(enemy, enemy.getPosition());
            }
        });
        
        let bulletsToCheck = [...this.bullets];
        
        if (this.bulletManager && this.bulletManager.activeBullets) {
            bulletsToCheck = bulletsToCheck.concat(this.bulletManager.activeBullets);
        }
        
        bulletsToCheck.forEach(bullet => {
            if (!bullet.isActive || bullet.attachedToEnemy) return;
            
            const bulletPos = bullet.getPosition();
            const bulletRadius = bullet.getBoundingRadius();
            const isBossBullet = bullet instanceof BossBullet;
            
            if (isBossBullet && bullet.hasExploded && bullet.explosionActive) {
                const explosionRadius = bullet.getExplosionRadius();
                const nearbyEnemies = this.getNearbyEntities(bulletPos, explosionRadius);
                
                nearbyEnemies.forEach(enemy => {
                    if (!enemy.isActive) return;
                    
                    const enemyPos = enemy.getPosition();
                    const distance = bulletPos.distanceTo(enemyPos);
                    
                    if (distance < explosionRadius) {
                        const damageMultiplier = 1 - (distance / explosionRadius);
                        const damageAmount = Math.ceil(GAME.BOSS_BULLET_DAMAGE * damageMultiplier);
                        
                        enemy.takeDamage(damageAmount);
                        
                        const knockbackDirection = new THREE.Vector3()
                            .subVectors(enemyPos, bulletPos)
                            .normalize();
                        
                        const knockbackStrength = (explosionRadius - distance) / explosionRadius * 8;
                        
                        if (typeof enemy.blowAway === 'function') {
                            enemy.blowAway(knockbackDirection, knockbackStrength);
                        }
                    }
                });
                
                if (this.player) {
                    const playerPos = this.player.getPosition();
                    const distance = bulletPos.distanceTo(playerPos);
                    
                    if (distance < explosionRadius) {
                        const damageMultiplier = 0.5 * (1 - (distance / explosionRadius));
                        const damageAmount = Math.ceil(GAME.BOSS_BULLET_DAMAGE * damageMultiplier);
                        this.player.takeDamage(damageAmount);
                    }
                }
                return;
            }

            // Check obstacles
            for (const obstacle of this.obstacles) {
                if (obstacle.constructor.name === "Obstacle") continue;
                
                const obstacleBox = obstacle.getBoundingBox();
                const bulletSphere = new THREE.Sphere(bulletPos, bulletRadius);
                
                if (obstacleBox.intersectsSphere(bulletSphere)) {
                    if (isBossBullet && typeof bullet.createImpactDecal === 'function') {
                        const obstaclePos = obstacle.getPosition();
                        const normal = new THREE.Vector3().subVectors(bulletPos, obstaclePos).normalize();
                        bullet.createImpactDecal(bulletPos, normal, obstacle);
                    } else if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
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
                const distanceTraveled = bullet.position.distanceTo(bullet.initialPosition || bullet.position.clone());
                const splatThreshold = GAME.BULLET_MAX_DISTANCE * 0.1;
                
                if (distanceTraveled > splatThreshold) {
                    if (isBossBullet && typeof bullet.createImpactDecal === 'function') {
                        const groundNormal = new THREE.Vector3(0, 1, 0);
                        const groundPos = new THREE.Vector3(bulletPos.x, 0.01, bulletPos.z);
                        bullet.createImpactDecal(groundPos, groundNormal, null);
                    } else if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                        const groundNormal = new THREE.Vector3(0, 1, 0);
                        const groundPos = new THREE.Vector3(bulletPos.x, 0.01, bulletPos.z);
                        bullet.createImpactDecal(groundPos, groundNormal, null);
                    } else {
                        bullet.deactivate();
                    }
                    return;
                }
            }
            
            if (!bullet.isActive) return;
            
            // Use spatial grid for enemy collision
            const nearbyEnemies = this.getNearbyEntities(bulletPos, bulletRadius + 4);
            
            for (const enemy of nearbyEnemies) {
                if (!enemy.isActive || enemy.isDying) continue;
                
                const enemyPos = enemy.getPosition();
                const enemyRadius = enemy.getBoundingRadius();
                const distance = bulletPos.distanceTo(enemyPos);
                
                if (distance < bulletRadius + enemyRadius) {
                    const bulletsAttached = enemy.attachBullet(bullet);
                    
                    if (bulletsAttached >= 3) {
                        enemy.takeDamage(0, true);
                    }
                    break;
                }
            }
        });
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
                const pickupPosition = ammoPack.getPosition();
                const ammoAmount = ammoPack.pickup();
                this.player.addAmmo(ammoAmount);
                
                // Create pickup effect
                if (this.pickupEffectManager) {
                    this.pickupEffectManager.createPickupEffect(pickupPosition, 'ammo');
                }
            }
        });
        
        // Check grenade pickups
        this.grenadePickups.forEach(grenadePack => {
            if (!grenadePack.isActive) return;
            
            const distance = playerPos.distanceTo(grenadePack.getPosition());
            
            if (distance < playerRadius + grenadePack.getBoundingRadius()) {
                if (this.player.grenades < this.player.maxGrenades) {
                    const pickupPosition = grenadePack.getPosition();
                    const grenadeAmount = grenadePack.pickup();
                    this.player.addGrenades(grenadeAmount);
                    
                    // Create pickup effect
                    if (this.pickupEffectManager) {
                        this.pickupEffectManager.createPickupEffect(pickupPosition, 'grenade');
                    }
                }
            }
        });
        
        // Check energy pickups
        this.energyPickups.forEach(energyPack => {
            if (!energyPack.isActive) return;
            
            const distance = playerPos.distanceTo(energyPack.getPosition());
            
            if (distance < playerRadius + energyPack.getBoundingRadius()) {
                const pickupPosition = energyPack.getPosition();
                const energyAmount = energyPack.pickup();
                this.player.addEnergy(energyAmount);
                
                // Create pickup effect
                if (this.pickupEffectManager) {
                    this.pickupEffectManager.createPickupEffect(pickupPosition, 'energy');
                }
            }
        });
        
        // OBSTACLE COLLISION HANDLING
        let collidingObstacles = [];
        
        // DEBUG: Check if obstacles exist
        if (this.obstacles.length === 0) {
            console.warn("No obstacles in collision system!");
            this.player.movementPenalty = 1.0;
            return;
        }
        
        // Check for collisions with solid obstacles
        this.obstacles.forEach(obstacle => {
            // Skip grass obstacles (decorative only)
            if (obstacle.constructor.name === "Obstacle") return;
            
            const obstacleBox = obstacle.getBoundingBox();
            const playerSphere = new THREE.Sphere(playerPos, playerRadius);
            
            if (obstacleBox.intersectsSphere(playerSphere)) {
                collidingObstacles.push(obstacle);
            }
        });
        
        // No collision - player can move freely
        if (collidingObstacles.length === 0) {
            this.lastValidPlayerPosition.copy(playerPos);
            this.player.movementPenalty = 1.0;
            return;
        }
        
        const pushDirection = new THREE.Vector3();
        let totalPenetration = 0;
        
        collidingObstacles.forEach(obstacle => {
            const obstaclePos = obstacle.getPosition();
            const obstacleBox = obstacle.getBoundingBox();
            
            // Calculate obstacle effective radius
            const obstacleRadius = Math.max(
                (obstacleBox.max.x - obstacleBox.min.x) / 2,
                (obstacleBox.max.z - obstacleBox.min.z) / 2
            );
            
            // Direction away from obstacle
            const awayFromObstacle = new THREE.Vector3()
                .subVectors(playerPos, obstaclePos)
                .normalize();
            
            // Calculate penetration depth
            const distance = playerPos.distanceTo(obstaclePos);
            const requiredDistance = playerRadius + obstacleRadius;
            const penetration = Math.max(0, requiredDistance - distance);
            
            if (penetration > 0) {
                pushDirection.add(awayFromObstacle.multiplyScalar(penetration));
                totalPenetration += penetration;
            }
        });
        
        // Apply collision resolution
        if (pushDirection.lengthSq() > 0 && totalPenetration > 0) {
            pushDirection.normalize();
            
            if (totalPenetration > playerRadius * 2) {
                this.player.group.position.copy(this.prevPlayerPosition);
                this.player.position.copy(this.prevPlayerPosition);
            } else {
                // Minor collision - push player away
                const pushAmount = Math.min(totalPenetration * 1.2, 0.5);
                const pushVector = pushDirection.multiplyScalar(pushAmount);
                
                this.player.group.position.add(pushVector);
                this.player.position.add(pushVector);
            }
            
            this.player.movementPenalty = 0.7;
        }
    }
    
    checkGrenadeCollisions() {
        this.grenades.forEach(grenade => {
            if (!grenade.isActive || !grenade.hasExploded || (typeof grenade.isExplosionActive === 'function' && !grenade.isExplosionActive())) return;
            
            const grenadePos = grenade.getPosition();
            const explosionRadius = grenade.getExplosionRadius();
            
            this.enemies.forEach(enemy => {
                if (!enemy.isActive) return;
                
                const enemyPos = enemy.getPosition();
                const distance = grenadePos.distanceTo(enemyPos);
                
                if (distance < explosionRadius) {
                    const damageMultiplier = 1 - (distance / explosionRadius);
                    const damageAmount = Math.ceil(10 * damageMultiplier);
                    
                    enemy.takeDamage(damageAmount, false);
                    
                    const blowDirection = new THREE.Vector3()
                        .subVectors(enemyPos, grenadePos)
                        .normalize();
                    
                    const blowStrength = (explosionRadius - distance) / explosionRadius * 16;
                    enemy.blowAway(blowDirection, blowStrength);
                }
            });
            
            if (this.player) {
                const playerPos = this.player.getPosition();
                const distance = grenadePos.distanceTo(playerPos);
                
                if (distance < explosionRadius) {
                    const damageMultiplier = 0.5 * (1 - (distance / explosionRadius));
                    const damageAmount = Math.ceil(30 * damageMultiplier);
                    this.player.takeDamage(damageAmount);
                }
            }
        });
    }
    
    checkEnemyCollisions() {
        // Keep original enemy collision logic
        this.enemies.forEach(enemy => {
            if (!enemy.isActive) return;
            
            const enemyPos = enemy.getPosition();
            const enemyRadius = enemy.getBoundingRadius();
            const playerPos = this.player ? this.player.getPosition() : null;
            
            if (!enemy.prevPosition) {
                enemy.prevPosition = enemyPos.clone();
            }
            
            if (enemy.directionChangeCooldown === undefined) {
                enemy.directionChangeCooldown = 0;
                enemy.lastMajorDirectionChange = 0;
                enemy.directionSmoothingFactor = 0.1;
            }
            
            let collidingObstacles = [];
            let totalMoveDirection = new THREE.Vector3();
            
            for (const obstacle of this.obstacles) {
                if (obstacle.constructor.name === "Obstacle") continue;
                
                const obstacleBox = obstacle.getBoundingBox();
                
                let detectionMultiplier = 1.8;
                if (enemy.speed) {
                    detectionMultiplier += enemy.speed * 0.1;
                }
                
                if (enemy.type === 'THIN') {
                    detectionMultiplier += 0.3;
                }
                
                const inflatedSphere = new THREE.Sphere(enemyPos, enemyRadius * detectionMultiplier);
                if (obstacleBox.intersectsSphere(inflatedSphere)) {
                    collidingObstacles.push(obstacle);
                    
                    const obstaclePos = obstacle.getPosition();
                    const awayVector = new THREE.Vector3().subVectors(enemyPos, obstaclePos).normalize();
                    
                    const distToObstacle = enemyPos.distanceTo(obstaclePos);
                    const weight = 1.5 / Math.max(0.1, distToObstacle);
                    
                    totalMoveDirection.add(awayVector.multiplyScalar(weight));
                    
                    if (playerPos) {
                        const obstacleToEnemy = new THREE.Vector3().subVectors(enemyPos, obstaclePos);
                        const obstacleToPlayer = new THREE.Vector3().subVectors(playerPos, obstaclePos);
                        
                        const crossProduct = new THREE.Vector3().crossVectors(obstacleToEnemy, obstacleToPlayer);
                        
                        if (crossProduct.length() > 0.5) {
                            const obstacleId = obstacle.id || 
                                Math.floor(obstaclePos.x * 1000) + Math.floor(obstaclePos.z * 1000);
                            
                            const goClockwise = obstacleId % 2 === 0;
                            
                            const tangent = new THREE.Vector3();
                            if (goClockwise) {
                                tangent.set(-awayVector.z, 0, awayVector.x);
                            } else {
                                tangent.set(awayVector.z, 0, -awayVector.x);
                            }
                            
                            const tangentWeight = 2.5 / Math.max(0.2, distToObstacle);
                            totalMoveDirection.add(tangent.multiplyScalar(tangentWeight));
                        }
                    }
                }
            }
            
            if (collidingObstacles.length > 0) {
                if (totalMoveDirection.lengthSq() > 0) {
                    totalMoveDirection.normalize();
                    
                    let hasDirectCollision = false;
                    for (const obstacle of collidingObstacles) {
                        const obstacleBox = obstacle.getBoundingBox();
                        const enemySphere = new THREE.Sphere(enemyPos, enemyRadius);
                        
                        if (obstacleBox.intersectsSphere(enemySphere)) {
                            hasDirectCollision = true;
                            break;
                        }
                    }
                    
                    if (hasDirectCollision) {
                        const pushAmount = enemyRadius * 0.7;
                        enemy.position.add(totalMoveDirection.clone().multiplyScalar(pushAmount));
                        
                        if (enemy.mesh) {
                            enemy.mesh.position.copy(enemy.position);
                        }
                        
                        if (!enemy.avoidanceHistory) {
                            enemy.avoidanceHistory = totalMoveDirection.clone();
                        } else {
                            enemy.avoidanceHistory.lerp(totalMoveDirection, 0.5);
                            enemy.avoidanceHistory.normalize();
                        }
                        
                        if (enemy.direction) {
                            if (playerPos) {
                                const toPlayer = new THREE.Vector3().subVectors(playerPos, enemyPos).normalize();
                                const combinedDirection = totalMoveDirection.clone()
                                    .multiplyScalar(0.9)
                                    .add(toPlayer.multiplyScalar(0.1))
                                    .normalize();
                                
                                enemy.direction.lerp(combinedDirection, 0.7);
                                enemy.direction.normalize();
                            } else {
                                enemy.direction.lerp(totalMoveDirection, 0.7);
                                enemy.direction.normalize();
                            }
                        }
                        
                        enemy.lastMajorDirectionChange = Date.now();
                        enemy.directionChangeCooldown = 500;
                    }
                }
            } else {
                if (enemy.avoidanceHistory) {
                    enemy.avoidanceHistory.multiplyScalar(0.9);
                    if (enemy.avoidanceHistory.lengthSq() < 0.01) {
                        enemy.avoidanceHistory.set(0, 0, 0);
                    }
                }
            }
            
            // Enemy-to-enemy collision
            this.enemies.forEach(otherEnemy => {
                if (otherEnemy === enemy || !otherEnemy.isActive) return;
                
                const otherPos = otherEnemy.getPosition();
                const otherRadius = otherEnemy.getBoundingRadius();
                const minDistance = enemyRadius + otherRadius;
                
                const distanceBetween = enemyPos.distanceTo(otherPos);
                
                if (distanceBetween < minDistance) {
                    const separationVector = new THREE.Vector3().subVectors(enemyPos, otherPos).normalize();
                    const overlapAmount = minDistance - distanceBetween;
                    const pushAmount = overlapAmount * 0.5;
                    
                    enemy.position.add(separationVector.multiplyScalar(pushAmount));
                    if (enemy.mesh) {
                        enemy.mesh.position.copy(enemy.position);
                    }
                    
                    if (enemy.direction) {
                        const angle = Math.random() * Math.PI * 0.5 - Math.PI * 0.25;
                        const randomizedSeparation = new THREE.Vector3(
                            separationVector.x * Math.cos(angle) - separationVector.z * Math.sin(angle),
                            0,
                            separationVector.x * Math.sin(angle) + separationVector.z * Math.cos(angle)
                        );
                        
                        enemy.direction.lerp(randomizedSeparation, 0.4);
                        enemy.direction.normalize();
                    }
                }
            });
            
            enemy.prevPosition.copy(enemyPos);
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
            const isBossBullet = bullet instanceof BossBullet;
            
            if (isBossBullet && bullet.hasExploded && bullet.explosionActive) {
                const explosionRadius = bullet.getExplosionRadius();
                const distance = bulletPos.distanceTo(playerPos);
                
                if (distance < explosionRadius) {
                    const damageMultiplier = 0.5 * (1 - (distance / explosionRadius));
                    const damageAmount = Math.ceil(GAME.BOSS_BULLET_DAMAGE * damageMultiplier);
                    this.player.takeDamage(damageAmount);
                }
                return;
            }
            
            const distance = bulletPos.distanceTo(playerPos);
            if (distance < bulletRadius + playerRadius) {
                if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                    const hitPos = new THREE.Vector3().subVectors(bulletPos, playerPos).normalize();
                    hitPos.multiplyScalar(playerRadius * 0.9).add(playerPos);
                    bullet.createImpactDecal(hitPos, hitPos.clone().sub(playerPos).normalize(), null);
                } else {
                    bullet.deactivate();
                }
                
                this.player.takeDamage(20);
                return;
            }
            
            // Check obstacles
            for (const obstacle of this.obstacles) {
                if (obstacle.constructor.name === "Obstacle") continue;
                
                const obstacleBox = obstacle.getBoundingBox();
                const bulletSphere = new THREE.Sphere(bulletPos, bulletRadius);
                
                if (obstacleBox.intersectsSphere(bulletSphere)) {
                    if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
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
            if (bullet.isActive && bulletPos.y <= bulletRadius && bullet.direction && bullet.direction.y <= 0) {
                const distanceTraveled = bullet.position.distanceTo(bullet.initialPosition || bullet.position.clone());
                const splatThreshold = GAME.BULLET_MAX_DISTANCE * 0.1;
                
                if (distanceTraveled > splatThreshold) {
                    if (isBossBullet && typeof bullet.createImpactDecal === 'function') {
                        const groundNormal = new THREE.Vector3(0, 1, 0);
                        const groundPos = new THREE.Vector3(bulletPos.x, 0.01, bulletPos.z);
                        bullet.createImpactDecal(groundPos, groundNormal, null);
                    } else if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                        const groundNormal = new THREE.Vector3(0, 1, 0);
                        const groundPos = new THREE.Vector3(bulletPos.x, 0.01, bulletPos.z);
                        bullet.createImpactDecal(groundPos, groundNormal, null);
                    } else {
                        bullet.deactivate();
                    }
                    return;
                }
            }
            
            // Check max distance
            if (bullet.initialPosition && bullet.maxTravelDistance) {
                const distanceTraveled = bulletPos.distanceTo(bullet.initialPosition);
                if (distanceTraveled >= bullet.maxTravelDistance) {
                    if (bullet.constructor.name === "OptimizedBullet" && typeof bullet.createImpactDecal === 'function') {
                        const groundNormal = new THREE.Vector3(0, 1, 0);
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
        this.bullets = this.bullets.filter(bullet => bullet.isActive);
        this.grenades = this.grenades.filter(grenade => grenade.isActive);
        this.enemies = this.enemies.filter(enemy => enemy.isActive);
        this.ammoPickups = this.ammoPickups.filter(ammo => ammo.isActive);
        this.energyPickups = this.energyPickups.filter(energy => energy.isActive);
        this.grenadePickups = this.grenadePickups.filter(grenade => grenade.isActive);
        this.enemyBullets = this.enemyBullets.filter(bullet => bullet.isActive);
    }
    
    isPositionInsideObstacle(position, radius) {
        for (const obstacle of this.obstacles) {
            if (obstacle.constructor.name === "Obstacle") continue;
            
            const obstacleBox = obstacle.getBoundingBox();
            const testSphere = new THREE.Sphere(position, radius);
            
            if (obstacleBox.intersectsSphere(testSphere)) {
                return true;
            }
        }
        return false;
    }
    
    checkEnemyObstacleCollisions(enemy) {
        return false;
    }

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