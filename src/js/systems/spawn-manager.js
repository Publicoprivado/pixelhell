import * as THREE from 'three';
import { Enemy } from '../entities/enemy.js';
import { AmmoPack, EnergyPack } from '../entities/environment.js';
import { GAME, COLORS } from '../utils/constants.js';

export class SpawnManager {
    constructor(scene, player, collisionSystem, audioManager, decalManager) {
        this.scene = scene;
        this.player = player;
        this.collisionSystem = collisionSystem;
        this.audioManager = audioManager;
        this.decalManager = decalManager; // Store decalManager for enemy splats
        this.enemies = [];
        this.obstacles = [];
        this.lastSpawnTime = 0;
        this.spawnDelay = GAME.SPAWN_DELAY;
        this.enemyCount = 0;
        this.maxEnemies = 8; // Starting with 8 enemies in wave 1
        this.enemyBullets = [];
        this.ammoPickups = [];
        this.energyPickups = [];
        this.grenadePickups = [];
        this.waveNumber = 1;
        this.activeEnemies = []; // Track active enemies for updates
        this.enemySpeedMultiplier = 1.0; // Base speed multiplier for wave 1
        this.enemyFireRateMultiplier = 1.0; // Base fire rate multiplier for wave 1
        this.enemiesSpawnedThisWave = 0; // Track how many enemies have been spawned in current wave
        this.waveComplete = false; // Flag to track if wave is complete
    }
    
    setObstacles(obstacles) {
        this.obstacles = obstacles;
    }
    
    update(player, dt) {
        const now = Date.now();
        
        // Check if player is out of ammo - spawn ammo pickups if needed
        if (player && player.isOutOfAmmo()) {
            // Check if there are any active ammo pickups
            const activeAmmoPickups = this.ammoPickups.filter(a => a.isActive).length;
            
            // If no ammo pickups available, spawn one immediately
            if (activeAmmoPickups === 0) {
                this.spawnAmmoPack();
                
                // Optionally add a UI hint for the player
                this.showAmmoHint();
            }
            // If few ammo pickups, increase chance of more spawning
            else if (activeAmmoPickups < 3 && Math.random() < 0.05) {
                this.spawnAmmoPack();
            }
        }
        
        // Check if it's time to spawn new enemies
        if (now - this.lastSpawnTime > this.spawnDelay && 
            this.enemiesSpawnedThisWave < this.maxEnemies && 
            !this.waveComplete) {
            
            this.spawnEnemy();
            this.lastSpawnTime = now;
            this.enemiesSpawnedThisWave++;
            
            // Increase probability of pickups
            if (Math.random() < 0.5) { // 50% chance of any pickup (increased from 30%)
                const pickupType = Math.random();
                
                if (pickupType < 0.4) { // 40% chance for ammo
                    this.spawnAmmoPack();
                } else if (pickupType < 0.8) { // 40% chance for energy
                    this.spawnEnergyPack();
                } else { // 20% chance for grenade
                    this.spawnGrenadePack();
                }
            }
        }
        
        // Ensure there are always some pickups available
        // If no ammo pickups, spawn one occasionally
        if (this.ammoPickups.filter(a => a.isActive).length === 0 && Math.random() < 0.01) {
            this.spawnAmmoPack();
        }
        
        // If no grenade pickups, spawn one occasionally
        if (this.grenadePickups.filter(g => g.isActive).length === 0 && Math.random() < 0.01) {
            this.spawnGrenadePack();
        }
        
        // Update all active enemies with player position and delta time
        this.updateEnemies(dt);
        
        // Update enemy bullets with delta time
        this.updateEnemyBullets(dt);
        
        // Check if wave is complete when all enemies are defeated
        if (this.enemiesSpawnedThisWave >= this.maxEnemies && 
            this.activeEnemies.length === 0 && 
            !this.waveComplete) {
            this.waveComplete = true;
            
            // Start next wave after a short delay
            setTimeout(() => {
                this.startNextWave();
            }, 2000);
        }
    }
    
    updateEnemies(dt) {
        this.activeEnemies = this.activeEnemies.filter(enemy => {
            if (!enemy.isActive) return false;
            
            // Pass the actual delta time and player position
            enemy.update(dt, this.player.getPosition());
            return true;
        });
    }
    
    updateEnemyBullets(dt) {
        // Update each bullet and remove inactive ones
        this.enemyBullets = this.enemyBullets.filter(bullet => {
            if (bullet.isActive) {
                bullet.update(dt); // Use actual delta time
                return true;
            }
            return false;
        });
    }
    
    addEnemyBullet(bullet) {
        this.enemyBullets.push(bullet);
        // Add to collision system for player damage
        this.collisionSystem.addEnemyBullet(bullet);
    }
    
    spawnEnemy() {
        // Get a random position at the edge of the arena
        const position = this.getRandomSpawnPosition(this.player);
        
        // Choose a random enemy type based on probability
        const typeRandom = Math.random();
        let type = 'REGULAR';
        
        if (typeRandom < 0.2) {
            type = 'CHUBBY';
        } else if (typeRandom < 0.4) {
            type = 'THIN';
        }
        
        // Create the enemy and pass the spawn manager
        const enemy = new Enemy(this.scene, position, type, this);
        
        // Apply wave speed multiplier to enemy
        if (enemy.speed) {
            enemy.speed *= this.enemySpeedMultiplier;
        }
        
        // Apply fire rate multiplier to enemy
        if (enemy.shootingCooldown) {
            // Lower cooldown = faster firing
            enemy.shootingCooldown /= this.enemyFireRateMultiplier;
        }
        
        // Add to collision system
        this.collisionSystem.addEnemy(enemy);
        
        // Increment enemy count
        this.enemyCount++;
        
        // Add to active enemies
        this.activeEnemies.push(enemy);
        
        return enemy;
    }
    
    spawnAmmoPack() {
        // Get a random position within the arena
        const halfSize = GAME.ARENA_SIZE / 2 - 1;
        const x = (Math.random() * GAME.ARENA_SIZE - halfSize);
        const z = (Math.random() * GAME.ARENA_SIZE - halfSize);
        const position = new THREE.Vector3(x, 0, z);
        
        // Make sure it's not too close to an obstacle
        for (const obstacle of this.obstacles) {
            const obstaclePos = obstacle.getPosition();
            const distance = position.distanceTo(obstaclePos);
            
            if (distance < 2) {
                // Too close to obstacle, try again
                return this.spawnAmmoPack();
            }
        }
        
        // Create the ammo pack
        const ammoPack = new AmmoPack(this.scene, position, this.audioManager);
        
        // Add to collection and collision system
        this.ammoPickups.push(ammoPack);
        this.collisionSystem.addAmmoPack(ammoPack);
        
        return ammoPack;
    }
    
    spawnEnergyPack() {
        // Get a random position within the arena
        const halfSize = GAME.ARENA_SIZE / 2 - 1;
        const x = (Math.random() * GAME.ARENA_SIZE - halfSize);
        const z = (Math.random() * GAME.ARENA_SIZE - halfSize);
        const position = new THREE.Vector3(x, 0, z);
        
        // Make sure it's not too close to an obstacle
        for (const obstacle of this.obstacles) {
            const obstaclePos = obstacle.getPosition();
            const distance = position.distanceTo(obstaclePos);
            
            if (distance < 2) {
                // Too close to obstacle, try again
                return this.spawnEnergyPack();
            }
        }
        
        // Create the energy pack
        const energyPack = new EnergyPack(this.scene, position, this.audioManager);
        
        // Add to collection and collision system
        this.energyPickups.push(energyPack);
        this.collisionSystem.addEnergyPack(energyPack);
        
        return energyPack;
    }
    
    spawnGrenadePack() {
        // Get a random position within the arena
        const halfSize = GAME.ARENA_SIZE / 2 - 1;
        const x = (Math.random() * GAME.ARENA_SIZE - halfSize);
        const z = (Math.random() * GAME.ARENA_SIZE - halfSize);
        const position = new THREE.Vector3(x, 0, z);
        
        // Make sure it's not too close to an obstacle
        for (const obstacle of this.obstacles) {
            const obstaclePos = obstacle.getPosition();
            const distance = position.distanceTo(obstaclePos);
            
            if (distance < 2) {
                // Too close to obstacle, try again
                return this.spawnGrenadePack();
            }
        }
        
        // Create a grenade pickup
        const grenadePickup = new GrenadePack(this.scene, position, this.audioManager);
        
        // Add to collection
        this.grenadePickups.push(grenadePickup);
        
        // Add to collision system (will need to add this method to CollisionSystem)
        if (this.collisionSystem.addGrenadePack) {
            this.collisionSystem.addGrenadePack(grenadePickup);
        }
        
        return grenadePickup;
    }
    
    getRandomSpawnPosition(player) {
        const halfSize = GAME.ARENA_SIZE / 2;
        let x, z;
        
        // Decide which edge to spawn on
        const edge = Math.floor(Math.random() * 4);
        
        switch (edge) {
            case 0: // Top edge
                x = Math.random() * GAME.ARENA_SIZE - halfSize;
                z = -halfSize;
                break;
            case 1: // Right edge
                x = halfSize;
                z = Math.random() * GAME.ARENA_SIZE - halfSize;
                break;
            case 2: // Bottom edge
                x = Math.random() * GAME.ARENA_SIZE - halfSize;
                z = halfSize;
                break;
            case 3: // Left edge
                x = -halfSize;
                z = Math.random() * GAME.ARENA_SIZE - halfSize;
                break;
        }
        
        const position = new THREE.Vector3(x, 0, z);
        
        // Make sure it's not too close to the player
        const playerPos = player.getPosition();
        if (position.distanceTo(playerPos) < 5) {
            // Too close to player, try again
            return this.getRandomSpawnPosition(player);
        }
        
        return position;
    }
    
    enemyDefeated() {
        this.enemyCount--;
        
        // The wave completion check is now handled in the update method
    }
    
    startNextWave() {
        this.waveNumber++;
        
        // Increase enemy count by 20% each wave (rounded up)
        const baseEnemies = 8; // Wave 1 has 8 enemies
        this.maxEnemies = Math.ceil(baseEnemies * Math.pow(1.2, this.waveNumber - 1));
        
        // Increase enemy speed by 10% per wave
        this.enemySpeedMultiplier = 1.0 + (this.waveNumber - 1) * 0.1;
        
        // Increase enemy fire rate by 15% per wave
        this.enemyFireRateMultiplier = 1.0 + (this.waveNumber - 1) * 0.15;
        
        // Speed up spawn rate slightly (cap at 300ms minimum)
        this.spawnDelay = Math.max(300, GAME.SPAWN_DELAY - (this.waveNumber * 100));
        
        // Reset counters for the new wave
        this.enemiesSpawnedThisWave = 0;
        this.waveComplete = false;
        
        // Display wave announcement with additional info
        this.showWaveMessage();
        
        console.log(`Wave ${this.waveNumber}: ${this.maxEnemies} enemies, speed x${this.enemySpeedMultiplier.toFixed(1)}, fire rate x${this.enemyFireRateMultiplier.toFixed(1)}`);
    }
    
    showWaveMessage() {
        // Create wave announcement UI
        const waveMsg = document.createElement('div');
        waveMsg.style.position = 'absolute';
        waveMsg.style.top = '40%';
        waveMsg.style.left = '50%';
        waveMsg.style.transform = 'translate(-50%, -50%)';
        waveMsg.style.color = 'red';
        waveMsg.style.fontSize = '48px';
        waveMsg.style.fontFamily = '"Press Start 2P", cursive';
        waveMsg.style.textShadow = '2px 2px 4px black';
        waveMsg.style.zIndex = '1000';
        waveMsg.style.fontWeight = 'bold';
        waveMsg.textContent = `WAVE ${this.waveNumber}`;
        document.body.appendChild(waveMsg);
        
        // Create subtitle with enemy info
        const waveInfo = document.createElement('div');
        waveInfo.style.position = 'absolute';
        waveInfo.style.top = '47%';
        waveInfo.style.left = '50%';
        waveInfo.style.transform = 'translate(-50%, -50%)';
        waveInfo.style.color = 'orange';
        waveInfo.style.fontSize = '24px';
        waveInfo.style.fontFamily = '"Press Start 2P", cursive';
        waveInfo.style.textShadow = '2px 2px 4px black';
        waveInfo.style.zIndex = '1000';
        waveInfo.style.fontWeight = 'bold';
        waveInfo.textContent = `${this.maxEnemies} enemies - Speed x${this.enemySpeedMultiplier.toFixed(1)} - Fire Rate x${this.enemyFireRateMultiplier.toFixed(1)}`;
        document.body.appendChild(waveInfo);
        
        // Remove after 2.5 seconds
        setTimeout(() => {
            document.body.removeChild(waveMsg);
            document.body.removeChild(waveInfo);
        }, 2500);
    }
    
    // Add a method to show an ammo hint to the player
    showAmmoHint() {
        // Create UI message
        const hintMsg = document.createElement('div');
        hintMsg.style.position = 'absolute';
        hintMsg.style.top = '30%';
        hintMsg.style.left = '50%';
        hintMsg.style.transform = 'translate(-50%, -50%)';
        hintMsg.style.color = '#0088ff'; // Ammo color
        hintMsg.style.fontSize = '24px';
        hintMsg.style.fontFamily = '"Press Start 2P", cursive';
        hintMsg.style.textShadow = '2px 2px 4px black';
        hintMsg.style.zIndex = '1000';
        hintMsg.style.fontWeight = 'bold';
        hintMsg.style.padding = '10px 20px';
        hintMsg.style.background = 'rgba(0, 0, 0, 0.5)';
        hintMsg.style.borderRadius = '10px';
        hintMsg.style.border = '2px solid #0088ff';
        hintMsg.textContent = 'OUT OF AMMO - FIND AMMO PACKS!';
        document.body.appendChild(hintMsg);
        
        // Remove after 2.5 seconds
        setTimeout(() => {
            if (hintMsg.parentNode) {
                document.body.removeChild(hintMsg);
            }
        }, 2500);
    }
}

// Create GrenadePack class - similar to AmmoPack but for grenades
class GrenadePack {
    constructor(scene, position, audioManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.position = position.clone();
        this.isActive = true;
        this.rotationSpeed = 0.05; // Faster rotation than other pickups
        this.bounceSpeed = 3;      // Faster bounce
        this.bounceHeight = 0.2;   // Lower bounce height
        this.bounceTime = Math.random() * Math.PI * 2; // Random starting phase
        this.grenadeAmount = 1;    // Add 1 grenade per pickup
        this.baseHeight = 0.3;     // Lower base height
        
        this.createGrenadePack();
    }
    
    createGrenadePack() {
        // Create a group for the grenade pack
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.position.y = this.baseHeight;
        this.scene.add(this.group);
        
        // Create a larger grenade shape
        const bodyGeometry = new THREE.SphereGeometry(0.25, 8, 8); // Increased from 0.15
        const bodyMaterial = new THREE.MeshBasicMaterial({ 
            color: COLORS.GRENADE || 0x222222, // Black or GRENADE color
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.group.add(body);
        
        // Add a larger top cap
        const capGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 8); // Increased from 0.05/0.1
        const capMaterial = new THREE.MeshBasicMaterial({ color: 0xff5500 }); // Orange cap
        const cap = new THREE.Mesh(capGeometry, capMaterial);
        cap.position.y = 0.25; // Adjusted for larger size
        this.group.add(cap);
        
        // Add a point light for glow effect
        this.light = new THREE.PointLight(0xff5500, 0.8, 2);
        this.light.position.copy(this.position);
        this.light.position.y = this.baseHeight;
        this.scene.add(this.light);
        
        // Add a larger upward-pointing arrow for better visibility
        const arrowGeometry = new THREE.ConeGeometry(0.18, 0.4, 4); // Increased from 0.12/0.3
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff5500, // Orange
            transparent: true,
            opacity: 0.7
        });
        this.arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        this.arrow.position.copy(this.position);
        this.arrow.position.y = this.baseHeight + 0.6; // Lower arrow height
        this.scene.add(this.arrow);
    }
    
    update(dt) {
        if (!this.isActive) return;
        
        // Rotate
        this.group.rotation.y += this.rotationSpeed;
        
        // Bounce animation
        this.bounceTime += dt * this.bounceSpeed;
        const bounceOffset = Math.sin(this.bounceTime) * this.bounceHeight;
        this.group.position.y = this.baseHeight + bounceOffset;
        
        // Update light position
        this.light.position.copy(this.position);
        this.light.position.y = this.baseHeight + bounceOffset;
        
        // Update arrow position
        this.arrow.position.copy(this.position);
        this.arrow.position.y = this.baseHeight + 0.6 + bounceOffset * 0.5;
        this.arrow.rotation.y += 0.04; // Rotate the arrow
        
        // Pulse the arrow opacity
        this.arrow.material.opacity = 0.4 + Math.abs(Math.sin(this.bounceTime * 2)) * 0.6;
        
        // Pulse the light intensity
        const pulseIntensity = 0.8 + Math.abs(Math.sin(this.bounceTime * 2)) * 0.5;
        this.light.intensity = pulseIntensity;
    }
    
    pickup() {
        if (!this.isActive) return 0;
        
        this.isActive = false;
        
        // Remove group and other objects
        this.scene.remove(this.group);
        this.scene.remove(this.light);
        this.scene.remove(this.arrow);
        
        // Clean up geometries and materials
        this.group.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
        });
        this.arrow.geometry.dispose();
        this.arrow.material.dispose();
        
        // Play pickup sound
        this.audioManager.playPickup();
        
        return this.grenadeAmount;
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingRadius() {
        return 0.5; // Increased from 0.4 for easier pickup
    }
} 