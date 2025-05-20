import * as THREE from 'three';import { COLORS, SIZES, GAME } from '../utils/constants.js';import { TextLabel } from '../utils/text-label.js';

export class Ground {
    constructor(scene) {
        this.scene = scene;
        this.createGround();
    }
    
    createGround() {
        const groundGeometry = new THREE.PlaneGeometry(GAME.ARENA_SIZE, GAME.ARENA_SIZE);
        const groundMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x222222, // Match the renderer background color
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.Mesh(groundGeometry, groundMaterial);
        this.mesh.rotation.x = Math.PI / 2; // Rotate to be flat on XZ plane
        this.mesh.position.y = 0; // Position at y=0
        this.scene.add(this.mesh);
    }
}

export class Obstacle {
    constructor(scene, position, width, height, depth) {
        this.scene = scene;
        this.position = position.clone();
        this.width = width || 1;
        this.height = height || SIZES.PLAYER;
        this.depth = depth || 1;
        this.createObstacle();
    }
    
    createObstacle() {
        // Create a group to hold all grass blades
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        // Create multiple grass blades with slight variations
        const numBlades = 12; // Increased from 5 to 12 for denser grass
        const colors = [0x2d572c, 0x3a6b39, 0x4a8548, 0x5a9d58]; // Added another shade of green
        
        for (let i = 0; i < numBlades; i++) {
            // Random position within the obstacle's area
            const xOffset = (Math.random() - 0.5) * this.width * 0.9;
            const zOffset = (Math.random() - 0.5) * this.depth * 0.9;
            
            // Random height variation (70% to 110% of base height)
            const bladeHeight = this.height * (0.7 + Math.random() * 0.4);
            
            // Create a thin, tall pyramid for each blade
            const geometry = new THREE.ConeGeometry(
                0.12,  // Even thinner blades
                bladeHeight,
                4     // square base
            );
            
            // Random color from our green palette
            const material = new THREE.MeshBasicMaterial({ 
                color: colors[Math.floor(Math.random() * colors.length)]
            });
            
            const blade = new THREE.Mesh(geometry, material);
            
            // Position the blade
            blade.position.set(xOffset, bladeHeight / 2, zOffset);
            
            // Rotate to point upward with slight variations
            blade.rotation.y = Math.random() * Math.PI * 2; // Random rotation around y
            blade.rotation.z = (Math.random() - 0.5) * 0.3; // More pronounced tilt
            
            this.group.add(blade);
        }
        
        this.scene.add(this.group);
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingBox() {
        return new THREE.Box3().setFromObject(this.group);
    }
}

export class Tree {
    constructor(scene, position) {
        this.scene = scene;
        this.position = position.clone();
        this.createTree();
    }
    
    createTree() {
        // Create tree group
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        // Create trunk (brown cube)
        const trunkGeometry = new THREE.BoxGeometry(0.5, 2, 0.5);
        const trunkMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1; // Half of height
        this.group.add(trunk);
        
        // Create leaves (green cubes of different sizes)
        const leavesGroup = new THREE.Group();
        leavesGroup.position.y = 2;
        
        // Create several cube layers for a pixelated tree crown
        const colors = [0x2d572c, 0x3a6b39, 0x4a8548]; // Different shades of green
        const sizes = [1.8, 1.4, 1];
        
        for (let i = 0; i < sizes.length; i++) {
            const size = sizes[i];
            const leavesGeometry = new THREE.BoxGeometry(size, 0.7, size);
            const leavesMaterial = new THREE.MeshBasicMaterial({ color: colors[i] });
            const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
            leaves.position.y = i * 0.5;
            leavesGroup.add(leaves);
        }
        
        this.group.add(leavesGroup);
        this.scene.add(this.group);
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingRadius() {
        return 0.25; // Just the trunk for collision
    }
}

export class AmmoPack {
    constructor(scene, position, audioManager, ammoAmount = 60) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.position = position.clone();
        this.isActive = true;
        this.rotationSpeed = 0.05; // Faster rotation
        this.bounceSpeed = 3; // Faster bounce
        this.bounceHeight = 0.4; // Higher bounce
        this.bounceTime = Math.random() * Math.PI * 2; // Random starting phase
        this.ammoAmount = ammoAmount; // Use the passed value (default 60)
        this.baseHeight = 0.5; // Base floating height above ground (increased from 0)
        
        this.createAmmoPack();
    }
    
    createAmmoPack() {
        // Create a group to hold all parts
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        this.group.position.y = this.baseHeight; // Set initial height
        
        // Create a more distinctive and visible ammo pack
        // Main ammo box
        const boxGeometry = new THREE.BoxGeometry(0.4, 0.2, 0.3);
        const boxMaterial = new THREE.MeshBasicMaterial({ 
            color: COLORS.AMMO,
        });
        this.mesh = new THREE.Mesh(boxGeometry, boxMaterial);
        this.mesh.position.y = 0.1; // Half height
        this.group.add(this.mesh);
        
        // Add bullet details on top
        const bulletGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.25, 8);
        const bulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffcc00 }); // Gold color
        
        // Scale number of visible bullets based on ammo amount
        // At 60 ammo show 4 bullets, at 30 ammo show 2 bullets
        const numBullets = Math.max(2, Math.floor(this.ammoAmount / 15));
        
        // Arrange bullets in a grid or line based on count
        if (numBullets <= 3) {
            // Line arrangement for fewer bullets
            for (let i = 0; i < numBullets; i++) {
                const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
                bullet.rotation.x = Math.PI / 2; // Lay horizontally
                bullet.position.set(-0.1 + i * 0.1, 0.2, 0); // Position on top of box
                this.group.add(bullet);
            }
        } else {
            // Grid arrangement for more bullets
            const cols = Math.ceil(Math.sqrt(numBullets));
            const rows = Math.ceil(numBullets / cols);
            let bulletCount = 0;
            
            for (let row = 0; row < rows && bulletCount < numBullets; row++) {
                for (let col = 0; col < cols && bulletCount < numBullets; col++) {
                    const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
                    bullet.rotation.x = Math.PI / 2; // Lay horizontally
                    // Position in a grid on top of box
                    bullet.position.set(
                        -0.15 + col * 0.1, 
                        0.2, 
                        -0.1 + row * 0.1
                    );
                    this.group.add(bullet);
                    bulletCount++;
                }
            }
        }
        
        // Add the group to the scene
        this.scene.add(this.group);
        
        // Add a point light for glow effect
        this.light = new THREE.PointLight(COLORS.AMMO, 1.5, 4);
        this.light.position.copy(this.position);
        this.light.position.y = 0.5 + this.baseHeight;
        this.scene.add(this.light);
        
        // Add a second pulsing light
        this.pulseLight = new THREE.PointLight(0xffffff, 0.5, 2);
        this.pulseLight.position.copy(this.position);
        this.pulseLight.position.y = 0.5 + this.baseHeight;
        this.scene.add(this.pulseLight);
        
        // Create upward-pointing arrow to make pickups more visible from distance
        const arrowGeometry = new THREE.ConeGeometry(0.15, 0.35, 4);
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.7
        });
        this.arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        this.arrow.position.copy(this.position);
        this.arrow.position.y = 1.2 + this.baseHeight; // Position above the ammo box
        this.scene.add(this.arrow);
        
        // Add text label with fixed position in screen space
        this.label = new TextLabel(
            this.scene, 
            `AMMO ×${this.ammoAmount}`, // Show ammo amount in label
            this.position, 
            {
                offset: new THREE.Vector3(0, 2.5, 0),
                color: '#ffffff',
                backgroundColor: null,
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
        
        // Update light positions
        this.light.position.copy(this.position);
        this.light.position.y = 0.5 + this.baseHeight + bounceOffset;
        
        this.pulseLight.position.copy(this.position);
        this.pulseLight.position.y = 0.5 + this.baseHeight + bounceOffset;
        
        // Update arrow position
        this.arrow.position.copy(this.position);
        this.arrow.position.y = 1.2 + this.baseHeight + bounceOffset * 0.5;
        this.arrow.rotation.y += 0.03; // Rotate the arrow
        
        // Pulse the light intensity
        const pulseIntensity = 0.5 + Math.abs(Math.sin(this.bounceTime * 3)) * 1.0;
        this.light.intensity = 1.5 + pulseIntensity * 0.5;
        this.pulseLight.intensity = pulseIntensity;
        
        // Pulse the arrow opacity
        this.arrow.material.opacity = 0.4 + Math.abs(Math.sin(this.bounceTime * 2)) * 0.6;
    }
    
    pickup() {
        if (!this.isActive) return 0;
        
        this.isActive = false;
        this.scene.remove(this.group);
        this.scene.remove(this.light);
        this.scene.remove(this.pulseLight);
        this.scene.remove(this.arrow);
        
        // Remove the label
        if (this.label) {
            this.label.remove();
        }
        
        // Clean up materials and geometries
        this.group.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) object.material.dispose();
        });
        this.arrow.geometry.dispose();
        this.arrow.material.dispose();
        
        this.audioManager.playPickup();
        
        return this.ammoAmount;
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingRadius() {
        return 0.5; // Larger radius for easier pickup
    }
}

export class EnergyPack {
    constructor(scene, position, audioManager) {
        this.scene = scene;
        this.audioManager = audioManager;
        this.position = position.clone();
        this.isActive = true;
        this.rotationSpeed = 0.04; // Slightly faster rotation
        this.bounceSpeed = 2.5;    // Slightly faster bounce
        this.bounceHeight = 0.25;  // Higher bounce
        this.bounceTime = Math.random() * Math.PI * 2; // Random starting phase
        this.energyAmount = GAME.ENERGY_AMOUNT;
        this.baseHeight = 0.5; // Base floating height above ground (new)
        
        this.createEnergyPack();
    }
    
    createEnergyPack() {
        // Create a cube for the energy pack
        const geometry = new THREE.BoxGeometry(0.35, 0.35, 0.35);
        const material = new THREE.MeshBasicMaterial({ 
            color: COLORS.ENERGY,
            transparent: true,
            opacity: 0.85 // Slightly transparent
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.position.y = this.baseHeight + 0.175; // Half of height + base height
        this.scene.add(this.mesh);
        
        // Add a point light inside the cube
        this.light = new THREE.PointLight(COLORS.ENERGY, 0.5, 1.5);
        this.light.position.copy(this.position);
        this.light.position.y = this.baseHeight + 0.175;
        this.scene.add(this.light);
        
        // Add an upward-pointing arrow for better visibility
        const arrowGeometry = new THREE.ConeGeometry(0.12, 0.3, 4);
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: COLORS.ENERGY,
            transparent: true,
            opacity: 0.7
        });
        this.arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        this.arrow.position.copy(this.position);
        this.arrow.position.y = this.baseHeight + 1.0; // Position above the energy pack
        this.scene.add(this.arrow);
        
        // Add text label with fixed position in screen space
        this.label = new TextLabel(
            this.scene, 
            'LIFE', 
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
        this.mesh.rotation.y += this.rotationSpeed;
        this.mesh.rotation.x += this.rotationSpeed * 0.5;
        
        // Bounce animation
        this.bounceTime += dt * this.bounceSpeed;
        const bounceOffset = Math.sin(this.bounceTime) * this.bounceHeight;
        this.mesh.position.y = this.baseHeight + 0.175 + bounceOffset;
        
        // Update light position
        this.light.position.copy(this.mesh.position);
        
        // Update arrow position
        if (this.arrow) {
            this.arrow.position.copy(this.position);
            this.arrow.position.y = this.baseHeight + 1.0 + bounceOffset * 0.5;
            this.arrow.rotation.y += 0.04; // Rotate the arrow
            
            // Pulse the arrow opacity
            this.arrow.material.opacity = 0.4 + Math.abs(Math.sin(this.bounceTime * 2)) * 0.6;
        }
        
        // Pulse the light intensity
        const pulseIntensity = 0.5 + Math.abs(Math.sin(this.bounceTime * 2)) * 0.3;
        this.light.intensity = pulseIntensity;
    }
    
    pickup() {
        if (!this.isActive) return 0;
        
        this.isActive = false;
        
        // Remove mesh and light
        this.scene.remove(this.mesh);
        this.scene.remove(this.light);
        if (this.arrow) this.scene.remove(this.arrow);
        
        // Remove the label
        if (this.label) {
            this.label.remove();
        }
        
        // Clean up materials and geometries
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        if (this.arrow) {
            this.arrow.geometry.dispose();
            this.arrow.material.dispose();
        }
        
        // Play pickup sound
        this.audioManager.playPickup();
        
        return this.energyAmount;
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingRadius() {
        return 0.35;
    }
}

export class Rock {
    constructor(scene, position, size = 1) {
        this.scene = scene;
        this.position = position.clone();
        this.size = size;
        this.width = size;
        this.depth = size;
        this.height = size * 0.7;
        this.createRock();
    }
    
    createRock() {
        // Create a group to hold the rock pieces
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        // Create main rock boulder
        const rockGeometry = new THREE.DodecahedronGeometry(this.size * 0.5, 0);
        const rockMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x7D7D7D // Gray color
        });
        const mainRock = new THREE.Mesh(rockGeometry, rockMaterial);
        mainRock.position.y = this.size * 0.25;
        
        // Randomly rotate for variety
        mainRock.rotation.x = Math.random() * Math.PI;
        mainRock.rotation.y = Math.random() * Math.PI;
        mainRock.rotation.z = Math.random() * Math.PI;
        
        this.group.add(mainRock);
        
        // Add some smaller rocks around the main one
        for (let i = 0; i < 3; i++) {
            const smallRockSize = this.size * (0.2 + Math.random() * 0.3);
            const smallRockGeometry = new THREE.DodecahedronGeometry(smallRockSize, 0);
            const smallRockMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x6A6A6A // Slightly darker gray
            });
            
            const smallRock = new THREE.Mesh(smallRockGeometry, smallRockMaterial);
            
            // Position around the main rock
            const angle = Math.random() * Math.PI * 2;
            const distance = this.size * 0.4;
            smallRock.position.set(
                Math.cos(angle) * distance,
                smallRockSize * 0.5,
                Math.sin(angle) * distance
            );
            
            // Random rotation
            smallRock.rotation.x = Math.random() * Math.PI;
            smallRock.rotation.y = Math.random() * Math.PI;
            smallRock.rotation.z = Math.random() * Math.PI;
            
            this.group.add(smallRock);
        }
        
        this.scene.add(this.group);
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingBox() {
        // Create a smaller collision box for rocks (60% of visual size)
        const box = new THREE.Box3().setFromObject(this.group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        
        // Make the collision box 60% of the visual size
        const scale = 0.6;
        return new THREE.Box3(
            new THREE.Vector3(
                center.x - (size.x * scale) / 2,
                center.y - (size.y * scale) / 2,
                center.z - (size.z * scale) / 2
            ),
            new THREE.Vector3(
                center.x + (size.x * scale) / 2,
                center.y + (size.y * scale) / 2,
                center.z + (size.z * scale) / 2
            )
        );
    }
}

export class FlowerPatch {
    constructor(scene, position, size = 1) {
        this.scene = scene;
        this.position = position.clone();
        this.size = size;
        this.width = size;
        this.depth = size;
        this.height = size * 0.5;
        this.createFlowers();
    }
    
    createFlowers() {
        // Create a group to hold the flowers
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        // Create a small mound for the flowers to sit on
        const moundGeometry = new THREE.SphereGeometry(this.size * 0.6, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const moundMaterial = new THREE.MeshBasicMaterial({ color: 0x2d572c });
        const mound = new THREE.Mesh(moundGeometry, moundMaterial);
        mound.position.y = 0;
        this.group.add(mound);
        
        // Add several flowers
        const flowerColors = [0xFFB6C1, 0xFF69B4, 0xFFA500, 0xFFFF00, 0xFFFFFF];
        const numFlowers = 8 + Math.floor(Math.random() * 7); // 8-14 flowers
        
        for (let i = 0; i < numFlowers; i++) {
            // Create flower stem
            const stemHeight = 0.3 + Math.random() * 0.3;
            const stemGeometry = new THREE.CylinderGeometry(0.02, 0.02, stemHeight, 5);
            const stemMaterial = new THREE.MeshBasicMaterial({ color: 0x3a6b39 });
            const stem = new THREE.Mesh(stemGeometry, stemMaterial);
            
            // Position stem
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * (this.size * 0.5);
            stem.position.set(
                Math.cos(angle) * distance,
                stemHeight / 2,
                Math.sin(angle) * distance
            );
            
            // Create flower head
            const flowerColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
            const flowerGeometry = new THREE.ConeGeometry(0.15, 0.1, 6, 1, true);
            const flowerMaterial = new THREE.MeshBasicMaterial({ color: flowerColor });
            const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
            flower.position.y = stemHeight / 2;
            flower.rotation.x = Math.PI;
            
            // Create flower center
            const centerGeometry = new THREE.SphereGeometry(0.06, 8, 8);
            const centerMaterial = new THREE.MeshBasicMaterial({ color: 0xFFCC00 });
            const center = new THREE.Mesh(centerGeometry, centerMaterial);
            center.position.y = 0.05;
            
            // Add center to flower and flower to stem
            flower.add(center);
            stem.add(flower);
            
            // Add slight random tilt
            stem.rotation.x = (Math.random() - 0.5) * 0.2;
            stem.rotation.z = (Math.random() - 0.5) * 0.2;
            
            this.group.add(stem);
        }
        
        this.scene.add(this.group);
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingBox() {
        return new THREE.Box3().setFromObject(this.group);
    }
}

export class Stump {
    constructor(scene, position, size = 1) {
        this.scene = scene;
        this.position = position.clone();
        this.size = size;
        this.width = size;
        this.depth = size;
        this.height = size * 0.6;
        this.createStump();
    }
    
    createStump() {
        // Create a group
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        // Create the main stump
        const stumpGeometry = new THREE.CylinderGeometry(
            this.size * 0.4, // top radius
            this.size * 0.5, // bottom radius
            this.size * 0.6, // height
            10 // segments
        );
        const stumpMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
        const stump = new THREE.Mesh(stumpGeometry, stumpMaterial);
        stump.position.y = this.size * 0.3; // Half of height
        
        // Add rings on top
        const ringsGeometry = new THREE.CircleGeometry(this.size * 0.4, 16);
        const ringsMaterial = new THREE.MeshBasicMaterial({ color: 0x8B5A2B });
        const rings = new THREE.Mesh(ringsGeometry, ringsMaterial);
        rings.rotation.x = 90; // Rotate to be horizontal
        rings.position.y = this.size * 0.6; // Place on top of stump
        
        // Add some moss patches
        for (let i = 0; i < 5; i++) {
            const mossGeometry = new THREE.SphereGeometry(this.size * 0.1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
            const mossMaterial = new THREE.MeshBasicMaterial({ color: 0x3a6b39 });
            const moss = new THREE.Mesh(mossGeometry, mossMaterial);
            
            // Position moss on the side of the stump
            const angle = Math.random() * Math.PI * 2;
            const height = Math.random() * this.size * 0.5;
            moss.position.set(
                Math.cos(angle) * this.size * 0.45,
                height,
                Math.sin(angle) * this.size * 0.45
            );
            
            // Rotate to face outward
            moss.lookAt(new THREE.Vector3(
                moss.position.x * 2,
                moss.position.y,
                moss.position.z * 2
            ));
            
            this.group.add(moss);
        }
        
        this.group.add(stump);
        this.group.add(rings);
        this.scene.add(this.group);
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingBox() {
        return new THREE.Box3().setFromObject(this.group);
    }
}

export class SmallRocks {
    constructor(scene, position, size = 1) {
        this.scene = scene;
        this.position = position.clone();
        this.size = size;
        this.width = size;
        this.depth = size;
        this.height = size * 0.5; // Lower height for rocks
        this.createSmallRocks();
    }
    
    createSmallRocks() {
        // Create a group to hold all rocks
        this.group = new THREE.Group();
        this.group.position.copy(this.position);
        
        // Create multiple small rocks of different sizes
        const numRocks = 8 + Math.floor(Math.random() * 6); // 8-13 rocks
        const rockColors = [0x7D7D7D, 0x6A6A6A, 0x555555, 0x8B8B8B, 0x999999]; // Various gray tones
        
        for (let i = 0; i < numRocks; i++) {
            // Scale for this rock
            const scale = 0.3 + Math.random() * 0.4; // Smaller than mushrooms
            
            // Choose a random geometry for variety
            let geometry;
            const geomType = Math.floor(Math.random() * 4);
            
            if (geomType === 0) {
                // Dodecahedron for angular rocks
                geometry = new THREE.DodecahedronGeometry(this.size * 0.15 * scale, 0);
            } else if (geomType === 1) {
                // Icosahedron for slightly smoother rocks
                geometry = new THREE.IcosahedronGeometry(this.size * 0.14 * scale, 0);
            } else if (geomType === 2) {
                // Tetrahedron for sharp rocks
                geometry = new THREE.TetrahedronGeometry(this.size * 0.16 * scale, 0);
            } else {
                // Box for cubic rocks
                const width = this.size * 0.15 * scale;
                const height = this.size * 0.12 * scale;
                const depth = this.size * 0.14 * scale;
                geometry = new THREE.BoxGeometry(width, height, depth);
            }
            
            // Pick a random rock color
            const rockColor = rockColors[Math.floor(Math.random() * rockColors.length)];
            const material = new THREE.MeshBasicMaterial({ color: rockColor });
            const rock = new THREE.Mesh(geometry, material);
                    
            // Position rock within cluster area
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * (this.size * 0.5);
            rock.position.set(
                Math.cos(angle) * distance,
                scale * 0.08, // Just slightly above ground
                Math.sin(angle) * distance
            );
            
            // Random rotation for natural look
            rock.rotation.x = Math.random() * Math.PI * 2;
            rock.rotation.y = Math.random() * Math.PI * 2;
            rock.rotation.z = Math.random() * Math.PI * 2;
            
            this.group.add(rock);
        }
        
        // Optional: Add some ground texture beneath rocks
        const groundRadius = this.size * 0.6;
        const groundGeometry = new THREE.CircleGeometry(groundRadius, 8);
        const groundMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x555555, 
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Lay flat
        ground.position.y = 0.01; // Just above the main ground
        this.group.add(ground);
        
        this.scene.add(this.group);
    }
    
    getPosition() {
        return this.position;
    }
    
    getBoundingBox() {
        return new THREE.Box3().setFromObject(this.group);
    }
} 