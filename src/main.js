import * as THREE from 'three';
import * as Tone from 'tone';
import { InputHandler } from './js/utils/input-handler.js';
import { AudioManager } from './js/audio/audio-manager.js';
import { Player } from './js/entities/player.js';
import { Ground, Obstacle, Tree, Rock, FlowerPatch, Stump, SmallRocks } from './js/entities/environment.js';
import { Bullet, Grenade, OptimizedBullet, BulletManager } from './js/entities/projectiles.js';
import { CollisionSystem } from './js/systems/collision-system.js';
import { SpawnManager } from './js/systems/spawn-manager.js';
import { DecalManager } from './js/systems/decal-manager.js';
import { GAME, SIZES } from './js/utils/constants.js';
import { timeManager } from './js/utils/time-manager.js';

class Game {
    constructor() {
        this.scene = new THREE.Scene();
        // Use perspective camera with moderate field of view (like 50mm lens)
        this.camera = new THREE.PerspectiveCamera(
            40,  // ~40-degree FOV similar to 50mm lens
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.name = 'camera';
        
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x222222); // Darker background for better contrast
        this.renderer.shadowMap.enabled = true; // Enable shadows
        document.body.appendChild(this.renderer.domElement);
        
        // Set pixel ratio for better quality
        this.renderer.setPixelRatio(window.devicePixelRatio);
        
        this.raycaster = new THREE.Raycaster();
        this.clock = new THREE.Clock();
        
        // Initialize systems
        this.inputHandler = new InputHandler();
        this.audioManager = new AudioManager();
        this.collisionSystem = new CollisionSystem();
        this.decalManager = new DecalManager(this.scene);
        this.bulletManager = new BulletManager(this.scene);
        this.bulletManager.setDecalManager(this.decalManager);
        this.collisionSystem.setBulletManager(this.bulletManager);
        
        // Disable debug mode
        this.debugMode = false;
        
        // Game objects collections
        this.bullets = [];
        this.grenades = [];
        this.obstacles = [];
        this.trees = [];
        
        // Create HUD
        this.createHUD();
        
        this.setupCamera();
        this.setupLights();
        this.setupWorld();
        
        // Initialize main player
        this.player = new Player(this.scene, this.audioManager);
        this.collisionSystem.setPlayer(this.player);
        
        // Move player away from the center
        this.player.group.position.set(0, 0, 5);
        this.player.position.copy(this.player.group.position);
        
        // Initialize spawn manager
        this.createSpawnManager();
        
        // Setup resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));
        
        // Add a debounce flag for right-click
        this.rightClickDebounce = false;
        this.rightClickDebounceTime = 800; // Increase to 800ms to better handle double-clicks
        
        // Add grenade throw timestamp to prevent multiple calls
        this.lastGrenadeThrowTime = 0;
        this.grenadeThrowMinInterval = 1000; // Minimum 1 second between grenade throws
        
        // Add direct right-click event listener to ensure grenades are thrown
        window.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent the context menu
            
            // Debug log
            console.log("Right-click detected, attempting to throw grenade");
            
            // Check for cooldown
            const now = Date.now();
            if (now - this.lastGrenadeThrowTime < this.grenadeThrowMinInterval) {
                console.log("Grenade on cooldown, can't throw yet");
                return;
            }
            
            // Check if player exists and has grenades
            if (!this.player || this.player.grenades <= 0) {
                console.log("No player or no grenades left");
                return;
            }
            
            console.log("Player has grenades, throwing now!");
            
            // Create the grenade directly
            const grenadePosition = this.player.getPosition().clone();
            grenadePosition.y = SIZES.PLAYER / 2; // Set grenade at player height
            
            // Get mouse target position for better aiming
            const targetPosition = this.player.getMouseWorldPosition();
            
            // Calculate direction vector to target
            let direction;
            
            // If we have a valid target position, aim at it
            if (targetPosition && targetPosition.lengthSq() > 0) {
                direction = new THREE.Vector3().subVectors(targetPosition, grenadePosition).normalize();
                
                // Keep direction parallel to ground
                direction.y = 0;
                direction.normalize();
            } else {
                // Fallback to player facing direction
                direction = this.player.getDirection();
            }
            
            // Decrease player's grenade count
            this.player.grenades--;
            
            // Create the grenade
            const grenade = new Grenade(this.scene, grenadePosition, direction, this.audioManager, this.decalManager);
            this.grenades.push(grenade);
            this.collisionSystem.addGrenade(grenade);
            
            console.log("Grenade thrown, remaining:", this.player.grenades);
            
            // Apply throw animation to player
            this.player.body.scale.x = 1.2;
            setTimeout(() => {
                this.player.body.scale.x = 1;
            }, 100);
            
            // Update timestamp for player cooldown
            this.player.lastGrenadeTime = Date.now();
            
            // Update timestamp for interval protection
            this.lastGrenadeThrowTime = Date.now();
        });
        
        // Start the game loop
        this.animate();
    }
    
    createHUD() {
        // Add Press Start 2P font
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        const hudContainer = document.createElement('div');
        hudContainer.style.position = 'absolute';
        hudContainer.style.bottom = '20px';
        hudContainer.style.left = '0';
        hudContainer.style.width = '100%';
        hudContainer.style.display = 'flex';
        hudContainer.style.justifyContent = 'center';
        hudContainer.style.color = '#ffffff';
        hudContainer.style.fontFamily = '"Press Start 2P", cursive';
        hudContainer.style.fontSize = '12px';
        hudContainer.style.textShadow = '2px 2px 0px #000000';
        hudContainer.style.zIndex = '100';
        hudContainer.style.letterSpacing = '1px';
        
        // Create a centered HUD panel with pixelated border
        const hudPanel = document.createElement('div');
        hudPanel.style.display = 'flex';
        hudPanel.style.alignItems = 'center';
        hudPanel.style.gap = '30px';
        hudPanel.style.padding = '15px 25px';
        hudPanel.style.border = '4px solid #ffffff';
        hudPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        hudPanel.style.imageRendering = 'pixelated';
        
        // Health display with pixel art style
        const healthContainer = document.createElement('div');
        healthContainer.style.display = 'flex';
        healthContainer.style.flexDirection = 'column';
        healthContainer.style.alignItems = 'center';
        healthContainer.style.minWidth = '150px';
        
        const healthLabel = document.createElement('div');
        healthLabel.innerHTML = 'HEALTH';
        healthLabel.style.marginBottom = '8px';
        
        const healthBarContainer = document.createElement('div');
        healthBarContainer.style.width = '100%';
        healthBarContainer.style.height = '12px';
        healthBarContainer.style.backgroundColor = '#333333';
        healthBarContainer.style.border = '2px solid #ffffff';
        healthBarContainer.style.padding = '2px';
        healthBarContainer.style.imageRendering = 'pixelated';
        
        const healthBar = document.createElement('div');
        healthBar.style.height = '100%';
        healthBar.style.backgroundColor = '#ff0000';
        healthBar.style.width = '100%';
        healthBar.style.transition = 'width 0.3s';
        
        healthBarContainer.appendChild(healthBar);
        healthContainer.appendChild(healthLabel);
        healthContainer.appendChild(healthBarContainer);
        
        // Ammo display with pixel art style
        const ammoContainer = document.createElement('div');
        ammoContainer.style.display = 'flex';
        ammoContainer.style.flexDirection = 'column';
        ammoContainer.style.alignItems = 'center';
        ammoContainer.style.minWidth = '150px';
        
        const ammoLabel = document.createElement('div');
        ammoLabel.innerHTML = 'AMMO';
        ammoLabel.style.marginBottom = '8px';
        
        const ammoText = document.createElement('div');
        ammoText.innerHTML = '30';
        ammoText.style.fontSize = '16px';
        
        ammoContainer.appendChild(ammoLabel);
        ammoContainer.appendChild(ammoText);
        
        // Grenade display with pixel art style
        const grenadeContainer = document.createElement('div');
        grenadeContainer.style.display = 'flex';
        grenadeContainer.style.flexDirection = 'column';
        grenadeContainer.style.alignItems = 'center';
        grenadeContainer.style.minWidth = '150px';
        
        const grenadeLabel = document.createElement('div');
        grenadeLabel.innerHTML = 'GRENADES';
        grenadeLabel.style.marginBottom = '8px';
        
        const grenadeCount = document.createElement('div');
        grenadeCount.style.display = 'flex';
        grenadeCount.style.gap = '8px';
        grenadeCount.style.justifyContent = 'center';
        
        // Add pixel art style grenade indicators
        for (let i = 0; i < 3; i++) {
            const grenade = document.createElement('div');
            grenade.style.width = '12px';
            grenade.style.height = '12px';
            grenade.style.backgroundColor = '#ff5500';
            grenade.style.border = '2px solid #ffffff';
            grenade.style.imageRendering = 'pixelated';
            grenadeCount.appendChild(grenade);
        }
        
        grenadeContainer.appendChild(grenadeLabel);
        grenadeContainer.appendChild(grenadeCount);
        
        // Wave info display with pixel art style
        const waveContainer = document.createElement('div');
        waveContainer.style.display = 'flex';
        waveContainer.style.flexDirection = 'column';
        waveContainer.style.alignItems = 'center';
        waveContainer.style.minWidth = '150px';
        
        const waveText = document.createElement('div');
        waveText.innerText = 'WAVE 1';
        waveText.style.marginBottom = '8px';
        
        const enemyText = document.createElement('div');
        enemyText.innerText = 'ENEMIES: 0/8';
        enemyText.style.fontSize = '10px';
        
        waveContainer.appendChild(waveText);
        waveContainer.appendChild(enemyText);
        
        // Add all elements to panel
        hudPanel.appendChild(healthContainer);
        hudPanel.appendChild(ammoContainer);
        hudPanel.appendChild(grenadeContainer);
        hudPanel.appendChild(waveContainer);
        
        // Add panel to container
        hudContainer.appendChild(hudPanel);
        
        // Add to document
        document.body.appendChild(hudContainer);
        
        // Store references
        this.hudContainer = hudContainer;
        this.healthBar = healthBar;
        this.ammoText = ammoText;
        this.grenadeCount = grenadeCount;
        this.waveText = waveText;
        this.enemyText = enemyText;
        
        // Initial update
        this.updateHUD();
    }
    
    updateHUD() {
        if (this.player) {
            // Update health bar
            const healthPercent = (this.player.currentHealth / this.player.maxHealth) * 100;
            this.healthBar.style.width = `${healthPercent}%`;
            
            // Change health bar color based on health level
            if (healthPercent < 20) {
                this.healthBar.style.backgroundColor = '#ff0000';  // Bright red when low
                this.healthBar.style.boxShadow = '0 0 8px #ff0000';  // Stronger glow when low
            } else if (healthPercent < 50) {
                this.healthBar.style.backgroundColor = '#ff7700';  // Orange when medium
                this.healthBar.style.boxShadow = '0 0 5px #ff7700';
            } else {
                this.healthBar.style.backgroundColor = '#ff3333';  // Normal red
                this.healthBar.style.boxShadow = '0 0 5px #ff5555';
            }
            
            // Update ammo display
            if (this.player.isReloading) {
                this.ammoText.textContent = 'RELOADING';
                this.ammoText.style.color = '#ffcc00';  // Yellow during reload
            } else if (this.player.ammo <= 0) {
                this.ammoText.textContent = 'NO AMMO';
                this.ammoText.style.color = '#ff3333';  // Red when out of ammo
                this.ammoText.style.textShadow = '0 0 8px rgba(255, 0, 0, 0.8)';  // Red glow
                
                // Make the ammo icon pulse to draw attention
                if (!this._ammoIconPulsing) {
                    this._ammoIconPulsing = true;
                    const ammoIcon = this.ammoText.parentNode.querySelector(':first-child');
                    
                    // Add pulse animation
                    const pulseAmmoIcon = () => {
                        if (this.player.ammo > 0) {
                            // Stop pulsing once player has ammo
                            this._ammoIconPulsing = false;
                            ammoIcon.style.animation = '';
                            return;
                        }
                        
                        ammoIcon.style.animation = 'pulse 1s infinite';
                        if (!document.querySelector('#ammo-pulse-style')) {
                            const style = document.createElement('style');
                            style.id = 'ammo-pulse-style';
                            style.textContent = `
                                @keyframes pulse {
                                    0% { transform: scale(1); opacity: 1; }
                                    50% { transform: scale(1.3); opacity: 0.7; }
                                    100% { transform: scale(1); opacity: 1; }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                    };
                    
                    pulseAmmoIcon();
                    this._ammoIconInterval = setInterval(pulseAmmoIcon, 1000);
                }
            } else {
                this.ammoText.textContent = `${this.player.ammo}`;
                // Change color based on ammo amount
                if (this.player.ammo <= 5) {
                    this.ammoText.style.color = '#ff3333';  // Red when low
                    this.ammoText.style.textShadow = '0 0 8px rgba(255, 0, 0, 0.8)';  // Red glow
                } else {
                    this.ammoText.style.color = 'white';  // Normal color
                    this.ammoText.style.textShadow = '0 0 5px rgba(0, 136, 255, 0.8)';  // Blue glow
                }
                
                // Clear pulse if we have ammo again
                if (this._ammoIconPulsing) {
                    this._ammoIconPulsing = false;
                    if (this._ammoIconInterval) {
                        clearInterval(this._ammoIconInterval);
                    }
                    const ammoIcon = this.ammoText.parentNode.querySelector(':first-child');
                    if (ammoIcon) {
                        ammoIcon.style.animation = '';
                    }
                }
            }
            
            // Update grenade display
            const grenades = this.grenadeCount.children;
            for (let i = 0; i < grenades.length; i++) {
                if (i < this.player.grenades) {
                    grenades[i].style.opacity = '1';  // Active grenade
                    grenades[i].style.backgroundColor = '#ff5500';  // Orange
                } else {
                    grenades[i].style.opacity = '0.3';  // Inactive grenade
                    grenades[i].style.backgroundColor = '#555555';  // Gray
                }
            }
        }
        
        // Update wave display
        if (this.spawnManager) {
            this.waveText.innerText = `WAVE ${this.spawnManager.waveNumber}`;
            this.enemyText.innerText = `ENEMIES: ${this.spawnManager.enemyCount}/${this.spawnManager.maxEnemies}`;
        }
    }
    
    setupCamera() {
        // Position camera for natural 50mm-like perspective view
        this.camera.position.set(0, 14, 14); // Slightly further back
        this.camera.lookAt(0, 0, 0);
    }
    
    setupLights() {
        // Increase ambient light intensity
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
        this.scene.add(ambientLight);
        
        // Add multiple directional lights for better coverage
        const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
        directionalLight1.position.set(10, 20, 10);
        directionalLight1.lookAt(0, 0, 0);
        this.scene.add(directionalLight1);
        
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight2.position.set(-10, 15, -10);
        directionalLight2.lookAt(0, 0, 0);
        this.scene.add(directionalLight2);
        
        // Add a spotlight following the player
        this.playerSpotlight = new THREE.SpotLight(0xffffff, 2);
        this.playerSpotlight.angle = Math.PI / 3;
        this.playerSpotlight.penumbra = 0.5;
        this.playerSpotlight.decay = 1;
        this.playerSpotlight.distance = 50;
        this.scene.add(this.playerSpotlight);
        
        // Set renderer background to a dark gray that matches the floor
        this.renderer.setClearColor(0x222222);
    }
    
    setupWorld() {
        // Create obstacles for cover (avoiding central obstacle)
        this.createTrees();  // Trees are obstacles
        this.createRocks();  // Large rocks are obstacles
        
        // Create decorative elements (not obstacles)
        this.createGrass();  // Add grass patches
        this.createFlowerPatches();
        this.createStumps();
        this.createSmallRocks();
    }
    
    createTrees() {
        // Create some trees around the arena
        const treePositions = [
            new THREE.Vector3(-12, 0, 12),
            new THREE.Vector3(12, 0, -12),
            new THREE.Vector3(-12, 0, -12),
            new THREE.Vector3(12, 0, 12),
            new THREE.Vector3(0, 0, 14),
            new THREE.Vector3(14, 0, 0),
            new THREE.Vector3(0, 0, -14),
            new THREE.Vector3(-14, 0, 0)
        ];
        
        treePositions.forEach(position => {
            const tree = new Tree(this.scene, position);
            this.trees.push(tree);
            // Trees don't need collision since they're at the edge
        });
    }
    
    createRocks() {
        // Create rock formations
        const rockPositions = [
            // Original rocks
            new THREE.Vector3(-20, 0, 15),
            new THREE.Vector3(18, 0, -18),
            new THREE.Vector3(-15, 0, -20),
            new THREE.Vector3(25, 0, 22),
            new THREE.Vector3(-22, 0, 5),
            new THREE.Vector3(5, 0, -25),
            // Additional rocks for more population
            new THREE.Vector3(15, 0, 25),
            new THREE.Vector3(-25, 0, -10),
            new THREE.Vector3(28, 0, 8),
            new THREE.Vector3(-18, 0, 28),
            new THREE.Vector3(12, 0, -22),
            new THREE.Vector3(-8, 0, -28),
            // Smaller clusters closer to center
            new THREE.Vector3(10, 0, 12),
            new THREE.Vector3(-12, 0, 8),
            new THREE.Vector3(8, 0, -15),
            new THREE.Vector3(-15, 0, -7)
        ];
        
        rockPositions.forEach(position => {
            const size = 0.8 + Math.random() * 1.5; // Random size between 0.8 and 2.3
            const rock = new Rock(this.scene, position, size);
            // Add all rocks as obstacles, regardless of size
            this.obstacles.push(rock);
            this.collisionSystem.addObstacle(rock);
        });
    }
    
    createFlowerPatches() {
        // Create flower patches (decorative, not obstacles)
        const flowerPositions = [
            new THREE.Vector3(-15, 0, 0),
            new THREE.Vector3(12, 0, 8),
            new THREE.Vector3(0, 0, -18),
            new THREE.Vector3(-8, 0, 15),
            new THREE.Vector3(20, 0, -5),
            new THREE.Vector3(-18, 0, -18)
        ];
        
        flowerPositions.forEach(position => {
            const size = 1 + Math.random() * 1; // Random size between 1 and 2
            const flowerPatch = new FlowerPatch(this.scene, position, size);
            // Don't add to obstacles or collision system
        });
    }
    
    createStumps() {
        // Create stumps (decorative, not obstacles)
        const stumpPositions = [
            new THREE.Vector3(-10, 0, -15),
            new THREE.Vector3(15, 0, 12),
            new THREE.Vector3(8, 0, -8),
            new THREE.Vector3(-18, 0, 8),
            new THREE.Vector3(25, 0, 0)
        ];
        
        stumpPositions.forEach(position => {
            const size = 1 + Math.random(); // Random size between 1 and 2
            const stump = new Stump(this.scene, position, size);
            // Don't add to obstacles or collision system
        });
    }
    
    createSmallRocks() {
        // Create clusters of small rocks (decorative, not obstacles)
        const smallRockPositions = [
            new THREE.Vector3(5, 0, 18),
            new THREE.Vector3(-22, 0, -5),
            new THREE.Vector3(18, 0, -15),
            new THREE.Vector3(-5, 0, 22),
            new THREE.Vector3(12, 0, 22),
            new THREE.Vector3(-15, 0, -12),
            // Add a few more positions for better coverage
            new THREE.Vector3(0, 0, -20),
            new THREE.Vector3(-10, 0, 15),
            new THREE.Vector3(20, 0, 0)
        ];
        
        smallRockPositions.forEach(position => {
            const size = 0.8 + Math.random() * 0.7; // Random size between 0.8 and 1.5
            const smallRocks = new SmallRocks(this.scene, position, size);
            // Add small rocks as obstacles
            this.obstacles.push(smallRocks);
            this.collisionSystem.addObstacle(smallRocks);
        });
    }
    
    createGrass() {
        // Create grass patches throughout the arena
        const grassPositions = [
            // Outer ring
            new THREE.Vector3(-18, 0, 18),
            new THREE.Vector3(0, 0, 20),
            new THREE.Vector3(18, 0, 18),
            new THREE.Vector3(20, 0, 0),
            new THREE.Vector3(18, 0, -18),
            new THREE.Vector3(0, 0, -20),
            new THREE.Vector3(-18, 0, -18),
            new THREE.Vector3(-20, 0, 0),
            // Inner patches
            new THREE.Vector3(-8, 0, 8),
            new THREE.Vector3(8, 0, 8),
            new THREE.Vector3(8, 0, -8),
            new THREE.Vector3(-8, 0, -8),
            // Random scattered patches
            new THREE.Vector3(-12, 0, 4),
            new THREE.Vector3(12, 0, -4),
            new THREE.Vector3(4, 0, 12),
            new THREE.Vector3(-4, 0, -12),
            new THREE.Vector3(-15, 0, -10),
            new THREE.Vector3(15, 0, 10),
            new THREE.Vector3(10, 0, 15),
            new THREE.Vector3(-10, 0, -15)
        ];

        grassPositions.forEach(position => {
            const size = 1 + Math.random() * 0.5; // Random size between 1 and 1.5
            const grass = new Obstacle(this.scene, position, size, size * 0.8, size);
            // Don't add grass as obstacles (decorative only)
        });
    }
    
    createBullet() {
        // Check if player has ammo
        if (this.player.ammo <= 0) {
            return null;
        }
        
        // Create the bullet from player's position
        const bulletPosition = this.player.getPosition().clone();
        // Make the bullet start at the gun tip
        bulletPosition.add(this.player.getDirection().multiplyScalar(1.2));
        // Offset Y position to match approximate gun height
        bulletPosition.y = SIZES.PLAYER / 2; // Half the player height
        
        // Create direction vector - ensure it's parallel to ground
        const direction = this.player.getDirection().clone();
        direction.y = 0; // Keep bullets traveling parallel to ground
        direction.normalize(); // Re-normalize after changing y
        
        // Use BulletManager to create instanced bullets with a higher speed multiplier
        const bullet = this.bulletManager.createBullet(bulletPosition, direction, 1.0);
        
        // Add bullet to collision system
        this.collisionSystem.addBullet(bullet);
        
        // Reduce player ammo
        this.player.ammo--;
        
        // Play gunshot sound
        this.audioManager.playGunShot();
        
        // Apply muzzle flash and recoil
        this.player.createMuzzleFlash();
        
        return bullet;
    }
    
    createGrenade() {
        if (!this.player) return null;
        
        // Strict check for grenades
        if (this.player.grenades <= 0) {
            console.log("Cannot create grenade: no grenades left");
            return null;
        }
        
        // Get player position and direction
        const position = this.player.getPosition().clone();
        position.y = SIZES.PLAYER / 2; // Set grenade at player height
        
        // Get mouse target position for better aiming
        const targetPosition = this.player.getMouseWorldPosition();
        
        // Calculate direction vector to target
        let direction;
        
        // If we have a valid target position, aim at it
        if (targetPosition && targetPosition.lengthSq() > 0) {
            direction = new THREE.Vector3().subVectors(targetPosition, position).normalize();
            
            // Keep direction parallel to ground
            direction.y = 0;
            direction.normalize();
        } else {
            // Fallback to player facing direction
            direction = new THREE.Vector3(
                Math.sin(this.player.rotation),
                0,
                Math.cos(this.player.rotation)
            );
        }
        
        // Create the grenade and pass the decalManager for explosion splats
        const grenade = new Grenade(this.scene, position, direction, this.audioManager, this.decalManager);
        this.grenades.push(grenade);
        this.collisionSystem.addGrenade(grenade);
        
        return grenade;
    }
    
    machineGunFire() {
        if (!this.player || this.player.isReloading || this.player.ammo <= 0) return false;
        
        // Create a single bullet with precise aim
        const startPosition = this.player.getPosition().clone();
        // Offset position to match approximate gun height
        startPosition.y = SIZES.PLAYER / 2; // Half player height
        startPosition.add(this.player.getDirection().multiplyScalar(1.2));
        
        const direction = this.player.getDirection().clone();
        
        // Create the bullet using the bullet manager with higher speed multiplier
        const bullet = this.bulletManager.createBullet(startPosition, direction, 1.0);
        
        // Add bullet to collision system
        this.collisionSystem.addBullet(bullet);
        
        // Decrease ammo and play effects
        this.player.ammo--;
        this.player.playShootSound();
        this.player.showMuzzleFlash();
        
        return true;
    }
    
    onWindowResize() {
        // Update perspective camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    updateCamera() {
        if (!this.player) return;
        
        // Make camera follow player with a natural perspective offset
        const playerPos = this.player.getPosition();
        // Set camera position relative to player
        const cameraOffset = new THREE.Vector3(0, 25, 25); // Matches setupCamera values
        this.camera.position.set(
            playerPos.x + cameraOffset.x,
            playerPos.y + cameraOffset.y,
            playerPos.z + cameraOffset.z
        );
        this.camera.lookAt(playerPos.x, playerPos.y, playerPos.z);
        
        // Update player spotlight position
        if (this.playerSpotlight) {
            this.playerSpotlight.position.copy(this.camera.position);
            this.playerSpotlight.target.position.copy(playerPos);
        }
    }
    
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Get delta time from the TimeManager
        const delta = timeManager.getAutoDeltatime();
        
        // Update player
        if (this.player) {
            this.player.update(delta, this.inputHandler, this.raycaster, this.camera);
            
            // Handle shooting
            if (this.inputHandler.keys.shoot) {
                if (!this.player.isReloading) {
                    if (this.player.ammo > 0) {
                        const timeNow = Date.now();
                        // Add machine gun fire rate control - fire every 50ms for rapid rate
                        if (timeNow - this.player.lastShotTime >= 50) {  // 50ms = about 20 rounds per second
                            this.machineGunFire(); // Fire a single bullet
                            this.player.lastShotTime = timeNow;
                        }
                    }
                }
            }
            
            // Handle grenade throwing - now only used for keyboard grenade throwing (g key)
            if (this.inputHandler.keys.grenade) {
                console.log("Keyboard grenade key detected");
                
                // Check for cooldown
                const now = Date.now();
                if (now - this.lastGrenadeThrowTime < this.grenadeThrowMinInterval) {
                    console.log("Grenade on cooldown, can't throw yet");
                    this.inputHandler.keys.grenade = false;
                    return;
                }
                
                // Check if we have grenades left
                if (this.player.grenades > 0) {
                    console.log("Player has grenades, throwing via keyboard");
                    
                    // Create the grenade
                    const grenadePosition = this.player.getPosition().clone();
                    grenadePosition.y = SIZES.PLAYER / 2;
                    
                    // Use player's facing direction
                    const direction = this.player.getDirection();
                    
                    // Decrease player's grenade count
                    this.player.grenades--;
                    
                    // Create the grenade
                    const grenade = new Grenade(this.scene, grenadePosition, direction, this.audioManager, this.decalManager);
                    this.grenades.push(grenade);
                    this.collisionSystem.addGrenade(grenade);
                    
                    console.log("Grenade thrown via keyboard, remaining:", this.player.grenades);
                    
                    // Apply throw animation
                    this.player.body.scale.x = 1.2;
                    setTimeout(() => {
                        this.player.body.scale.x = 1;
                    }, 100);
                    
                    // Update timestamps
                    this.player.lastGrenadeTime = now;
                    this.lastGrenadeThrowTime = now;
                }
                
                // Reset the grenade key regardless
                this.inputHandler.keys.grenade = false;
            }
        }
        
        // Update enemies and spawner with delta time
        this.spawnManager.update(this.player, delta);
        
        // Update bullet manager
        this.bulletManager.update(delta);
        
        // Update non-instanced projectiles (grenades and older bullets)
        this.bullets.forEach(bullet => {
            if (bullet.constructor.name !== 'OptimizedBullet' || !bullet.useInstance) {
                bullet.update(delta);
            }
        });
        this.grenades.forEach(grenade => grenade.update(delta));
        
        // Update pickups
        // Update ammo pickups (if they exist and have an update method)
        if (this.spawnManager.ammoPickups) {
            this.spawnManager.ammoPickups.forEach(ammoPack => {
                if (ammoPack && typeof ammoPack.update === 'function') {
                    ammoPack.update(delta);
                }
            });
        }
        
        // Update grenade pickups
        if (this.spawnManager.grenadePickups) {
            this.spawnManager.grenadePickups.forEach(grenadePack => {
                if (grenadePack && typeof grenadePack.update === 'function') {
                    grenadePack.update(delta);
                }
            });
        }
        
        // Update energy pickups
        if (this.spawnManager.energyPickups) {
            this.spawnManager.energyPickups.forEach(energyPack => {
                if (energyPack && typeof energyPack.update === 'function') {
                    energyPack.update(delta);
                }
            });
        }
        
        // Check collisions
        this.collisionSystem.update();
        
        // Update camera only if not disabled for test
        if (!this.disableCameraUpdate) {
            this.updateCamera();
        }
        
        // Update HUD
        this.updateHUD();
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    createSpawnManager() {
        if (!this.player) return;
        
        // Create spawn manager
        this.spawnManager = new SpawnManager(
            this.scene,
            this.player,
            this.collisionSystem,
            this.audioManager,
            this.decalManager // Pass decalManager to SpawnManager for enemy splats
        );
    }
}

// Modify the start screen creation in the DOMContentLoaded event handler
window.addEventListener('DOMContentLoaded', () => {
    // Add Press Start 2P font first
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // Create a container for the start screen
    const startContainer = document.createElement('div');
    startContainer.style.position = 'fixed';
    startContainer.style.top = '0';
    startContainer.style.left = '0';
    startContainer.style.width = '100%';
    startContainer.style.height = '100%';
    startContainer.style.backgroundColor = '#222222'; // Match game background
    startContainer.style.display = 'flex';
    startContainer.style.flexDirection = 'column';
    startContainer.style.alignItems = 'center';
    startContainer.style.justifyContent = 'center';
    startContainer.style.zIndex = '1000';
    startContainer.style.cursor = 'default';
    startContainer.style.fontFamily = '"Press Start 2P", cursive';

    // Add character preview container
    const characterPreview = document.createElement('div');
    characterPreview.style.width = '32px';
    characterPreview.style.height = '32px';
    characterPreview.style.backgroundColor = '#4444ff';
    characterPreview.style.marginBottom = '40px';
    characterPreview.style.transform = 'scale(0)';
    characterPreview.style.transition = 'transform 0.3s ease-out';
    characterPreview.style.borderRadius = '4px';
    characterPreview.style.boxShadow = 'inset -4px -4px 0px 0px #2222aa';
    startContainer.appendChild(characterPreview);

    // Add title with pixel art shadow
    const gameTitle = document.createElement('div');
    gameTitle.textContent = 'PIXEL HELL';
    gameTitle.style.color = '#ffffff';
    gameTitle.style.fontSize = '48px';
    gameTitle.style.marginBottom = '50px';
    gameTitle.style.textShadow = '4px 4px 0px #000000';
    gameTitle.style.opacity = '0';
    gameTitle.style.transform = 'translateY(-20px)';
    gameTitle.style.transition = 'opacity 0.5s ease-out, transform 0.5s ease-out';
    startContainer.appendChild(gameTitle);

    // Trigger title animation after a short delay
    setTimeout(() => {
        gameTitle.style.opacity = '1';
        gameTitle.style.transform = 'translateY(0)';
        // Show character preview with bounce effect
        setTimeout(() => {
            characterPreview.style.transform = 'scale(1.2)';
            setTimeout(() => {
                characterPreview.style.transform = 'scale(1)';
            }, 150);
        }, 500);
    }, 100);

    // Create pixel art style button
    const startButton = document.createElement('button');
    startButton.textContent = 'START GAME';
    startButton.style.fontSize = '16px';
    startButton.style.padding = '16px 32px';
    startButton.style.backgroundColor = '#00aa00';
    startButton.style.color = '#ffffff';
    startButton.style.border = 'none';
    startButton.style.cursor = 'pointer';
    startButton.style.fontFamily = '"Press Start 2P", cursive';
    startButton.style.position = 'relative';
    startButton.style.textTransform = 'uppercase';
    startButton.style.letterSpacing = '2px';
    startButton.style.imageRendering = 'pixelated';
    startButton.style.boxShadow = 'inset -4px -4px 0px 0px #006600';
    startButton.style.outline = 'none';
    
    // Create pixel art border
    startButton.style.border = '4px solid #ffffff';
    startButton.style.borderStyle = 'solid';
    startButton.style.borderWidth = '4px';
    startButton.style.borderLeftColor = '#ffffff';
    startButton.style.borderTopColor = '#ffffff';
    startButton.style.borderRightColor = '#888888';
    startButton.style.borderBottomColor = '#888888';
    
    // Add hover and active states
    startButton.onmouseover = () => {
        startButton.style.backgroundColor = '#00cc00';
        startButton.style.boxShadow = 'inset -4px -4px 0px 0px #008800';
    };
    
    startButton.onmouseout = () => {
        startButton.style.backgroundColor = '#00aa00';
        startButton.style.boxShadow = 'inset -4px -4px 0px 0px #006600';
        startButton.style.transform = 'translate(0, 0)';
        startButton.style.borderLeftColor = '#ffffff';
        startButton.style.borderTopColor = '#ffffff';
        startButton.style.borderRightColor = '#888888';
        startButton.style.borderBottomColor = '#888888';
    };
    
    startButton.onmousedown = () => {
        startButton.style.transform = 'translate(2px, 2px)';
        startButton.style.backgroundColor = '#008800';
        startButton.style.boxShadow = 'inset -2px -2px 0px 0px #004400';
        startButton.style.borderLeftColor = '#888888';
        startButton.style.borderTopColor = '#888888';
        startButton.style.borderRightColor = '#ffffff';
        startButton.style.borderBottomColor = '#ffffff';
    };
    
    startButton.onmouseup = () => {
        startButton.style.transform = 'translate(0, 0)';
        startButton.style.backgroundColor = '#00aa00';
        startButton.style.boxShadow = 'inset -4px -4px 0px 0px #006600';
        startButton.style.borderLeftColor = '#ffffff';
        startButton.style.borderTopColor = '#ffffff';
        startButton.style.borderRightColor = '#888888';
        startButton.style.borderBottomColor = '#888888';
    };
    
    // Add pixel art shadow behind button
    const buttonShadow = document.createElement('div');
    buttonShadow.style.position = 'absolute';
    buttonShadow.style.top = '4px';
    buttonShadow.style.left = '4px';
    buttonShadow.style.width = '100%';
    buttonShadow.style.height = '100%';
    buttonShadow.style.backgroundColor = '#000000';
    buttonShadow.style.zIndex = '-1';
    startContainer.appendChild(buttonShadow);
    
    startContainer.appendChild(startButton);
    document.body.appendChild(startContainer);
    
    // Start on click
    startButton.addEventListener('click', async () => {
        try {
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
            
            // Animate elements out
            gameTitle.style.opacity = '0';
            gameTitle.style.transform = 'translateY(-20px)';
            startButton.style.opacity = '0';
            startButton.style.transform = 'translateY(20px)';
            characterPreview.style.transform = 'scale(1.5)';
            characterPreview.style.opacity = '0';
            
            // Wait for animations to complete
            setTimeout(() => {
                // Remove the start screen
                document.body.removeChild(startContainer);
                
                // Initialize the game and expose it globally
                window.gameInstance = new Game();
                
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
                        
                        // Check for ground collision
                        if (player.group.position.y <= 0 && !isGrounded) {
                            // Bounce effect
                            player.group.position.y = 0;
                            velocity = -velocity * bounceCoefficient;
                            
                            // Flatten a bit on impact
                            player.group.scale.set(1.2, 0.8, 1.2);
                            setTimeout(() => {
                                player.group.scale.set(1, 1, 1);
                            }, 100);
                            
                            // Play a landing sound
                            const landingSound = new Tone.Synth({
                                oscillator: { type: "square" },
                                envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 }
                            }).toDestination();
                            landingSound.volume.value = -10;
                            landingSound.triggerAttackRelease(240 - (bounceCount * 40), "16n");
                            
                            bounceCount++;
                            
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
                                            setTimeout(() => readySound.triggerAttackRelease("G4", "16n"), 200);
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
            console.error("Error starting game:", error);
        }
    });
}); 