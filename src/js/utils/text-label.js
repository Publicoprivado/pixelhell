import * as THREE from 'three';

export class TextLabel {
    constructor(scene, text, position, options = {}) {
        this.scene = scene;
        this.text = text;
        this.position = position.clone();
        
        // Default options
        this.options = {
            offset: options.offset || new THREE.Vector3(0, 2, 0),
            color: options.color || '#ffffff',
            fontSize: options.fontSize || 1,
            opacity: 0.5 // 50% opacity
        };
        
        this.createLabel();
        
        // Make sure we update on every animation frame
        this.setupAnimationLoop();
    }
    
    createLabel() {
        // Create a div element for the label
        const div = document.createElement('div');
        div.className = 'text-label';
        div.textContent = this.text;
        div.style.position = 'absolute';
        div.style.color = this.options.color;
        div.style.fontSize = `${this.options.fontSize}px`;
        div.style.fontFamily = '"Press Start 2P", cursive';
        div.style.fontWeight = 'bold';
        div.style.textAlign = 'center';
        div.style.opacity = this.options.opacity;
        div.style.userSelect = 'none';
        div.style.pointerEvents = 'none'; // Make it non-interactive
        div.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)'; // Better shadow for pixel font
        div.style.backgroundColor = 'transparent';
        div.style.zIndex = '1000'; // Ensure it's above the canvas
        div.style.padding = '5px';
        
        // Store the div element
        this.element = div;
        
        // Add to document
        document.body.appendChild(this.element);
        
        // Create a helper object3D for position tracking
        this.object3D = new THREE.Object3D();
        this.object3D.position.copy(this.position);
        this.object3D.position.add(this.options.offset);
        this.scene.add(this.object3D);
        
        // Initial update to position the label
        this.updatePosition();
        
        // Ensure we load the font if not already loaded
        if (!document.getElementById('pixelfont-link')) {
            const fontLink = document.createElement('link');
            fontLink.id = 'pixelfont-link';
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }
    }
    
    setupAnimationLoop() {
        // We need to ensure we update every frame
        const animate = () => {
            this.updatePosition();
            this.animationFrameId = requestAnimationFrame(animate);
        };
        
        this.animationFrameId = requestAnimationFrame(animate);
    }
    
    updatePosition() {
        if (!this.element || !this.object3D) return;
        
        // Ensure we have access to the game instance
        const gameInstance = window.gameInstance;
        if (!gameInstance || !gameInstance.camera) {
            return;
        }
        
        // Get the screen position of our helper object
        const vector = new THREE.Vector3();
        this.object3D.updateMatrixWorld();
        vector.setFromMatrixPosition(this.object3D.matrixWorld);
        
        // Project the 3D position to screen coordinates
        vector.project(gameInstance.camera);
        
        // Convert to CSS coordinates
        const x = (vector.x * 0.5 + 0.5) * window.innerWidth;
        const y = (-vector.y * 0.5 + 0.5) * window.innerHeight;
        
        // Position the div
        this.element.style.left = `${x}px`;
        this.element.style.top = `${y}px`;
        this.element.style.transform = 'translate(-50%, -50%)';
        
        // Check if it's behind the camera
        if (vector.z > 1) {
            this.element.style.display = 'none';
        } else {
            this.element.style.display = 'block';
        }
    }
    
    update(position) {
        if (position && this.object3D) {
            this.position.copy(position);
            this.object3D.position.copy(this.position);
            this.object3D.position.add(this.options.offset);
            
            // Update the screen position
            this.updatePosition();
        }
    }
    
    setText(text) {
        if (this.text !== text && this.element) {
            this.text = text;
            this.element.textContent = text;
        }
    }
    
    remove() {
        // Cancel the animation frame
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        
        if (this.object3D && this.object3D.parent) {
            this.scene.remove(this.object3D);
        }
    }
} 