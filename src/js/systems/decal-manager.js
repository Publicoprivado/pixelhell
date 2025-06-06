import * as THREE from 'three';
import { COLORS } from '../utils/constants.js';

export class DecalManager {
    constructor(scene) {

        this.scene = scene;
        this.decals = [];
        this.maxDecals = 80; // Reduced maximum decals (was 200)
        
        // Create textures for decals
        this.createDecalTextures();
        
        // Function to darken a color
        this.darkenColor = (color) => {
            const c = new THREE.Color(color);
            // Darken by reducing RGB values by 40%
            c.r *= 0.1;
            c.g *= 0.1;
            c.b *= 0.1;
            return c.getHex();
        };
        
        // Create shared materials for better performance
        this.sharedMaterials = {
            bullet: new THREE.MeshBasicMaterial({
                map: this.decalTexture,
                transparent: true,
                opacity: 1.0,
                depthTest: true, 
                depthWrite: false,
                color: this.darkenColor(COLORS.BULLET),
                side: THREE.DoubleSide
            }),
            grenade: new THREE.MeshBasicMaterial({
                map: this.decalTexture,
                transparent: true,
                opacity: 1.0,
                depthTest: true, 
                depthWrite: false,
                color: this.darkenColor(0x9B870C), // Darker yellow for grenades
                side: THREE.DoubleSide
            })
        };
        
        // Create reusable geometries
        this.geometries = {
            smallSplat: new THREE.CircleGeometry(0.5, 8), // Octagon
            mediumSplat: new THREE.CircleGeometry(0.7, 8), // Octagon
            largeSplat: new THREE.CircleGeometry(1.0, 8), // Octagon
            surface: new THREE.PlaneGeometry(0.5, 0.5)
        };
        
        // Start auto-cleanup for magenta splats
        this.startAutoCleanup();
    }

    createDecalTextures() {
        // Create high resolution paintball splatter texture
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Function to draw an octagon
        const drawOctagon = (x, y, radius) => {
            const sides = 8;
            context.beginPath();
            for (let i = 0; i <= sides; i++) {
                const angle = (i * 2 * Math.PI / sides) - Math.PI / sides; // Rotate by half segment
                const px = x + radius * Math.cos(angle);
                const py = y + radius * Math.sin(angle);
                if (i === 0) {
                    context.moveTo(px, py);
                } else {
                    context.lineTo(px, py);
                }
            }
            context.closePath();
            context.fill();
        };
        
        // Draw main splatter pattern
        context.fillStyle = '#fff';
        drawOctagon(centerX, centerY, 100); // Main splat
        
        // Add some random splatter details
        for (let i = 0; i < 8; i++) {
            const radius = 15 + Math.random() * 20;
            
            // Calculate random position with controlled spread
            const spreadRadius = 150;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * spreadRadius;
            
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            // Draw octagon for each splatter
            drawOctagon(x, y, radius);
            
            // Add a smaller highlight octagon
            const highlightRadius = radius * 0.6;
            const highlightOffset = radius * 0.2;
            drawOctagon(
                x + highlightOffset,
                y + highlightOffset,
                highlightRadius
            );
        }
        
        // Add some smaller octagons for texture
        for (let i = 0; i < 12; i++) {
            const radius = 3 + Math.random() * 6;
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * 170;
            
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            drawOctagon(x, y, radius);
        }
        
        // Create texture
        this.decalTexture = new THREE.CanvasTexture(canvas);
        this.decalTexture.needsUpdate = true;
    }

    // Create a decal on a surface (rocks, trees, etc.)
    createSurfaceDecal(position, normal, object, color = null) {
        // Check if we're at capacity before creating a new decal
        if (this.decals.length >= this.maxDecals) {
            this.removeOldestDecal();
        }
        
        // Determine which material to use
        let material;
        if (color === 0x9B870C) { // Yellow/grenade color
            material = this.sharedMaterials.grenade;
        } else if (color === COLORS.BULLET || color === null) { // Default magenta
            material = this.sharedMaterials.bullet;
        } else {
            // Create a custom material with darkened color
            material = new THREE.MeshBasicMaterial({
                map: this.decalTexture,
                transparent: true,
                opacity: 0.8,
                depthTest: true, 
                depthWrite: false,
                color: this.darkenColor(color),
                side: THREE.DoubleSide
            });
        }
        
        // Use shared geometry and material
        const decal = new THREE.Mesh(this.geometries.surface, material);
        
        // Position at hit point
        decal.position.copy(position);
        
        // Orient to surface normal
        if (normal) {
            decal.lookAt(position.clone().add(normal));
            decal.position.add(normal.clone().multiplyScalar(0.01));
        }
        
        // Add a random rotation around the normal axis
        decal.rotateZ(Math.random() * Math.PI * 2);
        
        // Add to scene
        this.scene.add(decal);
        
        // Store in decals array with timestamp
        this.decals.push({
            mesh: decal,
            timestamp: Date.now(),
            type: 'surface',
            isCustomColor: color !== null && color !== COLORS.BULLET && color !== 0x9B870C
        });
        
        return decal;
    }
    
    // Create a decal on the ground using texture splatting
    createGroundSplat(position, size = 0.7, color = null) {
        // Check if we're at capacity before creating a new decal
        if (this.decals.length >= this.maxDecals) {
            this.removeOldestDecal();
        }
        
        // Choose the appropriate geometry based on size
        let geometry;
        if (size <= 0.5) {
            geometry = this.geometries.smallSplat;
        } else if (size <= 0.8) {
            geometry = this.geometries.mediumSplat;
        } else {
            geometry = this.geometries.largeSplat;
        }
        
        // Choose appropriate material based on color
        let material;
        if (color === 0x9B870C) { // Yellow/grenade color
            material = this.sharedMaterials.grenade;
        } else if (color === COLORS.BULLET || color === null) { // Default magenta
            material = this.sharedMaterials.bullet;
        } else {
            // Create a custom material with darkened color
            material = new THREE.MeshBasicMaterial({
                map: this.decalTexture,
                transparent: true,
                opacity: 0.8,
                depthTest: true, 
                depthWrite: false,
                color: this.darkenColor(color),
                side: THREE.DoubleSide
            });
        }
        
        const splat = new THREE.Mesh(geometry, material);
        
        // Scale to match requested size while using shared geometries
        const scale = size / (geometry === this.geometries.smallSplat ? 0.5 : 
                             geometry === this.geometries.mediumSplat ? 0.7 : 1.0);
        splat.scale.set(scale, scale, scale);
        
        // Position at hit point, slightly above ground
        splat.position.copy(position);
        splat.position.y = 0.01; // Just above ground
        
        // Orient facing up
        splat.rotation.x = -Math.PI / 2;
        
        // Add a random rotation for variety
        splat.rotation.z = Math.random() * Math.PI * 2;
        
        // Add to scene
        this.scene.add(splat);
        
        // Store in decals array with timestamp and color info
        this.decals.push({
            mesh: splat,
            timestamp: Date.now(),
            type: 'ground',
            isCustomColor: color !== null && color !== COLORS.BULLET && color !== 0x9B870C
        });
        
        return splat;
    }
    
    // Remove the oldest decal immediately
    removeOldestDecal() {
        if (this.decals.length === 0) return;
        
        // Find the oldest decal
        let oldestIndex = 0;
        let oldestTime = Infinity;
        
        for (let i = 0; i < this.decals.length; i++) {
            if (this.decals[i].timestamp < oldestTime) {
                oldestTime = this.decals[i].timestamp;
                oldestIndex = i;
            }
        }
        
        // Remove the oldest decal
        const decal = this.decals[oldestIndex];
        if (decal && decal.mesh) {
            this.scene.remove(decal.mesh);
            
            // Dispose custom materials
            if (decal.isCustomColor && decal.mesh.material) {
                decal.mesh.material.dispose();
            }
            
            this.decals.splice(oldestIndex, 1);
        }
    }
    
    // Prune old decals when we exceed the maximum
    pruneDecals() {
        // This is now handled directly in createGroundSplat and createSurfaceDecal
        // But we keep it for compatibility with existing code
        if (this.decals.length > this.maxDecals) {
            // Remove oldest decals
            const numToRemove = this.decals.length - this.maxDecals;
            
            // Sort by timestamp (oldest first)
            this.decals.sort((a, b) => a.timestamp - b.timestamp);
            
            for (let i = 0; i < numToRemove; i++) {
                const decal = this.decals[i];
                if (decal && decal.mesh) {
                    this.scene.remove(decal.mesh);
                    
                    // Dispose custom materials
                    if (decal.isCustomColor && decal.mesh.material) {
                        decal.mesh.material.dispose();
                    }
                }
            }
            
            // Remove from array
            this.decals.splice(0, numToRemove);
        }
    }
    
    // Clean up all decals
    cleanUp() {
        for (const decal of this.decals) {
            if (decal && decal.mesh) {
                this.scene.remove(decal.mesh);
                
                // Dispose custom materials
                if (decal.isCustomColor && decal.mesh.material) {
                    decal.mesh.material.dispose();
                }
            }
        }
        this.decals = [];
        
        // Dispose of shared resources
        for (const key in this.geometries) {
            if (this.geometries[key]) {
                this.geometries[key].dispose();
            }
        }
        
        for (const key in this.sharedMaterials) {
            if (this.sharedMaterials[key]) {
                this.sharedMaterials[key].dispose();
            }
        }
        
        if (this.decalTexture) {
            this.decalTexture.dispose();
        }
    }
    
    // Auto-cleanup magenta splats every 500ms
    startAutoCleanup() {
        setInterval(() => {
            const now = Date.now();
            
            // Find magenta splats that are older than 10 seconds
            this.decals = this.decals.filter(decal => {
                // Keep non-bullet (magenta) splats, custom color splats, or recent ones
                if (decal.mesh && decal.mesh.material !== this.sharedMaterials.bullet) {
                    // Skip color check if it's not a magenta splat
                    if (decal.isCustomColor) {
                        // For custom colors, don't auto-clean - they'll be removed by regular pruning
                        return true;
                    } else if (decal.mesh.material === this.sharedMaterials.grenade) {
                        // Don't auto-clean grenade splats
                        return true;
                    }
                }
                
                // Check if it's time to remove this magenta splat (older than 10 seconds)
                if (now - decal.timestamp > 10000) {
                    // Remove the mesh
                    this.scene.remove(decal.mesh);
                    
                    // If it's a custom material, dispose it
                    if (decal.isCustomColor && decal.mesh.material) {
                        decal.mesh.material.dispose();
                    }
                    
                    return false;
                }
                
                return true;
            });
        }, 500);
    }
} 
