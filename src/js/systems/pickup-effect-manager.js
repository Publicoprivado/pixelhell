import * as THREE from 'three';

export class PickupEffectManager {
    constructor(scene) {
        this.scene = scene;
        
        // Shared geometries for performance
        this.ringGeometry = new THREE.RingGeometry(0.0, 1.0, 8);
        this.particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
        
        // Effect colors for different pickup types
        this.colors = {
            ammo: 0x0088ff,    // Blue
            grenade: 0xff6600, // Orange
            energy: 0x00ff88  // Green
        };
    }
    
    createPickupEffect(position, itemType) {
        const color = this.colors[itemType] || 0xffffff;
        
        // Create expanding ring effect
        this.createRingEffect(position, color);
        
        // Create small particle burst
        this.createParticleBurst(position, color);
        
        // Create brief light flash
        this.createLightFlash(position, color);
    }
    
    createRingEffect(position, color) {
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });
        
        const ring = new THREE.Mesh(this.ringGeometry, ringMaterial);
        ring.position.copy(position);
        ring.position.y = 0.1; // Slightly above ground
        ring.rotation.x = -Math.PI / 2; // Lay flat on ground
        ring.scale.set(0.1, 0.1, 0.1);
        
        this.scene.add(ring);
        
        // Animate ring expansion and fade
        const startTime = performance.now();
        const duration = 400; // 400ms
        
        const animateRing = () => {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1.0) {
                this.scene.remove(ring);
                ringMaterial.dispose();
                return;
            }
            
            // Expand ring
            const scale = 0.1 + progress * 2.0; // Expand to 2.1 units
            ring.scale.set(scale, scale, scale);
            
            // Fade out
            ringMaterial.opacity = 0.8 * (1 - progress);
            
            requestAnimationFrame(animateRing);
        };
        
        animateRing();
    }
    
    createParticleBurst(position, color) {
        const particleCount = 6; // Small number for performance
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const particleMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.9
            });
            
            const particle = new THREE.Mesh(this.particleGeometry, particleMaterial);
            particle.position.copy(position);
            particle.position.y += 0.2; // Start slightly above the pickup
            
            // Random direction for particle movement
            const angle = (i / particleCount) * Math.PI * 2;
            const speed = 0.03 + Math.random() * 0.02;
            
            particle.userData = {
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed,
                    Math.random() * 0.05 + 0.02, // Small upward velocity
                    Math.sin(angle) * speed
                ),
                gravity: -0.002,
                rotationSpeed: (Math.random() - 0.5) * 0.1
            };
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // Animate particles
        const startTime = performance.now();
        const duration = 600; // 600ms
        
        const animateParticles = () => {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1.0) {
                // Clean up particles
                particles.forEach(particle => {
                    this.scene.remove(particle);
                    particle.material.dispose();
                });
                return;
            }
            
            particles.forEach(particle => {
                // Update velocity with gravity
                particle.userData.velocity.y += particle.userData.gravity;
                
                // Move particle
                particle.position.add(particle.userData.velocity);
                
                // Rotate particle
                particle.rotation.y += particle.userData.rotationSpeed;
                
                // Fade out
                particle.material.opacity = 0.9 * (1 - progress);
                
                // Scale down slightly
                const scale = 1.0 - progress * 0.3;
                particle.scale.set(scale, scale, scale);
            });
            
            requestAnimationFrame(animateParticles);
        };
        
        animateParticles();
    }
    
    createLightFlash(position, color) {
        const light = new THREE.PointLight(color, 3, 4);
        light.position.copy(position);
        light.position.y += 0.5;
        
        this.scene.add(light);
        
        // Quick flash and fade
        const startTime = performance.now();
        const duration = 300; // 300ms
        
        const animateLight = () => {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / duration;
            
            if (progress >= 1.0) {
                this.scene.remove(light);
                return;
            }
            
            // Quick flash then fade
            if (progress < 0.1) {
                light.intensity = 3 * (progress / 0.1); // Flash up
            } else {
                light.intensity = 3 * (1 - (progress - 0.1) / 0.9); // Fade out
            }
            
            requestAnimationFrame(animateLight);
        };
        
        animateLight();
    }
    
    cleanup() {
        // Dispose shared geometries
        this.ringGeometry.dispose();
        this.particleGeometry.dispose();
    }
} 