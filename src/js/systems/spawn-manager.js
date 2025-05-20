import * as THREE from 'three';
import { Enemy, EnemyPool, Boss } from '../entities/enemy.js';
import { AmmoPack, EnergyPack } from '../entities/environment.js';
import { GAME, COLORS } from '../utils/constants.js';
import { TextLabel } from '../utils/text-label.js';
import { GrenadePool } from '../entities/projectiles.js';

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
        this.ammoPerPickup = 70; // Starting ammo per pickup for wave 1
        
        // Initialize object pools
        this.enemyPool = new EnemyPool(scene, this);
        this.grenadePool = new GrenadePool(scene, audioManager, decalManager);
        
        // Increase grenade pool size to handle more grenades when boss is around
        this.grenadePool.poolSize = 10;
        
        // Add boss tracking
        this.bossSpawned = false;
        this.bossDefeated = true; // Start with no boss
        this.currentBoss = null; // Track the current boss instance
        this.hasSpawnedBossThisWave = false; // Track if we've already spawned a boss this wave
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
        
        // Check if we should spawn a boss (when 70% of the wave is defeated)
        const enemiesDefeated = this.enemiesSpawnedThisWave - this.activeEnemies.length;
        
        // Hardcoded defeat thresholds for each wave
        const defeatThresholds = {
            1: -1,     // No boss in wave 1 (using -1 to ensure it never triggers)
            2: -1,     // No boss in wave 2 (using -1 to ensure it never triggers)
            3: 17,     // 70% of 24 enemies
            4: 22,     // 70% of 32 enemies
            5: 28,     // 70% of 40 enemies
            6: 34,     // 70% of 48 enemies
            7: 39,     // 70% of 56 enemies
            8: 45,     // 70% of 64 enemies
            9: 50,     // 70% of 72 enemies
            10: 56     // 70% of 80 enemies
        };
        
        // Get the threshold for current wave, default to 70% calculation for waves beyond 10
        const defeatThreshold = this.waveNumber <= 10 ? 
            defeatThresholds[this.waveNumber] : 
            Math.floor(this.maxEnemies * 0.7);
        
        // Only spawn boss if:
        // 1. Wave is 3 or higher
        // 2. No boss is currently spawned or active
        // 3. We've reached the defeat threshold
        // 4. We haven't already spawned a boss this wave
        // 5. We've spawned at least 50% of the wave's enemies
        if (this.waveNumber >= 3 && 
            !this.bossSpawned && 
            !this.currentBoss && 
            this.bossDefeated && 
            enemiesDefeated >= defeatThreshold && 
            !this.hasSpawnedBossThisWave &&
            this.enemiesSpawnedThisWave >= this.maxEnemies * 0.5) {
            this.spawnBoss();
        }
    }
    
    updateEnemies(dt) {
        // Use the enemy pool's update method instead
        this.activeEnemies = this.enemyPool.update(dt, this.player.getPosition());
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
        
        // If this is a boss bullet, share the grenade pool's resources with it
        if (bullet.constructor.name === "BossBullet" && this.grenadePool) {
            bullet.setSharedResources(this.grenadePool.sharedGeometries, this.grenadePool.sharedMaterials);
        }
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
        
        // Use the enemy pool to get an enemy
        const enemy = this.enemyPool.getEnemy(position, type);
        
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
        
        // Create the ammo pack with wave-dependent ammo amount
        const ammoPack = new AmmoPack(this.scene, position, this.audioManager, this.ammoPerPickup);
        
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
        
        // Check if any of the defeated enemies were a boss
        this.activeEnemies.forEach(enemy => {
            if (enemy instanceof Boss && !enemy.isActive) {
                this.bossDefeated = true; // Set to true when boss is defeated
                this.bossSpawned = false;
                this.currentBoss = null;
                // Drop extra pickups when a boss is defeated
                this.spawnBossRewards(enemy.getPosition());
            }
        });
    }
    
    startNextWave() {
        this.waveNumber++;
        this.enemyCount = 0;
        this.enemiesSpawnedThisWave = 0;
        this.maxEnemies = this.waveNumber * 8; // Increase enemies per wave
        this.waveComplete = false;
        
        // Reset boss tracking for the new wave
        this.bossSpawned = false;
        this.bossDefeated = true; // Reset to true so a new boss can spawn
        this.currentBoss = null;
        this.hasSpawnedBossThisWave = false; // Reset the boss spawn flag for new wave
        
        // Increase enemy speed and fire rate for progressive difficulty
        this.enemySpeedMultiplier = 1.0 + (this.waveNumber - 1) * 0.1; // 10% increase per wave
        this.enemyFireRateMultiplier = 1.0 + (this.waveNumber - 1) * 0.05; // 5% increase per wave
        
        // Set ammo per pickup based on wave number to create increasing scarcity
        if (this.waveNumber === 1) {
            this.ammoPerPickup = 70;
        } else if (this.waveNumber === 2) {
            this.ammoPerPickup = 60;
        } else if (this.waveNumber === 3) {
            this.ammoPerPickup = 50;
        } else if (this.waveNumber === 4) {
            this.ammoPerPickup = 40;
        } else {
            this.ammoPerPickup = 30; // Wave 5 and beyond get 30 ammo
        }
        
        // Show message
        this.showWaveMessage();
    }
    
    showWaveMessage() {
        // Create wave announcement UI
        const waveMsg = document.createElement('div');
        waveMsg.style.position = 'absolute';
        waveMsg.style.top = '40%';
        waveMsg.style.left = '50%';
        waveMsg.style.transform = 'translate(-50%, -50%)';
        waveMsg.style.color = 'red';
        waveMsg.style.fontSize = '18px';
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
        waveInfo.style.fontSize = '14px';
        waveInfo.style.fontFamily = '"Press Start 2P", cursive';
        waveInfo.style.textShadow = '2px 2px 4px black';
        waveInfo.style.zIndex = '1000';
        waveInfo.style.fontWeight = 'bold';
        waveInfo.textContent = `${this.maxEnemies} enemies - Speed x${this.enemySpeedMultiplier.toFixed(1)} - Fire Rate x${this.enemyFireRateMultiplier.toFixed(1)}`;
        document.body.appendChild(waveInfo);
        
        // Create ammo info
        const ammoInfo = document.createElement('div');
        ammoInfo.style.position = 'absolute';
        ammoInfo.style.top = '52%';
        ammoInfo.style.left = '50%';
        ammoInfo.style.transform = 'translate(-50%, -50%)';
        ammoInfo.style.color = '#ffcc00'; // Gold color for ammo
        ammoInfo.style.fontSize = '12px';
        ammoInfo.style.fontFamily = '"Press Start 2P", cursive';
        ammoInfo.style.textShadow = '2px 2px 4px black';
        ammoInfo.style.zIndex = '1000';
        ammoInfo.textContent = `Ammo per pickup: ${this.ammoPerPickup}`;
        document.body.appendChild(ammoInfo);
        
        // Remove after 2.5 seconds
        setTimeout(() => {
            document.body.removeChild(waveMsg);
            document.body.removeChild(waveInfo);
            document.body.removeChild(ammoInfo);
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
    
    // Method to get a grenade from the pool
    getGrenade(position, direction) {
        return this.grenadePool.getGrenade(position, direction);
    }
    
    // Update the grenade pool
    updateGrenades(dt) {
        this.grenadePool.update(dt);
    }
    
    // Add cleanup method for memory management
    cleanup() {
        // Clean up object pools
        if (this.enemyPool) this.enemyPool.cleanup();
        if (this.grenadePool) this.grenadePool.cleanup();
        
        // Clean up pickups
        this.ammoPickups.forEach(pickup => {
            if (pickup.mesh) {
                this.scene.remove(pickup.mesh);
                pickup.mesh.geometry.dispose();
                pickup.mesh.material.dispose();
            }
        });
        
        this.energyPickups.forEach(pickup => {
            if (pickup.mesh) {
                this.scene.remove(pickup.mesh);
                pickup.mesh.geometry.dispose();
                pickup.mesh.material.dispose();
            }
        });
        
        this.grenadePickups.forEach(pickup => {
            if (pickup.mesh) {
                this.scene.remove(pickup.mesh);
                pickup.mesh.geometry.dispose();
                pickup.mesh.material.dispose();
            }
        });
        
        // Clear arrays
        this.ammoPickups = [];
        this.energyPickups = [];
        this.grenadePickups = [];
        this.activeEnemies = [];
        this.enemyBullets = [];
    }
    
    spawnBoss() {

        this.bossSpawned = true;
        this.bossDefeated = false; // Set to false while boss is active
        this.hasSpawnedBossThisWave = true; // Mark that we've spawned a boss this wave
        
        // Get a spawn position far from the player
        const position = this.getBossSpawnPosition();
        
        // Create the boss
        const boss = new Boss(this.scene, position, this);
        this.currentBoss = boss;
        
        // Add to active enemies and collision system
        this.activeEnemies.push(boss);
        this.collisionSystem.addEnemy(boss);
        
        // Show boss entrance message
        this.showBossEntranceMessage();
        
        // Play boss spawn sound
        this.audioManager.playGrenadeExplosion();
        
        return boss;
    }
    
    getBossSpawnPosition() {
        // Always spawn boss at the farthest arena edge from player
        const playerPos = this.player.getPosition();
        const halfSize = GAME.ARENA_SIZE / 2 - 2; // Keep a bit away from the edge
        
        // Find the farthest corner
        const corners = [
            new THREE.Vector3(halfSize, 0, halfSize),
            new THREE.Vector3(halfSize, 0, -halfSize),
            new THREE.Vector3(-halfSize, 0, halfSize),
            new THREE.Vector3(-halfSize, 0, -halfSize)
        ];
        
        let farthestCorner = corners[0];
        let maxDistance = playerPos.distanceTo(corners[0]);
        
        for (let i = 1; i < corners.length; i++) {
            const distance = playerPos.distanceTo(corners[i]);
            if (distance > maxDistance) {
                maxDistance = distance;
                farthestCorner = corners[i];
            }
        }
        
        return farthestCorner;
    }
    
    showBossEntranceMessage() {
        // Create a message element
        const message = document.createElement('div');
        message.textContent = 'BOSS APPROACHING!';
        message.style.position = 'fixed';
        message.style.top = '20%';  // Changed from 50% to 20% to position above HUD
        message.style.left = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.color = '#ff0000';
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
    
    spawnBossRewards(position) {
        // Spawn multiple pickups around the boss position
        for (let i = 0; i < 3; i++) {
            // Random position close to where the boss was defeated
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * 4,
                0,
                (Math.random() - 0.5) * 4
            );
            const pickupPos = position.clone().add(offset);
            
            // Randomly choose pickup type
            const pickupType = Math.floor(Math.random() * 3);
            switch (pickupType) {
                case 0:
                    this.spawnAmmoPack(pickupPos);
                    break;
                case 1:
                    this.spawnEnergyPack(pickupPos);
                    break;
                case 2:
                    this.spawnGrenadePack(pickupPos);
                    break;
            }
        }
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
        
        // Add text label with fixed position in screen space
        this.label = new TextLabel(
            this.scene,
            'BOMB',
            this.position,
            {
                offset: new THREE.Vector3(0, 2.5, 0),
                color: '#ffffff', // White text
                backgroundColor: null, // No background
                fontSize: 13
            }
        );
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
        
        // Remove label
        if (this.label) {
            this.label.remove();
        }
        
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